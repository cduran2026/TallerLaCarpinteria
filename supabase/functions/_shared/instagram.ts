import { requireEnv } from './http.ts';
export const INSTAGRAM_SCOPES = ['instagram_business_basic', 'instagram_business_content_publish'];
export const graphBase = () => `https://graph.instagram.com/${requireEnv('META_API_VERSION')}`;
export async function graphRequest(path: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers); headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${graphBase()}${path}`, { ...init, headers }); const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) throw Object.assign(new Error(payload.error?.message || 'Instagram API rechazó la solicitud.'), { status: response.status, metaCode: String(payload.error?.code || response.status), payload });
  return payload;
}
export async function getStoredToken(admin: any, connectionId: string) {
  const { data, error } = await admin.rpc('server_get_social_token', { connection_id: connectionId });
  if (error || !data) throw Object.assign(new Error('La conexión no tiene un token disponible.'), { status: 409 }); return data as string;
}
