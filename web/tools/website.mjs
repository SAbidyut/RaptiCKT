// Builds the website package of RaptiCKT for rapti.net into ../website:
//   website/raptickt/              the folder to upload (open index.html, or embed it)
//   website/raptickt-website.zip   the same folder, zipped
// Every path inside is relative, so the folder works from any sub-path (rapti.net/simulator/,
// rapti.net/tools/raptickt/ …) or inside an <iframe> on a section of a page.
// Run: npm run website
import * as esbuild from 'esbuild';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve('../website');
const out = path.join(root, 'raptickt');
const zipName = 'raptickt-website.zip';

fs.rmSync(out, { recursive: true, force: true });
for (const d of ['css', 'js', 'assets']) fs.mkdirSync(path.join(out, d), { recursive: true });

// --- the app and its styles, minified
await esbuild.build({
  entryPoints: ['src/main.js'], bundle: true, format: 'iife', target: ['chrome80', 'safari14', 'firefox78'],
  minify: true, legalComments: 'none', outfile: path.join(out, 'js/app.js'),
});
await esbuild.build({
  entryPoints: ['src/styles.css'], bundle: true, minify: true, loader: { '.css': 'css' },
  target: ['chrome80', 'safari14', 'firefox78'], outfile: path.join(out, 'css/styles.css'),
});

// --- icons (PNG versions are made once by tools/icons.mjs and kept in public/)
for (const f of ['icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) {
  if (fs.existsSync(path.join('public', f))) fs.copyFileSync(path.join('public', f), path.join(out, 'assets', f));
}

const hash = (files) => {
  const h = crypto.createHash('sha256');
  for (const f of files) h.update(fs.readFileSync(path.join(out, f)));
  return h.digest('hex').slice(0, 10);
};
const ver = hash(['js/app.js', 'css/styles.css']);

// --- boot script: service worker for offline use and instant repeat visits
fs.writeFileSync(path.join(out, 'js/boot.js'), `// Registers the offline cache (only over https or on localhost).
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}
`);

const assets = fs.readdirSync(path.join(out, 'assets')).map((f) => 'assets/' + f);
const precache = ['./', 'index.html', `css/styles.css?v=${ver}`, `js/app.js?v=${ver}`, 'js/boot.js', 'manifest.webmanifest', ...assets];

fs.writeFileSync(path.join(out, 'sw.js'), `// RaptiCKT offline cache. A new build changes VERSION, so visitors get the update
// on their next visit and old caches are removed.
const VERSION = 'raptickt-${ver}';
const FILES = ${JSON.stringify(precache)};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('raptickt-') && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // the page: fresh from the network when online, the cached copy when offline
    e.respondWith(fetch(req).then((r) => { const c = r.clone(); caches.open(VERSION).then((cc) => cc.put(req, c)); return r; })
      .catch(() => caches.match(req).then((r) => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then((r) => r || fetch(req)));
});
`);

fs.writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify({
  name: 'RaptiCKT – Circuit Simulator',
  short_name: 'RaptiCKT',
  description: 'Real-time analog, digital and mixed-signal circuit simulator by RAPTI – Resonance Automation Professional Training Institute.',
  start_url: './',
  scope: './',
  display: 'standalone',
  background_color: '#0b1120',
  theme_color: '#0b1120',
  icons: [
    { src: 'assets/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    { src: 'assets/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'assets/icon-512.png', sizes: '512x512', type: 'image/png' },
  ],
}, null, 2) + '\n');

const desc = 'RaptiCKT – free online circuit simulator by RAPTI: real-time analog, digital and mixed-signal simulation with 520 components, oscilloscope, multimeter, Bode plots and SPICE export.';
fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
  <meta name="theme-color" content="#0b1120">
  <meta name="color-scheme" content="dark light">
  <meta name="description" content="${desc}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="RaptiCKT – Circuit Simulator">
  <meta property="og:description" content="${desc}">
  <meta property="og:site_name" content="RAPTI">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="RaptiCKT">
  <title>RaptiCKT – Circuit Simulator | RAPTI</title>
  <link rel="icon" href="assets/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="preload" href="js/app.js?v=${ver}" as="script">
  <link rel="stylesheet" href="css/styles.css?v=${ver}">
</head>
<body>
  <div id="app"></div>
  <noscript><p style="font:16px system-ui,sans-serif;color:#e2e8f0;padding:24px">RaptiCKT needs JavaScript. Please turn it on to use the circuit simulator.</p></noscript>
  <script src="js/app.js?v=${ver}" defer></script>
  <script src="js/boot.js" defer></script>
</body>
</html>
`);

// a ready-made example of the simulator sitting in a section of a rapti.net page
fs.writeFileSync(path.join(out, 'embed-example.html'), `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RaptiCKT on rapti.net – embed example</title>
  <link rel="icon" href="assets/icon.svg" type="image/svg+xml">
  <style>
    body { margin: 0; font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: #f1f5f9; color: #0f172a; }
    header, footer { padding: 20px 16px; text-align: center; }
    /* ---- copy from here: the simulator section ---- */
    .raptickt-section { max-width: 1280px; margin: 0 auto; padding: 0 16px 32px; }
    .raptickt-section h2 { margin: 8px 0 4px; }
    .raptickt-frame { position: relative; width: 100%; height: min(86vh, 860px); min-height: 560px; border-radius: 16px; overflow: hidden; background: #0b1120; box-shadow: 0 10px 40px rgba(2, 6, 23, .25); }
    .raptickt-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    @media (max-width: 640px) { .raptickt-section { padding: 0 0 24px; } .raptickt-frame { border-radius: 0; height: 92vh; height: 92dvh; min-height: 480px; } }
    /* ---- to here ---- */
  </style>
</head>
<body>
  <header><b>rapti.net</b> – your page header</header>

  <!-- ===== RaptiCKT simulator section: paste this into your page ===== -->
  <section class="raptickt-section" id="simulator">
    <h2>RaptiCKT Circuit Simulator</h2>
    <p>Build and run circuits right in your browser. <a href="./" target="_blank" rel="noopener">Open full screen ↗</a></p>
    <div class="raptickt-frame">
      <iframe src="./" title="RaptiCKT circuit simulator" loading="lazy" allow="fullscreen; clipboard-write; web-share" allowfullscreen></iframe>
    </div>
  </section>
  <!-- ===== end of the RaptiCKT section ===== -->

  <footer>Your page footer</footer>
</body>
</html>
`);

// Apache (cPanel hosting): gzip the big files and let browsers keep them; sw.js is always re-checked
fs.writeFileSync(path.join(out, '.htaccess'), `<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript text/javascript application/manifest+json image/svg+xml
</IfModule>
<IfModule mod_mime.c>
  AddType application/manifest+json .webmanifest
</IfModule>
<IfModule mod_headers.c>
  <FilesMatch "\\.(js|css|png|svg)$">
    Header set Cache-Control "public, max-age=604800"
  </FilesMatch>
  <FilesMatch "^(sw\\.js|index\\.html|manifest\\.webmanifest)$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>
`);

fs.copyFileSync(path.join(root, 'README.md'), path.join(out, 'README.md'));

// --- zip
const zip = path.join(root, zipName);
fs.rmSync(zip, { force: true });
execFileSync('zip', ['-rqX9', zipName, 'raptickt'], { cwd: root });

const kb = (f) => (fs.statSync(f).size / 1024).toFixed(0) + ' KB';
console.log(`website/raptickt  app.js ${kb(path.join(out, 'js/app.js'))}, styles.css ${kb(path.join(out, 'css/styles.css'))}  ->  website/${zipName} (${kb(zip)})`);
