/** Adaptador de solo lectura al diseñador V1 y al resultado ya calculado. */
export function readDesignerContext(root = document, configuration = globalThis.TALLER_CONFIGURATION) {
  const state = configuration?.getState?.();
  if (!state) return Object.freeze({ available: false, section: 'general' });
  const active = root.activeElement;
  const designer = root.querySelector('#cotizador');
  const inView = designer?.getBoundingClientRect && typeof innerHeight === 'number'
    && designer.getBoundingClientRect().top < innerHeight
    && designer.getBoundingClientRect().bottom > 0;
  const section = active?.closest?.('#cotizador')
    ? (active.closest('.configurator-controls') ? 'controles' : 'resultado')
    : (inView ? 'cotizador' : 'general');
  const range = root.querySelector('#price-range .price-main')?.textContent?.trim() || '';
  const estimate = range.includes('$') ? range.replace(/\s+/g, ' ') : null;
  const selected = root.querySelector('input[name="fcFinish"]:checked')?.nextElementSibling?.textContent?.trim() || '';
  const controls = {
    secondLeg: !root.querySelector('#fc-second-leg-group')?.hidden,
    height: !root.querySelector('#fc-closet-height-group')?.hidden,
    sink: !root.querySelector('#fc-sink')?.disabled,
    oven: !root.querySelector('#fc-oven')?.disabled,
    hood: !root.querySelector('#fc-hood')?.disabled,
  };
  const invalidFields = [...root.querySelectorAll('#cotizador input:invalid')].map((field) => field.id).filter(Boolean);
  return Object.freeze({
    available: true,
    type: state.type,
    layout: state.type === 'kitchen' ? state.kitchenLayout : null,
    width: state.width,
    secondLeg: controls.secondLeg ? state.secondLeg : null,
    height: controls.height ? state.height : null,
    depth: state.depth,
    finish: selected || state.material,
    color: state.color,
    unit: state.unit,
    section,
    enabled: Object.freeze(controls),
    invalidFields: Object.freeze(invalidFields),
    isFormValid: invalidFields.length === 0,
    estimate,
  });
}
