import { h, link, statusBadge, typeLabel, timeAgo, emptyState } from '../ui.js';
import { listProjects } from '../repositories/projects.js';
import { listClients } from '../repositories/clients.js';
import { listDesigns } from '../repositories/designs.js';

function metric(label, value, detail, tone) {
  return h('article', { class: 'workspace-metric', 'data-tone': tone },
    h('div', { class: 'metric-label' }, h('span', { 'aria-hidden': 'true' }), label),
    h('strong', {}, value),
    h('small', {}, detail));
}

function projectRow(project, designCount) {
  const client = project.client_snapshot || {};
  return h('article', { class: 'project-work-row' },
    h('div', { class: 'project-row-heading' },
      h('span', { class: 'project-code' }, project.code),
      statusBadge(project.status)),
    h('a', { class: 'project-row-title', href: '#/proyectos/' + project.id }, project.name),
    h('p', { class: 'project-row-client' },
      client.name || 'Cliente pendiente',
      ' · ',
      project.site_commune || 'Comuna pendiente'),
    h('div', { class: 'project-row-meta' },
      h('span', {}, designCount + (designCount === 1 ? ' diseño' : ' diseños')),
      h('span', {}, 'Actualizado ' + timeAgo(project.updated_at))),
    h('a', { class: 'row-arrow', href: '#/proyectos/' + project.id, 'aria-label': 'Abrir ' + project.name }, '→'));
}

function activityItem(item) {
  const isDesign = item.kind === 'design';
  const href = isDesign
    ? '#/proyectos/' + item.projectId + '/disenos/' + item.id
    : '#/proyectos/' + item.id;
  return h('li', { class: 'activity-item' },
    h('span', { class: 'activity-icon', 'data-kind': item.kind, 'aria-hidden': 'true' },
      isDesign ? 'D' : 'P'),
    h('div', {},
      h('a', { href }, item.title),
      h('p', {}, isDesign ? typeLabel(item.type) + ' actualizado' : 'Proyecto actualizado')),
    h('time', { datetime: item.date || '' }, timeAgo(item.date)));
}

export async function dashboard(workshop, query) {
  const [projects, clients, designs] = await Promise.all([
    listProjects(workshop.id),
    listClients(workshop.id),
    listDesigns(workshop.id),
  ]);
  const activeProjects = projects.filter(project => project.status !== 'archived');
  const designCounts = designs.reduce((counts, design) => {
    counts[design.project_id] = (counts[design.project_id] || 0) + 1;
    return counts;
  }, {});
  const activity = projects.map(project => ({
    kind: 'project',
    id: project.id,
    title: project.code + ' · ' + project.name,
    date: project.updated_at,
  })).concat(designs.map(design => ({
    kind: 'design',
    id: design.id,
    projectId: design.project_id,
    title: design.name,
    type: design.type,
    date: design.updated_at,
  }))).sort((left, right) => new Date(right.date || 0) - new Date(left.date || 0)).slice(0, 6);

  const projectsPanel = h('section', { class: 'workspace-panel recent-projects', id: 'dashboard-projects' },
    h('header', { class: 'panel-heading' },
      h('div', {}, h('span', { class: 'section-kicker' }, 'Trabajo en curso'), h('h2', {}, 'Proyectos recientes')),
      h('div', { class: 'panel-actions' },
        projects.length ? h('span', { class: 'panel-count' }, projects.length + ' en total') : null,
        projects.length ? h('a', { class: 'panel-link', href: '#/proyectos' }, 'Ver todos') : null,
        h('a', { class: 'panel-link', href: '#/proyectos/nuevo' }, 'Nuevo proyecto'))),
    projects.length
      ? h('div', { class: 'project-work-list' }, projects.slice(0, 6).map(project =>
        projectRow(project, designCounts[project.id] || 0)))
      : emptyState(
        'Tu primer proyecto comienza aquí',
        'Crea un proyecto, asócialo a un cliente y agrega sus diseños.',
        link('Crear primer proyecto', '#/proyectos/nuevo')
      ));

  const activityPanel = h('aside', { class: 'workspace-panel activity-panel', id: 'dashboard-designs' },
    h('header', { class: 'panel-heading' },
      h('div', {}, h('span', { class: 'section-kicker' }, 'Seguimiento'), h('h2', {}, 'Actividad reciente'))),
    activity.length
      ? h('ol', { class: 'activity-list' }, activity.map(activityItem))
      : emptyState('Todo listo para comenzar', 'La actividad del taller aparecerá aquí.'));

  const element = h('section', { class: 'dashboard-page' },
    h('header', { class: 'dashboard-hero' },
      h('div', { class: 'dashboard-hero-copy' },
        h('span', { class: 'section-kicker' }, 'Centro de trabajo'),
        h('h1', {}, 'Tu taller, en orden.'),
        h('p', {}, 'Gestiona clientes, proyectos y diseños desde un solo lugar para avanzar con claridad.')),
      h('div', { class: 'dashboard-hero-actions' },
        link('Nuevo proyecto', '#/proyectos/nuevo'),
        h('a', { class: 'button button-quiet', href: '#/clientes' }, 'Gestionar clientes'))),
    h('div', { class: 'workspace-metrics', 'aria-label': 'Resumen del taller' },
      metric('Proyectos activos', activeProjects.length, activeProjects.length ? 'En seguimiento' : 'Sin pendientes', 'forest'),
      metric('Clientes', clients.length, clients.length === 1 ? 'Cliente registrado' : 'Clientes registrados', 'wood'),
      metric('Diseños', designs.length, designs.length === 1 ? 'Diseño guardado' : 'Diseños guardados', 'gold')),
    h('div', { class: 'dashboard-grid' }, projectsPanel, activityPanel));

  return {
    element,
    mount: () => {
      const section = query?.get('seccion');
      if (section === 'disenos') document.querySelector('#dashboard-designs')?.scrollIntoView({ block: 'start' });
    },
  };
}
