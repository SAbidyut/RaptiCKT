// Browser-only glue (the rapti.net website build). The Android app gets these from the
// native side: the Back button, saving when the app is put away, opening shared files.
// In a browser: Esc and the browser/phone Back gesture step back inside the app instead of
// leaving the page, the circuit is saved when the tab is hidden or closed, and a .rckt / .json
// file dropped on the window is opened.

export function installWebShell(app) {
  if (app.bridge.isAndroid()) return;
  document.documentElement.classList.add('web');

  // Esc = Back (closes a sheet, a panel, the selection, then goes to Home)
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) { document.activeElement.blur(); return; }
    app.back();
  });

  // Browser Back: one guard entry sits on top of the page's history; each Back press is
  // taken by the app until it is at the top of Home, and the press after that leaves.
  try {
    history.replaceState({ rapti: 'base' }, '');
    history.pushState({ rapti: 'guard' }, '');
    window.addEventListener('popstate', () => {
      if (app.back()) history.pushState({ rapti: 'guard' }, '');
      else history.back();
    });
  } catch { /* sandboxed frame without history access */ }

  // save when the tab goes to the background or the page is closed
  const pause = () => { try { window.raptiPause?.(); } catch { /* ignore */ } };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') pause(); });
  window.addEventListener('pagehide', pause);

  // drag & drop a saved circuit or backup onto the page
  window.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    e.preventDefault();
    if (!/\.(rckt|json)$/i.test(f.name)) { alert('Drop a RaptiCKT circuit (.rckt or .json).'); return; }
    f.text().then((text) => app.loadText(f.name, text));
  });
}
