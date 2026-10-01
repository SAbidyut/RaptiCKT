// Component menu stays open while adding several parts (only ✕ closes it),
// reverse-polarity button, decade knob (digits, −/+ decades) and stepped knob.
// Usage: npm run build && node tests/editor-tools.mjs [outdir]
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const out = process.argv[2] || 'shots'; fs.mkdirSync(out, { recursive: true });
const root = path.resolve('dist');
const server = http.createServer((req, res) => { const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' }); fs.createReadStream(f).pipe(res); }).listen(0);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true })));
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForTimeout(2300);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (name, ok, info = '') => { if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', name, info); };
await page.evaluate(() => app.newCircuit()); await sleep(500);
// --- 1. menu stays open
await page.evaluate(() => app.editor.palette.open()); await sleep(700);
await page.evaluate(() => document.querySelector('.pal-tabs button[data-t="Passive"]').click()); await sleep(300);
for (let k = 0; k < 5; k++) { await page.tap('.pal-item[data-type="resistor"]'); await sleep(350); }
const r1 = await page.evaluate(() => {
  const ed = app.editor, R = ed.renderer, palTop = ed.palette.host.getBoundingClientRect().top - ed.canvas.getBoundingClientRect().top;
  const rs = ed.doc.elements.filter((e) => e.constructor.type === 'resistor');
  const vis = rs.every((e) => { const [a, b, c, d] = e.worldBox(); const [, sy1] = R.toScreen(a, b), [, sy2] = R.toScreen(c, d); return sy1 >= 0 && sy2 <= palTop; });
  const spots = new Set(rs.map((e) => e.x + ',' + e.y));
  return { open: ed.palette.isOpen, n: rs.length, distinct: spots.size, visible: vis };
});
check('menu still open after adding 5 resistors', r1.open, JSON.stringify(r1));
check('5 resistors, all in different places, all visible above the menu', r1.n === 5 && r1.distinct === 5 && r1.visible);
await page.screenshot({ path: path.join(out, 'menu-open.png') });
// tapping the board does not close it
await page.touchscreen.tap(60, 150); await sleep(300);
check('tap on the board keeps the menu open', await page.evaluate(() => app.editor.palette.isOpen));
await page.tap('.palette .pal-head [data-close]'); await sleep(400);
check('✕ closes the menu', await page.evaluate(() => !app.editor.palette.isOpen));
// --- 2. reverse polarity
const pol = await page.evaluate(() => {
  const ed = app.editor;
  ed.addComponent('dcv');
  const v = [...ed.selection][0];
  const btn = !!document.querySelector('.quickbar [data-q=reverse]');
  const before = v.getPosts().map((p) => p.join(','));
  document.querySelector('.quickbar [data-q=reverse]').click();
  const after = v.getPosts().map((p) => p.join(','));
  ed.select(ed.doc.elements.find((e) => e.constructor.type === 'resistor'));
  const rBtn = !!document.querySelector('.quickbar [data-q=reverse]');
  return { btn, swapped: before[0] === after[1] && before[1] === after[0], rBtn };
});
check('reverse button on a voltage source, swaps its terminals in place', pol.btn && pol.swapped, JSON.stringify(pol));
check('no reverse button on a resistor', !pol.rBtn);
// --- 3. decade knob on the resistor (1 kΩ)
const k = async () => page.evaluate(() => ({ v: app.editor.selection.values().next().value.p.r, label: document.querySelector('.knob-label b').textContent, decade: document.querySelector('.knob').classList.contains('decade'), on: document.querySelector('.knob-digits span.on')?.textContent }));
let s = await k();
check('decade dial for resistance', s.decade && s.on === '1', JSON.stringify(s));
await page.tap('.knob-btn[data-k="+"]'); await sleep(150);
s = await k(); check('+ → 1.1 kΩ (fine step)', Math.abs(s.v - 1100) < 1e-6, JSON.stringify(s));
for (let i = 0; i < 3; i++) { await page.tap('.knob-btn[data-k="-"]'); await sleep(60); }
s = await k(); check('− − − → 890 Ω (1.0 k rolls to 900, then 890)', Math.abs(s.v - 890) < 1e-6, JSON.stringify(s));
await page.evaluate(() => { const e = [...app.editor.selection][0]; app.editor.setParam(e, 'r', 100); app.editor.knob.update(); });
// tap the digit 4
const d4 = await page.evaluate(() => { const r = document.querySelector('.knob-digits span[data-d="4"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
await page.touchscreen.tap(d4[0], d4[1]); await sleep(200);
s = await k(); check('tap digit 4 → 400 Ω', Math.abs(s.v - 400) < 1e-9 && s.on === '4', JSON.stringify(s));
// turn the dial clockwise by ~6 detents (240°): 4 → 9 → 10 (next decade) ... → 1 kΩ
const dial = await page.evaluate(() => { const r = document.querySelector('.knob-dial').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width / 2 - 8]; });
const cdp = await ctx.newCDPSession(page);
const at = (deg) => [dial[0] + dial[2] * Math.cos((deg - 90) * Math.PI / 180), dial[1] + dial[2] * Math.sin((deg - 90) * Math.PI / 180)];
const ang0 = await page.evaluate(() => app.editor.knob.angle);
let p0 = at(160);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p0[0], y: p0[1] }] });
for (let a = 165; a <= 160 + 245; a += 5) { const p = at(a); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p[0], y: p[1] }] }); await sleep(8); }
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(200);
s = await k(); check('turn 6 detents: 400 Ω → 1 kΩ (through 900 Ω)', Math.abs(s.v - 1000) < 1e-9, JSON.stringify(s));
const turned = (await page.evaluate(() => app.editor.knob.angle) - ang0) * 180 / Math.PI;
check('pointer kept turning forward past 9 → 1 (+240°, no spin back)', Math.abs(turned - 240) < 0.5, `turned ${turned.toFixed(1)}°`);
// tapping digit 9 from 1 takes the short way (one step back, −40°)
const a1 = await page.evaluate(() => app.editor.knob.angle);
const d9 = await page.evaluate(() => { const r = document.querySelector('.knob-digits span[data-d="9"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
await page.touchscreen.tap(d9[0], d9[1]); await sleep(200);
const back = (await page.evaluate(() => app.editor.knob.angle) - a1) * 180 / Math.PI;
check('tap 9 from 1: short way round (−40°)', Math.abs(back + 40) < 0.5, `moved ${back.toFixed(1)}°`);
await page.screenshot({ path: path.join(out, 'knob.png') });
// label sits above the dial
const pos = await page.evaluate(() => { const l = document.querySelector('.knob-label').getBoundingClientRect(), d = document.querySelector('.knob-dial').getBoundingClientRect(); return l.bottom <= d.top; });
check('value label above the dial', pos);
// --- 4. stepped knob (potentiometer position, %)
const lin = await page.evaluate(() => { const ed = app.editor; ed.addComponent('pot'); const e = [...ed.selection][0]; e.p.pos = 37.4; ed.select(null); ed.select(e); return { decade: document.querySelector('.knob').classList.contains('decade'), key: e.knobProp().key }; });
await page.tap('.knob-btn[data-k="+"]'); await sleep(100);
const pv = await page.evaluate(() => [...app.editor.selection][0].p.pos);
const pd = await page.evaluate(() => { app.editor.knob.step(1); return [...app.editor.selection][0].p.pos; });
check('percent knob: + fine-tunes (37.4 → 37.5), the dial snaps to whole percent (→ 38)', !lin.decade && pv === 37.5 && pd === 38, JSON.stringify({ ...lin, pv, pd }));
console.log(errs.length ? errs : 'no page errors', fails ? `${fails} FAILED` : 'all passed');
await browser.close(); server.close();
