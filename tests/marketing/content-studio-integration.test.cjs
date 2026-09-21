const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Modo Maestro carga las cuatro capas del estudio y expone una ruta dedicada', () => {
  const html = read('maestro/index.html'); const app = read('maestro/js/app.js');
  for (const file of ['profiles.js', 'templates.js', 'store.js', 'renderer.js', 'content-assistant.js']) assert.match(html, new RegExp(`content-studio/${file.replace('.', '\\.')}`));
  assert.match(app, /path === '\/marketing\/estudio'/);
  assert.match(html, /Estudio de Contenido/);
});

test('el lanzamiento desde proyecto transmite solo el identificador del proyecto', () => {
  const detail = read('maestro/js/views/project-detail.js');
  assert.match(detail, /marketing\/estudio\?project=\$\{id\}/);
  const studio = read('maestro/js/marketing/content-studio.js');
  assert.doesNotMatch(studio, /client_snapshot|client\.name|client\.phone/);
});

test('la vista usa repositorios reales y los medios temporales permanecen en memoria', () => {
  const view = read('maestro/js/views/content-studio.js'); const studio = read('maestro/js/marketing/content-studio.js');
  assert.match(view, /listProjects/); assert.match(view, /listDesigns/);
  assert.match(studio, /URL\.createObjectURL/);
  assert.doesNotMatch(studio, /localStorage\.setItem\([^,]*(media|image|video)/i);
});
