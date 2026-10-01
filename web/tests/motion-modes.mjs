// Smooth vs simple motion: Settings "Off", a low-RAM phone reported by the
// Android bridge, and the watchdog moving a phone that drops frames to simple.
// Usage: npm run build && node tests/motion-modes.mjs
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const server = http.createServer((req, res) => { const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' }); fs.createReadStream(f).pipe(res); }).listen(0);
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
const state = (page) => page.evaluate(() => ({
  lite: document.documentElement.classList.contains('lite'),
  pageScroll: document.querySelector('.home-scroll').className,
  rowWrapped: !!document.querySelector('.card-row .h-track'),
  reveal: document.querySelectorAll('.rv').length,
}));
async function open(init) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, isMobile: true, hasTouch: true });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(url); await sleep(2300);
  return { ctx, page, errs };
}
// 1) default desktop-class machine: smooth
let { ctx, page, errs } = await open();
console.log('default            ', JSON.stringify(await state(page)), await page.evaluate(() => document.querySelector('.home-scroll')._ios && 'ok'));
// native scrolling check is below; now the watchdog: make every frame slow while scrolling
await page.evaluate(() => { const hog = () => { const t = performance.now(); while (performance.now() - t < 38); window.__hog = requestAnimationFrame(hog); }; hog(); });
const cdp = await ctx.newCDPSession(page);
const T = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 200, y }] });
for (let k = 0; k < 3; k++) { await T('touchStart', 760); for (let i = 1; i <= 6; i++) { await sleep(14); await T('touchMove', 760 - i * 80); } await T('touchEnd'); await sleep(1800); }
await page.evaluate(() => cancelAnimationFrame(window.__hog));
await sleep(300);
console.log('after slow frames  ', JSON.stringify(await state(page)), 'reason:', await page.evaluate(() => JSON.parse(localStorage.getItem('raptickt.motion.v1') || '{}').lite));
// the verdict is remembered on the next start
await page.reload(); await sleep(2300);
console.log('after restart      ', JSON.stringify(await state(page)));
// simple mode still scrolls (natively)
await page.evaluate(() => { document.querySelector('.home-scroll').scrollTop = 400; });
console.log('native scrollTop   ', await page.evaluate(() => document.querySelector('.home-scroll').scrollTop));
// choosing "Auto" again in Settings gives the phone a fresh chance
await page.evaluate(() => { app.openSettings(); }); await sleep(300);
await page.evaluate(() => { const s = document.querySelector('select[data-k=animations]'); s.value = 'auto'; s.dispatchEvent(new Event('change')); });
console.log('settings hint      ', await page.evaluate(() => document.querySelector('select[data-k=animations]').closest('.set-row').querySelector('span').textContent));
console.log(errs.length ? errs : 'no errors');
await ctx.close();
// 2) Settings: Off
({ ctx, page, errs } = await open(() => localStorage.setItem('raptickt.settings.v1', JSON.stringify({ animations: 'off' }))));
console.log('setting Off        ', JSON.stringify(await state(page)));
await ctx.close();
// 3) a 2 GB phone reported by the Android bridge
({ ctx, page, errs } = await open(() => { window.RaptiAndroid = { appVersion: () => 'Android 1.0', deviceInfo: () => JSON.stringify({ ramMB: 2048, lowRam: false, cores: 8, sdk: 29, perfClass: 0 }), vibrate() {}, keepScreenOn() {}, openUrl() {}, shareText() {}, saveFile() {}, openFile() {} }; }));
console.log('2 GB phone         ', JSON.stringify(await state(page)));
await ctx.close();
// 4) an 8 GB phone
({ ctx, page, errs } = await open(() => { window.RaptiAndroid = { appVersion: () => 'Android 1.0', deviceInfo: () => JSON.stringify({ ramMB: 8192, lowRam: false, cores: 8, sdk: 34, perfClass: 33 }), vibrate() {}, keepScreenOn() {}, openUrl() {}, shareText() {}, saveFile() {}, openFile() {} }; }));
console.log('8 GB phone         ', JSON.stringify(await state(page)));
await ctx.close();
await browser.close(); server.close();
