const assert = require('node:assert/strict');
const { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const dist = path.join(root, 'dist');
const modulePromise = import(pathToFileURL(path.join(root, 'scripts/build-static.mjs')).href);
let built;

async function build() {
  built ||= modulePromise.then(module => module.buildStatic(root));
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

test('la demo publica solo web, cotizador y asistente', async () => {
  const { files } = await build();
  const actual = await list(dist);
  assert.deepEqual(actual.sort(), [...files, '_headers', 'robots.txt', '404.html'].sort());
  for (const required of [
    'index.html', 'styles.css', 'script.js', 'assets/configurator.js',
    'assets/designer/controller.js', 'assets/designer/serialization.js',
    'assets/vendor/three.min.js', 'assets/vendor/OrbitControls.js',
    'assets/assistant/ui.mjs', 'assets/assistant/engine.mjs',
    'assets/brand/asistente-maestro-boton.webp', 'assets/brand/asistente-maestro-panel.webp',
    'assets/fotos-reales/fundador-optimizado.webp', 'assets/fotos-reales/proceso-fabricamos.webp',
  ]) assert.ok(actual.includes(required), 'Falta ' + required);
  assert.ok(actual.every(file => !/(^|\/)(?:maestro|supabase|tests|scripts|docs|assets\/content-studio|assets\/production|assets\/marketing)(\/|$)/i.test(file)));
  assert.ok(actual.every(file => !/\.(?:md|sql|ps1|toml|env)$/i.test(file)));
  const html = await readFile(path.join(dist, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /href=["']maestro\//);
  assert.match(html, /noindex,nofollow/);
  assert.match(await readFile(path.join(dist, '_headers'), 'utf8'), /X-Robots-Tag: noindex, nofollow/);
  assert.match(await readFile(path.join(dist, 'robots.txt'), 'utf8'), /Disallow: \//);
});

test('HTML de la demo resuelve recursos locales desde dist', async () => {
  await build();
  const html = await readFile(path.join(dist, 'index.html'), 'utf8');
  for (const [, , value] of html.matchAll(/\b(src|href)="([^"]+)"/g)) {
    if (/^(?:https?:|mailto:|tel:|#|data:)/i.test(value)) continue;
    const target = path.resolve(dist, value.split(/[?#]/)[0]);
    assert.ok(target.startsWith(dist + path.sep), 'Ruta fuera de dist: ' + value);
    await stat(target);
  }
});

test('allowlist rechaza archivos privados bajo un directorio público', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'taller-static-'));
  try {
    const module = await modulePromise;
    for (const relative of module.PUBLIC_FILES) {
      const file = path.join(temporary, relative);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, 'test');
    }
    for (const relative of module.PUBLIC_DIRECTORIES) await mkdir(path.join(temporary, relative), { recursive: true });
    await writeFile(path.join(temporary, 'assets/assistant/.env'), 'PRIVATE=fixture');
    await assert.rejects(module.collectPublicFiles(temporary), /Archivo privado/);
  } finally {
    const safeTempRoot = path.resolve(os.tmpdir());
    const safeTarget = path.resolve(temporary);
    assert.ok(path.dirname(safeTarget) === safeTempRoot && path.basename(safeTarget).startsWith('taller-static-'));
    await rm(safeTarget, { recursive: true, force: true });
  }
});

test('dist no contiene secretos ni configuración de Supabase', async () => {
  await build();
  for (const relative of await list(dist)) {
    if (!/\.(?:html|css|js|mjs|txt)$/i.test(relative)) continue;
    const text = await readFile(path.join(dist, relative), 'utf8');
    assert.doesNotMatch(text, /sb_secret_|sb_publishable_|service_role|META_APP_SECRET|SUPABASE_SERVICE_ROLE_KEY/i, relative);
  }
});