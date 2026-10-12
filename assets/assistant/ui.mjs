import { createConversation } from './engine.mjs';
import { readDesignerContext } from './context.mjs';
import { FLOWS, SOCIAL_LINKS, contextualHint } from './flows.mjs';

const ICONS = Object.freeze({
  kitchen: '<path d="M4 11h16v8H4zM7 11V7h10v4M8 15h8"/>',
  closet: '<path d="M5 4h14v16H5zM12 4v16M9 11v2m6-2v2"/>',
  measure: '<path d="M4 17 17 4l3 3L7 20l-3-3Zm4-4 2 2m1-5 2 2m1-5 2 2"/>',
  estimate: '<path d="M5 4h14v16H5zM8 9h8m-8 4h3m3 0h2m-8 4h8"/>',
  gallery: '<path d="M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4"/>',
});

function init() {
  const widget = document.querySelector('[data-assistant]');
  if (!widget) return;
  const trigger = widget.querySelector('[data-assistant-trigger]');
  const panel = widget.querySelector('#assistant-panel');
  const minimize = widget.querySelector('[data-assistant-minimize]');
  const close = widget.querySelector('[data-assistant-close]');
  const messages = widget.querySelector('[data-assistant-messages]');
  const replies = widget.querySelector('[data-assistant-replies]');
  const form = widget.querySelector('[data-assistant-form]');
  const input = form.elements.question;
  const updateInputState = () => form.classList.toggle('has-text', Boolean(input.value.trim()));
  let conversation = createConversation();
  let greeted = false;
  let untouched = true;
  let shownArea = null;
  const actionLabel = (id) => FLOWS[id]?.label || ({ more: 'Más opciones', home: 'Inicio', back: 'Volver', cancel: 'Cancelar', 'change-topic': 'Cambiar de tema' }[id] || id);
  const context = () => readDesignerContext();
  const activeArea = () => {
    const focusY = innerHeight * .4;
    for (const id of ['cotizador', 'galeria']) {
      const rect = document.getElementById(id)?.getBoundingClientRect();
      if (rect && rect.top <= focusY && rect.bottom >= focusY) return id;
    }
    return 'general';
  };
  // Una conversación muestra como máximo dos acciones sugeridas.
  // Las demás acciones se descubren progresivamente, nunca en un muro de botones.
  const MENUS = Object.freeze({
    more: [
      [{ id: 'other', label: 'Otro mueble' }, { id: 'questions', label: 'Resolver dudas' }],
      [{ id: 'gallery', label: 'Ver proyectos' }, { id: 'social', label: 'Redes sociales' }],
      [{ id: 'contact', label: 'Hablar con el taller' }, { id: 'home', label: 'Volver al inicio' }],
    ],
    questions: [
      [{ id: 'measure', label: 'Medidas' }, { id: 'materials', label: 'Materiales' }],
      [{ id: 'timing', label: 'Plazos' }, { id: 'coverage', label: 'Zonas de atención' }],
      [{ id: 'installation', label: 'Instalación' }, { id: 'payment', label: 'Pagos' }],
    ],
  });
  let menu = null;
  let menuPage = 0;
  const welcomeOptions = () => {
    const area = activeArea();
    if (area === 'cotizador') return [
      { id: 'measure', label: 'Revisar medidas', primary: true },
      { id: 'estimate', label: 'Ver estimación', primary: true },
    ];
    if (area === 'galeria') return [
      { id: 'gallery', label: 'Ver proyectos', primary: true },
      { id: 'kitchen', label: 'Cotizar cocina', primary: true },
    ];
    return [
      { id: 'kitchen', label: 'Cotizar cocina', primary: true },
      { id: 'closet', label: 'Cotizar clóset', primary: true },
    ];
  };
  const openMenu = (name, page = 0) => {
    menu = name;
    menuPage = page;
    const pages = MENUS[name];
    if (!pages) return;
    const items = pages[menuPage];
    showReplies(items, { footer: menuPage < pages.length - 1
      ? { id: 'menu-next', label: 'Ver otras opciones' }
      : { id: 'home', label: 'Volver a cotizar' } });
  };
  const line = (speaker, value) => {
    const item = document.createElement('p');
    item.className = `assistant-message assistant-message-${speaker}`;
    item.textContent = value;
    messages.append(item);
    while (messages.children.length > 12) messages.firstElementChild.remove();
    requestAnimationFrame(() => messages.scrollTo({
      top: messages.scrollHeight,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    }));
  };
  const showReplies = (items, { footer = null } = {}) => {
    replies.replaceChildren();
    const seen = new Set();
    // Dos sugerencias, no siete; el acceso a otras opciones es discreto.
    const options = items.filter((item) => {
      const id = typeof item === 'string' ? item : item.id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    }).slice(0, 2);
    const render = (option, secondary = false) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.action = option.id;
      button.className = secondary ? 'assistant-reply-more' : 'assistant-reply-chip';
      button.textContent = option.label || actionLabel(option.id);
      replies.append(button);
    };
    options.forEach((item) => render(typeof item === 'string' ? { id: item } : item));
    if (footer) render(footer, true);
    // No mostrar el acceso secundario si ya estamos dentro del menú.
    else if (!menu) render({ id: 'more', label: 'Otras consultas' }, true);
    replies.hidden = replies.children.length === 0;
  };
  const answer = (result) => {
    menu = null;
    line('bot', result.text);
    const actions = result.actions || [];
    if (result.status === 'unknown') {
      showReplies([{ id: 'contact', label: 'Hablar con el taller' }, { id: 'questions', label: 'Consultar otro tema' }]);
    } else {
      showReplies(actions.map(id => typeof id === 'string' ? { id } : id));
    }
  };
  const setOpen = (open) => {
    panel.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    trigger.setAttribute('aria-label', open ? 'Minimizar asistente de La Carpintería' : 'Abrir asistente de La Carpintería');
    if (open) {
      if (!greeted) {
        line('bot', `¡Hola! ${contextualHint(context())}`);
        menu = null;
        showReplies(welcomeOptions());
        greeted = true;
        shownArea = activeArea();
      } else if (untouched || shownArea !== activeArea()) {
        showReplies(welcomeOptions());
        shownArea = activeArea();
      }
      input.focus();
    } else if (panel.contains(document.activeElement)) trigger.focus();
  };
  const closeSession = () => {
    setOpen(false);
    messages.replaceChildren();
    replies.replaceChildren();
    input.value = '';
    updateInputState();
    conversation = createConversation();
    greeted = false;
    untouched = true;
    shownArea = null;
    menu = null;
    menuPage = 0;
  };
  const navigate = (action) => {
    const publicActions = window.TALLER_PUBLIC_ACTIONS;
    const mapped = FLOWS[action]?.action;
    if (mapped === 'quote-kitchen' || mapped === 'quote-closet') {
      publicActions?.selectProjectType(mapped === 'quote-kitchen' ? 'kitchen' : 'closet', 'asistente');
      setOpen(false);
    } else if (mapped === 'gallery') {
      document.querySelector('#galeria')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      setOpen(false);
    } else if (mapped === 'show-designer' || mapped === 'show-finish' || mapped === 'show-estimate') {
      const selector = mapped === 'show-finish' ? '#cotizador .fc-group:has(input[name="fcFinish"])' : mapped === 'show-estimate' ? '#price-range' : '#cotizador';
      document.querySelector(selector)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      setOpen(false);
    } else if (mapped === 'contact' || mapped === 'contact-other') {
      const message = mapped === 'contact-other'
        ? 'Hola, quiero cotizar un mueble a medida distinto de cocina o clóset. ¿Podemos conversar sobre mi proyecto?'
        : 'Hola, quiero conversar con Taller La Carpintería sobre mi proyecto.';
      publicActions?.openWhatsApp(message, 'asistente');
    } else if (mapped === 'open-instagram' || mapped === 'open-facebook') {
      window.open(mapped === 'open-instagram' ? SOCIAL_LINKS.instagram : SOCIAL_LINKS.facebook, '_blank', 'noopener,noreferrer');
    }
  };
  const choose = (action) => {
    untouched = false;
    if (action === 'more') { openMenu('more'); return; }
    if (action === 'menu-next') { openMenu(menu, menuPage + 1); return; }
    if (action === 'home' || action === 'change-topic' || action === 'cancel') {
      menu = null;
      if (action === 'change-topic' || action === 'cancel') line('bot', 'Claro. ¿En qué más puedo ayudarte?');
      showReplies(welcomeOptions());
      return;
    }
    if (action === 'social') {
      menu = null;
      line('bot', 'Puedes conocer nuestros trabajos en nuestras redes.');
      showReplies(['instagram', 'facebook']);
      return;
    }
    if (action === 'instagram' || action === 'facebook') {
      menu = null;
      line('bot', `Abriendo ${action === 'instagram' ? 'Instagram' : 'Facebook'} en otra pestaña.`);
      showReplies([{ id: 'gallery', label: 'Ver proyectos' }]);
      navigate(action);
      return;
    }
    if (action === 'questions') {
      line('bot', '¿Sobre qué aspecto de tu proyecto tienes dudas?');
      openMenu('questions');
      return;
    }
    const result = conversation.start(action, context());
    answer(result);
    navigate(action);
  };
  trigger.addEventListener('click', () => setOpen(panel.hidden));
  minimize?.addEventListener('click', () => setOpen(false));
  close.addEventListener('click', closeSession);
  widget.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (button && widget.contains(button)) choose(button.dataset.action);
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    untouched = false;
    line('user', question);
    input.value = '';
    updateInputState();
    answer(conversation.send(question, context()));
  });
  input.addEventListener('input', updateInputState);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !panel.hidden) setOpen(false); });
  // Los chips se reemplazan durante el click; composedPath conserva su origen.
  document.addEventListener('click', (event) => { if (!panel.hidden && !event.composedPath().includes(widget)) setOpen(false); });
  window.addEventListener('taller:configuration', () => {
    if (panel.hidden || !greeted) return;
    widget.dataset.projectType = context().type || '';
    if (untouched) {
      showReplies(welcomeOptions());
      shownArea = activeArea();
    }
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
