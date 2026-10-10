// Ratings of real parts: what destroys each component and how it fails.
//
// Every physical part gets the limits from its datasheet (or a typical part
// of its kind): maximum voltage between pins, continuous current, power
// dissipation, supply voltage. Element.checkLimits (base.js) watches them
// after every simulation step on the real-time thermal clock and, when one is
// broken, the part is destroyed the way the real one fails — open (fused
// leads, burnt coil) or short (punched-through semiconductor, cracked MLCC,
// welded contacts). Ratings that a user may want to change (a switch's contact
// rating, a transformer's VA, a heatsink) are added to the part's properties.
//
// Sources: manufacturer datasheets for the named presets (2N3904, BD139,
// TIP120, 2N7000, IRF540N, IRLZ44N, 1N4007, 1N4148, 1N5819, NE555, 78xx,
// LM317, TL431, LM393, PC817, MOC3021, BT136/BT151, L298N, A4988, LM2596,
// MT3608, ICL7660, CD4066, 74HC, CD4000), IEC 60384 (capacitors), IEC 60034
// (motors: locked-rotor withstand), IEC 60076 (transformers), IEC 60947
// (switches, contactors, relays).

import { getType, setLimits, hasLimits, getLimits as LIM_OF, allTypes } from './base.js';
import { fmtShort } from '../engine/units.js';

// ------------------------------------------------------------ rule makers
/** power dissipation, life model: T2 = seconds to failure at twice the rating */
const PD = (rated, o = {}) => ({ q: 'pd', rated, model: 'life', T2: 5, m: 6, inst: 20, ...o });
/** RMS current at pins (all pins when posts is omitted) */
const I = (rated, o = {}) => ({ q: 'irms', rated, model: 'therm', tau: 60, lim: 1.5, ...o });
/** RMS voltage across a pin pair, first-order heating (windings, appliances) */
const VR = (pair, rated, o = {}) => ({ q: 'vrms', pair, rated, model: 'therm', tau: 20, lim: 1.25, ...o });
/** instantaneous voltage limit (insulation / junction breakdown); dir +1: v(a) − v(b) only */
const VP = (pair, max, o = {}) => ({ q: 'vpk', pair, max, tf: 2e-4, ...o });
/** a setting that destroys the part as soon as it is powered */
const CFG = (fn, o = {}) => ({ q: 'cfg', fn, ...o });
const SHORT = (...pairs) => pairs.map(([a, b, r = 0.5]) => [a, b, r]);

const lim = (types, fn) => { for (const t of [].concat(types)) if (getType(t)) setLimits(t, fn); };
/** add a rating to a part's editable properties (once) */
const addProp = (types, prop) => {
  for (const t of [].concat(types)) {
    const C = getType(t);
    if (!C || C.props.some((p) => p.key === prop.key)) continue;
    C.props = [...C.props, typeof prop.def === 'object' ? { ...prop, def: prop.def[t] } : prop];
  }
};

// heatsinks for power packages: allowed dissipation (W) at 25 °C ambient for Tj = 150 °C
const HS = { key: 'hs', label: 'Heatsink', type: 'select', options: [['none', 'None (free air)'], ['small', 'Small clip-on (≈12 °C/W)'], ['large', 'Large / fan-cooled (≈2.5 °C/W)']] };
const PKG = {
  TO92: { none: 0.6, small: 0.6, large: 0.6 },
  TO126: { none: 1.25, small: 5.5, large: 10 },
  TO220: { none: 2, small: 8.5, large: 25 },
  TO247: { none: 3.5, small: 10, large: 60 },
  MOD: { none: 20, small: 60, large: 250 },
};
const pkgPd = (e, pkg) => (PKG[pkg] || PKG.TO92)[e.p.hs || 'none'] ?? PKG[pkg].none;

// ================================================================= diodes
// IF(AV), surge IFSM, and how much they may dissipate
const DIODE = {
  '1N4148': { i: 0.2, pd: 0.5, ifsm: 2 }, '1N4007': { i: 1, pd: 1.2, ifsm: 30 }, '1N5819': { i: 1, pd: 1, ifsm: 25 },
  FR107: { i: 1, pd: 1.2, ifsm: 30 }, UF4007: { i: 1, pd: 1.2, ifsm: 30 }, '6A10': { i: 6, pd: 6, ifsm: 400 },
  'C3D10065 (SiC)': { i: 10, pd: 15, ifsm: 80 }, 'BYV26 (avalanche)': { i: 1, pd: 1.5, ifsm: 30 },
};
const diodeRules = (d) => ({
  rules: [PD(d.pd, { T2: 10, m: 5, inst: 25, what: 'in the junction' }), I(d.i * 1.6, { model: 'life', T2: 20, m: 4, inst: d.ifsm / (d.i * 1.6) })],
  fail: SHORT([0, 1, 0.3]), // an over-stressed rectifier usually fails short
});
lim(['diode', 'diodeq', 'fastdiode', 'ufdiode', 'powerdiode', 'sicdiode', 'avalanche', 'schottky'], (e) => {
  const d = DIODE[e.p.model];
  return d ? diodeRules(d) : diodeRules({ i: 1, pd: 1, ifsm: 30 });
});
addProp('zener', { key: 'pz', label: 'Power rating', type: 'select', def: '0.5', options: [['0.5', '0.5 W (BZX55 / 1N52xx)'], ['1', '1 W (1N47xx)'], ['1.3', '1.3 W (BZX85)'], ['5', '5 W (1N53xx)']] });
lim('zener', (e) => ({ rules: [PD(+e.p.pz || 0.5, { T2: 10, m: 5, inst: 25, why: (x) => `Burnt — ${fmtShort(x, 'W')} in a ${fmtShort(+e.p.pz || 0.5, 'W')} zener (it needs a series resistor)` })], fail: SHORT([0, 1, 0.5]) }));
lim('varactor', () => ({ rules: [PD(0.1, { T2: 10, m: 5 })] }));
lim('tunnel', () => ({ rules: [PD(0.1, { T2: 10, m: 5 })] }));
lim('crd', () => ({ rules: [PD(0.5, { T2: 10, m: 5 }), VP([0, 1], 100, { what: 'the CRD' })] }));
lim('gunn', () => ({ rules: [PD(2, { T2: 10, m: 5 })] }));
lim('bridge', () => ({ rules: [PD(4, { T2: 20, m: 5, inst: 30, what: '(2 A bridge)' })], fail: SHORT([0, 1, 0.5]) }));
lim('rect3', () => ({ rules: [PD(100, { T2: 20, m: 5, inst: 60, what: '(25 A bridge on a heatsink)' })], fail: SHORT([0, 1, 0.5]) })); // surge (IFSM 400 A) covers a capacitor charging

// ============================================================= transistors
// VCEO, IC(max), package
const BJT = {
  '2N3904': { v: 40, i: 0.2, pkg: 'TO92', pd: 0.625 }, '2N2222': { v: 40, i: 0.8, pkg: 'TO92', pd: 0.5 }, BC547: { v: 45, i: 0.1, pkg: 'TO92', pd: 0.5 },
  BD139: { v: 80, i: 1.5, pkg: 'TO126' }, '2N3906': { v: 40, i: 0.2, pkg: 'TO92', pd: 0.625 }, BC557: { v: 45, i: 0.1, pkg: 'TO92', pd: 0.5 },
  BD140: { v: 80, i: 1.5, pkg: 'TO126' }, Generic: { v: 60, i: 1, pkg: 'TO92', pd: 1 },
};
addProp(['npn', 'pnp'], { ...HS, def: 'none' });
addProp(['darlnpn', 'darlpnp', 'igbt'], { ...HS, def: 'small' });
const bjtRules = (e, d, pol) => {
  const pd = d.pd && d.pkg === 'TO92' ? d.pd : pkgPd(e, d.pkg);
  return {
    rules: [
      PD(pd, { what: e.p.hs && e.p.hs !== 'none' ? '' : '(no heatsink)' }),
      I(d.i, { posts: [1], model: 'life', T2: 10, m: 4, inst: 6, what: 'in the collector' }),
      VP([1, 2], d.v * 1.15, { show: d.v, dir: pol, what: 'collector–emitter', why: (x) => `Collector–emitter breakdown — ${fmtShort(x, 'V')} (VCEO ${fmtShort(d.v, 'V')})` }),
    ],
    fail: SHORT([1, 2, 0.5], [0, 2, 2]),
  };
};
lim('npn', (e) => bjtRules(e, BJT[e.p.model] || BJT.Generic, 1));
lim('pnp', (e) => bjtRules(e, BJT[e.p.model] || BJT.Generic, -1));
lim('darlnpn', (e) => bjtRules(e, { v: 60, i: 5, pkg: 'TO220' }, 1)); // TIP120
lim('darlpnp', (e) => bjtRules(e, { v: 60, i: 5, pkg: 'TO220' }, -1)); // TIP125
lim('phototransistor', () => ({ rules: [PD(0.1, { T2: 10 }), VP([0, 1], 30 * 1.15, { show: 30, what: 'collector–emitter' })], fail: [] }));

