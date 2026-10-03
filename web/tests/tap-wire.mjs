// EveryCircuit-style wiring: tap a terminal, then another terminal (or a wire / a part) to draw a wire.
// Usage: npm run build && node tests/tap-wire.mjs [shot.png]
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const server = http.createServer((req, res) => { const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' }); fs.createReadStream(f).pipe(res); }).listen(0);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForTimeout(2300);
const checks = []; const ok = (n, v) => checks.push([n, !!v]);
await page.evaluate(() => { localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true, selectHelp: true })); app.newCircuit(); });
await page.waitForTimeout(900);
// two resistors far apart, then fit
await page.evaluate(() => {
  const ed = app.editor, d = ed.doc;
  const a = ed.makeEl('resistor', 0, 0), b = ed.makeEl('resistor', 200, 120);
  d.add(a); d.add(b); d.assignNames(); ed.topologyChanged(); ed.fit(); ed.dirtyDraw = true;
});
await page.waitForTimeout(400);
// screen position of a world point
const at = (sel) => page.evaluate((sel) => {
  const ed = app.editor, R = ed.renderer, r = ed.canvas.getBoundingClientRect();
  const [i, k] = sel; const p = ed.doc.elements[i].getPosts()[k];
  const [x, y] = R.toScreen(p[0], p[1]); return [r.left + x, r.top + y];
}, sel);
const tapAt = async ([x, y]) => { await page.touchscreen.tap(x, y); await page.waitForTimeout(250); };
const wires = () => page.evaluate(() => app.editor.doc.wires.length);
const connected = () => page.evaluate(() => { const ed = app.editor; ed.rebuildNow(true); const s = ed.sim, A = ed.doc.elements[0].getPosts()[1], B = ed.doc.elements[1].getPosts()[0]; return s.pointNode(A[0], A[1]) === s.pointNode(B[0], B[1]); });

await tapAt(await at([0, 1]));
ok('first time: a hint says what to do next', (await page.locator('.screen.editor .toast').textContent()).includes('tap another terminal'));
ok('first tap on a terminal starts a wire', await page.evaluate(() => !!app.editor.wireFrom) && await wires() === 0);
await page.screenshot({ path: process.argv[2] || '/dev/null' }).catch(() => {});
await tapAt(await at([1, 0]));
ok('second tap on another terminal draws the wire', await wires() === 1 && await page.evaluate(() => !app.editor.wireFrom));
ok('the two terminals are now connected', await connected());
ok('the wire is made of right angles', await page.evaluate(() => app.editor.doc.wires[0].pts.every((p, i, a) => !i || p[0] === a[i - 1][0] || p[1] === a[i - 1][1])));
// cancel by tapping empty space
await tapAt(await at([0, 0]));
ok('tap a terminal again starts another', await page.evaluate(() => !!app.editor.wireFrom));
const empty = await page.evaluate(() => {
  const ed = app.editor, r = ed.canvas.getBoundingClientRect();
  for (let y = 60; y < r.height - 120; y += 15) for (let x = 20; x < r.width - 20; x += 15) if (ed.hitTest(x, y).kind === 'none') return [r.left + x, r.top + y];
  return null;
});
await tapAt(empty);
ok('tapping empty space cancels it', await page.evaluate(() => !app.editor.wireFrom) && await wires() === 1);
// Back cancels too
await tapAt(await at([0, 0]));
await page.evaluate(() => window.raptiBack()); await page.waitForTimeout(200);
ok('Back cancels a pending wire and stays in the editor', await page.evaluate(() => !app.editor.wireFrom && app.current === 'editor'));
// tap a terminal then a part body: goes to its nearest terminal
await tapAt(await at([0, 0]));
const body = await page.evaluate(() => { const ed = app.editor, R = ed.renderer, r = ed.canvas.getBoundingClientRect(), e = ed.doc.elements[1], c = e.toWorld(0, 0), [x, y] = R.toScreen(c[0], c[1]); return [r.left + x, r.top + y]; });
await tapAt(body);
ok('tap a part body: wire goes to its nearest terminal', await wires() === 2);
// undo removes the wire
await page.evaluate(() => app.editor.undo()); await page.waitForTimeout(150);
ok('Undo removes a tap-drawn wire', await wires() === 1);
// tapping a part still selects it
await tapAt(body);
ok('tapping a part body still selects it', await page.evaluate(() => app.editor.selected() === app.editor.doc.elements[1]));
// dragging from a terminal no longer draws a wire: it moves the part
const p0 = await at([0, 0]);
await page.evaluate(() => app.editor.select(null));
const before = await page.evaluate(() => [app.editor.doc.elements[0].x, app.editor.doc.elements[0].y]);
const drag = async ([x1, y1], [x2, y2]) => {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1 }] });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x1 + (x2 - x1) * i / 8, y: y1 + (y2 - y1) * i / 8 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(250);
};
await drag(p0, [p0[0], p0[1] + 80]);
const after = await page.evaluate(() => [app.editor.doc.elements[0].x, app.editor.doc.elements[0].y]);
ok('dragging from a terminal does not draw a wire', await wires() === 1);
ok('...it moves the part instead', after[1] !== before[1]);
// the how-to toast is shown only the first time
const toastAfter = async () => { await tapAt(await at([0, 0])); const t = await page.evaluate(() => document.querySelector('.screen.editor .toast').classList.contains('show') && document.querySelector('.screen.editor .toast').textContent); await page.evaluate(() => app.editor.cancelTapWire()); return t; };
await page.waitForTimeout(2500);
ok('the "tap another terminal" hint is not repeated', !(String(await toastAfter()).includes('tap another terminal')));
let fails = 0;
for (const [n, v] of checks) { if (!v) fails++; console.log(v ? 'ok  ' : 'FAIL', n); }
console.log(errs.length ? errs : 'no page errors', fails ? `${fails} FAILED` : 'all passed');
await browser.close(); server.close();
process.exit(fails || errs.length ? 1 : 0);
