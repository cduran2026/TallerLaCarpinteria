import { h } from '../ui.js';
import { publishInstagramStory } from '../repositories/social-connections.js';

const STAGES = { before: 'Antes', during: 'Durante', after: 'Después', result: 'Resultado final', detail: 'Detalle', video: 'Video' };
const CTA_OPTIONS = ['Cotiza con nosotros', 'Escríbenos por WhatsApp', 'Agenda una visita', 'Conoce nuestro trabajo'];
const CATEGORIES = { finished: 'Resultado', comparison: 'Comparación', process: 'Proceso', story: 'Vertical', promotion: 'Promoción' };

function field(label, control, hint) {
  return h('label', { class: 'studio-field' }, h('span', {}, label), control, hint ? h('small', {}, hint) : null);
}
function option(value, label) { return h('option', { value }, label); }
function safeBrand(workshop, profiles) {
  const key = `taller:content-brand:${workshop.id}`;
  try { return { key, value: { ...profiles.createBrandKit(workshop), ...JSON.parse(localStorage.getItem(key) || '{}') } }; }
  catch { return { key, value: profiles.createBrandKit(workshop) }; }
}
function projectDescription(project, types, showCommune) {
  const names = [...(types || [])].map(type => type === 'kitchen' ? 'Cocina' : 'Clóset');
  const base = names.length ? names.join(' + ') + ' a medida' : 'Proyecto de mobiliario a medida';
  return showCommune && project?.site_commune ? `${base} en ${project.site_commune}.` : `${base}.`;
}

