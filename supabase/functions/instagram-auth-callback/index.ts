import { adminClient, sha256 } from '../_shared/security.ts';
import { INSTAGRAM_SCOPES, graphRequest } from '../_shared/instagram.ts';
import { requireEnv } from '../_shared/http.ts';
import { instagramReturnUrl } from '../_shared/redirect.ts';
function finish(status: string, detail = '') { return Response.redirect(instagramReturnUrl(requireEnv('APP_URL'), requireEnv('APP_ALLOWED_ORIGINS'), status, detail), 302); }
Deno.serve(async request => {
  try { instagramReturnUrl(requireEnv('APP_URL'), requireEnv('APP_ALLOWED_ORIGINS'), 'error'); }
  catch { return new Response('La URL de retorno OAuth no está configurada correctamente.', { status: 500 }); }
  const url = new URL(request.url); const code = url.searchParams.get('code'); const state = url.searchParams.get('state');
  if (url.searchParams.get('error')) return finish('error', url.searchParams.get('error_description') || 'Autorización cancelada.');
  if (!code || !state) return finish('error', 'Respuesta OAuth incompleta.');
  const admin = adminClient(); let context: any = null;
  try {
    const { data: states, error: stateError } = await admin.rpc('server_consume_instagram_oauth_state', { state_hash: await sha256(state) }); context = states?.[0];
    if (stateError || !context) return finish('error', 'La autorización expiró o ya fue utilizada.');
    const body = new URLSearchParams({ client_id: requireEnv('META_APP_ID'), client_secret: requireEnv('META_APP_SECRET'), grant_type: 'authorization_code', redirect_uri: requireEnv('META_REDIRECT_URI'), code });
    const shortResponse = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }); const short = await shortResponse.json();
    if (!shortResponse.ok || !short.access_token) throw new Error(short.error_message || 'Meta no entregó un token de acceso.');
    const exchange = new URL('https://graph.instagram.com/access_token'); exchange.search = new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: requireEnv('META_APP_SECRET'), access_token: short.access_token }).toString();
    const longResponse = await fetch(exchange); const long = await longResponse.json(); if (!longResponse.ok || !long.access_token) throw new Error(long.error?.message || 'No fue posible obtener el token de larga duración.');
    const profile = await graphRequest('/me?fields=user_id,username,account_type,profile_picture_url', long.access_token); if (profile.account_type !== 'BUSINESS') throw new Error('Esta fase requiere una cuenta Instagram Business.');
    const { data: connection, error: upsertError } = await admin.from('social_connections').upsert({ workshop_id: context.workshop_id, provider: 'instagram', external_account_id: String(profile.user_id || profile.id), username: profile.username, account_type: profile.account_type, status: 'connected', connected_at: new Date().toISOString(), token_expires_at: new Date(Date.now() + Number(long.expires_in || 5184000) * 1000).toISOString(), permissions: short.permissions || INSTAGRAM_SCOPES, metadata: { profile_picture_url: profile.profile_picture_url || null, associated_page: null, oauth_flow: 'instagram_login' }, created_by: context.user_id }, { onConflict: 'workshop_id,provider' }).select('id').single();
    if (upsertError) throw upsertError; const { error: tokenError } = await admin.rpc('server_store_social_token', { connection_id: connection.id, access_token: long.access_token }); if (tokenError) throw tokenError;
    return finish('connected');
  } catch (error) {
    const failure = error as any;
    if (context?.workshop_id) await admin.from('social_connections').update({ status: 'error', metadata: { last_error: failure.message } }).eq('workshop_id', context.workshop_id).eq('provider', 'instagram');
    return finish('error', failure.message || 'No fue posible completar la conexión.');
  }
});
