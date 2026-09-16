import { getClient } from '../supabase-client.js';
export async function listWorkshops() {
  const { data, error } = await (await getClient()).from('workshops').select('id,name').order('name');
  if (error) throw error;
  return data;
}