export function createContentStudio({ workshop, projects = [], designTypes = {}, initialProjectId = null, instagramConnection = null, canPublishInstagram = false }) {
  const profiles = window.TALLER_CONTENT_PROFILES;
  const templates = window.TALLER_CONTENT_TEMPLATES;
  const renderer = window.TALLER_CONTENT_RENDERER;
  const savedBrand = safeBrand(workshop, profiles);
  const store = window.TALLER_CONTENT_STORE.createContentStore({ brandKit: savedBrand.value });
  const sources = new Map();
  let unsubscribe;
  let renderTicket = 0;

  const projectSelect = h('select', { 'aria-label': 'Proyecto asociado' }, option('', 'Sin proyecto asociado'), projects.map(project => option(project.id, `${project.code} · ${project.name}`)));
  const communeToggle = h('input', { type: 'checkbox' });
  const upload = h('input', { type: 'file', accept: 'image/*,video/mp4,video/webm,video/quicktime', multiple: true, class: 'studio-file-input' });
  const mediaList = h('div', { class: 'studio-media-list' });
  const canvas = h('canvas', { class: 'studio-canvas', 'aria-label': 'Vista previa de la publicación' });
  const canvasFrame = h('div', { class: 'studio-canvas-frame' }, canvas);
  const readiness = h('span', { class: 'studio-readiness' });
  const dimensions = h('span', { class: 'studio-dimensions' });
  const feedback = h('p', { class: 'studio-feedback', role: 'status' });
  const download = h('button', { type: 'button', class: 'button button-primary' }, 'Descargar imagen');
  const generate = h('button', { type: 'button', class: 'button button-secondary' }, 'Generar imagen');
  const publishInstagram = instagramConnection?.status === 'connected' && canPublishInstagram
    ? h('button', { type: 'button', class: 'button button-instagram' }, 'Publicar en Instagram') : null;
  const titleInput = h('input', { type: 'text', maxlength: 90 });
  const descriptionInput = h('textarea', { rows: 4, maxlength: 360 });
  const ctaSelect = h('select', {}, CTA_OPTIONS.map(value => option(value, value)), option('custom', 'CTA personalizado'));
  const ctaInput = h('input', { type: 'text', maxlength: 60 });
  const hashtagsInput = h('textarea', { rows: 2, maxlength: 220, placeholder: '#mueblesamedida #carpintería' });
  const formatSelect = h('select', {}, Object.values(profiles.FORMAT_PROFILES).map(item => option(item.id, item.name)));
  const customWidth = h('input', { type: 'number', min: 320, max: 4096, value: 1080 });
  const customHeight = h('input', { type: 'number', min: 320, max: 4096, value: 1080 });
  const customFields = h('div', { class: 'studio-custom-size', hidden: true }, field('Ancho', customWidth), field('Alto', customHeight));
  const showLogo = h('input', { type: 'checkbox', checked: true });
  const brandName = h('input', { type: 'text', maxlength: 80 });
  const primaryColor = h('input', { type: 'color' });
  const accentColor = h('input', { type: 'color' });
  const fontSelect = h('select', {}, ['Inter', 'Montserrat', 'Playfair Display', 'Arial'].map(value => option(value, value)));
  const phoneInput = h('input', { type: 'text', maxlength: 40 });
  const whatsappInput = h('input', { type: 'text', maxlength: 40 });
  const instagramInput = h('input', { type: 'text', maxlength: 80 });
  const websiteInput = h('input', { type: 'url', maxlength: 160 });
  const logoInput = h('input', { type: 'file', accept: 'image/*' });
  const templateGrid = h('div', { class: 'studio-template-grid' });

  function persistBrand() {
    const brandKit = { workshopName: brandName.value, primaryColor: primaryColor.value, accentColor: accentColor.value,
      fontFamily: fontSelect.value, phone: phoneInput.value, whatsapp: whatsappInput.value,
      instagram: instagramInput.value, website: websiteInput.value, logoUrl: store.getState().brandKit.logoUrl };
    store.setBrandKit(brandKit);
    try { localStorage.setItem(savedBrand.key, JSON.stringify(brandKit)); } catch {}
  }
  function selectProject(id, preload = true) {
    const project = projects.find(item => item.id === id);
    store.setProject(id || null);
    communeToggle.disabled = !project?.site_commune;
    if (!project || !preload) return;
    titleInput.value = project.name || '';
    descriptionInput.value = projectDescription(project, designTypes[id], communeToggle.checked);
    store.setText({ title: titleInput.value, description: descriptionInput.value });
  }
  function mediaSource(id) { return sources.get(id)?.element || null; }
  function renderPreview() {
    const ticket = ++renderTicket;
    return renderer.renderComposition(canvas, store.getComposition(), mediaSource).then(() => ticket === renderTicket);
  }
  function renderMedia(state) {
    if (!state.media.length) {
      mediaList.replaceChildren(h('div', { class: 'studio-empty-media' }, h('span', {}, '＋'), h('strong', {}, 'Agrega fotos o videos'), h('small', {}, 'Clasifícalos para construir la publicación.')));
      return;
    }
    mediaList.replaceChildren(...state.media.map((media, index) => {
      const runtime = sources.get(media.id);
      const preview = media.kind === 'video'
        ? h('video', { src: runtime?.url || '', muted: true, playsinline: true })
        : h('img', { src: runtime?.url || '', alt: '' });
      const stage = h('select', { 'aria-label': 'Tipo de contenido' }, Object.entries(STAGES).map(([value, label]) => option(value, label)));
      stage.value = media.stage;
      stage.addEventListener('change', () => store.updateMedia(media.id, { stage: stage.value }));
      const selectButton = h('button', { type: 'button', class: 'studio-media-select', 'aria-pressed': state.selectedMediaIds.includes(media.id) }, state.selectedMediaIds.includes(media.id) ? 'Seleccionado' : 'Usar');
      selectButton.addEventListener('click', () => store.selectMedia(media.id, !state.selectedMediaIds.includes(media.id)));
      const remove = h('button', { type: 'button', class: 'icon-button', 'aria-label': `Quitar ${media.name}` }, '×');
      remove.addEventListener('click', () => { URL.revokeObjectURL(runtime?.url || ''); sources.delete(media.id); store.removeMedia(media.id); });
      const card = h('article', { class: 'studio-media-card' },
        h('div', { class: 'studio-media-thumb' }, preview, h('span', {}, media.kind === 'video' ? `${Math.min(10, Math.round((media.trimEndSeconds || 0) - (media.trimStartSeconds || 0)))} s` : STAGES[media.stage])),
        h('div', { class: 'studio-media-copy' }, h('strong', {}, media.name), stage,
          h('div', { class: 'studio-media-actions' }, selectButton,
            h('button', { type: 'button', disabled: index === 0, onclick: () => store.moveSelected(media.id, -1), 'aria-label': 'Mover antes' }, '↑'),
            h('button', { type: 'button', disabled: index === state.media.length - 1, onclick: () => store.moveSelected(media.id, 1), 'aria-label': 'Mover después' }, '↓'), remove)));
      if (media.kind === 'video') {
        const start = h('input', { type: 'number', min: 0, max: media.durationSeconds || 0, step: .1, value: media.trimStartSeconds || 0 });
        const end = h('input', { type: 'number', min: 0, max: media.durationSeconds || 0, step: .1, value: media.trimEndSeconds || Math.min(10, media.durationSeconds || 10) });
        const update = () => { if (runtime?.element) runtime.element.currentTime = Number(start.value); store.setVideoTrim(media.id, Number(start.value), Number(end.value)); };
        start.addEventListener('change', update); end.addEventListener('change', update);
        card.append(h('div', { class: 'studio-trim' }, field('Inicio (s)', start), field('Fin (s)', end)));
      }
      return card;
    }));
  }
  function sync(state) {
    titleInput.value = state.text.title; descriptionInput.value = state.text.description; ctaInput.value = state.text.cta; hashtagsInput.value = state.text.hashtags;
    formatSelect.value = state.formatId; customFields.hidden = state.formatId !== 'custom'; showLogo.checked = state.showLogo;
    brandName.value = state.brandKit.workshopName; primaryColor.value = state.brandKit.primaryColor; accentColor.value = state.brandKit.accentColor;
    fontSelect.value = state.brandKit.fontFamily; phoneInput.value = state.brandKit.phone; whatsappInput.value = state.brandKit.whatsapp;
    instagramInput.value = state.brandKit.instagram; websiteInput.value = state.brandKit.website;
    templateGrid.querySelectorAll('[data-template]').forEach(button => button.classList.toggle('active', button.dataset.template === state.templateId));
    const composition = store.getComposition();
    readiness.dataset.ready = String(composition.readiness.isReady);
    readiness.textContent = composition.readiness.isReady ? 'Listo para exportar' : `Falta contenido (${composition.readiness.missingSlots.length})`;
    dimensions.textContent = `${composition.format.width} × ${composition.format.height} px`;
    download.disabled = !composition.readiness.isReady;
    renderMedia(state);
    renderPreview().catch(() => { feedback.textContent = 'No fue posible actualizar la vista previa.'; });
  }
  async function addFiles(files) {
    for (const file of files) {
      const kind = file.type.startsWith('video/') ? 'video' : 'image';
      const url = URL.createObjectURL(file);
      const element = document.createElement(kind === 'video' ? 'video' : 'img');
      element.src = url; if (kind === 'video') { element.muted = true; element.playsInline = true; }
      await new Promise(resolve => { element.addEventListener(kind === 'video' ? 'loadedmetadata' : 'load', resolve, { once: true }); element.addEventListener('error', resolve, { once: true }); });
      const duration = kind === 'video' ? Number(element.duration) || 0 : 0;
      const id = store.addMedia({ name: file.name, kind, stage: kind === 'video' ? 'video' : 'result', durationSeconds: duration, trimStart: 0, trimEnd: Math.min(duration || 10, 10) });
      sources.set(id, { url, element });
    }
    sync(store.getState());
  }

  templates.TEMPLATES.forEach(template => {
    const button = h('button', { type: 'button', class: 'studio-template-card', 'data-template': template.templateId },
      h('span', { class: 'template-miniature', 'data-layout': template.layout }, h('i'), h('b')),
      h('span', {}, h('strong', {}, template.name), h('small', {}, CATEGORIES[template.category] || template.category)));
    button.addEventListener('click', () => store.setTemplate(template.templateId)); templateGrid.append(button);
  });
  projectSelect.addEventListener('change', () => selectProject(projectSelect.value));
  communeToggle.addEventListener('change', () => selectProject(projectSelect.value));
  upload.addEventListener('change', () => { addFiles([...upload.files]); upload.value = ''; });
  [titleInput, descriptionInput, ctaInput, hashtagsInput].forEach(control => control.addEventListener('input', () => store.setText({ title: titleInput.value, description: descriptionInput.value, cta: ctaInput.value, hashtags: hashtagsInput.value })));
  ctaSelect.addEventListener('change', () => { if (ctaSelect.value !== 'custom') { ctaInput.value = ctaSelect.value; store.setText({ cta: ctaInput.value }); } });
  formatSelect.addEventListener('change', () => store.setFormat(formatSelect.value, { width: Number(customWidth.value), height: Number(customHeight.value) }));
  [customWidth, customHeight].forEach(control => control.addEventListener('change', () => store.setFormat('custom', { width: Number(customWidth.value), height: Number(customHeight.value) })));
  showLogo.addEventListener('change', () => store.setLogoVisibility(showLogo.checked));
  [brandName, primaryColor, accentColor, fontSelect, phoneInput, whatsappInput, instagramInput, websiteInput].forEach(control => control.addEventListener('input', persistBrand));
  logoInput.addEventListener('change', async () => {
    const file = logoInput.files[0]; if (!file) return;
    const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
    store.setBrandKit({ logoUrl: dataUrl }); persistBrand();
  });
  generate.addEventListener('click', async () => { await renderPreview(); feedback.textContent = 'Imagen generada con la configuración actual.'; });
  download.addEventListener('click', async () => {
    feedback.textContent = 'Preparando descarga…';
    try {
      const output = await renderer.exportRenderedContent(canvas, store.getComposition(), mediaSource);
      const url = URL.createObjectURL(output.blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `contenido-${store.getState().templateId}.png`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      feedback.textContent = 'Imagen descargada. Revisa tu carpeta de descargas.';
    } catch (error) { feedback.textContent = error.message || 'No fue posible descargar la imagen.'; }
  });
  publishInstagram?.addEventListener('click', async () => {
    const composition = store.getComposition();
    if (!composition.readiness.isReady) { feedback.textContent = 'Completa el contenido requerido antes de publicar.'; return; }
    if (composition.format.width / composition.format.height > .7) { feedback.textContent = 'Selecciona Instagram Story o Reel para la prueba vertical.'; return; }
    if (!window.confirm(`¿Publicar esta imagen como Story de prueba en @${instagramConnection.username}? La publicación será visible en Instagram.`)) return;
    publishInstagram.disabled = true; feedback.textContent = 'Publicando Story de prueba mediante Meta…';
    try {
      await renderPreview(); const result = await publishInstagramStory(workshop.id, canvas.toDataURL('image/jpeg', .9));
      feedback.textContent = `Story publicada en @${result.username}. ID: ${result.mediaId} · ${new Date(result.publishedAt).toLocaleString('es-CL')}`;
    } catch (error) { feedback.textContent = error.message || 'No fue posible publicar la Story.'; }
    finally { publishInstagram.disabled = false; }
  });

  const element = h('section', { class: 'content-studio-page' },
    h('header', { class: 'studio-hero' }, h('div', {}, h('span', { class: 'section-kicker' }, 'Marketing'), h('h1', {}, 'Estudio de Contenido'), h('p', {}, 'Convierte el trabajo del taller en contenido listo para publicar, con una identidad consistente.')), h('span', { class: 'studio-beta' }, 'Beta')),
    h('div', { class: 'studio-layout' },
      h('aside', { class: 'studio-panel studio-content-panel' }, h('header', {}, h('span', {}, '01'), h('div', {}, h('h2', {}, 'Contenido'), h('p', {}, 'Selecciona el proyecto y ordena el material.'))),
        field('Proyecto asociado', projectSelect, 'Solo se precargan datos del proyecto; nunca datos del cliente.'),
        h('label', { class: 'studio-check' }, communeToggle, h('span', {}, 'Incluir comuna en el texto')),
        h('label', { class: 'studio-upload' }, upload, h('span', {}, '↑'), h('strong', {}, 'Subir fotos o videos'), h('small', {}, 'Videos de hasta 10 segundos por fragmento')),
        mediaList),
      h('main', { class: 'studio-panel studio-preview-panel' }, h('header', {}, h('span', {}, '02'), h('div', {}, h('h2', {}, 'Vista previa'), h('p', {}, 'La composición se actualiza en tiempo real.'))),
        h('div', { class: 'studio-preview-meta' }, readiness, dimensions), canvasFrame,
        h('div', { class: 'studio-export-actions' }, generate, download, publishInstagram), feedback,
        h('div', { class: 'studio-caption' }, h('span', {}, 'Texto para acompañar'), h('p', {}, 'El título, descripción, llamado a la acción y hashtags quedan listos para copiar junto con la imagen.'))),
      h('aside', { class: 'studio-panel studio-customize-panel' }, h('header', {}, h('span', {}, '03'), h('div', {}, h('h2', {}, 'Personalizar'), h('p', {}, 'Plantilla, formato, texto e identidad.'))),
        h('section', { class: 'studio-control-section' }, h('h3', {}, 'Plantilla'), templateGrid),
        h('section', { class: 'studio-control-section' }, h('h3', {}, 'Formato'), field('Destino', formatSelect), customFields),
        h('section', { class: 'studio-control-section' }, h('h3', {}, 'Mensaje'), field('Título', titleInput), field('Descripción', descriptionInput), field('Llamado a la acción', ctaSelect), field('Texto del CTA', ctaInput), field('Hashtags', hashtagsInput)),
        h('details', { class: 'studio-brand', open: true }, h('summary', {}, 'Kit de marca'), h('div', {},
          field('Nombre del taller', brandName), h('div', { class: 'studio-colors' }, field('Color principal', primaryColor), field('Acento', accentColor)), field('Tipografía', fontSelect),
          h('label', { class: 'studio-check' }, showLogo, h('span', {}, 'Mostrar logo')), field('Cambiar logo', logoInput), field('Teléfono', phoneInput), field('WhatsApp', whatsappInput), field('Instagram', instagramInput), field('Sitio web', websiteInput))))));

  if (initialProjectId && projects.some(item => item.id === initialProjectId)) { projectSelect.value = initialProjectId; selectProject(initialProjectId); }
  unsubscribe = store.subscribe(sync); sync(store.getState());
  return { element, getState: store.getState, render: renderPreview, hasUnsaved: () => false, dispose: () => { unsubscribe?.(); sources.forEach(source => source.url && URL.revokeObjectURL(source.url)); } };
}
