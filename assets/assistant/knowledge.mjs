/** Catálogo comercial V1. Las respuestas pendientes evitan afirmar condiciones no confirmadas. */
export const KNOWLEDGE_VERSION = 1;
export const KNOWLEDGE = Object.freeze([
  {
    id: 'quote-kitchen', category: 'cotizacion', intent: 'kitchen',
    expressions: ['cotizar cocina', 'presupuesto cocina', 'quiero una cocina', 'diseñar cocina'],
    keywords: ['cocina', 'cocinas'],
    answer: 'Podemos partir con tu cocina en el cotizador 3D. Ajusta el largo, la distribución, los módulos y la terminación; el valor mostrado es referencial.',
    followUp: ['measure', 'designer', 'quote'], validation: 'validated',
  },
  {
    id: 'quote-closet', category: 'cotizacion', intent: 'closet',
    expressions: ['cotizar closet', 'cotizar clóset', 'presupuesto closet', 'quiero un closet', 'walk in closet'],
    keywords: ['closet', 'closets', 'clóset', 'clósets', 'ropero'],
    answer: 'Puedes configurar tu clóset en 3D con ancho, alto, profundidad y elementos interiores. El resultado sirve como primera estimación.',
    followUp: ['measure', 'designer', 'quote'], validation: 'validated',
  },
  {
    id: 'quote-other', category: 'cotizacion', intent: 'other',
    expressions: ['cotizar otro mueble', 'mueble tv', 'escritorio a medida', 'mueble de baño', 'otro mueble'],
    keywords: ['escritorio', 'librero', 'mueble tv', 'baño', 'otros muebles'],
    answer: 'El cotizador actual cubre cocinas y clósets. Para otro mueble, conversemos directamente sobre tu idea y medidas por WhatsApp.',
    followUp: ['contact', 'measure'], validation: 'validated',
  },
  {
    id: 'measure', category: 'diseno', intent: 'measure',
    expressions: ['como medir', 'como mido mi cocina', 'como mido', 'ayuda con medidas', 'que medidas necesito', 'medir el espacio', 'cuanto mide'],
    keywords: ['medidas', 'medir', 'mido', 'ancho', 'alto', 'profundidad', 'largo'],
    answer: 'Para comenzar, mide el ancho o largo disponible y la profundidad del espacio. En un clóset también puedes ingresar el alto. Las medidas definitivas se confirman antes de fabricar.',
    followUp: ['designer', 'contact'], validation: 'validated',
  },
  {
    id: 'timing', category: 'proceso', intent: 'timing',
    expressions: ['cuanto demora', 'plazo de fabricacion', 'tiempo de entrega', 'cuando estará listo'],
    keywords: ['demora', 'plazo', 'tiempo', 'entrega'],
    answer: 'El plazo depende del proyecto y debe confirmarlo el taller tras revisar el diseño y las condiciones de instalación. Podemos ayudarte a consultarlo.',
    followUp: ['contact'], validation: 'pending',
  },
  {
    id: 'measure-change', category: 'diseno', intent: 'measure-change',
    expressions: ['cambian las medidas', 'medidas cambian durante la obra', 'medidas cambiaron', 'cambio de medidas'],
    keywords: ['remedición', 'remedir'],
    answer: 'Si cambian las medidas del espacio durante la obra, avisa al taller antes de fabricar. Se deben confirmar las medidas finales y coordinar cualquier ajuste del diseño.',
    followUp: ['measure', 'contact'], validation: 'validated',
  },
  {
    id: 'materials', category: 'diseno', intent: 'materials',
    expressions: ['materiales disponibles', 'terminaciones disponibles', 'que material usan', 'colores y terminaciones'],
    keywords: ['material', 'materiales', 'terminacion', 'terminaciones', 'melamina', 'color'],
    answer: 'En el cotizador puedes comparar terminación Estándar o Premium y elegir un color de frentes. El material exacto se define y confirma con el taller para cada proyecto.',
    followUp: ['finish', 'contact'], validation: 'validated',
  },
  {
    id: 'installation', category: 'proceso', intent: 'installation',
    expressions: ['incluye instalacion', 'hacen la instalacion', 'tienen garantia', 'garantia del mueble'],
    keywords: ['instalacion', 'instalar', 'garantia', 'retiro'],
    answer: 'El taller coordina fabricación e instalación. Consulta directamente las condiciones de garantía aplicables a tu proyecto antes de aprobarlo.',
    followUp: ['contact'], validation: 'pending',
  },
  {
    id: 'payment', category: 'proceso', intent: 'payment',
    expressions: ['como se paga', 'medios de pago', 'formas de pago', 'cuotas o anticipo'],
    keywords: ['pago', 'pagar', 'cuotas', 'anticipo', 'transferencia'],
    answer: 'Las condiciones y medios de pago deben confirmarse directamente con el taller según el proyecto. Te ayudamos a contactarlo.',
    followUp: ['contact'], validation: 'pending',
  },
  {
    id: 'coverage', category: 'contacto', intent: 'coverage',
    expressions: ['donde trabajan', 'zonas de cobertura', 'atienden mi comuna', 'trabajan en santiago'],
    keywords: ['zona', 'comuna', 'cobertura', 'santiago', 'region'],
    answer: 'El taller atiende consultas en Santiago y alrededores. Indícanos tu comuna por WhatsApp para confirmar disponibilidad y coordinación.',
    followUp: ['contact'], validation: 'pending',
  },
  {
    id: 'designer', category: 'diseno', intent: 'designer',
    expressions: ['ayuda con el diseñador', 'como usar el 3d', 'usar el cotizador', 'como funciona el configurador'],
    keywords: ['diseñador', 'configurador', 'visualizador', '3d', 'cotizador'],
    answer: 'Elige Cocina o Clóset, ajusta las medidas, selecciona opciones y observa el modelo 3D. El rango que aparece es una estimación referencial.',
    followUp: ['measure', 'estimate', 'quote'], validation: 'validated',
  },
  {
    id: 'estimate', category: 'cotizacion', intent: 'estimate',
    expressions: ['precio final', 'valor referencial', 'entender estimacion', 'cuanto cuesta', 'es el precio definitivo'],
    keywords: ['precio', 'valor', 'estimacion', 'presupuesto', 'costo'],
    answer: 'El cotizador muestra un rango referencial. El valor definitivo se confirma después de revisar medidas, diseño, materiales y condiciones reales en terreno.',
    followUp: ['quote', 'contact'], validation: 'validated',
  },
  {
    id: 'contact', category: 'contacto', intent: 'contact',
    expressions: ['hablar con el taller', 'contactar a johan', 'hablar por whatsapp', 'quiero hablar con alguien'],
    keywords: ['whatsapp', 'contacto', 'contactar', 'hablar'],
    answer: 'Puedes hablar directamente con Taller La Carpintería por WhatsApp. Si ya configuraste un proyecto, el botón del cotizador incluirá sus datos en el mensaje.',
    followUp: ['contact', 'quote'], validation: 'validated',
  },
  {
    id: 'gallery', category: 'inspiracion', intent: 'gallery',
    expressions: ['ver trabajos', 'trabajos realizados', 'ver proyectos', 'galeria de fotos'],
    keywords: ['trabajos', 'proyectos', 'galeria', 'fotos'],
    answer: 'En la galería puedes ver trabajos reales del taller y elegir uno como referencia para comenzar a cotizar.',
    followUp: ['gallery', 'kitchen', 'closet'], validation: 'validated',
  },
]);

export const byIntent = (intent) => KNOWLEDGE.find((entry) => entry.intent === intent);
