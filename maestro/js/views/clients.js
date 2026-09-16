import { h, field, button, notice, values, submit, link } from '../ui.js';
import { listClients, createClient } from '../repositories/clients.js';
import { navigate } from '../router.js';
export async function clients(workshop, query) {
  const records = await listClients(workshop.id);
  const status = notice();
  const list = h('ul', { class: 'record-list' });
  const row = c => h('li', {}, h('strong', {}, c.name), h('p', {}, `${c.phone} · ${c.commune}`),
    c.email ? h('p', { class: 'muted' }, c.email) : null, c.address ? h('p', { class: 'muted' }, c.address) : null,
    link('Crear proyecto', `#/proyectos/nuevo?cliente=${c.id}`));
  list.append(...records.map(row));
  const form = h('form', { class: 'card' }, h('h2', {}, 'Nuevo cliente'), h('div', { class: 'form-grid' },
    field('Nombre', 'name', { required: true, autocomplete: 'name' }),
    field('Celular', 'phone', { type: 'tel', required: true, autocomplete: 'tel', maxlength: 40 }),
    field('Correo (opcional)', 'email', { type: 'email', autocomplete: 'email' }),
    field('Comuna', 'commune', { required: true }), field('Dirección (opcional)', 'address')),
    button('Guardar cliente'), status);
  form.addEventListener('submit', event => {
    event.preventDefault();
    submit(form, status, async () => {
      const saved = await createClient(workshop.id, values(form));
      if (query.get('proyecto') === 'nuevo') { navigate(`/proyectos/nuevo?cliente=${saved.id}`); return; }
      list.prepend(row(saved)); form.reset(); status.textContent = 'Cliente guardado.';
    });
  });
  return { element: h('section', {}, h('h1', {}, 'Clientes'), form, list) };
}
