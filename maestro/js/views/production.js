import { h, emptyState, typeLabel, timeAgo } from '../ui.js';
import { listProjects, getProject } from '../repositories/projects.js';
import { listDesigns, getDesign, decodeDesign } from '../repositories/designs.js';
import { cutPlanCard } from '../production/cut-plan-view.js';

function formatArea(areaMm2) { return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(areaMm2 / 1000000) + ' m²'; }
function edgeSummary(edgeBanding) {
  const labels = { top: 'Sup.', bottom: 'Inf.', left: 'Izq.', right: 'Der.' };
  const active = Object.entries(edgeBanding).filter(([, value]) => value).map(([side]) => labels[side]);
  return active.length ? active.join(' · ') : 'Sin tapacanto';
}
function moduleName(configuration, moduleId) {
  const modules = configuration.modules.slice().sort((a, b) => a.order - b.order);
  const index = modules.findIndex(item => item.id === moduleId);
  return index < 0 ? moduleId : `Cuerpo ${index + 1}`;
}

function designPicker(workshop) {
  return Promise.all([listProjects(workshop.id), listDesigns(workshop.id)]).then(([projects, designs]) => {
    const projectById = new Map(projects.map(project => [project.id, project]));
    const eligible = designs.filter(design => design.schema_version === 2 && design.type === 'closet');
    return { element: h('section', { class: 'production-page' },
      h('header', { class: 'page-heading' }, h('div', {}, h('span', { class: 'section-kicker' }, 'Producción'),
        h('h1', {}, 'Despiece y Corte'), h('p', {}, 'Genera piezas trazables y planes de corte desde diseños Clóset V2 completos.'))),
      eligible.length ? h('div', { class: 'production-design-grid' }, eligible.map(design => {
        const project = projectById.get(design.project_id);
        return h('a', { class: 'production-design-card', href: `#/proyectos/${design.project_id}/disenos/${design.id}/produccion` },
          h('span', { class: 'design-type-icon', 'data-type': design.type }, 'CL'),
          h('div', {}, h('small', {}, project?.code || 'Proyecto'), h('strong', {}, design.name),
            h('p', {}, project?.name || 'Proyecto'), h('time', {}, 'Actualizado ' + timeAgo(design.updated_at))),
          h('b', { 'aria-hidden': 'true' }, '→'));
      })) : h('div', { class: 'workspace-panel' }, emptyState('Aún no hay diseños V2 para producción',
        'Crea y completa un Clóset Modular V2. Cuando la ocupación sea exacta aparecerá disponible aquí.',
        h('a', { class: 'button button-primary', href: '#/proyectos' }, 'Ver proyectos')))) };
  });
}

function numberInput(label, value, options = {}) {
  return h('label', { class: 'field production-cut-field' }, h('span', {}, label),
    h('input', { type: 'number', value, min: options.min || 0, step: options.step || 1, name: options.name }));
}

