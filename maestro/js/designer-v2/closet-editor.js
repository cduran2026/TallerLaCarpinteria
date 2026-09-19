import { h } from '../ui.js';
import { createClosetViewer } from './closet-viewer.js';

const COMPONENTS = [
  { type: 'shelfSet', label: 'Repisas', description: 'Distribución vertical del cuerpo' },
  { type: 'drawerStack', label: 'Cajonera', description: 'Cajones con correderas' },
  { type: 'rodSet', label: 'Barras', description: 'Barras para colgar ropa' },
  { type: 'doorSet', label: 'Puertas abatibles', description: 'Frentes con bisagras' },
];

function uid(kind) {
  return kind + '-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
}

function quantity(mode, recommended, applied) {
  return { mode, recommended, applied, resolved: mode === 'automatic' ? recommended : applied };
}

function shelfRecommendation(module, standards) {
  const closet = standards.snapshot.closet;
  const usable = module.dimensions.heightMm - closet.shelfTopClearanceMm - closet.shelfBottomClearanceMm;
  return Math.max(0, Math.round(usable / closet.targetShelfSpacingMm) - 1);
}

function componentTemplate(type, module, standards) {
  const closet = standards.snapshot.closet;
  let recommended = 1; let applied = 1; const options = {};
  if (type === 'shelfSet') {
    recommended = shelfRecommendation(module, standards); applied = recommended;
    options.distribution = 'equal'; options.targetSpacingMm = closet.targetShelfSpacingMm;
  } else if (type === 'drawerStack') {
    recommended = closet.defaultDrawerCount; applied = recommended;
  } else if (type === 'rodSet') {
    options.heightMm = closet.defaultRodHeightMm;
  } else if (type === 'doorSet') {
    recommended = Math.max(1, Math.ceil(module.dimensions.widthMm / closet.maxDoorLeafWidthMm));
    applied = recommended; options.opening = 'swing';
  }
  return { id: uid('component'), type, quantity: quantity('automatic', recommended, applied), options };
}

function statusLabel(status) {
  return status === 'exact' ? 'Ocupación exacta' : status === 'deficit' ? 'Déficit disponible' : 'Exceso de módulos';
}

function moduleTypeLabel(type) {
  return ({ hanging: 'Barra y repisa', shelves: 'Repisas', drawers: 'Cajonera', mixed: 'Mixto', open: 'Abierto' })[type.replace('closet.', '')] || 'Cuerpo';
}

