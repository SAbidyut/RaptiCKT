// Mouse drag-to-scroll for every plain scrolling strip and panel (tool bars, tab rows,
// settings, analysis pages, dialogs, and the pages themselves in simple motion mode).
// Hold the left button on empty space and drag, like a finger. The smooth pages and rows
// (scroller.js) do the same for themselves, so they are left alone here.

import { MOUSE_SKIP } from './scroller.js';

const THRESHOLD = 5;
const SMOOTH = '.ios-scroll, .h-row';

function canScroll(el, horizontal) {
  const cs = getComputedStyle(el);
  const ov = horizontal ? cs.overflowX : cs.overflowY;
  if (ov !== 'auto' && ov !== 'scroll') return false;
  return horizontal ? el.scrollWidth > el.clientWidth + 1 : el.scrollHeight > el.clientHeight + 1;
}

function scroller(start, horizontal) {
  for (let el = start; el && el !== document.body; el = el.parentElement) {
    if (el.matches?.(SMOOTH)) return null;
    if (canScroll(el, horizontal)) return el;
  }
  return null;
}

export function installMouseDrag() {
  let st = null, glide = 0;

  const stopGlide = () => { if (glide) cancelAnimationFrame(glide); glide = 0; };

  const onDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest?.(MOUSE_SKIP) || e.target.closest?.(SMOOTH)) return;
    stopGlide();
    st = { id: e.pointerId, x: e.clientX, y: e.clientY, target: e.target, el: null, horizontal: false, left: 0, top: 0, s: [] };
  };

  const onMove = (e) => {
    if (!st || e.pointerId !== st.id) return;
    const dx = e.clientX - st.x, dy = e.clientY - st.y;
    if (!st.el) {
      if (Math.hypot(dx, dy) < THRESHOLD) return;
      const horizontal = Math.abs(dx) > Math.abs(dy);
      const el = scroller(st.target, horizontal);
      if (!el) { st = null; return; } // nothing scrolls that way: leave it to the browser
      st.el = el; st.horizontal = horizontal; st.left = el.scrollLeft; st.top = el.scrollTop;
      st.snap = el.style.scrollSnapType; el.style.scrollSnapType = 'none';
      document.documentElement.classList.add('mouse-drag');
      try { window.getSelection()?.removeAllRanges(); } catch { /* ignore */ }
    }
    const pos = st.horizontal ? st.left - dx : st.top - dy;
    if (st.horizontal) st.el.scrollLeft = pos; else st.el.scrollTop = pos;
    const now = performance.now();
    st.s.push([now, pos]);
    while (st.s.length > 2 && now - st.s[0][0] > 90) st.s.shift();
  };

  const onUp = (e) => {
    if (!st || e.pointerId !== st.id) return;
    const s = st; st = null;
    if (!s.el) return;
    document.documentElement.classList.remove('mouse-drag');
    const kill = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    window.addEventListener('click', kill, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', kill, { capture: true }), 120);
    // let go while moving: coast to a stop
    const now = performance.now(), [t0, p0] = s.s[0] || [now, 0], [t1, p1] = s.s[s.s.length - 1] || [now, 0];
    let v = now - t1 < 60 && t1 > t0 ? (p1 - p0) / (t1 - t0) : 0; // px per ms along the scroll axis
    const el = s.el, key = s.horizontal ? 'scrollLeft' : 'scrollTop';
    let prev = now;
    const step = (t) => {
      const dt = Math.min(48, t - prev); prev = t;
      const before = el[key];
      el[key] = before + v * dt;
      v *= Math.pow(0.998, dt);
      if (Math.abs(v) > 0.02 && el[key] !== before) glide = requestAnimationFrame(step);
      else { glide = 0; el.style.scrollSnapType = s.snap; }
    };
    if (Math.abs(v) > 0.05) glide = requestAnimationFrame(step); else el.style.scrollSnapType = s.snap;
  };

  window.addEventListener('pointerdown', onDown, true);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('dragstart', (e) => { if (st?.el) e.preventDefault(); });
}
