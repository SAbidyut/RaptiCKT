// Slanted parts and straight wires on the board, at any angle: Slant turns a part 15° at a time,
// the properties sheet takes any angle, dragging a selected part's terminal slants and stretches
// it; its terminals always sit on grid points. With slanting on, tapping two terminals draws one
// straight (slanting) wire, and a part moved between two straight wires turns to lie along the
// line between their far ends (on it when dropped near it), its wires straight and in line with
// it. A delta built so runs, and saving keeps the slant.
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
await page.evaluate(() => { localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true, selectHelp: true, tapWireHelp: true, noOverlapTip: true })); app.newCircuit(); });
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
const part = (n) => page.evaluate((n) => { const e = app.editor.doc.elements.find((x) => x.name === n); return { sv: e.sv, posts: e.getPosts(), deg: Math.round(e.boardAngle() * 180 / Math.PI) }; }, n);
const onGrid = (ps) => ps.every(([x, y]) => x % 20 === 0 && y % 20 === 0);
// a finger drag on the board, in steps
const drag = async (from, to) => {
  const [x0, y0] = await screen(from), [x1, y1] = await screen(to);
  await page.mouse.move(x0, y0); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(x0 + ((x1 - x0) * i) / 12, y0 + ((y1 - y0) * i) / 12);
  await page.mouse.up();
  await page.waitForTimeout(300);
};

// ---- Slant from the quick bar: 15° a tap, any angle round
await tapW(await centre('R1'));
ok('R1: its quick bar offers Slant', await page.isVisible('.quickbar [data-q=slant]'));
await page.click('.quickbar [data-q=slant]'); await page.waitForTimeout(300);
let r1 = await part('R1');
ok(`one tap: 15° (${r1.deg}°), its terminals on grid points`, Math.abs(r1.deg - 15) <= 2 && r1.sv && onGrid(r1.posts));
await page.click('.quickbar [data-q=slant]'); await page.waitForTimeout(300);
r1 = await part('R1');
ok(`two taps: 30° (${r1.deg}°)`, Math.abs(r1.deg - 30) <= 2 && onGrid(r1.posts));
// ---- any angle typed in the properties sheet
await page.click('.quickbar [data-q=edit]'); await page.waitForTimeout(400);
ok('the sheet has an Angle field', await page.isVisible('.insp-angle input'));
await page.fill('.insp-angle input', '-37'); await page.press('.insp-angle input', 'Enter'); await page.dispatchEvent('.insp-angle input', 'change'); await page.waitForTimeout(300);
r1 = await part('R1');
ok(`typed −37°: slanted ${r1.deg}° (within a few degrees)`, Math.abs(r1.deg + 37) <= 3 && onGrid(r1.posts));
ok('the sheet shows the new angle', await page.evaluate(() => document.querySelector('.insp-angle input').value) === String(r1.deg));
await page.evaluate(() => app.editor.inspector.closeSheet()); await page.waitForTimeout(300);
// ---- R2: drag its right terminal (it is selected) to any grid point: it slants and stretches
await tapW(await centre('R2'));
const p2 = await post('R2', 1), q2 = await post('R2', 0);
await drag(p2, [p2[0] + 20, p2[1] + 60]);
let r2 = await part('R2');
ok(`dragging R2's terminal moved only that terminal (${JSON.stringify(r2.posts)})`, r2.posts[1][0] === p2[0] + 20 && r2.posts[1][1] === p2[1] + 60 && r2.posts[0][0] === q2[0] && r2.posts[0][1] === q2[1]);
ok(`R2 slanted to the angle dragged to (${r2.deg}°)`, r2.sv && Math.abs(r2.deg - Math.round(Math.atan2(60, 100) * 180 / Math.PI)) <= 1);
await page.evaluate(() => app.editor.rotateSelection());
await page.waitForTimeout(200);
r2 = await part('R2');
ok(`Rotate turns a slanted part a quarter turn, still slanted (${r2.deg}°), on grid points`, r2.sv && Math.abs(r2.deg - (Math.round(Math.atan2(60, 100) * 180 / Math.PI) + 90)) <= 1 && onGrid(r2.posts));
await page.evaluate(() => app.editor.rotateSelection()); await page.evaluate(() => app.editor.rotateSelection()); await page.evaluate(() => app.editor.rotateSelection());
ok('an op amp cannot be slanted (its terminals are not in line)', await page.evaluate(() => !app.editor.makeEl('opamp', 0, 0).canSlant()));

