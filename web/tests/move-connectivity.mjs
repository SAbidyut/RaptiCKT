// Drags every part of every example by a few grid steps and checks that the
// netlist does not change (no wire torn off, no false connection), apart from
// cases where the part itself lands on another terminal or wire.
// Usage: npm run build && node tests/move-connectivity.mjs [exampleIds] [partNames]
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const server = http.createServer((req, res) => { const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' }); fs.createReadStream(f).pipe(res); }).listen(0);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 2 })).newPage();
await page.addInitScript(() => localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true })));
await page.addInitScript(() => {
  // connectivity signature: which terminals share a net (same rules as the simulator)
  window.netSig = () => {
    const d = app.editor.doc, par = new Map();
    const k = (p) => p[0] + ',' + p[1];
    const f = (x) => { if (!par.has(x)) par.set(x, x); while (par.get(x) !== x) { par.set(x, par.get(par.get(x))); x = par.get(x); } return x; };
    const u = (a, b) => par.set(f(a), f(b));
    const pts = [];
    for (const w of d.wires) w.pts.forEach((p, i) => { pts.push(p); if (i) u(k(w.pts[i - 1]), k(p)); });
    for (const e of d.elements) for (const p of e.getPosts()) { pts.push(p); f(k(p)); }
    for (const w of d.wires) for (let i = 1; i < w.pts.length; i++) {
      const [a, b] = [w.pts[i - 1], w.pts[i]];
      for (const p of pts) {
        const cr = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
        if (Math.abs(cr) > 1e-6) continue;
        const dot = (p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1]), l2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
        if (dot >= 0 && dot <= l2) u(k(p), k(a));
      }
    }
    const lab = new Map(); const out = [];
    for (const e of d.elements) out.push(e.name + ':' + e.getPosts().map((p) => { const r = f(k(p)); if (!lab.has(r)) lab.set(r, lab.size); return lab.get(r); }).join('.'));
    return out.join(' ');
  };
});
await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForTimeout(1800);
const G = 20;
const scr = (x, y) => page.evaluate(([x, y]) => { const r = app.editor.canvas.getBoundingClientRect(); const [sx, sy] = app.editor.renderer.toScreen(x, y); return [sx + r.left, sy + r.top]; }, [x, y]);
// every example: move every part by a few offsets and check the netlist never changes
const ids = await page.evaluate(() => { app.home.tab = 'examples'; app.home.cat = 'All'; return (window.EXIDS = null, null); });
let all = await page.evaluate(() => { app.home.render(); return [...document.querySelectorAll('[data-ex]')].map((b) => b.dataset.ex); });
if (process.argv[2]) all = process.argv[2].split(',');
let bad = 0, n = 0;
for (const id of all) {
  await page.evaluate((id) => { app.goHome(); app.openExample(id); app.editor.setRunning(false); app.editor.fit(); }, id);
  await page.waitForTimeout(300);
  let names = await page.evaluate(() => app.editor.doc.elements.filter((e) => e.getPosts().length).map((e) => e.name));
  if (process.argv[3]) names = process.argv[3].split(',');
  for (const name of names) {
    for (const [dx, dy] of [[2, 1], [-3, 2]]) {
      const before = await page.evaluate(() => netSig());
      const e = await page.evaluate((nm) => { const el = app.editor.doc.elements.find((x) => x.name === nm); return [el.x, el.y]; }, name);
      const a = await scr(e[0], e[1]), b = await scr(e[0] + dx * G, e[1] + dy * G);
      await page.mouse.move(...a); await page.mouse.down();
      for (let i = 1; i <= 6; i++) await page.mouse.move(a[0] + (b[0] - a[0]) * i / 6, a[1] + (b[1] - a[1]) * i / 6);
      const type = await page.evaluate(() => app.editor.gesture && app.editor.gesture.type);
      await page.mouse.up();
      if (type !== 'move') { await page.evaluate(() => app.editor.undo && app.editor.undo()); continue; }
      n++;
      const after = await page.evaluate(() => netSig());
      if (before !== after) {
        const parse = (sig) => sig.split(' ').flatMap((t) => { const [nm, ps] = t.split(':'); return ps ? ps.split('.').map((v, i) => [nm + '#' + i, v]) : []; });
        const A = parse(before), B = new Map(parse(after));
        let lost = 0, gained = 0;
        for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
          const sameA = A[i][1] === A[j][1], sameB = B.get(A[i][0]) === B.get(A[j][0]);
          if (sameA && !sameB) lost++; if (!sameA && sameB) gained++;
        }
        const landed = await page.evaluate((nm) => { const d = app.editor.doc, el = d.elements.find((x) => x.name === nm); const mine = el.getPosts();
          const others = d.elements.filter((x) => x !== el).flatMap((x) => x.getPosts());
          const onWire = (p) => d.wires.some((w) => w.pts.some((b2, i) => { if (!i) return false; const a2 = w.pts[i - 1];
            if (Math.abs((b2[0] - a2[0]) * (p[1] - a2[1]) - (b2[1] - a2[1]) * (p[0] - a2[0])) > 1e-6) return false;
            const dot = (p[0] - a2[0]) * (b2[0] - a2[0]) + (p[1] - a2[1]) * (b2[1] - a2[1]); return dot > 0 && dot < (b2[0] - a2[0]) ** 2 + (b2[1] - a2[1]) ** 2; }));
          const own = new Set(d.wires.filter((w) => mine.some((p) => (w.pts[0][0] === p[0] && w.pts[0][1] === p[1]) || (w.pts.at(-1)[0] === p[0] && w.pts.at(-1)[1] === p[1]))));
          const onOther = (p) => d.wires.some((w) => !own.has(w) && w.pts.some((b2, i) => { if (!i) return false; const a2 = w.pts[i - 1];
            if (Math.abs((b2[0] - a2[0]) * (p[1] - a2[1]) - (b2[1] - a2[1]) * (p[0] - a2[0])) > 1e-6) return false;
            const dot = (p[0] - a2[0]) * (b2[0] - a2[0]) + (p[1] - a2[1]) * (b2[1] - a2[1]); return dot >= 0 && dot <= (b2[0] - a2[0]) ** 2 + (b2[1] - a2[1]) ** 2; }));
          void onWire;
          if (mine.some((p) => others.some((q) => q[0] === p[0] && q[1] === p[1]))) return 'post on post';
          if (mine.some(onOther)) return 'post on a wire';
          const box = el.worldBox();
          return 'routing? box ' + JSON.stringify(box); }, name);
                bad++; console.log(lost ? 'LOST' : 'GAINED', id, name, dx, dy, 'lost', lost, 'gained', gained, landed);
      }
      await page.evaluate(() => app.editor.undo());
    }
  }
}
console.log('moves', n, 'changed', bad);
await browser.close(); server.close();
