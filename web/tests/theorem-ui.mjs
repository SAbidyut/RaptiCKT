// ⋮ → Run with theorem: pick a theorem, pick the load (by tapping the drawing), solve, and check
// every theorem reaches the hand-worked answer with a drawing on its steps; Back walks the
// stages; Run the circuit returns to the running board with the load selected.
// Usage: npm run build && node tests/theorem-ui.mjs
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const server = http.createServer((req, res) => { const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' }); fs.createReadStream(f).pipe(res); }).listen(0);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.addInitScript(() => localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true, selectHelp: true, fsTip2: true, tapWireHelp: true })));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForTimeout(2000);
let fail = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fail++; };

await page.evaluate(() => { app.settings.autoStart = false; app.openExample('theorems'); });
await page.waitForTimeout(900);
await page.click('[data-a=more]'); await page.waitForTimeout(250);
await page.click('.more-menu [data-m=theorem]'); await page.waitForTimeout(400);
check(await page.isVisible('.overlay.theorem.open'), '⋮ → Run with theorem opens the page');
check(await page.$$eval('.th-card:not([disabled])', (x) => x.length) === 10, 'eight theorems and two analysis methods to pick from');

// tap R2 on the drawing to pick it, then R4 from the list
await page.click('[data-th=thevenin]'); await page.waitForTimeout(500);
const r2 = await page.evaluate(() => {
  const cv = document.querySelector('.th-pick'), view = app.editor.theorem.pickView, e = app.editor.doc.elements.find((x) => x.name === 'R2');
  const [sx, sy] = view.toScreen(e.x, e.y), r = cv.getBoundingClientRect();
  return [r.left + sx, r.top + sy];
});
await page.touchscreen.tap(r2[0], r2[1]); await page.waitForTimeout(300);
check((await page.textContent('.th-chips .chip2.on')).startsWith('R2'), 'tapping R2 on the drawing picks it');
await page.click('.th-chips button:has-text("R4")'); await page.waitForTimeout(300);
check((await page.textContent('.th-chips .chip2.on')).startsWith('R4'), 'R4 picked from the list');

const want = { thevenin: 4, norton: 4, superposition: 4, maxpower: 5, tellegen: 4, source: 9 };
for (const [th, n] of Object.entries(want)) {
  await page.evaluate((t) => { app.editor.theorem.theorem = t; app.editor.theorem.go('target'); }, th);
  await page.waitForTimeout(300);
  await page.click('.th-go'); await page.waitForTimeout(700);
  const s = await page.evaluate(() => ({
    answer: document.querySelector('.th-answer b').textContent,
    steps: document.querySelectorAll('.th-step').length,
    figs: [...document.querySelectorAll('.th-step canvas')].filter((c) => c.width > 100 && c.height > 100).length,
    text: document.querySelector('.th-body').textContent,
  }));
  check(s.answer.includes(th === 'maxpower' ? 'Pmax = 15 W' : th === 'tellegen' ? 'Σ p = 0' : '1.731 A'), `${th}: answer (${s.answer})`);
  check(s.steps === n && s.figs >= n - 3, `${th}: ${s.steps} steps, ${s.figs} drawn`);
  check(!/NaN|undefined|Infinity/.test(s.text), `${th}: no NaN / undefined in the text`);
}
const th = await page.evaluate(() => document.querySelector('.th-body').textContent);
check(/Vs1 = Is1 Req1/.test(th) && /Is1 = V1R1/.test(th), 'source transformation shows both transformations');

// V_th by nodal or mesh analysis: the switch swaps the working, the answer stays
await page.evaluate(() => { app.editor.theorem.theorem = 'thevenin'; app.editor.theorem.go('target'); }); await page.waitForTimeout(300);
await page.click('.th-go'); await page.waitForTimeout(700);
await page.click('.th-alt [data-m=mesh]'); await page.waitForTimeout(400);
const mesh = await page.evaluate(() => ({ shown: [...document.querySelectorAll('.th-alt-b')].filter((b) => !b.hidden).map((b) => b.dataset.b), text: [...document.querySelectorAll('.th-alt-b:not([hidden])')].map((b) => b.textContent).join(' '), answer: document.querySelector('.th-answer b').textContent }));
check(mesh.shown.every((m) => m === 'mesh') && /KVL round mesh/.test(mesh.text) && mesh.answer.includes('1.731 A'), 'Mesh analysis switch shows KVL with mesh currents, same answer');
await page.click('.th-alt [data-m=nodal]'); await page.waitForTimeout(300);
for (const [th, expect] of [['nodal', 'KCL at'], ['mesh', 'KVL round mesh']]) {
  await page.evaluate((t) => { app.editor.theorem.theorem = t; app.editor.theorem.go('solve'); }, th); await page.waitForTimeout(600);
  const s = await page.evaluate(() => ({ answer: document.querySelector('.th-answer b').textContent, text: document.querySelector('.th-body').textContent }));
  check(s.answer.includes('1.731 A') && s.text.includes(expect) && !/NaN|undefined/.test(s.text), `${th} analysis: ${s.answer}`);
}

// Millman on parallel batteries, reciprocity and a star–delta bridge on the Wheatstone example
for (const [ex, load, th, expect] of [['millman', 'R4', 'millman', '961.9 mA'], ['wheatstone', 'R6', 'reciprocity', '305.6 mA'], ['wheatstone', 'R6', 'thevenin', '305.6 mA']]) {
  await page.evaluate((ex) => { app.editor.theorem.close(); app.goHome(); app.openExample(ex); }, ex);
  await page.waitForTimeout(800);
  await page.evaluate(([load, th]) => {
    const v = app.editor.theorem; v.open(); v.theorem = th; v.target = app.editor.doc.elements.findIndex((e) => e.name === load); v.go('solve');
  }, [load, th]);
  await page.waitForTimeout(800);
  const s = await page.evaluate(() => ({ answer: document.querySelector('.th-answer b').textContent, text: document.querySelector('.th-body').textContent }));
  check(s.answer.includes(expect) && !/NaN|undefined/.test(s.text), `${ex}: ${th} gives ${expect} (${s.answer})`);
  if (th === 'thevenin') check(/delta \(Δ\)/.test(s.text), 'the bridge’s R_th goes through a delta → star step');
  if (th === 'reciprocity') check(/reciprocity holds/.test(s.text), 'reciprocity holds');
}
await page.evaluate(() => { app.editor.theorem.close(); app.goHome(); app.openExample('theorems'); }); await page.waitForTimeout(800);
await page.evaluate(() => { const v = app.editor.theorem; v.open(); v.theorem = 'thevenin'; v.go('target'); }); await page.waitForTimeout(300);
await page.click('.th-go'); await page.waitForTimeout(600);

// Back walks the stages, then closes
await page.evaluate(() => app.back()); await page.waitForTimeout(200);
check(await page.isVisible('.th-go'), 'Back: solution → component');
await page.evaluate(() => app.back()); await page.waitForTimeout(200);
check(await page.isVisible('.th-cards'), 'Back: component → theorem');
await page.evaluate(() => app.back()); await page.waitForTimeout(200);
check(!(await page.isVisible('.overlay.theorem.open')), 'Back: closes the page');

// Run the circuit
await page.evaluate(() => app.editor.theorem.open()); await page.waitForTimeout(200);
await page.click('[data-th=norton]'); await page.waitForTimeout(300);
await page.click('.th-go'); await page.waitForTimeout(600);
await page.click('[data-x=run]'); await page.waitForTimeout(600);
const run = await page.evaluate(() => ({ open: document.querySelector('.overlay.theorem').classList.contains('open'), running: app.editor.running, sel: app.editor.selected()?.name }));
check(!run.open && run.running && run.sel === 'R4', `Run the circuit: board running with R4 selected ${JSON.stringify(run)}`);

// a circuit the theorems cannot take explains why
await page.evaluate(() => { app.editor.setRunning(false); app.goHome(); app.openExample('ceamp'); }); await page.waitForTimeout(900);
await page.evaluate(() => app.editor.theorem.open()); await page.waitForTimeout(300);
const warn = await page.textContent('.th-warn').catch(() => '');
check(/Q1/.test(warn) && (await page.$$eval('.th-card[disabled]', (x) => x.length)) === 10, 'a transistor circuit is refused, naming the part');

check(!errs.length, `no page errors ${errs.join(' | ')}`);
await browser.close(); server.close();
if (fail) { console.log(`FAIL (${fail})`); process.exit(1); }
console.log('all ok');