// ---- the slant steps above done, a delta laid out with room, as a textbook draws one: the
// source, R1 and R2 slanting up to a top corner, R3 level along the bottom
await page.evaluate(() => {
  const ed = app.editor, d = ed.doc;
  d.elements = d.elements.filter((e) => e.name === 'V1' || e.name === 'R1' || e.name === 'R2' || e.name === 'R3');
  d.wires = [];
  const at = (n, [x0, y0], [x1, y1]) => { const e = d.elements.find((x) => x.name === n); e.setSlant([(x1 - x0) / 20, (y1 - y0) / 20]); e.x = (x0 + x1) / 2; e.y = (y0 + y1) / 2; e.snapPosts(); };
  at('R1', [20, 160], [80, 60]); at('R2', [160, 60], [220, 160]); at('R3', [80, 240], [160, 240]);
  const v = d.elements.find((x) => x.name === 'V1'); v.setSlant(null); v.rot = 1; v.x = -100; v.y = 140;
  ed.topologyChanged(); ed.fit(); ed.dirtyDraw = true;
});
await page.waitForTimeout(400);
// ---- straight wires: one tap of the toggle, then tap two terminals
await page.evaluate(() => app.editor.select(null));
await page.click('[data-a=straight]'); await page.waitForTimeout(300);
ok('the slanting toggle is on', await page.evaluate(() => app.settings.straightWires && document.querySelector('[data-a=straight]').classList.contains('active')));
const wire = async (a, b) => { await tapW(a); await tapW(b); };
// the delta: R1's top to R2's top, R1's bottom to R3's left, R2's bottom to R3's right; the source across R1's ends
await wire(await post('R1', 1), await post('R2', 0));
await wire(await post('R1', 0), await post('R3', 0));
await wire(await post('R2', 1), await post('R3', 1));
await wire(await post('V1', 0), await post('R1', 1));
await wire(await post('V1', 1), await post('R1', 0));
const ws = await page.evaluate(() => app.editor.doc.wires.map((w) => w.pts));
ok(`five wires drawn (${ws.length})`, ws.length === 5);
const neat = (pts) => pts.every((q, i) => { if (!i) return true; const dx = Math.abs(q[0] - pts[i - 1][0]), dy = Math.abs(q[1] - pts[i - 1][1]); return pts.length === 2 || !dx || !dy || dx === dy; });
ok(`each wire straight, or level, upright and 45° runs (${ws.map((p) => p.length).join(',')} points)`, ws.every(neat));
ok('the corners joined by straight slanting wires', ws.filter((p) => p.length === 2 && p[0][0] !== p[1][0] && p[0][1] !== p[1][1]).length >= 2);
ok('no wire crosses a part', await page.evaluate(() => {
  const d = app.editor.doc;
  return d.wires.every((w) => w.pts.every((q, i) => !i || !d.elements.some((e) => { const P = e.worldPoly(), a = w.pts[i - 1]; for (let t = 0.1; t < 0.9; t += 0.05) { const x = a[0] + (q[0] - a[0]) * t, y = a[1] + (q[1] - a[1]) * t; let inside = true; for (let k = 0; k < 4; k++) { const [p1, p2] = [P[k], P[(k + 1) % 4]]; if ((p2[0] - p1[0]) * (y - p1[1]) - (p2[1] - p1[1]) * (x - p1[0]) <= 0.5) { inside = false; break; } } if (inside) return true; } return false; })));
}));
// ---- run it: 6 V across R1 (100 Ω) and across R2 + R3 (500 Ω)
await page.evaluate(() => app.editor.setRunning(true));
await page.waitForTimeout(1200);
let I = await page.evaluate(() => Object.fromEntries(app.editor.doc.elements.filter((e) => e.constructor.type === 'resistor').map((e) => [e.name, Math.abs(e.i)])));
ok(`R1 carries 60 mA (${(I.R1 * 1e3).toFixed(2)} mA)`, Math.abs(I.R1 - 0.06) < 1e-4);
ok(`R2 and R3 carry 12 mA (${(I.R2 * 1e3).toFixed(2)}, ${(I.R3 * 1e3).toFixed(2)} mA)`, Math.abs(I.R2 - 0.012) < 1e-4 && Math.abs(I.R3 - 0.012) < 1e-4);
await page.evaluate(() => app.editor.setRunning(false));
await page.screenshot({ path: process.argv[2] || '/dev/null' }).catch(() => {});