// VDS, ID, VGS(max), package
const FET = {
  '2N7000': { v: 60, i: 0.2, g: 20, pkg: 'TO92', pd: 0.4 }, 'IRF540N': { v: 100, i: 33, g: 20, pkg: 'TO220' }, 'IRLZ44N': { v: 55, i: 47, g: 16, pkg: 'TO220' },
  'Logic-level': { v: 30, i: 5, g: 12, pkg: 'TO220' }, Generic: { v: 60, i: 2, g: 20, pkg: 'TO220' },
  BS250: { v: 45, i: 0.23, g: 20, pkg: 'TO92', pd: 0.83 }, IRF9540: { v: 100, i: 23, g: 20, pkg: 'TO220' },
};
addProp(['nmos', 'pmos', 'depnmos', 'hemt'], { ...HS, def: 'none' });
const fetRules = (e, d, pol) => ({
  rules: [
    VP([0, 2], d.g * 1.25, { show: d.g, tf: 2e-5, what: 'gate–source', fail: SHORT([0, 2, 5], [1, 2, 0.2]), why: (x) => `Gate oxide punctured — ${fmtShort(x, 'V')} gate–source (maximum ±${fmtShort(d.g, 'V')})` }),
    PD(d.pd && d.pkg === 'TO92' ? d.pd : pkgPd(e, d.pkg), { what: e.p.hs && e.p.hs !== 'none' ? '' : '(no heatsink)' }),
    I(d.i, { posts: [1], model: 'life', T2: 10, m: 4, inst: 4, what: 'in the drain' }),
    VP([1, 2], d.v * 1.2, { show: d.v, dir: pol, what: 'drain–source', why: (x) => `Avalanche breakdown — ${fmtShort(x, 'V')} drain–source (VDS max ${fmtShort(d.v, 'V')})` }),
  ],
  fail: SHORT([1, 2, 0.2]),
});
lim('nmos', (e) => fetRules(e, FET[e.p.model] || FET.Generic, 1));
lim('pmos', (e) => fetRules(e, FET[e.p.model] || FET.Generic, -1));
lim('depnmos', (e) => fetRules(e, { v: 250, i: 0.1, g: 20, pkg: 'TO92', pd: 1 }, 1)); // BSS139-class
lim(['njfet', 'pjfet'], () => ({ rules: [PD(0.35, { T2: 10 }), VP([1, 2], 40 * 1.15, { show: 40, what: 'drain–source' })], fail: [] }));
lim('igbt', (e) => ({ rules: [VP([0, 2], 25, { tf: 2e-5, what: 'gate–emitter', fail: SHORT([0, 2, 5], [1, 2, 0.2]) }), PD(pkgPd(e, 'TO247')), I(30, { posts: [1], model: 'life', T2: 10, m: 4, inst: 4 }), VP([1, 2], 600 * 1.2, { dir: 1, what: 'collector–emitter' })], fail: SHORT([1, 2, 0.2]) }));
// GaN e-mode: the gate tolerates only +6 / −4 V
lim('hemt', (e) => ({
  rules: [VP([0, 2], 7, { dir: 1, tf: 1e-5, what: 'gate–source', fail: SHORT([0, 2, 5], [1, 2, 0.1]), why: (x) => `GaN gate destroyed — ${fmtShort(x, 'V')} gate–source (a GaN HEMT gate allows only +6 V)` }),
    VP([2, 0], 5, { dir: 1, tf: 1e-5, what: 'source–gate', fail: SHORT([0, 2, 5], [1, 2, 0.1]) }),
    PD(pkgPd(e, 'TO220') * 0.6), VP([1, 2], 100 * 1.2, { dir: 1, what: 'drain–source' })],
  fail: SHORT([1, 2, 0.1]),
}));
lim('ujt', () => ({ rules: [PD(0.3, { T2: 10 }), VP([1, 2], 35 * 1.15, { show: 35, what: 'B2–B1' })], fail: [] })); // 2N2646
lim('opto', () => ({ // PC817
  rules: [I(0.05, { posts: [0], model: 'life', T2: 300, m: 6, inst: 8, what: 'through its LED' }), I(0.05, { posts: [2], model: 'life', T2: 30, m: 4, inst: 6, what: 'in its phototransistor' }),
    VP([2, 3], 35 * 1.15, { show: 35, dir: 1, what: 'collector–emitter' })],
  fail: [],
}));

// ============================================================ thyristors
addProp(['scr', 'triac', 'gto', 'scs', 'lascr'], { key: 'itrms', label: 'On-state current rating IT(RMS)', unit: 'A', def: { scr: 12, triac: 8, gto: 100, scs: 0.2, lascr: 1 }, min: 0.01, max: 5000, log: true });
addProp(['scr', 'triac', 'gto', 'scs', 'lascr'], { ...HS, def: 'small' });
const thyr = (e) => ({
  rules: [I(e.p.itrms, { posts: [0], model: 'therm', tau: e.p.hs === 'none' ? 10 : 30, lim: 1.3, inst: 15, what: '(on-state)' }),
    I(e.constructor.type === 'gto' ? 5 : 0.2, { posts: [2], model: 'life', T2: 5, m: 4, inst: 10, what: 'into the gate (use a gate resistor)' })],
  fail: SHORT([0, 1, 0.1]), // thyristors fail short: the load stays on
});
lim(['scr', 'triac', 'gto', 'scs', 'lascr'], thyr);
lim('diac', () => ({ rules: [PD(0.15, { T2: 5, m: 5, inst: 30 })], fail: SHORT([0, 1, 1]) })); // DB3
lim('sidac', () => ({ rules: [I(1, { model: 'life', T2: 10, m: 4, inst: 20 })], fail: SHORT([0, 1, 0.2]) }));
lim('put', () => ({ rules: [I(0.15, { posts: [0], model: 'life', T2: 10, m: 4, inst: 10 }), VP([0, 1], 40 * 1.15, { show: 40, what: 'anode–cathode' })], fail: [] })); // 2N6027
lim('optotriac', () => ({ rules: [I(0.06, { posts: [0], model: 'life', T2: 300, m: 6, inst: 8, what: 'through its LED' }), I(0.1, { posts: [2], model: 'life', T2: 5, m: 4, inst: 10, what: 'in the photo-TRIAC (it only drives a TRIAC gate)' })], fail: SHORT([2, 3, 2]) }));
lim('optoscr', () => ({ rules: [I(0.06, { posts: [0], model: 'life', T2: 300, m: 6, inst: 8, what: 'through its LED' }), I(0.3, { posts: [2], model: 'life', T2: 10, m: 4, inst: 10, what: 'in the photo-SCR' })], fail: SHORT([2, 3, 1]) }));
lim('igbtmod', () => ({ rules: [PD(250, { T2: 10 }), I(100, { posts: [3], model: 'therm', tau: 20, lim: 1.4, inst: 6 })], fail: SHORT([2, 3, 0.05], [3, 4, 0.05]) }));
lim('buckmod', () => ({ rules: [VP([0, 1], 40, { dir: 1, what: 'the input (LM2596: 40 V max)' }), I(3, { posts: [2], model: 'therm', tau: 20, lim: 1.3, what: 'from the output (3 A module)' })], fail: [] }));
lim('boostmod', () => ({ rules: [VP([0, 1], 24, { dir: 1, what: 'the input (MT3608: 24 V max)' }), VP([2, 3], 28, { dir: 1, what: 'the output (28 V max)' }), I(4, { posts: [0], model: 'therm', tau: 20, lim: 1.25, what: 'into the input (4 A switch)' })], fail: [] }));
lim('hbridge', () => ({ rules: [VP([3, 6], 46, { dir: 1, what: 'VS (L298N: 46 V max)' }), I(2, { posts: [4, 5], model: 'therm', tau: 20, lim: 1.5, inst: 2, what: 'per channel (L298N: 2 A)' }), PD(25, { posts: [3, 4, 5, 6], T2: 10 })], fail: [] }));
lim('stepdrv', () => ({ rules: [VP([3, 8], 35, { dir: 1, what: 'VMOT (A4988: 35 V max)' })], fail: [] }));
lim('chargepump', () => ({ rules: [VP([0, 1], 10.5, { dir: 1, what: 'V+ (ICL7660: 10.5 V max)' }), PD(0.5, { T2: 10 })], fail: [] }));

