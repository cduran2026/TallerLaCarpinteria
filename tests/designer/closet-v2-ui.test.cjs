const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');

const harness = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,">
<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/maestro/maestro.css">
<script src="/assets/designer/v2/schema.js"></script><script src="/assets/designer/v2/profiles.js"></script>
<script src="/assets/designer/v2/occupancy.js"></script><script src="/assets/designer/v2/validation.js"></script>
<script src="/assets/designer/v2/store.js"></script><script src="/assets/designer/v2/fixtures.js"></script></head>
<body class="maestro maestro-authenticated"><main class="maestro-main"><div id="host" class="closet-v2-host"></div></main>
<script type="module">import { mountClosetV2 } from '/maestro/js/designer-v2/closet-editor.js';
window.abort = new AbortController(); window.editorReady = mountClosetV2(document.querySelector('#host'), null, abort.signal)
  .then(api => window.editorApi = api).catch(error => window.editorError = error.stack || error.message);</script></body></html>`;

(async () => {
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/__closet-v2-test.html') { response.setHeader('Content-Type', 'text/html; charset=utf-8'); return response.end(harness); }
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) return response.writeHead(403).end();
    fs.readFile(file, (error, data) => {
      if (error) return response.writeHead(404).end();
      response.setHeader('Content-Type', ({ '.js':'text/javascript', '.css':'text/css' })[path.extname(file)] || 'application/octet-stream');
      response.end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true,
      ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    const errors = []; page.on('pageerror', error => errors.push(error.stack || error.message));
    const cdp = await page.context().newCDPSession(page);
    cdp.on('Runtime.exceptionThrown', event => errors.push(JSON.stringify(event.exceptionDetails)));
    await cdp.send('Runtime.enable');
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => errors.push('REQUEST ' + request.url() + ': ' + request.failure()?.errorText));
    await page.goto(`http://127.0.0.1:${server.address().port}/__closet-v2-test.html`);
    const importErrors = await page.evaluate(async () => {
      const result = {};
      for (const url of ['/maestro/js/ui.js', '/maestro/js/designer-v2/closet-viewer.js',
        '/maestro/js/designer-v2/closet-editor.js', '/maestro/js/views/design-workspace.js']) {
        try { await import(url); result[url] = null; }
        catch (error) { result[url] = error.stack || error.message; }
      }
      return result;
    });
    if (importErrors['/maestro/js/designer-v2/closet-editor.js']) {
      importErrors.parser = await page.evaluate(async () => {
        let source = await (await fetch('/maestro/js/designer-v2/closet-editor.js')).text();
        source = source.replace(/^import .*$/gm, '').replace('export async function', 'async function');
        try { new Function(source); return null; } catch (error) { return error.stack || error.message; }
      });
    }
    if (Object.values(importErrors).some(Boolean)) console.error('IMPORT_DIAGNOSTICS', importErrors, errors);
    assert.deepEqual(importErrors, Object.fromEntries(Object.keys(importErrors).map(key => [key, null])));
    await page.waitForFunction(() => window.editorApi || window.editorError, null, { timeout: 5000 }).catch(async error => {
      throw new Error(error.message + '\nDiagnostics: ' + JSON.stringify(await page.evaluate(() => ({
        ready: typeof window.editorReady, editorError: window.editorError, host: document.querySelector('#host')?.innerText,
        globals: Object.keys(window).filter(key => key.startsWith('TALLER_DESIGNER_V2')),
      }))) + '\nEvents: ' + JSON.stringify(errors));
    });
    assert.equal(await page.evaluate(() => window.editorError || null), null);
    assert.equal(await page.locator('.closet-module-item').count(), 3);
    assert.equal(await page.locator('.occupancy-track').getAttribute('data-status'), 'exact');
    assert.equal(await page.locator('.closet-viewer-canvas').count(), 1);

    await page.getByRole('button', { name: /Agregar cuerpo/ }).click();
    assert.equal(await page.locator('.closet-module-item').count(), 4);
    assert.equal(await page.locator('.occupancy-track').getAttribute('data-status'), 'excess');
    assert.equal((await page.evaluate(() => editorApi.getStatus())).isValid, false);
    await page.getByRole('button', { name: 'Eliminar' }).click();
    assert.equal(await page.locator('.occupancy-track').getAttribute('data-status'), 'exact');

    await page.getByRole('button', { name: 'Duplicar' }).click();
    assert.equal(await page.locator('.closet-module-item').count(), 4);
    await page.getByRole('button', { name: 'Eliminar' }).click();
    assert.equal(await page.locator('.closet-module-item').count(), 3);
    await page.getByLabel('Bloquear ancho').check();
    assert.equal(await page.getByLabel('Ancho del cuerpo en milímetros').isDisabled(), true);
    await page.getByLabel('Bloquear ancho').uncheck();
    await page.getByLabel('Ancho del cuerpo en milímetros').fill('550');
    await page.getByLabel('Ancho del cuerpo en milímetros').press('Enter');
    assert.equal(await page.locator('.occupancy-track').getAttribute('data-status'), 'deficit');
    assert.equal((await page.evaluate(() => editorApi.getStatus())).isComplete, false);
    await page.getByLabel('Ancho del cuerpo en milímetros').fill('600');
    await page.getByLabel('Ancho del cuerpo en milímetros').press('Enter');

    const shelves = page.getByLabel('Activar Repisas');
    if (!(await shelves.isChecked())) await shelves.check();
    await page.getByLabel('Modo de Repisas').selectOption('manual');
    await page.getByLabel('Cantidad de Repisas').fill('2');
    await page.getByLabel('Cantidad de Repisas').press('Enter');
    const saved = await page.evaluate(() => editorApi.getState());
    assert.equal(saved.configuration.modules.find(module => module.id === saved.configuration.modules[0].id)
      .components.find(component => component.type === 'shelfSet').quantity.resolved, 2);
    await page.evaluate(async state => {
      editorApi.dispose(); document.querySelector('#host').replaceChildren();
      const { mountClosetV2 } = await import('/maestro/js/designer-v2/closet-editor.js');
      window.editorApi = await mountClosetV2(document.querySelector('#host'), state, new AbortController().signal);
    }, saved);
    assert.deepEqual(await page.evaluate(() => editorApi.getState()), saved);

    for (const width of [1440, 1024, 768, 430, 390]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'overflow at ' + width);
    }
    assert.deepEqual(errors, []);
    console.log('PASS Clóset V2 UI: modules, occupancy, lock, components, 3D, round-trip and responsive.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
