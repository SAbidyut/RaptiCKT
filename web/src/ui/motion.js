// Decides whether this phone gets the smooth (iOS-style) motion or the simple one.
//
// "smooth": custom momentum scrolling with rubber-band edges, card reveal and
//           page-entrance animations.
// "simple": the platform's own scrolling and no decorative animation at all —
//           nothing for a slow phone to stutter on.
//
// Setting "Animations": auto (default) | on | off. In auto mode the choice comes
// from the hardware (RAM, cores, Android performance class, via the native
// bridge), a short frame-rate probe at start-up, and a watchdog that keeps an eye
// on real scrolling: a phone that drops too many frames while animating is moved
// to simple mode for good (until the app is updated or the setting is changed).

const KEY = 'raptickt.motion.v1';

const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const write = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* ignore */ } };

function deviceInfo() {
  try { const A = window.RaptiAndroid; if (A && A.deviceInfo) return JSON.parse(A.deviceInfo()) || {}; } catch { /* web build */ }
  return {};
}

/** Hardware verdict: 'lite', 'full' or null (no opinion). */
function hardwareVerdict() {
  const d = deviceInfo();
  const mem = d.ramMB ? d.ramMB / 1024 : navigator.deviceMemory; // GB
  const cores = d.cores || navigator.hardwareConcurrency;
  if (d.lowRam) return 'lite';
  if (mem && mem < 2.5) return 'lite';
  if (cores && cores < 4) return 'lite';
  if (d.perfClass >= 30) return 'full'; // Android "media performance class" phones are fast
  if (mem && mem < 3.5 && cores && cores <= 4) return 'lite';
  return null;
}

export const motion = {
  level: 'full', // 'full' | 'lite'
  reason: '',
  listeners: new Set(),
  version: '',

  /** Work out the level from the setting, stored verdicts and the hardware. */
  init(setting = 'auto', version = '') {
    this.version = version;
    const saved = read();
    if (saved.version !== version) write({ version }); // an update gets a fresh chance
    this.decide(setting);
  },

  /** Forget an automatic downgrade (the user picked "Auto" again). */
  reset() { write({ version: this.version }); },

  decide(setting = 'auto') {
    this.setting = setting;
    const saved = read();
    let level = 'full', reason = 'smooth';
    if (setting === 'off') { level = 'lite'; reason = 'turned off in Settings'; } else if (setting === 'on') { level = 'full'; reason = 'turned on in Settings'; } else if (saved.lite) {
      level = 'lite'; reason = saved.lite;
    } else {
      const hw = hardwareVerdict();
      if (hw === 'lite') { level = 'lite'; reason = 'this phone is a low-power model'; } else reason = hw === 'full' ? 'fast phone' : 'phone looks capable';
    }
    this.set(level, reason);
  },

  set(level, reason) {
    const changed = level !== this.level;
    this.level = level; this.reason = reason;
    document.documentElement.classList.toggle('lite', level === 'lite');
    if (changed) for (const f of this.listeners) f(level);
  },

  get smooth() { return this.level === 'full'; },
  onChange(f) { this.listeners.add(f); return () => this.listeners.delete(f); },

  /**
   * Frame-rate probe at start-up (runs during the splash). A phone that cannot
   * hold ~45 fps even there is moved to simple mode.
   */
  probe(ms = 900) {
    if (this.setting !== 'auto' || this.level === 'lite') return;
    const dts = [];
    let last = 0, start = 0;
    const tick = (t) => {
      if (last) dts.push(t - last);
      last = t; start ||= t;
      if (t - start < ms) requestAnimationFrame(tick); else this.judge(dts, 'start-up frame rate too low', false);
    };
    requestAnimationFrame(tick);
  },

  /** Watchdog: called by animations with each frame's duration while something moves. */
  frames: [],
  frame(dt) {
    if (this.setting !== 'auto' || this.level === 'lite') return;
    if (dt > 250) return; // a pause (app switch, GC), not jank
    this.frames.push(dt);
    if (this.frames.length >= 60) this.flush();
  },
  /** Judge what has been collected (called when a scroll comes to rest, too). */
  flush() {
    if (this.frames.length >= 30) { this.judge(this.frames, 'dropped frames while scrolling'); this.frames = []; }
  },

  judge(dts, why, persist = true) {
    if (dts.length < 20) return;
    const s = [...dts].sort((a, b) => a - b);
    const med = s[Math.floor(s.length / 2)];
    const p90 = s[Math.floor(s.length * 0.9)];
    // a "missed" frame is one slower than ~35 fps; 90/120 Hz phones that sometimes
    // render at 60 fps are not penalised
    const missed = dts.filter((d) => d > 28).length / dts.length;
    if (med > 24 || p90 > 40 || missed > 0.18) {
      if (persist) write({ ...read(), version: this.version, lite: why });
      this.set('lite', why);
    }
  },
};
