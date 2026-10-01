// My Circuits: "Delete all" asks first, can be cancelled, and then empties the list.
// Usage: npm run build && node tests/delete-all.mjs [shot.png]
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const server = http.createServer((req, res) => { const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' }); fs.createReadStream(f).pipe(res); }).listen(0);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForTimeout(2300);
const count = () => page.evaluate(() => JSON.parse(localStorage.getItem('raptickt.circuits.v1') || '[]').length);
await page.evaluate(() => { for (let i = 0; i < 3; i++) app.saveToLibrary(Object.assign(app.editor.newDoc('Test ' + i), {}), true); });
await page.click('[data-tab=library]'); await page.waitForTimeout(500);
const checks = [];
const before = await page.locator('.lib-item').count();
checks.push(['3 circuits listed with a Delete all button', before === 3 && await page.locator('[data-h=delall]').count() === 1]);
await page.click('[data-h=delall]'); await page.waitForTimeout(300);
checks.push(['asks first', (await page.locator('.modal.open .sheet-note').textContent()).includes('All 3 saved circuits')]);
if (process.argv[2]) await page.screenshot({ path: process.argv[2] });
await page.click('.modal.open [data-x=cancel]'); await page.waitForTimeout(300);
checks.push(['cancel keeps them', await page.locator('.lib-item').count() === 3]);
await page.click('[data-h=delall]'); await page.waitForTimeout(300);
await page.click('.modal.open [data-x=del]'); await page.waitForTimeout(400);
checks.push(['delete empties the list', await page.locator('.lib-item').count() === 0 && await page.locator('.empty').count() === 1]);
checks.push(['button hidden when empty', await page.locator('[data-h=delall]').count() === 0]);
let fails = 0;
for (const [name, ok] of checks) { if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', name); }
console.log(errs.length ? errs : 'no page errors', fails ? `${fails} FAILED` : 'all passed');
await browser.close(); server.close();
