import { h, field, button, notice, values, submit } from '../ui.js';
import { listClients } from '../repositories/clients.js';
import { createProject } from '../repositories/projects.js';
import { navigate } from '../router.js';

export async function projectForm(workshop, query) {
  const clients = await listClients(workshop.id);
  const select = h('select', { name: 'client_id', id: 'client_id', required: true },
    h('option', { value: '' }, 'Selecciona un cliente'),
    clients.map(client => h('option', { value: client.id }, `${client.name} · ${client.commune}`)));
  const status = notice();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const form = h('form', { class: 'project-form' },
    h('section', { class: 'form-surface form-section-card' },
      h('header', { class: 'form-heading' },
        h('span', { class: 'form-step' }, '01'),
        h('div', {}, h('h2', {}, 'Cliente'), h('p', {}, 'Relaciona el proyecto con un cliente del taller.'))),
      h('div', { class: 'form-section-body client-picker' },
        h('label', { class: 'field' }, 'Cliente', select),
        h('a', { class: 'button button-secondary', href: '#/clientes?proyecto=nuevo' }, 'Agregar cliente'))),
    h('section', { class: 'form-surface form-section-card' },
      h('header', { class: 'form-heading' },
        h('span', { class: 'form-step' }, '02'),
        h('div', {}, h('h2', {}, 'Información del proyecto'), h('p', {}, 'Define cómo reconocerás este trabajo dentro del taller.'))),
      h('div', { class: 'form-section-body form-grid' },
        field('Nombre del proyecto', 'name', { required: true, placeholder: 'Ej.: Casa Pérez' }),
        field('Fecha', 'project_date', { type: 'date', value: today, required: true }))),
    h('section', { class: 'form-surface form-section-card' },
      h('header', { class: 'form-heading' },
        h('span', { class: 'form-step' }, '03'),
        h('div', {}, h('h2', {}, 'Instalación'), h('p', {}, 'La dirección puede completarse cuando esté confirmada.'))),
      h('div', { class: 'form-section-body form-grid form-grid-two' },
        field('Comuna de instalación', 'site_commune', { required: true, placeholder: 'Ej.: Las Condes' }),
        field('Dirección de instalación (opcional)', 'site_address', { placeholder: 'Puede completarse después' }))),
    h('section', { class: 'form-surface form-section-card' },
      h('header', { class: 'form-heading' },
        h('span', { class: 'form-step' }, '04'),
        h('div', {}, h('h2', {}, 'Notas del trabajo'), h('p', {}, 'Registra acuerdos, restricciones o antecedentes útiles.'))),
      h('div', { class: 'form-section-body' },
        field('Observaciones (opcional)', 'observations', { multiline: true, placeholder: 'Ej.: Coordinar visita técnica antes de definir medidas finales.' }))),
    h('footer', { class: 'form-footer' },
      h('a', { class: 'button button-secondary', href: '#/proyectos' }, 'Cancelar'),
      button('Guardar proyecto', { disabled: !clients.length }), status));

  const copyAddress = () => {
    const client = clients.find(item => item.id === select.value);
    form.elements.site_commune.value = client?.commune || '';
    form.elements.site_address.value = client?.address || '';
  };
  select.addEventListener('change', copyAddress);
  if (clients.some(client => client.id === query.get('cliente'))) {
    select.value = query.get('cliente');
    copyAddress();
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    submit(form, status, async () => {
      const project = await createProject(workshop.id, values(form));
      navigate(`/proyectos/${project.id}`);
    });
  });

  return { element: h('section', { class: 'form-page' },
    h('header', { class: 'page-heading' },
      h('div', {}, h('span', { class: 'section-kicker' }, 'Nuevo trabajo'), h('h1', {}, 'Nuevo proyecto'),
        h('p', {}, 'Crea la ficha base y después agrega todos los diseños que necesites.'))),
    !clients.length ? h('div', { class: 'notice', role: 'status' },
      'Para crear un proyecto necesitas registrar primero un cliente.',
      h('a', { href: '#/clientes?proyecto=nuevo' }, ' Crear cliente')) : null,
    form) };
}
