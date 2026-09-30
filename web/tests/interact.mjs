// Interaction test: builds a circuit with real pointer gestures.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const out = process.argv[2] || 'shots';
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
await page.click('[data-h=new]');
await page.waitForTimeout(500);
const add = async (type) => { await page.click(await page.locator('.fab').isVisible() && await page.evaluate(() => !document.querySelector('.editor').classList.contains('insp-open')) ? '.fab' : '.insp-head [data-a=add]'); await page.waitForTimeout(300); await page.fill('.search input', type); await page.waitForTimeout(200); await page.click('.pal-item'); await page.waitForTimeout(300); };
const scr = (x, y) => page.evaluate(([x, y]) => { const r = app.editor.canvas.getBoundingClientRect(); const [sx, sy] = app.editor.renderer.toScreen(x, y); return [sx + r.left, sy + r.top]; }, [x, y]);
const drag = async (a, b) => { await page.mouse.move(a[0], a[1]); await page.mouse.down(); for (let i = 1; i <= 8; i++) await page.mouse.move(a[0] + (b[0] - a[0]) * i / 8, a[1] + (b[1] - a[1]) * i / 8); await page.mouse.up(); await page.waitForTimeout(150); };
await add('DC Voltage');
await add('Resistor');
const els = await page.evaluate(() => app.editor.doc.elements.map((e) => ({ n: e.name, x: e.x, y: e.y, posts: e.getPosts() })));
console.log(JSON.stringify(els));
// move the resistor 3 grid right, 3 down by dragging its body
const r = els[1];
await drag(await scr(r.x, r.y), await scr(r.x + 60, r.y + 80));
const r2 = await page.evaluate(() => { const e = app.editor.doc.elements[1]; return { x: e.x, y: e.y, posts: e.getPosts() }; });
console.log('moved resistor to', r2.x, r2.y);
// wire battery post0 -> resistor post0, battery post1 -> resistor post1
const v = els[0];
await drag(await scr(...v.posts[0]), await scr(...r2.posts[0]));
await drag(await scr(...v.posts[1]), await scr(...r2.posts[1]));
const st = await page.evaluate(() => ({ wires: app.editor.doc.wires.map((w) => w.pts), undo: app.editor.undoStack.length }));
console.log('wires', JSON.stringify(st.wires), 'undo', st.undo);
await page.click('[data-a=run]');
await page.waitForTimeout(800);
const res = await page.evaluate(() => { const r = app.editor.doc.elements[1]; return { i: r.i, err: app.editor.sim.error }; });
console.log('resistor current', res.i, res.err);
await page.screenshot({ path: path.join(out, '30-built.png') });
// rotate resistor and ensure wires follow
await page.evaluate(() => { app.editor.select(app.editor.doc.elements[1]); app.editor.rotateSelection(); });
await page.waitForTimeout(700);
const res2 = await page.evaluate(() => ({ i: app.editor.doc.elements[1].i, wires: app.editor.doc.wires.map((w) => w.pts) }));
console.log('after rotate', res2.i, JSON.stringify(res2.wires));
await page.screenshot({ path: path.join(out, '31-rotated.png') });
await page.evaluate(() => app.editor.undo());
await page.waitForTimeout(300);
console.log('after undo rot=', await page.evaluate(() => app.editor.doc.elements[1].rot));
console.log(errs.length ? errs.join('\n') : 'no errors');
await browser.close(); server.close();
