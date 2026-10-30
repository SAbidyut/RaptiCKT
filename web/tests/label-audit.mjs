// Runs every example and reports text that overlaps other text (value labels and
// live readings) or sits on a part's body, measured at the size it is drawn (labels grow when
// the board is zoomed out). Usage: node tests/label-audit.mjs (LK=1: also list the examples
// whose labels are drawn bigger)
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('dist');
const server = http.createServer((req, res) => {
  const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1));
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 412, height: 892 } })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.evaluate(() => localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true })));
await page.waitForTimeout(2200);
const ids = await page.evaluate(() => [...document.querySelectorAll('[data-ex]')].map((b) => b.dataset.ex));
const all = await page.evaluate(() => app.home ? null : null);
void all;
const exIds = await page.evaluate(() => { app.home.tab = 'examples'; app.home.cat = 'All'; app.home.render(); return [...document.querySelectorAll('[data-ex]')].map((b) => b.dataset.ex); });
// optional custom scene: SCENE='{"doc":{...},"after":"js run after 0.5 s"}'
const scene = process.env.SCENE ? JSON.parse(process.env.SCENE) : null;
let total = 0;
for (const id of scene ? ['scene'] : exIds.length ? exIds : ids) {
  if (scene) {
    await page.evaluate((d) => window.raptiOpenText('s.rckt', JSON.stringify(d)), scene.doc);
    await page.waitForTimeout(300);
    if (scene.setup) await page.evaluate(scene.setup);
    await page.click('[data-a=run]');
    await page.waitForTimeout(600);
    if (scene.after) await page.evaluate(scene.after);
    await page.waitForTimeout(1500);
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
  } else {
    await page.evaluate((id) => { app.goHome(); app.openExample(id); }, id);
    await page.waitForTimeout(1800);
  }
  const res = await page.evaluate(() => {
    const ed = app.editor, R = ed.renderer, st = ed.drawState(), ctx = R.ctx;
    const texts = [];
    for (const e of ed.doc.elements) {
      const val = e.valueLabel();
      const txt = st.settings.showNames && !e.constructor.noName ? e.name + (val ? ' ' + val : '') : val;
      const r = txt && e.labelRect(txt, undefined, R.lk || 1); // as drawn: labels grow when zoomed out
      if (r) texts.push({ who: e.name + ' label "' + txt + '"', r, el: e });
    }
    const lay = R._live;
    if (lay) {
      ctx.save(); ctx.font = `600 ${10 * (lay.lk || 1)}px Inter, system-ui, sans-serif`; // (readings shrink back where big ones find no room)
      const rect = (L, txt) => {
        const w = ctx.measureText(txt).width, h = 11 * (lay.lk || 1);
        const x1 = L.align === 'left' ? L.x : L.align === 'right' ? L.x - w : L.x - w / 2;
        const y1 = L.base === 'top' ? L.y : L.base === 'bottom' ? L.y - h : L.y - h / 2;
        return [x1, y1, x1 + w, y1 + h];
      };
      for (const L of lay.volts) texts.push({ who: 'V@net' + L.node, r: rect(L, '-88.8 mV~') });
      for (const L of lay.amps) texts.push({ who: 'I@' + L.el.name, r: rect(L, '→ 88.8 mA~'), el: L.el });
      ctx.restore();
    }
    const ov = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
    const bad = [];
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
      const a = ov(texts[i].r, texts[j].r);
      if (a > 6 * (R.lk || 1) ** 2) bad.push(`${texts[i].who} × ${texts[j].who} (${a.toFixed(0)}px²)`);
    }
    for (const t of texts) for (const e of ed.doc.elements) {
      if (t.el === e) continue;
      const a = ov(t.r, e.worldBox());
      if (a > 20 * (R.lk || 1) ** 2) bad.push(`${t.who} on body of ${e.name} (${a.toFixed(0)}px²)`);
    }
    return { bad, lk: R.lk || 1 };
  });
  total += res.bad.length;
  if (process.env.LK && res.lk > 1) console.log(`${id}: labels ×${res.lk}`);
  if (res.bad.length) console.log(id + ` (labels ×${res.lk}):\n  ` + res.bad.join('\n  '));
}
console.log('overlaps:', total, errs.length ? errs.join('\n') : 'no errors');
await browser.close(); server.close();