export async function mountClosetV2(container, initialEnvelope, signal) {
  const storeApi = window.TALLER_DESIGNER_V2_STORE;
  const fixtures = window.TALLER_DESIGNER_V2_FIXTURES;
  const distribution = window.TALLER_DESIGNER_V2_CLOSET_DISTRIBUTION;
  if (!storeApi || !fixtures || !distribution) throw new Error('El núcleo del Diseñador V2 no está disponible.');
  const store = storeApi.createDesignStore(initialEnvelope || fixtures.createClosetThreeBodies());
  const subscribers = new Set();
  let selectedId = store.getState().configuration.modules[0]?.id;
  let viewer;

  const structureList = h('div', { class: 'closet-module-list' });
  const occupancy = h('div', { class: 'closet-occupancy' });
  const statusFlags = h('div', { class: 'closet-status-flags' });
  const inspectorBody = h('div', { class: 'closet-inspector-body' });
  const message = h('p', { class: 'closet-editor-message', role: 'status' });
  const viewerStage = h('div', { class: 'closet-viewer-stage' }, h('p', { class: 'closet-viewer-loading' }, 'Preparando visor 3D…'));
  const addBody = h('button', { class: 'button button-secondary', type: 'button' }, '+ Agregar cuerpo');
  const autoDistribute = h('button', { class: 'button button-quiet', type: 'button' }, 'Distribución automática');
  const views = ['perspective', 'front', 'top'].map((view, index) => h('button', {
    class: 'viewer-view-button' + (index === 0 ? ' active' : ''), type: 'button', 'data-view': view,
    onclick: event => {
      views.forEach(button => button.classList.remove('active')); event.currentTarget.classList.add('active'); viewer?.setView(view);
    },
  }, view === 'perspective' ? 'Perspectiva' : view === 'front' ? 'Frontal' : 'Superior'));

  const element = h('div', { class: 'closet-v2-editor' },
    h('aside', { class: 'closet-zone closet-structure' },
      h('header', { class: 'closet-zone-heading' }, h('span', {}, 'Estructura'), h('strong', {}, 'Cuerpos del clóset')),
      occupancy, statusFlags, structureList,
      h('footer', { class: 'closet-structure-footer' }, autoDistribute, addBody)),
    h('section', { class: 'closet-zone closet-viewer' },
      h('header', { class: 'closet-viewer-toolbar' },
        h('div', {}, h('span', {}, 'Visor 3D'), h('small', {}, 'Selecciona un cuerpo para editarlo')),
        h('div', { class: 'viewer-view-switch' }, views)),
      viewerStage, message),
    h('aside', { class: 'closet-zone closet-inspector' },
      h('header', { class: 'closet-zone-heading' }, h('span', {}, 'Inspector'), h('strong', {}, 'Configuración del cuerpo')),
      inspectorBody));
  container.replaceChildren(element);

  function perform(action) {
    message.textContent = '';
    try { action(); }
    catch (error) { message.textContent = error.message; message.classList.add('error'); }
  }

  function moduleForSelection(state) {
    return state.configuration.modules.find(module => module.id === selectedId) || state.configuration.modules[0];
  }

  function renderStructure(state) {
    const modules = state.configuration.modules.slice().sort((a, b) => a.order - b.order);
    structureList.replaceChildren(...modules.map((module, index) => h('article', {
      class: 'closet-module-item' + (module.id === selectedId ? ' selected' : ''),
      onclick: () => { selectedId = module.id; renderAll(store.getState()); },
    },
      h('button', { class: 'closet-module-select', type: 'button', 'aria-pressed': String(module.id === selectedId) },
        h('span', { class: 'closet-module-number' }, String(index + 1).padStart(2, '0')),
        h('span', {}, h('strong', {}, 'Cuerpo ' + (index + 1)), h('small', {}, module.dimensions.widthMm + ' mm'))),
      h('div', { class: 'closet-module-quick-actions' },
        h('button', { type: 'button', disabled: index === 0, title: 'Mover a la izquierda', onclick: event => {
          event.stopPropagation(); perform(() => store.moveModule(module.id, { index: index - 1 }));
        } }, '←'),
        h('button', { type: 'button', disabled: index === modules.length - 1, title: 'Mover a la derecha', onclick: event => {
          event.stopPropagation(); perform(() => store.moveModule(module.id, { index: index + 1 }));
        } }, '→')))));
  }

  function updateQuantity(module, component, changes) {
    const current = component.quantity;
    const next = { ...current, ...changes };
    next.resolved = next.mode === 'automatic' ? next.recommended : next.applied;
    store.updateComponent(module.id, component.id, { quantity: next });
  }

  function componentControl(module, definition, standards) {
    const component = module.components.find(item => item.type === definition.type);
    const enabled = Boolean(component);
    const toggle = h('input', { type: 'checkbox', checked: enabled, 'aria-label': 'Activar ' + definition.label });
    toggle.addEventListener('change', () => perform(() => {
      if (toggle.checked) store.addComponent(module.id, componentTemplate(definition.type, module, standards));
      else if (component) store.removeComponent(module.id, component.id);
    }));
    const section = h('section', { class: 'component-control' },
      h('header', {}, h('div', {}, h('strong', {}, definition.label), h('small', {}, definition.description)), h('label', { class: 'switch-control' }, toggle, h('span', {}))));
    if (!component) return section;
    const mode = h('select', { 'aria-label': 'Modo de ' + definition.label },
      h('option', { value: 'automatic' }, 'Automático'), h('option', { value: 'manual' }, 'Manual'));
    mode.value = component.quantity.mode;
    const minimum = definition.type === 'drawerStack' ? standards.snapshot.closet.minDrawerCount : 1;
    const maximum = definition.type === 'drawerStack' ? standards.snapshot.closet.maxDrawerCount : definition.type === 'doorSet' ? 4 : 12;
    const amount = h('input', { type: 'number', min: minimum, max: maximum, step: 1,
      value: component.quantity.applied, disabled: component.quantity.mode === 'automatic', 'aria-label': 'Cantidad de ' + definition.label });
    mode.addEventListener('change', () => perform(() => updateQuantity(module, component, { mode: mode.value })));
    amount.addEventListener('change', () => perform(() => updateQuantity(module, component, { applied: Math.max(minimum, Math.min(maximum, Number(amount.value) || minimum)) })));
    section.append(h('div', { class: 'component-quantity-grid' },
      h('label', {}, h('span', {}, 'Modo'), mode),
      h('label', {}, h('span', {}, 'Cantidad'), amount)),
      h('div', { class: 'quantity-resolution' },
        h('span', {}, 'Recomendado ', h('strong', {}, component.quantity.recommended)),
        h('span', {}, 'Aplicado ', h('strong', {}, component.quantity.applied)),
        h('span', {}, 'Resuelto ', h('strong', {}, component.quantity.resolved))));
    return section;
  }

  function renderInspector(state) {
    const module = moduleForSelection(state);
    if (!module) {
      inspectorBody.replaceChildren(h('div', { class: 'closet-inspector-empty' }, 'Agrega un cuerpo para comenzar.'));
      return;
    }
    selectedId = module.id;
    const modules = state.configuration.modules.slice().sort((a, b) => a.order - b.order);
    const index = modules.findIndex(item => item.id === module.id);
    const width = h('input', { type: 'number', min: state.configuration.standards.snapshot.closet.minBodyWidthMm,
      max: state.configuration.standards.snapshot.closet.maxBodyWidthMm, step: 10, value: module.dimensions.widthMm,
      disabled: module.locks.width, 'aria-label': 'Ancho del cuerpo en milímetros' });
    width.addEventListener('change', () => perform(() => store.changeModuleWidth(module.id, Math.round(Number(width.value)))));
    const lock = h('input', { type: 'checkbox', checked: module.locks.width });
    lock.addEventListener('change', () => perform(() => store.setModuleWidthLocked(module.id, lock.checked)));
    const duplicate = h('button', { class: 'button button-secondary', type: 'button', onclick: () => perform(() => {
      const id = store.duplicateModule(module.id); selectedId = id; renderAll(store.getState());
    }) }, 'Duplicar');
    const remove = h('button', { class: 'button button-danger-quiet', type: 'button', disabled: modules.length === 1,
      onclick: () => perform(() => { store.removeModule(module.id); selectedId = store.getState().configuration.modules[0]?.id; }) }, 'Eliminar');
    inspectorBody.replaceChildren(
      h('section', { class: 'inspector-module-summary' },
        h('span', { class: 'closet-module-number' }, String(index + 1).padStart(2, '0')),
        h('div', {}, h('strong', {}, 'Cuerpo ' + (index + 1)), h('small', {}, moduleTypeLabel(module.type)))),
      h('section', { class: 'inspector-dimensions' },
        h('h3', {}, 'Dimensiones'),
        h('label', { class: 'field' }, 'Ancho (mm)', width),
        h('label', { class: 'lock-control' }, lock, h('span', {}, 'Bloquear ancho'))),
      h('section', { class: 'inspector-components' }, h('h3', {}, 'Componentes'),
        COMPONENTS.map(definition => componentControl(module, definition, state.configuration.standards))),
      h('footer', { class: 'inspector-actions' }, duplicate, remove));
  }

  function renderStatus(state) {
    const report = store.getStatus(); const row = report.occupancy[0];
    const percentage = row.availableMm ? Math.min(100, Math.round(row.occupiedMm / row.availableMm * 100)) : 0;
    occupancy.replaceChildren(
      h('div', { class: 'occupancy-heading' },
        h('span', {}, statusLabel(row.status)), h('strong', {}, row.occupiedMm + ' / ' + row.availableMm + ' mm')),
      h('div', { class: 'occupancy-track', 'data-status': row.status }, h('span', { style: 'width:' + percentage + '%' })),
      h('small', {}, row.status === 'exact' ? 'El ancho está completamente distribuido.' :
        row.status === 'deficit' ? 'Quedan ' + row.deltaMm + ' mm por distribuir.' : 'Exceso de ' + Math.abs(row.deltaMm) + ' mm.'));
    statusFlags.replaceChildren(
      h('span', { 'data-ok': String(report.isEditable) }, 'Editable'),
      h('span', { 'data-ok': String(report.isValid) }, 'Válido'),
      h('span', { 'data-ok': String(report.isComplete) }, 'Completo'),
      h('span', { 'data-ok': String(report.canGenerateTechnicalOutputs) }, 'Salida técnica'));
  }

  function renderAll(state) {
    renderStatus(state); renderStructure(state); renderInspector(state); viewer?.setState(state, selectedId);
  }

  addBody.addEventListener('click', () => perform(() => {
    const state = store.getState(); const standards = state.configuration.standards.snapshot;
    const id = uid('module');
    store.addModule({ id, runId: state.configuration.layout.runs[0].id, zone: 'body', order: state.configuration.modules.length,
      type: 'closet.open', dimensions: { widthMm: standards.closet.targetBodyWidthMm,
        heightMm: state.configuration.dimensions.heightMm, depthMm: state.configuration.dimensions.depthMm },
      components: [], options: {}, locks: { width: false } });
    selectedId = id; renderAll(store.getState());
  }));

  autoDistribute.addEventListener('click', () => perform(() => {
    const state = store.getState();
    const run = state.configuration.layout.runs[0];
    const zone = run.zones.find(item => item.id === 'body');
    const currentCount = state.configuration.modules.filter(item => item.runId === run.id && item.zone === 'body').length;
    const plan = distribution.planClosetWidths(
      run.lengthMm - zone.startReserveMm - zone.endReserveMm,
      state.configuration.standards.snapshot.closet,
      { preferredCount: currentCount }
    );
    if (!plan.isFeasible) throw new Error(plan.reason);
    const ids = store.autoDistributeCloset(plan.widths, { runId: run.id, zone: 'body' });
    if (!ids.includes(selectedId)) selectedId = ids[0];
    message.textContent = `Distribución automática aplicada: ${plan.widths.join(' + ')} mm.`;
  }));

  const unsubscribeStore = store.subscribe((state, metadata) => {
    const available = state.configuration.modules.some(module => module.id === selectedId);
    if (!available) selectedId = state.configuration.modules[0]?.id;
    renderAll(state);
    subscribers.forEach(callback => callback(state, metadata));
  });
  renderAll(store.getState());
  try {
    viewerStage.replaceChildren();
    viewer = await createClosetViewer(viewerStage, id => { selectedId = id; renderAll(store.getState()); });
    viewer.setState(store.getState(), selectedId);
  } catch (error) {
    viewerStage.replaceChildren(h('div', { class: 'closet-viewer-fallback' },
      h('strong', {}, 'Visor 3D no disponible'), h('p', {}, 'Puedes continuar editando y guardar el diseño.')));
    message.textContent = error.message;
  }
  if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
  signal?.addEventListener('abort', () => viewer?.dispose(), { once: true });

  return {
    element,
    getState: () => store.getState(),
    getStatus: () => store.getStatus(),
    subscribe(callback) { subscribers.add(callback); return () => subscribers.delete(callback); },
    dispose() { unsubscribeStore(); viewer?.dispose(); subscribers.clear(); },
  };
}
