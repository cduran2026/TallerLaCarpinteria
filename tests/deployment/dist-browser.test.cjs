const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const dist = path.resolve(__dirname, '../../dist');
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
};
const luminance = color => {
  const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(channel => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (foreground, background) => {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

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
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const missing = [];
    const errors = [];
    page.on('response', response => {
      if (response.url().startsWith(origin) && response.status() >= 400) missing.push(response.status() + ' ' + response.url());
    });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.__openedLinks = [];
      window.open = (url) => { window.__openedLinks.push(String(url)); return null; };
    });
    await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('a[href^="maestro/"]').count(), 0);
    assert.equal(await page.locator('.project-card').count(), 3);
    assert.equal(await page.locator('.hero-project-card').count(), 5, 'Tres proyectos reales y dos tarjetas para el bucle');
    assert.equal(await page.locator('.hero-showcase-count').innerText(), '01 / 03');
    assert.equal(await page.locator('.hero-showcase-progress span').count(), 3);
    assert.equal(await page.locator('.hero-showcase-progress span.active').count(), 1);
    assert.equal(await page.locator('.hero-project-card[aria-hidden="false"] h2').innerText(), 'Cocina a medida');
    assert.equal(await page.evaluate(() => {
      const viewport = document.querySelector('.hero-showcase-viewport').getBoundingClientRect();
      const next = document.querySelectorAll('.hero-project-card')[2].getBoundingClientRect();
      return next.left < viewport.right && next.right > viewport.right;
    }), true, 'El proyecto siguiente asoma en escritorio');
    await page.locator('.hero-showcase').hover();
    const nextProject = page.getByRole('button', { name: 'Proyecto siguiente' });
    for (const [count, title] of [['02 / 03', 'Clóset a medida'], ['03 / 03', 'Detalles de cocina'], ['01 / 03', 'Cocina a medida']]) {
      await nextProject.click();
      await page.waitForTimeout(550);
      assert.equal(await page.locator('.hero-showcase-count').innerText(), count);
      assert.equal(await page.locator('.hero-project-card[aria-hidden="false"] h2').innerText(), title);
    }
    await page.getByRole('button', { name: 'Proyecto anterior' }).click();
    await page.waitForTimeout(550);
    assert.equal(await page.locator('.hero-showcase-count').innerText(), '03 / 03');
    await page.locator('.hero-project-card[aria-hidden="false"] a').click();
    assert.equal(new URL(page.url()).hash, '#proyecto-detalles-de-cocina');
    await page.locator('.hero-project-card[aria-hidden="false"] button').click();
    assert.equal(await page.locator('input[name="fcType"][value="kitchen"]').isChecked(), true);
    await page.locator('#send-budget-whatsapp').click();
    assert.ok(await page.evaluate(() => window.__openedLinks.some(link =>
      decodeURIComponent(link).includes('Referencia de la galería: Cocina a medida - detalle mesón (galería)')
    )), 'La cotización del hero conserva la referencia real del proyecto');
    assert.equal(await page.locator('.process-media img').count(), 3);
    assert.equal(await page.locator('.header-social a').count(), 2);
    assert.equal(await page.locator('.mobile-social a').count(), 2);
    assert.equal(await page.getByRole('button', { name: 'Cotizar un proyecto similar' }).count(), 3);
    assert.equal(await page.getByRole('heading', { name: 'Lo diseñamos contigo. Lo hacemos nosotros.' }).count(), 1);
    assert.equal(await page.locator('.gallery-social').count(), 0);
    assert.equal(await page.locator('#mobile-nav > :first-child').getAttribute('class'), 'mobile-social');
    for (const social of ['instagram.com/tallerlacarpinteria/', 'facebook.com/tlc.santiago.2025']) {
      const link = page.locator('.header-social a[href*="' + social + '"]');
      assert.equal(await link.getAttribute('target'), '_blank');
      assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
      assert.match(await link.getAttribute('aria-label'), /Taller La Carpintería/);
    }
    await page.keyboard.press('Tab');
    await page.locator('.header-social a').first().focus();
    assert.equal(await page.locator('.header-social a').first().evaluate(element => getComputedStyle(element).outlineStyle), 'solid');
    const labelColors = await page.evaluate(() => [
      ['#galeria .eyebrow', '.gallery-section'],
      ['#cotizador .eyebrow', '.configurator-section'],
      ['.project-content > span', '.project-card'],
      ['.fc-row output', '.configurator-controls'],
    ].map(([text, surface]) => [getComputedStyle(document.querySelector(text)).color, getComputedStyle(document.querySelector(surface)).backgroundColor]));
    for (const [foreground, background] of labelColors) {
      assert.ok(contrast(foreground, background) >= 4.5, `Contraste insuficiente: ${foreground} sobre ${background}`);
    }
    const comparator = page.getByRole('slider', { name: 'Comparar antes y después' });
    await page.locator('.project-whatsapp').last().focus();
    await page.keyboard.press('Tab');
    assert.equal(await comparator.evaluate(element => document.activeElement === element), true);
    await comparator.press('ArrowRight');
    assert.equal(await comparator.inputValue(), '51');
    assert.equal(await page.locator('.compare-divider span').evaluate(element => getComputedStyle(element).outlineStyle), 'solid');
    await page.locator('.filter-button[data-filter="closets"]').click();
    assert.equal(await page.locator('.project-card:not(.hidden)').count(), 1);
    await page.locator('.filter-button[data-filter="todos"]').click();
    await page.locator('.project-whatsapp[data-type="closet"]').click();
    assert.equal(await page.locator('input[name="fcType"][value="closet"]').isChecked(), true);

    await page.locator('#furniture-canvas').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => Boolean(window.TALLER_CONFIGURATION && window.THREE));
    const state = await page.evaluate(() => {
      const original = TALLER_CONFIGURATION.getState();
      const closet = { ...original, type: 'closet', width: 240, height: 240 };
      TALLER_CONFIGURATION.loadState(closet);
      const loaded = TALLER_CONFIGURATION.getState();
      TALLER_CONFIGURATION.loadState({ ...original, type: 'kitchen', width: 280 });
      const kitchen = TALLER_CONFIGURATION.getState();
      return { loaded, kitchen };
    });
    assert.equal(state.loaded.type, 'closet');
    assert.equal(state.loaded.width, 240);
    assert.equal(state.kitchen.type, 'kitchen');
    assert.equal(state.kitchen.width, 280);
    assert.match(await page.locator('#price-range').innerText(), /\$/);
    assert.match(await page.locator('#send-budget-whatsapp').innerText(), /Enviar mi proyecto por WhatsApp/);
    await page.locator('#send-budget-whatsapp').click();
    assert.ok(await page.evaluate(() => window.__openedLinks.some(link =>
      link.startsWith('https://wa.me/') && decodeURIComponent(link).includes('Proyecto: Cocina a medida') &&
      decodeURIComponent(link).includes('Quisiera revisar esta estimación y saber cómo seguimos.')
    )), 'El cotizador genera el mensaje sin enviarlo');

    await page.locator('[data-assistant-trigger]').click();
    assert.equal(await page.locator('#assistant-panel').isVisible(), true);
    assert.ok(await page.locator('[data-assistant-replies] .assistant-reply-chip').count() <= 2);
    await page.locator('#assistant-question').fill('pneumotórax cuántico');
    await page.locator('#assistant-question').press('Enter');
    assert.ok(await page.locator('[data-assistant-replies] .assistant-reply-chip').count() <= 2);
    assert.ok(await page.locator('.assistant-message-user').count() > 0);
    await page.locator('[data-assistant-replies] [data-action="questions"]').click();
    assert.ok(await page.locator('[data-assistant-replies] .assistant-reply-chip').count() <= 2);
    await page.locator('[data-assistant-minimize]').click();
    assert.equal(await page.locator('#assistant-panel').isVisible(), false);

    for (const width of [1440, 1280, 1024, 768, 430, 390, 360]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Scroll horizontal a ' + width + 'px');
      assert.equal(await page.locator('.header-social a:visible').count(), width >= 1200 ? 2 : 0);
      if (width >= 1200) {
        assert.deepEqual(await page.locator('.header-social a').allInnerTexts(), ['Instagram', 'Facebook']);
        assert.ok(await page.locator('.header-social a').first().evaluate(element => element.getBoundingClientRect().width > 100 && element.getBoundingClientRect().height >= 44));
      } else {
        await page.locator('.menu-toggle').click();
        assert.equal(await page.locator('.mobile-social a:visible').count(), 2);
        assert.deepEqual(await page.locator('.mobile-social a').allInnerTexts(), ['Instagram', 'Facebook']);
        assert.ok(await page.locator('.mobile-social a').first().evaluate(element => element.getBoundingClientRect().height >= 44));
        await page.locator('.menu-toggle').click();
      }
      if (width <= 430) {
        assert.equal(await page.locator('.mobile-quote-shortcut').isVisible(), true);
        assert.match(await page.locator('#mobile-quote-summary').innerText(), /Cocina/);
        assert.ok(await page.locator('#mobile-quote-jump').evaluate(element => element.getBoundingClientRect().height >= 44));
        await page.locator('[data-assistant-trigger]').click();
        assert.ok(await page.locator('.assistant-form button').evaluate(element => element.getBoundingClientRect().height >= 44));
        assert.ok(await page.locator('.assistant-reply-chip').first().evaluate(element => element.getBoundingClientRect().height >= 44));
        await page.locator('[data-assistant-minimize]').click();
      }
    }
    await page.locator('input[name="fcType"][value="closet"]').check();
    assert.match(await page.locator('#mobile-quote-summary').innerText(), /Clóset/);
    assert.match(await page.locator('#price-range').innerText(), /\$/);
    await page.locator('#mobile-quote-jump').click();
    await page.waitForFunction(() => {
      const top = document.querySelector('.calculator-result-card').getBoundingClientRect().top;
      return top >= 60 && top <= 200;
    });
    await page.locator('.menu-toggle').click();
    assert.equal(await page.locator('#mobile-nav').isVisible(), true);
    assert.equal(await page.locator('#mobile-nav a[href*="instagram.com"]').count(), 1);
    assert.equal(await page.locator('#mobile-nav a[href*="facebook.com"]').count(), 1);
    assert.ok(await page.locator('.mobile-social a').first().evaluate(element => element.getBoundingClientRect().width >= 44 && element.getBoundingClientRect().height >= 44));
    assert.deepEqual(missing, [], 'Recursos locales faltantes');
    assert.deepEqual(errors, [], 'Errores JavaScript');
    const maestro = await page.request.get(origin + '/maestro/');
    assert.equal(maestro.status(), 404);
    console.log('PASS: dist público, galería, redes, cotizador Cocina/Clóset, WhatsApp sin envío, asistente, móvil y ausencia de Maestro.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
