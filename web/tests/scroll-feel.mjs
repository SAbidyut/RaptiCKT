// Drives the iOS-style scroller with real touch input on the Examples page and
// records the scroll offset every frame: drag 1:1, fling + coast, fling into the
// end (overshoot then settle exactly at the end), pull past the top and release.
// Usage: npm run build && node tests/scroll-feel.mjs
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const server = http.createServer((req, res) => { const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' }); fs.createReadStream(f).pipe(res); }).listen(0);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForTimeout(2300);
await page.evaluate(() => document.querySelector('.bottom-nav [data-tab=examples]').click());
await page.waitForTimeout(900);
const cdp = await ctx.newCDPSession(page);
const T = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 200, y }] });
const rec = () => page.evaluate(() => { window.__ys = []; const f = () => { window.__ys.push(app.home.scrollApi.y); window.__rec = requestAnimationFrame(f); }; f(); });
const stopRec = () => page.evaluate(() => { cancelAnimationFrame(window.__rec); return window.__ys; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const swipe = async (from, to, ms, steps = 8) => { await T('touchStart', from); for (let i = 1; i <= steps; i++) { await sleep(ms / steps); await T('touchMove', from + ((to - from) * i) / steps); } await T('touchEnd'); };
const report = (name, ys, extra = '') => {
  const d = ys.slice(1).map((v, i) => v - ys[i]);
  const maxJump = Math.max(...d.map(Math.abs));
  console.log(name.padEnd(22), 'frames', ys.length, 'start', ys[0].toFixed(0), 'end', ys.at(-1).toFixed(1), 'min', Math.min(...ys).toFixed(1), 'max', Math.max(...ys).toFixed(1), 'biggest step', maxJump.toFixed(1), extra);
};
const max = await page.evaluate(() => app.home.scrollApi.max);
console.log('content max', max);
// 1) slow drag: must follow the finger 1:1 and stop dead
await rec(); await swipe(700, 500, 600, 20); await sleep(500); report('slow drag 200px', await stopRec());
// 2) quick fling: coasts and decelerates smoothly
await rec(); await swipe(700, 450, 90, 6); await sleep(2500); report('fling', await stopRec());
// 3) hard flings into the end: overshoot into the band, settle exactly at max
await rec(); for (let k = 0; k < 4; k++) { await swipe(800, 200, 70, 5); await sleep(120); } await sleep(3000);
const ys3 = await stopRec(); report('flings into end', ys3, `overshoot ${(Math.max(...ys3) - max).toFixed(1)}px, settled ${Math.abs(ys3.at(-1) - max) < 0.5}`);
// 3b) one fling from a little before the end: a single smooth overshoot, no jumps
for (const [gap, ms] of [[300, 80], [600, 60]]) {
  await page.evaluate((g) => app.home.scrollApi.scrollTo(app.home.scrollApi.max - g, false), gap);
  await rec(); await swipe(700, 400, ms, 5); await sleep(2000);
  const yb = await stopRec(); const after = yb.slice(yb.findIndex((v, i) => i > 0 && v === yb[i - 1]) + 1);
  const d = yb.slice(1).map((v, i) => v - yb[i]);
  const flips = d.slice(1).filter((x, i) => Math.sign(x) && Math.sign(d[i]) && Math.sign(x) !== Math.sign(d[i])).length;
  report(`fling ${gap}px before end`, yb, `overshoot ${(Math.max(...yb) - max).toFixed(1)}px, direction changes ${flips}, settled ${Math.abs(yb.at(-1) - max) < 0.5}`);
  void after;
}
// 4) pull past the end and hold, then release
await rec(); await T('touchStart', 700); for (let y = 690; y >= 300; y -= 15) { await sleep(16); await T('touchMove', y); } await sleep(200);
const held = await page.evaluate(() => app.home.scrollApi.y - app.home.scrollApi.max); await T('touchEnd'); await sleep(900);
const ys4 = await stopRec(); report('pull end 390px', ys4, `band ${held.toFixed(1)}px for 390px pull, back ${Math.abs(ys4.at(-1) - max) < 0.5}`);
// 5) back to the top, pull down
await page.evaluate(() => app.home.scrollApi.scrollTo(0, false));
await rec(); await T('touchStart', 300); for (let y = 315; y <= 700; y += 15) { await sleep(16); await T('touchMove', y); } await T('touchEnd'); await sleep(900);
const ys5 = await stopRec(); report('pull top 400px', ys5, `back ${Math.abs(ys5.at(-1)) < 0.5}`);
// 6) a tap on a card after scrolling still opens it; a drag does not
console.log(errs.length ? errs : 'no errors');
await browser.close(); server.close();
