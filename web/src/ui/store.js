// Persistent storage (localStorage) for settings and saved circuits, plus the
// native Android bridge with browser fallbacks.

const K = { settings: 'raptickt.settings.v1', circuits: 'raptickt.circuits.v1', recent: 'raptickt.recent.v1', autosave: 'raptickt.autosave.v1', flags: 'raptickt.flags.v1', folders: 'raptickt.folders.v1', lf: 'raptickt.loadflow.v1', lfSaved: 'raptickt.loadflow.saved.v1' };

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
  scopeSide: true,     // landscape: oscilloscope beside the circuit instead of above it
  orientation: 'auto', // 'auto' | 'landscape' | 'portrait'
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
  claudeKey: '',       // the reader's Anthropic API key, for "Circuit from photo" (kept on this device)
  photoReader: 'offline', // "Circuit from photo" reads on the phone ('offline') or with Claude ('claude')
  damage: true,        // parts burn out and cables catch fire when over-stressed
  heatClock: 'real',   // 'real' | 'fast' | 'sim': clock for trips, heating and burning
  newWire: 'hw1.5',    // cable given to newly drawn wires (elements/cables.js WIRE_PRESETS)
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
  deleteAllCircuits() { write(K.circuits, []); write(K.folders, []); },
  deleteCircuits(ids) { const s = new Set(ids); write(K.circuits, this.circuits().filter((c) => !s.has(c.id))); },

  // ---- folders (My Circuits): [{ id, name, parent }]; a circuit's `folder` is a folder id or null (top level)
  folders() { return read(K.folders, []); },
  saveFolders(list) { return write(K.folders, list); },
  addFolder(id, name, parent = null) { const f = { id, name, parent, created: Date.now() }; this.saveFolders([...this.folders(), f]); return f; },
  renameFolder(id, name) { this.saveFolders(this.folders().map((f) => (f.id === id ? { ...f, name } : f))); },
  /** ids of a folder and every folder inside it */
  folderTree(id) {
    const all = this.folders(), out = [id];
    for (let i = 0; i < out.length; i++) for (const f of all) if (f.parent === out[i] && !out.includes(f.id)) out.push(f.id);
    return out;
  },
  /** Delete folders with everything inside them. Returns how many projects went with them. */
  deleteFolders(ids) {
    const gone = new Set(ids.flatMap((id) => this.folderTree(id)));
    const inside = this.circuits().filter((c) => gone.has(c.folder));
    this.saveFolders(this.folders().filter((f) => !gone.has(f.id)));
    write(K.circuits, this.circuits().filter((c) => !gone.has(c.folder)));
    return inside.length;
  },
  moveCircuits(ids, folder) { const s = new Set(ids); write(K.circuits, this.circuits().map((c) => (s.has(c.id) ? { ...c, folder: folder || null } : c))); },
  moveFolders(ids, parent) { const s = new Set(ids); this.saveFolders(this.folders().map((f) => (s.has(f.id) ? { ...f, parent: parent || null } : f))); },
  getCircuit(id) { return this.circuits().find((c) => c.id === id); },
  recent() { return read(K.recent, ['resistor', 'capacitor', 'dcv', 'ground', 'led', 'npn', 'switch', 'opamp']); },
  pushRecent(type) {
    const r = [type, ...this.recent().filter((t) => t !== type)].slice(0, 12);
    write(K.recent, r);
  },
  autosave(doc) { write(K.autosave, doc); },
  // Load Flow section: the system being worked on and the user's saved systems
  lfState() { return read(K.lf, null); },
  saveLfState(s) { return write(K.lf, s); },
  lfSaved() { return read(K.lfSaved, []); },
  saveLfSaved(list) { return write(K.lfSaved, list); },
  loadAutosave() { return read(K.autosave, null); },
  flag(name) { return !!read(K.flags, {})[name]; },
  setFlag(name, v = true) { const f = read(K.flags, {}); f[name] = v; write(K.flags, f); },
};

/** A picture ({ data: base64, mediaType }) → its pixels (ImageData), on white. */
export async function decodeImage({ data, mediaType }) {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const bmp = await createImageBitmap(new Blob([bytes], { type: mediaType || 'image/jpeg' }));
  const cv = document.createElement('canvas');
  cv.width = bmp.width; cv.height = bmp.height;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.drawImage(bmp, 0, 0);
  bmp.close?.();
  return ctx.getImageData(0, 0, cv.width, cv.height);
}

/** A picture file → JPEG with its long side at most `max` px (the camera's rotation applied). */
export async function shrinkImage(file, max = 1568) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(bmp.width * k)); cv.height = Math.max(1, Math.round(bmp.height * k));
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); // transparent PNGs read as white paper
  ctx.drawImage(bmp, 0, 0, cv.width, cv.height);
  bmp.close?.();
  return { data: cv.toDataURL('image/jpeg', 0.88).split(',')[1], mediaType: 'image/jpeg' };
}

