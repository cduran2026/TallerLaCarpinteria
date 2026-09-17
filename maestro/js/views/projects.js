import { h, link, statusBadge, statuses, timeAgo, emptyState } from '../ui.js';
import { listProjects } from '../repositories/projects.js';
import { listDesigns } from '../repositories/designs.js';

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function projectCard(project, designCount) {
  const client = project.client_snapshot || {};
  return h('article', { class: 'directory-row project-directory-row' },
    h('div', { class: 'directory-main' },
      h('div', { class: 'directory-heading' },
        h('span', { class: 'project-code' }, project.code),
        statusBadge(project.status)),
      h('a', { class: 'directory-title', href: '#/proyectos/' + project.id }, project.name),
      h('p', { class: 'directory-subtitle' }, client.name || 'Cliente pendiente')),
    h('div', { class: 'directory-detail' },
      h('span', { class: 'directory-label' }, 'Ubicación'),
      h('strong', {}, project.site_commune || 'Por definir'),
      h('small', {}, project.site_address || 'Dirección pendiente')),
    h('div', { class: 'directory-detail directory-numeric' },
      h('span', { class: 'directory-label' }, 'Diseños'),
      h('strong', {}, designCount),
      h('small', {}, designCount === 1 ? 'diseño asociado' : 'diseños asociados')),
    h('div', { class: 'directory-detail' },
      h('span', { class: 'directory-label' }, 'Actualización'),
      h('strong', {}, timeAgo(project.updated_at)),
      h('small', {}, 'Actividad del proyecto')),
    h('a', { class: 'directory-action', href: '#/proyectos/' + project.id, 'aria-label': 'Abrir proyecto ' + project.name },
      h('span', {}, 'Abrir'), h('b', { 'aria-hidden': 'true' }, '→')));
}

export async function projects(workshop, query) {
  const [records, designs] = await Promise.all([listProjects(workshop.id), listDesigns(workshop.id)]);
  const counts = designs.reduce((result, design) => {
    result[design.project_id] = (result[design.project_id] || 0) + 1;
    return result;
  }, {});
  const initialClient = query.get('cliente') || '';
  const search = h('input', { type: 'search', placeholder: 'Buscar por código, proyecto o cliente', 'aria-label': 'Buscar proyectos' });
  const filter = h('select', { 'aria-label': 'Filtrar por estado' },
    h('option', { value: '' }, 'Todos los estados'),
    Object.entries(statuses).map(([value, label]) => h('option', { value }, label)));
  const count = h('span', { class: 'result-count', 'aria-live': 'polite' });
  const list = h('div', { class: 'directory-list project-directory' });
  const clear = h('button', { class: 'button button-secondary', type: 'button' }, 'Limpiar filtros');

  const renderList = () => {
    const term = normalize(search.value);
    const state = filter.value;
    const visible = records.filter(project => {
      const client = project.client_snapshot || {};
      const haystack = normalize([project.code, project.name, client.name, project.site_commune].join(' '));
      return (!term || haystack.includes(term)) && (!state || project.status === state)
        && (!initialClient || project.client_id === initialClient);
    });
    count.textContent = visible.length + (visible.length === 1 ? ' proyecto' : ' proyectos');
    list.replaceChildren(...(visible.length
      ? visible.map(project => projectCard(project, counts[project.id] || 0))
      : [emptyState(
        records.length ? 'No encontramos coincidencias' : 'Tu primer proyecto comienza aquí',
        records.length ? 'Prueba con otra búsqueda o elimina los filtros aplicados.' : 'Crea un proyecto para organizar cliente, ubicación y diseños en un solo lugar.',
        records.length ? clear : link('Crear primer proyecto', '#/proyectos/nuevo'))]));
  };
  search.addEventListener('input', renderList);
  filter.addEventListener('change', renderList);
  clear.addEventListener('click', () => { search.value = ''; filter.value = ''; renderList(); search.focus(); });

  const element = h('section', { class: 'collection-page projects-page' },
    h('header', { class: 'page-heading' },
      h('div', {}, h('span', { class: 'section-kicker' }, 'Cartera de trabajo'), h('h1', {}, 'Proyectos'),
        h('p', {}, 'Revisa el avance del taller y entra rápidamente a cada diseño.')),
      link('Nuevo proyecto', '#/proyectos/nuevo')),
    initialClient ? h('div', { class: 'context-filter' },
      h('span', {}, 'Mostrando proyectos del cliente seleccionado.'),
      h('a', { href: '#/proyectos' }, 'Ver todos')) : null,
    h('section', { class: 'workspace-panel directory-panel' },
      h('header', { class: 'directory-toolbar' },
        h('label', { class: 'search-control' }, h('span', { class: 'sr-only' }, 'Buscar proyectos'), search),
        h('label', { class: 'filter-control' }, h('span', { class: 'sr-only' }, 'Estado del proyecto'), filter),
        count),
      list));
  renderList();
  return { element };
}
