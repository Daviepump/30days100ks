(() => {
  'use strict';
  // Loaded only inside the local browser harness. No live configuration or network writes.
  const mock = parent.rfrMock;
  Date.now = () => Date.parse('2026-12-01T01:00:00+11:00');
  globalThis.RunningSupabaseConfig = {url:'https://test.supabase.co',publishableKey:'sb_publishable_fake'};
  const success = data => ({data,error:null});
  const failure = code => ({data:null,error:{code}});
  let event;
  class Query {
    constructor() { this.mode = 'read'; this.filters = []; }
    select() { return this; }
    order() { return this; }
    eq(key,value) { this.filters.push(row => row[key] === value); return this; }
    insert(values) { this.mode = 'insert'; this.values = values; return this; }
    update(values) { this.mode = 'update'; this.values = values; return this; }
    delete() { this.mode = 'delete'; return this; }
    single() { this.one = true; return this; }
    maybeSingle() { this.one = true; return this; }
    then(resolve) {
      const rows = mock.rows.filter(row => this.filters.every(filter => filter(row)));
      if (this.mode === 'insert') {
        mock.ids.push(this.values.id);
        if (this.values.participant !== mock.user) return resolve(failure('42501'));
        if (mock.rows.some(row => row.id === this.values.id)) return resolve(failure('23505'));
        const row = {...this.values,updated_at:new Date().toISOString()};
        mock.rows.unshift(row);
        mock.writes++;
        if (mock.interruptInsert) { mock.interruptInsert = false; return resolve(failure('network')); }
        return resolve(success(row));
      }
      const row = rows[0];
      if (this.mode !== 'read' && row?.participant !== mock.user) return resolve(success(null));
      if (row && this.mode === 'update') Object.assign(row,this.values,{updated_at:new Date().toISOString()});
      if (row && this.mode === 'delete') mock.rows.splice(mock.rows.indexOf(row),1);
      return resolve(success(this.one ? row ?? null : rows));
    }
  }
  globalThis.supabase = {createClient:() => ({
    auth:{
      getSession:async () => success({session:mock.user ? {user:{id:mock.user}} : null}),
      signInWithPassword:async ({email,password}) => {
        if (password !== 'test-only') return failure('credentials');
        mock.user = email.split('@')[0];
        event?.();
        return success({});
      },
      signOut:async () => { mock.user = null; event?.(); return success(null); },
      onAuthStateChange:callback => { event = callback; }
    },
    rpc:async name => {
      if (name === 'rfr_my_participant') return success(mock.user);
      mock.requests++;
      if (mock.failRead) return failure('network');
      return success(['dave','kate'].map(participant => ({
        participant,goal_km:100,runs:mock.rows.filter(row => row.participant === participant)
      })));
    },
    from:() => new Query()
  })};
})();
