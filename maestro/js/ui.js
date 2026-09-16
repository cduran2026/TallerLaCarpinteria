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
