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
          storageKey:authenticated ? 'rfr-run-logger' : 'rfr-public'
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
    if (!Array.isArray(rows) || rows.length !== Object.keys(M.participants).length) throw new Error('Runner data is incomplete.');
    return Object.fromEntries(Object.keys(M.participants).map(slug => {
      const profile = rows.find(row => row.participant === slug);
      if (!profile || !Number.isFinite(profile.goal_km) || profile.goal_km <= 0 || !Array.isArray(profile.runs)) {
        throw new Error('Runner data is invalid.');
      }
      const runs = profile.runs.map(normalize);
      if (runs.some(run => !Number.isFinite(Date.parse(run.updatedAt)))) throw new Error('Run update timestamp is invalid.');
      const lastUpdated = runs.reduce((last,run) => Math.max(last,Date.parse(run.updatedAt)),0);
      return [slug,{challenge:M.config, goalKm:profile.goal_km, runs,lastUpdated:lastUpdated ? new Date(lastUpdated).toISOString() : null}];
    }));
  }

  async function logger() {
    const db = await client(true);
    const table = () => db.from('rfr_runs');
    const columns = 'id,run_date,distance_km,duration_seconds,elevation_m,updated_at';
    return {
      session:async () => (await unwrap(db.auth.getSession())).session,
      signIn:async (email,password) => unwrap(db.auth.signInWithPassword({email,password})),
      signOut:() => unwrap(db.auth.signOut({scope:'local'})),
      onAuth:callback => db.auth.onAuthStateChange(() => setTimeout(callback,0)),
      participant:() => unwrap(db.rpc('rfr_my_participant')),
      list:async slug => (await unwrap(table().select(columns).eq('participant',slug)
        .order('run_date',{ascending:false}).order('created_at',{ascending:false}))).map(normalize),
      save:async (slug,run,values) => {
        if (run.updatedAt) {
          const result = await unwrap(table().update(values).eq('participant',slug).eq('id',run.id)
            .eq('updated_at',run.updatedAt).select(columns).maybeSingle());
          if (!result) throw Object.assign(new Error('This record changed.'),{code:'conflict'});
          return normalize(result);
        }
        try {
          return normalize(await unwrap(table().insert({...values,id:run.id,participant:slug}).select(columns).single()));
        } catch (error) {
          if (error.code !== '23505') throw error;
          const result = await unwrap(table().select(columns).eq('participant',slug).eq('id',run.id).maybeSingle());
          if (!result || !Object.entries(values).every(([key,value]) => result[key] === value)) {
            throw Object.assign(new Error('This request already exists with different values.'),{code:'duplicate'});
          }
          return normalize(result);
        }
      },
      remove:async (slug,run) => {
        const result = await unwrap(table().delete().eq('participant',slug).eq('id',run.id)
          .eq('updated_at',run.updatedAt).select('id').maybeSingle());
        if (!result) throw Object.assign(new Error('This record changed.'),{code:'conflict'});
      }
    };
  }

  globalThis.RunningData = {snapshot,logger,notify:() => channel?.postMessage('changed'),onChange:callback => {
    channel?.addEventListener('message',callback);
  }};
})();
