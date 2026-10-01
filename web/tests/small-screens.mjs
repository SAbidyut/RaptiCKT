// Small-screen audit: every main screen at phone sizes from 320 px up; reports
// anything that sticks out sideways or is cut off, and saves screenshots.
// Usage: npm run build && node tests/small-screens.mjs [outDir]
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const out = process.argv[2] || 'shots-small'; fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => { const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' }); fs.createReadStream(f).pipe(res); }).listen(0);
const browser = await chromium.launch();
const sizes = (process.env.SIZES || '320x568,360x640,360x760,412x892').split(',').map((s) => s.split('x').map(Number));
const errs = [];
let problems = 0;
// elements poking out of the screen sideways (horizontal rows and the board are allowed to)
const audit = () => {
  const vw = innerWidth, vh = innerHeight, bad = [];
  const skip = (el) => el.closest('.h-track, .h-row, canvas, .chips, .card-row, .knob-digits, .knob-ticks, .toast:not(.show)');
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.top > vh) continue;
    let hidden = false; for (let p = el; p; p = p.parentElement) { const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0 || p.classList.contains('screen') && !p.classList.contains('on') && !p.classList.contains('active')) { hidden = true; break; } }
    if (hidden || skip(el)) continue;
    // clipped by a scrolling / clipping parent that itself fits on screen: fine
    let clipped = false; for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { if (getComputedStyle(p).overflowX !== 'visible') { const q = p.getBoundingClientRect(); if (q.left >= -1.5 && q.right <= vw + 1.5) { clipped = true; break; } } }
    if (clipped && !(el.children.length === 0 && el.textContent.trim())) continue;
    if (clipped) { if (el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== 'ellipsis' && /hidden|clip/.test(cs.overflowX)) bad.push(`cut ${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${el.textContent.trim().slice(0, 30)}"`); continue; }
    if (r.right > vw + 1.5 || r.left < -1.5) bad.push(`out ${el.tagName.toLowerCase()}.${[...el.classList].join('.')} [${Math.round(r.left)}..${Math.round(r.right)}] "${(el.textContent || '').trim().slice(0, 30)}"`);
    // text cut off without an ellipsis
    if (el.children.length === 0 && el.textContent.trim() && el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== 'ellipsis' && /hidden|clip/.test(cs.overflowX)) bad.push(`cut ${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${el.textContent.trim().slice(0, 30)}"`);
  }
  return [...new Set(bad)].slice(0, 25);
};
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true, selectHelp: true })));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(`${w}x${h}: ${e.message}`));
  await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForTimeout(2400);
  const shot = async (name, fn) => {
    if (fn) { await page.evaluate(fn); await page.waitForTimeout(700); }
    const bad = await page.evaluate(audit);
    await page.screenshot({ path: `${out}/${w}x${h}-${name}.png` });
    if (bad.length) { problems += bad.length; console.log(`${w}x${h} ${name}:\n  ` + bad.join('\n  ')); }
  };
  await shot('home');
  for (const t of ['examples', 'library', 'about']) await shot(t, `document.querySelector('[data-tab=${t}]').click()`);
  await shot('settings', () => app.openSettings());
  await page.evaluate(() => app.closeSettings());
  await shot('editor', () => app.openExample('led'));
  await shot('palette', () => { app.goHome(); app.newCircuit(); document.querySelector('[data-t=add], [data-a=add], .fab')?.click(); });
  await shot('knob', () => { const ed = app.editor; ed.palette?.close?.(); ed.addComponent('dci'); });
  await shot('inspector', () => document.querySelector('.quickbar .qb-main')?.click());
  await ctx.close();
}
console.log(errs.length ? errs : 'no page errors', problems ? `${problems} problems` : 'no layout problems');
await browser.close(); server.close();
