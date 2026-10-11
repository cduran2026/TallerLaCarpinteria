import { copyFile, lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// This is the complete publication allowlist. Neither supabase/, tests/, nor
// repository documents can enter dist/ by being added to the repository.
export const PUBLIC_FILES = Object.freeze([
  'index.html', 'styles.css', 'script.js',
  'assets/antes.jpeg', 'assets/despues.jpeg', 'assets/logo.jpg',
  'assets/configurator.js',
  'maestro/index.html', 'maestro/maestro.css',
]);
export const PUBLIC_DIRECTORIES = Object.freeze([
  'assets/brand', 'assets/comparador', 'assets/content-studio',
  'assets/designer', 'assets/fotos-reales', 'assets/galeria',
  'assets/hero', 'assets/nosotros',
  'assets/production', 'assets/vendor', 'maestro/js',
]);
const PUBLIC_EXTENSIONS = new Set(['.html', '.css', '.js', '.mjs', '.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif', '.ico', '.mp4', '.webm']);
const REQUIRED_RUNTIME_FILES = [
  'maestro/js/app.js', 'maestro/js/config.js', 'maestro/js/designer-bridge.js',
  'assets/brand/logo.jpg', 'assets/vendor/three.min.js',
  'assets/vendor/OrbitControls.js', 'assets/content-studio/renderer.js',
  'assets/designer/v2/store.js',
];
const PRIVATE_NAME = /(^\.|\.env(?:\.|$)|(?:^|[._-])(?:secret|private|credential|password)(?:[._-]|$)|\.(?:test|spec)\.[cm]?[jt]s$)/i;
const SECRET_CONTENT = /sb_secret_[A-Za-z0-9_]+|(?:service_role|META_APP_SECRET|SCHEDULER_SECRET)\s*[:=]\s*['"`]?[^\s'"`;]+/i;
const SOURCE_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

async function regularFile(absolutePath) {
  const info = await lstat(absolutePath);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Ruta pública no regular: ${absolutePath}`);
}

async function visit(sourceRoot, relativeDir, selected) {
  for (const entry of await readdir(path.join(sourceRoot, relativeDir), { withFileTypes: true })) {
    const relative = path.posix.join(relativeDir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Enlace simbólico en directorio público: ${relative}`);
    if (entry.isDirectory()) {
      if (PRIVATE_NAME.test(entry.name)) throw new Error(`Directorio privado bajo ruta pública: ${relative}`);
      await visit(sourceRoot, relative, selected);
      continue;
    }
    if (!entry.isFile()) throw new Error(`Entrada no regular bajo ruta pública: ${relative}`);
    // Markdown and source-only files are intentionally not published.
    if (entry.name.toLowerCase().endsWith('.md') || entry.name.toLowerCase().endsWith('.ts')) continue;
    if (PRIVATE_NAME.test(entry.name)) throw new Error(`Archivo privado bajo ruta pública: ${relative}`);
    if (!PUBLIC_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      throw new Error(`Tipo de archivo no aprobado bajo ruta pública: ${relative}`);
    }
    selected.add(relative);
  }
}

export async function collectPublicFiles(sourceRoot) {
  const selected = new Set(PUBLIC_FILES);
  for (const relative of PUBLIC_FILES) await regularFile(path.join(sourceRoot, relative));
  for (const relative of PUBLIC_DIRECTORIES) {
    const info = await lstat(path.join(sourceRoot, relative));
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Directorio público inválido: ${relative}`);
    await visit(sourceRoot, relative, selected);
  }
  for (const relative of REQUIRED_RUNTIME_FILES) {
    if (!selected.has(relative)) throw new Error(`Falta archivo requerido: ${relative}`);
  }
  return [...selected].sort();
}

function publicConfig(source) {
  const url = source.match(/supabaseUrl:\s*['"]([^'"]+)['"]/);
  const key = source.match(/supabasePublishableKey:\s*['"]([^'"]+)['"]/);
  if (!url || !key) throw new Error('No se pudo leer la configuración pública actual de Supabase.');
  const envUrl = process.env.PUBLIC_SUPABASE_URL;
  const envKey = process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (Boolean(envUrl) !== Boolean(envKey)) throw new Error('Configura ambas variables públicas de Supabase juntas.');
  if (process.env.CF_PAGES === '1' && (!envUrl || !envKey)) {
    throw new Error('Cloudflare Pages requiere PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  }
  const selectedUrl = envUrl || url[1];
  const selectedKey = envKey || key[1];
  const parsed = new URL(selectedUrl);
  if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) {
    throw new Error('PUBLIC_SUPABASE_URL debe ser un origen HTTPS sin credenciales.');
  }
  if (process.env.CF_PAGES === '1' && process.env.CF_PAGES_BRANCH && process.env.CF_PAGES_BRANCH !== 'main' && parsed.origin === new URL(url[1]).origin) {
    throw new Error('Un preview no puede utilizar el proyecto Supabase de producción.');
  }
  if (!selectedKey.startsWith('sb_publishable_')) throw new Error('Sólo se admite una clave sb_publishable_.');
  return `// Configuración pública generada al compilar. Nunca incluir credenciales administrativas.\nexport const config = Object.freeze({\n  supabaseUrl: ${JSON.stringify(selectedUrl)},\n  supabasePublishableKey: ${JSON.stringify(selectedKey)},\n});\n`;
}

export async function buildStatic(sourceRoot = SOURCE_ROOT) {
  const root = path.resolve(sourceRoot);
  const output = path.resolve(root, 'dist');
  if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Salida insegura.');
  const files = await collectPublicFiles(root);
  const config = publicConfig(await readFile(path.join(root, 'maestro/js/config.js'), 'utf8'));
  // Inspect before touching dist: a failed build must never leave a copied secret.
  for (const relative of files) {
    if (!/\.(?:html|css|js|mjs)$/i.test(relative)) continue;
    const contents = await readFile(path.join(root, relative), 'utf8');
    if (SECRET_CONTENT.test(contents)) throw new Error(`Posible secreto en archivo público: ${relative}`);
  }
  try {
    const existing = await lstat(output);
    if (existing.isSymbolicLink() || !existing.isDirectory()) throw new Error('dist/ no es un directorio normal.');
    await rm(output, { recursive: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await mkdir(output);
  for (const relative of files) {
    const source = path.join(root, relative);
    await regularFile(source);
    const destination = path.join(output, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }
  await writeFile(path.join(output, 'maestro/js/config.js'), config);
  await writeFile(path.join(output, '_headers'), '/maestro/*\n  X-Robots-Tag: noindex, nofollow\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n');
  console.log(`Build estático: ${files.length} archivos públicos en dist/`);
  return { output, files };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildStatic().catch(error => { console.error(error.message); process.exitCode = 1; });
}
