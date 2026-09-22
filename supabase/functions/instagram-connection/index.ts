import { allowedOrigin, json, options } from '../_shared/http.ts';
import { requireWorkshopAdmin } from '../_shared/security.ts';
import { getStoredToken, graphRequest } from '../_shared/instagram.ts';
Deno.serve(async request => {
  const origin = allowedOrigin(request); if (request.method === 'OPTIONS') return options(origin);
  try {
    const { workshopId, action } = await request.json(); if (!workshopId || !['test', 'disconnect'].includes(action)) return json({ error: 'Operación inválida.' }, 400, origin);
    const { admin } = await requireWorkshopAdmin(request, workshopId); const { data: connection, error } = await admin.from('social_connections').select('*').eq('workshop_id', workshopId).eq('provider', 'instagram').maybeSingle();
    if (error || !connection) return json({ error: 'Instagram no está conectado.' }, 404, origin);
    if (action === 'disconnect') {
      const token = await getStoredToken(admin, connection.id); let providerRevoked = true;
      try { await graphRequest('/me/permissions', token, { method: 'DELETE' }); } catch { providerRevoked = false; }
      await admin.rpc('server_delete_social_token', { connection_id: connection.id }); await admin.from('social_connections').update({ status: 'disconnected', token_expires_at: null }).eq('id', connection.id);
      return json({ status: 'disconnected', providerRevoked }, 200, origin);
    }
    const token = await getStoredToken(admin, connection.id);
    try {
      const profile = await graphRequest('/me?fields=user_id,username,account_type', token); await admin.from('social_connections').update({ status: 'connected', username: profile.username, account_type: profile.account_type, metadata: { ...connection.metadata, last_tested_at: new Date().toISOString() } }).eq('id', connection.id); return json({ status: 'connected', account: profile }, 200, origin);
    } catch (testError) { const failure = testError as any; const status = failure.metaCode === '190' || failure.status === 401 ? 'token_expired' : 'error'; await admin.from('social_connections').update({ status, metadata: { ...connection.metadata, last_error: failure.message } }).eq('id', connection.id); throw Object.assign(failure, { status: failure.status || 502 }); }
  } catch (error) { const failure = error as any; return json({ error: failure.message || 'No fue posible verificar Instagram.' }, failure.status || 500, origin); }
});
