// Operate / Wire board modes (as in RaptiAuto): Wire by default while stopped, Operate as soon as
// Run is pressed, either one picked by hand at any time. Taps on a switch only work it in Operate;
// in Wire they select it. Dragging a part moves it in both modes (empty space pans); in Operate a
// terminal never starts a wire.
// Usage: npm run build && node tests/board-modes.mjs
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const server = http.createServer((req, res) => { const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' }); fs.createReadStream(f).pipe(res); }).listen(0);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.addInitScript(() => localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true, selectHelp: true, fsTip2: true, tapWireHelp: true })));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForTimeout(2200);
let fail = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fail++; };
const st = () => page.evaluate(() => {
  const ed = window.app.editor, sw = ed.doc.elements.find((e) => e.constructor.type === 'switch');
  return { mode: ed.mode, running: ed.running, paused: ed.paused, closed: sw.p.closed, x: sw.x, y: sw.y, sel: ed.selected() === sw, wireFrom: !!ed.wireFrom, seg: document.querySelector('.mseg.active')?.dataset.mode };
});
// screen point of the switch body / its left terminal
const at = (what) => page.evaluate((what) => {
  const ed = window.app.editor, R = ed.renderer, r = ed.canvas.getBoundingClientRect(), sw = ed.doc.elements.find((e) => e.constructor.type === 'switch');
  let wx, wy;
  if (what === 'post') [wx, wy] = sw.getPosts()[0]; else { const b = sw.worldBox(); wx = (b[0] + b[2]) / 2; wy = (b[1] + b[3]) / 2; }
  const [sx, sy] = R.toScreen(wx, wy);
  return [r.left + sx, r.top + sy];
}, what);
const tap = async (p) => { await page.mouse.move(p[0], p[1]); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(380); };
const drag = async (p, dx, dy) => { await page.mouse.move(p[0], p[1]); await page.mouse.down(); for (let k = 1; k <= 8; k++) await page.mouse.move(p[0] + dx * k / 8, p[1] + dy * k / 8); await page.mouse.up(); await page.waitForTimeout(380); };

await page.evaluate(() => { window.app.settings.autoStart = false; window.app.openExample('led'); });
await page.waitForTimeout(900);
let s = await st();
check(s.mode === 'wire' && s.seg === 'wire' && !s.running, `opened stopped → Wire (${s.mode})`);
const c0 = s.closed;
await tap(await at('body'));
s = await st();
check(s.closed === c0 && s.sel, 'Wire: tapping the switch selects it and does not flip it');
await page.evaluate(() => window.app.editor.select(null));
await tap(await at('post'));
s = await st();
check(s.wireFrom, 'Wire: tapping a terminal starts a wire');
await page.click('.mseg[data-mode=operate]'); await page.waitForTimeout(200);
s = await st();
check(s.mode === 'operate' && s.seg === 'operate' && !s.wireFrom, 'Operate picked by hand before Run (pending wire dropped)');
await tap(await at('body'));
s = await st();
check(s.closed === !c0 && !s.sel, 'Operate (stopped): tapping the switch flips it, without selecting it');
await tap(await at('post'));
s = await st();
check(!s.wireFrom && s.closed === c0, 'Operate: a tap next to its terminal works the switch, no wire');
const x0 = s.x, y0 = s.y;
await drag(await at('body'), 90, 60);
s = await st();
check((s.x !== x0 || s.y !== y0) && s.closed === c0, 'Operate: dragging a part moves it, without working it');
await page.evaluate(() => window.app.editor.undo());
await page.click('.mseg[data-mode=wire]'); await page.waitForTimeout(200);
s = await st();
check(s.mode === 'wire', 'Wire picked by hand');
await drag(await at('body'), 0, 80);
s = await st();
check(s.x !== x0 || s.y !== y0, 'Wire: dragging a part moves it');
await page.evaluate(() => window.app.editor.undo());
// a burnt wire or one with a cable is saved as {p, c, b}, not a bare point list: parts must still drag
for (const kind of ['burnt', 'cable']) {
  await page.evaluate((kind) => { const w = window.app.editor.doc.wires.at(-1); if (kind === 'burnt') w.burnt = true; else w.cable = { type: 'pvc', size: 1.5 }; }, kind);
  const n0 = errs.length;
  await drag(await at('body'), 0, 80);
  s = await st();
  check((s.x !== x0 || s.y !== y0) && errs.length === n0, `a ${kind} wire on the board: dragging a part still moves it`);
  await page.evaluate(() => { const ed = window.app.editor; ed.undo(); const w = ed.doc.wires.at(-1); w.burnt = false; w.cable = null; });
}
await page.click('.toolbar [data-a=run]'); await page.waitForTimeout(500);
s = await st();
check(s.running && !s.paused && s.mode === 'operate' && s.seg === 'operate', 'Run → Operate');
const c1 = s.closed;
await tap(await at('body'));
s = await st();
check(s.closed === !c1, 'Running in Operate: tap flips the switch');
await page.click('.mseg[data-mode=wire]'); await page.waitForTimeout(200);
await tap(await at('body'));
s = await st();
check(s.mode === 'wire' && s.running && s.closed === !c1 && s.sel, 'Running, Wire picked by hand: tap selects, does not flip');
await page.click('.toolbar [data-a=run]'); await page.waitForTimeout(300);
s = await st();
check(s.paused && s.mode === 'wire', 'Pause → Wire');
await page.click('.toolbar [data-a=run]'); await page.waitForTimeout(300);
s = await st();
check(!s.paused && s.mode === 'operate', 'Resume → Operate');
// full screen keeps the switch reachable
await page.evaluate(() => window.app.editor.setFullscreen(true)); await page.waitForTimeout(500);
const vis = await page.evaluate(() => { const r = document.querySelector('.mode-seg').getBoundingClientRect(); return r.width > 40 && r.top >= 0 && r.right <= innerWidth; });
check(vis, 'the mode switch is on screen in full screen');
// a selected wire's bar never covers the ☰ handle or the mode switch, and once hidden it is fully gone
const clash = () => page.evaluate(() => {
  const r = (s) => document.querySelector('.editor ' + s).getBoundingClientRect();
  const hit = (a, b) => a.width && b.width && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const sb = r('.selbar');
  return { over: hit(sb, r('.mode-seg')) || hit(sb, r('.fs-handle')) || hit(sb, r('.hud-status')), out: sb.left < 0 || sb.right > innerWidth, vis: getComputedStyle(document.querySelector('.editor .selbar')).visibility };
});
for (const fsOn of [true, false]) {
  await page.evaluate((on) => { const ed = window.app.editor; ed.setFullscreen(on); ed.selectWire(ed.doc.wires[0]); }, fsOn); await page.waitForTimeout(500);
  let c = await clash();
  check(!c.over && !c.out && c.vis === 'visible', `${fsOn ? 'full screen' : 'normal'}: the wire bar stays clear of the top controls ${JSON.stringify(c)}`);
  await page.evaluate(() => window.app.editor.select(null)); await page.waitForTimeout(500);
  c = await clash();
  check(c.vis === 'hidden', `${fsOn ? 'full screen' : 'normal'}: the hidden wire bar leaves nothing on screen`);
}
await page.evaluate(() => window.app.editor.setFullscreen(false));
check(!errs.length, `no page errors ${errs.join(' | ')}`);
await browser.close(); server.close();
if (fail) { console.log(`FAIL (${fail})`); process.exit(1); }
console.log('all ok');
