import { KNOWLEDGE, byIntent } from './knowledge.mjs';
import { FLOWS, contextualHint } from './flows.mjs';

export const normalize = (text) => String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

export function recognize(text, entries = KNOWLEDGE) {
  const normalized = normalize(text);
  if (!normalized) return { kind: 'unknown', candidates: [] };
  const padded = ` ${normalized} `;
  const scored = entries.map((entry) => {
    const phrases = [...new Set(entry.expressions.map(normalize))].filter((phrase) => padded.includes(` ${phrase} `));
    const words = [...new Set(entry.keywords.map(normalize))].filter((word) => padded.includes(` ${word} `));
    return { entry, score: phrases.reduce((sum, phrase) => sum + 3 + normalize(phrase).split(' ').length, 0) + words.length * 2 };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score);
  if (!scored.length) return { kind: 'unknown', candidates: [] };
  const top = scored[0];
  const second = scored[1];
  if (second && second.score >= top.score - 1 && second.entry.intent !== top.entry.intent) {
    return { kind: 'ambiguous', candidates: [top.entry.intent, second.entry.intent] };
  }
  return { kind: 'match', intent: top.entry.intent, entry: top.entry, candidates: [] };
}

const response = (text, actions = [], intent = null, status = 'answered') => ({ text, actions, intent, status });

export function createConversation() {
  let lastIntent = null;
  const history = [];
  const remember = (intent) => { lastIntent = intent; history.push(intent); if (history.length > 6) history.shift(); };
  const start = (action, context = {}) => {
    if (action === 'back') {
      if (history.length > 1) history.pop();
      lastIntent = history.at(-1) || null;
      return response('Volvamos al tema anterior. ¿Qué te gustaría revisar?', [lastIntent || 'kitchen', 'contact'], lastIntent);
    }
    if (action === 'cancel') { lastIntent = null; history.length = 0; return response('De acuerdo. Puedes preguntarme por otra cosa cuando quieras.', ['kitchen', 'closet', 'contact']); }
    if (action === 'change-topic') return response('Claro. Puedes cambiar de tema o escribir tu pregunta.', ['kitchen', 'closet', 'measure', 'estimate', 'contact']);
    const flow = FLOWS[action];
    const intent = flow?.intent || action;
    const entry = byIntent(intent);
    if (!entry) return response('No tengo una respuesta fiable para eso. Puedes hablar directamente con el taller.', ['contact'], null, 'unknown');
    remember(intent);
    if (intent === 'measure' && context.available && context.type === 'closet') {
      return response(`Para tu clóset, ingresa ancho, alto y profundidad. Ahora figuran ${context.width} × ${context.height} × ${context.depth} cm; confirma las medidas finales con el taller antes de fabricar.`, entry.followUp, intent);
    }
    if (intent === 'measure' && context.available && context.type === 'kitchen') {
      const leg = context.layout === 'l' && context.secondLeg ? ` y el segundo tramo de ${context.secondLeg} cm` : '';
      return response(`Para tu cocina, revisa el largo principal de ${context.width} cm${leg} y la profundidad de ${context.depth} cm. Las medidas finales se confirman antes de fabricar.`, entry.followUp, intent);
    }
    if (intent === 'estimate' && context.estimate) {
      return response(`Tu estimación actual es ${context.estimate}. Es un rango referencial, sujeto a medidas, materiales y diseño definitivos. Puedes solicitar una evaluación desde el cotizador.`, ['quote', 'contact'], intent);
    }
    if (intent === 'designer') return response(`${entry.answer} ${contextualHint(context)}`, entry.followUp, intent);
    return response(entry.answer, entry.followUp, intent, entry.validation === 'pending' ? 'needs-confirmation' : 'answered');
  };
  const send = (text, context = {}) => {
    const normalized = normalize(text);
    if (['volver', 'atras', 'anterior'].includes(normalized)) return start('back', context);
    if (['cancelar', 'salir'].includes(normalized)) return start('cancel', context);
    if (['cambiar de tema', 'otro tema'].includes(normalized)) return start('change-topic', context);
    if (lastIntent && ['y el alto', 'y el ancho', 'y la profundidad', 'como lo mido'].includes(normalized)) return start('measure', context);
    const result = recognize(text);
    if (result.kind === 'ambiguous') return response('Puedo ayudarte con ambos temas. ¿Cuál quieres revisar primero?', result.candidates, null, 'ambiguous');
    if (result.kind === 'unknown') return response('No tengo una respuesta confirmada para esa pregunta. Si quieres, te pongo en contacto con el taller.', ['contact', 'change-topic'], null, 'unknown');
    return start(result.intent, context);
  };
  return Object.freeze({ send, start, getContext: () => ({ lastIntent, history: [...history] }) });
}
