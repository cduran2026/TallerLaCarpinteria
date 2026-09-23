export function instagramReturnUrl(appUrl: string, allowedOrigins: string, status: string, detail = '') {
  let target: URL;
  try { target = new URL(appUrl); }
  catch { throw new Error('APP_URL debe ser una URL absoluta.'); }
  if (target.protocol !== 'https:' || !target.hostname || target.username || target.password || target.hash) {
    throw new Error('APP_URL debe ser HTTPS, sin credenciales ni fragmento.');
  }
  const allowed = allowedOrigins.split(',').map(value => value.trim()).filter(Boolean);
  if (!allowed.some(value => {
    try {
      const origin = new URL(value);
      return origin.origin === target.origin && origin.pathname === '/' && !origin.search && !origin.hash && !origin.username && !origin.password;
    } catch { return false; }
  })) throw new Error('El origen de APP_URL no está en APP_ALLOWED_ORIGINS.');
  if (!target.pathname.endsWith('/')) target.pathname += '/';
  const route = new URLSearchParams({ instagram: status });
  if (detail) route.set('detail', detail);
  target.hash = `/configuracion/integraciones/instagram?${route}`;
  return target.toString();
}
