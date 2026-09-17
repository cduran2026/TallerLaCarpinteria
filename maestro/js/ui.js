export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== false && value != null) el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat(Infinity)) if (child != null) el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return el;
}
export const field = (label, name, options = {}) => h('label', { class: 'field' }, label,
  h(options.multiline ? 'textarea' : 'input', { name, id: name, type: options.type || 'text', maxlength: options.multiline ? 10000 : 200, ...Object.fromEntries(Object.entries(options).filter(([k]) => k !== 'multiline')) }));
export const notice = () => h('p', { role: 'status', class: 'muted' });
export const button = (text, attrs = {}) => h('button', { type: 'submit', class: 'button button-primary', ...attrs }, text);
export const link = (text, href) => h('a', { href, class: 'button button-secondary' }, text);
export const typeLabel = type => type === 'kitchen' ? 'Cocina' : 'Clóset';
export const statuses = { draft: 'Borrador', in_design: 'En diseño', approved: 'Aprobado', archived: 'Archivado' };
export const statusBadge = status => h('span', { class: 'status-badge', 'data-status': status }, statuses[status] || status);
export const emptyState = (title, description, action) => h('div', { class: 'empty-state' },
  h('span', { class: 'empty-state-mark', 'aria-hidden': 'true' }, '◇'),
  h('strong', {}, title), h('p', {}, description), action || null);
export function formatShortDate(value) {
  if (!value) return 'Sin fecha';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = dateOnly
    ? new Date(...value.split('-').map((part, index) => Number(part) - (index === 1 ? 1 : 0)))
    : new Date(value);
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}
export function timeAgo(value) {
  if (!value) return 'Sin actividad reciente';
  const days = Math.round((new Date(value).getTime() - Date.now()) / 86400000);
  if (Math.abs(days) < 1) return 'Hoy';
  if (days === -1) return 'Ayer';
  if (days > -7 && days < 0) return 'Hace ' + Math.abs(days) + ' días';
  return formatShortDate(value);
}
export function values(form) {
  return Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, String(value).trim() || null]));
}
export function errorText(error) {
  if (error.code === '42501') return 'No tienes permiso para realizar esta operación en el taller.';
  if (error.code === '23503') return 'El cliente o proyecto no corresponde a este taller.';
  if (error.code === '23514') return 'Revisa los datos: hay un valor no compatible.';
  return error.message || 'No fue posible completar la operación.';
}
export async function submit(form, status, task) {
  const buttons = [...form.querySelectorAll('button')];
  buttons.forEach(b => b.disabled = true);
  status.textContent = 'Guardando…';
  try { await task(); }
  catch (error) { status.textContent = errorText(error); status.classList.add('error'); }
  finally { buttons.forEach(b => b.disabled = false); }
}