// ============================================================ analog ICs
const OPAMP_VMAX = { LM741: 44, LM358: 32, TL071: 36, OPA2134: 36, 'Rail-to-rail 5V': 6, LM324: 32, TL072: 36, TL082: 36 };
const supplyCheck = (vmax, name) => (e) => {
  const v = (e.p.vpos ?? 0) - (e.p.vneg ?? 0);
  return v > vmax ? `Destroyed at power-up — ${fmtShort(v, 'V')} total supply on ${name || e.p.model || 'it'} (absolute maximum ${fmtShort(vmax, 'V')})` : null;
};
// an edited preset becomes 'custom': hold it to the LM741's ±22 V; the ideal op-amp has no limit
// Pins far outside the supply rails (the inputs' protection diodes take a few mA through a
// resistor; straight from a stiff source, or tens of volts beyond, they burn). The rails are
// implicit (settings), so are the limits: 15 V of margin keeps a divider-fed input safe.
const RAIL_M = 15;
const railPins = (lo, hi, name = 'this IC') => VPIN(lo - RAIL_M, hi + RAIL_M, { why: (x) => `Destroyed — ${fmtShort(x, 'V')} on a pin of ${name}, far outside its ${fmtShort(lo, 'V')} … ${fmtShort(hi, 'V')} supply rails` });
const opRails = (e, name) => railPins(Math.min(0, +e.p.vneg || 0), Math.max(1, +e.p.vpos || 15), name);
// the ideal op-amp has no supply limit, but nothing survives the mains on its input
lim('opamp', (e) => ({ rules: [...(e.p.model === 'Ideal' ? [] : [CFG(supplyCheck(OPAMP_VMAX[e.p.model] || 44), { label: `Total supply ≤ ${OPAMP_VMAX[e.p.model] || 44} V` })]), opRails(e, 'the op-amp')], fail: [] }));
lim(['follower', 'diffamp', 'tia', 'instamp', 'ad633'], (e) => ({ rules: [CFG(supplyCheck(36, 'this op-amp'), { label: 'Total supply ≤ 36 V' }), opRails(e)], fail: [] }));
lim('poweramp', (e) => ({ rules: [CFG(supplyCheck(44, 'the TDA2030'), { label: 'Total supply ≤ 44 V' }), opRails(e, 'the amplifier'), I(3.5, { posts: [1], model: 'life', T2: 10, m: 4, inst: 2, what: 'from the output' })], fail: [] }));
lim('lm386', (e) => ({ rules: [CFG((x) => (x.p.vs > 15 ? `Destroyed at power-up — ${fmtShort(x.p.vs, 'V')} supply (LM386 absolute maximum 15 V)` : null), { label: 'Supply ≤ 15 V' }), railPins(0, +e.p.vs || 9, 'the LM386'), PD(1.25, { T2: 10 })], fail: [] }));
// blocks whose supply is implicit: a typical ±15 V (or the logic level they output)
lim('comparator', () => ({ rules: [railPins(-15, 36, 'the comparator (LM393 class)'), I(0.05, { posts: [2], model: 'life', T2: 30, m: 3, inst: 40, what: 'from the output' })], fail: [] }));
lim(['ota', 'samplehold', 'rms2dc', 'preamp', 'tonectl', 'equalizer', 'rfamp', 'filterblk', 'mixer', 'envdet'], () => ({ rules: [railPins(-15, 15)], fail: [] }));
lim('sawfilter', () => ({ rules: [VP('span', 30, { tf: 1e-3, why: (x) => `Cracked — ${fmtShort(x, 'V')} on a SAW filter (its input takes about +20 dBm)` })], fail: [] }));
lim('curramp', (e) => ({ rules: [railPins(-(+e.p.vc || 12), +e.p.vc || 12, 'the current amplifier')], fail: [] }));
lim('vco', (e) => ({ rules: [railPins(0, +e.p.vhigh || 5, 'the VCO')], fail: [] }));
lim('vubar', () => ({ rules: [railPins(0, 25, 'the LM3914 (25 V max)')], fail: [] }));
lim('comparatoroc', () => ({ rules: [I(0.03, { posts: [2], model: 'life', T2: 30, m: 4, inst: 6, what: 'into the open-collector output (LM393 sinks ≈16 mA — drive a relay with a transistor)' }), VP('span', 36, { what: 'its pins' })], fail: [] }));
lim(['timer555', 'timer556'], () => ({ rules: [VP('span', 18, { what: 'the supply pins', why: (x) => `Destroyed — ${fmtShort(x, 'V')} across the supply (NE555 absolute maximum 18 V)` }), PD(0.6, { T2: 10 })], fail: [] }));
lim('pll4046', () => ({ rules: [CFG((e) => (e.p.vdd > 20 ? `VDD ${fmtShort(e.p.vdd, 'V')} exceeds the CD4046's 20 V absolute maximum` : null), { label: 'VDD ≤ 20 V' })], fail: [] }));
addProp(['reg78', 'reg79', 'lm317', 'lm337', 'ldo'], { ...HS, def: 'small' });
lim(['reg78', 'ldo'], (e) => ({ rules: [VP([0, 2], e.constructor.type === 'ldo' ? 15 : 35, { dir: 1, what: 'IN–GND', why: (x) => `Destroyed — ${fmtShort(x, 'V')} input (${e.constructor.type === 'ldo' ? 'AMS1117: 15 V' : '78xx: 35 V'} max)` }),
  VP([1, 0], 7, { dir: 1, tf: 5e-4, what: 'OUT above IN (add a protection diode)' })], fail: [] }));
lim('reg79', () => ({ rules: [VP([2, 0], 35, { dir: 1, what: 'GND–IN' })], fail: [] }));
lim('lm317', () => ({ rules: [VP([0, 1], 40, { dir: 1, what: 'IN–OUT (LM317: 40 V max)' })], fail: [] }));
lim('lm337', () => ({ rules: [VP([1, 0], 40, { dir: 1, what: 'OUT–IN (LM337: 40 V max)' })], fail: [] }));
lim('tl431', () => ({ rules: [VP([1, 2], 37, { dir: 1, what: 'cathode–anode (TL431: 37 V max)' }), I(0.1, { posts: [1], model: 'life', T2: 10, m: 6, inst: 5, what: 'cathode current (100 mA max)' }), PD(0.7, { T2: 10 })], fail: [] }));
lim('lm4040', () => ({ rules: [I(0.015, { model: 'life', T2: 20, m: 6, inst: 8, what: '(LM4040: 15 mA max — bias it through a resistor)' })], fail: SHORT([0, 1, 5]) }));
lim('anaswitch', () => ({ rules: [CFG((e) => (e.p.vdd > 20 ? `VDD ${fmtShort(e.p.vdd, 'V')} exceeds the CD4066's 20 V maximum` : null), { label: 'VDD ≤ 20 V' }), I(0.025, { posts: [0, 2], model: 'life', T2: 20, m: 4, inst: 6, what: 'through the switch (CD4066: ±25 mA)' })], fail: [] }));

// =================================================== logic and digital ICs
// 74HC: 7 V absolute maximum supply; CD4000-series: 20 V. Every pin must stay within the supply:
// the datasheet allows VDD + 0.5 V while the clamp diodes carry ≤ 20 mA; a few volts beyond that
// from a stiff source (12 V on a 5 V input, the mains…) burns them. An output shorted to a rail
// overheats its driver (±25 mA per pin, a short gives several times that).
const CMOS4000 = new Set(['decade', 'pll4046', 'anaswitch']);
/** any pin more than `m` volts outside 0 … VDD (against ground) */
const VPIN = (lo, hi, o = {}) => ({ q: 'vpin', lo, hi, tf: 1e-3, ...o });
const logicPins = (e, m = 6) => VPIN(-m, (+e.p.vdd || 5) + m, { why: (x) => `Destroyed — ${fmtShort(x, 'V')} on a pin of a ${fmtShort(+e.p.vdd || 5, 'V')} chip (inputs and outputs must stay within 0 V … VDD: use a resistor divider or a level shifter)` });
const outShort = () => I(0.05, { model: 'life', T2: 30, m: 3, inst: 40, what: 'from a pin (an output shorted to a rail, or a load it cannot drive)' });
const logic = (e) => {
  const vmax = CMOS4000.has(e.constructor.type) ? 20 : 7;
  return { rules: [CFG((x) => (x.p.vdd > vmax ? `VDD ${fmtShort(x.p.vdd, 'V')} exceeds the ${vmax === 7 ? '74HC' : 'CD4000'} absolute maximum of ${vmax} V — chip destroyed` : null), { label: `VDD ≤ ${vmax} V` }), logicPins(e), outShort()], fail: [] };
};
// every chip with a VDD setting (gates, counters, registers, communication modules…); the
// logic inputs and probes are not chips (displays get their own rule below)
const NOT_CHIPS = new Set(['logicin', 'logicout', 'hexin', 'clock', 'sevenseg', 'seg14', 'hexdisp', 'dotmatrix']);
for (const C of allTypes()) if (C.props.some((p) => p.key === 'vdd') && !NOT_CHIPS.has(C.type) && !hasLimits(C.type)) lim(C.type, logic);
// the CD4000 parts above got their own rules first: add the pin limits to them too
for (const t of ['pll4046', 'anaswitch']) {
  const base = LIM_OF(t);
  if (base) lim(t, (e) => { const r = base(e); return r && { ...r, rules: [...r.rules, logicPins(e)] }; });
}
// logic-level displays: a decoder chip behind the inputs, same pin limits
lim(['sevenseg', 'seg14', 'hexdisp'], (e) => ({ rules: [logicPins(e)], fail: [] }));

