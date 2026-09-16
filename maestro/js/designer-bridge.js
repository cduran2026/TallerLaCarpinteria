// Reuse the authoritative public controls and Fase 1 scripts, without duplicating them.
// One iframe = one existing controller/renderer lifecycle. Removing it releases the viewer.
export async function mountDesigner(frame, configuration, signal) {
  const root = new URL('../../', import.meta.url);
  const response = await fetch(new URL('index.html', root), { signal });
  if (!response.ok) throw new Error('No se pudo cargar el formulario del diseñador existente.');
  const source = new DOMParser().parseFromString(await response.text(), 'text/html');
  const form = source.querySelector('.configurator-layout');
  if (!form) throw new Error('El formulario público del diseñador no está disponible.');
  form.querySelector('.calculator-result-card')?.remove();
  form.querySelector('#customer-name')?.closest('.fc-group')?.remove();
  const scripts = ['assets/designer/serialization.js', 'assets/designer/controller.js'];
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('El diseñador tardó demasiado en cargar. Recarga la página.')), 20000);
    frame.addEventListener('load', () => { clearTimeout(timer); resolve(); }, { once: true });
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Cancelado', 'AbortError')); }, { once: true });
  });
  frame.srcdoc = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${root.href}">
    <link rel="stylesheet" href="styles.css"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Playfair+Display:ital,wght@1,600;1,700&display=swap" rel="stylesheet">
    <style>body{padding:12px 0;margin:0}.configurator-layout{padding:0 4px}</style>
    ${scripts.map(src => `<script src="${src}" defer><\/script>`).join('')}</head><body>${form.outerHTML}</body></html>`;
  await ready;
  if (signal.aborted) throw new DOMException('Cancelado', 'AbortError');
  const api = frame.contentWindow.TALLER_CONFIGURATION;
  if (!api) throw new Error('No se pudo inicializar el controlador de Fase 1.');
  if (configuration) api.loadState(configuration);
  // The existing viewer must start AFTER DOMContentLoaded initializes the controller.
  const loadScript = src => new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Cancelado', 'AbortError')); return; }
    const script = frame.contentDocument.createElement('script');
    script.src = new URL(src, root).href; script.onload = resolve; script.onerror = reject;
    frame.contentDocument.body.appendChild(script);
  });
  loadScript('assets/vendor/three.min.js').then(() => loadScript('assets/vendor/OrbitControls.js'))
    .then(() => loadScript('assets/configurator.js')).catch(() => {
      if (!signal.aborted) frame.contentDocument.querySelector('#furniture-loading').textContent =
        'Vista 3D no disponible. Puedes configurar y guardar el diseño.';
    });
  const resize = new ResizeObserver(() => { frame.style.height = `${Math.ceil(frame.contentDocument.querySelector('.configurator-layout').getBoundingClientRect().height) + 24}px`; });
  resize.observe(frame.contentDocument.querySelector('.configurator-layout'));
  signal.addEventListener('abort', () => resize.disconnect(), { once: true });
  return api;
}
