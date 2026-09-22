export const json = (body: unknown, status = 200, origin = '*') => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' },
});
export function allowedOrigin(request: Request) {
  const origin = request.headers.get('origin') || '';
  const allowed = (Deno.env.get('APP_ALLOWED_ORIGINS') || '').split(',').map(value => value.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : allowed[0] || 'null';
}
export const options = (origin: string) => new Response('ok', { headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
export function requireEnv(name: string) { const value = Deno.env.get(name); if (!value) throw new Error(`Falta el secreto ${name}.`); return value; }