// ============================================================== passives
addProp(['pot', 'trimpot'], { key: 'pmax', label: 'Power rating', unit: 'W', def: { pot: 0.5, trimpot: 0.5 }, min: 0.01, max: 100, log: true });
addProp('rheostat', { key: 'pmax', label: 'Power rating', unit: 'W', def: 50, min: 0.1, max: 5000, log: true });
lim(['pot', 'trimpot', 'rheostat'], (e) => ({ rules: [PD(e.p.pmax, { T2: 15, m: 4, inst: 20, what: 'in the track' })], fail: [] }));
lim('shuntr', (e) => ({ rules: [PD(e.p.pmax, { T2: 20, m: 4, inst: 20 })], fail: [] }));
addProp('npecap', { key: 'vr', label: 'Rated voltage (AC RMS)', unit: 'V', def: 250, min: 1, max: 2000, log: true });
lim('npecap', (e) => ({ rules: [VP([0, 1], 1.25 * Math.SQRT2 * e.p.vr, { tf: 2e-3, why: (x) => `Burst — ${fmtShort(x, 'V')} on a ${fmtShort(e.p.vr, 'V')} capacitor` })], fail: [] }));
lim('ceramiccap', (e) => ({ rules: [VP([0, 1], 2.5 * e.p.vr, { tf: 1e-4, why: (x) => `Dielectric breakdown — ${fmtShort(x, 'V')} on a ${fmtShort(e.p.vr, 'V')} MLCC (it cracks and shorts)` })], fail: SHORT([0, 1, 1]) }));
lim(['filmcap', 'polyestercap', 'ppcap'], (e) => ({ rules: [VP([0, 1], 1.5 * e.p.vr, { tf: 1e-3, why: (x) => `Dielectric burnt through — ${fmtShort(x, 'V')} on a ${fmtShort(e.p.vr, 'V')} film capacitor` })], fail: [] }));
lim('micacap', (e) => ({ rules: [VP([0, 1], 2 * e.p.vr, { tf: 1e-4 })], fail: SHORT([0, 1, 1]) }));
lim('supercap', (e) => ({ rules: [VP([0, 1], 1.15 * e.p.vmax, { dir: 1, tf: 0.05, why: (x) => `Bulged and vented — charged to ${fmtShort(x, 'V')} (rated ${fmtShort(e.p.vmax, 'V')} per cell)` }), VP([1, 0], 0.8, { dir: 1, tf: 0.5, what: 'it in reverse' })], fail: [] }));
lim('coreind', (e) => ({ rules: [I(e.p.isat, { model: 'therm', tau: 60, lim: 1.5, what: '(winding)' })], fail: [] }));
lim('ferrite', () => ({ rules: [I(3, { model: 'therm', tau: 10, lim: 1.5 })], fail: [] }));
lim(['crystal', 'ceramicres'], () => ({ rules: [PD(1e-3, { T2: 60, m: 2, inst: 50, why: (x) => `Cracked — over-driven at ${fmtShort(x, 'W')} (drive level max 1 mW)` })], fail: [] }));

// =========================================================== transformers
addProp(['transformer', 'txstepdown', 'txstepup', 'isotx', 'autotx'], { key: 'vr1', label: 'Rated primary voltage (RMS)', unit: 'V', def: { transformer: 230, txstepdown: 230, txstepup: 12, isotx: 230, autotx: 230 }, min: 1, max: 1e6, log: true });
addProp(['transformer', 'txstepdown', 'txstepup', 'isotx', 'xfmrct', 'xfmr2s', 'autotx', 'tx3ph'], { key: 'va', label: 'Rated power', unit: 'VA', def: { transformer: 1000, txstepdown: 100, txstepup: 100, isotx: 500, xfmrct: 100, xfmr2s: 100, autotx: 2000, tx3ph: 250000 }, min: 0.1, max: 1e8, log: true });
const xfmr = (vr, va, prim = [0, 1]) => ({
  rules: [
    VR(prim, vr, { tau: 15, lim: 1.25, inst: 2.5, why: (x) => `Burnt — ${fmtShort(x, 'V')} on a ${fmtShort(vr, 'V')} winding: the core saturates, the magnetising current soars and the primary overheats` }),
    I(va / vr, { posts: [prim[0]], model: 'therm', tau: 300, lim: 1.4, why: (x) => `Windings overheated — ${fmtShort(x, 'A')} primary current on a ${fmtShort(va, 'VA')} transformer (rated ${fmtShort(va / vr, 'A')})` }),
  ],
  fail: [],
});
lim(['transformer', 'txstepdown', 'txstepup', 'isotx'], (e) => xfmr(e.p.vr1, e.p.va));
lim(['xfmrct', 'xfmr2s'], (e) => xfmr(e.p.vp, e.p.va));
lim('autotx', (e) => xfmr(e.p.vr1, e.p.va));
lim('tx3ph', (e) => ({ rules: [VR([0, 1], e.p.vp, { tau: 60, lim: 1.2, inst: 2 }), I(e.p.va / (Math.sqrt(3) * e.p.vp), { posts: [0, 1, 2], model: 'therm', tau: 900, lim: 1.4 })], fail: [] }));
lim('ct', () => ({ rules: [VP([2, 3], 500, { tf: 1e-3, why: (x) => `Insulation broke down — ${fmtShort(x, 'V')} on an open CT secondary (never open-circuit a CT while current flows: short it or keep its burden connected)` })], fail: [] }));

// ============================================================= protection
addProp('polyfuse', { key: 'vmax', label: 'Maximum voltage', unit: 'V', def: 60, min: 1, max: 1000, log: true });
lim('polyfuse', (e) => ({ rules: [VP([0, 1], 1.15 * e.p.vmax, { tf: 1e-3, why: (x) => `Destroyed — ${fmtShort(x, 'V')} across a polyfuse rated ${fmtShort(e.p.vmax, 'V')}` }), I(40, { model: 'life', T2: 1, inst: 1, what: '(interrupt rating 40 A)' })], fail: [] }));
lim('mov', () => ({ rules: [PD(1, { T2: 3, m: 3, inst: 2000, why: (x) => `Overheated and split — conducting ${fmtShort(x, 'W')} continuously (its voltage is too low for this supply)` })], fail: SHORT([0, 1, 0.5]) }));
lim('arrester', () => ({ rules: [PD(50, { T2: 10, m: 3, inst: 5000 })], fail: SHORT([0, 1, 1]) }));
lim('gdt', () => ({ rules: [PD(2, { T2: 2, m: 3, inst: 1000, why: (x) => `Overheated — ${fmtShort(x, 'W')} of follow current kept the arc burning` })], fail: SHORT([0, 1, 0.2]) }));
lim(['tvs', 'tvsbi'], () => ({ rules: [PD(5, { T2: 2, m: 4, inst: 120, why: (x) => `Failed short — ${fmtShort(x, 'W')} continuous (a TVS only absorbs short surges)` })], fail: SHORT([0, 1, 0.3]) }));

// ========================================================= switches, relays
const SW = {
  switch: 10, togglesw: 6, slidesw: 0.5, rockersw: 10, keysw: 5, oneway: 10, twoway: 10, threeway: 15, intermediate: 10, spdt: 5, dpst: 10, dpdt: 5,
  pushno: 3, pushnc: 3, footsw: 10, latchbtn: 3, estop: 10, limitsw: 10, rotary4: 3, dipsw: 0.1, selector3: 10, isolator: 63, changeover: 63,
  reed: 0.5, floatsw: 10, pressw: 16, thermostat: 16, relay: 10, relayspst: 10, relaydpst: 10, relaydpdt: 5, relay8: 5, relay8oct: 10, relay14: 3, relayauto4: 30, relayauto5: 30, relaymod: 10, timer8: 5, timer14: 3, reedrelay: 0.5, latchrelay: 10,
  auxrelay: 10, contactor: 25, contactor2: 25, tdr: 5, lno: 10, lnc: 10, lmain3: 25, photocell: 6, pirsw: 6, socket: 16, jbox: 32,
};
addProp(Object.keys(SW), { key: 'irate', label: 'Contact rating', unit: 'A', def: SW, min: 0.01, max: 6300, log: true });
const contacts = (e, extra = []) => ({
  rules: [...extra, I(e.p.irate, { model: 'therm', tau: 60, lim: 1.5, why: (x) => `Contacts burnt — ${fmtShort(x, 'A')} through a ${fmtShort(e.p.irate, 'A')} contact` })],
  fail: [],
});
const COIL = ['relay', 'relayspst', 'relaydpst', 'relaydpdt', 'relay8', 'relay8oct', 'relay14', 'relayauto4', 'relayauto5', 'timer8', 'timer14', 'reedrelay', 'latchrelay', 'auxrelay', 'contactor', 'contactor2', 'tdr', 'lcoil', 'ltimer', 'lcounter', 'lcreset', 'llevel'];
const coilPower = (e) => {
  const R = e.p.rcoil || 100, X = e.p.ac ? 2 * Math.PI * (e.p.freq || 50) * (e.p.lcoil || 0) : 0, Z2 = R * R + X * X;
  return (e.p.vcoil * e.p.vcoil * R) / Z2;
};
const coilRule = (e) => PD(coilPower(e), { model: 'therm', tau: 60, lim: 1.8, inst: 0, why: (x) => `Coil burnt — ${fmtShort(x, 'W')} in a coil rated ${fmtShort(coilPower(e), 'W')} (${fmtShort(e.p.vcoil, 'V')}${e.p.ac ? ' AC' : ''}) — check the coil voltage` });
for (const t of Object.keys(SW)) {
  if (['socket', 'jbox', 'photocell', 'pirsw', 'relaymod'].includes(t)) continue;
  lim(t, (e) => contacts(e, COIL.includes(t) ? [coilRule(e)] : []));
}
lim(['lcoil', 'ltimer', 'lcounter', 'lcreset', 'llevel'], (e) => ({ rules: [coilRule(e)], fail: [] }));
// contactors: a short-circuit current far above the rating welds the main contacts shut
lim(['contactor', 'contactor2'], (e) => ({
  rules: [coilRule(e), I(e.p.irate, { posts: [2, 3, 4], model: 'therm', tau: 60, lim: 1.5, inst: 12, fail: SHORT([2, 5, 0.01], [3, 6, 0.01], [4, 7, 0.01]), why: (x) => `Main contacts welded shut — ${fmtShort(x, 'A')} through ${fmtShort(e.p.irate, 'A')} contacts (protect it with an MCB / overload relay)` })],
  fail: [],
}));
// relay module: the coil burns on a supply far above its rating; contacts as any relay
lim('relaymod', (e) => ({
  rules: [VR([0, 1], +e.p.vcoil || 5, { tau: 30, lim: 1.5, inst: 0, why: (x) => `Relay coil burnt — ${fmtShort(x, 'V')} on a ${e.p.vcoil} V module` }),
    I(e.p.irate, { posts: [4], model: 'therm', tau: 60, lim: 1.5, why: (x) => `Contacts burnt — ${fmtShort(x, 'A')} through a ${fmtShort(e.p.irate, 'A')} relay module` })],
  fail: [],
}));
// ULN2003A: 500 mA per output, 50 V, ≈1 W for the DIP package
lim('uln2003', () => ({
  rules: [PD(1, { T2: 10, m: 5, inst: 20, what: '(DIP-16, ≈1 W)' }),
    I(0.5, { posts: [8, 9, 10, 11, 12, 13, 14], model: 'life', T2: 10, m: 4, inst: 4, what: 'in an output (500 mA each)' }),
    VP([8, 7], 57.5, { show: 50, what: 'output 1C–GND' }), I(0.025, { posts: [0, 1, 2, 3, 4, 5, 6], model: 'life', T2: 5, m: 4, inst: 8, what: 'into an input' })],
  fail: SHORT([8, 7, 2]),
}));
// stabilizer: winding rated for its VA at the set voltage; the input survives up to ≈300 V
lim('stabilizer', (e) => ({
  rules: [I(e.p.va / e.p.vset, { posts: [1], model: 'therm', tau: 120, lim: 1.5, why: (x) => `Winding burnt — ${fmtShort(x, 'A')} out of a ${fmtShort(e.p.va, 'VA')} stabilizer (overloaded)` }),
    VR([0, 2], 300, { tau: 10, lim: 1.2, inst: 1.6, why: (x) => `Burnt — ${fmtShort(x, 'V')} on its input (rated up to 300 V)` })],
  fail: [],
}));
// flasher: lamp current and a 12 V system
lim('flasher', (e) => ({
  rules: [I(Math.max(1, (2.5 * e.p.load) / 12), { posts: [2], model: 'therm', tau: 20, lim: 1.5, inst: 8, what: 'to the lamps' }),
    VR([0, 1], 15, { tau: 10, lim: 1.3, inst: 2, why: (x) => `Burnt — ${fmtShort(x, 'V')} on a 12 V flasher` })],
  fail: [],
}));
lim('ssr', () => ({ rules: [I(25, { posts: [2], model: 'therm', tau: 30, lim: 1.3, inst: 10, what: 'through the output (25 A SSR)' }), I(0.05, { posts: [0], model: 'life', T2: 300, m: 6, inst: 8, what: 'into the input' })], fail: SHORT([2, 3, 0.05]) }));
lim(['photocell', 'pirsw'], (e) => ({ rules: [VR([0, 1], 230, { lim: 1.3 }), I(e.p.irate, { posts: [2], model: 'therm', tau: 60, lim: 1.5, what: 'switched' })], fail: [] }));

