#!/usr/bin/env bash
# Rebuilds the finished website folder + zip from the app source.
#   ./website/build-site.sh            (run from anywhere inside the repo)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="$ROOT/website/raptickt-website"
cd "$ROOT/web"
[ -d node_modules ] || npm ci
npm run build
# (set CHROMIUM_PATH if Playwright cannot find its own browser)
[ -z "${CHROMIUM_PATH:-}" ] && [ -x /opt/pw-browsers/chromium ] && export CHROMIUM_PATH=/opt/pw-browsers/chromium
node tools/site-assets.mjs "$SITE"

# the simulator itself (static files, runs entirely in the browser)
rm -rf "$SITE/simulator" && mkdir -p "$SITE/simulator"
cp dist/index.html dist/app.js dist/styles.css dist/icon.svg "$SITE/simulator/"

# images, manual
cp public/icon.svg "$SITE/assets/img/icon.svg"
mkdir -p "$SITE/assets/img/screenshots"
python3 - "$ROOT" "$SITE" <<'PY'
import sys, glob, os
from PIL import Image
root, site = sys.argv[1:3]
for f in glob.glob(os.path.join(root, 'marketing/screenshots/*.png')):
    im = Image.open(f).convert('RGB'); im.thumbnail((540, 1170))
    im.save(os.path.join(site, 'assets/img/screenshots', os.path.basename(f)[:-4] + '.jpg'), quality=82, optimize=True)
im = Image.open(os.path.join(root, 'marketing/feature-graphic-1024x500.png')).convert('RGB')
im.save(os.path.join(site, 'assets/img/feature-graphic.png'), optimize=True)
PY
cp "$ROOT/docs/MANUAL.md" "$SITE/content/MANUAL.md"

# the zip
cd "$ROOT/website"
rm -f raptickt-website.zip
zip -qr raptickt-website.zip raptickt-website -x '*/storage/messages.log' '*/.DS_Store'
echo "done: $SITE and $ROOT/website/raptickt-website.zip"
