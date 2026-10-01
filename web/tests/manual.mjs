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
await page.click('[data-tab=manual]'); await page.waitForTimeout(400);
ok('Manual tab opens the manual screen', await screen() === 'manual');
ok('19 chapters in the contents', await page.locator('.man-toc button').count() === 19);
ok('default language English', await page.locator('.man-hero h2').textContent() === 'User Manual');
await shot('1-home-en');
// jump link in contents
await page.click('.man-toc [data-go=scope]'); await page.waitForTimeout(700);
const y = await page.evaluate(() => { const s = document.querySelector('#man-scope').getBoundingClientRect(), v = document.querySelector('.man-scroll').getBoundingClientRect(); return s.top - v.top; });
ok('contents link scrolls to the chapter', Math.abs(y) < 40);
await shot('2-scope');
// cross-chapter reference link
await page.evaluate(() => document.querySelector('#man-editor .man-ref')?.scrollIntoView?.());
ok('chapter references are links', await page.locator('.man-ref[data-go]').count() >= 5);
// search
await page.fill('.man-search input', 'thermistor'); await page.waitForTimeout(500);
ok('search hides the contents', await vis('.man-toc') === 0);
const hits = await vis('.man-item');
ok('search finds thermistor parts in the library', hits >= 2);
await shot('3-search');
await page.fill('.man-search input', 'zzzzqqq'); await page.waitForTimeout(500);
ok('no-result message', await vis('.man-empty') === 1);
await page.fill('.man-search input', ''); await page.waitForTimeout(500);
ok('clearing search restores everything', await vis('.man-toc') === 1 && await vis('.man-ch') === 19);
// library
const libCount = await page.evaluate(() => document.querySelectorAll('.man-item[data-s]').length);
ok('library lists all 335 components (+29 examples)', libCount === 335 + 29);
// language
await page.click('[data-x=lang]'); await page.waitForTimeout(500);
ok('switches to Bangla', (await page.locator('.man-hero h2').textContent()) === 'ইউজার ম্যানুয়াল');
ok('language is remembered', await page.evaluate(() => JSON.parse(localStorage.getItem('raptickt.settings.v1')).manualLang) === 'bn');
await shot('4-bn');
await page.fill('.man-search input', 'ক্যাপাসিটর'); await page.waitForTimeout(500);
ok('Bangla search works', await vis('.man-ch') >= 1);
await shot('5-bn-search');
await page.fill('.man-search input', ''); await page.waitForTimeout(300);
await page.click('[data-x=lang]'); await page.waitForTimeout(400);
// back
await page.evaluate(() => window.raptiBack()); await page.waitForTimeout(300);
ok('Back returns to Home', await screen() === 'home');

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
await shot('6-editor-back');
// Open this example from the manual (started from the editor): the circuit being edited is saved at once, then the example opens
await page.evaluate(() => { app.editor.addComponent('resistor'); app.editor.doc.name = 'Keep me'; }); // edited a moment ago: autosave has not fired yet
await page.evaluate(() => app.openManual('examples')); await page.waitForTimeout(800);
await shot('7-examples');
await page.evaluate(() => document.querySelector('.man-item [data-ex=led]').click()); await page.waitForTimeout(1200);
ok('example opens in the editor', await screen() === 'editor' && await page.evaluate(() => app.editor.doc.name) === 'LED with switch');
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('raptickt.circuits.v1') || '[]').find((c) => c.name === 'Keep me'));
ok('circuit that was being edited was saved first', saved && saved.count === 3);
// Settings link
await page.evaluate(() => app.goHome()); await page.waitForTimeout(400);
await page.click('[data-h=settings]'); await page.waitForTimeout(400);
await page.click('[data-x=manual]'); await page.waitForTimeout(400);
ok('Settings → User manual', await screen() === 'manual');
await page.evaluate(() => window.raptiBack()); await page.waitForTimeout(300);
ok('Back from the manual returns to Settings', await screen() === 'settings');
await page.evaluate(() => window.raptiBack()); await page.waitForTimeout(300);
// banner on Home
await page.click('[data-h=manual]'); await page.waitForTimeout(400);
ok('Home banner opens the manual', await screen() === 'manual');

let fails = 0;
for (const [name, v] of checks) { if (!v) fails++; console.log(v ? 'ok  ' : 'FAIL', name); }
console.log(errs.length ? errs : 'no page errors', fails ? `${fails} FAILED` : 'all passed');
await browser.close(); server.close();
process.exit(fails || errs.length ? 1 : 0);
