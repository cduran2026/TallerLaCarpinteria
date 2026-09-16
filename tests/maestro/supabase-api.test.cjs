// Only run against a REAL TEST Supabase project after migrations/provisioning.
// Required env: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY,
// MAESTRO_A_EMAIL, MAESTRO_A_PASSWORD, MAESTRO_A_WORKSHOP,
// MAESTRO_B_EMAIL, MAESTRO_B_PASSWORD, MAESTRO_B_WORKSHOP.
// Credentials stay in process memory. Creates labelled test data, never deletes it.
const assert = require('node:assert/strict');
const required = ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','MAESTRO_A_EMAIL','MAESTRO_A_PASSWORD','MAESTRO_A_WORKSHOP','MAESTRO_B_EMAIL','MAESTRO_B_PASSWORD','MAESTRO_B_WORKSHOP'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) { console.error('No se ejecutó ninguna llamada. Faltan: ' + missing.join(', ')); process.exit(1); }
const env = process.env, base = env.SUPABASE_URL.replace(/\/$/, ''), stamp = 'Prueba FASE2A ' + Date.now();
const tokens = [];
async function request(path, token, method = 'GET', body) {
  const result = await fetch(base + path, { method, headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY,
    ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json', Prefer: 'return=representation' },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await result.text();
  return { status: result.status, data: text ? JSON.parse(text) : null };
}
async function login(who) {
  const result = await request('/auth/v1/token?grant_type=password', null, 'POST', { email: env[`MAESTRO_${who}_EMAIL`], password: env[`MAESTRO_${who}_PASSWORD`] });
  if (result.status !== 200 || !result.data.access_token) throw new Error(`Login ${who} falló (HTTP ${result.status}); revisar la cuenta real.`);
  tokens.push(result.data.access_token);
  return result.data.access_token;
}
async function insert(table, token, body) {
  const result = await request('/rest/v1/' + table, token, 'POST', body);
  if (result.status !== 201) throw new Error(`INSERT ${table}: HTTP ${result.status}, código ${result.data?.code || 'desconocido'}`);
  return result.data[0];
}
(async () => {
  try {
    const a = await login('A'), b = await login('B');
    const wa = env.MAESTRO_A_WORKSHOP, wb = env.MAESTRO_B_WORKSHOP;
    assert.notEqual(wa, wb);
    const own = await request('/rest/v1/workshops?select=id', a);
    assert.equal(own.status, 200);
    assert.ok(own.data.some(w => w.id === wa));
    assert.ok(!own.data.some(w => w.id === wb), 'A must not belong to B workshop for this test');
    const ca = await insert('clients', a, { workshop_id: wa, name: stamp + ' A', phone: '+56911111111', commune: 'Santiago', address: null });
    const cb = await insert('clients', b, { workshop_id: wb, name: stamp + ' B', phone: '+56922222222', commune: 'Santiago', address: null });
    const pa = { workshop_id: wa, client_id: ca.id, name: stamp, site_commune: 'Santiago', site_address: null };
    const [p1, p2] = await Promise.all([insert('projects', a, pa), insert('projects', a, pa)]);
    assert.notEqual(p1.code, p2.code, 'Concurrent project codes');
    assert.match(p1.code, /^LC-\d{4}-\d{4,}$/);
    const pb = await insert('projects', b, { ...pa, workshop_id: wb, client_id: cb.id });
    const configuration = { type: 'kitchen', kitchenLayout: 'l', width: 280, secondLeg: 180, height: 240, depth: 65,
      upper: true, lower: true, rod: true, shelves: 3, drawers: 0, sink: true, oven: true, hood: true, material: 'premium', color: '#8a6a46', unit: 'cm' };
    const payload = { workshop_id: wa, project_id: p1.id, name: stamp, type: 'kitchen', configuration, schema_version: 1, generator_version: '1.0.0' };
    const da = await insert('designs', a, payload);
    const db = await insert('designs', b, { ...payload, workshop_id: wb, project_id: pb.id });
    await insert('designs', a, { ...payload, name: stamp + ' Clóset', type: 'closet', configuration: { ...configuration, type: 'closet', sink: false, oven: false, drawers: 2 } });
    for (const [table, id] of [['clients',cb.id], ['projects',pb.id], ['designs',db.id]]) {
      const read = await request(`/rest/v1/${table}?id=eq.${id}&select=*`, a);
      assert.equal(read.status, 200); assert.deepEqual(read.data, []);
      const update = await request(`/rest/v1/${table}?id=eq.${id}`, a, 'PATCH', { name: 'No debe cambiar' });
      assert.equal(update.status, 200); assert.deepEqual(update.data, []);
    }
    const crossClient = await request('/rest/v1/projects', a, 'POST', { ...pa, client_id: cb.id });
    assert.equal(crossClient.data?.code, '23503');
    const crossDesign = await request('/rest/v1/designs', a, 'POST', { ...payload, project_id: pb.id });
    assert.equal(crossDesign.data?.code, '23503');
    const foreignInsert = await request('/rest/v1/clients', a, 'POST', { workshop_id: wb, name: stamp, phone: '1', commune: 'Santiago' });
    assert.equal(foreignInsert.status, 403);
    for (const table of ['workshops','workshop_members','clients','projects','designs']) {
      const anon = await request(`/rest/v1/${table}?select=*`, null);
      assert.ok([401,403].includes(anon.status));
    }
    await request('/auth/v1/logout', a, 'POST');
    const again = await login('A');
    const restored = await request(`/rest/v1/designs?id=eq.${da.id}&select=*`, again);
    assert.deepEqual(restored.data[0].configuration, configuration);
    console.log('PASS real Auth/API: isolation, concurrent codes, cross relations, multiple designs and recovery.');
    console.log('Test records retained under label: ' + stamp);
  } finally {
    await Promise.allSettled(tokens.map(token => request('/auth/v1/logout', token, 'POST')));
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
