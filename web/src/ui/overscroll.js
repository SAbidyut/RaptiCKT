// Elastic scroll edges: the content stretches when it is pulled past the top or
// bottom and springs back on release, and a fling that runs into the end bounces
// a little, so it is obvious the list has ended. Transform-only, so it stays on
// the compositor. (Android's own edge glow is turned off in the WebView.)

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * scroller: the element that scrolls; target: what moves (the scroller's content,
 * or the scroller itself when its content is not wrapped).
 */
export function elastic(scroller, target = scroller) {
  if (!scroller || scroller.dataset.elastic || reduced() || !target.animate) return;
  scroller.dataset.elastic = '1';
  const max = () => scroller.scrollHeight - scroller.clientHeight;
  let off = 0, startEdge = null, touching = false;
  const set = (v) => { off = v; target.style.transform = v ? `translate3d(0, ${v.toFixed(1)}px, 0)` : ''; };
  // rubber band: follows the finger at first, then stiffens towards a limit
  const rubber = (d) => {
    const lim = Math.min(120, scroller.clientHeight * 0.16);
    return Math.sign(d) * lim * (1 - 1 / ((Math.abs(d) * 0.55) / lim + 1));
  };
  const springBack = () => {
    if (!off) return;
    const from = off;
    set(0);
    target.animate([{ transform: `translate3d(0, ${from}px, 0)` }, { transform: 'translate3d(0, 0, 0)' }],
      { duration: 520, easing: 'cubic-bezier(.18, 1.3, .35, 1)' });
  };

  scroller.addEventListener('touchstart', (e) => { touching = e.touches.length === 1; startEdge = null; }, { passive: true });
  scroller.addEventListener('touchmove', (e) => {
    if (!touching) return;
    const y = e.touches[0].clientY;
    const atTop = scroller.scrollTop <= 0, atEnd = scroller.scrollTop >= max() - 1;
    if (startEdge === null && (atTop || atEnd)) startEdge = y; // measure the pull from where the edge was reached
    if (startEdge !== null) {
      const d = y - startEdge;
      if ((atTop && d > 0) || (atEnd && d < 0)) {
        if (e.cancelable) e.preventDefault();
        set(rubber(d));
        return;
      }
      if (!atTop && !atEnd) startEdge = null;
    }
    if (off) set(0);
  }, { passive: false });
  const end = () => { touching = false; startEdge = null; springBack(); };
  scroller.addEventListener('touchend', end, { passive: true });
  scroller.addEventListener('touchcancel', end, { passive: true });

  // momentum that runs into either end: a short overshoot in the direction of travel
  let lastTop = scroller.scrollTop, lastT = performance.now(), v = 0, bouncedAt = 0;
  scroller.addEventListener('scroll', () => {
    const t = performance.now(), top = scroller.scrollTop, m = max();
    v = 0.6 * ((top - lastTop) / Math.max(1, t - lastT)) + 0.4 * v; // px per ms
    const hitTop = top <= 0 && lastTop > 0, hitEnd = m > 0 && top >= m - 1 && lastTop < m - 1;
    if (!touching && !off && (hitTop || hitEnd) && Math.abs(v) > 0.5 && t - bouncedAt > 400) {
      bouncedAt = t;
      const amp = -Math.sign(v) * Math.min(42, 10 + Math.abs(v) * 10);
      target.animate([{ transform: 'translate3d(0, 0, 0)' }, { transform: `translate3d(0, ${amp}px, 0)`, offset: 0.32 }, { transform: 'translate3d(0, 0, 0)' }],
        { duration: 560, easing: 'cubic-bezier(.25, .8, .3, 1)' });
    }
    lastTop = top; lastT = t;
  }, { passive: true });

  // mouse wheel against an end (desktop / emulator): the same small bounce
  scroller.addEventListener('wheel', (e) => {
    const t = performance.now(), m = max();
    if (t - bouncedAt < 500 || off) return;
    if ((e.deltaY < 0 && scroller.scrollTop <= 0) || (e.deltaY > 0 && scroller.scrollTop >= m - 1)) {
      bouncedAt = t;
      const amp = -Math.sign(e.deltaY) * 22;
      target.animate([{ transform: 'translate3d(0, 0, 0)' }, { transform: `translate3d(0, ${amp}px, 0)`, offset: 0.35 }, { transform: 'translate3d(0, 0, 0)' }],
        { duration: 480, easing: 'cubic-bezier(.25, .8, .3, 1)' });
    }
  }, { passive: true });
}