// ----------------------------------------------------------- native bridge
const A = () => (typeof window !== 'undefined' ? window.RaptiAndroid : undefined);

// requests in flight through the Android app: id → { resolve, reject, ctl, done }
const pending = new Map();
let nextReq = 1;
const unb64 = (b64) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
const abortError = () => (typeof DOMException === 'function' ? new DOMException('The request was aborted.', 'AbortError') : Object.assign(new Error('aborted'), { name: 'AbortError' }));

/** fetch(url, init) done by the Android app: resolves a Response whose body streams as it arrives. */
function nativeFetch(url, init = {}) {
  return new Promise((resolve, reject) => {
    const id = 'r' + nextReq++;
    const sig = init.signal;
    if (sig?.aborted) { reject(abortError()); return; }
    const r = { resolve, reject, ctl: null, done: false };
    pending.set(id, r);
    const onAbort = () => {
      try { A().httpAbort(id); } catch { /* gone already */ }
      finish(id, abortError());
    };
    r.cleanup = () => sig?.removeEventListener('abort', onAbort);
    sig?.addEventListener('abort', onAbort, { once: true });
    const headers = {};
    new Headers(init.headers || {}).forEach((v, k) => { headers[k] = v; });
    const body = init.body == null ? null : String(init.body);
    try { A().httpRequest(id, String(init.method || 'GET'), String(url), JSON.stringify(headers), body); } catch (e) { finish(id, new TypeError(String(e?.message || e))); }
  });
}
function finish(id, err) {
  const r = pending.get(id);
  if (!r) return;
  pending.delete(id);
  r.cleanup?.();
  if (err) { if (r.ctl) { try { r.ctl.error(err); } catch { /* closed */ } } else r.reject(err); return; }
  try { r.ctl?.close(); } catch { /* closed */ }
}
if (typeof window !== 'undefined') {
  window.__raptiHttpHead = (id, status, head) => {
    const r = pending.get(id);
    if (!r) return;
    const body = status === 204 || status === 205 || status === 304 ? null : new ReadableStream({ start(c) { r.ctl = c; } });
    const h = new Headers();
    for (const [k, v] of JSON.parse(head || '[]')) { try { h.append(k, v); } catch { /* not allowed here */ } }
    r.resolve(new Response(body, { status, headers: h }));
  };
  window.__raptiHttpData = (id, b64) => { const r = pending.get(id); if (r?.ctl) r.ctl.enqueue(unb64(b64)); };
  window.__raptiHttpEnd = (id) => finish(id, null);
  window.__raptiHttpError = (id, msg) => finish(id, new TypeError('Network request failed: ' + msg));
}

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
  /**
   * A picture from the camera (camera = true) or the gallery, made smaller (long side ≤ max px:
   * 1568 is what Claude reads best; reading on the phone wants more detail) as JPEG.
   * Resolves { data (base64), mediaType }.
   */
  pickImage(camera = false, max = 1568) {
    return new Promise((resolve, reject) => {
      if (A() && A().pickImage) {
        window.__raptiImage = (b64) => resolve({ data: b64, mediaType: 'image/jpeg' });
        window.__raptiImageError = (msg) => reject(new Error(msg));
        try { A().pickImage(!!camera, Math.round(max)); } catch (e) { reject(e); }
        return;
      }
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*';
      if (camera) inp.setAttribute('capture', 'environment');
      inp.onchange = () => {
        const f = inp.files[0];
        if (!f) { reject(new Error('cancelled')); return; }
        shrinkImage(f, max).then(resolve, reject);
      };
      inp.click();
    });
  },
  /**
   * A fetch for the Claude API. In the Android app the page runs from file://, so the request
   * goes out through the app itself and streams back in pieces; elsewhere the browser's fetch.
   */
  apiFetch() {
    if (!(A() && A().httpRequest)) return undefined;
    return nativeFetch;
  },
  keepScreenOn(on) { try { A()?.keepScreenOn(!!on); } catch { /* ignore */ } },
  /** Full screen: Android hides the status and navigation bars; a browser uses the Fullscreen API. */
  setImmersive(on) {
    try { if (A()) { A().setImmersive(!!on); return; } } catch { /* fallthrough */ }
    try {
      const d = document;
      if (on && !d.fullscreenElement && d.documentElement.requestFullscreen) d.documentElement.requestFullscreen().catch(() => {});
      if (!on && d.fullscreenElement && d.exitFullscreen) d.exitFullscreen().catch(() => {});
    } catch { /* ignore */ }
  },
  /** 'auto' | 'landscape' | 'portrait' */
  setOrientation(mode) { try { A()?.setOrientation(String(mode)); } catch { /* ignore */ } },
};
