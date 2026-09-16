import { h, field, button, notice, link } from '../ui.js';
import { getProject } from '../repositories/projects.js';
import { getDesign, decodeDesign, saveDesign } from '../repositories/designs.js';
import { mountDesigner } from '../designer-bridge.js';
import { navigate } from '../router.js';
export async function designEditor(workshop, projectId, designId) {
  const project = await getProject(workshop.id, projectId);
  const row = designId === 'nuevo' ? null : await getDesign(workshop.id, projectId, designId);
  const configuration = row ? decodeDesign(row) : null;
  let api, dirty = false, saving = false, unsubscribe, savedId = row?.id;
  const abort = new AbortController();
  const name = field('Nombre del diseño', 'design-name', { value: row?.name || '', required: true, placeholder: 'Ej.: Cocina principal' });
  const status = notice();
  status.textContent = 'Cargando diseñador…';
  const save = button('Guardar diseño', { type: 'button', disabled: true });
  const frame = h('iframe', { title: 'Diseñador 3D de Cocina y Clóset', class: 'designer-frame' });
  const element = h('section', {}, h('span', { class: 'eyebrow' }, project.code), h('h1', {}, row ? row.name : 'Nuevo diseño'),
    link('Volver al proyecto', `#/proyectos/${projectId}`), name, h('div', { class: 'editor-toolbar' }, save, status), frame);
  const changed = () => { dirty = true; status.textContent = 'Cambios sin guardar'; };
  name.querySelector('input').addEventListener('input', changed);
  save.addEventListener('click', async () => {
    const input = name.querySelector('input');
    if (!input.reportValidity() || !input.value.trim() || !api || saving) return;
    saving = true; save.disabled = true;
    const state = api.getState(); const savedName = input.value.trim();
    status.textContent = 'Guardando en Supabase…';
    try {
      const saved = await saveDesign(workshop.id, projectId, savedId, savedName, state);
      savedId = saved.id;
      if (abort.signal.aborted) return;
      const unchanged = JSON.stringify(api.getState()) === JSON.stringify(state) && input.value.trim() === savedName;
      dirty = !unchanged;
      status.textContent = unchanged ? 'Diseño guardado en Supabase.' : 'Guardado. Hay cambios posteriores sin guardar.';
      if (!row && unchanged) navigate(`/proyectos/${projectId}/disenos/${saved.id}`);

    } catch (error) { if (!abort.signal.aborted) status.textContent = `No se guardó el diseño: ${error.message}`; }
    finally { saving = false; save.disabled = false; }
  });
  // Mount only after app.js has attached the view to the DOM.
  return { element,
    mount: async () => {
      try {
        api = await mountDesigner(frame, configuration, abort.signal);
        unsubscribe = api.subscribe(changed);
        save.disabled = false;
        status.textContent = row ? 'Diseño recuperado.' : 'Configura Cocina o Clóset y guarda el diseño.';
      } catch (error) { if (!abort.signal.aborted) status.textContent = error.message; }
    },
    canLeave: () => !saving && (!dirty || window.confirm('Hay cambios sin guardar. ¿Salir del diseño?')),
    hasUnsaved: () => dirty || saving,
    dispose: () => { abort.abort(); unsubscribe?.(); frame.remove(); },
  };
}
