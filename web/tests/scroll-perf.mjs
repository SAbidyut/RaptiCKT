// Measures frame times while fling-scrolling the Examples page on a throttled CPU.
// Usage: npm run build && node tests/scroll-perf.mjs
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const server = http.createServer((req, res) => { const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' }); fs.createReadStream(f).pipe(res); }).listen(0);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForTimeout(1500);
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); // a mid-range phone
await page.evaluate(() => {
  window.__lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: false });
  window.__fr = []; let last = performance.now(); const tick = (t) => { window.__fr.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  app.home.tab = 'examples'; app.home.cat = 'All'; app.home.render();
});
// fling-scroll the list with touch
for (let k = 0; k < 6; k++) {
  await cdp.send('Input.synthesizeScrollGesture', { x: 200, y: 600, yDistance: -700, speed: 1400, gestureSourceType: 'touch' });
}
const r = await page.evaluate(() => { const f = window.__fr.slice(3); f.sort((a, b) => a - b); return { longtasks: window.__lt, frames: f.length, p50: f[Math.floor(f.length * 0.5)].toFixed(1), p95: f[Math.floor(f.length * 0.95)].toFixed(1), max: f[f.length - 1].toFixed(1), janky: f.filter((x) => x > 34).length }; });
console.log(JSON.stringify(r));
await browser.close(); server.close();
