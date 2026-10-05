// Wires & cables with real-life limits. Conductor resistances follow IEC 60228,
// current ratings (Iz) IEC 60364-5-52 (reference method C, two loaded
// conductors, 30 °C ambient), corrected for insulation, material and the way
// the cable is installed. A conductor-temperature model heats the cable with
// I²R(θ) and cools it towards ambient; it is calibrated so that a cable carrying
// exactly Iz settles at its insulation's maximum operating temperature, and its
// heat capacity gives the adiabatic short-circuit limit I²t = k²S² (k ≈ 115 for
// copper/PVC). Above that the insulation smokes, then catches fire and the
// cable burns through (or the conductor melts and fuses open).
//
// The same model is used by drawn wires (each wire can be given a cable type in
// the editor), by the single-core Cable component (with length, so real
// resistance and voltage drop) and by the 2- and 4-core cables (misc.js).

import { TwoTerm, register, GRID } from './base.js';
import { fmtShort } from '../engine/units.js';

const G = GRID;

export const SIZES = [0.5, 0.75, 1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400];
// IEC 60228 maximum DC resistance at 20 °C, Ω/km
const R_CU = [36.0, 24.5, 18.1, 12.1, 7.41, 4.61, 3.08, 1.83, 1.15, 0.727, 0.524, 0.387, 0.268, 0.193, 0.153, 0.124, 0.0991, 0.0754, 0.0601, 0.0470]; // class 1/2
const R_CU5 = [39.0, 26.0, 19.5, 13.3, 7.98, 4.95, 3.30, 1.91, 1.21, 0.780, 0.554, 0.386, 0.272, 0.206, 0.161, 0.129, 0.106, 0.0801, 0.0641, 0.0486]; // class 5 (flexible)
const R_AL = [null, null, null, null, null, null, null, 3.08, 1.91, 1.20, 0.868, 0.641, 0.443, 0.320, 0.253, 0.206, 0.164, 0.125, 0.100, 0.0778]; // class 2
// Iz of copper, PVC (70 °C), reference method C, 2 loaded conductors, A (IEC 60364-5-52 B.52.4;
// 0.5–1 mm² and 400 mm² from the same S^0.625 fit the table follows)
const IZ_BASE = [9.5, 12.5, 15, 19.5, 27, 36, 46, 63, 85, 112, 138, 168, 213, 258, 299, 344, 392, 461, 530, 630];

export const MATERIALS = {
  cu: { name: 'Copper (Cu)', alpha: 0.00393, cv: 3.45e6, melt: 1083 },
  al: { name: 'Aluminium (Al)', alpha: 0.00403, cv: 2.42e6, melt: 660 },
};
// tmax: max. operating temperature, tsc: short-circuit limit (insulation starts to melt and
// smoke above it), tfire: insulation ignites (°C). f: current-rating factor relative to PVC.
export const INSULATION = {
  pvc: { name: 'PVC 70 °C', tmax: 70, tsc: 160, tfire: 250, f: 1 },
  xlpe: { name: 'XLPE 90 °C', tmax: 90, tsc: 250, tfire: 350, f: 1.27 },
  rubber: { name: 'Rubber 60 °C', tmax: 60, tsc: 200, tfire: 280, f: 0.86 },
};
export const SHAPES = {
  RE: 'RE – round, solid (class 1)',
  RM: 'RM – round, stranded (class 2)',
  SM: 'SM – sector-shaped, stranded (class 2)',
  RF: 'RF – round, flexible (class 5)',
};
export const INSTALL = {
  A1: { name: 'A1 – conduit in an insulated wall', f: 0.75 },
  B1: { name: 'B1 – conduit / trunking on a wall', f: 0.88 },
  C: { name: 'C – clipped direct on a wall', f: 1 },
  E: { name: 'E – free air / cable tray', f: 1.12 },
  D: { name: 'D – buried in the ground (duct)', f: 0.95 },
};
export const CABLE_TYPES = {
  housewire: { name: 'House wire, 1-core PVC (BYA / H07V-U, -R)', short: 'PVC', mat: 'cu', ins: 'pvc', shapes: ['RE', 'RM'], color: '#ef4444' },
  flex: { name: 'Flexible cord, PVC (H05VV-F)', short: 'Flex', mat: 'cu', ins: 'pvc', shapes: ['RF'], color: '#e5e7eb' },
  rubber: { name: 'Rubber flexible cable (H07RN-F)', short: 'Rubber', mat: 'cu', ins: 'rubber', shapes: ['RF'], color: '#374151' },
  nyy: { name: 'PVC power cable, Cu (NYY / BYM)', short: 'NYY', mat: 'cu', ins: 'pvc', shapes: ['RE', 'RM', 'SM'], color: '#111827' },
  n2xy: { name: 'XLPE power cable, Cu (N2XY)', short: 'N2XY', mat: 'cu', ins: 'xlpe', shapes: ['RE', 'RM', 'SM'], color: '#1f2937' },
  nayy: { name: 'PVC power cable, Al (NAYY)', short: 'NAYY', mat: 'al', ins: 'pvc', shapes: ['RE', 'RM', 'SM'], color: '#111827' },
  na2xy: { name: 'XLPE power cable, Al (NA2XY)', short: 'NA2XY', mat: 'al', ins: 'xlpe', shapes: ['RE', 'RM', 'SM'], color: '#1f2937' },
};
export const AMBIENT = 30; // °C

