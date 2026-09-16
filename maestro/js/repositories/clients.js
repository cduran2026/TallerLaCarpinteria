import { getClient } from '../supabase-client.js';
export async function listClients(workshopId) {
  const { data, error } = await (await getClient()).from('clients').select('*').eq('workshop_id', workshopId).order('name');
  if (error) throw error;
  return data;
}
export async function createClient(workshopId, input) {
  const { name, phone, email, commune, address } = input;
  const { data, error } = await (await getClient()).from('clients').insert({ workshop_id: workshopId, name, phone, email, commune, address }).select().single();
  if (error) throw error;
  return data;
}
