// Website package check: serves ../website/raptickt under /simulator/ (as on rapti.net) and
// runs it at desktop and phone sizes, inside the embed example, and offline.
// Run after `npm run website`: node tests/website.mjs [shots-dir]
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const out = process.argv[2] || 'shots';
fs.mkdirSync(out, { recursive: true });
const root = path.resolve('../website/raptickt');
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const missing = [];
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (!u.startsWith('/simulator/')) { res.writeHead(404); missing.push(u); return res.end(); }
  let f = path.join(root, u.slice('/simulator/'.length));
  if (u.endsWith('/')) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); missing.push(u); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const base = `http://localhost:${server.address().port}/simulator/`;
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const fails = [];
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };

async function open(viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, ...opts });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  return { ctx, page, errs };
}

// ---- desktop: build and run a circuit, Esc and browser Back, offline reload
{
  const { ctx, page, errs } = await open({ width: 1440, height: 900 });
  await page.goto(base);
  await page.evaluate(() => localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true })));
  await page.waitForTimeout(2300);
  check(await page.evaluate(() => !!window.app && app.current === 'home'), 'desktop: app starts on Home');
  await page.screenshot({ path: path.join(out, 'web-desktop-home.png') });
  await page.click('[data-h=new]');
  await page.waitForTimeout(500);
  await page.click('.fab'); await page.waitForTimeout(300);
  await page.fill('.search input', 'Resistor'); await page.waitForTimeout(200);
  await page.click('.pal-item'); await page.waitForTimeout(300);
  check(await page.evaluate(() => app.editor.doc.elements.length === 1), 'desktop: part added from the palette');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  check(await page.evaluate(() => app.current === 'editor' && !document.querySelector('.sheet.palette.open')), 'desktop: Esc closes the palette first');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  check(await page.evaluate(() => app.current === 'home'), 'desktop: Esc steps back to Home');
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('raptickt.circuits.v1') || '[]').length > 0), 'desktop: circuit saved in the library');
  // an example runs
  await page.evaluate(() => app.openExample(document.querySelector('[data-ex]')?.dataset.ex));
  await page.waitForTimeout(600);
  await page.evaluate(() => { if (!app.editor.running) app.editor.togglePlay(); });
  await page.waitForTimeout(1500);
  const run = await page.evaluate(() => ({ t: app.editor.sim?.t, i: Math.max(...app.editor.doc.elements.map((e) => Math.abs(e.i || 0))) }));
  check(run.t > 0 && run.i > 1e-6, `desktop: example runs (t=${run.t}, max current ${run.i})`);
  await page.mouse.move(700, 450);
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, 'web-desktop-run.png') });
  await page.goBack(); await page.waitForTimeout(300);
  // browser Back inside the app
  await page.evaluate(() => app.openExample(document.querySelector('[data-ex]')?.dataset.ex));
  await page.waitForTimeout(1200);
  const inEditor = await page.evaluate(() => app.current);
  await page.goBack(); await page.waitForTimeout(500);
  const after = await page.evaluate(() => ({ cur: app.current, url: location.pathname }));
  check(inEditor === 'editor' && after.cur === 'home' && after.url === '/simulator/', `browser Back: ${inEditor} -> ${after.cur}, still on ${after.url}`);
  // offline
  const sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
  check(sw, 'offline cache (service worker) active');
  await page.waitForTimeout(500);
  await ctx.setOffline(true);
  await page.reload(); await page.waitForTimeout(2300);
  check(await page.evaluate(() => !!window.app && app.current === 'home'), 'offline: reload still opens the app');
  await ctx.setOffline(false);
  check(!errs.length, 'desktop: no console errors ' + errs.join(' | '));
  await ctx.close();
}