// ============================================================ electrical
const appliance = (pair, vr, label = '') => VR(pair, vr, { tau: 10, lim: 1.25, inst: 1.8, why: (x) => `Burnt — ${fmtShort(x, 'V')} on a ${fmtShort(vr, 'V')}${label} (over-voltage)` });
lim(['cfl', 'ledpanel'], () => ({ rules: [appliance([0, 1], 230, ' lamp: its electronic driver blew')], fail: [] }));
lim('ledstrip', (e) => {
  const opt = (getType('ledstrip').props.find((p) => p.key === 'type')?.options || []).find(([k]) => k === e.p.type);
  const v = +((opt ? opt[1] : String(e.p.type)).match(/(\d+(?:\.\d+)?)\s*V/) || [0, 12])[1];
  return { rules: [appliance([0, 1], v, ' strip: its LEDs burnt')], fail: [] };
});
lim('tube', () => ({ rules: [I(0.6, { model: 'therm', tau: 10, lim: 1.6, inst: 6, why: (x) => `Electrodes burnt out — ${fmtShort(x, 'A')} arc current (a tube needs its choke to limit the current)` })], fail: [] }));
lim('ballast', () => ({ rules: [I(0.45, { model: 'therm', tau: 120, lim: 1.6, why: (x) => `Choke winding burnt — ${fmtShort(x, 'A')} (rated 0.43 A for a 40 W tube)` })], fail: [] }));
lim('neon', () => ({ rules: [I(0.002, { model: 'life', T2: 30, m: 3, inst: 20, why: (x) => `Burnt out — ${fmtShort(x, 'A')} (a neon lamp needs a series resistor, e.g. 100 kΩ on 230 V)` })], fail: [] }));
lim('socket', (e) => ({ rules: [appliance([0, 1], e.p.v, ' appliance'), I(e.p.irate, { posts: [0, 1], model: 'therm', tau: 120, lim: 1.5, inst: 0, why: (x) => `Socket melted — ${fmtShort(x, 'A')} through a ${fmtShort(e.p.irate, 'A')} socket` })], fail: [] }));
addProp('dimmer', { key: 'irate', label: 'Load rating', unit: 'A', def: 2, min: 0.05, max: 100, log: true });
lim('dimmer', (e) => ({ rules: [I(e.p.irate, { model: 'therm', tau: 20, lim: 1.4, inst: 12, why: (x) => `TRIAC failed short — ${fmtShort(x, 'A')} through a ${fmtShort(e.p.irate, 'A')} dimmer (the lamp can no longer be dimmed)` })], fail: SHORT([0, 1, 0.3]) }));
lim('fanregres', () => ({ rules: [I(0.5, { model: 'therm', tau: 120, lim: 1.5 })], fail: [] }));
lim('bell', () => ({ rules: [I(0.4, { model: 'therm', tau: 30, lim: 1.5, why: (x) => `Bell coil burnt — ${fmtShort(x, 'A')}` })], fail: [] }));

// ========================================================= power systems
lim(['rload', 'rlload', 'rcload'], (e) => ({ rules: [appliance([0, 1], e.p.v, ' load')], fail: [] }));
lim(['load3y', 'load3d'], (e) => ({ rules: [appliance([0, 1], e.p.vll, ' (line) load')], fail: [] }));
lim('pfcap', (e) => ({ rules: [VR([0, 1], e.p.v, { tau: 10, lim: 1.15, inst: 1.5, why: (x) => `Burst — ${fmtShort(x, 'V')} on a ${fmtShort(e.p.v, 'V')} PF capacitor (IEC 60831 allows 1.1 × Un)` })], fail: [] }));
lim('busbar', (e) => ({ rules: [I(e.p.rating, { model: 'therm', tau: 600, lim: 1.6, why: (x) => `Busbar overheated — ${fmtShort(x, 'A')} on a ${fmtShort(e.p.rating, 'A')} bar` })], fail: [] }));
lim('jbox', (e) => ({ rules: [I(e.p.irate, { model: 'therm', tau: 120, lim: 1.5, why: (x) => `Connector melted — ${fmtShort(x, 'A')} in a ${fmtShort(e.p.irate, 'A')} junction box` })], fail: [] }));

// =============================================================== machines
// rated current: windings heat with I² (first order, minutes); a stalled motor
// (≈ 6 × rated current) survives about 15–20 s, like the locked-rotor time of IEC 60034
addProp(['motor', 'dcsep', 'dcshunt', 'dcseries', 'dccompound', 'universal', 'dcgen', 'im3', 'im3d', 'im1', 'syncmotor', 'pmsm', 'bldc', 'stepper', 'alternator', 'acgen1'],
  { key: 'irated', label: 'Rated current', unit: 'A', def: { motor: 1.5, dcsep: 25, dcshunt: 25, dcseries: 25, dccompound: 25, universal: 5, dcgen: 15, im3: 15, im3d: 8, im1: 3, syncmotor: 15, pmsm: 10, bldc: 6, stepper: 2, alternator: 150, acgen1: 40 }, min: 0.001, max: 1e5, log: true });
const winding = (e, posts) => ({
  rules: [I(e.p.irated, { posts, model: 'therm', tau: 300, lim: 1.5, why: (x) => `Winding burnt — ${fmtShort(x, 'A')} for too long (rated ${fmtShort(e.p.irated, 'A')}): overloaded, stalled or on the wrong voltage. A motor needs an overload relay.` })],
  fail: [],
});
// and a rated voltage: well above it a DC motor over-speeds and its commutator flashes over, an
// AC motor's core saturates — either way the winding burns within seconds
addProp(['motor', 'dcsep', 'dcshunt', 'dcseries', 'dccompound', 'universal', 'im3'], { key: 'vrated', label: 'Rated voltage', unit: 'V', def: { motor: 12, dcsep: 220, dcshunt: 220, dcseries: 220, dccompound: 220, universal: 230, im3: 400 }, min: 0.1, max: 1e5, log: true });
const overV = (pair, vr) => VR(pair, vr, { tau: 20, lim: 1.3, inst: 2.5, why: (x) => `Burnt — ${fmtShort(x, 'V')} on a ${fmtShort(vr, 'V')} motor: over-voltage (it over-speeds / the core saturates, the commutator flashes over and the winding burns)` });
const motorRules = (e, posts, pair, vr) => { const w = winding(e, posts); if (vr > 0) w.rules.push(overV(pair, vr)); return w; };
lim(['dcgen', 'acgen1'], (e) => winding(e, [0]));
lim(['motor', 'dcshunt', 'dcseries', 'dccompound', 'universal', 'dcsep'], (e) => motorRules(e, [0], [0, 1], e.p.vrated));
lim('im1', (e) => winding(e, [0])); // over-voltage: core saturation and winding temperature (machines.js)
lim('im3', (e) => motorRules(e, [0, 1, 2], [0, 1], e.p.vrated));
lim(['syncmotor', 'pmsm'], (e) => motorRules(e, [0, 1, 2], [0, 1], e.p.vll));
lim('im3d', (e) => winding(e, [0, 1, 2, 3, 4, 5]));
lim(['bldc', 'stepper'], (e) => winding(e));
lim('alternator', (e) => winding(e, [0, 1, 2]));

