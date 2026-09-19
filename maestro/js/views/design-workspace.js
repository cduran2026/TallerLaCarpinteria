import { h, field, button, notice } from '../ui.js';
import { getProject } from '../repositories/projects.js';
import { getDesign, decodeDesign, saveDesign } from '../repositories/designs.js';
import { navigate } from '../router.js';
import { designEditor as legacyDesignEditor } from './design-editor.js';
import { mountClosetV2 } from '../designer-v2/closet-editor.js';

function closetEditorView(workshop, project, projectId, row, envelope) {
  let api, dirty = false, saving = false, unsubscribe, savedId = row?.id;
  const abort = new AbortController();
  const name = field('Nombre del diseño', 'design-name', {
    value: row?.name || '', required: true, placeholder: 'Ej.: Clóset dormitorio', autocomplete: 'off',
  });
  const status = notice();
  status.textContent = 'Preparando Clóset Modular V2…';
  const save = button('Guardar diseño', { type: 'button', disabled: true });
  const productionLink = row ? h('a', { class: 'button button-secondary', href: `#/proyectos/${projectId}/disenos/${row.id}/produccion` }, 'Despiece y corte') : null;
  const host = h('div', { class: 'closet-v2-host' });
  const element = h('section', { class: 'design-workspace-page' },
    h('header', { class: 'design-workspace-header' },
      h('div', {}, h('a', { class: 'back-link', href: `#/proyectos/${projectId}` }, '← Volver al proyecto'),
        h('span', { class: 'project-code' }, project.code),
        h('h1', {}, row ? row.name : 'Nuevo Clóset V2')),
      h('div', { class: 'design-workspace-save' }, productionLink, save, status)),
    h('div', { class: 'design-name-bar' }, name,
      h('span', { class: 'schema-badge' }, 'Esquema técnico V2 · milímetros')),
    host);
  const changed = () => { dirty = true; status.textContent = 'Cambios sin guardar'; status.classList.remove('error'); };
  name.querySelector('input').addEventListener('input', changed);
  save.addEventListener('click', async () => {
    const input = name.querySelector('input');
    if (!input.reportValidity() || !input.value.trim() || !api || saving) return;
    const report = api.getStatus();
    if (!report.isEditable) { status.textContent = 'El documento no es editable y no puede guardarse.'; status.classList.add('error'); return; }
    saving = true; save.disabled = true;
    const state = api.getState(); const savedName = input.value.trim();
    status.textContent = 'Guardando en Supabase…';
    try {
      const saved = await saveDesign(workshop.id, projectId, savedId, savedName, state);
      savedId = saved.id;
      if (abort.signal.aborted) return;
      const unchanged = JSON.stringify(api.getState()) === JSON.stringify(state) && input.value.trim() === savedName;
      dirty = !unchanged;
      const savedReport = api.getStatus();
      status.textContent = !unchanged ? 'Guardado. Hay cambios posteriores sin guardar.'
        : savedReport.canGenerateTechnicalOutputs ? 'Diseño completo guardado en Supabase.'
          : 'Diseño editable guardado. Requiere corregir ocupación antes de generar salidas técnicas.';
      if (!row && unchanged) navigate(`/proyectos/${projectId}/disenos/${saved.id}`);
    } catch (error) {
      if (!abort.signal.aborted) { status.textContent = `No se guardó el diseño: ${error.message}`; status.classList.add('error'); }
    } finally { saving = false; save.disabled = false; }
  });
  return {
    element,
    mount: async () => {
      try {
        api = await mountClosetV2(host, envelope, abort.signal);
        unsubscribe = api.subscribe(changed);
        save.disabled = false;
        const report = api.getStatus();
        status.textContent = row ? 'Clóset V2 recuperado exactamente.'
          : report.canGenerateTechnicalOutputs ? 'Clóset inicial completo. Puedes editarlo y guardarlo.' : 'Configura los cuerpos y guarda el diseño.';
      } catch (error) { if (!abort.signal.aborted) { status.textContent = error.message; status.classList.add('error'); } }
    },
    canLeave: () => !saving && (!dirty || window.confirm('Hay cambios sin guardar. ¿Salir del diseño?')),
    hasUnsaved: () => dirty || saving,
    dispose: () => { abort.abort(); unsubscribe?.(); api?.dispose?.(); },
  };
}

function typeChooser(project, projectId, onChoose) {
  const element = h('section', { class: 'design-type-page' },
    h('a', { class: 'back-link', href: `#/proyectos/${projectId}` }, '← Volver al proyecto'),
    h('header', { class: 'page-heading' },
      h('div', {}, h('span', { class: 'section-kicker' }, project.code), h('h1', {}, 'Nuevo diseño'),
        h('p', {}, 'Selecciona el tipo técnico. Cada diseño se guarda de manera independiente.'))),
    h('div', { class: 'design-type-grid' },
      h('button', { class: 'design-type-choice', type: 'button', onclick: () => onChoose('closet') },
        h('span', { class: 'design-choice-mark' }, 'CL'),
        h('div', {}, h('strong', {}, 'Clóset Modular V2'),
          h('p', {}, 'Diseña cuerpos, componentes, cantidades y ocupación técnica.'),
          h('small', {}, 'Nuevo núcleo modular')),
        h('b', { 'aria-hidden': 'true' }, '→')),
      h('button', { class: 'design-type-choice', type: 'button', onclick: () => onChoose('kitchen') },
        h('span', { class: 'design-choice-mark kitchen' }, 'C'),
        h('div', {}, h('strong', {}, 'Cocina'),
          h('p', {}, 'Continúa usando el configurador actual de Cocina.'),
          h('small', {}, 'Editor V1 operativo')),
        h('b', { 'aria-hidden': 'true' }, '→'))));
  return { element };
}

export async function designWorkspace(workshop, projectId, designId) {
  if (designId !== 'nuevo') {
    const row = await getDesign(workshop.id, projectId, designId);
    if (row.schema_version === 1) return legacyDesignEditor(workshop, projectId, designId);
    const project = await getProject(workshop.id, projectId);
    return closetEditorView(workshop, project, projectId, row, decodeDesign(row));
  }

  const project = await getProject(workshop.id, projectId);
  let currentView;
  const root = h('div');
  const activate = async type => {
    currentView?.dispose?.();
    currentView = type === 'closet'
      ? closetEditorView(workshop, project, projectId, null, null)
      : await legacyDesignEditor(workshop, projectId, 'nuevo', { lockType: 'kitchen' });
    root.replaceChildren(currentView.element);
    await currentView.mount?.();
  };
  const chooser = typeChooser(project, projectId, activate);
  root.append(chooser.element);
  return {
    element: root,
    canLeave: () => currentView?.canLeave?.() ?? true,
    hasUnsaved: () => currentView?.hasUnsaved?.() ?? false,
    dispose: () => currentView?.dispose?.(),
  };
}