// ---- desktop mouse: palette tabs, palette list and example chips can be reached with wheel and drag
{
  const { ctx, page, errs } = await open({ width: 1440, height: 900 });
  await page.goto(base);
  await page.evaluate(() => localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true })));
  await page.reload(); await page.waitForTimeout(2300);
  await page.evaluate(() => document.querySelector('[data-h=new]').click()); await page.waitForTimeout(500);
  await page.evaluate(() => document.querySelector('.fab').click()); await page.waitForTimeout(700);
  const tabs = () => page.evaluate(() => { const t = document.querySelector('.pal-tabs'); return Math.round(t.scrollLeft); });
  const tb = await page.locator('.pal-tabs').boundingBox();
  await page.mouse.move(tb.x + 200, tb.y + 15); await page.mouse.wheel(0, 400); await page.waitForTimeout(400);
  const t1 = await tabs();
  check(t1 > 100, `mouse: wheel over the palette tabs scrolls them (${t1})`);
  await page.mouse.move(tb.x + 380, tb.y + 15); await page.mouse.down(); await page.mouse.move(tb.x + 100, tb.y + 15, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(400);
  const t2 = await tabs();
  check(t2 > t1 + 100, `mouse: dragging the palette tabs scrolls them (${t1} -> ${t2})`);
  await page.click('.pal-tabs [data-t=Sources]'); await page.waitForTimeout(700);
  const gb = await page.locator('.pal-grid').boundingBox();
  const gy = () => page.evaluate(() => Math.round(app.editor.palette.scroll.y));
  await page.mouse.move(gb.x + 200, gb.y + 200); await page.mouse.wheel(0, 300); await page.waitForTimeout(800);
  const y1 = await gy();
  check(y1 > 100, `mouse: wheel scrolls the component list (${y1})`);
  await page.mouse.move(gb.x + 40, gb.y + 300); await page.mouse.down(); await page.mouse.move(gb.x + 40, gb.y + 100, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(800);
  const y2 = await gy();
  check(y2 > y1, `mouse: dragging scrolls the component list (${y1} -> ${y2})`);
  check(await page.evaluate(() => app.editor.doc.elements.length === 0), 'mouse: a drag does not add a part');
  await page.evaluate(() => { document.querySelector('.pal-head [data-close]').click(); app.goHome(); }); await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector('.bottom-nav [data-tab=examples]').click()); await page.waitForTimeout(800);
  const chips = () => page.evaluate(() => { const a = document.querySelector('.home-body .chips')._axis; return Math.round(a.pos); });
  const cb = await page.locator('.home-body .chips').boundingBox();
  await page.mouse.move(cb.x + 300, cb.y + 15); await page.mouse.wheel(0, 300); await page.waitForTimeout(600);
  const c1 = await chips();
  check(c1 > 100, `mouse: wheel over the example categories scrolls them (${c1})`);
  await page.mouse.move(cb.x + 600, cb.y + 15); await page.mouse.down(); await page.mouse.move(cb.x + 200, cb.y + 15, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(700);
  const c2 = await chips();
  check(c2 > c1, `mouse: dragging the example categories scrolls them (${c1} -> ${c2})`);
  await page.mouse.move(700, 500); await page.mouse.down(); await page.mouse.move(700, 150, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(900);
  check(await page.evaluate(() => app.current === 'home' && app.home.scrollApi.y > 200), 'mouse: dragging scrolls the example list and opens nothing');
  check(!errs.length, 'mouse: no console errors ' + errs.join(' | '));
  await ctx.close();
}

// ---- desktop layout: scope on the left, tools on the right in full screen; phones keep theirs
for (const [name, vp, touch, want] of [['desktop', { width: 1440, height: 900 }, false, 'left'], ['phone', { width: 390, height: 844 }, true, 'top'], ['phone-landscape', { width: 844, height: 390 }, true, 'right']]) {
  const { ctx, page, errs } = await open(vp, touch ? { hasTouch: true, isMobile: true } : {});
  await page.goto(base);
  await page.evaluate(() => localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true })));
  await page.reload(); await page.waitForTimeout(2300);
  await page.evaluate(() => app.openExample(document.querySelector('[data-ex]').dataset.ex)); await page.waitForTimeout(1200);
  await page.evaluate(() => { if (!app.editor.scopeOpen) app.editor.toggleScope(true); }); await page.waitForTimeout(700);
  const where = await page.evaluate(() => {
    const s = document.querySelector('.scope-panel').getBoundingClientRect(), b = app.editor.canvas.getBoundingClientRect();
    return s.bottom <= b.top + 1 ? 'top' : s.right <= b.left + 1 ? 'left' : s.left >= b.right - 1 ? 'right' : 'overlap';
  });
  check(where === want, `${name}: oscilloscope ${where} of the circuit (want ${want})`);
  if (!touch) {
    await page.evaluate(() => { app.editor.setFullscreen(true); app.editor.showFsTools(true, 99999); }); await page.waitForTimeout(700);
    const rail = await page.evaluate(() => { const r = document.querySelector('.fs-rail').getBoundingClientRect(); return r.right > innerWidth - 40; });
    check(rail, 'desktop: full-screen tools on the right');
  }
  check(!errs.length, `${name} layout: no console errors ` + errs.join(' | '));
  await ctx.close();
}

// ---- phone (touch) and tablet
for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['phone-landscape', { width: 844, height: 390 }], ['tablet', { width: 820, height: 1180 }]]) {
  const { ctx, page, errs } = await open(vp, { hasTouch: true, isMobile: true });
  await page.goto(base);
  await page.evaluate(() => localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true })));
  await page.waitForTimeout(2300);
  await page.screenshot({ path: path.join(out, `web-${name}-home.png`) });
  await page.tap('.bottom-nav [data-tab=examples]'); await page.waitForTimeout(700);
  await page.tap('.ex-item >> nth=0');
  await page.waitForTimeout(1800);
  const st = await page.evaluate(() => ({ cur: app.current, n: app.editor.doc.elements.length, overflowX: document.documentElement.scrollWidth > innerWidth }));
  check(st.cur === 'editor' && st.n > 0 && !st.overflowX, `${name}: example opens by tap (${st.n} parts), no sideways scroll`);
  await page.screenshot({ path: path.join(out, `web-${name}-example.png`) });
  check(!errs.length, `${name}: no console errors ` + errs.join(' | '));
  await ctx.close();
}

// ---- the embed example (simulator inside a section of a page)
for (const [name, vp] of [['desktop', { width: 1366, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
  const { ctx, page, errs } = await open(vp, name === 'phone' ? { hasTouch: true, isMobile: true } : {});
  await page.goto(base + 'embed-example.html');
  await page.locator('iframe').scrollIntoViewIfNeeded();
  await page.waitForTimeout(2800);
  const f = page.frame({ url: /simulator\/$/ });
  check(!!f && await f.evaluate(() => !!window.app && app.current === 'home'), `embed ${name}: simulator runs inside the section`);
  await page.screenshot({ path: path.join(out, `web-embed-${name}.png`) });
  check(!errs.length, `embed ${name}: no console errors ` + errs.join(' | '));
  await ctx.close();
}

check(!missing.length, 'no missing files ' + missing.join(' '));
await browser.close(); server.close();
console.log(fails.length ? `${fails.length} FAILED` : 'all website checks passed');
process.exit(fails.length ? 1 : 0);