/** Default cable for wires drawn in the editor (Settings → New wires). */
export const WIRE_PRESETS = {
  ideal: null,
  'hw1': { type: 'housewire', size: 1, shape: 'RE', inst: 'B1' },
  'hw1.5': { type: 'housewire', size: 1.5, shape: 'RE', inst: 'B1' },
  'hw2.5': { type: 'housewire', size: 2.5, shape: 'RE', inst: 'B1' },
  'hw4': { type: 'housewire', size: 4, shape: 'RE', inst: 'B1' },
  'hw6': { type: 'housewire', size: 6, shape: 'RE', inst: 'B1' },
  'hw10': { type: 'housewire', size: 10, shape: 'RM', inst: 'B1' },
  'flex0.75': { type: 'flex', size: 0.75, shape: 'RF', inst: 'E' },
};

/** Fill in / repair a cable spec (also used on specs read from files). */
export function normSpec(sp) {
  if (!sp) return null;
  const type = CABLE_TYPES[sp.type] ? sp.type : 'housewire';
  const T = CABLE_TYPES[type];
  let size = +sp.size;
  if (!SIZES.includes(size)) size = 1.5;
  const shape = T.shapes.includes(sp.shape) ? sp.shape : T.shapes[size >= 25 && T.shapes.includes('RM') ? T.shapes.indexOf('RM') : 0];
  const inst = INSTALL[sp.inst] ? sp.inst : 'B1';
  return { type, size, shape, inst };
}

export function cableInfo(sp) {
  sp = normSpec(sp);
  const T = CABLE_TYPES[sp.type], k = SIZES.indexOf(sp.size);
  const mat = MATERIALS[T.mat], ins = INSULATION[T.ins];
  let r20 = sp.shape === 'RF' ? R_CU5[k] : R_CU[k];
  if (T.mat === 'al') r20 = R_AL[k] ?? R_CU[k] * 1.64;
  const iz = Math.round(IZ_BASE[k] * ins.f * INSTALL[sp.inst].f * (T.mat === 'al' ? 0.78 : 1) * 2) / 2;
  return { spec: sp, type: T, mat, ins, r20: r20 / 1000, iz, area: sp.size * 1e-6 };
}

export function cableLabel(sp) {
  if (!sp) return 'Ideal wire';
  sp = normSpec(sp);
  return `${fmtSize(sp.size)} mm² ${CABLE_TYPES[sp.type].mat === 'al' ? 'Al' : 'Cu'} ${sp.shape}`;
}
export const fmtSize = (s) => String(s);

export const STATE_TEXT = {
  ok: 'Normal',
  warm: 'Overloaded — running above its rated temperature',
  hot: 'Insulation melting — smoke!',
  fire: 'ON FIRE!',
  burnt: 'Burnt through (open circuit)',
};

/**
 * Conductor temperature of one cable (per metre, so independent of length).
 * step(i, sim) is called once per accepted timestep with the conductor current.
 */
