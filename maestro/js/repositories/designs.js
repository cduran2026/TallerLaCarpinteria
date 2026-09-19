import { getClient } from '../supabase-client.js';
export async function listDesigns(workshopId, projectId) {
  let query = (await getClient()).from('designs').select('id,project_id,name,type,position,schema_version,generator_version,updated_at').eq('workshop_id', workshopId);
  if (projectId) query = query.eq('project_id', projectId);
  const { data, error } = await query.order('position').order('created_at');
  if (error) throw error;
  return data;
}
export async function getDesign(workshopId, projectId, id) {
  const { data, error } = await (await getClient()).from('designs').select('*').eq('workshop_id', workshopId).eq('project_id', projectId).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Diseño no encontrado o no disponible en este taller.');
  return data;
}
export function decodeDesign(row) {
  if (row.schema_version === 2) return {
    schemaVersion: row.schema_version,
    generatorVersion: row.generator_version,
    configuration: structuredClone(row.configuration),
  };
  const state = window.TALLER_SERIALIZATION.deserialize(JSON.stringify({ schemaVersion: row.schema_version,
    generatorVersion: row.generator_version, configuration: row.configuration }));
  if (state.type !== row.type) throw new Error('El tipo del diseño no coincide con su configuración guardada.');
  return state;
}
export function encodeDesign(state) {
  return state?.schemaVersion === 2
    ? structuredClone(state)
    : JSON.parse(window.TALLER_SERIALIZATION.serialize(state));
}
export async function saveDesign(workshopId, projectId, id, name, state) {
  const saved = encodeDesign(state);
  const type = state.schemaVersion === 2 ? state.configuration?.type : state.type;
  if (!['kitchen', 'closet'].includes(type)) throw new Error('El diseño no declara un tipo técnico compatible.');
  const payload = { name, type, configuration: saved.configuration,
    schema_version: saved.schemaVersion, generator_version: saved.generatorVersion };
  const db = await getClient();
  const query = id ? db.from('designs').update(payload).eq('workshop_id', workshopId).eq('project_id', projectId).eq('id', id)
    : db.from('designs').insert({ ...payload, workshop_id: workshopId, project_id: projectId });
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}
