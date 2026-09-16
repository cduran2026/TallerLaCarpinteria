import { h, field, button, notice, link } from '../ui.js';
import { signIn } from '../auth.js';
import { navigate } from '../router.js';
export function login(configError = '') {
  const status = notice();
  const form = h('form', {}, field('Correo', 'email', { type: 'email', required: true, autocomplete: 'username', disabled: !!configError }),
    field('Contraseña', 'password', { type: 'password', required: true, autocomplete: 'current-password', disabled: !!configError }),
    button('Ingresar', { disabled: !!configError }), status);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = form.querySelector('button');
    submit.disabled = true;
    status.textContent = 'Ingresando…';
    const password = form.elements.password;
    try { await signIn(form.elements.email.value.trim(), password.value); navigate('/dashboard'); }
    catch (error) { status.textContent = error.message; }
    finally { password.value = ''; submit.disabled = false; }
  });
  return { element: h('section', { class: 'card login-card' }, h('span', { class: 'eyebrow' }, 'Modo Maestro'),
    h('h1', {}, 'Ingresa a tu taller'),
    configError ? h('div', { class: 'notice', role: 'status' }, h('strong', {}, 'Conexión pendiente'), h('p', {}, configError),
      h('p', {}, 'El acceso se habilitará al configurar Supabase. No se han cargado clientes ni proyectos.')) : null,
    form, h('p', { class: 'muted' }, 'Acceso para usuarios habilitados por el taller. No hay registro público.'), link('Volver a la web', '../')) };
}