// ============================================================= batteries
// max continuous discharge current (C-rate × capacity) and charge voltage per cell
const CELL = { alkaline: { c: 0.8, vmax: 1.65, charge: false }, lithium: { c: 0.05, vmax: 3.3, charge: false }, nimh: { c: 5, vmax: 1.6 }, nicd: { c: 10, vmax: 1.6 }, liion: { c: 3, vmax: 4.35, fire: true }, lifepo4: { c: 3, vmax: 3.9, fire: false }, leadacid: { c: 3, vmax: 2.6 } };
const batt = (e, chem, cells, ah) => {
  const c = CELL[chem] || CELL.alkaline;
  const rules = [I(c.c * ah, { model: 'therm', tau: 60, lim: 2.2, selfHeat: true, why: (x) => `${c.fire ? 'Thermal runaway — caught fire' : 'Overheated'}: ${fmtShort(x, 'A')} from a ${fmtShort(ah, 'Ah')} battery (${c.c} C max) — a short circuit?` }),
    VP([0, 1], c.vmax * cells, { dir: 1, tf: c.fire ? 0.5 : 5, why: (x) => `${c.fire ? 'Over-charged to ' + fmtShort(x, 'V') + ' — thermal runaway, fire!' : 'Over-charged to ' + fmtShort(x, 'V') + ' — electrolyte boiled away'}` })];
  if (c.charge === false) rules.push(I(0.05, { posts: [0], sign: 1, model: 'therm', tau: 30, lim: 1.5, why: () => 'Leaked / burst — a primary (non-rechargeable) cell must never be charged' }));
  return { rules, fail: [], flame: !!c.fire };
};
for (const t of ['cellaa', 'bat9v', 'coincell', 'nimh', 'nicd', 'liion', 'lipo2s', 'lifepo4', 'lifepo12', 'leadacid', 'agm', 'gel']) {
  const C = getType(t);
  if (C) lim(t, (e) => batt(e, C.chem, C.cells, e.p.ah));
}
lim('batpack', (e) => batt(e, e.p.chem, Math.round(e.p.s), e.p.np * e.p.cah));

// ================================================================ outputs
lim('lasermod', () => ({ rules: [I(0.04, { model: 'life', T2: 0.5, m: 8, inst: 2, why: (x) => `Laser diode dead (optical damage) — ${fmtShort(x, 'A')}: run the module from 5 V` })], fail: [] }));
lim('buzzer', () => ({ rules: [PD(0.3, { T2: 60, m: 4, inst: 15, why: (x) => `Burnt — ${fmtShort(x, 'W')} (rated voltage exceeded)` })], fail: [] }));
lim('piezobuzz', () => ({ rules: [VP([0, 1], 40, { tf: 1e-3, what: 'the piezo disc (30 Vpp max)' })], fail: [] }));
lim('speaker', (e) => ({ rules: [PD(e.p.w, { T2: 20, m: 3, inst: 25, why: (x) => `Voice coil burnt — ${fmtShort(x, 'W')} into a ${fmtShort(e.p.w, 'W')} speaker` })], fail: [] }));
lim('headphone', () => ({ rules: [PD(0.05, { T2: 20, m: 3, inst: 25, why: (x) => `Driver burnt — ${fmtShort(x, 'W')} (headphones handle ≈50 mW)` })], fail: [] }));
addProp(['solenoid', 'electromagnet'], { key: 'vr', label: 'Rated voltage', unit: 'V', def: 12, min: 0.1, max: 1000, log: true });
lim(['solenoid', 'electromagnet'], (e) => ({ rules: [I(e.p.vr / e.p.r, { model: 'therm', tau: 120, lim: 1.4, why: (x) => `Coil burnt — ${fmtShort(x, 'A')} (rated ${fmtShort(e.p.vr / e.p.r, 'A')} at ${fmtShort(e.p.vr, 'V')})` })], fail: [] }));
lim('peltier', () => ({ rules: [I(6.4, { model: 'life', T2: 30, m: 4, why: (x) => `Overheated — ${fmtShort(x, 'A')} (TEC1-12706: 6.4 A max); the solder joints melted` })], fail: [] }));
lim('dcfan', (e) => ({ rules: [VR([0, 1], e.p.vr, { tau: 30, lim: 1.5, inst: 2.5, why: (x) => `Motor driver burnt — ${fmtShort(x, 'V')} on a ${fmtShort(e.p.vr, 'V')} fan` })], fail: [] }));

// ========================================================== vacuum tubes
const plate = (pa, name) => ({ rules: [PD(pa, { T2: 60, m: 4, inst: 10, why: (x) => `Plate glowed red and the tube failed — ${fmtShort(x, 'W')} plate dissipation (${name} max ${fmtShort(pa, 'W')})` })], fail: [] });
lim('vacdiode', () => plate(3, 'rectifier'));
lim('triode', () => plate(1.2, '12AX7'));
lim('pentode', () => plate(14, 'EL84'));

// ================================================================ sensors
const SUPPLY = { lm35: 35, hall: 7, hallswitch: 28, pir: 22, irprox: 7, irdist: 7, ultrasonic: 7, pressure: 16, flame: 7, uv: 7, gyro: 7, co2: 7, soundmod: 7, imu: 7, waterlevel: 7, proxind: 36, proxcap: 36, photoeye: 36, accel: 7, anemometer: 30, flow: 24, magneto: 7 };
for (const [t, v] of Object.entries(SUPPLY)) lim(t, () => ({ rules: [VP('span', v, { tf: 1e-3, why: (x) => `Destroyed — ${fmtShort(x, 'V')} on a sensor rated for ${fmtShort(v, 'V')} maximum` })], fail: [] }));
lim(['ltx', 'ptx', 'ttx', 'ftx', 'smoke'], () => ({ rules: [VP([0, 1], 40, { tf: 1e-3, what: 'the loop terminals (36 V max)' })], fail: [] }));
lim('ldr', () => ({ rules: [PD(0.1, { T2: 30, m: 4, inst: 30 }), VP([0, 1], 180, { what: 'the LDR (150 V max)' })], fail: [] }));
lim('ntc', () => ({ rules: [PD(0.5, { T2: 30, m: 4, inst: 30 })], fail: [] }));
lim('ptc', () => ({ rules: [PD(1.5, { T2: 30, m: 4, inst: 30 })], fail: [] }));
lim(['pt100', 'pt1000'], () => ({ rules: [PD(0.25, { T2: 30, m: 4, inst: 40 })], fail: [] }));
lim(['strain', 'fsr', 'flex'], () => ({ rules: [PD(0.3, { T2: 30, m: 4, inst: 30 })], fail: [] }));
lim('loadcell', () => ({ rules: [PD(0.7, { T2: 30, m: 4, inst: 30 })], fail: [] }));
lim('lm335', () => ({ rules: [I(0.015, { model: 'life', T2: 20, m: 6, inst: 8, what: '(LM335: 15 mA max — bias it through a resistor)' })], fail: [] }));

// ================================================================= meters
// multimeter (10 A range, its internal fuse) and a panel ammeter (100 A, short-time withstand)
lim('ammeter', () => ({ rules: [I(10, { model: 'therm', tau: 1, lim: 3, why: (x) => `Internal fuse blown — ${fmtShort(x, 'A')} through the 10 A range. An ammeter goes in series, never across a supply!` })], fail: [] }));
lim('acamp', () => ({ rules: [I(100, { model: 'therm', tau: 60, lim: 1.5, why: (x) => `Meter coil burnt — ${fmtShort(x, 'A')} through a 100 A ammeter` })], fail: [] }));
lim(['voltmeter', 'acvolt', 'freqmeter', 'dbmeter', 'peakvolt'], () => ({ rules: [VP([0, 1], 1100, { tf: 1e-3, why: (x) => `Destroyed — ${fmtShort(x, 'V')} on a 1000 V meter` })], fail: [] }));
lim('panelmeter', () => ({ rules: [VP([0, 1], 500, { tf: 1e-3, what: 'the input (500 V max)' })], fail: [] }));
lim('ohmmeter', () => ({ rules: [VP([0, 1], 250, { tf: 1e-3, why: (x) => `Destroyed — the ohmmeter was connected to a live circuit (${fmtShort(x, 'V')}). Switch the power off before measuring resistance.` })], fail: [] }));
lim('lcr', () => ({ rules: [VP([0, 1], 50, { tf: 1e-3, why: (x) => `Destroyed — measured a live circuit (${fmtShort(x, 'V')}); switch the power off first` })], fail: [] }));
lim(['wattmeter', 'pfmeter', 'varmeter', 'phasemeter'], () => ({ rules: [VP('span', 700, { tf: 1e-3, what: 'its terminals (600 V max)' }), I(20, { model: 'therm', tau: 30, lim: 1.5, what: 'through the current coil (20 A)' })], fail: [] }));
lim('kwh', () => ({ rules: [I(60, { model: 'therm', tau: 300, lim: 1.25, why: (x) => `Meter terminals burnt — ${fmtShort(x, 'A')} through a 10(60) A energy meter` })], fail: [] }));
lim('mcvolt', (e) => ({ rules: [VR([0, 1], e.p.fs, { tau: 10, lim: 1.5, inst: 3, why: (x) => `Coil burnt — ${fmtShort(x, 'V')} on the ${fmtShort(e.p.fs, 'V')} range (the needle slammed against the stop)` })], fail: [] }));
lim('mcamp', (e) => ({ rules: [I(e.p.fs, { model: 'therm', tau: 5, lim: 2, inst: 10, why: (x) => `Coil burnt — ${fmtShort(x, 'A')} on the ${fmtShort(e.p.fs, 'A')} range` })], fail: [] }));
lim('galvo', (e) => ({ rules: [I(e.p.fs, { model: 'life', T2: 5, m: 2, inst: 20, why: (x) => `Galvanometer coil burnt — ${fmtShort(x, 'A')} (full scale ${fmtShort(e.p.fs, 'A')})` })], fail: [] }));

