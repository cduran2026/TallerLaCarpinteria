import { getClient } from '../supabase-client.js';
export async function listProjects(workshopId) {
  const { data, error } = await (await getClient()).from('projects').select('*').eq('workshop_id', workshopId).order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}
export async function getProject(workshopId, id) {
  const { data, error } = await (await getClient()).from('projects').select('*').eq('workshop_id', workshopId).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Proyecto no encontrado o no disponible en este taller.');
  return data;
}
export async function createProject(workshopId, input) {
  const { client_id, name, site_commune, site_address, project_date, observations } = input;
  const { data, error } = await (await getClient()).from('projects').insert({ workshop_id: workshopId, client_id, name, site_commune, site_address, project_date, observations }).select().single();
  if (error) throw error;
  return data;
}
export async function setStatus(workshopId, id, status) {
  const { error } = await (await getClient()).from('projects').update({ status }).eq('workshop_id', workshopId).eq('id', id).select('id').single();
  if (error) throw error;
}
