import { instagramReturnUrl } from './redirect.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const origin = 'https://cduran2026.github.io';

Deno.test('OAuth returns to the full GitHub Pages app path', () => {
  const value = instagramReturnUrl(`${origin}/TallerLaCarpinteria/maestro/`, origin, 'connected');
  const target = new URL(value);
  assert(target.pathname === '/TallerLaCarpinteria/maestro/', 'app path was lost');
  assert(target.hash === '#/configuracion/integraciones/instagram?instagram=connected', 'status route was lost');
});
Deno.test('normalizes the final slash and preserves existing query parameters', () => {
  const value = instagramReturnUrl(`${origin}/TallerLaCarpinteria/maestro?source=meta`, origin, 'error', 'Acceso cancelado');
  const target = new URL(value);
  assert(target.pathname.endsWith('/maestro/'), 'final slash was not normalized');
  assert(target.searchParams.get('source') === 'meta', 'existing query was discarded');
  assert(new URLSearchParams(target.hash.split('?')[1]).get('detail') === 'Acceso cancelado', 'detail was not encoded safely');
});
Deno.test('accepts a future first-party domain through configuration', () => {
  const value = instagramReturnUrl('https://lacarpinteriachile.cl/maestro/', 'https://lacarpinteriachile.cl', 'connected');
  assert(new URL(value).origin === 'https://lacarpinteriachile.cl', 'future domain was rejected');
});
Deno.test('rejects unsafe or misconfigured redirects', () => {
  for (const appUrl of ['javascript:alert(1)', 'http://example.com/maestro/', 'https://evil.example/maestro/',
    'https://user:pass@cduran2026.github.io/maestro/', `${origin}/maestro/#/other`, '/maestro/']) {
    let rejected = false;
    try { instagramReturnUrl(appUrl, origin, 'connected'); } catch { rejected = true; }
    assert(rejected, `unsafe APP_URL was accepted: ${appUrl}`);
  }
});
