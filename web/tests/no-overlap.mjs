// Parts never land on each other: dragging one onto another stops it at the last free spot,
// so no terminals join by accident; duplicates go to a free spot. Usage: npm run build && node tests/no-overlap.mjs
// Usage: npm run build && node tests/move-connectivity.mjs [exampleIds] [partNames]
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const server = http.createServer((req, res) => { const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' }); fs.createReadStream(f).pipe(res); }).listen(0);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 2 })).newPage();
await page.addInitScript(() => localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true })));
await page.addInitScript(() => {
  // connectivity signature: which terminals share a net (same rules as the simulator)
  window.netSig = () => {
    const d = app.editor.doc, par = new Map();
    const k = (p) => p[0] + ',' + p[1];
    const f = (x) => { if (!par.has(x)) par.set(x, x); while (par.get(x) !== x) { par.set(x, par.get(par.get(x))); x = par.get(x); } return x; };
    const u = (a, b) => par.set(f(a), f(b));
    const pts = [];
    for (const w of d.wires) w.pts.forEach((p, i) => { pts.push(p); if (i) u(k(w.pts[i - 1]), k(p)); });
    for (const e of d.elements) for (const p of e.getPosts()) { pts.push(p); f(k(p)); }
    for (const w of d.wires) for (let i = 1; i < w.pts.length; i++) {
      const [a, b] = [w.pts[i - 1], w.pts[i]];
      for (const p of pts) {
        const cr = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
        if (Math.abs(cr) > 1e-6) continue;
        const dot = (p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1]), l2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
        if (dot >= 0 && dot <= l2) u(k(p), k(a));
      }
    }
    const lab = new Map(); const out = [];
    for (const e of d.elements) out.push(e.name + ':' + e.getPosts().map((p) => { const r = f(k(p)); if (!lab.has(r)) lab.set(r, lab.size); return lab.get(r); }).join('.'));
    return out.join(' ');
  };
});
await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForTimeout(1800);
const G = 20;
const scr = (x, y) => page.evaluate(([x, y]) => { const r = app.editor.canvas.getBoundingClientRect(); const [sx, sy] = app.editor.renderer.toScreen(x, y); return [sx + r.left, sy + r.top]; }, [x, y]);
// every example: move every part by a few offsets and check the netlist never changes
const checks = []; const ok = (n, v) => checks.push([n, !!v]);
const hits = () => page.evaluate(() => { const els = app.editor.doc.elements.filter((e) => e.constructor.type !== 'label'); const out = [];
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) { const a = els[i].worldBox(), b = els[j].worldBox();
    if (a[0] + 2 < b[2] && a[2] - 2 > b[0] && a[1] + 2 < b[3] && a[3] - 2 > b[1]) out.push(els[i].name + '/' + els[j].name); } return out.join(','); });
const drag = async (from, to) => { const a = await scr(...from), b = await scr(...to); await page.mouse.move(...a); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(a[0] + (b[0] - a[0]) * i / 10, a[1] + (b[1] - a[1]) * i / 10); await page.mouse.up(); await page.waitForTimeout(100); };
// a fresh board with two resistors side by side, not connected
await page.evaluate(() => { app.goHome(); app.newCircuit ? app.newCircuit() : app.openExample('rc'); });
await page.waitForTimeout(400);
await page.evaluate(() => { const ed = app.editor; ed.doc.elements.length = 0; ed.doc.wires.length = 0;
  const a = ed.makeEl('resistor', 0, 0), b = ed.makeEl('resistor', 0, 100); ed.doc.add(a); ed.doc.add(b); ed.doc.assignNames(); ed.topologyChanged(); ed.renderer.scale = 2; ed.renderer.ox = 200; ed.renderer.oy = 300; ed.dirtyDraw = true; });
await page.waitForTimeout(200);
const sig0 = await page.evaluate(() => netSig());
ok('no floating full-screen button on the board', (await page.locator('.stage-fs').count()) === 0);
await page.evaluate(() => { const ed = app.editor; window.TOASTS = []; const t = ed.toast.bind(ed); ed.toast = (m) => { TOASTS.push(m); t(m); }; });
await drag([0, 100], [0, 0]); // straight onto R1
ok('dragged part does not sit on the other part', (await hits()) === '');
ok('no terminals joined', (await page.evaluate(() => netSig())) === sig0);
const y = await page.evaluate(() => app.editor.doc.elements[1].y);
ok('it stopped short of the other part', y > 0 && y <= 100);
await drag([0, y], [80, y]); // end to end: terminal onto terminal
await drag([80, y], [80, 0]);
ok('terminal onto terminal is refused', (await page.evaluate(() => netSig())) === sig0 && (await hits()) === '');
await drag([0, 0], [0, -200]); // free space is still free
ok('a move into free space works', (await page.evaluate(() => app.editor.doc.elements[0].y)) === -200);
// dragging past an obstacle into free space on the other side
await page.evaluate(() => { const e = app.editor.doc.elements; e[0].x = 0; e[0].y = 0; e[1].x = 0; e[1].y = 100; app.editor.topologyChanged(); });
await drag([0, 100], [0, -100]);
ok('a part can be dragged over another into free space', (await page.evaluate(() => app.editor.doc.elements[1].y)) === -100 && (await hits()) === '');
const tips = await page.evaluate(() => TOASTS.filter((m) => m.includes('cannot sit')).length);
ok('the overlap message is shown only once (' + tips + ')', tips === 1);
// duplicate goes to a free spot
await page.evaluate(() => { const ed = app.editor; ed.select(ed.doc.elements[0]); ed.duplicateSelection(); });
ok('duplicate lands on a free spot', (await hits()) === '' && (await page.evaluate(() => app.editor.doc.elements.length)) === 3);
// an example: drag every part onto its neighbour, nothing may overlap or join
await page.evaluate(() => { app.goHome(); app.openExample('phasefail'); app.editor.setRunning(false); app.editor.fit(); });
await page.waitForTimeout(400);
const before = await page.evaluate(() => netSig()), h0 = await hits();
const pairs = await page.evaluate(() => { const els = app.editor.doc.elements.filter((e) => e.getPosts().length); return els.slice(0, 12).map((e, i) => [[e.x, e.y], [els[(i + 1) % els.length].x, els[(i + 1) % els.length].y]]); });
for (const [a, b] of pairs) { await drag(a, b); }
ok('example: dragging parts onto each other joins nothing', (await page.evaluate(() => netSig())) === before);
const h1 = await hits(); ok('example: no new overlaps', h1.split(',').every((p) => !p || h0.split(',').includes(p))); if (h1 !== h0) console.log('overlaps before:', h0, '| after:', h1);
let fails = 0;
for (const [n, v] of checks) { if (!v) fails++; console.log(v ? 'ok  ' : 'FAIL', n); }
console.log(fails ? `${fails} FAILED` : 'all passed');
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
