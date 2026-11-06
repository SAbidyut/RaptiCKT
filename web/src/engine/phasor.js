// Phasors and complex numbers the way a circuits textbook writes them (Alexander & Sadiku,
// Fundamentals of Electric Circuits, ch. 9–10): v(t) = Vm cos(ωt + φ)  ⇔  V = Vm∠φ (peak value,
// cosine reference), impedances Z = R + jX printed "4 − j3 Ω", "j8 Ω", "−j2.5 Ω".

import { fmtSI } from './units.js';

/** Complex number helpers on [re, im] pairs. */
export const C = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
  mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
  div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; },
  scale: (a, k) => [a[0] * k, a[1] * k],
  neg: (a) => [-a[0], -a[1]],
  conj: (a) => [a[0], -a[1]],
  abs: (a) => Math.hypot(a[0], a[1]),
  /** angle in degrees */
  arg: (a) => (Math.atan2(a[1], a[0]) * 180) / Math.PI,
  polar: (mag, deg) => [mag * Math.cos((deg * Math.PI) / 180), mag * Math.sin((deg * Math.PI) / 180)],
  inv: (a) => C.div([1, 0], a),
  isZero: (a, eps = 1e-12) => Math.abs(a[0]) < eps && Math.abs(a[1]) < eps,
};

const DEG = '°';
/** a number the way the book prints it: 4 significant figures, no trailing zeros */
export function num(v, digits = 4) {
  if (!Number.isFinite(v)) return v > 0 ? '∞' : v < 0 ? '−∞' : '—';
  if (Math.abs(v) < 1e-12) return '0';
  let s = (+v.toPrecision(digits)).toString();
  if (/e/.test(s)) s = (+v.toPrecision(digits)).toExponential().replace(/\.?0+e/, 'e');
  return s.replace(/^-/, '−');
}
/** an angle in degrees, between −180 and 180, the way the book prints it */
export function ang(deg, digits = 4) {
  let a = ((deg + 180) % 360 + 360) % 360 - 180;
  if (Math.abs(a + 180) < 1e-9) a = 180;
  const s = Math.abs(a) >= 100 ? +a.toFixed(digits > 3 ? 2 : 1) : +a.toPrecision(digits);
  return num(s, 6) + DEG;
}

/** "20∠30° V" — magnitude with an SI prefix when it needs one, angle in degrees. */
export function fmtPhasor(z, unit = '', digits = 4) {
  const m = C.abs(z);
  if (m < 1e-12) return `0 ${unit}`.trim();
  const mag = m >= 1e-3 && m < 1e4 ? num(m, digits) : fmtSI(m, '', digits).replace(/\s+/g, '');
  return `${mag}∠${ang(C.arg(z), digits)}${unit ? ' ' + unit : ''}`;
}

/** "4 − j3", "j8", "−j2.5", "12" — a complex number in rectangular form. */
export function fmtRect(z, unit = '', digits = 4) {
  const tidy = (x, ref) => (Math.abs(x) < 1e-9 * Math.max(1, ref) ? 0 : x);
  const ref = C.abs(z), re = tidy(z[0], ref), im = tidy(z[1], ref);
  let s;
  if (!im) s = num(re, digits);
  else if (!re) s = (im < 0 ? '−' : '') + 'j' + num(Math.abs(im), digits);
  else s = `${num(re, digits)} ${im < 0 ? '−' : '+'} j${num(Math.abs(im), digits)}`;
  return unit ? `${s} ${unit}` : s;
}

/** "7.59 cos(4t + 108.4°)" — the time function of a phasor at ω rad/s (ω = 0: its DC value). */
export function fmtTime(z, omega, unit = '', digits = 4) {
  if (!(omega > 0)) return `${num(z[0], digits)}${unit ? ' ' + unit : ''}`;
  const m = C.abs(z);
  if (m < 1e-12) return `0${unit ? ' ' + unit : ''}`;
  const a = C.arg(z), w = num(omega, 4);
  const wt = `${w === '1' ? '' : w}t`;
  const ph = Math.abs(a) < 0.005 ? '' : ` ${a < 0 ? '−' : '+'} ${ang(Math.abs(a), digits)}`;
  return `${num(m, digits)} cos(${wt}${ph})${unit ? ' ' + unit : ''}`;
}

/**
 * The phasor of a source's waveform at ω (book convention: peak value, cosine reference).
 * A sine A·sin(ωt + φ) is A∠(φ − 90°); a cosine A·cos(ωt + φ) is A∠φ; at ω = 0 the DC part
 * (a DC source, or an AC source's offset). A waveform at another frequency gives 0.
 */
export function sourcePhasor(p, omega) {
  const wave = p.wave || 'dc';
  if (!(omega > 0)) return [wave === 'dc' ? +p.amp || 0 : +p.offset || 0, 0];
  if (wave !== 'sine' && wave !== 'cos') return [0, 0];
  const w = 2 * Math.PI * (p.freq || 0);
  if (Math.abs(w - omega) > 1e-6 * omega) return [0, 0];
  return C.polar(+p.amp || 0, (+p.phase || 0) - (wave === 'sine' ? 90 : 0));
}

/** The angular frequency a source runs at: 2πf for a sine or cosine, 0 for DC, null otherwise. */
export function sourceOmega(p) {
  const wave = p.wave || 'dc';
  if (wave === 'dc') return 0;
  if (wave === 'sine' || wave === 'cos') return 2 * Math.PI * (p.freq || 0);
  return null;
}

/** Parse "10∠30", "10<30°", "4 - j3", "-j2.5", "j8", "12" → [re, im], or null. */
export function parsePhasor(text) {
  let s = String(text ?? '').trim().replace(/[Ω°VvAa]/g, '').replace(/\s+/g, '').replace(/−/g, '-').replace(/,/g, '.');
  if (!s) return null;
  const pol = /^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)(?:∠|<|\/_|\/)([-+]?\d*\.?\d+(?:e[-+]?\d+)?)$/i.exec(s);
  if (pol) return C.polar(+pol[1], +pol[2]);
  const rect = /^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)?(?:([-+])j(\d*\.?\d+(?:e[-+]?\d+)?)?)?$/i.exec(s);
  if (rect && (rect[1] !== undefined || rect[2])) {
    const re = rect[1] !== undefined ? +rect[1] : 0;
    const im = rect[2] ? (rect[2] === '-' ? -1 : 1) * (rect[3] !== undefined ? +rect[3] : 1) : 0;
    return [re, im];
  }
  const jOnly = /^([-+])?j(\d*\.?\d+(?:e[-+]?\d+)?)?$/i.exec(s);
  if (jOnly) return [0, (jOnly[1] === '-' ? -1 : 1) * (jOnly[2] !== undefined ? +jOnly[2] : 1)];
  return null;
}
