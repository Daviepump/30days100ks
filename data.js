(() => {
  'use strict';
  const M = RunningChallenge;
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('rfr-runs-changed') : null;
  let sdk;
  const clients = new Map();

  function configurationError(message) {
    return Object.assign(new Error(message),{code:'configuration'});
  }

  function getSdk() {
    if (globalThis.supabase?.createClient) return Promise.resolve(globalThis.supabase);
    if (!sdk) sdk = new Promise((resolve,reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.2/dist/umd/supabase.js';
      script.integrity = 'sha384-A97u3Qnt9GZHURO9YJZRe7VQgGUeFzcv6I1oIGnUTxQrCxnpQMwR0/G8F2zt9abZ';
      script.crossOrigin = 'anonymous';
      const fail = () => {
        clearTimeout(timer);
        script.remove();
        reject(new Error('Unable to load Supabase.'));
      };
      const timer = setTimeout(fail,10000);
      script.onload = () => {
        clearTimeout(timer);
        if (globalThis.supabase?.createClient) resolve(globalThis.supabase);
        else fail();
      };
      script.onerror = fail;
      document.head.append(script);
    }).catch(error => { sdk = null; throw error; });
    return sdk;
  }

  async function client(authenticated = false) {
    const {url,publishableKey} = RunningSupabaseConfig;
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url) || !/^sb_publishable_[\w-]+$/.test(publishableKey)) {
      throw configurationError('Enter the Supabase project URL and publishable key.');
    }
    const library = await getSdk();
    if (!clients.has(authenticated)) {
      clients.set(authenticated,library.createClient(url,publishableKey,{
        auth:{
          persistSession:authenticated, autoRefreshToken:authenticated, detectSessionInUrl:false,
          storageKey:authenticated ? 'rfr-admin' : 'rfr-public'
        },
        global:{fetch:(url,options = {}) => {
          const deadline = AbortSignal.timeout(12000);
          const signal = options.signal ? AbortSignal.any([options.signal,deadline]) : deadline;
          return fetch(url,{...options,signal,cache:'no-store'});
        }}
      }));
    }
    return clients.get(authenticated);
  }

  async function unwrap(request) {
    const {data,error} = await request;
    if (error) throw error;
    return data;
  }

  function normalize(row) {
    return {
      id:row.id, date:row.run_date, distanceKm:row.distance_km, updatedAt:row.updated_at,
      ...(row.duration_seconds == null ? {} : {durationSeconds:row.duration_seconds}),
      ...(row.elevation_m == null ? {} : {elevationGainM:row.elevation_m})
    };
  }

  async function snapshot() {
    const db = await client();
    const rows = await unwrap(db.rpc('rfr_dashboard'));
    if (!Array.isArray(rows) || new Set(rows.map(row => row.participant)).size !== rows.length) throw new Error('Runner data is incomplete.');
    return Object.fromEntries(rows.map(profile => {
      const slug = profile.participant;
      if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug) || typeof profile.display_name !== 'string' ||
          !/^#[0-9A-Fa-f]{6}$/.test(profile.accent) || !Number.isFinite(profile.goal_km) || profile.goal_km <= 0 || !Array.isArray(profile.runs)) {
        throw new Error('Runner data is invalid.');
      }
      const runs = profile.runs.map(normalize);
      if (runs.some(run => !Number.isFinite(Date.parse(run.updatedAt)))) throw new Error('Run update timestamp is invalid.');
      const lastUpdated = runs.reduce((last,run) => Math.max(last,Date.parse(run.updatedAt)),0);
      return [slug,{name:profile.display_name,accent:profile.accent,challenge:M.config, goalKm:profile.goal_km, runs,lastUpdated:lastUpdated ? new Date(lastUpdated).toISOString() : null}];
    }));
  }

  async function edge(action,payload = {},bearer) {
    const {url,publishableKey} = RunningSupabaseConfig;
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url) || !/^sb_publishable_[\w-]+$/.test(publishableKey)) {
      throw configurationError('Enter the Supabase project URL and publishable key.');
    }
    const response = await fetch(url.replace(/\/$/,'')+'/functions/v1/challenge',{
      method:'POST',cache:'no-store',signal:AbortSignal.timeout(15000),
      headers:{apikey:publishableKey,'Content-Type':'application/json',...(bearer ? {Authorization:'Bearer '+bearer} : {})},
      body:JSON.stringify({...payload,action})
    });
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error('Request failed'),{code:result.code});
    return result;
  }

  async function admin() {
    const db = await client(true);
    return {
      signIn:(email,password) => unwrap(db.auth.signInWithPassword({email,password})),
      signOut:() => unwrap(db.auth.signOut({scope:'local'})),
      session:async () => (await unwrap(db.auth.getSession())).session,
      setVisibility:(runnerId,visible) => unwrap(db.rpc('rfr_set_visibility',{runner_id:runnerId,is_visible:visible})),
      onAuth:callback => db.auth.onAuthStateChange(() => setTimeout(callback,0)),
      request:async (action,payload) => {
        const session = (await unwrap(db.auth.getSession())).session;
        if (!session) throw Object.assign(new Error('Sign in required'),{code:'denied'});
        return edge('admin.'+action,payload,session.access_token);
      }
    };
  }

  globalThis.RunningData = {snapshot,edge,admin,normalize,notify:() => channel?.postMessage('changed'),onChange:callback => {
    channel?.addEventListener('message',callback);
  }};
})();
