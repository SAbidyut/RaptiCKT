// RaptiCKT application shell.

import { motion } from './ui/motion.js';
import { CATEGORIES } from './elements/index.js';
import { Editor } from './ui/editor.js';
import { HomeScreen, renderSettings } from './ui/screens.js';
import { ManualScreen } from './ui/manual.js';
import { CircuitDoc } from './ui/doc.js';
import { EXAMPLES, buildExample } from './ui/examples.js';
import { store, bridge } from './ui/store.js';
import { Renderer, WireGraph } from './ui/render.js';
import { THEMES } from './ui/theme.js';
import { LOGO_SVG, icon } from './ui/icons.js';
import { APP } from './ui/brand.js';

class App {
  constructor() {
    this.bridge = bridge;
    // Android pads the WebView for system bars natively; don't add CSS safe-area insets on top.
    if (bridge.isAndroid()) document.documentElement.classList.add('android');
    this.settings = store.settings();
    if (this.settings.orientation !== 'auto') bridge.setOrientation(this.settings.orientation);
    // smooth or simple motion, decided before anything is drawn
    motion.init(this.settings.animations, bridge.version());
    motion.probe();
    motion.onChange(() => { if (this.current === 'home') this.home.render(); });
    this.el = document.getElementById('app');
    this.el.innerHTML = `
      <section class="screen home"></section>
      <section class="screen editor"></section>
      <section class="screen settings"></section>
      <section class="screen manual"></section>
      <div class="modal"><div class="modal-card"><div class="modal-head"><b></b><button class="icon-btn" data-close>${icon('x', 20)}</button></div><div class="modal-body"></div></div></div>
      <div class="splash">${LOGO_SVG(120, 'sp')}<h1>Rapti<span>CKT</span></h1><p>${APP.tagline}</p><div class="splash-bar"><i></i></div></div>`;
    this.home = new HomeScreen(this, this.el.querySelector('.screen.home'));
    this.editor = new Editor(this, this.el.querySelector('.screen.editor'));
    this.manual = new ManualScreen(this, this.el.querySelector('.screen.manual'));
    this.thumbCache = new Map();
    this.applyTheme();
    this.el.querySelector('.modal [data-close]').addEventListener('click', () => this.closeSheet());
    this.el.querySelector('.modal').addEventListener('click', (e) => { if (e.target.classList.contains('modal')) this.closeSheet(); });
    window.raptiBack = () => this.back();
    window.raptiOpenText = (name, text) => this.loadText(name, text);
    // called by Android when the app goes to the background: persist immediately
    window.raptiPause = () => {
      const d = this.editor.doc;
      if (this.current === 'editor' && d.elements.length) {
        store.autosave(d.toJSON());
        if (d.id && !d.isExample) this.saveToLibrary(d, true);
      }
    };
    this.show('home');
    this.home.render();
    setTimeout(() => { this.el.querySelector('.splash').classList.add('hide'); document.documentElement.classList.add('app-ready'); }, 1300);
    setTimeout(() => this.el.querySelector('.splash')?.remove(), 2000);
  }

  uid() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  applyTheme() {
    document.documentElement.dataset.theme = this.settings.theme;
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = (THEMES[this.settings.theme] || THEMES.dark).bg;
    if (this.editor) { this.editor.palette.cache.clear(); this.editor.dirtyDraw = true; }
  }
  saveSettings() { store.saveSettings(this.settings); if (this.editor) this.editor.dirtyDraw = true; }

  show(name) {
    this.current = name;
    for (const s of this.el.querySelectorAll('.screen')) s.classList.toggle('active', s.classList.contains(name));
  }

  // ------------------------------------------------------------ navigation
  goHome() {
    const doc = this.editor.doc;
    this.editor.close();
    if (doc.elements.length && !doc.isExample) this.saveToLibrary(doc, true);
    if (doc.elements.length) store.autosave(doc.toJSON());
    this.show('home');
    this.home.render();
  }