// ============================================== everything else that is a real part
// (added in the realism audit: every physical part now has a limit that destroys it)

// displays and drivers
lim('dotmatrix', () => ({ rules: [I(0.16, { model: 'life', T2: 20, m: 4, inst: 25, what: 'through a row or column (8 LEDs × 20 mA — drive it through resistors)' })], fail: [] }));
lim('servo', () => ({ rules: [VPIN(-6, 12, { why: (x) => `Servo electronics burnt — ${fmtShort(x, 'V')} on its signal / supply (hobby servos take 4.8–7.4 V)` })], fail: [] }));

// passives: the plain R, C and L are real parts now (power, voltage and current ratings)
addProp('capacitor', { key: 'vr', label: 'Voltage rating', type: 'select', def: '50', options: [['0', 'Ideal (no limit)'], ['6.3', '6.3 V'], ['10', '10 V'], ['16', '16 V'], ['25', '25 V'], ['50', '50 V'], ['63', '63 V'], ['100', '100 V'], ['250', '250 V'], ['400', '400 V'], ['450', '450 V AC (motor run)'], ['630', '630 V'], ['1000', '1 kV'], ['2000', '2 kV'], ['6000', '6 kV']] });
lim('capacitor', (e) => (+e.p.vr > 0 ? { rules: [VP([0, 1], 1.5 * e.p.vr, { tf: 1e-3, show: +e.p.vr, why: (x) => `Dielectric broke down — ${fmtShort(x, 'V')} on a ${fmtShort(+e.p.vr, 'V')} capacitor: it cracked and shorted` })], fail: SHORT([0, 1, 1]) } : null));
addProp('realcap', { key: 'vr', label: 'Voltage rating', unit: 'V', def: 50, min: 1, max: 1e5, log: true });
lim('realcap', (e) => ({ rules: [VP([0, 1], 1.5 * e.p.vr, { tf: 1e-3, show: e.p.vr, why: (x) => `Dielectric broke down — ${fmtShort(x, 'V')} on a ${fmtShort(e.p.vr, 'V')} capacitor: it cracked and shorted` })], fail: SHORT([0, 1, 1]) }));
lim('varcap', () => ({ rules: [VP([0, 1], 600, { tf: 1e-4, show: 500, why: (x) => `Flashed over — ${fmtShort(x, 'V')} across the air-gap tuning capacitor (≈500 V max)` })], fail: [] }));
addProp(['inductor', 'varind'], { key: 'irate', label: 'Current rating', type: 'select', def: { inductor: '2', varind: '0.5' }, options: [['0', 'Ideal (no limit)'], ['0.1', '100 mA'], ['0.25', '250 mA'], ['0.5', '500 mA'], ['1', '1 A'], ['2', '2 A'], ['3', '3 A'], ['5', '5 A'], ['10', '10 A'], ['20', '20 A'], ['50', '50 A'], ['100', '100 A']] });
lim(['inductor', 'varind'], (e) => (+e.p.irate > 0 ? { rules: [I(+e.p.irate, { model: 'therm', tau: 30, lim: 1.6, inst: 25, why: (x) => `Winding burnt open — ${fmtShort(x, 'A')} through a ${fmtShort(+e.p.irate, 'A')} inductor` })], fail: [] } : null));
lim('supercap', (e) => ({ rules: [VP([0, 1], 1.15 * e.p.vmax, { dir: 1, tf: 0.05, why: (x) => `Bulged and vented — charged to ${fmtShort(x, 'V')} (rated ${fmtShort(e.p.vmax, 'V')} per cell)` }), VP([1, 0], 0.8, { dir: 1, tf: 0.5, what: 'it in reverse' }),
  I(Math.max(0.5, 2 * Math.sqrt(e.p.c)), { model: 'therm', tau: 30, lim: 2, why: (x) => `Overheated — ${fmtShort(x, 'A')} through a ${fmtShort(e.p.c, 'F')} supercapacitor (its ESR cooks it)` })], fail: [] }));

// diodes
lim('pindiode', () => ({ rules: [PD(0.25, { T2: 10, m: 5, inst: 25 })], fail: SHORT([0, 1, 0.5]) }));
lim('impatt', () => ({ rules: [PD(1, { T2: 10, m: 5, inst: 25, why: (x) => `Burnt — ${fmtShort(x, 'W')} in the avalanche region (an IMPATT needs a current-limited supply)` })], fail: SHORT([0, 1, 0.5]) }));
lim('igct', () => ({ rules: [I(1500, { posts: [0], model: 'therm', tau: 30, lim: 1.3, inst: 15, what: '(on-state)' }), VP([0, 1], 4500 * 1.15, { dir: 1, show: 4500, what: 'anode–cathode' })], fail: SHORT([0, 1, 0.01]) }));

// electrical installation parts
lim('starter', () => ({ rules: [I(1.5, { model: 'therm', tau: 10, lim: 1.5, inst: 15, why: (x) => `Bimetal contacts welded — ${fmtShort(x, 'A')} through the glow starter (the tube now only glows at its ends)` })], fail: SHORT([0, 1, 0.5]) }));
lim('fanregcap', () => ({ rules: [VR([0, 1], 250, { tau: 10, lim: 1.3, inst: 2, why: (x) => `Capacitor burst — ${fmtShort(x, 'V')} across the regulator's 250 V capacitors` }), I(1, { model: 'therm', tau: 60, lim: 1.5, what: '(fan regulator)' })], fail: [] }));
lim('emerg', () => ({ rules: [appliance([0, 1], 230, ' emergency light: its charger burnt')], fail: [] }));
lim('leddriver', (e) => ({ rules: [appliance([0, 1], 230, ' LED driver'), I(Math.max(e.p.iset || 0, e.p.imax || 0) * 1.2 || 1, { posts: [2], model: 'therm', tau: 20, lim: 1.4, what: 'from the output' })], fail: [] }));

// protection and control relays
lim('tco', () => ({ rules: [I(10, { model: 'therm', tau: 8, lim: 1.4, inst: 30, fail: [], why: (x) => `Opened for good — ${fmtShort(x, 'A')} heated the 10 A thermal fuse past its cut-off temperature` })], fail: [] }));
lim('olr', (e) => ({ rules: [I(e.p.ir, { posts: [0], model: 'therm', tau: 20, lim: 4, inst: 25, why: (x) => `Heater burnt — ${fmtShort(x, 'A')} through a ${fmtShort(e.p.ir, 'A')} overload relay (it cannot break a short circuit: put an MPCB or fuses before it)` })], fail: [] }));
lim('olr3', (e) => ({ rules: [I(e.p.ir, { posts: [0, 1, 2], model: 'therm', tau: 20, lim: 4, inst: 25, why: (x) => `Heaters burnt — ${fmtShort(x, 'A')} through a ${fmtShort(e.p.ir, 'A')} overload relay (it cannot break a short circuit: put an MPCB or fuses before it)` })], fail: [] }));
lim('voltrelay', () => ({ rules: [VR([0, 1], 300, { tau: 10, lim: 1.25, inst: 1.8, why: (x) => `Burnt — ${fmtShort(x, 'V')} on a 230 V monitoring relay` })], fail: [] }));
lim('phaserelay', () => ({ rules: [VR([0, 3], 300, { tau: 10, lim: 1.25, inst: 1.8, why: (x) => `Burnt — ${fmtShort(x, 'V')} L1–N on a 400 V phase relay` }), VR([1, 3], 300, { tau: 10, lim: 1.25, inst: 1.8 }), VR([2, 3], 300, { tau: 10, lim: 1.25, inst: 1.8 })], fail: [] }));
lim('idmt', (e) => ({ rules: [I(Math.max(5, 2 * e.p.is), { posts: [0], model: 'therm', tau: 10, lim: 3, inst: 50, what: 'through the current coil' })], fail: [] }));

// lines: the conductor's thermal rating
addProp(['sline', 'piline'], { key: 'irate', label: 'Conductor rating', unit: 'A', def: 400, min: 1, max: 1e5, log: true });
lim(['sline', 'piline'], (e) => ({ rules: [I(e.p.irate, { posts: [0], model: 'therm', tau: 600, lim: 1.5, why: (x) => `Conductor overheated — ${fmtShort(x, 'A')} on a line rated ${fmtShort(e.p.irate, 'A')}: it annealed, sagged and broke` })], fail: [] }));

// transformers
lim('pt', () => ({ rules: [VR([0, 1], 11000, { tau: 15, lim: 1.25, inst: 2, why: (x) => `Burnt — ${fmtShort(x, 'V')} on an 11 kV PT primary` }), I(0.2, { posts: [2], model: 'therm', tau: 30, lim: 2, inst: 20, why: (x) => `Secondary burnt — ${fmtShort(x, 'A')} (a PT secondary must never be short-circuited)` })], fail: [] }));

