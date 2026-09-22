import { getClient } from '../supabase-client.js';

export async function getMembershipRole(workshopId) {
  const { data, error } = await (await getClient()).from('workshop_members').select('role').eq('workshop_id', workshopId).maybeSingle();
  if (error) throw error; return data?.role || null;
}
export async function getInstagramConnection(workshopId) {
  const { data, error } = await (await getClient()).from('social_connections').select('*').eq('workshop_id', workshopId).eq('provider', 'instagram').maybeSingle();
  if (error && ['42P01', 'PGRST205'].includes(error.code)) return null;
  if (error) throw error; return data;
}
export async function listInstagramPublications(workshopId) {
  const { data, error } = await (await getClient()).from('social_publications').select('*').eq('workshop_id', workshopId).eq('provider', 'instagram').order('created_at', { ascending: false }).limit(8);
  if (error && ['42P01', 'PGRST205'].includes(error.code)) return [];
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
