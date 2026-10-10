// Desktop extras for the browser build on a wide screen (the "desk" layout, see
// Editor.updateLayout): a draggable edge on the oscilloscope panel, tooltips with
// keyboard shortcuts, a right-click menu on parts and a list of the shortcuts (?).
// The Android app never gets these.

import { icon } from './icons.js';
import { store } from './store.js';

const TIPS = {
  home: 'Back to Home · Esc', rename: 'Rename', values: 'Labels', meter: 'Multimeter', scope: 'Oscilloscope',
  analysis: 'Analysis', more: 'More', run: 'Run / Pause · Space', restart: 'Restart', step: 'Step',
  multi: 'Select several', undo: 'Undo · Ctrl+Z', redo: 'Redo · Ctrl+Y', fit: 'Fit to screen · F',
  fullscreen: 'Full screen', add: 'Add component · A', 'mode-operate': 'Operate · O', 'mode-wire': 'Wire · W',
};

const KEYS = [
  ['Space', 'Run / Pause'], ['A', 'Add component'], ['W', 'Wire mode'], ['O', 'Operate mode'],
  ['R', 'Rotate the selection'], ['Ctrl + D', 'Duplicate'], ['Delete', 'Delete the selection'],
  ['Ctrl + Z / Ctrl + Y', 'Undo / Redo'], ['F', 'Fit the circuit to the screen'], ['Mouse wheel', 'Zoom'],
  ['Drag empty space', 'Pan'], ['Right-click a part', 'Rotate, duplicate, delete, properties'],
  ['Esc', 'Close / back'], ['?', 'This list'],
];

export function installDesktop(ed) {
  if (ed.app.bridge.isAndroid()) return;
  const root = ed.root;
  const isDesk = () => root.classList.contains('desk');

  // ---- tooltips (harmless on touch screens: they never show)
  for (const b of root.querySelectorAll('.ed-head [data-a], .fs-rail [data-a], .mode-seg [data-a], .fab')) {
    const t = TIPS[b.dataset.a];
    if (t) b.title = t;
  }

  // ---- oscilloscope width: drag its edge
  const grip = root.querySelector('.scope-grip');
  const w0 = store.settings().scopeWidth;
  if (w0) root.style.setProperty('--scope-w', `${w0}px`);
  grip.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    root.classList.add('scope-sizing');
    const main = root.querySelector('.ed-main').getBoundingClientRect();
    const move = (ev) => {
      const w = Math.round(Math.max(340, Math.min(main.width - 380, ev.clientX - main.left)));
      root.style.setProperty('--scope-w', `${w}px`);
      ed.onResize(); ed.scope.draw();
    };
    const up = () => {
      grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up);
      root.classList.remove('scope-sizing');
      const w = parseInt(root.style.getPropertyValue('--scope-w'), 10);
      if (w) { ed.app.settings.scopeWidth = w; ed.app.saveSettings(); }
    };
    grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
  });
  grip.addEventListener('dblclick', () => { root.style.removeProperty('--scope-w'); delete ed.app.settings.scopeWidth; ed.app.saveSettings(); ed.onResize(); ed.scope.draw(); });

  // ---- a side panel opening beside the board: keep the whole circuit in view
  let wasPanel = false;
  new MutationObserver(() => {
    const panel = isDesk() && (root.classList.contains('pal-open') || root.classList.contains('sheet-open'));
    if (panel === wasPanel) return;
    wasPanel = panel;
    setTimeout(() => {
      const b = ed.doc?.bounds(), R = ed.renderer, cv = ed.canvas.getBoundingClientRect();
      if (!b || !ed.active) return;
      const [x0, y0] = R.toScreen(b[0], b[1]), [x1, y1] = R.toScreen(b[2], b[3]);
      if (x0 < 0 || y0 < 0 || x1 > cv.width || y1 > cv.height) ed.fit();
    }, 360);
  }).observe(root, { attributes: true, attributeFilter: ['class'] });

  // ---- right-click menu on a part
  const menu = document.createElement('div');
  menu.className = 'menu ctx-menu';
  root.appendChild(menu);
  const closeMenu = () => { menu.classList.remove('open'); document.removeEventListener('pointerdown', outside, true); };
  const outside = (ev) => { if (!menu.contains(ev.target)) closeMenu(); };
  ed.canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const r = ed.canvas.getBoundingClientRect();
    const hit = ed.hitTest(e.clientX - r.left, e.clientY - r.top);
    if (!hit || hit.kind !== 'element') { closeMenu(); return; }
    if (!ed.selection.has(hit.el)) ed.select(hit.el);
    const items = [['rotate', 'rotate', 'Rotate', 'R'], ['copy', 'dup', 'Duplicate', 'Ctrl+D'], ['sliders', 'props', 'Properties', ''], ['trash', 'del', 'Delete', 'Del']];
    menu.innerHTML = items.map(([ic, a, t, k]) => `<button data-c="${a}" class="${a === 'del' ? 'danger' : ''}">${icon(ic, 18)}<span>${t}</span><kbd>${k}</kbd></button>`).join('');
    menu.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      closeMenu();
      const a = b.dataset.c;
      if (a === 'rotate') ed.rotateSelection();
      else if (a === 'dup') ed.duplicateSelection();
      else if (a === 'del') ed.deleteSelection();
      else if (a === 'props') ed.inspector.openSheet();
    }));
    const box = root.getBoundingClientRect();
    menu.style.left = `${Math.min(e.clientX - box.left, box.width - 240)}px`;
    menu.style.top = `${Math.min(e.clientY - box.top, box.height - 230)}px`;
    menu.style.right = 'auto';
    menu.classList.add('open');
    setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
  });
  ed.canvas.addEventListener('wheel', closeMenu, { passive: true });

  // ---- keys the touch app has no use for
  window.addEventListener('keydown', (e) => {
    if (!ed.active || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
    if (e.key === 'Escape' && menu.classList.contains('open')) { closeMenu(); e.preventDefault(); return; }
    if (e.key === 'f' || e.key === 'F') ed.fit();
    else if (e.key === 'a' || e.key === 'A') { if (!ed.palette.isOpen) ed.palette.open(); }
    else if (e.key === '?') showKeys(ed);
  });

  return { isDesk };
}

function showKeys(ed) {
  ed.app.showSheet('Keyboard & mouse', `<table class="tbl keys-tbl">${KEYS.map(([k, t]) => `<tr><td><kbd>${k}</kbd></td><td>${t}</td></tr>`).join('')}</table>`);
}
