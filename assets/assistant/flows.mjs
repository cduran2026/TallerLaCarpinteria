/** Acciones guiadas: navegación y contacto reutilizan la página existente. */
export const SOCIAL_LINKS = Object.freeze({
  instagram: 'https://www.instagram.com/tallerlacarpinteria/',
  facebook: 'https://www.facebook.com/tlc.santiago.2025',
});

export const FLOWS = Object.freeze({
  kitchen: { intent: 'kitchen', action: 'quote-kitchen', label: 'Abrir cocina en 3D' },
  closet: { intent: 'closet', action: 'quote-closet', label: 'Abrir clóset en 3D' },
  other: { intent: 'other', action: 'contact-other', label: 'Consultar otro mueble' },
  measure: { intent: 'measure', action: 'show-designer', label: 'Ver las medidas' },
  'measure-change': { intent: 'measure-change', action: 'contact', label: 'Cambios de medidas' },
  finish: { intent: 'materials', action: 'show-finish', label: 'Ver terminaciones' },
  estimate: { intent: 'estimate', action: 'show-estimate', label: 'Ver mi estimación' },
  quote: { intent: 'estimate', action: 'show-estimate', label: 'Revisar cotización' },
  designer: { intent: 'designer', action: 'show-designer', label: 'Abrir diseñador 3D' },
  contact: { intent: 'contact', action: 'contact', label: 'Hablar con el taller' },
  gallery: { intent: 'gallery', action: 'gallery', label: 'Ver trabajos reales' },
  social: { intent: 'gallery', action: 'social-choice', label: 'Ver nuestros trabajos en redes' },
  instagram: { intent: 'gallery', action: 'open-instagram', label: 'Instagram' },
  facebook: { intent: 'gallery', action: 'open-facebook', label: 'Facebook' },
  questions: { intent: 'designer', action: 'none', label: 'Resolver dudas' },
  materials: { intent: 'materials', action: 'show-finish', label: 'Materiales y terminaciones' },
  timing: { intent: 'timing', action: 'contact', label: 'Plazos de fabricación' },
  coverage: { intent: 'coverage', action: 'contact', label: 'Zonas de atención' },
  installation: { intent: 'installation', action: 'contact', label: 'Instalación y garantía' },
  payment: { intent: 'payment', action: 'contact', label: 'Medios de pago' },
});

export function contextualHint(context) {
  if (!context?.available) return '¿En qué podemos ayudarte con tu proyecto?';
  if (context.section === 'general') return 'Puedo ayudarte a cotizar una cocina o un clóset y resolver dudas sobre el proceso.';
  if (context.type === 'kitchen') {
    const layout = context.layout === 'l' && context.secondLeg ? ` en L, con tramos de ${context.width} y ${context.secondLeg} cm` : ` recta de ${context.width} cm`;
    return `Estás configurando una cocina${layout}. ¿Necesitas ayuda con las medidas o la estimación?`;
  }
  return `Estás configurando un clóset de ${context.width} × ${context.height} × ${context.depth} cm. ¿Te ayudo con las medidas o la estimación?`;
}
