// Bundles the web app into dist/ and copies it into the Android assets folder.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const watch = process.argv.includes('--watch');
const out = 'dist';
const android = path.resolve('../android/app/src/main/assets/www');

function copyStatic() {
  fs.mkdirSync(out, { recursive: true });
  for (const f of ['index.html', 'src/styles.css', 'public/icon.svg']) {
    if (fs.existsSync(f)) fs.copyFileSync(f, path.join(out, path.basename(f)));
  }
  if (fs.existsSync(path.resolve('../android/app'))) {
    fs.rmSync(android, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(android), { recursive: true });
    fs.cpSync(out, android, { recursive: true });
  }
}

const opts = {
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: ['chrome80', 'safari14'],
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  outfile: path.join(out, 'app.js'),
  legalComments: 'none',
  plugins: [{ name: 'copy', setup(b) { b.onEnd(() => copyStatic()); } }],
};

if (watch) {
  const ctx = await esbuild.context(opts);
  await ctx.watch();
  console.log('watching…');
} else {
  await esbuild.build(opts);
  const kb = (fs.statSync(path.join(out, 'app.js')).size / 1024).toFixed(0);
  console.log(`built dist/app.js (${kb} KB)`);
}
