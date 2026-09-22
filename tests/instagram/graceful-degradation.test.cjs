const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function load(file, names, dependencies) {
  const source = read(file).replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
  return vm.runInNewContext(`${source}\n({ ${names.join(', ')} })`, dependencies);
}
function repository(response, { userId = 'current-user', thrown = null } = {}) {
  const filters = [];
  const warnings = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    from: () => ({
      select() { return this; },
      eq(key, value) { filters.push([key, value]); return this; },
      async limit() { if (thrown) throw thrown; return response; },
      async maybeSingle() { return response; },
    }),
  };
  const functions = load('maestro/js/repositories/social-connections.js', ['loadInstagramCapability', 'getMembershipRole'], {
    getClient: async () => client,
    console: { warn: (...args) => warnings.push(args), error: (...args) => warnings.push(args) },
  });
  return { ...functions, filters, warnings };
}
const connection = { id: 'connection-1', provider: 'instagram', status: 'connected', permissions: ['instagram_business_basic'], username: 'taller', external_account_id: '123' };

test('sin tabla 005, Instagram queda no disponible sin lanzar una excepción', async () => {
  const repo = repository({ data: null, error: { code: 'PGRST205', status: 404, message: 'table missing' } });
  const result = await repo.loadInstagramCapability('workshop-1');
  assert.equal(result.kind, 'unavailable');
  assert.equal(result.connection, null);
  assert.equal(repo.warnings.length, 1);
});
test('cero conexiones y una conexión válida se distinguen sin respuesta singular', async () => {
  assert.equal((await repository({ data: [], error: null }).loadInstagramCapability('workshop-1')).kind, 'available');
  const result = await repository({ data: [connection], error: null }).loadInstagramCapability('workshop-1');
  assert.equal(result.connection.username, 'taller');
});
test('datos duplicados o inválidos deshabilitan la integración', async () => {
  assert.equal((await repository({ data: [connection, connection], error: null }).loadInstagramCapability('workshop-1')).kind, 'invalid');
  assert.equal((await repository({ data: [{ ...connection, permissions: null }], error: null }).loadInstagramCapability('workshop-1')).kind, 'invalid');
});
test('errores de red y sesión expirada se informan sin abortar la vista', async () => {
  assert.equal((await repository(null, { thrown: new Error('network unavailable') }).loadInstagramCapability('workshop-1')).kind, 'error');
  assert.equal((await repository({ data: null, error: { status: 401, message: 'JWT expired' } }).loadInstagramCapability('workshop-1')).kind, 'auth_required');
});
test('el rol se consulta por taller y por el usuario autenticado', async () => {
  const repo = repository({ data: { role: 'admin' }, error: null });
  assert.equal(await repo.getMembershipRole('workshop-1'), 'admin');
  assert.ok(repo.filters.some(([key, value]) => key === 'user_id' && value === 'current-user'));
});
test('Estudio de Contenido conserva sus datos cuando Instagram no está instalado', async () => {
  let roleRequested = false;
  let received;
  const { contentStudio } = load('maestro/js/views/content-studio.js', ['contentStudio'], {
    listProjects: async () => [{ id: 'project-1' }],
    listDesigns: async () => [{ project_id: 'project-1', type: 'kitchen' }],
    loadInstagramCapability: async () => ({ kind: 'unavailable', connection: null }),
    getMembershipRole: async () => { roleRequested = true; throw new Error('should not be called'); },
    createContentStudio: options => { received = options; return { element: 'studio' }; },
  });
  const view = await contentStudio({ id: 'workshop-1' });
  assert.equal(view.element, 'studio');
  assert.equal(received.projects.length, 1);
  assert.equal(received.instagramConnection, null);
  assert.equal(received.canPublishInstagram, false);
  assert.equal(roleRequested, false);
});
test('Configuración muestra un estado controlado cuando falta la tabla', async () => {
  const h = (tag, properties, ...children) => ({ tag, properties, children, addEventListener() {}, classList: { add() {}, remove() {} } });
  const { instagramIntegration } = load('maestro/js/views/instagram-integration.js', ['instagramIntegration'], {
    h, formatShortDate: value => value, timeAgo: value => value,
    loadInstagramCapability: async () => ({ kind: 'unavailable', connection: null }),
    getMembershipRole: async () => { throw new Error('should not be called'); },
    listInstagramPublications: async () => { throw new Error('should not be called'); },
    startInstagramConnection() {}, testInstagramConnection() {}, disconnectInstagram() {},
    console,
  });
  const view = await instagramIntegration({ id: 'workshop-1', name: 'La Carpintería' });
  assert.match(JSON.stringify(view.element), /Integración de Instagram todavía no habilitada/);
  assert.doesNotMatch(JSON.stringify(view.element), /Conectar Instagram.*integration-actions/);
});
