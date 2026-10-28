// Sideways card row on Home: drags follow the finger, flings come to rest
// exactly on a card, the ends rubber-band, and the motion has no jumps.
// Usage: npm run build && node tests/row-feel.mjs
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(process.argv[2] || 'dist');
const server = http.createServer((req, res) => { const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' }); fs.createReadStream(f).pipe(res); }).listen(0);
const browser = await chromium.launch();
// Home shows a card row only for saved circuits: give it six
const SEED = () => localStorage.setItem('raptickt.circuits.v1', JSON.stringify(Array.from({ length: 6 }, (_, k) => ({ id: 'c' + k, name: 'Circuit ' + (k + 1), updated: Date.now() - k * 6e4, doc: { elements: [], wires: [] } }))));
const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(SEED);
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForTimeout(2300);
const r = await page.evaluate(() => { const c = document.querySelector('.card-row'); const b = c.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
const cdp = await ctx.newCDPSession(page);
const T = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: r[1] }] });
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
const rec = () => page.evaluate(() => { const ax = document.querySelector('.card-row')._axis; window.__xs = []; const f = () => { window.__xs.push(ax.pos); window.__r = requestAnimationFrame(f); }; f(); });
const stopRec = () => page.evaluate(() => { cancelAnimationFrame(window.__r); return window.__xs; });
const info = () => page.evaluate(() => { const row = document.querySelector('.card-row'), ax = row._axis; return { pos: ax.pos, max: ax.max, snaps: ax.snaps() }; });
const report = (name, xs, extra = '') => { const d = xs.slice(1).map((v, i) => v - xs[i]); console.log(name.padEnd(20), 'frames', xs.length, 'end', xs.at(-1).toFixed(1), 'min', Math.min(...xs).toFixed(1), 'max', Math.max(...xs).toFixed(1), 'biggest step', Math.max(...d.map(Math.abs)).toFixed(1), extra); };
const swipe = async (from, to, ms, steps = 8) => { await T('touchStart', from); for (let i = 1; i <= steps; i++) { await sleep(ms / steps); await T('touchMove', from + ((to - from) * i) / steps); } await T('touchEnd'); };
console.log('row', JSON.stringify(await info()));
await rec(); await swipe(330, 230, 500, 12); await sleep(1500); let xs = await stopRec(); let I = await info();
report('slow drag 100px', xs, `rests on a card: ${I.snaps.some((s) => Math.abs(Math.min(s, I.max) - I.pos) < 0.5)}`);
await rec(); await swipe(340, 140, 80, 5); await sleep(2000); xs = await stopRec(); I = await info();
report('fling', xs, `rests on a card: ${I.snaps.some((s) => Math.abs(Math.min(s, I.max) - I.pos) < 0.5)}`);
await rec(); for (let k = 0; k < 3; k++) { await swipe(360, 60, 70, 5); await sleep(100); } await sleep(2200); xs = await stopRec(); I = await info();
report('flings to the end', xs, `overshoot ${(Math.max(...xs) - I.max).toFixed(1)}px, settled at end ${Math.abs(I.pos - I.max) < 0.5}`);
await rec(); await swipe(60, 380, 600, 20); await sleep(1500); xs = await stopRec(); I = await info();
report('drag back', xs);
await page.evaluate(() => { const ax = document.querySelector('.card-row')._axis; ax.stop(); ax.pos = 0; ax.apply(0); });
await rec(); await T('touchStart', 100); for (let x = 110; x <= 380; x += 15) { await sleep(16); await T('touchMove', x); } await sleep(100);
const band = await page.evaluate(() => document.querySelector('.card-row')._axis.pos); await T('touchEnd'); await sleep(900); xs = await stopRec();
report('pull past start', xs, `band ${band.toFixed(1)}px for 280px pull, back ${Math.abs(xs.at(-1)) < 0.5}`);
console.log('page did not move:', await page.evaluate(() => app.home.scrollApi.y === 0));
console.log(errs.length ? errs : 'no errors');
await browser.close(); server.close();
