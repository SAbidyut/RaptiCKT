// My Circuits: folders, new project in a folder, move, select + delete, backup/restore with folders.
// Usage: npm run build && node tests/library-folders.mjs [shots-dir]
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const server = http.createServer((req, res) => { const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' }); fs.createReadStream(f).pipe(res); }).listen(0);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const shots = process.argv[2]; if (shots) fs.mkdirSync(shots, { recursive: true });
const shot = (n) => shots && page.screenshot({ path: path.join(shots, n + '.png') });
await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForTimeout(2300);
const checks = []; const ok = (n, v) => checks.push([n, !!v]);
// pages scroll with a transform, so taps go straight to the element
const tap = (sel, i = 0) => page.locator(sel).nth(i).evaluate((e) => e.click()).then(() => page.waitForTimeout(350));
const st = (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), k);
const items = () => page.locator('.lib-item').count();
const names = () => page.locator('.lib-item .lib-meta b').allTextContents();
let answer = ''; page.on('dialog', (d) => d.accept(answer));
const say = (a) => { answer = a; };
await page.evaluate(() => { for (let i = 0; i < 3; i++) app.saveToLibrary(Object.assign(app.editor.newDoc('Test ' + i), {}), true); });
await page.click('[data-tab=library]'); await page.waitForTimeout(500);
ok('3 projects at the top level', await items() === 3);
ok('Delete all is gone', await page.locator('[data-h=delall]').count() === 0);
// new folder
say('Class 1'); await tap('[data-h=newf]');
ok('New folder appears first in the list', (await names())[0] === 'Class 1' && await items() === 4);
await shot('1-folders');
// open it
await tap('.lib-item.folder');
ok('open the folder: breadcrumb and empty message', await page.locator('.crumbs span').last().textContent() === 'Class 1' && await page.locator('.empty').count() === 1);
// new project in it
say('Lab A'); await tap('[data-h=new]'); await page.waitForTimeout(900);
await page.evaluate(() => app.closeSheet());
ok('New project asks a name and opens the editor', await page.evaluate(() => app.current === 'editor' && app.editor.doc.name === 'Lab A'));
await page.evaluate(() => { app.editor.addComponent('resistor'); app.goHome(); }); await page.waitForTimeout(600);
const lib = await st('raptickt.circuits.v1'), fold = await st('raptickt.folders.v1');
ok('the project is saved inside the folder', lib.find((c) => c.name === 'Lab A')?.folder === fold[0].id);
await page.evaluate(() => { app.home.tab = 'library'; app.home.render(); }); await page.waitForTimeout(400);
ok('Home → My Circuits returns to the same folder', await page.locator('.crumbs span').last().textContent() === 'Class 1' && await items() === 1);
// sub folder
say('Sub'); await tap('[data-h=newf]');
ok('sub-folder inside a folder', await page.locator('.crumbs span').last().textContent() === 'Class 1' && (await names()).includes('Sub'));
// Back goes up one folder
await page.evaluate(() => window.raptiBack()); await page.waitForTimeout(350);
ok('Back leaves the folder', await page.locator('.crumbs button').count() === 0 && await items() === 4);
// select mode: move two projects into the folder
await tap('[data-h=select]');
ok('Select mode shows tick boxes and a bar', await page.locator('.sel-box').count() === 4 && await page.locator('.sel-bar').count() === 1);
await tap('.lib-item:not(.folder)', 0); await tap('.lib-item:not(.folder)', 1);
ok('2 selected', (await page.locator('.sel-count').textContent()) === '2 selected' && await page.locator('.lib-item.sel').count() === 2);
await shot('2-select');
await tap('[data-h=move]');
ok('Move lists the folders', await page.locator('.modal.open [data-to]').count() >= 3);
await tap('.modal.open [data-to]:not([data-to=""]):not([data-to="__new"])', 0);
ok('moved into that folder (and select mode ended)', await page.locator('.sel-bar').count() === 0 && await items() === 2);
await tap('.lib-item.folder');
ok('folder now holds 3 projects + sub-folder', await items() === 4);
await page.evaluate(() => window.raptiBack()); await page.waitForTimeout(350);
// Back also leaves select mode
await tap('[data-h=select]');
await page.evaluate(() => window.raptiBack()); await page.waitForTimeout(350);
ok('Back leaves select mode first', await page.locator('.sel-bar').count() === 0);
// delete a folder with contents via select
await tap('[data-h=select]'); await tap('.lib-item.folder');
await tap('[data-h=delsel]');
const note = await page.locator('.modal.open .sheet-note').textContent();
ok('delete asks first, counting what is inside', note.includes('3 projects') && note.includes('2 folders') && note.includes('inside'));
await shot('3-delete-confirm');
await tap('.modal.open [data-x=cancel]');
ok('cancel keeps everything', (await st('raptickt.folders.v1')).length === 2 && (await st('raptickt.circuits.v1')).length === 4);
await tap('[data-h=delsel]'); await tap('.modal.open [data-x=del]');
ok('delete removes the folder, its sub-folder and its projects', (await st('raptickt.folders.v1')).length === 0 && (await st('raptickt.circuits.v1')).length === 1 && await page.locator('.sel-bar').count() === 0);
// select all + delete empties the list
await tap('[data-h=select]'); await tap('[data-h=selall]');
ok('All ticks everything', await page.locator('.lib-item.sel').count() === await items());
await tap('[data-h=delsel]'); await tap('.modal.open [data-x=del]');
ok('select all + delete empties My Circuits', await items() === 0 && await page.locator('.empty').count() === 1 && await page.locator('[data-h=select]').count() === 0);
// backup & restore with folders
say('F1'); await tap('[data-h=newf]'); await tap('.lib-item.folder');
await page.evaluate(() => { const d = app.editor.newDoc('InF'); d.folder = app.home.folder; app.saveToLibrary(d, true); app.home.render(); });
const backup = await page.evaluate(() => { let out; const b = app.bridge.saveFile; app.bridge.saveFile = (n, m, t) => { out = t; }; app.backupAll(); app.bridge.saveFile = b; return out; });
const bk = JSON.parse(backup);
ok('backup contains folders and placement', bk.folders.length === 1 && bk.placement.length === 1 && bk.placement[0] === bk.folders[0].id);
await page.evaluate(() => { app.home.folder = null; localStorage.removeItem('raptickt.folders.v1'); localStorage.removeItem('raptickt.circuits.v1'); });
await page.evaluate((t) => { window.alert = () => {}; app.loadText('b.json', t); }, backup); await page.waitForTimeout(400);
const f2 = await st('raptickt.folders.v1'), c2 = await st('raptickt.circuits.v1');
ok('restore brings the folder and its project back', f2.length === 1 && f2[0].name === 'F1' && c2.length === 1 && c2[0].folder === f2[0].id);
let fails = 0;
for (const [n, v] of checks) { if (!v) fails++; console.log(v ? 'ok  ' : 'FAIL', n); }
console.log(errs.length ? errs : 'no page errors', fails ? `${fails} FAILED` : 'all passed');
await browser.close(); server.close();
process.exit(fails || errs.length ? 1 : 0);
