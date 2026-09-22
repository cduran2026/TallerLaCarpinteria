import { allowedOrigin, json, options, requireEnv } from '../_shared/http.ts';
import { requireWorkshopAdmin, sha256 } from '../_shared/security.ts';
import { INSTAGRAM_SCOPES } from '../_shared/instagram.ts';
Deno.serve(async request => {
  const origin = allowedOrigin(request); if (request.method === 'OPTIONS') return options(origin);
  try {
    const { workshopId } = await request.json(); if (!workshopId) return json({ error: 'workshopId es obligatorio.' }, 400, origin);
    const { user, admin } = await requireWorkshopAdmin(request, workshopId); const state = crypto.randomUUID() + crypto.randomUUID();
    const { error } = await admin.rpc('server_create_instagram_oauth_state', { state_hash: await sha256(state), workshop_id: workshopId, user_id: user.id, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });
    if (error) throw error;
    const { error: connectionError } = await admin.from('social_connections').upsert({ workshop_id: workshopId, provider: 'instagram', status: 'connecting', created_by: user.id }, { onConflict: 'workshop_id,provider' });
    if (connectionError) throw connectionError;
    const authorize = new URL('https://www.instagram.com/oauth/authorize'); authorize.search = new URLSearchParams({ enable_fb_login: '0', force_authentication: '1', client_id: requireEnv('META_APP_ID'), redirect_uri: requireEnv('META_REDIRECT_URI'), response_type: 'code', scope: INSTAGRAM_SCOPES.join(','), state }).toString();
    return json({ authorizationUrl: authorize.toString() }, 200, origin);
  } catch (error) { const failure = error as any; return json({ error: failure.message || 'No fue posible iniciar la conexión.' }, failure.status || 500, origin); }
});
