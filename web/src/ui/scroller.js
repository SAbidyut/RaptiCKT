// iOS-style scrolling for the app's pages.
//
// The content follows the finger 1:1, keeps moving after release with the same
// exponential deceleration UIScrollView uses (rate 0.998 per ms), and past
// either end it moves against a rubber band that stiffens the further it is
// pulled. A fling that runs into an end carries on into the band and springs
// back in one continuous motion (a critically damped spring, so it never
// wobbles). A thin indicator shows the position while moving.
//
// Everything is a transform on the content, driven by one requestAnimationFrame
// loop that only runs while something moves, so it stays on the compositor.

const DECEL = 0.998; // per millisecond, UIScrollView "normal"
const TAU = -1 / Math.log(DECEL); // ≈ 500 ms time constant of the coast
const RUBBER = 0.55; // UIScrollView's rubber-band constant
const OMEGA = 0.0145; // spring stiffness (rad/ms): bounce-back in ~0.35 s
const MAX_EDGE_V = 3.2; // px/ms carried into the band by a fling (caps the overshoot)

/**
 * viewport: the clipping element; content: the element that moves (a child of
 * viewport). opts.onScroll(y) is called on every change of the scroll offset.
 * Returns { y, scrollTo(y, animate), refresh(), destroy() }.
 */
