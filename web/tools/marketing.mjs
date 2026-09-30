// Generates store/marketing assets from the real app: icon, feature graphic and screenshots.
// Usage: npm run build && node tools/marketing.mjs ../marketing
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { LOGO_SVG } from '../src/ui/icons.js';

const out = path.resolve(process.argv[2] || '../marketing');
fs.mkdirSync(path.join(out, 'screenshots'), { recursive: true });
const root = path.resolve('dist');
const server = http.createServer((req, res) => {
  const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1).split('?')[0]);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();

// ---- screenshots (1080 x 2340 at 2.625 dpr of 411 x 891)
const ctx = await browser.newContext({ viewport: { width: 411, height: 891 }, deviceScaleFactor: 2.628 });
const page = await ctx.newPage();
await page.goto(url);
await page.evaluate(() => localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true })));
await page.waitForTimeout(2300);
const shots = [
  ['1-home', null, 400],
  ['2-lrc-oscillator', 'app.openExample("lrc"); setTimeout(()=>{const s=app.editor.doc.elements.find(e=>e.name==="S1"); s.p.closed=false; app.editor.sim.dirty=true;}, 1500)', 3000],
  ['3-555-timer', 'app.goHome(); app.openExample("timer555")', 2600],
  ['4-amplifier-knob', 'app.goHome(); app.openExample("ceamp"); setTimeout(()=>app.editor.select(app.editor.doc.elements.find(e=>e.name==="Q1")),1200)', 2600],
  ['5-bode-plot', 'app.goHome(); app.openExample("bandpass"); setTimeout(()=>{app.editor.analysis.open("bode"); document.querySelector("#an-f1").value="100 Hz"; document.querySelector("#an-f2").value="200 kHz"; document.querySelector("#an-run").click();},1200)', 2400],
  ['6-components', 'app.editor.analysis.close(); app.goHome(); app.openExample("gates"); setTimeout(()=>{app.editor.palette.tab="Sensors"; app.editor.palette.open();},1000)', 2200],
  ['7-logic', 'app.editor.palette.close(); app.goHome(); app.openExample("counter")', 3500],
  ['8-about', 'app.goHome(); app.home.tab="about"; app.home.render()', 600],
];
for (const [name, js, wait] of shots) {
  if (js) await page.evaluate(js);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: path.join(out, 'screenshots', name + '.png') });
  console.log('screenshot', name);
}

// ---- icon 512
const ip = await browser.newPage({ viewport: { width: 512, height: 512 } });
await ip.setContent(`<html><body style="margin:0;background:#070b14">${LOGO_SVG(512, 'i').replace('viewBox="0 0 128 128"', 'viewBox="-14 -14 156 156"').replace(/<rect x="4" y="4" width="120" height="120" rx="32"/g, '<rect x="-14" y="-14" width="156" height="156"')}</body></html>`);
await ip.screenshot({ path: path.join(out, 'icon-512.png'), omitBackground: false });

// ---- feature graphic 1024x500
const shot = fs.readFileSync(path.join(out, 'screenshots', '2-lrc-oscillator.png')).toString('base64');
const shot2 = fs.readFileSync(path.join(out, 'screenshots', '3-555-timer.png')).toString('base64');
const fp = await browser.newPage({ viewport: { width: 1024, height: 500 } });
await fp.setContent(`<html><head><style>
  body{margin:0;width:1024px;height:500px;overflow:hidden;font-family:Inter,Roboto,system-ui,sans-serif;color:#fff;
   background:radial-gradient(circle at 80% 20%,rgba(139,92,246,.55),transparent 55%),radial-gradient(circle at 5% 100%,rgba(34,211,238,.45),transparent 55%),linear-gradient(135deg,#0b1633,#1a1150);}
  .t{position:absolute;left:56px;top:92px;width:520px}
  h1{margin:18px 0 6px;font-size:66px;font-weight:800;letter-spacing:.5px}
  h1 span{background:linear-gradient(135deg,#22d3ee,#8b5cf6);-webkit-background-clip:text;color:transparent}
  .tag{letter-spacing:5px;text-transform:uppercase;color:#a5b4d4;font-size:16px}
  p{font-size:25px;line-height:1.3;color:#e2ecff;margin:20px 0 0;font-weight:600}
  .ph{position:absolute;width:236px;border-radius:30px;border:6px solid #0a0f1c;box-shadow:0 30px 60px rgba(0,0,0,.55)}
  .wave{position:absolute;left:0;right:0;bottom:-10px;opacity:.35}
</style></head><body>
  <svg class="wave" viewBox="0 0 1024 120"><path d="M0 60 C60 0 120 0 180 60 S300 120 360 60 480 0 540 60 660 120 720 60 840 0 900 60 1020 120 1080 60" fill="none" stroke="#22d3ee" stroke-width="3"/></svg>
  <div class="t">${LOGO_SVG(84, 'f')}<h1>Rapti<span>CKT</span></h1><div class="tag">Resonance Automation</div>
  <p>Real-time circuit simulator with oscilloscope, Bode plots &amp; 330+ components</p></div>
  <img class="ph" style="left:620px;top:40px;transform:rotate(-6deg)" src="data:image/png;base64,${shot2}">
  <img class="ph" style="left:760px;top:70px;transform:rotate(5deg)" src="data:image/png;base64,${shot}">
</body></html>`);
await fp.waitForTimeout(300);
await fp.screenshot({ path: path.join(out, 'feature-graphic-1024x500.png') });
console.log('icon + feature graphic done');
await browser.close();
server.close();