async function productionDetail(workshop, projectId, designId) {
  const [project, row] = await Promise.all([getProject(workshop.id, projectId), getDesign(workshop.id, projectId, designId)]);
  const envelope = decodeDesign(row);
  const validation = window.TALLER_DESIGNER_V2_VALIDATION?.validateEnvelope(envelope);
  const generator = window.TALLER_PIECE_GENERATOR;
  const profiles = window.TALLER_PRODUCTION_PROFILES;
  const optimizer = window.TALLER_CUT_OPTIMIZER;
  if (!generator || !profiles || !optimizer || !validation) throw new Error('El módulo de Producción no está disponible.');

  const heading = h('header', { class: 'production-hero' },
    h('div', {}, h('a', { class: 'back-link', href: `#/proyectos/${projectId}/disenos/${designId}` }, '← Volver al diseño'),
      h('span', { class: 'section-kicker' }, `${project.code} · ${typeLabel(row.type)}`), h('h1', {}, row.name),
      h('p', {}, 'Despiece técnico y aprovechamiento de planchas derivados del modelo V2.')),
    h('span', { class: 'production-readiness', 'data-ready': String(validation.canGenerateTechnicalOutputs) },
      validation.canGenerateTechnicalOutputs ? 'Listo para producción' : 'Diseño no listo'));
  if (!validation.canGenerateTechnicalOutputs) {
    return { element: h('section', { class: 'production-page' }, heading,
      h('div', { class: 'production-blocked' }, h('span', { 'aria-hidden': 'true' }, '!'),
        h('div', {}, h('h2', {}, 'Corrige el diseño antes de generar'),
          h('p', {}, 'El despiece solo se habilita cuando el diseño está completo y técnicamente válido.'),
          h('ul', {}, validation.issues.map(issue => h('li', {}, issue.message))),
          h('a', { class: 'button button-primary', href: `#/proyectos/${projectId}/disenos/${designId}` }, 'Abrir diseñador')))) };
  }

  const generated = generator.generateClosetPieces(envelope, { designId: row.id });
  const material = envelope.configuration.materials.catalog[0];
  const defaultProfile = profiles.createCutProfile(envelope.configuration.production?.profile);
  const form = h('form', { class: 'production-cut-config' },
    h('div', {}, h('strong', {}, 'Configuración de corte'), h('small', {}, 'Aplicada a esta simulación')),
    numberInput('Largo plancha', material.sheet.lengthMm, { name: 'length', min: 1 }),
    numberInput('Ancho plancha', material.sheet.widthMm, { name: 'width', min: 1 }),
    numberInput('Kerf', defaultProfile.kerfMm, { name: 'kerf', min: 0, step: 0.1 }),
    numberInput('Refilado', defaultProfile.trims.topMm, { name: 'trim', min: 0 }),
    h('button', { class: 'button button-secondary', type: 'submit' }, 'Recalcular'));
  const piecesPanel = h('div', { class: 'production-tab-panel', id: 'production-pieces', role: 'tabpanel' });
  const optimizationPanel = h('div', { class: 'production-tab-panel', id: 'production-optimization', role: 'tabpanel', hidden: true });
  const tabs = ['pieces', 'optimization'].map((key, index) => h('button', {
    type: 'button', class: 'production-tab' + (index === 0 ? ' active' : ''), role: 'tab',
    'aria-selected': String(index === 0), 'aria-controls': `production-${key}`,
    onclick: () => {
      tabs.forEach(button => { const active = button === tabs[index]; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); });
      piecesPanel.hidden = key !== 'pieces'; optimizationPanel.hidden = key !== 'optimization';
    },
  }, key === 'pieces' ? 'Despiece' : 'Optimización'));

  function renderPieces() {
    piecesPanel.replaceChildren(
      h('div', { class: 'production-summary-grid' },
        h('article', {}, h('span', {}, 'Piezas'), h('strong', {}, generated.totals.totalPieces), h('small', {}, `${generated.totals.groupedRows} tipos agrupados`)),
        h('article', {}, h('span', {}, 'Área neta'), h('strong', {}, formatArea(generated.totals.totalAreaMm2)), h('small', {}, 'Sin merma de corte')),
        h('article', {}, h('span', {}, 'Materiales'), h('strong', {}, new Set(generated.pieces.map(piece => piece.materialId)).size), h('small', {}, 'Separados por espesor'))),
      h('div', { class: 'production-table-wrap' }, h('table', { class: 'production-table' },
        h('thead', {}, h('tr', {}, ['Pieza', 'Origen', 'Cant.', 'Largo × ancho', 'Espesor', 'Veta', 'Tapacantos'].map(label => h('th', {}, label)))),
        h('tbody', {}, generated.pieces.map(piece => h('tr', {},
          h('td', {}, h('strong', {}, piece.name), h('small', {}, piece.pieceType)),
          h('td', {}, moduleName(envelope.configuration, piece.sourceModuleId)),
          h('td', {}, piece.quantity), h('td', {}, `${piece.lengthMm} × ${piece.widthMm} mm`),
          h('td', {}, `${piece.thicknessMm} mm`), h('td', {}, piece.grainDirection === 'none' ? 'Sin veta' : 'Longitudinal'),
          h('td', {}, edgeSummary(piece.edgeBanding))))))),
      h('section', { class: 'edge-banding-summary' }, h('div', {}, h('span', { class: 'section-kicker' }, 'Tapacantos'), h('h3', {}, 'Metros lineales por tipo')),
        h('div', {}, generated.edgeBandingTotals.length ? generated.edgeBandingTotals.map(item => h('span', {}, h('strong', {}, item.linearMeters.toFixed(2) + ' m'), item.type)) : h('span', {}, 'Sin tapacantos'))));
  }

  function renderPlans() {
    const data = new FormData(form); const sheetLength = Number(data.get('length')); const sheetWidth = Number(data.get('width'));
    const profile = profiles.createCutProfile({ kerfMm: Number(data.get('kerf')), trims: {
      topMm: Number(data.get('trim')), bottomMm: Number(data.get('trim')), leftMm: Number(data.get('trim')), rightMm: Number(data.get('trim')),
    }});
    const plans = optimizer.optimizeByMaterial({ pieces: generated.pieces, strategy: profile.strategy,
      boardForGroup: (key, sample) => profiles.createBoardFromMaterial({ ...material,
        name: sample.materialName, sheet: { lengthMm: sheetLength, widthMm: sheetWidth } }, sample.thicknessMm, profile, `board-${key.replace(/[^a-z0-9]+/gi, '-')}`) });
    const totals = plans.reduce((summary, plan) => ({ boards: summary.boards + plan.boardCount,
      pieces: summary.pieces + plan.totals.placedPieces, unplaced: summary.unplaced + plan.totals.unplacedPieces,
      used: summary.used + plan.totals.usedAreaMm2, gross: summary.gross + plan.totals.grossAreaMm2 }), { boards: 0, pieces: 0, unplaced: 0, used: 0, gross: 0 });
    const utilization = totals.gross ? Math.round(totals.used / totals.gross * 10000) / 100 : 0;
    const nodes = [
      h('div', { class: 'production-optimization-summary' },
        h('div', {}, h('span', {}, 'Planchas'), h('strong', {}, totals.boards)),
        h('div', {}, h('span', {}, 'Piezas ubicadas'), h('strong', {}, totals.pieces)),
        h('div', {}, h('span', {}, 'Aprovechamiento global'), h('strong', {}, `${utilization}%`)),
        h('div', { 'data-alert': String(totals.unplaced > 0) }, h('span', {}, 'No ubicadas'), h('strong', {}, totals.unplaced)))];
    if (totals.unplaced) nodes.push(h('p', { class: 'notice error' }, 'Hay piezas que superan el área útil de la plancha configurada.'));
    nodes.push(
      h('div', { class: 'cut-plan-groups' }, plans.map(plan => h('section', { class: 'cut-plan-group' },
        h('header', {}, h('div', {}, h('span', { class: 'section-kicker' }, 'Grupo de material'),
          h('h2', {}, `${plan.board.materialName} · ${plan.board.thicknessMm} mm`)),
          h('span', { class: 'result-count' }, `${plan.boardCount} ${plan.boardCount === 1 ? 'plancha' : 'planchas'}`)),
        plan.boards.map(boardResult => cutPlanCard(plan, boardResult))))));
    optimizationPanel.replaceChildren(...nodes);
  }
  form.addEventListener('submit', event => { event.preventDefault(); try { renderPlans(); } catch (error) {
    optimizationPanel.replaceChildren(h('p', { class: 'notice error', role: 'alert' }, error.message));
  }});
  renderPieces(); renderPlans();
  return { element: h('section', { class: 'production-page' }, heading, form,
    h('div', { class: 'production-tabs', role: 'tablist', 'aria-label': 'Vista de producción' }, tabs), piecesPanel, optimizationPanel) };
}

export function production(workshop, projectId, designId) {
  return projectId && designId ? productionDetail(workshop, projectId, designId) : designPicker(workshop);
}
