// SI-prefix parsing and formatting used across the engine and UI.

const PREFIX = [
  [1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''],
  [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f'],
];

const PARSE_MUL = {
  T: 1e12, G: 1e9, M: 1e6, meg: 1e6, MEG: 1e6, k: 1e3, K: 1e3,
  m: 1e-3, u: 1e-6, 'µ': 1e-6, 'μ': 1e-6, n: 1e-9, p: 1e-12, f: 1e-15,
};

/** Parse a value such as "4.7k", "10uF", "2.2 MΩ", "1e-3", "4k7". Returns NaN on failure. */
export function parseSI(input) {
  if (typeof input === 'number') return input;
  if (input == null) return NaN;
  let s = String(input).trim().replace(/,/g, '').replace(/\s+/g, '');
  if (!s) return NaN;
  // "4k7" resistor notation
  const rkm = s.match(/^(-?\d+)([kKmMRr])(\d+)/);
  if (rkm && !/[eE]/.test(s)) {
    const m = rkm[2] === 'R' || rkm[2] === 'r' ? 1 : PARSE_MUL[rkm[2]];
    return parseFloat(rkm[1] + '.' + rkm[3]) * m;
  }
  const m = s.match(/^([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)(meg|MEG|[TGMkKmuµμnpf])?/);
  if (!m) return NaN;
  const v = parseFloat(m[1]);
  return m[2] ? v * PARSE_MUL[m[2]] : v;
}

/** Format a number with SI prefix and unit, e.g. fmtSI(4700,'Ω') -> "4.7 kΩ". */
export function fmtSI(v, unit = '', digits = 3) {
  if (v === undefined || v === null || Number.isNaN(v)) return '—';
  if (!Number.isFinite(v)) return (v > 0 ? '∞ ' : '-∞ ') + unit;
  const a = Math.abs(v);
  if (a < 1e-15) return '0 ' + unit;
  for (const [mul, p] of PREFIX) {
    if (a >= mul * 0.9995) return trimNum(v / mul, digits) + ' ' + p + unit;
  }
  return trimNum(v / 1e-15, digits) + ' f' + unit;
}

function trimNum(x, digits) {
  let s = x.toPrecision(digits);
  if (s.includes('e')) s = Number(s).toString();
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}

/** Compact formatting for canvas labels (no space before prefix). */
export function fmtShort(v, unit = '', digits = 3) {
  return fmtSI(v, unit, digits).replace(' ', '');
}

// Units that never take an SI prefix (a "klx" or "kµε" reads wrong).
const PLAIN_UNITS = new Set(['lx', 'µε', 'ppm', '°C', 'W/m²', '%RH', 'dB', 'dB SPL', 'G', '°', '%', 'N', 'rpm']);

/** Format a physical quantity for labels: SI prefixes where they make sense, plain numbers otherwise. */
export const isPlainUnit = (u) => PLAIN_UNITS.has(u);

export function fmtQty(v, unit = '') {
  if (!PLAIN_UNITS.has(unit)) return fmtShort(v, unit);
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  let num = a >= 1000 || a === 0 ? String(Math.round(v)) : trimNum(v, 3);
  if (a >= 1000) num = num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return unit === '%' || unit === '°' || unit === '°C' || unit === '%RH' ? num + unit : num + ' ' + unit;
}

export function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
