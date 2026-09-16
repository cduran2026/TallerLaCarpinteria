import { h, field, button, notice, values, submit, link } from '../ui.js';
import { listClients } from '../repositories/clients.js';
import { createProject } from '../repositories/projects.js';
import { navigate } from '../router.js';
export async function projectForm(workshop, query) {
  const clients = await listClients(workshop.id);
  const select = h('select', { name: 'client_id', required: true }, h('option', { value: '' }, 'Selecciona un cliente'),
    clients.map(c => h('option', { value: c.id }, `${c.name} · ${c.commune}`)));
  const status = notice();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const form = h('form', { class: 'card' }, h('label', { class: 'field' }, 'Cliente', select), link('Crear cliente', '#/clientes?proyecto=nuevo'),
    h('h2', {}, 'Datos del proyecto'), h('div', { class: 'form-grid' }, field('Nombre del proyecto', 'name', { required: true }),
      field('Comuna de instalación', 'site_commune', { required: true }), field('Dirección de instalación (opcional)', 'site_address'),
      field('Fecha', 'project_date', { type: 'date', value: today, required: true })),
    field('Observaciones (opcional)', 'observations', { multiline: true }), button('Guardar proyecto', { disabled: !clients.length }), status);
  const copyAddress = () => {
    const client = clients.find(c => c.id === select.value);
    form.elements.site_commune.value = client?.commune || '';
    form.elements.site_address.value = client?.address || '';
  };
  select.addEventListener('change', copyAddress);
  if (clients.some(c => c.id === query.get('cliente'))) { select.value = query.get('cliente'); copyAddress(); }
  form.addEventListener('submit', event => {
    event.preventDefault();
    submit(form, status, async () => {
      const project = await createProject(workshop.id, values(form)); navigate(`/proyectos/${project.id}`);
    });
  });
  return { element: h('section', {}, h('h1', {}, 'Nuevo proyecto'), !clients.length ? h('p', { class: 'notice' }, 'Crea primero un cliente con nombre, celular y comuna.') : null, form) };
}