  openEditor(doc, opts) {
    if (this.current === 'home') this.home.remember(); // back lands on the same spot in the list
    this.show('editor');
    requestAnimationFrame(() => this.editor.open(doc, opts));
  }

  newCircuit(folder = null, name = 'Untitled circuit') {
    const d = new CircuitDoc(name);
    d.id = this.uid();
    d.folder = folder;
    this.openEditor(d);
  }

  openExample(id) {
    const ex = EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    const d = buildExample(ex);
    d.id = null;
    d.isExample = true;
    this.openEditor(d, { autoRun: this.settings.autoStart });
  }

  openSaved(id) {
    const c = store.getCircuit(id);
    if (!c) return;
    try {
      const d = CircuitDoc.fromJSON(c.data);
      d.id = c.id;
      d.folder = c.folder || null;
      this.openEditor(d);
    } catch (e) { alert('Could not open circuit: ' + e.message); }
  }

  resume() {
    const a = store.loadAutosave();
    if (!a) return;
    const d = CircuitDoc.fromJSON(a);
    const match = store.circuits().find((c) => c.name === d.name && JSON.stringify(c.data.elements) === JSON.stringify(a.elements));
    d.id = match ? match.id : this.uid();
    d.folder = match ? match.folder || null : null;
    this.openEditor(d);
  }

  openSettings() {
    if (this.current === 'home') this.home.remember();
    this.prevScreen = this.current;
    renderSettings(this, this.el.querySelector('.screen.settings'));
    this.show('settings');
  }
  closeSettings() {
    this.show(this.prevScreen || 'home');
    if (this.current === 'home') this.home.render();
    if (this.current === 'editor') { this.editor.onResize(); this.editor.rebuildNow(true); }
  }

  /** Open the user manual (optionally at a chapter). Back returns to wherever it was opened from. */
  openManual(chapter) {
    if (this.current !== 'manual') this.manualFrom = this.current;
    this.manual.open(chapter);
    this.show('manual');
  }
  closeManual() {
    const from = this.manualFrom || 'home';
    this.show(from);
    if (from === 'editor') { this.editor.onResize(); this.editor.dirtyDraw = true; }
  }
  /** "Open this example" inside the manual: keep the circuit being edited, then open the example. */
  openExampleFromManual(id) {
    if (this.current === 'manual' && this.manualFrom === 'editor') {
      const doc = this.editor.doc;
      this.editor.close();
      if (doc.elements.length && !doc.isExample) this.saveToLibrary(doc, true);
      if (doc.elements.length) store.autosave(doc.toJSON());
    }
    this.manualFrom = 'home';
    this.openExample(id);
  }

  back() {
    if (this.el.querySelector('.modal.open')) { this.closeSheet(); return true; }
    if (this.current === 'manual') { if (!this.manual.back()) this.closeManual(); return true; }
    if (this.current === 'settings') { this.closeSettings(); return true; }
    if (this.current === 'editor') { if (!this.editor.back()) this.goHome(); return true; }
    if (this.current === 'home' && this.home.tab === 'library' && this.home.upOne()) return true;
    if (this.current === 'home' && this.home.tab === 'manual' && this.manual.back()) return true; // up one manual page // leave select mode, then folders
    if (this.current === 'home' && this.home.tab !== 'home') { this.home.tab = 'home'; this.home.render(); return true; }
    return false;
  }

  // ---------------------------------------------------------------- data
  thumbnail(doc, w = 360, h = 220) {
    const cv = document.createElement('canvas');
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    cv.width = w; cv.height = h;
    const r = new Renderer(cv);
    r.dpr = 1; r.cw = w; r.ch = h;
    r.fit(doc.bounds(), 30);
    r.scale = Math.min(r.scale, 1.6);
    const b = doc.bounds();
    if (b) { r.ox = w / 2 - ((b[0] + b[2]) / 2) * r.scale; r.oy = h / 2 - ((b[1] + b[3]) / 2) * r.scale; }
    const theme = THEMES[this.settings.theme] || THEMES.dark;
    const settings = { ...this.settings, grid: 'dots', showValues: false };
    r.draw({ doc, sim: null, running: false, theme, settings, selection: new Set(), selWires: new Set(), graph: new WireGraph(doc), t: 0, probes: [] });
    return cv.toDataURL('image/jpeg', 0.78);
  }

