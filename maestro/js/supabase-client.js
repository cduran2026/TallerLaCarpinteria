import { config } from './config.js';
let clientPromise;
export function configurationError() {
  if (!config.supabaseUrl || !config.supabasePublishableKey) return 'Falta configurar la conexión real con Supabase.';
  try {
    const url = new URL(config.supabaseUrl);
    if (url.protocol !== 'https:' || url.pathname !== '/' || url.username || url.password) throw new Error();
  } catch { return 'La URL de Supabase debe ser una URL HTTPS válida.'; }
  if (!config.supabasePublishableKey.startsWith('sb_publishable_')) return 'Utiliza exclusivamente la clave publicable de Supabase (sb_publishable_…).';
  return '';
}
export function getClient() {
  const error = configurationError();
  if (error) throw new Error(error);
  // Load the SDK only after real public configuration exists. Pinned release.
  clientPromise ||= import('https://esm.sh/@supabase/supabase-js@2.116.0').then(({ createClient }) =>
    createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }));
  return clientPromise;
}