// ---- auto-slant: a resistor between two points joined by straight wires, moved near the line
// between them, turns along it and lies on it; moved away, it stays along that line's angle
const auto = await page.evaluate(() => {
  const ed = app.editor, d = ed.doc;
  const r = ed.makeEl('resistor', 400, 300); d.add(r); d.assignNames();
  const [a, b] = r.getPosts();
  // far ends: 8 steps left and 2 up, 8 steps right and 2 down of the part's ends (a slope of 1:4… along A→B)
  const A = [a[0] - 160, a[1] - 100], B = [b[0] + 160, b[1] + 100];
  d.addWire([A, a]); d.addWire([b, B]);
  ed.topologyChanged(); ed.fit(); ed.dirtyDraw = true;
  return { name: r.name, A, B, c: r.toWorld(0, 0) };
});
await page.waitForTimeout(300);
await drag(auto.c, [auto.c[0] + 20, auto.c[1] + 20]);
let ra = await part(auto.name);
const lineDeg = Math.round(Math.atan2(auto.B[1] - auto.A[1], auto.B[0] - auto.A[0]) * 180 / Math.PI);
ok(`moved near the line between its wires' ends, ${auto.name} turns along it (${ra.deg}° vs ${lineDeg}°)`, Math.abs(ra.deg - lineDeg) <= 1 && onGrid(ra.posts));
const inLine = await page.evaluate(([n, A, B]) => {
  const e = app.editor.doc.elements.find((x) => x.name === n), ps = e.getPosts();
  const cross = (p) => (B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0]);
  const ws = app.editor.doc.wires.filter((w) => ps.some((p) => w.pts.some((q) => q[0] === p[0] && q[1] === p[1])));
  return ps.every((p) => Math.abs(cross(p)) < 1e-6) && ws.length === 2 && ws.every((w) => w.pts.length === 2);
}, [auto.name, auto.A, auto.B]);
ok('…and lies on that line, its two wires straight and in line with it', inLine);
await drag((await part(auto.name)).posts.reduce((s, p) => [s[0] + p[0] / 2, s[1] + p[1] / 2], [0, 0]), [auto.c[0] + 20, auto.c[1] + 160]);
ra = await part(auto.name);
const off = await page.evaluate((n) => { const e = app.editor.doc.elements.find((x) => x.name === n); const ps = e.getPosts(); return app.editor.doc.wires.filter((w) => ps.some((p) => w.pts.some((q) => q[0] === p[0] && q[1] === p[1]))).map((w) => w.pts.length); }, auto.name);
ok(`moved away from the line, it keeps along its angle (${ra.deg}°), its wires straight (${off})`, Math.abs(ra.deg - lineDeg) <= 4 && off.length === 2 && off.every((n) => n === 2) && onGrid(ra.posts));

// ---- saved: still slanted
const again = await page.evaluate(() => { const o = JSON.parse(JSON.stringify(app.editor.doc.elements.map((e) => e.toJSON()))); return o.filter((x) => x.v).length; });
ok(`saving keeps the slant (${again} slanted)`, again >= 3);
ok('no page errors', errs.length === 0);
for (const [n, v] of checks) console.log(`${v ? 'ok  ' : 'FAIL'} ${n}`);
if (errs.length) console.log(errs.join('\n'));
console.log(checks.every(([, v]) => v) ? 'all passed' : 'FAILED');
await browser.close(); server.close();
process.exit(checks.every(([, v]) => v) ? 0 : 1);
