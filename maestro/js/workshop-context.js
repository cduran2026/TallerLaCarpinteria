import { listWorkshops } from './repositories/workshops.js';
let active = null;
let workshops = [];
export async function loadWorkshops() {
  workshops = await listWorkshops();
  active = workshops.find(w => w.id === active?.id) || workshops[0] || null;
  return workshops;
}
export function currentWorkshop() { return active; }
export function selectWorkshop(id) {
  const next = workshops.find(w => w.id === id);
  if (!next) throw new Error('Taller no disponible.');
  active = next;
}
export function clearWorkshop() { active = null; workshops = []; }
