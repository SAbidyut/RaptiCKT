// Opens examples, drags a few parts around and screenshots how the wires follow.
// Usage: npm run build && node tests/move-example.mjs <outdir>
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const out = process.argv[2] || 'shots'; fs.mkdirSync(out, { recursive: true });
const root = path.resolve('dist');
const server = http.createServer((req, res) => { const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' }); fs.createReadStream(f).pipe(res); }).listen(0);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 2 })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.addInitScript(() => localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true })));
await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForTimeout(1800);
const G = 20;
const scr = (x, y) => page.evaluate(([x, y]) => { const r = app.editor.canvas.getBoundingClientRect(); const [sx, sy] = app.editor.renderer.toScreen(x, y); return [sx + r.left, sy + r.top]; }, [x, y]);
const drag = async (a, b) => { await page.mouse.move(a[0], a[1]); await page.mouse.down(); for (let i = 1; i <= 12; i++) await page.mouse.move(a[0] + (b[0] - a[0]) * i / 12, a[1] + (b[1] - a[1]) * i / 12); await page.mouse.up(); await page.waitForTimeout(150); };
const plan = process.argv[3] ? JSON.parse(process.argv[3]) : { ceamp: [['Q1', 3, 2], ['R2', -3, 0]], bridge: [['C1', 3, 3], ['D1', 0, -2]], relay: [['LP1', 4, 0], ['K1', 0, 3]], housewiring: [['LP1', -4, 2], ['SO1', 2, 3]] };
for (const [id, moves] of Object.entries(plan)) {
  await page.evaluate((id) => { app.goHome(); app.openExample(id); app.editor.setRunning(false); }, id);
  await page.waitForTimeout(700);
  let k = 0;
  await page.screenshot({ path: path.join(out, `${id}-${k++}.png`) });
  for (const [name, dx, dy] of moves) {
    const e = await page.evaluate((n) => { const el = app.editor.doc.elements.find((x) => x.name === n); return el ? [el.x, el.y] : null; }, name);
    if (!e) { console.log('missing', id, name); continue; }
    await drag(await scr(e[0], e[1]), await scr(e[0] + dx * G, e[1] + dy * G));
    await page.evaluate(() => { app.editor.select(null); app.editor.dirtyDraw = true; });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(out, `${id}-${k++}.png`) });
  }
}
console.log(errs.length ? errs.join('\n') : 'no errors');
await browser.close(); server.close();
