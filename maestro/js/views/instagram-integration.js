import { h, formatShortDate, timeAgo } from '../ui.js';
import { getMembershipRole, getInstagramConnection, listInstagramPublications, startInstagramConnection, testInstagramConnection, disconnectInstagram } from '../repositories/social-connections.js';

const STATUS = {
  connecting: ['Conectando', 'pending'], connected: ['Conectado', 'success'], token_expired: ['Token vencido', 'warning'],
  error: ['Error', 'error'], disconnected: ['No conectado', 'neutral'],
};
function statusBadge(status) { const current = STATUS[status] || ['No conectado', 'neutral']; return h('span', { class: 'integration-status', 'data-tone': current[1] }, h('i'), current[0]); }
function info(label, value) { return h('div', { class: 'integration-info-item' }, h('span', {}, label), h('strong', {}, value || '—')); }

export async function instagramIntegration(workshop, query) {
  const [role, connection, publications] = await Promise.all([getMembershipRole(workshop.id), getInstagramConnection(workshop.id), listInstagramPublications(workshop.id)]);
  const isAdmin = role === 'admin'; const state = connection?.status || 'disconnected'; const feedback = h('p', { class: 'integration-feedback', role: 'status' });
  const connect = h('button', { type: 'button', class: 'button button-primary' }, connection ? 'Reconectar' : 'Conectar Instagram');
  const test = h('button', { type: 'button', class: 'button button-secondary' }, 'Probar conexión');
  const disconnect = h('button', { type: 'button', class: 'button button-quiet danger' }, 'Desconectar');
  [connect, test, disconnect].forEach(button => button.disabled = !isAdmin);
  async function run(button, message, task) {
    button.disabled = true; feedback.classList.remove('error'); feedback.textContent = message;
    try { const result = await task(); return result; }
    catch (error) { feedback.textContent = error.message; feedback.classList.add('error'); }
    finally { button.disabled = !isAdmin; }
  }
  connect.addEventListener('click', async () => { const result = await run(connect, 'Preparando conexión segura con Meta…', () => startInstagramConnection(workshop.id)); if (result?.authorizationUrl) location.assign(result.authorizationUrl); });
  test.addEventListener('click', async () => { const result = await run(test, 'Verificando identidad y permisos…', () => testInstagramConnection(workshop.id)); if (result) { feedback.textContent = `Conexión válida con @${result.account.username}.`; setTimeout(() => location.reload(), 900); } });
  disconnect.addEventListener('click', async () => {
    if (!window.confirm(`¿Desconectar @${connection?.username || 'Instagram'} de ${workshop.name}? No se publicará ni eliminará contenido de Instagram.`)) return;
    const result = await run(disconnect, 'Eliminando el token de conexión…', () => disconnectInstagram(workshop.id)); if (result) location.reload();
  });
  const callback = query?.get('instagram'); if (callback === 'connected') feedback.textContent = 'Instagram se conectó correctamente.';
  if (callback === 'error') { feedback.textContent = query.get('detail') || 'Meta no pudo completar la conexión.'; feedback.classList.add('error'); }

  const permissions = connection?.permissions || [];
  const publicationHistory = publications.length ? h('section', { class: 'workspace-panel publication-history' },
    h('header', { class: 'panel-heading' }, h('div', {}, h('span', { class: 'section-kicker' }, 'Últimas pruebas'), h('h2', {}, 'Publicaciones'))),
    h('div', {}, publications.map(item => h('article', {},
      h('span', { class: 'integration-status', 'data-tone': item.status === 'published' ? 'success' : item.status === 'error' ? 'error' : 'pending' }, item.status === 'published' ? 'Publicada' : item.status === 'error' ? 'Error' : 'Procesando'),
      h('strong', {}, 'Story de prueba'),
      h('small', {}, item.external_media_id ? `ID ${item.external_media_id}` : item.error_message || 'Esperando respuesta'),
      h('time', {}, timeAgo(item.published_at || item.created_at)))))
  ) : null;
  const element = h('section', { class: 'integrations-page' },
    h('header', { class: 'integrations-hero' }, h('div', {}, h('span', { class: 'section-kicker' }, 'Configuración · Integraciones'), h('h1', {}, 'Instagram'), h('p', {}, 'Conecta la cuenta profesional del taller mediante la autenticación oficial de Meta.')),
      h('a', { class: 'button button-secondary', href: '#/marketing/estudio' }, 'Ir al Estudio de Contenido')),
    h('article', { class: 'integration-card instagram-card' },
      h('header', {}, h('div', { class: 'instagram-mark', 'aria-hidden': 'true' }, '◎'), h('div', {}, h('h2', {}, 'Instagram'), h('p', {}, 'Publicación controlada para cuentas Business')), statusBadge(state)),
      connection?.status === 'connected'
        ? h('div', { class: 'integration-info-grid' }, info('Usuario', '@' + connection.username), info('Instagram account ID', connection.external_account_id), info('Tipo de cuenta', connection.account_type), info('Página asociada', connection.metadata?.associated_page || 'No requerida con Instagram Login'), info('Conectado', formatShortDate(connection.connected_at)), info('Vencimiento', formatShortDate(connection.token_expires_at)))
        : h('div', { class: 'integration-empty' }, h('strong', {}, 'La cuenta todavía no está conectada'), h('p', {}, 'El taller autorizará el acceso directamente en Instagram. Modo Maestro nunca solicita ni almacena la contraseña.')),
      permissions.length ? h('div', { class: 'permission-list' }, h('span', {}, 'Permisos obtenidos'), h('div', {}, permissions.map(permission => h('code', {}, permission)))) : null,
      h('footer', {}, h('div', { class: 'integration-actions' }, state === 'connected' ? [test, connect, disconnect] : [connect]),
        !isAdmin ? h('small', {}, 'Solo un administrador del taller puede administrar esta conexión.') : h('small', {}, 'La autorización puede revocarse en cualquier momento.'), feedback)),
    h('section', { class: 'workspace-panel integration-security' }, h('span', { class: 'section-kicker' }, 'Seguridad'), h('h2', {}, 'Credenciales protegidas en servidor'), h('div', { class: 'security-points' },
      h('div', {}, h('b', {}, '01'), h('span', {}, h('strong', {}, 'OAuth oficial'), 'Autorización gestionada por Meta.')),
      h('div', {}, h('b', {}, '02'), h('span', {}, h('strong', {}, 'Token cifrado'), 'Supabase Vault y acceso exclusivo desde Edge Functions.')),
      h('div', {}, h('b', {}, '03'), h('span', {}, h('strong', {}, 'Aislamiento por taller'), 'RLS y validación de rol en cada operación.')))),
    publicationHistory);
  return { element };
}
