(() => {
  const mock=parent.rfrMock;
  Date.now=() => Date.parse('2026-12-01T01:00:00+11:00');
  globalThis.RunningSupabaseConfig={url:'https://test.supabase.co',publishableKey:'sb_publishable_fake'};
  const profiles=[['dave','Dave','#B9F94B'],['kate','Kate','#D59BFF'],['ada','Ada','#93C5FD']]
    .map(([participant,display_name,accent])=>({participant,display_name,accent,goal_km:100,active:true,display_order:10,runs:[]}));
  const nativeFetch=window.fetch;
  window.fetch=(url,options) => {
    if (url!=='https://test.supabase.co/functions/v1/challenge') return nativeFetch(url,options);
    const payload=JSON.parse(options.body);
    const answer=(status,data,extra={}) => Promise.resolve(new Response(JSON.stringify({data,...extra}),{status}));
    if (payload.action.startsWith('admin.')) {
      if (options.headers.Authorization!=='Bearer admin') return answer(403,null,{code:'denied'});
      if (payload.action==='admin.list') return answer(200,profiles);
      if (payload.action==='admin.create') {
        mock.created=true;
        profiles.push({...payload,participant:'steve',active:true,has_link:true});
        return answer(200,profiles.at(-1),{secret:'local-simulated-token'});
      }
    }
    if (mock.revoked || payload.session!=='local-simulated-session') return answer(403,null,{code:'denied'});
    if (payload.action==='participant.list') return answer(200,{...profiles[0],runs:mock.records});
    if (payload.action==='participant.save') {
      const row={...payload,updated_at:new Date().toISOString()};
      const index=mock.records.findIndex(item=>item.id===row.id);
      if (index<0) mock.records.push(row); else mock.records[index]=row;
      return answer(200,row);
    }
    if (payload.action==='participant.delete') {
      mock.records=mock.records.filter(row=>row.id!==payload.id);
      return answer(200,{ok:true});
    }
    return answer(400,null,{code:'invalid'});
  };
  const success=data=>({data,error:null});
  globalThis.supabase={createClient:()=>({
    rpc:async () => mock.offline ? {error:{code:'network'}} : success(profiles),
    auth:{
      getSession:async () => success({session:mock.admin ? {access_token:mock.admin} : null}),
      signInWithPassword:async () => { mock.admin='admin'; return success({}); },
      signOut:async () => { mock.admin=null; return success(null); },
      onAuthStateChange:()=>{}
    }
  })};
})();
