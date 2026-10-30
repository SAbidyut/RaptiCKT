// Circuit from photo, end to end, read on the phone itself: a textbook-style photo → crop → the
// redrawn circuit → open on the board → Run gives the answer; a page of two figures (pick one, or
// crop to one with a finger); a picture with no circuit; Cancel and Back. Once in the browser (a chosen file) and once as in the Android
// app (a camera picture handed over by the app). Nothing is sent anywhere, and an API key an older
// version saved is wiped.
// Usage: npm run build && node tests/photo-ui.mjs
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
// (fs and path also load the test pictures from tests/fixtures)

const root = path.resolve('dist');
const server = http.createServer((req, res) => { const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' }); fs.createReadStream(f).pipe(res); }).listen(0);
const URL0 = `http://127.0.0.1:${server.address().port}/`;
let fail = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fail++; };
const fixture = (name) => fs.readFileSync(path.resolve('tests/fixtures', name));

const browser = await chromium.launch();
async function open(init) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true, selectHelp: true, fsTip2: true, tapWireHelp: true })));
  if (init) await ctx.addInitScript(init.fn, init.arg);
  const page = await ctx.newPage();
  const errs = [], away = [];
  page.on('pageerror', (e) => errs.push(e.message));
  // every request the page makes that is not the app itself
  page.on('request', (r) => { if (!/^(data|blob):/.test(r.url()) && !r.url().startsWith(URL0)) away.push(r.url()); });
  await page.goto(URL0); await page.waitForTimeout(2000);
  await page.evaluate(() => { app.settings.autoStart = false; });
  return { ctx, page, errs, away };
}
const stage = (page) => page.evaluate(() => app.photo.stage);
const partsShown = (page) => page.evaluate(() => [...document.querySelectorAll('.ph-row')].map((r) => r.dataset.sum).sort());

async function runAndRead(page, name) {
  await page.evaluate(() => app.editor.setRunning(true));
  await page.waitForTimeout(900);
  return page.evaluate((n) => {
    const e = app.editor.doc.elements.find((x) => x.name === n || (x.constructor.type === 'netlabel' && x.p.name === n));
    return e.constructor.type === 'netlabel' ? app.editor.sim.v(e.nodes[0]) : e.i;
  }, name);
}