  hasExampleThumb(id) { return this.thumbCache.has(id + this.settings.theme); }

  exampleThumb(ex) {
    const k = ex.id + this.settings.theme;
    if (!this.thumbCache.has(k)) this.thumbCache.set(k, this.thumbnail(buildExample(ex), 320, 200));
    return this.thumbCache.get(k);
  }

  saveToLibrary(doc, silent) {
    if (!doc.id) doc.id = this.uid();
    const ok = store.saveCircuit({
      id: doc.id, folder: doc.folder ?? store.getCircuit(doc.id)?.folder ?? null, name: doc.name, updated: Date.now(), count: doc.elements.length,
      thumb: this.thumbnail(doc), data: doc.toJSON(),
    });
    if (!ok && !silent) alert('Storage is full – export some circuits and delete old ones.');
    return ok;
  }

  backupAll() {
    const list = store.circuits();
    // folders and where each circuit sits are saved too (older backups simply have no `folders`)
    const data = { app: 'RaptiCKT', backup: true, version: APP.version, date: new Date().toISOString(), circuits: list.map((c) => c.data), folders: store.folders(), placement: list.map((c) => c.folder || null) };
    this.bridge.saveFile(`RaptiCKT_backup_${new Date().toISOString().slice(0, 10)}.json`, 'application/json', JSON.stringify(data));
  }

  async importFile() {
    try {
      const { name, text } = await this.bridge.openFile();
      this.loadText(name, text);
    } catch (e) { if (e && e.message !== 'No file' && e.message !== 'cancelled') alert('Could not open file: ' + e.message); }
  }

  loadText(name, text) {
    let o;
    try { o = JSON.parse(text); } catch { alert('This file is not a RaptiCKT circuit.'); return; }
    if (o.backup && Array.isArray(o.circuits)) {
      let n = 0;
      // recreate the folders first (new ids, so a restore never overwrites what is already there)
      const map = new Map();
      const olds = Array.isArray(o.folders) ? o.folders : [];
      for (const f of olds) map.set(f.id, this.uid());
      for (const f of olds) store.addFolder(map.get(f.id), String(f.name || 'Folder'), map.get(f.parent) || null);
      for (const [i, c] of o.circuits.entries()) {
        try { const d = CircuitDoc.fromJSON(c); d.id = this.uid(); d.folder = (o.placement && map.get(o.placement[i])) || null; this.saveToLibrary(d, true); n++; } catch { /* skip */ }
      }
      alert(`Restored ${n} circuit${n === 1 ? '' : 's'}.`);
      if (this.current === 'home') this.home.render();
      return;
    }
    if (!o.elements) { alert('This file is not a RaptiCKT circuit.'); return; }
    const d = CircuitDoc.fromJSON(o);
    if (!o.name && name) d.name = name.replace(/\.(rckt|json)$/i, '');
    d.id = this.uid();
    d.folder = this.current === 'home' && this.home.tab === 'library' ? this.home.folder : null; // imported into the folder being viewed
    this.saveToLibrary(d, true);
    if (this.current === 'editor') this.editor.close();
    this.openEditor(d);
  }

  // ------------------------------------------------------------ modal sheet
  showSheet(title, html, bind) {
    const m = this.el.querySelector('.modal');
    m.querySelector('.modal-head b').innerHTML = title;
    const body = m.querySelector('.modal-body');
    body.innerHTML = html;
    m.classList.add('open');
    if (bind) bind(body, () => this.closeSheet());
  }
  closeSheet() { this.el.querySelector('.modal').classList.remove('open'); }
}

window.addEventListener('DOMContentLoaded', () => { window.app = new App(); window.app.categories = CATEGORIES; });
