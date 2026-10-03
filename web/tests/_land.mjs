// Visual smoke test: loads the built app in Chromium at phone size, clicks through screens,
// and saves screenshots. Usage: node tests/shots.mjs <outdir>
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] || 'shots';
fs.mkdirSync(out, { recursive: true });
const root = path.resolve('dist');
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  const type = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' }[path.extname(f)] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': type }); fs.createReadStream(f).pipe(res);
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 892, height: 412 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('dialog', (d) => d.dismiss());
const shot = async (name) => { await page.screenshot({ path: path.join(out, name + '.png') }); console.log('shot', name); };
const wait = (ms) => page.waitForTimeout(ms);

await page.goto(url);
await wait(500); await shot('01-splash');
await wait(1800); await shot('02-home');
const steps = JSON.parse(process.env.STEPS || '[]');
for (const s of steps) {
  if (s.click) await page.locator(s.click).first().click();
  if (s.tap) await page.mouse.click(s.tap[0], s.tap[1]);
  if (s.eval) await page.evaluate(s.eval);
  if (s.wait) await wait(s.wait);
  if (s.shot) await shot(s.shot);
}
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
server.close();
