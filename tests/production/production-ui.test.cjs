const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');

const harness = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,">
<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/maestro/maestro.css">
<script src="/assets/designer/v2/schema.js"></script><script src="/assets/designer/v2/profiles.js"></script>
<script src="/assets/designer/v2/occupancy.js"></script><script src="/assets/designer/v2/validation.js"></script><script src="/assets/designer/v2/fixtures.js"></script>
<script src="/assets/production/schema.js"></script><script src="/assets/production/profiles.js"></script>
<script src="/assets/production/piece-generator.js"></script><script src="/assets/production/cut-optimizer.js"></script></head>
<body class="maestro maestro-authenticated"><main class="maestro-main"><section class="production-page"><header class="production-hero"><div><span class="section-kicker">Producción</span><h1>Despiece y Corte</h1><p>Validación visual derivada de CutPlan.</p></div><span class="production-readiness" data-ready="true">Listo para producción</span></header><div id="summary" class="production-optimization-summary"></div><div id="plans" class="cut-plan-groups"></div></section></main>
<script type="module">import { h } from '/maestro/js/ui.js'; import { cutPlanCard } from '/maestro/js/production/cut-plan-view.js';
const envelope=TALLER_DESIGNER_V2_FIXTURES.createClosetThreeBodies(); const generated=TALLER_PIECE_GENERATOR.generateClosetPieces(envelope); const material=envelope.configuration.materials.catalog[0];
const plans=TALLER_CUT_OPTIMIZER.optimizeByMaterial({pieces:generated.pieces,boardForGroup:(key,sample)=>TALLER_PRODUCTION_PROFILES.createBoardFromMaterial({...material,name:sample.materialName},sample.thicknessMm,undefined,'ui-'+key)});
const boardCount=plans.reduce((n,p)=>n+p.boardCount,0); summary.append(h('div',{},h('span',{},'Planchas'),h('strong',{},boardCount)),h('div',{},h('span',{},'Piezas'),h('strong',{},generated.totals.totalPieces)));
plans.forEach(plan=>plansEl.append(h('section',{class:'cut-plan-group'},h('header',{},h('h2',{},plan.board.materialName+' · '+plan.board.thicknessMm+' mm')),plan.boards.map(result=>cutPlanCard(plan,result)))));
window.productionReady={generated,plans};
</script></body></html>`;

(async () => {
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/__production-test.html') { response.setHeader('Content-Type', 'text/html; charset=utf-8'); return response.end(harness.replace('id="plans"', 'id="plansEl"')); }
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) return response.writeHead(403).end();
    fs.readFile(file, (error, data) => {
      if (error) return response.writeHead(404).end();
      response.setHeader('Content-Type', ({ '.js':'text/javascript', '.css':'text/css' })[path.extname(file)] || 'application/octet-stream'); response.end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    const errors = []; page.on('pageerror', error => errors.push(error.stack || error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/__production-test.html`);
    await page.waitForFunction(() => window.productionReady);
    assert.ok(await page.locator('.cut-board-svg').count() >= 2);
    assert.equal(await page.locator('.cut-piece').count(), 42);
    assert.ok(await page.locator('.cut-leftover').count() > 0);
    assert.equal((await page.evaluate(() => productionReady.plans.flatMap(plan => plan.unplacedPieces).length)), 0);
    for (const width of [1440, 1024, 768, 430, 390]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'scroll horizontal at ' + width);
    }
    assert.deepEqual(errors, []);
    console.log('PASS Producción UI: SVG desde CutPlan, piezas, sobrantes y responsive 1440/1024/768/430/390.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
