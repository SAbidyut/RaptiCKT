// Renders public/icon.svg to the PNG icons the website build uses (home-screen / app icons).
// Run once after changing the logo: node tools/icons.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';

const svg = fs.readFileSync('public/icon.svg', 'utf8');
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage();
for (const [name, size, pad] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['apple-touch-icon.png', 180, 14]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0;background:#0b1120;display:grid;place-items:center;width:${size}px;height:${size}px">
    <img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${size - 2 * pad}" height="${size - 2 * pad}"></body>`);
  await page.screenshot({ path: `public/${name}` });
}
await browser.close();
console.log('icons written to public/');
