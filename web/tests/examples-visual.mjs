// Screenshots every example (running) at phone size for visual review.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const out = process.argv[2] || 'examples-shots';
fs.mkdirSync(out, { recursive: true });
const root = path.resolve('dist');
const server = http.createServer((req, res) => { const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' }); fs.createReadStream(f).pipe(res); }).listen(0);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { window.RaptiAndroid = { appVersion: () => 'Android', vibrate() {}, keepScreenOn() {}, openUrl() {}, shareText() {}, saveFile() {}, openFile() {} }; localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true })); });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForTimeout(2000);
const ids = await page.evaluate(() => [...document.querySelectorAll('[data-ex]')].map((b) => b.dataset.ex));
const all = await page.evaluate(() => { app.home.tab = 'examples'; app.home.cat = 'All'; app.home.render(); return [...document.querySelectorAll('[data-ex]')].map((b) => b.dataset.ex); });
void ids;
for (const id of all) {
  await page.evaluate((id) => { app.goHome(); app.openExample(id); }, id);
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(out, id + '.png') });
  const err = await page.evaluate(() => app.editor.sim && app.editor.sim.error);
  if (err) console.log(id, 'SIM ERROR', err);
}
console.log(all.length, 'examples', errs.length ? errs : 'no page errors');
await browser.close(); server.close();
