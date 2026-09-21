const assert = require('node:assert/strict');
const test = require('node:test');
const profiles = require('../../assets/content-studio/profiles.js');
const templates = require('../../assets/content-studio/templates.js');
const { createContentStore } = require('../../assets/content-studio/store.js');
const { createContentAssistant } = require('../../assets/content-studio/content-assistant.js');

test('centraliza formatos de publicación y valida formato personalizado', () => {
  assert.deepEqual(profiles.FORMAT_PROFILES.map(item => item.id), ['instagram-feed', 'instagram-story', 'instagram-reel', 'facebook', 'custom']);
  assert.deepEqual(profiles.getFormat('instagram-story').width, 1080);
  assert.deepEqual(profiles.getFormat('custom', { width: 900, height: 1200 }), expectFormat(900, 1200));
  assert.throws(() => profiles.getFormat('custom', { width: 100, height: 1200 }), /320/);
});

function expectFormat(width, height) {
  return { id: 'custom', name: 'Formato personalizado', width, height, aspect: `${width}:${height}`, destination: 'custom' };
}

test('declara cinco plantillas dinámicas sin identidad fija de La Carpintería', () => {
  assert.equal(templates.TEMPLATES.length, 5);
  for (const template of templates.TEMPLATES) {
    assert.ok(template.templateId && template.name && template.category && template.layout.type);
    assert.ok(Array.isArray(template.mediaSlots) && Array.isArray(template.textSlots));
  }
  assert.doesNotMatch(JSON.stringify(templates.TEMPLATES), /La Carpintería/i);
});

test('el store mantiene composición, selección, proyecto y kit de marca independientes del DOM', () => {
  const store = createContentStore({ workshop: { name: 'Taller Prueba' } });
  const events = []; const off = store.subscribe((state, meta) => events.push(meta.operation));
  const before = store.addMedia({ id: 'before', kind: 'image', name: 'Antes', stage: 'before' });
  const after = store.addMedia({ id: 'after', kind: 'image', name: 'Después', stage: 'after' });
  store.selectMedia(before, true); store.selectMedia(after, true); store.setTemplate('before-after'); store.setProject('project-1');
  assert.equal(store.getComposition().readiness.isReady, true);
  assert.equal(store.getState().brandKit.workshopName, 'Taller Prueba');
  assert.equal(store.getState().projectId, 'project-1');
  assert.ok(events.includes('setTemplate')); off();
});

test('un fragmento de video nunca supera diez segundos ni su duración real', () => {
  const store = createContentStore();
  store.addMedia({ id: 'clip', kind: 'video', name: 'Proceso', durationSeconds: 12 });
  store.setVideoTrim('clip', 1, 12);
  let clip = store.getState().media[0];
  assert.equal(clip.trimEndSeconds - clip.trimStartSeconds, 10);
  store.setVideoTrim('clip', 8, 12);
  clip = store.getState().media[0];
  assert.equal(clip.trimEndSeconds, 12);
});

test('Antes/Después informa que faltan dos medios y queda listo al seleccionarlos', () => {
  const store = createContentStore(); store.setTemplate('before-after');
  assert.equal(store.getComposition().readiness.isReady, false);
  assert.deepEqual(store.getComposition().readiness.missingSlots, ['before', 'after']);
  ['a', 'b'].forEach(id => { store.addMedia({ id, kind: 'image' }); store.selectMedia(id, true); });
  assert.equal(store.getComposition().readiness.isReady, true);
});

test('ContentAssistant queda en modo manual mientras no exista un proveedor', async () => {
  const assistant = createContentAssistant();
  assert.equal(assistant.mode, 'manual'); assert.equal(assistant.isAvailable, false);
  await assert.rejects(() => assistant.suggest({ title: 'Proyecto' }), /todavía no está configurado/);
});