export class CableHeat {
  constructor(spec, iz) { this.setSpec(spec, iz); this.reset(); }
  /** iz: a rating other than the table's (e.g. three loaded conductors of a 4-core cable) */
  setSpec(spec, iz) {
    this.info = cableInfo(spec);
    if (iz > 0) this.info.iz = iz;
    const { mat, ins, r20, area } = this.info;
    iz = this.info.iz;
    this.C = mat.cv * area; // J/(K·m)
    this.h = (iz * iz * r20 * (1 + mat.alpha * (ins.tmax - 20))) / (ins.tmax - AMBIENT); // W/(K·m)
  }
  reset() { this.T = AMBIENT; this.i2 = 0; this.fireT = 0; this.state = 'ok'; this.why = ''; }
  /** resistance per metre at the present temperature */
  r() { const { mat, r20 } = this.info; return r20 * (1 + mat.alpha * (Math.min(this.T, mat.melt) - 20)); }
  get irms() { return Math.sqrt(this.i2); }
  load() { return this.irms / this.info.iz; }
  /** 0 … 1 from the rated temperature to ignition */
  stress() { const { ins } = this.info; return this.state === 'burnt' ? 0 : Math.max(0, Math.min(1, (this.T - ins.tmax) / (ins.tfire - ins.tmax))); }
  step(i, s) {
    if (this.state === 'burnt') { this.i2 = 0; return false; }
    if (s.mode === 'dc') return false;
    this.i2 += (i * i - this.i2) * Math.min(1, s.dt / Math.max(0.02, s.acPeriod || 0.02));
    const { mat, ins, iz } = this.info;
    const dt = s.heatDtAt(Math.abs(i) / iz);
    // implicit in the cooling term, so long thermal-clock steps stay stable
    this.T = (this.T + (dt / this.C) * (i * i * this.r() + this.h * AMBIENT)) / (1 + (dt * this.h) / this.C);
    let st = this.T > ins.tfire ? 'fire' : this.T > ins.tsc ? 'hot' : this.T > ins.tmax + 0.5 ? 'warm' : 'ok';
    if (this.state === 'fire') st = 'fire'; // burning insulation does not go out by itself
    if (s.damageOn === false) { // damage switched off: it may overheat, never burn
      if (st === 'fire') st = 'hot';
      this.T = Math.min(this.T, ins.tfire);
    } else if (st === 'fire') this.fireT += s.heatDt();
    if (s.damageOn === false) { /* no failure */ } else if (this.T >= mat.melt) { st = 'burnt'; this.why = `Conductor melted at ${mat.melt} °C and fused open`; } else if (st === 'fire' && this.fireT > 2.5) { st = 'burnt'; this.why = 'Insulation caught fire and the cable burnt through'; }
    const changed = st !== this.state;
    this.state = st;
    return changed;
  }
  readings(len = 0) {
    const { iz, ins, mat } = this.info;
    const r = [['State', STATE_TEXT[this.state], ''], ['Current (RMS)', this.irms, 'A'], ['Current rating Iz', iz, 'A'],
      ['Load', this.load() * 100, '%'], ['Conductor temperature', this.T, '°C'],
      ['Insulation limit', `${ins.tmax} °C (smokes > ${ins.tsc} °C, ignites > ${ins.tfire} °C)`, ''], ['Conductor', `${mat.name}`, '']];
    if (len) r.push(['Resistance', this.r() * len, 'Ω']);
    else r.push(['Resistance per km', this.r() * 1000, 'Ω']);
    return r;
  }
}

// ------------------------------------------------------- cable components
const sizeOpts = SIZES.map((s) => [String(s), `${s} mm²`]);
const CABLE_PROPS = [
  { key: 'len', label: 'Length', unit: 'm', def: 10, min: 0.1, max: 1e5, log: true, knob: true },
  { key: 'type', label: 'Cable type', type: 'select', def: 'housewire', options: Object.entries(CABLE_TYPES).map(([k, v]) => [k, v.name]) },
  { key: 'size', label: 'Conductor size', type: 'select', def: '1.5', options: sizeOpts },
  { key: 'shape', label: 'Conductor (IEC 60228)', type: 'select', def: 'RE', options: Object.entries(SHAPES) },
  { key: 'inst', label: 'Installation method', type: 'select', def: 'B1', options: Object.entries(INSTALL).map(([k, v]) => [k, v.name]) },
];

function cableSpecOf(p) { return normSpec({ type: p.type, size: +p.size, shape: p.shape, inst: p.inst }); }

