import { h, button, notice, link, statuses, typeLabel } from '../ui.js';
import { getProject, setStatus } from '../repositories/projects.js';
import { listDesigns } from '../repositories/designs.js';
export async function projectDetail(workshop, id) {
  const [project, designs] = await Promise.all([getProject(workshop.id, id), listDesigns(workshop.id, id)]);
  const status = notice();
  const select = h('select', {}, Object.entries(statuses).map(([key, label]) => h('option', { value: key }, label)));
  select.value = project.status;
  const save = button('Actualizar estado', { type: 'button' });
  save.addEventListener('click', async () => {
    save.disabled = true;
    try { await setStatus(workshop.id, id, select.value); status.textContent = 'Estado actualizado.'; }
    catch { status.textContent = 'No se pudo actualizar el estado.'; }
    finally { save.disabled = false; }
  });
  const client = project.client_snapshot;
  return { element: h('section', {}, h('span', { class: 'eyebrow' }, project.code), h('h1', {}, project.name),
    h('div', { class: 'card' }, h('h2', {}, 'Cliente'), h('p', {}, `${client.name} · ${client.phone}`), client.email ? h('p', {}, client.email) : null,
      h('h2', {}, 'Datos de instalación'), h('p', {}, `${project.site_commune} · ${project.site_address || 'Dirección pendiente'}`),
      h('p', {}, `Fecha: ${project.project_date}`), h('p', {}, project.observations || 'Sin observaciones'),
      h('label', { class: 'field' }, 'Estado', select), save, status),
    h('h2', {}, 'Diseños'), h('ul', { class: 'record-list' }, designs.map(d => h('li', {},
      h('a', { href: `#/proyectos/${id}/disenos/${d.id}` }, d.name), h('span', { class: 'muted' }, ` · ${typeLabel(d.type)}`)))),
    !designs.length ? h('p', {}, 'Este proyecto aún no tiene diseños.') : null,
    link('Nuevo diseño', `#/proyectos/${id}/disenos/nuevo`), link('Volver al dashboard', '#/dashboard')) };
}
