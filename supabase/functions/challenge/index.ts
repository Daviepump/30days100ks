const allowedActions = new Set([
  'exchange','participant.list','participant.save','participant.delete',
  'admin.list','admin.create','admin.profile','admin.rotate','admin.revoke',
  'admin.runs','admin.save','admin.delete','cloud.create'
]);

const required = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error('Missing server configuration');
  return value;
};

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function digest(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
  return Array.from(bytes,byte => byte.toString(16).padStart(2,'0')).join('');
}
function token() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
function sameHash(left: string,right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i=0; i<left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async request => {
  const headers = {
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Headers':'authorization, apikey, content-type',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Cache-Control':'no-store',
    'Referrer-Policy':'no-referrer',
    'Content-Type':'application/json'
  };
  const reply = (status: number, body: unknown) => Response.json(body,{status,headers});
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
  if (request.method !== 'POST') return reply(405,{code:'method'});
  try {
    const url = required('SUPABASE_URL');
    const service = required('SUPABASE_SERVICE_ROLE_KEY');
    const rpc = (name: string, body: unknown) => fetch(url+'/rest/v1/rpc/'+name,{
      method:'POST', headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},
      body:JSON.stringify(body), signal:AbortSignal.timeout(10000)
    });
    const limit = async (bucket: string, max: number) => {
      const response = await rpc('rfr_rate',{bucket_key:bucket,max_hits:max});
      if (!response.ok) throw new Error('Rate-limit database unavailable');
      return await response.json() === true;
    };
    // The ingress address is only a secondary bucket; a shared ceiling still applies without it.
    const address = request.headers.get('cf-connecting-ip')?.slice(0,64) || 'unknown';
    if (!await limit('global',600) || !await limit('address:'+await digest(address),90)) return reply(429,{code:'rate'});
    const reader = request.body?.getReader();
    if (!reader) return reply(400,{code:'invalid'});
    let size = 0;
    let body = '';
    const decoder = new TextDecoder();
    for (;;) {
      const {value,done} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        return reply(413,{code:'invalid'});
      }
      body += decoder.decode(value,{stream:true});
    }
    body += decoder.decode();
    let payload;
    try { payload=JSON.parse(body); } catch { return reply(400,{code:'invalid'}); }
    if (!payload || !allowedActions.has(payload.action)) return reply(400,{code:'invalid'});
    const action = payload.action as string;
    const args: Record<string,unknown> = {};
    for (const key of ['participant','display_name','goal_km','accent','display_order','active','id',
      'updated_at','run_date','distance_km','duration_seconds','elevation_m']) {
      if (payload[key] !== undefined) args[key]=payload[key];
    }
    let admin: string | null = null;
    let issued: string | undefined;
    if (action === 'exchange' || action.startsWith('participant.')) {
      const secret = action === 'exchange' ? payload.token : payload.session;
      if (typeof secret !== 'string' || !tokenPattern.test(secret)) return reply(401,{code:'denied'});
      const hash = await digest(secret);
      if (!await limit((action === 'exchange' ? 'link:' : 'session:')+hash,30)) return reply(429,{code:'rate'});
      if (action === 'exchange') {
        issued=token();
        args.token_hash=hash;
        args.session_hash=await digest(issued);
      } else args.session_hash=hash;
    } else if (action === 'cloud.create') {
      const bearer=request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/i)?.[1];
      const hash=Deno.env.get('RFR_CLOUD_TOKEN_SHA256');
      if (!bearer || !hash || !sameHash(await digest(bearer),hash)) return reply(403,{code:'denied'});
    } else {
      const bearer=request.headers.get('Authorization');
      if (!bearer?.startsWith('Bearer ')) return reply(401,{code:'denied'});
      const identity=await fetch(url+'/auth/v1/user',{
        headers:{apikey:service,Authorization:bearer}, signal:AbortSignal.timeout(10000)
      });
      if (identity.status >= 500) return reply(503,{code:'unavailable'});
      if (!identity.ok) return reply(401,{code:'denied'});
      const user=await identity.json();
      if (typeof user.id !== 'string' || !uuidPattern.test(user.id)) return reply(401,{code:'denied'});
      admin=user.id;
    }
    if (['admin.create','admin.rotate','cloud.create'].includes(action)) {
      issued=token();
      args.new_hash=await digest(issued);
    }
    const response=await rpc('rfr_manage',{action,args,admin_id:admin});
    if (!response.ok) {
      const error=await response.json().catch(() => ({}));
      return /^(22|23)/.test(error.code ?? '') ? reply(400,{code:'invalid'}) : reply(503,{code:'unavailable'});
    }
    const result=await response.json();
    if (result === null) return reply(403,{code:'denied'});
    if (result.conflict) return reply(409,{code:'conflict'});
    return reply(200,{data:result,...(issued ? {secret:issued} : {})});
  } catch {
    return reply(503,{code:'unavailable'});
  }
});
