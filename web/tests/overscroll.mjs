// Checks the elastic scroll edges on the Examples page: bounce at the end, stretch when pulled past either end.
// Usage: npm run build && node tests/overscroll.mjs <outdir>
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const root = path.resolve('dist');
const server = http.createServer((req, res) => { const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' }); fs.createReadStream(f).pipe(res); }).listen(0);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForTimeout(1500);
await page.evaluate(() => document.querySelector('.bottom-nav [data-tab=examples]').click());
await page.waitForTimeout(800);
const cdp = await ctx.newCDPSession(page);
// 1) fling to the end
await page.evaluate(() => { window.__anims = 0; const b = document.querySelector('.home-body'); const orig = b.animate.bind(b); b.animate = (...a) => { window.__anims++; return orig(...a); }; });
await page.evaluate(() => { const s = app.home.scroller; s.scrollTo({ top: s.scrollHeight, behavior: 'smooth' }); });
await page.waitForTimeout(1500);
console.log('fling: at end', await page.evaluate(() => { const s = app.home.scroller; return [Math.round(s.scrollTop), s.scrollHeight - s.clientHeight]; }), 'bounce animations', await page.evaluate(() => window.__anims));
// 2) pull up past the end with a finger and hold
const T = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 200, y }] });
await page.evaluate(() => { const s = app.home.scroller; s.scrollTop = s.scrollHeight; });
await page.waitForTimeout(200);
await T('touchStart', 700);
for (let y = 690; y >= 400; y -= 10) await T('touchMove', y);
await page.waitForTimeout(50);
console.log('pulling: transform', await page.evaluate(() => document.querySelector('.home-body').style.transform));
await page.screenshot({ path: path.join(out, 'pull-end.png') });
await T('touchEnd');
await page.waitForTimeout(120);
await page.screenshot({ path: path.join(out, 'release.png') });
await page.waitForTimeout(600);
console.log('after release: transform', JSON.stringify(await page.evaluate(() => document.querySelector('.home-body').style.transform)));
// 3) pull down at the top
await page.evaluate(() => { app.home.scroller.scrollTop = 0; });
await page.waitForTimeout(200);
await T('touchStart', 300);
for (let y = 310; y <= 600; y += 10) await T('touchMove', y);
console.log('pull at top: transform', await page.evaluate(() => document.querySelector('.home-body').style.transform));
await page.screenshot({ path: path.join(out, 'pull-top.png') });
await T('touchEnd');
console.log(errs.length ? errs : 'no errors');
await browser.close(); server.close();
