// Drags a wired voltmeter around a transformer (like moving parts by hand) and
// screenshots how the attached wires follow. Usage: node tests/drag-route.mjs <outdir>
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const out = process.argv[2] || 'shots';
fs.mkdirSync(out, { recursive: true });
const root = path.resolve('dist');
const server = http.createServer((req, res) => {
  const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1));
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 2 })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.evaluate(() => localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true })));
await page.waitForTimeout(2200);
const G = 20;
await page.evaluate((d) => window.raptiOpenText('t.rckt', JSON.stringify(d)), {
  name: 'Drag test', elements: [{ t: 'xfmrct', x: 0, y: 0 }, { t: 'voltmeter', x: 6 * G, y: -2 * G, r: 1 }], wires: [], probes: [],
});
await page.waitForTimeout(600);
// wire the voltmeter across the upper secondary half by drawing wires with the finger
const scr = (x, y) => page.evaluate(([x, y]) => { const r = app.editor.canvas.getBoundingClientRect(); const [sx, sy] = app.editor.renderer.toScreen(x, y); return [sx + r.left, sy + r.top]; }, [x, y]);
const drag = async (a, b) => { await page.mouse.move(a[0], a[1]); await page.mouse.down(); for (let i = 1; i <= 10; i++) await page.mouse.move(a[0] + (b[0] - a[0]) * i / 10, a[1] + (b[1] - a[1]) * i / 10); await page.mouse.up(); await page.waitForTimeout(150); };
const posts = () => page.evaluate(() => app.editor.doc.elements.map((e) => e.getPosts()));
let P = await posts();
await drag(await scr(...P[0][2]), await scr(...P[1][0]));
await drag(await scr(...P[0][3]), await scr(...P[1][1]));
await page.evaluate(() => { app.editor.fit(); app.editor.dirtyDraw = true; });
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(out, 'drag-0.png') });
const moves = [[0, 4], [-3, 7], [4, 3], [-8, 2], [3, -5]];
let i = 1;
for (const [dx, dy] of moves) {
  const e = await page.evaluate(() => { const v = app.editor.doc.elements[1]; return [v.x, v.y]; });
  await drag(await scr(e[0], e[1]), await scr(e[0] + dx * G, e[1] + dy * G));
  await page.waitForTimeout(200);
  const info = await page.evaluate(() => ({ wires: app.editor.doc.wires.map((w) => w.pts.length), conn: app.editor.sim && !app.editor.sim.error }));
  console.log('move', dx, dy, JSON.stringify(info));
  await page.evaluate(() => { app.editor.fit(); app.editor.dirtyDraw = true; });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(out, `drag-${i++}.png`) });
}
console.log(errs.length ? errs.join('\n') : 'no errors');
await browser.close(); server.close();
