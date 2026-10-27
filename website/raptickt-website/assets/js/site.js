// RaptiCKT website scripts: mobile menu, mouse drag-to-scroll, search filters, reveal animation.
(function () {
  'use strict';

  // ---- mobile menu
  var burger = document.querySelector('[data-burger]'), nav = document.querySelector('[data-nav]');
  if (burger && nav) burger.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // ---- drag-to-scroll with the mouse (screenshots strip, category chips) with a little momentum
  document.querySelectorAll('.drag-scroll').forEach(function (el) {
    var down = false, moved = false, sx = 0, sl = 0, last = 0, lastT = 0, v = 0, raf = 0;
    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      cancelAnimationFrame(raf);
      down = true; moved = false; sx = e.clientX; sl = el.scrollLeft; last = e.clientX; lastT = performance.now(); v = 0;
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - sx;
      if (!moved && Math.abs(dx) < 5) return;
      if (!moved) { moved = true; el.classList.add('dragging'); }
      el.scrollLeft = sl - dx;
      var now = performance.now(), dt = now - lastT;
      if (dt > 0) v = 0.8 * v + 0.2 * ((last - e.clientX) / dt);
      last = e.clientX; lastT = now;
    });
    window.addEventListener('pointerup', function () {
      if (!down) return;
      down = false; el.classList.remove('dragging');
      if (!moved) return;
      if (performance.now() - lastT > 80) v = 0;
      (function glide() {
        el.scrollLeft += v * 16; v *= 0.94;
        if (Math.abs(v) > 0.03) raf = requestAnimationFrame(glide);
      })();
    });
    el.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    el.addEventListener('dragstart', function (e) { e.preventDefault(); });
  });

  // ---- live filter: components table / examples grid
  var q = document.getElementById('q'), chips = document.getElementById('catchips'), count = document.getElementById('count'), none = document.getElementById('none');
  var lib = document.getElementById('lib'), grid = document.getElementById('exgrid');
  if (q && (lib || grid)) {
    var cat = '';
    var apply = function () {
      var needle = q.value.trim().toLowerCase(), shown = 0, total = 0;
      if (grid) {
        grid.querySelectorAll('.ex').forEach(function (a) {
          total++;
          var ok = (!cat || a.dataset.cat === cat) && (!needle || a.dataset.text.indexOf(needle) !== -1);
          a.hidden = !ok; if (ok) shown++;
        });
      } else {
        lib.querySelectorAll('section.cat').forEach(function (s) {
          var rows = s.querySelectorAll('tbody tr'), any = false;
          rows.forEach(function (r) {
            total++;
            var ok = !needle || r.textContent.toLowerCase().indexOf(needle) !== -1;
            r.hidden = !ok; if (ok) { any = true; shown++; }
          });
          s.hidden = (cat && s.dataset.cat !== cat) || (!any && rows.length > 0);
        });
      }
      if (count) count.textContent = shown + ' / ' + total;
      if (none) none.hidden = shown !== 0;
    };
    q.addEventListener('input', apply);
    if (chips) chips.addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      chips.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('on', c === b); });
      cat = b.dataset.cat || ''; apply();
    });
    apply();
  }

  // ---- manual: filter the chapter list
  var tq = document.getElementById('tocq'), toc = document.getElementById('toc');
  if (tq && toc) tq.addEventListener('input', function () {
    var n = tq.value.trim().toLowerCase();
    toc.querySelectorAll('a').forEach(function (a) { a.hidden = n && a.textContent.toLowerCase().indexOf(n) === -1; });
  });

  // ---- reveal on scroll
  var items = document.querySelectorAll('.card, .stats div, .strip figure');
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (el) { el.classList.add('reveal'); io.observe(el); });
  }
})();
