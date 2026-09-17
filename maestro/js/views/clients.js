import { h, field, button, notice, values, submit, timeAgo, emptyState } from '../ui.js';
import { listClients, createClient } from '../repositories/clients.js';
import { listProjects } from '../repositories/projects.js';
import { navigate } from '../router.js';

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function clientRow(client, projects) {
  const related = projects.filter(project => project.client_id === client.id);
  const lastActivity = related.reduce((latest, project) =>
    new Date(project.updated_at || 0) > new Date(latest || 0) ? project.updated_at : latest, client.updated_at);
  return h('article', { class: 'directory-row client-directory-row' },
    h('div', { class: 'client-identity', 'aria-hidden': 'true' }, client.name.trim().charAt(0).toUpperCase()),
    h('div', { class: 'directory-main' },
      h('strong', { class: 'directory-title' }, client.name),
      h('p', { class: 'directory-subtitle' }, client.commune),
      h('div', { class: 'client-contact' },
        h('a', { href: 'tel:' + client.phone }, client.phone),
        client.email ? h('a', { href: 'mailto:' + client.email }, client.email) : h('span', {}, 'Sin correo'))),
    h('div', { class: 'directory-detail directory-numeric' },
      h('span', { class: 'directory-label' }, 'Proyectos'),
      h('strong', {}, related.length),
      h('small', {}, related.length === 1 ? 'proyecto asociado' : 'proyectos asociados')),
    h('div', { class: 'directory-detail' },
      h('span', { class: 'directory-label' }, 'Última actividad'),
      h('strong', {}, timeAgo(lastActivity)),
      h('small', {}, related.length ? 'Actividad en proyectos' : 'Cliente registrado')),
    h('div', { class: 'directory-row-actions' },
      h('a', { class: 'button button-secondary', href: '#/proyectos?cliente=' + client.id }, 'Ver proyectos'),
      h('a', { class: 'button button-primary', href: '#/proyectos/nuevo?cliente=' + client.id }, 'Crear proyecto')));
}

export async function clients(workshop, query) {
  const [records, projects] = await Promise.all([listClients(workshop.id), listProjects(workshop.id)]);
  const search = h('input', { type: 'search', placeholder: 'Buscar por nombre, celular, correo o comuna', 'aria-label': 'Buscar clientes' });
  const count = h('span', { class: 'result-count', 'aria-live': 'polite' });
  const list = h('div', { class: 'directory-list client-directory' });
  const status = notice();
  const form = h('form', { class: 'form-surface client-form' },
    h('header', { class: 'form-heading' },
      h('span', { class: 'section-kicker' }, 'Nuevo registro'),
      h('h2', {}, 'Agregar cliente'),
      h('p', {}, 'Nombre, celular y comuna son suficientes para comenzar.')),
    h('section', { class: 'form-section' },
      h('h3', {}, 'Identificación y contacto'),
      h('div', { class: 'form-grid' },
        field('Nombre', 'name', { required: true, autocomplete: 'name', placeholder: 'Ej.: Juan Pérez' }),
        field('Celular', 'phone', { type: 'tel', required: true, autocomplete: 'tel', maxlength: 40, placeholder: '+56 9 1234 5678' }),
        field('Correo (opcional)', 'email', { type: 'email', autocomplete: 'email', placeholder: 'cliente@correo.cl' }))),
    h('section', { class: 'form-section' },
      h('h3', {}, 'Ubicación'),
      h('div', { class: 'form-grid form-grid-two' },
        field('Comuna', 'commune', { required: true, placeholder: 'Ej.: Providencia' }),
        field('Dirección (opcional)', 'address', { placeholder: 'Puede completarse después' }))),
    h('footer', { class: 'form-actions' }, button('Guardar cliente'), status));

  const renderList = () => {
    const term = normalize(search.value);
    const visible = records.filter(client => !term || normalize([client.name, client.phone, client.email, client.commune].join(' ')).includes(term));
    count.textContent = visible.length + (visible.length === 1 ? ' cliente' : ' clientes');
    list.replaceChildren(...(visible.length
      ? visible.map(client => clientRow(client, projects))
      : [emptyState(
        records.length ? 'No encontramos coincidencias' : 'Construye tu cartera de clientes',
        records.length ? 'Prueba buscando por otro nombre, contacto o comuna.' : 'Registra tu primer cliente para crear proyectos y mantener su información organizada.') ]));
  };
  search.addEventListener('input', renderList);
  form.addEventListener('submit', event => {
    event.preventDefault();
    submit(form, status, async () => {
      const saved = await createClient(workshop.id, values(form));
      if (query.get('proyecto') === 'nuevo') { navigate(`/proyectos/nuevo?cliente=${saved.id}`); return; }
      records.push(saved);
      records.sort((a, b) => a.name.localeCompare(b.name, 'es'));
      form.reset();
      status.textContent = 'Cliente guardado correctamente.';
      renderList();
    });
  });

  const element = h('section', { class: 'collection-page clients-page' },
    h('header', { class: 'page-heading' },
      h('div', {}, h('span', { class: 'section-kicker' }, 'Relaciones del taller'), h('h1', {}, 'Clientes'),
        h('p', {}, 'Encuentra contactos y accede a sus proyectos sin perder tiempo.'))),
    h('div', { class: 'clients-layout' },
      h('section', { class: 'workspace-panel directory-panel' },
        h('header', { class: 'directory-toolbar' },
          h('label', { class: 'search-control' }, h('span', { class: 'sr-only' }, 'Buscar clientes'), search), count),
        list),
      form));
  renderList();
  return { element };
}
