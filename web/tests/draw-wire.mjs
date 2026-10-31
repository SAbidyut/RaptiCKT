// Drawing a wire with a finger: drag from a terminal along any path to another terminal, and the
// wire follows the path in straight runs (no curves): corners where the finger turned, on grid
// points, runs drawn nearly level, upright or at 45° made exactly so. A path over another
// terminal is laid round it instead. Dragging a part's body still moves it.
// Usage: npm run build && node tests/draw-wire.mjs [screenshot.png]
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const server = http.createServer((req, res) => { const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' }); fs.createReadStream(f).pipe(res); }).listen(0);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForTimeout(2300);
const checks = []; const ok = (n, v) => checks.push([n, !!v]);
await page.evaluate(() => { localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true, selectHelp: true, tapWireHelp: true, noOverlapTip: true })); app.newCircuit(); });
await page.waitForTimeout(900);
// R1 level at the top left, R2 upright lower right, R3 level at the bottom left, R4 out of the way
await page.evaluate(() => {
  const ed = app.editor, d = ed.doc;
  const r1 = ed.makeEl('resistor', 0, 0), r2 = ed.makeEl('resistor', 200, 140), r3 = ed.makeEl('resistor', 0, 240), r4 = ed.makeEl('resistor', 140, 300);
  r2.rot = 1;
  for (const e of [r1, r2, r3, r4]) d.add(e);
  d.assignNames(); ed.topologyChanged(); ed.renderer.fit([-80, -60, 280, 340], 30, 60, 60); ed.dirtyDraw = true;
});
await page.waitForTimeout(400);
const screen = (w) => page.evaluate((w) => { const ed = app.editor, r = ed.canvas.getBoundingClientRect(), [x, y] = ed.renderer.toScreen(w[0], w[1]); return [r.left + x, r.top + y]; }, w);
const post = (name, k) => page.evaluate(([n, k]) => app.editor.doc.elements.find((e) => e.name === n).getPosts()[k], [name, k]);
// a finger path through world points, with a little wobble (a hand is never exact)
const draw = async (pts) => {
  const s = []; for (const p of pts) s.push(await screen(p));
  await page.mouse.move(...s[0]); await page.mouse.down();
  for (let i = 1; i < s.length; i++) for (let k = 1; k <= 10; k++) {
    const t = k / 10, x = s[i - 1][0] + (s[i][0] - s[i - 1][0]) * t, y = s[i - 1][1] + (s[i][1] - s[i - 1][1]) * t;
    await page.mouse.move(x + Math.sin(k * 1.7) * 1.5, y + Math.cos(k * 2.3) * 1.5);
  }
  await page.mouse.up(); await page.waitForTimeout(300);
};
const last = () => page.evaluate(() => { const w = app.editor.doc.wires; return w.length ? w[w.length - 1].pts : null; });
const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];

// ---- R1's right end, right along the top, then down to R2's top: an L
const a1 = await post('R1', 1), b1 = await post('R2', 0);
await draw([a1, [b1[0] + 3, a1[1] - 2], b1]);
let w = await last();
ok(`drawn right then down: one wire of two straight runs (${JSON.stringify(w)})`, w && w.length === 3 && same(w[0], a1) && same(w[2], b1) && w[1][1] === a1[1] && w[1][0] === b1[0]);
// ---- R3's right end straight up-right to R2's bottom: one straight slanting wire
const a2 = await post('R3', 1), b2 = await post('R2', 1);
await draw([a2, b2]);
w = await last();
ok(`drawn straight across: one straight wire (${JSON.stringify(w)})`, w && w.length === 2 && same(w[0], a2) && same(w[1], b2));
ok('no curves: every wire a few straight runs, its corners on grid points', await page.evaluate(() => app.editor.doc.wires.every((w) => w.pts.length <= 4 && w.pts.every(([x, y]) => x % 20 === 0 && y % 20 === 0))));
// ---- a path across R4's terminal would join it: laid round it instead
const a3 = await post('R3', 0), r4 = await post('R4', 0);
await draw([a3, [a3[0], r4[1]], r4, [r4[0] + 140, r4[1]]]);
const n4 = await page.evaluate(() => { const e = app.editor.doc.elements.find((x) => x.name === 'R4'); const [p, q] = e.getPosts(); return app.editor.doc.wires.filter((w) => w.pts.some((r, i) => (r[0] === p[0] && r[1] === p[1]) || (i && Math.abs((r[0] - w.pts[i - 1][0]) * (p[1] - w.pts[i - 1][1]) - (r[1] - w.pts[i - 1][1]) * (p[0] - w.pts[i - 1][0])) < 1e-6 && (p[0] - w.pts[i - 1][0]) * (p[0] - r[0]) <= 0 && (p[1] - w.pts[i - 1][1]) * (p[1] - r[1]) <= 0))).length; });
ok(`a wire drawn over R4's terminal does not join it (${n4})`, n4 === 0);
// ---- the part's body dragged still moves the part
const c1 = await page.evaluate(() => { const e = app.editor.doc.elements.find((x) => x.name === 'R1'); return [e.x, e.y]; });
const [sx, sy] = await screen(c1), [tx, ty] = await screen([c1[0], c1[1] - 60]);
await page.mouse.move(sx, sy); await page.mouse.down();
for (let k = 1; k <= 8; k++) await page.mouse.move(sx, sy + (ty - sy) * k / 8);
await page.mouse.up(); await page.waitForTimeout(300);
ok('dragging a part by its body still moves it', await page.evaluate(([x, y]) => { const e = app.editor.doc.elements.find((q) => q.name === 'R1'); return e.x === x && e.y === y - 60; }, c1));
// ---- undo takes a drawn wire away
const nw = await page.evaluate(() => app.editor.doc.wires.length);
await page.evaluate(() => { app.editor.undo(); app.editor.undo(); });
ok('Undo takes a drawn wire away', await page.evaluate((n) => app.editor.doc.wires.length < n, nw));
await page.screenshot({ path: process.argv[2] || '/dev/null' }).catch(() => {});
ok('no page errors', errs.length === 0);
for (const [n, v] of checks) console.log(`${v ? 'ok  ' : 'FAIL'} ${n}`);
if (errs.length) console.log(errs.join('\n'));
console.log(checks.every(([, v]) => v) ? 'all passed' : 'FAILED');
await browser.close(); server.close();
process.exit(checks.every(([, v]) => v) ? 0 : 1);
