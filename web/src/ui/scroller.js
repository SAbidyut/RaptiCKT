// iOS-style scrolling for the app's pages and their sideways rows.
//
// The content follows the finger 1:1, keeps moving after release with the same
// exponential deceleration UIScrollView uses (rate 0.998 per ms), and past
// either end it moves against a rubber band that stiffens the further it is
// pulled. A fling that runs into an end carries on into the band and springs
// back in one continuous motion (a critically damped spring, so it never
// wobbles). Sideways rows of cards snap to a card like the App Store.
//
// Everything is a transform on a composited layer, driven by requestAnimationFrame
// only while something moves. On phones in "simple" motion mode (see motion.js)
// the platform's own scrolling is used instead.

import { motion } from './motion.js';

const DECEL = 0.998; // per millisecond, UIScrollView "normal"
const TAU = -1 / Math.log(DECEL); // ≈ 500 ms time constant of the coast
const RUBBER = 0.55; // UIScrollView's rubber-band constant
const OMEGA = 0.0145; // spring stiffness (rad/ms): bounce-back in ~0.35 s
const MAX_EDGE_V = 3.2; // px/ms carried into the band by a fling (caps the overshoot)

/**
 * Physics of one scroll axis. The owner supplies the extent (dim), the end of
 * the range (max) and apply(pos) to put the content on screen.
 */
class Axis {
  constructor({ dim, max, apply, snaps }) {
    this.dim = dim; this.maxFn = max; this.apply = apply; this.snaps = snaps;
    this.pos = 0; this.max = 0; this.mode = null; this.raf = 0; this.v = 0;
    this.frame = this.frame.bind(this);
  }
  measure() { this.max = Math.max(0, this.maxFn()); }
  bound(p) { return p < 0 ? 0 : p > this.max ? this.max : p; }
  over() { return this.pos - this.bound(this.pos); }
  band(x) { const d = this.dim() || 1; return Math.sign(x) * (1 - 1 / ((Math.abs(x) * RUBBER) / d + 1)) * d; }
  unband(x) { const d = this.dim() || 1, r = Math.min(Math.abs(x) / d, 0.999); return Math.sign(x) * (d / RUBBER) * (1 / (1 - r) - 1); }
  get moving() { return !!this.mode; }

  stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; if (this.mode) motion.flush(); this.mode = null; }
  run() { if (!this.raf) { this.prev = 0; this.raf = requestAnimationFrame(this.frame); } }

  // finger
  grab() { const fast = this.mode === 'coast' && Math.abs(this.v) > 0.08; this.stop(); this.measure(); this.raw0 = this.bound(this.pos) + this.unband(this.over()); return fast; }
  drag(delta) { const raw = this.raw0 - delta, b = this.bound(raw); this.pos = b + this.band(raw - b); this.apply(this.pos); }
  release(v) {
    const o = this.over();
    if (o) { this.spring(this.bound(this.pos), o, v); return; }
    const pts = this.snaps?.();
    if (pts && pts.length) { // aim the coast so it comes to rest exactly on the nearest snap point
      const proj = this.bound(this.pos + v * TAU);
      let best = pts[0];
      for (const p of pts) if (Math.abs(p - proj) < Math.abs(best - proj)) best = p;
      this.coastTo(this.bound(best), v);
    } else if (Math.abs(v) > 0.05) this.coast(v);
  }
  settle() { if (this.over()) this.spring(this.bound(this.pos), this.over(), 0); }

  coast(v, tau = TAU) { this.mode = 'coast'; this.tau = tau; this.a0 = this.pos; this.v0 = v; this.t0 = performance.now(); this.run(); }
  /**
   * Decelerate onto an exact target. The time constant is matched to the release
   * speed (so the motion carries on at the finger's speed) but kept short enough
   * that it lands in well under a second.
   */
  coastTo(target, vRelease = 0) {
    const d = target - this.pos;
    if (Math.abs(d) < 0.5) { this.pos = target; this.apply(this.pos); return; }
    const tau = Math.max(90, Math.min(190, Math.abs(vRelease) > 0.05 ? Math.abs(d / vRelease) : 150));
    this.target = target;
    this.coast(d / tau, tau);
    this.mode = 'coastTo';
  }
  spring(anchor, x, v, now = performance.now()) { this.mode = 'spring'; this.anchor = anchor; this.a0 = x; this.v0 = v; this.t0 = now; this.run(); }
  glideTo(target) { this.target = this.bound(target); if (this.mode !== 'glide') { this.stop(); this.mode = 'glide'; } this.run(); }

  frame(now) {
    this.raf = 0;
    if (this.prev) motion.frame(now - this.prev); // watchdog: real frame times while moving
    const dt = this.prev ? now - this.prev : 16;
    this.prev = now;
    const t = now - this.t0;
    if (this.mode === 'coast' || this.mode === 'coastTo') {
      const tau = this.tau || TAU, e = Math.exp(-t / tau);
      this.pos = this.a0 + this.v0 * tau * (1 - e);
      this.v = this.v0 * e;
      if (this.mode === 'coastTo' && Math.abs(this.target - this.pos) < 0.5) { this.pos = this.target; this.stop(); this.apply(this.pos); return; }
      if (this.pos < 0 || this.pos > this.max) { // ran into an end: carry on into the band and spring back
        const b = this.pos < 0 ? 0 : this.max, v = Math.sign(this.v) * Math.min(Math.abs(this.v), MAX_EDGE_V);
        this.spring(b, this.pos - b, v, now);
      } else if (this.mode === 'coast' && Math.abs(this.v) < 0.01) { this.stop(); this.apply(this.pos); return; }
    } else if (this.mode === 'spring') {
      const e = Math.exp(-OMEGA * t), B = this.v0 + OMEGA * this.a0;
      const x = (this.a0 + B * t) * e;
      this.v = (B - OMEGA * (this.a0 + B * t)) * e;
      this.pos = this.anchor + x;
      if (Math.abs(x) < 0.25 && Math.abs(this.v) < 0.01) { this.pos = this.anchor; this.stop(); this.apply(this.pos); return; }
    } else if (this.mode === 'glide') { // wheel / programmatic: ease towards the target
      this.pos += (this.target - this.pos) * (1 - Math.exp(-dt / 90));
      if (Math.abs(this.target - this.pos) < 0.3) { this.pos = this.target; this.stop(); this.apply(this.pos); return; }
    } else return;
    this.apply(this.pos);
    this.raf = requestAnimationFrame(this.frame);
  }
}

// ------------------------------------------------------- sideways rows
// A row (".card-row", ".chips") gets an inner track that is moved with a
// transform; card rows snap to a card.
const ROW_SEL = '.card-row, .chips';

function rowAxis(row) {
  if (row._axis) return row._axis;
  let track = row.firstElementChild;
  if (!track || !track.classList.contains('h-track')) {
    track = document.createElement('div');
    track.className = 'h-track';
    track.append(...row.childNodes);
    row.append(track);
  }
  row.classList.add('h-row');
  const cs = () => getComputedStyle(row);
  const axis = new Axis({
    dim: () => row.clientWidth,
    max: () => { const s = cs(); return track.scrollWidth + (parseFloat(s.paddingLeft) || 0) + (parseFloat(s.paddingRight) || 0) - row.clientWidth; },
    apply: (x) => { track.style.transform = `translate3d(${(-x).toFixed(2)}px, 0, 0)`; },
    snaps: row.classList.contains('card-row') ? () => { const cs2 = [...track.children], x0 = cs2[0]?.offsetLeft || 0; return cs2.map((c) => c.offsetLeft - x0); } : null,
  });
  axis.measure();
  row._axis = axis;
  return axis;
}

/**
 * viewport: the clipping element; content: the element that moves (a child of
 * viewport). opts.onScroll(y) is called on every change of the scroll offset.
 * Returns { y, max, scrollTo(y, animate), refresh(), destroy() }.
 */
