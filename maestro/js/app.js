import { configurationError } from './supabase-client.js';
import { session, signOut, onAuthChange } from './auth.js';
import { route, navigate, watch } from './router.js';
import { loadWorkshops, currentWorkshop, selectWorkshop, clearWorkshop } from './workshop-context.js';
import { h, errorText } from './ui.js';
import { login } from './views/login.js';
import { dashboard } from './views/dashboard.js';
import { projects } from './views/projects.js';
import { clients } from './views/clients.js';
import { projectForm } from './views/project-form.js';
import { projectDetail } from './views/project-detail.js';
import { designEditor } from './views/design-editor.js';

const root = document.querySelector('#app');
const nav = document.querySelector('#app-nav');
const logout = document.querySelector('#logout');
const bar = document.querySelector('#workshop-bar');
const sidebarToggle = document.querySelector('#sidebar-toggle');
const sidebarClose = document.querySelector('#sidebar-close');
const sidebarOverlay = document.querySelector('#sidebar-overlay');
const contextEyebrow = document.querySelector('#context-eyebrow');
const contextTitle = document.querySelector('#context-title');
const sidebarWorkshopName = document.querySelector('#sidebar-workshop-name');
let activeView, lastHash = location.hash, generation = 0, userId = null;
function clearView() { activeView?.dispose?.(); activeView = null; root.replaceChildren(); }
function attach(view) { activeView = view; root.replaceChildren(view.element); view.mount?.(); }
function closeSidebar() {
  document.body.classList.remove('sidebar-open');
  sidebarToggle?.setAttribute('aria-expanded', 'false');
}
function setAuthenticated(value) {
  document.body.classList.toggle('maestro-authenticated', value);
  if (!value) closeSidebar();
}
function updateShell(path, query) {
  let section = 'dashboard';
  let eyebrow = 'Espacio de trabajo';
  let title = 'Dashboard';
  if (path === '/clientes') { section = 'clients'; eyebrow = 'Relaciones'; title = 'Clientes'; }
  else if (path === '/proyectos') { section = 'projects'; eyebrow = 'Cartera de trabajo'; title = 'Proyectos'; }
  else if (path === '/proyectos/nuevo') { section = 'projects'; eyebrow = 'Proyectos'; title = 'Nuevo proyecto'; }
  else if (path.startsWith('/proyectos/') && path.includes('/disenos/')) { section = 'designs'; eyebrow = 'Diseñador'; title = 'Diseño del proyecto'; }
  else if (path.startsWith('/proyectos/')) { section = 'projects'; eyebrow = 'Proyectos'; title = 'Ficha de proyecto'; }
  else if (query?.get('seccion') === 'disenos') { section = 'designs'; eyebrow = 'Espacio de trabajo'; title = 'Diseños'; }
  contextEyebrow.textContent = eyebrow;
  contextTitle.textContent = title;
  nav.querySelectorAll('[data-nav]').forEach(item => {
    const active = item.dataset.nav === section;
    item.classList.toggle('active', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  closeSidebar();
}
async function render(force = false) {
  if (!force && activeView?.canLeave && !activeView.canLeave()) {
    history.replaceState(null, '', lastHash || '#/dashboard'); return;
  }
  const ticket = ++generation;
  lastHash = location.hash;
  clearView();
  root.append(h('p', {}, 'Cargando…'));
  try {
    const missing = configurationError();
    if (missing) {
      setAuthenticated(false);
      nav.hidden = logout.hidden = bar.hidden = true;
      attach(login(missing)); return;
    }
    const current = await session();
    if (ticket !== generation) return;
    userId = current?.user.id || null;
    nav.hidden = logout.hidden = !current;
    setAuthenticated(!!current);
    if (!current) {
      clearWorkshop(); bar.hidden = true;
      if (route().path !== '/login') history.replaceState(null, '', '#/login');
      lastHash = location.hash; attach(login()); return;
    }
    const memberships = await loadWorkshops();
    if (ticket !== generation) return;
    const workshop = currentWorkshop();
    bar.hidden = false;
    if (!workshop) {
      bar.replaceChildren();
      attach({ element: h('div', { class: 'card' }, h('h1', {}, 'Taller pendiente'), h('p', {}, 'Tu cuenta está autenticada, pero aún no tiene un taller asignado. Solicita la asignación al administrador.')) }); return;
    }
    sidebarWorkshopName.textContent = workshop.name;
    if (memberships.length === 1) bar.replaceChildren(
      h('span', { class: 'workshop-label' }, 'Taller'),
      h('strong', { class: 'workshop-name' }, workshop.name)
    );
    else {
      const select = h('select', { 'aria-label': 'Taller activo' }, memberships.map(w => h('option', { value: w.id }, w.name)));
      select.value = workshop.id;
      select.addEventListener('change', () => {
        if (activeView?.canLeave && !activeView.canLeave()) { select.value = workshop.id; return; }
        selectWorkshop(select.value); history.replaceState(null, '', '#/dashboard'); render(true);
      });
      bar.replaceChildren(h('label', {}, h('span', { class: 'workshop-label' }, 'Taller'), select));
    }
    const { path, parts, query } = route();
    updateShell(path, query);
    let view;
    if (path === '/login' || path === '/dashboard') view = await dashboard(workshop, query);
    else if (path === '/proyectos') view = await projects(workshop, query);
    else if (path === '/clientes') view = await clients(workshop, query);
    else if (path === '/proyectos/nuevo') view = await projectForm(workshop, query);
    else if (parts.length === 2 && parts[0] === 'proyectos') view = await projectDetail(workshop, parts[1]);
    else if (parts.length === 4 && parts[0] === 'proyectos' && parts[2] === 'disenos') view = await designEditor(workshop, parts[1], parts[3]);
    else view = { element: h('p', { class: 'notice' }, 'Página no encontrada.') };
    if (ticket !== generation) { view.dispose?.(); return; }
    attach(view);
  } catch (error) {
    if (ticket === generation) attach({ element: h('div', { class: 'notice error', role: 'alert' }, errorText(error), h('p', {}, h('a', { href: '#/dashboard' }, 'Volver al dashboard'))) });
  }
}
sidebarToggle?.addEventListener('click', () => {
  const open = !document.body.classList.contains('sidebar-open');
  document.body.classList.toggle('sidebar-open', open);
  sidebarToggle.setAttribute('aria-expanded', String(open));
});
sidebarClose?.addEventListener('click', closeSidebar);
sidebarOverlay?.addEventListener('click', closeSidebar);
nav.addEventListener('click', event => {
  if (event.target.closest('a')) closeSidebar();
});
logout.addEventListener('click', async () => {
  if (activeView?.canLeave && !activeView.canLeave()) return;
  logout.disabled = true;
  try { await signOut(); clearWorkshop(); userId = null; navigate('/login'); await render(true); }
  catch (error) { window.alert(error.message); }
  finally { logout.disabled = false; }
});
window.addEventListener('beforeunload', event => {
  if (activeView?.hasUnsaved?.()) { event.preventDefault(); event.returnValue = ''; }
});
watch(() => render());
if (!configurationError()) onAuthChange((event, value) => {
  if (event === 'SIGNED_OUT' || value?.user.id !== userId) {
    clearWorkshop(); render(true);
  }
}).catch(error => { root.replaceChildren(h('p', { role: 'alert' }, errorText(error))); });
render();
