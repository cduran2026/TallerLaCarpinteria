const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('la tabla pública conserva metadatos y delega tokens a Vault', () => {
  const migration = read('supabase/migrations/005_instagram_integrations.sql');
  const publicTable = migration.split('create table public.social_connections')[1].split(');')[0];
  assert.doesNotMatch(publicTable, /access_token|refresh_token|client_secret/i);
  assert.match(migration, /vault\.create_secret/); assert.match(migration, /vault\.decrypted_secrets/);
  assert.match(migration, /revoke all on public\.social_connections, public\.social_publications from anon, authenticated/);
});
test('RLS aísla metadatos por taller y las mutaciones quedan reservadas al servidor', () => {
  const migration = read('supabase/migrations/005_instagram_integrations.sql');
  assert.match(migration, /private\.is_workshop_member\(workshop_id\)/); assert.match(migration, /grant execute[\s\S]+to service_role/);
  assert.doesNotMatch(migration, /grant (insert|update|delete)[\s\S]+to authenticated/i);
});
test('OAuth usa estado de un solo uso, permisos mínimos y secretos de entorno', () => {
  const start = read('supabase/functions/instagram-auth-start/index.ts'); const callback = read('supabase/functions/instagram-auth-callback/index.ts'); const shared = read('supabase/functions/_shared/instagram.ts');
  assert.match(start, /server_create_instagram_oauth_state/); assert.match(callback, /server_consume_instagram_oauth_state/);
  assert.match(shared, /instagram_business_basic/); assert.match(shared, /instagram_business_content_publish/);
  assert.match(callback, /META_APP_SECRET/); assert.doesNotMatch(callback, /client_secret:\s*['"][^'"]+['"]/);
});
test('solo el callback OAuth desactiva la verificación JWT de plataforma', () => {
  const config = read('supabase/config.toml'); assert.match(config, /\[functions\.instagram-auth-callback\]\s+verify_jwt = false/); assert.equal((config.match(/verify_jwt = false/g) || []).length, 1);
});
test('la Story exige confirmación, admin, conexión y permiso antes de Meta', () => {
  const publish = read('supabase/functions/instagram-publish-story/index.ts');
  assert.match(publish, /if \(!confirmed\)/); assert.match(publish, /requireWorkshopAdmin/); assert.match(publish, /eq\('status', 'connected'\)/);
  assert.match(publish, /instagram_business_content_publish/); assert.match(publish, /media_type: 'STORIES'/); assert.match(publish, /media_publish/); assert.match(publish, /\.remove\(\[tempPath\]\)/);
});
test('el frontend confirma explícitamente y no contiene secretos administrativos', () => {
  const studio = read('maestro/js/marketing/content-studio.js'); const repository = read('maestro/js/repositories/social-connections.js');
  assert.match(studio, /window\.confirm/); assert.match(studio, /Publicar en Instagram/); assert.match(repository, /functions\.invoke/);
  assert.doesNotMatch(studio + repository, /META_APP_SECRET|service_role|sb_secret_/);
});
