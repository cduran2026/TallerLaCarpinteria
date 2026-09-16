import { getClient } from './supabase-client.js';
export async function session() {
  const { data, error } = await (await getClient()).auth.getSession();
  if (error) throw error;
  return data.session;
}
export async function signIn(email, password) {
  const { data, error } = await (await getClient()).auth.signInWithPassword({ email, password });
  if (error) throw new Error('No fue posible ingresar. Revisa correo y contraseña o vuelve a intentar.');
  return data.session;
}
export async function signOut() {
  const { error } = await (await getClient()).auth.signOut();
  if (error) throw new Error('No se pudo cerrar la sesión. Intenta nuevamente.');
}
export async function onAuthChange(callback) {
  const { data } = (await getClient()).auth.onAuthStateChange((event, value) => {
    // No async Supabase calls inside the Auth callback (SDK lock).
    setTimeout(() => callback(event, value), 0);
  });
  return () => data.subscription.unsubscribe();
}
// Recovery/invitation password form is intentionally deferred. No public registration.
