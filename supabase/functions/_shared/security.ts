import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireEnv } from './http.ts';
export function adminClient() { return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } }); }
export async function requireUser(request: Request) {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) throw Object.assign(new Error('Sesión requerida.'), { status: 401 });
  const client = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(); if (error || !data.user) throw Object.assign(new Error('Sesión inválida.'), { status: 401 }); return data.user;
}
export async function requireWorkshopAdmin(request: Request, workshopId: string) {
  const user = await requireUser(request); const admin = adminClient();
  const { data, error } = await admin.from('workshop_members').select('role').eq('workshop_id', workshopId).eq('user_id', user.id).maybeSingle();
  if (error || data?.role !== 'admin') throw Object.assign(new Error('Solo un administrador del taller puede realizar esta operación.'), { status: 403 });
  return { user, admin };
}
export async function sha256(value: string) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join(''); }
