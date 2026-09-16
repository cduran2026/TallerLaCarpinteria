export function route() {
  const raw = location.hash.slice(1) || '/dashboard';
  const [pathname, query = ''] = raw.split('?');
  return { path: pathname, parts: pathname.split('/').filter(Boolean), query: new URLSearchParams(query) };
}
export function navigate(path) { location.hash = path; }
export function watch(callback) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}
