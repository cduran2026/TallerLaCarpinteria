import { h, link, statuses } from '../ui.js';
import { listProjects } from '../repositories/projects.js';
import { listClients } from '../repositories/clients.js';
import { listDesigns } from '../repositories/designs.js';
export async function dashboard(workshop) {
  const [projects, clients, designs] = await Promise.all([listProjects(workshop.id), listClients(workshop.id), listDesigns(workshop.id)]);
  const metric = (title, n) => h('article', { class: 'card' }, title, h('strong', { class: 'metric' }, n));
  return { element: h('section', {}, h('h1', {}, 'Modo Maestro'), h('p', {}, 'Taller: ', workshop.name),
    h('div', { class: 'stats' }, metric('Proyectos activos', projects.filter(p => p.status !== 'archived').length), metric('Clientes', clients.length), metric('Diseños', designs.length)),
    link('Nuevo proyecto', '#/proyectos/nuevo'), h('h2', {}, 'Proyectos recientes'),
    projects.length ? h('ul', { class: 'record-list' }, projects.slice(0, 12).map(p => h('li', {}, h('a', { href: `#/proyectos/${p.id}` }, `${p.code} · ${p.name}`), h('p', { class: 'muted' }, statuses[p.status]))))
      : h('p', {}, 'Aún no hay proyectos en este taller.')) };
}