// ================================================================== in a browser
{
  const { ctx, page, errs, away } = await open();
  // choose a picture; it opens to be cropped, all of it chosen: read it as it is (or not yet)
  const choose = async (buffer, name = 'photo.jpg', mimeType = 'image/jpeg', read = true) => {
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-x=gallery]')]);
    await fc.setFiles({ name, mimeType, buffer });
    await page.waitForFunction(() => app.photo.stage === 'crop', null, { timeout: 10000 });
    if (read) await page.click('[data-x=readcrop]');
  };
  // pictures made in the page: two figures side by side, and a page with no circuit
  const canvasPng = (fn, arg) => page.evaluate(fn, arg).then((b64) => Buffer.from(b64, 'base64'));
  const two = await canvasPng(async ([a, b]) => {
    const load = (d) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = 'data:image/png;base64,' + d; });
    const [A, B] = [await load(a), await load(b)];
    const c = document.createElement('canvas'); c.width = A.width + B.width + 120; c.height = Math.max(A.height, B.height);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(A, 0, 0); g.drawImage(B, A.width + 120, 0);
    return c.toDataURL('image/png').split(',')[1];
  }, [fixture('depsource.png').toString('base64'), fixture('meshes.png').toString('base64')]);
  const blank = await canvasPng(() => {
    const c = document.createElement('canvas'); c.width = 2400; c.height = 1600;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 2400, 1600); g.strokeStyle = '#000'; g.lineWidth = 8; g.strokeRect(300, 300, 1800, 1000);
    return c.toDataURL('image/png').split(',')[1];
  });

  check(!(await page.$('.ph-banner, [data-h=photo]')), 'Home has no "Circuit from photo" card (it is in the editor)');
  await page.evaluate(() => app.newCircuit()); await page.waitForTimeout(700);
  await page.click('.hint .hint-photo'); await page.waitForTimeout(400);
  check(await page.isVisible('.screen.photo.active .ph-btns'), 'the photo page opens with Take a photo / Choose an image');
  check(await page.isVisible('.ph-intro') && !(await page.$('.screen.photo .ph-mode, .screen.photo .ph-key, .screen.photo [data-mode]')), 'read on this phone: no reader to choose, no key to enter');

  // ---- one photo, read and solved
  await choose(fixture('depsource-photo.jpg'), 'photo.jpg', 'image/jpeg', false);
  check(await page.isVisible('.ph-crop img') && await page.isVisible('.ph-cropbox [data-h=se]') && await page.isVisible('[data-x=readcrop]'), 'the picture opens to be cropped, all of it chosen at first');
  await page.click('[data-x=readcrop]');
  await page.waitForFunction(() => app.photo.stage === 'result', null, { timeout: 30000 });
  const parts = await partsShown(page);
  check(JSON.stringify(parts) === JSON.stringify(['D1 0.1vx', 'I1 4 A', 'R1 4 Ω', 'R2 20 Ω', 'V1 20 V'].sort()) || (parts.length === 5 && parts.includes('D1 0.1vx') && parts.includes('V1 20 V')), `read: ${parts.join(', ')}`);
  check(await page.isVisible('.ph-by') && !(await page.$('[data-x=claude]')) && (await page.$$('.th-warn')).length === 0, 'says it was read on the phone, nothing else offered, no warnings');
  check((await page.textContent('.ph-title b')) === 'Photo circuit 1', 'named "Photo circuit 1" (the drawing has no figure number)');
  check(await page.isVisible('.ph-sure'), 'it says a reading is not always 100 % right, and to fix it here or on the board');
  // ---- a part read wrong is put right in the list: its kind, its value, or out it goes
  const rowOf = (sum) => page.evaluate((s) => [...document.querySelectorAll('.ph-row')].find((r) => r.dataset.sum === s)?.dataset.i, sum);
  const r4 = await rowOf('R1 4 Ω');
  await page.fill(`.ph-row[data-i="${r4}"] input`, '8'); await page.dispatchEvent(`.ph-row[data-i="${r4}"] input`, 'change'); await page.waitForTimeout(300);
  check((await partsShown(page)).includes('R1 8 Ω'), 'a value typed in its row: R1 8 Ω');
  await page.selectOption(`.ph-row[data-i="${r4}"] select`, 'inductor'); await page.waitForTimeout(300);
  check((await partsShown(page)).includes('L1 1 mH') && !(await partsShown(page)).includes('R1 8 Ω'), `a part made a coil instead: ${(await partsShown(page)).join(', ')}`);
  await page.click(`.ph-row[data-i="${r4}"] [data-x=del]`); await page.waitForTimeout(300);
  check((await partsShown(page)).length === 4, 'a part removed from the list');
  check(await page.isVisible('[data-x=undo]'), 'changed: "Back to what was read" is offered');
  await page.click('[data-x=undo]'); await page.waitForTimeout(300);
  check(JSON.stringify(await partsShown(page)) === JSON.stringify(parts) && !(await page.$('[data-x=undo]')), 'Back to what was read: as read again');
  await page.click('[data-x=open]'); await page.waitForTimeout(900);
  check(await page.evaluate(() => app.editor.doc.name === 'Photo circuit 1'), '…and saved under that name');
  check(await page.evaluate(() => !app.editor.running), 'it opens on the board paused (Run when ready)');
  check(await page.evaluate(() => app.editor.doc.bigLabels && !app.editor.doc.elements.some((e) => e.constructor.type === 'netlabel' && e.p.name !== 'vx')), 'its values written big, and no names but the one the diamond reads (vx)');
  const vx = await runAndRead(page, 'vx');
  check(Math.abs(vx - 25) < 1e-6, `Run: vx = ${vx.toFixed(4)} V (book: 25 V)`);
  await page.evaluate(() => app.editor.setRunning(false));

  // ---- from the editor: ⋮ → Circuit from photo, a page of two figures
  await page.click('[data-a=more]'); await page.waitForTimeout(250);
  await page.click('.more-menu [data-m=photo]'); await page.waitForTimeout(400);
  check(await page.evaluate(() => app.current === 'photo' && app.photoFrom === 'editor'), '⋮ → Circuit from photo from the editor');
  check((await stage(page)) === 'result', 'the last reading is still there');
  await page.click('[data-x=again]'); await page.waitForTimeout(200);
  await choose(two, 'page.png', 'image/png');
  await page.waitForFunction(() => app.photo.stage === 'result', null, { timeout: 30000 });
  const chips = await page.$$('.th-chips [data-c]');
  check(chips.length === 2, `a page of two circuits offers both (${chips.length})`);
  let meshes = -1;
  for (let k = 0; k < chips.length; k++) {
    await page.click(`.th-chips [data-c="${k}"]`); await page.waitForTimeout(250);
    if ((await partsShown(page)).includes('I1 3 A')) meshes = k;
  }
  check(meshes >= 0, 'the second figure can be picked');
  await page.click(`.th-chips [data-c="${meshes}"]`); await page.waitForTimeout(250);
  const mp = await partsShown(page);
  check(mp.length === 7 && mp.includes('V1 24 V') && mp.includes('V2 12 V'), `the picked figure: ${mp.join(', ')}`);
  check(/find i\b/.test(await page.textContent('.ph-asked')), 'it says what is asked (i)');
  await page.click('[data-x=open]'); await page.waitForTimeout(900);
  check(await page.evaluate(() => app.current === 'editor' && app.editor.doc.elements.length > 7), 'Open on the board: a new circuit with its parts');
  const names = await page.evaluate(() => JSON.parse(localStorage.getItem('raptickt.circuits.v1') || '[]').map((c) => c.name).sort());
  check(JSON.stringify(names) === JSON.stringify(['Photo circuit 1', 'Photo circuit 2']), `each photo circuit gets its own name (${names.join(', ')})`);
  await page.evaluate(() => app.editor.setRunning(true)); await page.waitForTimeout(900);
  const i3 = await page.evaluate(() => Math.abs(app.editor.doc.elements.find((e) => e.constructor.type === 'resistor' && e.p.r === 3).i));
  check(Math.abs(i3 - 2) < 1e-6, `Run: i through the 3 Ω = ${i3.toFixed(4)} A (book: 2 A)`);
  await page.evaluate(() => app.editor.setRunning(false));

  await page.evaluate(() => app.openPhoto()); await page.waitForTimeout(300);
  await page.click('[data-x=again]'); await page.waitForTimeout(200);

  // ---- the same page cropped with a finger to its right-hand figure: only that one is read
  await choose(two, 'page.png', 'image/png', false);
  const frame = await page.locator('.ph-crop').boundingBox();
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', frame.x + 8, frame.y + 8);
  for (let k = 1; k <= 8; k++) await touch('touchMove', frame.x + 8 + (frame.width * 0.55 - 8) * k / 8, frame.y + 8);
  await touch('touchEnd');
  const crop = await page.evaluate(() => app.photo.crop);
  check(Math.abs(crop[0] - 0.55) < 0.03 && crop[2] === 1 && crop[3] === 1, `the top-left corner dragged to the middle (${crop.map((v) => v.toFixed(2)).join(', ')})`);
  await page.click('[data-x=readcrop]');
  await page.waitForFunction(() => app.photo.stage === 'result', null, { timeout: 30000 });
  const one = await partsShown(page);
  check(!(await page.$('.th-chips')) && one.length === 7 && one.includes('I1 3 A'), `cropped to the right-hand figure, only it is read: ${one.join(', ')}`);
  await page.click('[data-x=again]'); await page.waitForTimeout(200);
  await choose(two, 'page.png', 'image/png', false);
  await page.evaluate(() => app.back()); await page.waitForTimeout(200);
  check((await stage(page)) === 'start', 'Back from cropping: the start again');
  await page.evaluate(() => app.back()); await page.waitForTimeout(300);

  // ---- no circuit, Cancel, Back
  await page.click('[data-a=more]'); await page.waitForTimeout(250);
  await page.click('.more-menu [data-m=photo]'); await page.waitForTimeout(400);
  await page.click('[data-x=again]'); await page.waitForTimeout(200);
  await choose(blank, 'blank.png', 'image/png');
  await page.waitForFunction(() => app.photo.stage === 'result', null, { timeout: 30000 });
  check(await page.isVisible('.ph-empty') && await page.isVisible('[data-x=again]') && !(await page.$('[data-x=claude]')), 'a picture with no circuit says so and offers another photo');
  await page.click('[data-x=again]'); await page.waitForTimeout(200);
  await choose(two, 'page.png', 'image/png');
  // (reading takes a second or so: Cancel is tapped from the page as soon as it shows)
  const seen = await (await page.waitForFunction(() => {
    if (app.photo.stage !== 'reading') return false;
    const shown = !!document.querySelector('.ph-shot.reading img') && document.querySelector('.ph-status b').textContent.includes('on this phone');
    document.querySelector('[data-x=cancel]').click();
    return { shown };
  }, null, { timeout: 5000, polling: 'raf' })).jsonValue();
  check(seen.shown, 'reading shows the picture');
  await page.waitForTimeout(3000);
  check((await stage(page)) === 'start', 'Cancel goes back to the start, and the reading is dropped');
  await page.evaluate(() => app.back()); await page.waitForTimeout(300);
  check(await page.evaluate(() => app.current === 'editor'), 'Back from the start: the circuit being edited');

  check(away.length === 0, `nothing was sent anywhere (${away.join(' ')})`);
  check(errs.length === 0, `no page errors (${errs.join(' | ')})`);
  await ctx.close();
}

