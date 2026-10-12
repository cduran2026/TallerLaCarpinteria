import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KNOWLEDGE, KNOWLEDGE_VERSION } from '../../assets/assistant/knowledge.mjs';
import { normalize, recognize, createConversation } from '../../assets/assistant/engine.mjs';
import { readDesignerContext } from '../../assets/assistant/context.mjs';

test('catálogo versionado con respuestas verificables y estados pendientes', () => {
  assert.equal(KNOWLEDGE_VERSION, 1);
  assert.ok(KNOWLEDGE.length >= 10);
  assert.equal(new Set(KNOWLEDGE.map(item => item.id)).size, KNOWLEDGE.length);
  for (const item of KNOWLEDGE) {
    assert.ok(item.answer && item.expressions.length && item.followUp.length);
    assert.ok(['validated', 'pending'].includes(item.validation));
  }
  assert.equal(KNOWLEDGE.find(item => item.intent === 'payment').validation, 'pending');
});

test('acentos, sinónimos y expresiones distintas resuelven intención', () => {
  assert.equal(normalize(' ¿CÓMO mido mi clóset? '), 'como mido mi closet');
  assert.equal(recognize('QUIERO UN ROPERO').intent, 'closet');
  assert.equal(recognize('¿Cuánto demora?').intent, 'timing');
  assert.equal(recognize('formas de pago').intent, 'payment');
  assert.equal(recognize('Las medidas cambiaron durante la obra').intent, 'measure-change');
  assert.equal(recognize('cocina y clóset').kind, 'ambiguous');
  assert.equal(recognize('pneumotórax cuántico').kind, 'unknown');
});

test('flujo conversa con contexto, corrige tema y no inventa condiciones', () => {
  const chat = createConversation();
  const state = Object.freeze({ available: true, type: 'closet', width: 240, height: 220, depth: 60, estimate: '$500.000 a $700.000' });
  assert.match(chat.send('¿Cómo mido?', state).text, /240 × 220 × 60 cm/);
  assert.match(chat.send('¿Y el alto?', state).text, /alto/);
  assert.match(chat.send('¿Cuánto cuesta?', state).text, /\$500.000 a \$700.000/);
  assert.equal(chat.send('¿Aceptan tarjetas?', state).status, 'unknown');
  assert.equal(chat.send('¿Cuánto demora?', state).status, 'needs-confirmation');
  assert.equal(chat.send('volver', state).intent, 'estimate');
  assert.equal(chat.send('cambiar de tema', state).actions.includes('kitchen'), true);
  assert.equal(chat.send('cancelar', state).intent, null);
  assert.deepEqual(chat.getContext().history, []);
  assert.equal(state.width, 240);
});

test('adaptador lee estado del diseñador sin mutarlo ni acceder a Three.js', () => {
  const original = Object.freeze({ type: 'kitchen', kitchenLayout: 'l', width: 280, secondLeg: 180, depth: 60, material: 'standard', color: 'roble', unit: 'cm' });
  const nodes = {
    '#cotizador': { getBoundingClientRect: () => ({ top: 9999, bottom: 10000 }) },
    '#price-range .price-main': { textContent: '$794.788 a $1.011.548' },
    '#fc-second-leg-group': { hidden: false },
    '#fc-closet-height-group': { hidden: true },
    '#fc-sink': { disabled: false }, '#fc-oven': { disabled: false }, '#fc-hood': { disabled: false },
  };
  const root = { activeElement: null, querySelector: selector => nodes[selector] || null, querySelectorAll: () => [] };
  const context = readDesignerContext(root, { getState: () => original });
  assert.equal(context.type, 'kitchen');
  assert.equal(context.layout, 'l');
  assert.equal(context.secondLeg, 180);
  assert.equal(context.height, null);
  assert.equal(context.estimate, '$794.788 a $1.011.548');
  assert.equal(context.isFormValid, true);
  assert.equal(original.width, 280);
});
