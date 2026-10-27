// Generates the data the PHP website needs from the app itself:
//   content/examples.json              id, category, title, short description of all examples
//   assets/img/examples/<id>.jpg       a thumbnail of each example circuit
// Run after `npm run build` (it serves dist/ and draws the thumbnails in a headless browser).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import { EXAMPLES } from '../src/ui/examples.js';

const site = path.resolve(process.argv[2] || '../website/raptickt-website');
const dist = path.resolve('dist');
const imgDir = path.join(site, 'assets/img/examples');
fs.mkdirSync(imgDir, { recursive: true });
fs.mkdirSync(path.join(site, 'content'), { recursive: true });

const short = (s) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > 230 ? s.slice(0, 227).replace(/\s+\S*$/, '') + '…' : s; };
fs.writeFileSync(path.join(site, 'content/examples.json'),
  JSON.stringify(EXAMPLES.map((e) => ({ id: e.id, cat: e.cat, title: e.title, desc: short(e.desc) })), null, 1));

const types = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.html': 'text/html' };
const srv = http.createServer((q, r) => {
  const f = path.join(dist, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (err, d) => { if (err) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); } });
}).listen(0);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
await page.goto(`http://localhost:${srv.address().port}/`);
await page.waitForFunction(() => window.app && window.app.editor);
let n = 0;
for (const ex of EXAMPLES) {
  const url = await page.evaluate((id) => { window.app.openExample(id); return window.app.thumbnail(window.app.editor.doc, 480, 300); }, ex.id);
  fs.writeFileSync(path.join(imgDir, ex.id + '.jpg'), Buffer.from(url.split(',')[1], 'base64'));
  n++;
}
await browser.close(); srv.close();
console.log(`site data: ${n} examples + thumbnails -> ${site}`);