// ================================================================== an API key an older version saved
{
  const { ctx, page, errs } = await open({ fn: () => localStorage.setItem('raptickt.settings.v1', JSON.stringify({ theme: 'dark', claudeKey: 'sk-ant-old-1234', photoReader: 'claude' })), arg: null });
  const kept = await page.evaluate(() => ({ stored: localStorage.getItem('raptickt.settings.v1') || '', live: 'claudeKey' in app.settings, theme: app.settings.theme }));
  check(!kept.stored.includes('sk-ant') && !kept.stored.includes('photoReader') && !kept.live && kept.theme === 'dark', 'an old saved API key is wiped from the phone (the other settings kept)');
  check(errs.length === 0, `no page errors (${errs.join(' | ')})`);
  await ctx.close();
}

// ================================================================== as in the Android app
{
  const fake = ({ jpeg }) => {
    const calls = (window.__nativeCalls = []);
    window.RaptiAndroid = {
      appVersion: () => 'Android test', deviceInfo: () => '{}', vibrate() {}, openUrl() {}, shareText() {}, saveFile() {}, openFile() {},
      setImmersive() {}, setOrientation() {}, keepScreenOn() {},
      pickImage(camera, max) { calls.push(['pickImage', camera, max]); setTimeout(() => window.__raptiImage(jpeg), 30); },
    };
  };
  const { ctx, page, errs, away } = await open({ fn: fake, arg: { jpeg: fixture('depsource-photo.jpg').toString('base64') } });
  await page.evaluate(() => app.newCircuit());
  await page.waitForTimeout(700);
  check(await page.isVisible('.hint .hint-photo'), 'an empty board offers "Or start from a photo"');
  await page.click('.hint .hint-photo'); await page.waitForTimeout(400);
  await page.click('[data-x=camera]');
  await page.waitForFunction(() => app.photo.stage === 'crop', null, { timeout: 10000 });
  await page.click('[data-x=readcrop]');
  await page.waitForFunction(() => app.photo.stage === 'result', null, { timeout: 30000 });
  const calls = await page.evaluate(() => window.__nativeCalls);
  check(calls[0][0] === 'pickImage' && calls[0][1] === true && calls[0][2] === 2600, 'Take a photo asks the app for the camera, in detail enough for small labels');
  check((await partsShown(page)).includes('D1 0.1vx'), 'the camera picture is read');
  await page.click('[data-x=open]'); await page.waitForTimeout(900);
  const vx = await runAndRead(page, 'vx');
  check(Math.abs(vx - 25) < 1e-6, `Run: vx = ${vx.toFixed(4)} V (book: 25 V)`);
  check(await page.evaluate(() => app.editor.doc.elements.some((e) => e.constructor.type === 'depsrc' && e.p.ctrl === 'node:vx')), 'the 0.1vx diamond is controlled by vx');
  check(away.length === 0, 'nothing was sent anywhere');
  check(errs.length === 0, `no page errors (${errs.join(' | ')})`);
  await ctx.close();
}

await browser.close(); server.close();
console.log(fail ? `${fail} FAILED` : 'all passed');
process.exit(fail ? 1 : 0);
