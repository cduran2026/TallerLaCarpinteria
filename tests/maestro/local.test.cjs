const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.env.PROJECT_ROOT || path.resolve(__dirname, '../..');
const artifacts = process.env.TEST_ARTIFACTS;
(async () => {
  const server = http.createServer((req, res) => {
    let url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (url.endsWith('/')) url += 'index.html';
    const file = path.resolve(root, '.' + url);
    if (!file.startsWith(path.resolve(root) + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (error, data) => {
      if (error) return res.writeHead(404).end();
      res.setHeader('Content-Type', ({ '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8' })[path.extname(file)] || 'application/octet-stream');
      res.end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const errors = [], badRoutes = [], remote = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.url().startsWith(origin) && r.status() >= 400) badRoutes.push(r.url()); });
    page.on('request', r => { if (/supabase|esm\.sh/.test(r.url()) && !r.url().startsWith(origin)) remote.push(r.url()); });
    await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('a[href="maestro/"]').count(), 2);
    for (const width of [320, 390, 768, 1050, 1100, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'public overflow at ' + width);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('.desktop-nav a[href="maestro/"]').click();
    await page.getByText('Conexión pendiente', { exact: true }).waitFor();
    assert.ok(await page.getByRole('button', { name: 'Ingresar', exact: true }).isDisabled());
    for (const hash of ['#/login','#/dashboard','#/clientes','#/proyectos/nuevo','#/proyectos/00000000-0000-4000-8000-000000000001','#/proyectos/00000000-0000-4000-8000-000000000001/disenos/nuevo']) {
      await page.goto(origin + '/maestro/' + hash, { waitUntil: 'domcontentloaded' });
      await page.getByText('Conexión pendiente', { exact: true }).waitFor();
      assert.ok(await page.locator('#app-nav').isHidden());
    }
    assert.deepEqual(remote, [], 'No SDK/Auth/data requests with absent configuration');
    for (const width of [320,390,768,1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'app overflow at ' + width);
    }
    if (artifacts) { fs.mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: path.join(artifacts, 'maestro-pending.png') }); }
    // Exercise the real shared controller/geometry WITHOUT inventing a backend/session.
    await page.evaluate(async () => {
      const { mountDesigner } = await import('/maestro/js/designer-bridge.js');
      const frame = document.createElement('iframe'); frame.id = 'test-designer'; frame.style.width = '100%';
      document.querySelector('#app').replaceChildren(frame);
      window.testAbort = new AbortController();
      window.testApi = await mountDesigner(frame, null, testAbort.signal);
    });
    await page.locator('#test-designer').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('#test-designer').contentDocument.querySelector('#furniture-loading').hidden);
    const wanted = await page.evaluate(() => ({ ...testApi.getState(), type:'closet', width:270, height:260, depth:70, drawers:2, material:'premium', color:'#5c1a24' }));
    await page.evaluate(value => testApi.loadState(value), wanted);
    assert.deepEqual(await page.evaluate(() => testApi.getState()), wanted);
    assert.equal(await page.frameLocator('#test-designer').locator('#fc-height').inputValue(), '260');
    assert.ok(await page.frameLocator('#test-designer').locator('#fc-closet-fields').isVisible());
    await page.waitForTimeout(250);
    assert.match(await page.frameLocator('#test-designer').locator('#furniture-readout').innerText(), /260 cm/);
    assert.equal(await page.frameLocator('#test-designer').locator('#price-range').count(), 0);
    const height = await page.locator('#test-designer').evaluate(el => el.getBoundingClientRect().height);
    await page.waitForTimeout(500);
    assert.equal(await page.locator('#test-designer').evaluate(el => el.getBoundingClientRect().height), height, 'stable iframe sizing');
    if (artifacts) await page.frameLocator('#test-designer').locator('#furniture-canvas').screenshot({ path: path.join(artifacts, 'maestro-shared-designer.png') });
    await page.evaluate(() => { testAbort.abort(); document.querySelector('#test-designer').remove(); });
    assert.deepEqual(errors, []); assert.deepEqual(badRoutes, []);
    console.log('PASS: static routes, missing-config guard, no Supabase calls, responsive and real shared designer.');
    console.log('NOT RUN: real Supabase Auth, migrations, RLS, remote save/recovery.');
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
