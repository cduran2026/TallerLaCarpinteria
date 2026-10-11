const assert = require('node:assert/strict');
const { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } = require('node:fs/promises');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const dist = path.join(root, 'dist');
let built;

async function build() {
  built ||= import(pathToFileURL(path.join(root, 'scripts/build-static.mjs')).href)
    .then(module => module.buildStatic(root));
  return built;
}

async function list(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) result.push(...await list(path.join(directory, entry.name), relative));
    else result.push(relative);
  }
  return result;
}

test('dist contiene web, maestro, 3D y Estudio sin archivos internos', async () => {
  const { files } = await build();
  const actual = await list(dist);
  assert.deepEqual(actual.sort(), [...files, '_headers'].sort());
  for (const required of [
    'index.html', 'styles.css', 'script.js', 'maestro/index.html',
    'maestro/js/app.js', 'maestro/js/designer-bridge.js',
    'assets/vendor/three.min.js', 'assets/vendor/OrbitControls.js',
    'assets/configurator.js', 'assets/content-studio/renderer.js',
    'assets/designer/v2/closet-distribution.js', 'assets/production/piece-generator.js',
  ]) assert.ok(actual.includes(required), `Falta ${required}`);
  for (const excluded of [
    'maestro/marketing.css', 'assets/marketing/calendar-core.js',
    'assets/content-studio/motion.js', 'assets/content-studio/audio-preview.js',
    'maestro/js/views/content-calendar.js', 'maestro/js/repositories/marketing.js',
  ]) assert.ok(!actual.includes(excluded), 'Archivo en desarrollo presente: ' + excluded);
  assert.ok(actual.every(file => !/(^|\/)(supabase|tests|scripts|docs)(\/|$)|\.(?:md|sql|ps1|toml|env)$/i.test(file)));
  assert.ok(actual.every(file => !/(^|\/)(?:\.|.*(?:secret|credential|private))/i.test(file)));
});

test('HTML publicado resuelve sus recursos locales desde dist', async () => {
  await build();
  for (const htmlPath of ['index.html', 'maestro/index.html']) {
    const html = await readFile(path.join(dist, htmlPath), 'utf8');
    for (const [, , value] of html.matchAll(/\b(src|href)="([^"]+)"/g)) {
      if (/^(?:https?:|mailto:|tel:|#|data:)/i.test(value)) continue;
      const target = path.resolve(dist, path.dirname(htmlPath), value.split(/[?#]/)[0]);
      assert.ok(target === dist || target.startsWith(dist + path.sep), `Ruta fuera de dist: ${value}`);
      const info = await stat(target);
      if (info.isDirectory()) await stat(path.join(target, 'index.html'));
    }
  }
});

test('allowlist rechaza archivos privados aun bajo un directorio público', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'taller-static-'));
  try {
    const module = await import(pathToFileURL(path.join(root, 'scripts/build-static.mjs')).href);
    for (const relative of [...module.PUBLIC_FILES, ...[
      'maestro/js/app.js', 'maestro/js/config.js', 'maestro/js/designer-bridge.js',
      'assets/brand/logo.jpg', 'assets/vendor/three.min.js',
      'assets/vendor/OrbitControls.js', 'assets/content-studio/renderer.js',
      'assets/designer/v2/store.js',
    ]]) {
      const file = path.join(temporary, relative);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, 'test');
    }
    for (const relative of module.PUBLIC_DIRECTORIES) await mkdir(path.join(temporary, relative), { recursive: true });
    await writeFile(path.join(temporary, 'assets/brand/.env'), 'PRIVATE=fixture');
    await assert.rejects(module.collectPublicFiles(temporary), /Archivo privado/);
  } finally {
    const safeTempRoot = path.resolve(os.tmpdir());
    const safeTarget = path.resolve(temporary);
    assert.ok(path.dirname(safeTarget) === safeTempRoot && path.basename(safeTarget).startsWith('taller-static-'));
    await rm(safeTarget, { recursive: true, force: true });
  }
});

test('metadatos de producción y configuración Supabase son públicos y válidos', async () => {
  await build();
  const html = await readFile(path.join(dist, 'index.html'), 'utf8');
  assert.match(html, /<link rel="canonical" href="https:\/\/tallerlacarpinteria\.cl\/">/);
  assert.match(html, /<meta property="og:url" content="https:\/\/tallerlacarpinteria\.cl\/">/);
  const config = await readFile(path.join(dist, 'maestro/js/config.js'), 'utf8');
  assert.match(config, /sb_publishable_/);
  assert.doesNotMatch(config, /sb_secret_|service_role|META_APP_SECRET/);
});

test('Pages falla sin variables públicas o con backend productivo en preview', async () => {
  await build();
  const script = path.join(root, 'scripts/build-static.mjs');
  const original = await readFile(path.join(dist, 'index.html'), 'utf8');
  const baseEnv = { ...process.env, CF_PAGES: '1', CF_PAGES_BRANCH: 'main' };
  delete baseEnv.PUBLIC_SUPABASE_URL;
  delete baseEnv.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const missing = spawnSync(process.execPath, [script], { cwd: root, env: baseEnv, encoding: 'utf8' });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /requiere PUBLIC_SUPABASE_URL/);
  const sourceConfig = await readFile(path.join(root, 'maestro/js/config.js'), 'utf8');
  const [, productionUrl] = sourceConfig.match(/supabaseUrl:\s*['"]([^'"]+)['"]/);
  const [, publicKey] = sourceConfig.match(/supabasePublishableKey:\s*['"]([^'"]+)['"]/);
  const preview = spawnSync(process.execPath, [script], {
    cwd: root, encoding: 'utf8',
    env: { ...baseEnv, CF_PAGES_BRANCH: 'staging', PUBLIC_SUPABASE_URL: productionUrl + '/', PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey },
  });
  assert.notEqual(preview.status, 0);
  assert.match(preview.stderr, /preview no puede utilizar/);
  assert.equal(await readFile(path.join(dist, 'index.html'), 'utf8'), original, 'Un build rechazado no altera dist.');
});
