// Slanted parts and straight wires on the board: a part slanted 45° from its quick bar keeps its
// terminals on grid points; with straight wires on, tapping two terminals draws one straight
// (slanting) wire that joins them; a delta built so runs, and saving keeps the slant.
// Usage: npm run build && node tests/slant-ui.mjs [screenshot.png]
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const server = http.createServer((req, res) => { const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' }); fs.createReadStream(f).pipe(res); }).listen(0);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForTimeout(2300);
const checks = []; const ok = (n, v) => checks.push([n, !!v]);
await page.evaluate(() => { localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true, selectHelp: true, tapWireHelp: true })); app.newCircuit(); });
await page.waitForTimeout(900);
// a 6 V source, and three resistors to make a delta of: R1 and R2 to be slanted, R3 level
await page.evaluate(() => {
  const ed = app.editor, d = ed.doc;
  const v = ed.makeEl('dcv', -120, 120); v.rot = 1; v.p.amp = 6;
  const r1 = ed.makeEl('resistor', 0, 60), r2 = ed.makeEl('resistor', 120, 60), r3 = ed.makeEl('resistor', 60, 200);
  r1.p.r = 100; r2.p.r = 200; r3.p.r = 300;
  for (const e of [v, r1, r2, r3]) d.add(e);
  d.assignNames(); ed.topologyChanged(); ed.fit(); ed.dirtyDraw = true;
});
await page.waitForTimeout(400);
const screen = (w) => page.evaluate((w) => { const ed = app.editor, r = ed.canvas.getBoundingClientRect(), [x, y] = ed.renderer.toScreen(w[0], w[1]); return [r.left + x, r.top + y]; }, w);
const post = (name, k) => page.evaluate(([n, k]) => app.editor.doc.elements.find((e) => e.name === n).getPosts()[k], [name, k]);
const centre = (name) => page.evaluate((n) => { const e = app.editor.doc.elements.find((x) => x.name === n); return e.toWorld(0, 0); }, name);
const tapW = async (w) => { const [x, y] = await screen(w); await page.touchscreen.tap(x, y); await page.waitForTimeout(300); };

// ---- slant R1 and R2 from the quick bar
for (const name of ['R1', 'R2']) {
  await tapW(await centre(name));
  ok(`${name}: its quick bar offers Slant`, await page.isVisible('.quickbar [data-q=slant]'));
  await page.click('.quickbar [data-q=slant]'); await page.waitForTimeout(300);
}
const slanted = await page.evaluate(() => ['R1', 'R2'].map((n) => { const e = app.editor.doc.elements.find((x) => x.name === n); return { diag: e.diag, posts: e.getPosts() }; }));
ok('both are slanted', slanted.every((s) => s.diag));
ok('a slanted part\'s terminals sit on grid points, a diagonal step apart', slanted.every((s) => s.posts.every(([x, y]) => x % 20 === 0 && y % 20 === 0) && Math.abs(s.posts[0][0] - s.posts[1][0]) === Math.abs(s.posts[0][1] - s.posts[1][1])));
await page.evaluate(() => { app.editor.rotateSelection(); });
await page.waitForTimeout(200);
ok('Rotate turns a slanted part onto the other diagonal, still slanted', await page.evaluate(() => { const e = app.editor.doc.elements.find((x) => x.name === 'R2'); const [p, q] = e.getPosts(); return e.diag && (p[0] - q[0]) * (p[1] - q[1]) < 0; }));
ok('an op amp cannot be slanted (its terminals are not in line)', await page.evaluate(() => !app.editor.makeEl('opamp', 0, 0).canSlant()));

// ---- straight wires: one tap of the toggle, then tap two terminals
await page.evaluate(() => app.editor.select(null));
await page.click('[data-a=straight]'); await page.waitForTimeout(300);
ok('the straight-wire toggle is on', await page.evaluate(() => app.settings.straightWires && document.querySelector('[data-a=straight]').classList.contains('active')));
const wire = async (a, b) => { await tapW(a); await tapW(b); };
// the delta: R1's top to R2's top, R1's bottom to R3's left, R2's bottom to R3's right; the source across R1's ends
await wire(await post('R1', 0), await post('R2', 0));
await wire(await post('R1', 1), await post('R3', 0));
await wire(await post('R2', 1), await post('R3', 1));
await wire(await post('V1', 0), await post('R1', 0));
await wire(await post('V1', 1), await post('R1', 1));
const ws = await page.evaluate(() => app.editor.doc.wires.map((w) => w.pts));
ok('five wires drawn, each one straight segment', ws.length === 5 && ws.every((p) => p.length === 2));
ok('some of them slant', ws.some(([a, b]) => a[0] !== b[0] && a[1] !== b[1]));
// ---- run it: 6 V across R1 (100 Ω) and across R2 + R3 (500 Ω)
await page.evaluate(() => app.editor.setRunning(true));
await page.waitForTimeout(1200);
const I = await page.evaluate(() => Object.fromEntries(app.editor.doc.elements.filter((e) => e.constructor.type === 'resistor').map((e) => [e.name, Math.abs(e.i)])));
ok(`R1 carries 60 mA (${(I.R1 * 1e3).toFixed(2)} mA)`, Math.abs(I.R1 - 0.06) < 1e-4);
ok(`R2 and R3 carry 12 mA (${(I.R2 * 1e3).toFixed(2)}, ${(I.R3 * 1e3).toFixed(2)} mA)`, Math.abs(I.R2 - 0.012) < 1e-4 && Math.abs(I.R3 - 0.012) < 1e-4);
await page.screenshot({ path: process.argv[2] || '/dev/null' }).catch(() => {});
// ---- saved and opened again: still slanted
const again = await page.evaluate(() => { const o = JSON.parse(JSON.stringify(app.editor.doc.elements.map((e) => e.toJSON()))); return o.filter((x) => x.s).length; });
ok('saving keeps the slant', again === 2);
ok('no page errors', errs.length === 0);
for (const [n, v] of checks) console.log(`${v ? 'ok  ' : 'FAIL'} ${n}`);
if (errs.length) console.log(errs.join('\n'));
console.log(checks.every(([, v]) => v) ? 'all passed' : 'FAILED');
await browser.close(); server.close();
process.exit(checks.every(([, v]) => v) ? 0 : 1);
