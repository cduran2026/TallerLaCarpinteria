import { h, button, notice, statuses, statusBadge, typeLabel, timeAgo, formatShortDate, emptyState } from '../ui.js';
import { getProject, setStatus } from '../repositories/projects.js';
import { listDesigns } from '../repositories/designs.js';

function infoItem(label, value, detail) {
  return h('div', { class: 'project-info-item' },
    h('span', {}, label), h('strong', {}, value), detail ? h('small', {}, detail) : null);
}

function designCard(design, projectId) {
  return h('article', { class: 'design-card' },
    h('header', {},
      h('span', { class: 'design-type-icon', 'data-type': design.type, 'aria-hidden': 'true' }, design.type === 'kitchen' ? 'C' : 'CL'),
      h('span', { class: 'design-type' }, typeLabel(design.type))),
    h('div', { class: 'design-card-copy' },
      h('h3', {}, design.name),
      h('p', {}, 'Configuración técnica guardada'),
      h('time', { datetime: design.updated_at || '' }, 'Última edición: ' + timeAgo(design.updated_at))),
    h('a', { class: 'design-card-action', href: `#/proyectos/${projectId}/disenos/${design.id}` },
      h('span', {}, 'Abrir diseño'), h('b', { 'aria-hidden': 'true' }, '→')));
}

export async function projectDetail(workshop, id) {
  const [project, designs] = await Promise.all([getProject(workshop.id, id), listDesigns(workshop.id, id)]);
  const status = notice();
  const badgeSlot = h('span', { class: 'project-badge-slot' }, statusBadge(project.status));
  const select = h('select', { 'aria-label': 'Estado del proyecto' },
    Object.entries(statuses).map(([key, label]) => h('option', { value: key }, label)));
  select.value = project.status;
  const save = button('Actualizar estado', { type: 'button' });
  save.addEventListener('click', async () => {
    save.disabled = true;
    status.classList.remove('error');
    try {
      await setStatus(workshop.id, id, select.value);
      badgeSlot.replaceChildren(statusBadge(select.value));
      status.textContent = 'Estado actualizado.';
    } catch {
      status.textContent = 'No se pudo actualizar el estado.';
      status.classList.add('error');
    } finally { save.disabled = false; }
  });
  const client = project.client_snapshot || {};
  const designGrid = h('div', { class: 'design-grid' },
    ...designs.map(design => designCard(design, id)),
    h('a', { class: 'new-design-card', href: `#/proyectos/${id}/disenos/nuevo` },
      h('span', { 'aria-hidden': 'true' }, '+'),
      h('strong', {}, 'Nuevo diseño'),
      h('small', {}, 'Agregar Cocina o Clóset')));

  return { element: h('section', { class: 'project-detail-page' },
    h('a', { class: 'back-link', href: '#/proyectos' }, '← Volver a proyectos'),
    h('header', { class: 'project-hero' },
      h('div', { class: 'project-hero-main' },
        h('div', { class: 'project-hero-meta' }, h('span', { class: 'project-code' }, project.code), badgeSlot),
        h('h1', {}, project.name),
        h('p', {}, client.name || 'Cliente pendiente', ' · ', project.site_commune || 'Ubicación pendiente')),
      h('div', { class: 'project-hero-actions' },
        h('a', { class: 'button button-primary', href: `#/proyectos/${id}/disenos/nuevo` }, 'Nuevo diseño'))),
    h('div', { class: 'project-overview-grid' },
      h('section', { class: 'workspace-panel project-summary' },
        h('header', { class: 'panel-heading' },
          h('div', {}, h('span', { class: 'section-kicker' }, 'Resumen'), h('h2', {}, 'Información del proyecto'))),
        h('div', { class: 'project-info-grid' },
          infoItem('Cliente', client.name || 'Pendiente', client.phone || 'Sin celular'),
          infoItem('Instalación', project.site_commune || 'Pendiente', project.site_address || 'Dirección pendiente'),
          infoItem('Fecha del proyecto', formatShortDate(project.project_date), 'Fecha registrada'),
          infoItem('Última actualización', timeAgo(project.updated_at), formatShortDate(project.updated_at))),
        h('div', { class: 'project-observations' },
          h('span', {}, 'Observaciones'),
          h('p', {}, project.observations || 'Este proyecto todavía no tiene observaciones.'))),
      h('aside', { class: 'workspace-panel status-panel' },
        h('span', { class: 'section-kicker' }, 'Seguimiento'),
        h('h2', {}, 'Estado del proyecto'),
        h('p', {}, 'Mantén visible el avance para todo el taller.'),
        h('label', { class: 'field' }, 'Estado actual', select),
        save, status)),
    h('section', { class: 'designs-section' },
      h('header', { class: 'page-heading compact' },
        h('div', {}, h('span', { class: 'section-kicker' }, 'Diseños del proyecto'), h('h2', {}, 'Espacios y muebles'),
          h('p', {}, 'Cada diseño conserva su configuración y puede abrirse de forma independiente.')),
        designs.length ? h('span', { class: 'result-count' }, designs.length + (designs.length === 1 ? ' diseño' : ' diseños')) : null),
      designs.length ? designGrid : h('div', { class: 'workspace-panel' }, emptyState(
        'Este proyecto todavía no tiene diseños',
        'Agrega una Cocina o un Clóset para comenzar a desarrollar la propuesta.',
        h('a', { class: 'button button-primary', href: `#/proyectos/${id}/disenos/nuevo` }, 'Crear primer diseño')))) ) };
}
