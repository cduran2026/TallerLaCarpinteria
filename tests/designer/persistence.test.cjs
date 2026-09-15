const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.env.PROJECT_ROOT || path.resolve(__dirname, '../..');
const artifacts = process.env.TEST_ARTIFACTS;
const key = 'taller:designer:persistence-test:v1';

async function main() {
  const server = http.createServer((req, res) => {
    const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
    if (!file.startsWith(path.resolve(root) + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404).end(); return; }
      res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream');
      res.end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    const base = `http://127.0.0.1:${server.address().port}/`;
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // Capture actual scene only in the test process, before the deferred viewer starts.
    await page.addInitScript(() => {
      const append = Node.prototype.appendChild;
      Node.prototype.appendChild = function (el) {
        if (el.src?.includes('assets/configurator.js')) {
          const Renderer = THREE.WebGLRenderer;
          THREE.WebGLRenderer = function (...args) {
            const renderer = new Renderer(...args), render = renderer.render;
            renderer.render = function (scene, camera) {
              window.testScene = scene;
              window.testFrame = (window.testFrame || 0) + 1;
              return render.call(renderer, scene, camera);
            };
            return renderer;
          };
        }
        return append.call(this, el);
      };
    });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('#designer-persistence-test').count(), 0);
    assert.equal(await page.evaluate(() => localStorage.length), 0);
    await page.goto(base + '?designerTest=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#designer-test-save');
    await page.locator('#furniture-canvas').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.testFrame && document.querySelector('#furniture-loading').hidden);
    await page.evaluate(() => { window.open = url => { window.testWhatsApp = url; }; });
    const initial = await page.evaluate(() => TALLER_CONFIGURATION.getState());
    const frame = () => page.evaluate(() => window.testFrame || 0);
    const settle = async before => {
      await page.locator('#furniture-canvas').scrollIntoViewIfNeeded();
      await page.waitForFunction(n => window.testFrame > n, before);
    };
    const button = async id => {
      const before = await frame();
      await page.locator('#' + id).evaluate(el => el.click());
      await settle(before);
    };
    const load = async state => {
      const before = await frame();
      await page.evaluate(value => TALLER_CONFIGURATION.loadState(value), state);
      await settle(before);
    };
    const snapshot = () => page.evaluate(() => {
      const group = testScene.children.find(child => child.type === 'Group');
      const meshes = [];
      group.updateMatrixWorld(true);
      group.traverse(obj => {
        if (!obj.isMesh) return;
        meshes.push({ geometry: obj.geometry.type, parameters: obj.geometry.parameters,
          matrix: obj.matrixWorld.toArray(), color: obj.material.color.getHex(),
          roughness: obj.material.roughness, metalness: obj.material.metalness });
      });
      const fields = [...document.querySelectorAll('.configurator-controls input')].map(el => ({
        id: el.id, name: el.name, value: el.value, checked: el.checked, disabled: el.disabled,
      }));
      const groups = [...document.querySelectorAll('.configurator-controls .fc-group[id]')].map(el => ({ id: el.id, hidden: el.hidden }));
      document.querySelector('#send-budget-whatsapp').click();
      return { state: TALLER_CONFIGURATION.getState(), fields, groups, meshes,
        outputs: [...document.querySelectorAll('.configurator-controls output')].map(el => el.textContent),
        readout: document.querySelector('#furniture-readout').textContent,
        price: document.querySelector('#price-range').textContent,
        summary: document.querySelector('#result-summary').textContent,
        whatsapp: window.testWhatsApp };
    });
    const cases = [
      ['recta-base', { upper: false, width: 180, depth: 50, color: '#f2ede4' }],
      ['recta-ambos', { width: 320, color: '#5c1a24', material: 'premium' }],
      ['l-ambos', { kitchenLayout: 'l', secondLeg: 230, width: 400, depth: 75 }],
      ['l-aereos', { kitchenLayout: 'l', secondLeg: 190, lower: false, color: '#1b2a4a', unit: 'mm' }],
      ['artefactos', { kitchenLayout: 'l', width: 280, secondLeg: 180, depth: 65, sink: true, oven: true, hood: true, material: 'premium', color: '#8a6a46' }],
      ['closet-completo', { type: 'closet', width: 250, height: 260, depth: 70, rod: true, shelves: 3, drawers: 2, color: '#cbb896', material: 'premium' }],
      ['closet-mm', { type: 'closet', width: 120, height: 200, depth: 45, rod: false, shelves: 0, drawers: 0, color: '#333936', unit: 'mm' }],
    ];
    for (const [name, overrides] of cases) {
      const wanted = { ...initial, ...overrides };
      await load(wanted);
      const before = await snapshot();
      assert.deepEqual(before.state, wanted);
      assert.ok(before.fields.some(f => f.name === 'fcType' && f.checked && f.value === wanted.type));
      assert.ok(before.fields.some(f => f.name === 'fcFinish' && f.checked && f.value === wanted.material));
      assert.ok(before.outputs.every(value => value.endsWith(wanted.unit)));
      await button('designer-test-save');
      const saved = await page.evaluate(k => localStorage.getItem(k), key);
      assert.deepEqual(JSON.parse(saved), { schemaVersion: 1, generatorVersion: '1.0.0', configuration: wanted });
      if (artifacts && name === 'artefactos') { fs.mkdirSync(artifacts, { recursive: true }); fs.writeFileSync(path.join(artifacts, 'example-design.json'), saved); }
      await button('designer-test-change');
      assert.notEqual(await page.evaluate(() => TALLER_CONFIGURATION.getState().type), wanted.type);
      await page.evaluate(() => { window.testNotifications = 0; window.testUnsubscribe = TALLER_CONFIGURATION.subscribe(() => window.testNotifications++); });
      await button('designer-test-load');
      assert.equal(await page.evaluate(() => window.testNotifications), 1);
      await page.evaluate(() => window.testUnsubscribe());
      assert.deepEqual(await snapshot(), before, name + ': state, DOM, price, WhatsApp and geometry');
      if (artifacts && ['artefactos', 'closet-completo'].includes(name)) await page.locator('#furniture-canvas').screenshot({ path: path.join(artifacts, name + '.png') });
      console.log('PASS round trip:', name);
    }
    // A real reload must recover the saved design too (not only in-memory state).
    const persisted = await page.evaluate(k => localStorage.getItem(k), key);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#designer-test-load');
    await button('designer-test-load');
    assert.deepEqual(await page.evaluate(() => TALLER_CONFIGURATION.getState()), JSON.parse(persisted).configuration);
    // Atomic failure, snapshot independence, unsubscribe, future/corrupt input.
    const contracts = await page.evaluate(() => {
      const api = TALLER_CONFIGURATION, codec = TALLER_SERIALIZATION;
      const before = JSON.stringify(api.getState());
      let calls = 0; const off = api.subscribe(copy => { calls++; copy.width = 0; });
      const detached = api.getState(); detached.width = 0;
      const invalid = [{ ...api.getState(), width: 999 }, { ...api.getState(), type: 'tv' },
        { ...api.getState(), material: 'other' }, { ...api.getState(), width: 125 },
        { ...api.getState(), shelves: 2 }, { ...api.getState(), sink: true }, {},
        { ...api.getState(), extra: true }];
      let rejected = 0;
      for (const item of invalid) { try { api.loadState(item); } catch { rejected++; } }
      const unchanged = JSON.stringify(api.getState()) === before && calls === 0;
      for (const text of ['{', JSON.stringify({ schemaVersion: 2, generatorVersion: '1.0.0', configuration: api.getState() }), JSON.stringify({ schemaVersion: 1, generatorVersion: '2.0.0', configuration: api.getState() })]) {
        try { api.loadState(codec.deserialize(text)); } catch { rejected++; }
      }
      api.loadState(api.getState()); off(); api.loadState(api.getState());
      return { rejected, unchanged, calls, isolated: JSON.stringify(api.getState()) === before };
    });
    assert.deepEqual(contracts, { rejected: 11, unchanged: true, calls: 1, isolated: true });
    await page.evaluate(k => localStorage.setItem(k, '{broken'), key);
    await button('designer-test-load');
    assert.match(await page.locator('#designer-persistence-test [role="status"]').innerText(), /No se pudo/);
    await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('Storage bloqueado'); }; });
    await button('designer-test-save');
    assert.match(await page.locator('#designer-persistence-test [role="status"]').innerText(), /Storage bloqueado/);
    await page.evaluate(() => TALLER_CONFIGURATION.reset());
    assert.equal(await page.evaluate(() => TALLER_CONFIGURATION.getState().unit), 'cm');
    assert.equal(await page.locator('#fc-width').inputValue(), '200');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    assert.deepEqual(errors, []);
    console.log('PASS reload, rejection without mutation, copies, unsubscribe, reset, storage failures, responsive');
    // Before lazy loading and with a real WebGL initialization failure.
    for (const noWebGL of [false, true]) {
      const other = await browser.newPage();
      if (noWebGL) await other.addInitScript(() => {
        const get = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (kind, ...rest) { return kind.includes('webgl') ? null : get.call(this, kind, ...rest); };
      });
      await other.goto(base, { waitUntil: 'domcontentloaded' });
      assert.equal(await other.evaluate(() => typeof window.THREE), 'undefined');
      const wanted = { ...initial, type: 'closet', width: 270, height: 250, drawers: 2, material: 'premium', color: '#5c1a24' };
      await other.evaluate(value => { const json = TALLER_SERIALIZATION.serialize(value); TALLER_CONFIGURATION.reset(); TALLER_CONFIGURATION.loadState(TALLER_SERIALIZATION.deserialize(json)); }, wanted);
      assert.deepEqual(await other.evaluate(() => TALLER_CONFIGURATION.getState()), wanted);
      assert.ok(await other.locator('#fc-closet-fields').isVisible());
      assert.equal(await other.locator('#fc-width-value').innerText(), '270 cm');
      assert.match(await other.locator('#price-range').innerText(), /\$/);
      await other.locator('#furniture-canvas').scrollIntoViewIfNeeded();
      if (noWebGL) await other.waitForFunction(() => document.querySelector('#furniture-loading').textContent.includes('no disponible'));
      else await other.waitForFunction(() => document.querySelector('#furniture-loading').hidden);
      assert.deepEqual(await other.evaluate(() => TALLER_CONFIGURATION.getState()), wanted);
      if (!noWebGL) assert.match(await other.locator('#furniture-readout').innerText(), /250 cm/);
      await other.locator('#fc-reset').evaluate(el => el.click());
      assert.equal(await other.locator('#fc-width').inputValue(), '200');
      await other.close();
    }
    console.log('PASS state before deferred viewer and with WebGL unavailable');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
