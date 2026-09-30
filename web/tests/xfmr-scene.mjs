// Renders a mains -> 230V:12-0-12 transformer -> resistor + voltmeter scene (plus a lone ammeter)
// and prints the readings. Usage: node tests/xfmr-scene.mjs <outdir> [runSeconds]
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const out = process.argv[2] || 'shots';
const runMs = +(process.argv[3] || 3000);
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
const doc = {
  name: 'Transformer test', elements: [
    { t: 'mains', x: 0, y: 0, r: 1 },
    { t: 'xfmrct', x: 8 * G, y: 0 },
    { t: 'resistor', x: 16 * G, y: -4 * G, p: { r: 1000 } },
    { t: 'voltmeter', x: 16 * G, y: -8 * G },
    { t: 'ammeter', x: 8 * G, y: 10 * G },
  ], wires: [], probes: [],
};
await page.evaluate((d) => window.raptiOpenText('t.rckt', JSON.stringify(d)), doc);
await page.waitForTimeout(800);
await page.evaluate(() => {
  const ed = app.editor, els = ed.doc.elements;
  const P = (i) => els[i].getPosts();
  const [m, t, r, vm] = [P(0), P(1), P(2), P(3)];
  const W = (...pts) => ed.doc.addWire(pts);
  W(m[0], [m[0][0], t[0][1]], t[0]);
  W(m[1], [m[1][0], t[1][1]], t[1]);
  W(t[2], [r[0][0], t[2][1]], r[0]);
  W(t[3], [r[1][0], t[3][1]], r[1]);
  W(vm[0], r[0]); W(vm[1], r[1]);
  ed.needRebuild = true; ed.rebuildNow(true); ed.fit(); ed.dirtyDraw = true;
});
await page.click('[data-a=run]');
await page.waitForTimeout(runMs);
const info = await page.evaluate(() => {
  const ed = app.editor, s = ed.sim;
  return { t: s.t, speed: ed.speed, dt: ed.dt, vm: ed.doc.elements[3].v, vmShown: ed.doc.elements[3].display(ed.doc.elements[3].v), mode: ed.doc.elements[3].p.mode,
    status: document.querySelector('.hud-time, .status, .sim-time')?.textContent };
});
console.log(JSON.stringify(info));
await page.screenshot({ path: path.join(out, 'xfmr.png') });
console.log(errs.length ? errs.join('\n') : 'no errors');
await browser.close(); server.close();