/** Shared heat / damage handling of the cable components. */
const CableMixin = {
  spec() { return cableSpecOf(this.p); },
  onParamChange() {
    const sp = this.spec();
    if (sp.shape !== this.p.shape) this.p.shape = sp.shape; // e.g. a flexible cord is always RF
    if (this.heat) this.heat.setSpec(sp); else this.heat = new CableHeat(sp);
  },
  cableR() { return this.damaged ? 1e9 : Math.max(1e-6, this.heat.r() * this.p.len); },
  heatStep(s, i) {
    const R0 = this.Rcur;
    if (this.heat.step(i, s) && this.heat.state === 'burnt') this.setDamage(s, this.heat.why);
    this.stress = this.heat.stress();
    this.fire = this.heat.state === 'fire';
    this.smoke = this.heat.state === 'hot' || this.fire;
    const R = this.cableR();
    if (!R0 || Math.abs(R - R0) > 0.01 * R0) { this.Rcur = R; s.dirty = true; }
  },
  cableReadings(s, v, i) {
    const r = this.heat.readings(this.p.len);
    r.splice(2, 0, ['Voltage drop', Math.abs(v), 'V'], ['Power lost in the cable', Math.abs(v * i), 'W']);
    if (this.damaged) r[0] = ['State', 'BURNT — ' + this.damaged.why, ''];
    return r;
  },
  cableLabel() { return `${fmtShort(this.p.len, 'm')} ${this.p.size}mm²`; },
};

export class Cable extends TwoTerm {
  static type = 'cable1'; static title = 'Cable (1 core, with length)'; static category = 'Power Systems';
  static prefix = 'W'; static keywords = 'cable wire conductor mm2 mm² sqmm re rm sm rf pvc xlpe copper aluminium voltage drop ampacity house wiring nyy n2xy bya';
  static props = CABLE_PROPS;
  static description = 'One conductor of a real cable: R = ρ·L/S (IEC 60228) rising with temperature, a current rating Iz from IEC 60364-5-52 for the chosen insulation and installation, and a thermal model. Above Iz it overheats; far above, the insulation smokes, catches fire and the cable burns open. Select a burnt cable and tap Replace to put in a new one.';
  constructor(x, y) { super(x, y); this.onParamChange(); }
  localBox() { return [-2 * G, -0.6 * G, 2 * G, 0.6 * G]; }
  leads() { return [[0, -2 * G, 0, -1.4 * G, 0], [1, 2 * G, 0, 1.4 * G, 0]]; }
  reset() { this.heat.reset(); this.Rcur = this.cableR(); this.setCurrent(0); this.stress = 0; this.fire = false; this.smoke = false; }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], 1 / (this.Rcur || this.cableR())); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1 / (this.Rcur || this.cableR())); }
  accept(s) {
    const i = this.voltageDiff(s) / (this.Rcur || this.cableR());
    this.setCurrent(i);
    this.heatStep(s, i);
  }
  valueLabel() { return this.cableLabel(); }
  readings(s) { const v = this.voltageDiff(s); return this.cableReadings(s, v, this.i); }
  spice(n) { return `R${this.name} ${n[0]} ${n[1]} ${this.cableR()} ; cable ${this.p.len} m ${this.p.size} mm2`; }
  draw(g) { drawCableBody(g, this, [[-1.4 * G, 0, 1.4 * G, 0, 0, 1]]); }
}
Object.assign(Cable.prototype, CableMixin);
register(Cable);


/** Sheathed cable: conductors drawn as thick lines inside an insulation sleeve. */
function drawCableBody(g, e, cores, sheath = false) {
  const T = CABLE_TYPES[e.p.type] || CABLE_TYPES.housewire;
  const burnt = !!e.damaged, st = g.running ? e.stress || 0 : 0;
  const ins = burnt ? '#4a2f20' : st > 0.02 ? `rgb(${Math.round(120 + 135 * st)},${Math.round(90 - 40 * st)},40)` : T.color;
  const w = 0.42 * G;
  if (sheath) g.box(-1.3 * G, -1.45 * G, 1.3 * G, 1.45 * G, { stroke: burnt ? '#8b5a3c' : g.body, width: g.lw * 0.7, fill: burnt ? 'rgba(74,47,32,0.6)' : g.fill, r: 0.5 * G });
  for (const [x1, y, x2, , p0, p1] of cores) {
    g.box(x1, y - w / 2, x2, y + w / 2, { fill: ins, stroke: burnt ? '#8b5a3c' : g.body, width: g.lw * 0.5, r: w / 2 });
    if (burnt) {
      g.line(x1, y, -0.25 * G, y, '#a16207', g.lw * 0.6);
      g.line(0.25 * G, y, x2, y, '#a16207', g.lw * 0.6);
    } else g.line(x1 + 2, y, x2 - 2, y, g.grad(x1, y, x2, y, g.pv(p0), g.pv(p1)), g.lw * 0.55);
  }
  if (st > 0.05 && !burnt) g.glow(0, 0, G * (1.4 + st), '255,110,30', 0.25 + 0.5 * st);
}

