// Persistent storage (localStorage) for settings and saved circuits, plus the
// native Android bridge with browser fallbacks.

const K = { settings: 'raptickt.settings.v1', circuits: 'raptickt.circuits.v1', recent: 'raptickt.recent.v1', autosave: 'raptickt.autosave.v1', flags: 'raptickt.flags.v1' };

export const DEFAULT_SETTINGS = {
  theme: 'dark',
  grid: 'lines',
  currentDots: true,
  dotSpeed: 1,
  voltColors: true,
  showValues: true,
  showNames: false,
  liveVolts: true,
  liveAmps: true,
  acReadings: 'rms',
  showCharge: true,
  haptics: true,
  sound: true,
  method: 'trap',
  initialDC: true,
  autoStep: true,
  maxStep: 1e-4,
  reltol: 1e-3,
  vntol: 1e-6,
  abstol: 1e-9,
  gmin: 1e-12,
  maxIter: 60,
  autoStart: true,
  animations: 'auto',
};

function read(k, def) {
  try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : def; } catch { return def; }
}
function write(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; }
}

export const store = {
  settings() { return { ...DEFAULT_SETTINGS, ...read(K.settings, {}) }; },
  saveSettings(s) { write(K.settings, s); },
  circuits() { return read(K.circuits, []); },
  saveCircuit(entry) {
    const list = this.circuits().filter((c) => c.id !== entry.id);
    list.unshift(entry);
    return write(K.circuits, list.slice(0, 200));
  },
  deleteCircuit(id) { write(K.circuits, this.circuits().filter((c) => c.id !== id)); },
  getCircuit(id) { return this.circuits().find((c) => c.id === id); },
  recent() { return read(K.recent, ['resistor', 'capacitor', 'dcv', 'ground', 'led', 'npn', 'switch', 'opamp']); },
  pushRecent(type) {
    const r = [type, ...this.recent().filter((t) => t !== type)].slice(0, 12);
    write(K.recent, r);
  },
  autosave(doc) { write(K.autosave, doc); },
  loadAutosave() { return read(K.autosave, null); },
  flag(name) { return !!read(K.flags, {})[name]; },
  setFlag(name, v = true) { const f = read(K.flags, {}); f[name] = v; write(K.flags, f); },
};

// ----------------------------------------------------------- native bridge
const A = () => (typeof window !== 'undefined' ? window.RaptiAndroid : undefined);

export const bridge = {
  isAndroid: () => !!A(),
  version() { try { return A() ? A().appVersion() : 'web'; } catch { return 'web'; } },
  vibrate(ms = 12) {
    try { if (A()) A().vibrate(ms); else if (navigator.vibrate) navigator.vibrate(ms); } catch { /* ignore */ }
  },
  openUrl(url) {
    try { if (A()) { A().openUrl(url); return; } } catch { /* fallthrough */ }
    window.open(url, '_blank', 'noopener');
  },
  share(title, text) {
    try { if (A()) { A().shareText(title, text); return true; } } catch { /* fallthrough */ }
    if (navigator.share) { navigator.share({ title, text }).catch(() => {}); return true; }
    navigator.clipboard?.writeText(text);
    return false;
  },
  /** Save a file. data: string, or data URL when isDataUrl. */
  saveFile(name, mime, data, isDataUrl = false) {
    try {
      if (A()) {
        const b64 = isDataUrl ? data.split(',')[1] : btoa(unescape(encodeURIComponent(data)));
        A().saveFile(name, mime, b64);
        return;
      }
    } catch { /* fallthrough */ }
    const a = document.createElement('a');
    a.download = name;
    a.href = isDataUrl ? data : URL.createObjectURL(new Blob([data], { type: mime }));
    document.body.appendChild(a); a.click(); a.remove();
  },
  /** Pick a text file. Resolves {name, text}. */
  openFile(accept = '.json,.rckt,application/json,text/plain') {
    return new Promise((resolve, reject) => {
      if (A()) {
        window.__raptiFileOpened = (name, b64) => {
          try { resolve({ name, text: decodeURIComponent(escape(atob(b64))) }); } catch (e) { reject(e); }
        };
        window.__raptiFileError = (msg) => reject(new Error(msg));
        try { A().openFile(accept); } catch (e) { reject(e); }
        return;
      }
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = accept;
      inp.onchange = () => {
        const f = inp.files[0];
        if (!f) return reject(new Error('No file'));
        f.text().then((text) => resolve({ name: f.name, text }), reject);
      };
      inp.click();
    });
  },
  keepScreenOn(on) { try { A()?.keepScreenOn(!!on); } catch { /* ignore */ } },
};