// sensors
const sensorSupply = (types, v) => lim(types, () => ({ rules: [VP('span', v, { tf: 1e-3, why: (x) => `Destroyed — ${fmtShort(x, 'V')} on a sensor rated for ${fmtShort(v, 'V')} maximum` })], fail: [] }));
sensorSupply(['humidity', 'mic', 'capsense', 'piezosens'], 50);
sensorSupply(['encoder', 'linenc'], 30);
lim(['gas', 'soilm', 'rain'], () => ({ rules: [PD(0.25, { T2: 30, m: 4, inst: 30 })], fail: [] }));
lim('photodiode', () => ({ rules: [PD(0.1, { T2: 10, m: 4, inst: 30 }), VP([1, 0], 60, { dir: 1, show: 50, what: 'it in reverse' })], fail: [] }));
lim('solar', (e) => ({ rules: [PD(Math.max(0.05, 2 * e.p.isc * e.p.voc * e.p.cells), { T2: 30, m: 4, inst: 20, why: (x) => `Hot spot — the cell burnt dissipating ${fmtShort(x, 'W')} (forced current; panels need bypass / blocking diodes)` })], fail: [] }));
lim('thermocouple', () => ({ rules: [I(1, { model: 'therm', tau: 5, lim: 2, why: (x) => `Thermocouple wire melted — ${fmtShort(x, 'A')} (it is a sensor, not a conductor)` })], fail: [] }));
lim('tacho', () => ({ rules: [I(0.2, { model: 'therm', tau: 30, lim: 2, inst: 20, why: (x) => `Armature burnt — ${fmtShort(x, 'A')} forced through the tachogenerator` })], fail: [] }));
lim('tilt', () => ({ rules: [I(0.5, { model: 'therm', tau: 10, lim: 1.5, inst: 20, why: (x) => `Contacts welded — ${fmtShort(x, 'A')} through a 0.5 A tilt switch` })], fail: SHORT([0, 1, 0.05]) }));
lim('ph', () => ({ rules: [VP([0, 1], 50, { tf: 1e-3, what: 'the glass electrode' })], fail: [] }));
lim('lvdt', () => ({ rules: [VR([0, 1], 10, { tau: 10, lim: 1.5, inst: 3, why: (x) => `Primary burnt — ${fmtShort(x, 'V')} excitation (an LVDT runs on a few volts AC)` })], fail: [] }));
lim('acs712', (e) => ({ rules: [I(+e.p.range || 5, { posts: [0], model: 'therm', tau: 10, lim: 2, inst: 20, why: (x) => `Current path fused — ${fmtShort(x, 'A')} through a ±${e.p.range} A ACS712` }), VPIN(-6, 12, { why: (x) => `Destroyed — ${fmtShort(x, 'V')} on a pin (the ACS712 runs from 5 V; its current path is isolated, its pins are not)` })], fail: [] }));
lim('vsense', () => ({ rules: [VR([0, 1], 250, { tau: 10, lim: 1.4, inst: 2.5, why: (x) => `Input transformer burnt — ${fmtShort(x, 'V')} on a 250 V ZMPT101B` })], fail: [] }));

// megger (a test-voltage source): destroyed by a live circuit
lim('megger', () => ({ rules: [VP([0, 1], 1100, { tf: 1e-3, why: (x) => `Destroyed — ${fmtShort(x, 'V')}: the insulation tester was connected to a live circuit` })], fail: [] }));

// power electronics blocks: input voltage and output current ratings
const conv = (types, vin, name) => lim(types, (e) => ({ rules: [VP([0, 1], vin, { dir: 1, tf: 1e-3, why: (x) => `Destroyed — ${fmtShort(x, 'V')} on the input of ${name} (${fmtShort(vin, 'V')} max)` }), I(15, { posts: [0], model: 'therm', tau: 20, lim: 1.4, inst: 6, what: 'into the input (switch current limit)' })], fail: [] }));
conv(['buckboost', 'cuk', 'sepic'], 60, 'the converter');
conv(['flyback', 'forward'], 450, 'the converter');
conv(['pushpull', 'halfbridge', 'fullbridge'], 450, 'the converter');
lim('gatedrv', () => ({ rules: [VPIN(-1500, 1500, { why: (x) => `Isolation barrier broke down — ${fmtShort(x, 'V')} (the gate driver is isolated to ≈1.5 kV)` }), VP([0, 1], 20, { dir: 1, what: 'the input' }), I(2, { posts: [2], model: 'therm', tau: 5, lim: 2, inst: 6, what: 'from the gate output' })], fail: [] }));
lim('ipm', () => ({ rules: [VP([3, 5], 600 * 1.2, { dir: 1, show: 600, what: 'the DC bus P–N' }), VPIN(-1000, 1000), I(30, { posts: [3], model: 'therm', tau: 20, lim: 1.3, inst: 8, what: '(module)' })], fail: SHORT([3, 4, 0.05]) }));
lim(['inv3', 'bldcdrv'], (e) => ({ rules: [VP([4, 8], e.constructor.type === 'inv3' ? 1200 * 1.2 : 60 * 1.2, { dir: 1, show: e.constructor.type === 'inv3' ? 1200 : 60, what: 'the DC bus P–N' }), I(e.constructor.type === 'inv3' ? 100 : 30, { posts: [4], model: 'therm', tau: 20, lim: 1.3, inst: 6, what: 'into the bridge' })], fail: [] }));
lim('firing', () => ({ rules: [VR([0, 1], 300, { tau: 10, lim: 1.25, inst: 1.8, why: (x) => `Burnt — ${fmtShort(x, 'V')} on the 230 V sync input of the firing unit` })], fail: [] }));

// batteries and renewables
lim('bms', (e) => ({ rules: [I(Math.max(10, 4 * e.p.ioc), { posts: [0], model: 'therm', tau: 10, lim: 1.5, inst: 10, why: (x) => `MOSFETs burnt — ${fmtShort(x, 'A')} through the protection board` }), VP([0, 1], 4.5 * Math.max(1, e.p.cells) + 3, { dir: 1, tf: 1e-3, what: 'the cell inputs B+ / B−' })], fail: [] }));
lim('cccv', (e) => ({ rules: [VP([0, 1], e.p.kind === 'smps' ? 40 : 9, { dir: 1, tf: 1e-3, why: (x) => `Destroyed — ${fmtShort(x, 'V')} input on a charger rated for ${e.p.kind === 'smps' ? '40' : '8'} V max` })], fail: [] }));
lim('mpptcc', (e) => ({ rules: [VP([0, 1], 100, { dir: 1, tf: 1e-3, why: (x) => `Destroyed — PV open-circuit voltage ${fmtShort(x, 'V')} above the controller's 100 V maximum (too many panels in series)` }), I(e.p.imax * 1.5, { posts: [2], model: 'therm', tau: 30, lim: 1.4, what: 'into the battery' })], fail: [] }));
lim('pwmcc', () => ({ rules: [VP([0, 1], 50, { dir: 1, tf: 1e-3, why: (x) => `Destroyed — ${fmtShort(x, 'V')} from the panel on a 12/24 V PWM controller (50 V max)` }), I(30, { posts: [0], model: 'therm', tau: 30, lim: 1.4, what: 'from the panel (30 A controller)' })], fail: [] }));
lim('invoff', (e) => ({ rules: [VP([0, 1], 17, { dir: 1, tf: 5e-3, why: (x) => `Destroyed — ${fmtShort(x, 'V')} on a 12 V inverter input` }), VP([1, 0], 1, { dir: 1, tf: 1e-3, why: () => 'Destroyed — battery connected the wrong way round (reverse polarity)' }), I((1.5 * e.p.prated) / (e.p.vcut || 10.5), { posts: [0], model: 'therm', tau: 30, lim: 1.3, what: 'from the battery' })], fail: [] }));
lim('invgrid', () => ({ rules: [VP([0, 1], 600, { dir: 1, tf: 1e-3, why: (x) => `Destroyed — PV voltage ${fmtShort(x, 'V')} above the inverter's 600 V maximum` }), VR([2, 3], 300, { tau: 10, lim: 1.2, inst: 1.6, what: 'on the grid side' })], fail: [] }));

// communication: transceivers' bus and logic pins
lim('rs485', () => ({ rules: [VPIN(-8, 13, { why: (x) => `Destroyed — ${fmtShort(x, 'V')} on a pin (RS-485 bus −7 … +12 V, logic 0 … 5 V)` })], fail: [] }));
lim('can', () => ({ rules: [VPIN(-27, 40, { why: (x) => `Destroyed — ${fmtShort(x, 'V')} on a CAN pin (CANH/CANL −27 … +40 V)` })], fail: [] }));
lim('rs232', () => ({ rules: [VPIN(-30, 30, { why: (x) => `Destroyed — ${fmtShort(x, 'V')} on a pin (RS-232 inputs ±30 V)` })], fail: [] }));
lim('emifilter', () => ({ rules: [VR([0, 1], 250, { tau: 10, lim: 1.4, inst: 2.5, why: (x) => `X capacitors burst — ${fmtShort(x, 'V')} on a 250 V EMI filter` }), I(10, { posts: [0], model: 'therm', tau: 60, lim: 1.5, what: 'through the 10 A filter' })], fail: [] }));
