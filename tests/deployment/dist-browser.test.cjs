const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const dist = path.resolve(__dirname, '../../dist');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

(async () => {
  const server = http.createServer((request, response) => {
    const requested = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = requested.endsWith('/') ? requested + 'index.html' : requested;
    const file = path.resolve(dist, '.' + relative);
    if (!file.startsWith(dist + path.sep)) return response.writeHead(403).end();
    fs.readFile(file, (error, contents) => {
      if (error) return response.writeHead(404).end();
      response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
      response.end(contents);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    const page = await browser.newPage();
    const missing = [];
    page.on('response', response => {
      if (response.url().startsWith(origin) && response.status() >= 400) missing.push(response.url());
    });
    await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.TALLER_CONFIGURATION));
    assert.ok(await page.locator('#furniture-canvas').count());
    await page.locator('#furniture-canvas').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => Boolean(window.THREE && document.querySelector('#furniture-readout')?.textContent));
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `scroll público ${width}`);
    }
    const state = await page.evaluate(() => {
      const original = TALLER_CONFIGURATION.getState();
      TALLER_CONFIGURATION.loadState({ ...original, type: 'closet', width: 240, height: 240 });
      const loaded = TALLER_CONFIGURATION.getState();
      TALLER_CONFIGURATION.loadState(original);
      return loaded;
    });
    assert.equal(state.type, 'closet');
    assert.equal(state.width, 240);
    await page.goto(origin + '/maestro/#/login', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.TALLER_CONTENT_RENDERER && window.TALLER_DESIGNER_V2_STORE));
    const studio = await page.evaluate(async () => {
      const store = TALLER_CONTENT_STORE.createContentStore();
      const canvas = document.createElement('canvas');
      const result = await TALLER_CONTENT_RENDERER.renderComposition(canvas, store.getComposition());
      return { width: result.width, height: result.height, templateId: result.templateId };
    });
    assert.deepEqual(studio, { width: 1080, height: 1080, templateId: 'finished-work' });
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `scroll Maestro ${width}`);
    }
    assert.deepEqual(missing, [], 'Recursos locales faltantes');
    console.log('PASS: dist servido, web, Three.js/formulario V1, Core V2, render Estudio 1:1 y responsive.');
    console.log('PENDIENTE: vistas autenticadas y guardado real requieren sesión/proyecto de pruebas.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
