// The in-app manual: opens from Home / Settings / editor, language switch, search, jump links,
// library and examples, and "Open this example" without losing the circuit being edited.
// Usage: npm run build && node tests/manual.mjs [shots-dir]
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const server = http.createServer((req, res) => { const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' }); fs.createReadStream(f).pipe(res); }).listen(0);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'en-US' });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const shots = process.argv[2]; if (shots) fs.mkdirSync(shots, { recursive: true });
const shot = (n) => shots && page.screenshot({ path: path.join(shots, n + '.png') });
await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForTimeout(2300);
const checks = [];
const ok = (name, v) => checks.push([name, !!v]);
const screen = () => page.evaluate(() => app.current);
const vis = (sel) => page.locator(sel).filter({ visible: true }).count();

// --- from Home
// pages scroll with a transform, so taps are sent straight to the element
const tap = (loc) => loc.first().evaluate((e) => e.click()).then(() => page.waitForTimeout(450));
const nav = (id) => tap(page.locator(`[data-nav="${id}"]`));
const title = () => page.locator('.screen.manual .topbar .title b').textContent();
const back = () => page.evaluate(() => window.raptiBack()).then(() => page.waitForTimeout(400));
await page.click('[data-tab=manual]'); await page.waitForTimeout(500);
ok('Manual tab opens the manual screen', await screen() === 'manual');
ok('contents page lists 19 chapters', await page.locator('.man-card[data-nav^="ch:"]').count() === 19);
ok('contents page is short (no chapter text on it)', await page.locator('.man-inner .man-b').count() === 0);
ok('default language English', await title() === 'User Manual');
await shot('1-contents');
// chapter -> section -> back, back
await nav('ch:scope');
ok('a chapter opens on its own page', await title() === 'Oscilloscope' && await page.locator('.man-inner .man-h').count() === 1);
const secs = await page.locator('.man-card[data-nav^="sec:scope/"]').count();
ok('a long chapter is split into sections', secs >= 3);
await shot('2-chapter');
await nav('sec:scope/0');
ok('a section opens one level deeper', (await title()).length > 0 && await page.locator('.man-inner .man-b').count() > 0);
await shot('3-section');
await tap(page.locator('[data-swap^="sec:scope/"].r'));
ok('Next moves to the next section', await page.locator('.man-inner .man-h').count() === 1);
await back();
ok('Back goes up to the chapter', await title() === 'Oscilloscope');
await back();
ok('Back goes up to the contents', await title() === 'User Manual' && await screen() === 'manual');
// pager between chapters
await nav('ch:welcome');
await tap(page.locator('[data-swap="ch:quickstart"]'));
ok('Next chapter button', (await title()).startsWith('Quick start'));
await back();
// library: categories, then components
await nav('ch:library');
ok('library lists 20 categories', await page.locator('.man-card[data-nav^="sec:library/"]').count() === 20);
await nav('sec:library/Sensors');
ok('a category lists its components', await page.locator('.man-item').count() === 41);
await shot('4-category');
await back(); await back();
// chapter links inside text
await nav('ch:editor'); await nav('sec:editor/2');
await tap(page.locator('.man-ref[data-nav="ch:running"]'));
ok('chapter references are links', await title() === 'Running the simulation');
await back(); await back(); await back();
// search (on the contents page)
await page.fill('.man-search input', 'thermistor'); await page.waitForTimeout(500);
ok('search lists matching pages and parts', await page.locator('.man-card.res').count() >= 2);
await shot('5-search');
await tap(page.locator('.man-card.res', { hasText: 'NTC Thermistor' }));
ok('a search result opens its page', await title() === 'Sensors');
await back();
ok('Back from a result returns to the search', await page.locator('.man-card.res').count() >= 2);
await page.fill('.man-search input', 'zzzzqqq'); await page.waitForTimeout(400);
ok('no-result message', await page.locator('.man-empty').count() === 1);
await page.fill('.man-search input', ''); await page.waitForTimeout(400);
ok('clearing the search shows the contents again', await page.locator('.man-card[data-nav^="ch:"]').count() === 19);
// language
await nav('ch:scope');
await page.click('[data-x=lang]'); await page.waitForTimeout(500);
ok('switches to Bangla and stays on the page', await title() === 'অসিলোস্কোপ');
ok('language is remembered', await page.evaluate(() => JSON.parse(localStorage.getItem('raptickt.settings.v1')).manualLang) === 'bn');
await shot('6-bn-chapter');
await back();
await page.fill('.man-search input', 'ক্যাপাসিটর'); await page.waitForTimeout(500);
ok('Bangla search works', await page.locator('.man-card.res').count() >= 1);
await shot('7-bn-search');
await page.fill('.man-search input', ''); await page.waitForTimeout(300);
await shot('8-bn-contents');
await page.click('[data-x=lang]'); await page.waitForTimeout(400);
await back();
ok('Back from the contents leaves the manual', await screen() === 'home');

// --- from the editor: the circuit being edited is kept
await page.click('[data-h=new]'); await page.waitForTimeout(900);
// first run shows the how-to card, which links to the manual
ok('how-to card offers the full manual', await page.locator('.modal.open [data-x=manual]').count() === 1);
await page.click('.modal.open [data-x=manual]'); await page.waitForTimeout(500);
ok('how-to card opens the manual', await screen() === 'manual');
await page.evaluate(() => window.raptiBack()); await page.waitForTimeout(400);
await page.evaluate(() => { const e = app.editor; e.addComponent('resistor'); e.addComponent('capacitor'); });
await page.waitForTimeout(300);
await page.click('[data-a=more]'); await page.waitForTimeout(300);
ok('editor menu has User manual', await page.locator('.more-menu [data-m=manual]').count() === 1);
await page.click('.more-menu [data-m=manual]'); await page.waitForTimeout(500);
ok('manual opens over the editor', await screen() === 'manual');
await page.evaluate(() => window.raptiBack()); await page.waitForTimeout(400);
ok('Back returns to the editor with the circuit intact', await screen() === 'editor' && await page.evaluate(() => app.editor.doc.elements.length) === 2);

// Open this example from the manual (started from the editor): the circuit being edited is saved at once, then the example opens
await page.evaluate(() => { app.editor.addComponent('resistor'); app.editor.doc.name = 'Keep me'; }); // edited a moment ago: autosave has not fired yet
await page.evaluate(() => app.openManual('examples')); await page.waitForTimeout(800);
await nav('sec:examples/Basics');
await shot('9-examples');
await page.evaluate(() => document.querySelector('.man-item [data-ex=led]').click()); await page.waitForTimeout(1200);
ok('example opens in the editor', await screen() === 'editor' && await page.evaluate(() => app.editor.doc.name) === 'LED with switch');
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('raptickt.circuits.v1') || '[]').find((c) => c.name === 'Keep me'));
ok('circuit that was being edited was saved first', saved && saved.count === 3);
// the bottom menu stays visible while reading, and its tabs leave the manual
await page.evaluate(() => app.goHome());
await page.click('[data-tab=manual]'); await page.waitForTimeout(500);
ok('bottom menu is visible inside the manual', await page.locator('.screen.manual .bottom-nav button').count() === 5 && await page.locator('.screen.manual .bottom-nav').isVisible());
await nav('ch:scope');
ok('...and on chapter pages', await page.locator('.screen.manual .bottom-nav').isVisible());
await page.click('.screen.manual [data-tab=examples]'); await page.waitForTimeout(500);
ok('a tab in the manual menu opens that Home page', await screen() === 'home' && await page.locator('.page-title').textContent() === 'Examples');
ok('no manual menu when opened from the editor', await page.evaluate(() => { app.newCircuit(); return true; }));
await page.waitForTimeout(800); await page.evaluate(() => app.closeSheet());
await page.evaluate(() => app.openManual()); await page.waitForTimeout(400);
ok('editor-launched manual has no bottom menu', await page.locator('.screen.manual .bottom-nav').count() === 0);
await page.evaluate(() => window.raptiBack()); await page.waitForTimeout(300);
await page.evaluate(() => app.goHome()); await page.waitForTimeout(400);
ok('Settings has no manual section', await (async () => { await page.click('[data-h=settings]'); await page.waitForTimeout(400); return (await page.locator('.screen.settings [data-x=manual]').count()) === 0; })());
await page.evaluate(() => window.raptiBack()); await page.waitForTimeout(300);
// banner on Home
await page.evaluate(() => { app.home.tab = 'home'; app.home.render(); }); await page.waitForTimeout(500);
await page.click('[data-h=manual]'); await page.waitForTimeout(400);
ok('Home banner opens the manual', await screen() === 'manual');

let fails = 0;
for (const [name, v] of checks) { if (!v) fails++; console.log(v ? 'ok  ' : 'FAIL', name); }
console.log(errs.length ? errs : 'no page errors', fails ? `${fails} FAILED` : 'all passed');
await browser.close(); server.close();
process.exit(fails || errs.length ? 1 : 0);
