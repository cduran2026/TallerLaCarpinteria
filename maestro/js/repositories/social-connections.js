import { getClient } from '../supabase-client.js';

export async function getMembershipRole(workshopId) {
  const client = await getClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth?.user) throw new Error('La sesión ha expirado. Vuelve a ingresar.');
  const { data, error } = await client.from('workshop_members').select('role').eq('workshop_id', workshopId).eq('user_id', auth.user.id).maybeSingle();
  if (error) throw error; return data?.role || null;
}
const missingTable = error => ['42P01', 'PGRST205'].includes(error?.code);
const expiredSession = error => error?.status === 401 || error?.code === 'PGRST301';
function instagramFailure(error, label) {
  const kind = missingTable(error) ? 'unavailable' : expiredSession(error) ? 'auth_required' : 'error';
  console[kind === 'error' ? 'error' : 'warn'](`[Instagram] ${label}: ${kind}`, { code: error?.code, status: error?.status, message: error?.message });
  return { kind, connection: null };
}
export async function loadInstagramCapability(workshopId) {
  try {
    // An array avoids a singular-response error if inconsistent data ever contains two connections.
    const { data, error } = await (await getClient()).from('social_connections').select('*').eq('workshop_id', workshopId).eq('provider', 'instagram').limit(2);
    if (error) return instagramFailure(error, 'Consulta de conexión');
    const connection = data?.[0] || null;
    if (!Array.isArray(data) || data.length > 1 || (connection && (
      !connection.id || connection.provider !== 'instagram' ||
      !['connecting', 'connected', 'token_expired', 'error', 'disconnected'].includes(connection.status) ||
      !Array.isArray(connection.permissions) ||
      (connection.status === 'connected' && (!connection.username || !connection.external_account_id))
    ))) {
      console.error('[Instagram] La conexión contiene datos inconsistentes.');
      return { kind: 'invalid', connection: null };
    }
    return { kind: 'available', connection };
  } catch (error) { return instagramFailure(error, 'Consulta de conexión'); }
}
export async function listInstagramPublications(workshopId) {
  const { data, error } = await (await getClient()).from('social_publications').select('*').eq('workshop_id', workshopId).eq('provider', 'instagram').order('created_at', { ascending: false }).limit(8);
  if (error && missingTable(error)) {
    console.warn('[Instagram] Historial no disponible.', { code: error.code, status: error.status });
    return [];
  }
  if (error) throw error; return data;
}
async function invoke(name, body) {
  const { data, error } = await (await getClient()).functions.invoke(name, { body });
  if (error) throw new Error(data?.error || error.message || 'La función segura no está disponible.');
  if (data?.error) throw new Error(data.error); return data;
}
export const startInstagramConnection = workshopId => invoke('instagram-auth-start', { workshopId });
export const testInstagramConnection = workshopId => invoke('instagram-connection', { workshopId, action: 'test' });
export const disconnectInstagram = workshopId => invoke('instagram-connection', { workshopId, action: 'disconnect' });
export const publishInstagramStory = (workshopId, imageDataUrl) => invoke('instagram-publish-story', { workshopId, imageDataUrl, confirmed: true });