export function iosScroll(viewport, content, opts = {}) {
  if (!viewport || !content) return null;
  if (viewport._ios) viewport._ios.destroy();
  viewport.classList.add('ios-scroll');
  content.classList.add('ios-content');

  let y = 0; // scroll offset (like scrollTop); < 0 or > max while in the band
  let max = 0;
  let raf = 0, mode = null, t0 = 0, last = 0;
  let a0 = 0, v0 = 0, anchor = 0, target = 0; // animation parameters
  let vNow = 0;

  const bar = document.createElement('div');
  bar.className = 'ios-bar';
  viewport.appendChild(bar);
  let barTimer = 0;

  const measure = () => {
    const pad = parseFloat(getComputedStyle(viewport).paddingBottom) || 0;
    max = Math.max(0, content.offsetTop + content.offsetHeight + pad - viewport.clientHeight);
  };
  const dim = () => viewport.clientHeight || 1;
  // displayed overshoot for a raw (finger) overshoot, and back
  const band = (x) => Math.sign(x) * (1 - 1 / ((Math.abs(x) * RUBBER) / dim() + 1)) * dim();
  const unband = (x) => { const d = dim(), r = Math.min(Math.abs(x) / d, 0.999); return Math.sign(x) * (d / RUBBER) * (1 / (1 - r) - 1); };
  const bound = (v) => (v < 0 ? 0 : v > max ? max : v);
  const over = () => y - bound(y);

  const showBar = () => {
    const h = dim(), total = max + h;
    if (max < 4) { bar.style.opacity = '0'; return; }
    let len = Math.max(36, (h * h) / total), pos = (y / max) * (h - len);
    const o = over();
    if (o) { len = Math.max(12, len - Math.abs(o)); pos = o < 0 ? 0 : h - len; } // squeezes at the ends like iOS
    bar.style.height = `${len - 6}px`;
    bar.style.transform = `translate3d(0, ${pos + 3}px, 0)`;
    bar.style.opacity = '1';
    clearTimeout(barTimer);
    barTimer = setTimeout(() => { if (!mode && !dragging) bar.style.opacity = '0'; }, 650);
  };
  const render = () => {
    content.style.transform = `translate3d(0, ${(-y).toFixed(2)}px, 0)`;
    showBar();
    opts.onScroll?.(y);
  };

  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; mode = null; };
  const frame = (now) => {
    raf = 0;
    const t = now - t0;
    if (mode === 'coast') {
      const e = Math.exp(-t / TAU);
      y = a0 + v0 * TAU * (1 - e);
      vNow = v0 * e;
      if (y < 0 || y > max) { // ran into an end: carry on into the band and spring back
        const b = y < 0 ? 0 : max, v = Math.sign(vNow) * Math.min(Math.abs(vNow), MAX_EDGE_V);
        startSpring(b, y - b, v, now);
      } else if (Math.abs(vNow) < 0.01) { stop(); render(); return; }
    } else if (mode === 'spring') {
      const e = Math.exp(-OMEGA * t), B = v0 + OMEGA * a0;
      const x = (a0 + B * t) * e;
      vNow = (B - OMEGA * (a0 + B * t)) * e;
      y = anchor + x;
      if (Math.abs(x) < 0.25 && Math.abs(vNow) < 0.01) { y = anchor; stop(); render(); return; }
    } else if (mode === 'glide') { // wheel / programmatic: ease towards the target
      const k = 1 - Math.exp(-(now - last) / 90);
      y += (target - y) * k;
      if (Math.abs(target - y) < 0.3) { y = target; stop(); render(); return; }
    }
    last = now;
    render();
    raf = requestAnimationFrame(frame);
  };
  const run = () => { if (!raf) raf = requestAnimationFrame(frame); };
  function startSpring(b, x, v, now = performance.now()) { mode = 'spring'; anchor = b; a0 = x; v0 = v; t0 = now; last = now; run(); }
  const startCoast = (v) => { mode = 'coast'; a0 = y; v0 = v; t0 = performance.now(); last = t0; run(); };
  const settle = (v = 0) => { const o = over(); if (o) startSpring(bound(y), o, v); else if (Math.abs(v) > 0.05) startCoast(v); };

  // ------------------------------------- horizontal rows inside the page
  // Native sideways scrolling inside moving content is unreliable in Chrome, so
  // rows that scroll sideways (card rows, chips) are driven here as well.
  let row = null, rowStart = 0, rowRaf = 0;
  const findRow = (el) => {
    for (let n = el; n && n !== viewport; n = n.parentElement) {
      if (n.scrollWidth > n.clientWidth + 1) { const o = getComputedStyle(n).overflowX; if (o === 'auto' || o === 'scroll') return n; }
    }
    return null;
  };
  const coastRow = (el, v) => {
    cancelAnimationFrame(rowRaf);
    const x0 = el.scrollLeft, start = performance.now();
    const step = (now) => {
      const t = now - start, e = Math.exp(-t / TAU);
      const want = x0 + v * TAU * (1 - e), maxX = el.scrollWidth - el.clientWidth;
      el.scrollLeft = Math.max(0, Math.min(maxX, want));
      if (Math.abs(v * e) > 0.01 && want > 0 && want < maxX) rowRaf = requestAnimationFrame(step);
    };
    rowRaf = requestAnimationFrame(step);
  };

  // ------------------------------------------------------------- touch
  let dragging = false, axis = null, sx = 0, sy = 0, rawStart = 0, samples = [], swallow = false;
  const onStart = (e) => {
    if (e.touches.length !== 1) return;
    measure();
    swallow = mode === 'coast' && Math.abs(vNow) > 0.08; // a tap that stops a fling does not press what is under it
    stop();
    const p = e.touches[0];
    sx = p.clientX; sy = p.clientY; axis = null; dragging = false;
    row = findRow(e.target); cancelAnimationFrame(rowRaf); rowStart = row ? row.scrollLeft : 0;
    rawStart = bound(y) + unband(over()); // continue from where the band currently is
    samples = [[performance.now(), sy]];
  };
  const onMove = (e) => {
    if (e.touches.length !== 1) return;
    const p = e.touches[0], dx = p.clientX - sx, dy = p.clientY - sy;
    if (axis === 'x') { // sideways drag on a row: follow the finger
      if (row) { row.scrollLeft = rowStart - dx; const now = performance.now(); samples.push([now, p.clientX]); while (samples.length > 2 && now - samples[0][0] > 90) samples.shift(); }
      return;
    }
    if (!axis) {
      if (Math.hypot(dx, dy) < 6) return;
      axis = Math.abs(dx) > Math.abs(dy) && row ? 'x' : 'y';
      if (axis === 'x') { sx = p.clientX; rowStart = row.scrollLeft; samples = [[performance.now(), p.clientX]]; return; }
      dragging = true;
      sy = p.clientY; // start 1:1 from here, no jump
      rawStart = bound(y) + unband(over());
    }
    const raw = rawStart - (p.clientY - sy);
    const b = bound(raw);
    y = b + band(raw - b);
    const now = performance.now();
    samples.push([now, p.clientY]);
    while (samples.length > 2 && now - samples[0][0] > 90) samples.shift();
    render();
  };
  const onEnd = () => {
    if (axis === 'x' && row) {
      swallowClick();
      const now = performance.now();
      if (samples.length > 1) {
        const [ta, xa] = samples[0], [tb, xb] = samples[samples.length - 1];
        if (now - tb < 60 && tb > ta) coastRow(row, Math.max(-8, Math.min(8, -(xb - xa) / (tb - ta))));
      }
      axis = null;
      if (over()) settle(0);
      return;
    }
    if (swallow || dragging) swallowClick();
    if (!dragging) { settle(0); return; }
    dragging = false;
    const now = performance.now();
    let v = 0;
    if (samples.length > 1) {
      const [ta, ya] = samples[0], [tb, yb] = samples[samples.length - 1];
      if (now - tb < 60 && tb > ta) v = -(yb - ya) / (tb - ta); // px/ms in scroll direction
    }
    v = Math.max(-8, Math.min(8, v));
    settle(v);
  };
  const swallowClick = () => {
    const kill = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    viewport.addEventListener('click', kill, { capture: true, once: true });
    setTimeout(() => viewport.removeEventListener('click', kill, { capture: true }), 350);
  };

  // ------------------------------------------------------- wheel / native
  const onWheel = (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    measure();
    const d = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
    const atEnd = (d < 0 && y <= 0) || (d > 0 && y >= max);
    if (atEnd) { if (mode !== 'spring') startSpring(bound(y), 0, Math.sign(d) * 1.2); return; }
    target = bound((mode === 'glide' ? target : y) + d);
    if (mode !== 'glide') { stop(); mode = 'glide'; last = performance.now(); }
    run();
  };
  // the browser may still scroll the viewport itself (focusing an input): fold that in
  const onNative = () => {
    const s = viewport.scrollTop;
    if (!s) return;
    viewport.scrollTop = 0;
    measure(); stop(); y = bound(y + s); render();
  };

  viewport.addEventListener('touchstart', onStart, { passive: true });
  viewport.addEventListener('touchmove', onMove, { passive: true });
  viewport.addEventListener('touchend', onEnd, { passive: true });
  viewport.addEventListener('touchcancel', onEnd, { passive: true });
  viewport.addEventListener('wheel', onWheel, { passive: false });
  viewport.addEventListener('scroll', onNative, { passive: true });
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { measure(); if (!dragging && !mode && (y < 0 || y > max)) settle(0); }) : null;
  ro?.observe(content); ro?.observe(viewport);
  measure();
  render();
  bar.style.opacity = '0';

  const api = {
    get y() { return y; },
    get max() { return max; },
    scrollTo(to, animate = true) {
      measure(); stop();
      target = bound(to);
      if (animate) { mode = 'glide'; last = performance.now(); run(); } else { y = target; render(); }
    },
    refresh: measure,
    destroy() {
      stop(); cancelAnimationFrame(rowRaf); ro?.disconnect(); bar.remove();
      viewport.removeEventListener('touchstart', onStart); viewport.removeEventListener('touchmove', onMove);
      viewport.removeEventListener('touchend', onEnd); viewport.removeEventListener('touchcancel', onEnd);
      viewport.removeEventListener('wheel', onWheel); viewport.removeEventListener('scroll', onNative);
      viewport._ios = null;
    },
  };
  viewport._ios = api;
  return api;
}