export function iosScroll(viewport, content, opts = {}) {
  if (!viewport || !content) return null;
  if (viewport._ios) viewport._ios.destroy();
  return motion.smooth ? smoothScroll(viewport, content, opts) : nativeScroll(viewport, content, opts);
}

/** Simple mode: the platform's own scrolling, same API. */
function nativeScroll(viewport, content, opts) {
  viewport.classList.add('native-scroll');
  const onScroll = () => opts.onScroll?.(viewport.scrollTop);
  viewport.addEventListener('scroll', onScroll, { passive: true });
  const api = {
    get y() { return viewport.scrollTop; },
    get max() { return viewport.scrollHeight - viewport.clientHeight; },
    scrollTo(to) { viewport.scrollTop = to; },
    refresh() {},
    destroy() { viewport.removeEventListener('scroll', onScroll); viewport.classList.remove('native-scroll'); viewport._ios = null; },
  };
  viewport._ios = api;
  return api;
}

function smoothScroll(viewport, content, opts) {
  viewport.classList.add('ios-scroll');
  content.classList.add('ios-content');

  const bar = document.createElement('div');
  bar.className = 'ios-bar';
  viewport.appendChild(bar);
  let barTimer = 0, dragging = false;

  const page = new Axis({
    dim: () => viewport.clientHeight,
    max: () => { const pad = parseFloat(getComputedStyle(viewport).paddingBottom) || 0; return content.offsetTop + content.offsetHeight + pad - viewport.clientHeight; },
    apply: (y) => render(y),
  });

  const showBar = (y) => {
    const h = viewport.clientHeight || 1, max = page.max;
    if (max < 4) { bar.style.opacity = '0'; return; }
    let len = Math.max(36, (h * h) / (max + h)), pos = (y / max) * (h - len);
    const o = page.over();
    if (o) { len = Math.max(12, len - Math.abs(o)); pos = o < 0 ? 0 : h - len; } // squeezes at the ends like iOS
    bar.style.height = `${len - 6}px`;
    bar.style.transform = `translate3d(0, ${pos + 3}px, 0)`;
    bar.style.opacity = '1';
    clearTimeout(barTimer);
    barTimer = setTimeout(() => { if (!page.moving && !dragging) bar.style.opacity = '0'; }, 650);
  };
  function render(y) {
    content.style.transform = `translate3d(0, ${(-y).toFixed(2)}px, 0)`;
    showBar(y);
    opts.onScroll?.(y);
  }

  // ------------------------------------------------------------- touch
  let axis = null, row = null, rowAx = null, sx = 0, sy = 0, samples = [], swallow = false;
  const findRow = (el) => { const r = el && el.closest ? el.closest(ROW_SEL) : null; return r && viewport.contains(r) ? r : null; };
  const track = (v) => { const now = performance.now(); samples.push([now, v]); while (samples.length > 2 && now - samples[0][0] > 90) samples.shift(); };
  const velocity = () => {
    const now = performance.now();
    if (samples.length < 2) return 0;
    const [ta, a] = samples[0], [tb, b] = samples[samples.length - 1];
    if (now - tb > 60 || tb <= ta) return 0; // the finger had stopped before lifting
    return Math.max(-8, Math.min(8, -(b - a) / (tb - ta)));
  };

  const onStart = (e) => {
    if (e.touches.length !== 1) return;
    const p = e.touches[0];
    sx = p.clientX; sy = p.clientY; axis = null; dragging = false;
    row = findRow(e.target);
    rowAx = row ? rowAxis(row) : null;
    swallow = page.grab();
    if (rowAx && rowAx.grab()) swallow = true; // a tap that stops a fling does not press what is under it
  };
  const onMove = (e) => {
    if (e.touches.length !== 1) return;
    const p = e.touches[0], dx = p.clientX - sx, dy = p.clientY - sy;
    if (!axis) {
      if (Math.hypot(dx, dy) < 6) return;
      axis = Math.abs(dx) > Math.abs(dy) && rowAx ? 'x' : 'y';
      // start 1:1 from here, no jump
      sx = p.clientX; sy = p.clientY;
      if (axis === 'x') { rowAx.grab(); samples = [[performance.now(), sx]]; } else { dragging = true; page.grab(); samples = [[performance.now(), sy]]; }
      return;
    }
    if (axis === 'x') { rowAx.drag(p.clientX - sx); track(p.clientX); } else { page.drag(p.clientY - sy); track(p.clientY); }
  };
  const onEnd = () => {
    if (axis || swallow) swallowClick();
    if (axis === 'x') { rowAx.release(velocity()); page.settle(); } else if (axis === 'y') { dragging = false; page.release(velocity()); } else { page.settle(); rowAx?.settle(); }
    axis = null;
  };
  const swallowClick = () => {
    const kill = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    viewport.addEventListener('click', kill, { capture: true, once: true });
    setTimeout(() => viewport.removeEventListener('click', kill, { capture: true }), 350);
  };

  // ------------------------------------------------------- wheel / native
  const onWheel = (e) => {
    const r = findRow(e.target);
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      if (!r) return;
      e.preventDefault();
      const ax = rowAxis(r); ax.measure();
      ax.glideTo((ax.mode === 'glide' ? ax.target : ax.pos) + e.deltaX);
      return;
    }
    e.preventDefault();
    page.measure();
    const d = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
    if ((d < 0 && page.pos <= 0) || (d > 0 && page.pos >= page.max)) { if (page.mode !== 'spring') page.spring(page.bound(page.pos), 0, Math.sign(d) * 1.2); return; }
    page.glideTo((page.mode === 'glide' ? page.target : page.pos) + d);
  };
  // the browser may still scroll the viewport itself (focusing an input): fold that in
  const onNative = () => {
    const s = viewport.scrollTop;
    if (!s) return;
    viewport.scrollTop = 0;
    page.measure(); page.stop(); page.pos = page.bound(page.pos + s); render(page.pos);
  };

  viewport.addEventListener('touchstart', onStart, { passive: true });
  viewport.addEventListener('touchmove', onMove, { passive: true });
  viewport.addEventListener('touchend', onEnd, { passive: true });
  viewport.addEventListener('touchcancel', onEnd, { passive: true });
  viewport.addEventListener('wheel', onWheel, { passive: false });
  viewport.addEventListener('scroll', onNative, { passive: true });
  // rows are given their track up front so the layout never changes under a finger
  const prepRows = () => content.querySelectorAll(ROW_SEL).forEach((r) => rowAxis(r));
  const mo = typeof MutationObserver === 'function' ? new MutationObserver(prepRows) : null;
  mo?.observe(content, { childList: true, subtree: true });
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { page.measure(); if (!dragging && !page.moving && page.over()) page.settle(); }) : null;
  ro?.observe(content); ro?.observe(viewport);
  prepRows();
  page.measure();
  render(0);
  bar.style.opacity = '0';

  const api = {
    get y() { return page.pos; },
    get max() { return page.max; },
    scrollTo(to, animate = true) { page.measure(); if (animate) page.glideTo(to); else { page.stop(); page.pos = page.bound(to); render(page.pos); } },
    refresh: () => page.measure(),
    destroy() {
      page.stop(); ro?.disconnect(); mo?.disconnect(); bar.remove();
      viewport.removeEventListener('touchstart', onStart); viewport.removeEventListener('touchmove', onMove);
      viewport.removeEventListener('touchend', onEnd); viewport.removeEventListener('touchcancel', onEnd);
      viewport.removeEventListener('wheel', onWheel); viewport.removeEventListener('scroll', onNative);
      viewport.classList.remove('ios-scroll'); content.classList.remove('ios-content');
      content.style.transform = '';
      viewport._ios = null;
    },
  };
  viewport._ios = api;
  return api;
}
