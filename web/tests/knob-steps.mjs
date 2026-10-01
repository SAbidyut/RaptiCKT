// Linear knob steps follow the value's own size (voltage, current, mains,
// β, percent): the dial moves whole units, − / + a tenth of that.
// Usage: npm run build && node tests/knob-steps.mjs
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const server = http.createServer((req, res) => { const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' }); fs.createReadStream(f).pipe(res); }).listen(0);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true })));
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForTimeout(2300);
await page.evaluate(() => app.newCircuit()); await page.waitForTimeout(300);
const cases = [
  ['dcv', [['step', 1], ['step', 1], ['bump', 1], ['step', -1], ['bump', -1]], [6, 7, 7.1, 7, 6.9]],
  ['dcv', [['step', -1], ['step', -1], ['step', -1], ['step', -1], ['step', -1], ['step', -1]], [4, 3, 2, 1, 0, -1]],
  ['dci', [['step', 1], ['bump', 1]], [0.02, 0.021]],
  ['mains', [['step', 1], ['bump', 1], ['step', -1]], [240, 241, 240]],
  ['npn', [['step', 1], ['bump', 1]], [420, 421]],
  ['pot', [['step', 1], ['bump', 1]], [51, 51.1]],
];
let fails = 0;
for (const [type, ops, want] of cases) {
  const got = await page.evaluate(([type, ops]) => {
    const ed = app.editor; ed.addComponent(type); const e = [...ed.selection][0]; const k = ed.knob; const key = e.knobProp().key;
    return ops.map(([op, n]) => { k[op](n); return e.p[key]; });
  }, [type, ops]);
  const ok = got.every((v, i) => Math.abs(v - want[i]) < 1e-9);
  if (!ok) fails++;
  console.log(ok ? 'ok  ' : 'FAIL', type.padEnd(6), got.join(' → '), ok ? '' : `(want ${want.join(' → ')})`);
}
console.log(errs.length ? errs : 'no page errors', fails ? `${fails} FAILED` : 'all passed');
await browser.close(); server.close();
