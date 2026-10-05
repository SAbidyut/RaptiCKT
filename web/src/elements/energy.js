// Energy storage and renewables:
//  - more battery chemistries (LiFePO4, NiCd, AGM, Gel) and a configurable
//    series/parallel pack
//  - battery protection board (BMS) with back-to-back MOSFETs
//  - CC-CV charger (pre-charge, constant current, constant voltage,
//    termination and recharge)
//  - PV array (series/parallel modules, irradiance and temperature)
//  - MPPT (perturb & observe) and PWM solar charge controllers with
//    low-voltage load disconnect
//  - off-grid (battery) inverter and grid-tie inverter (MPPT, grid sync,
//    anti-islanding)
//  - small wind turbine (Cp(λ) aerodynamics + rectified PM generator)
//  - PEM fuel cell stack (polarisation curve)

import { Element, register, GRID } from './base.js';
import { withChip } from './kit.js';
import { Battery, CHEM, battery, interp, PVModule, socOCV, socStep } from './sources2.js';
import { Junction, diodeIV } from './semis.js';
import { VT } from '../engine/sim.js';
import { fmtQty, fmtShort } from '../engine/units.js';

const G = GRID;
const TAU = 2 * Math.PI;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smin = (a, b, w) => { const d = a - b, r = Math.sqrt(d * d + w * w); return { y: (a + b - r) / 2, da: (1 - d / r) / 2, db: (1 + d / r) / 2 }; };
const smax = (a, b, w) => { const m = smin(-a, -b, w); return { y: -m.y, da: m.da, db: m.db }; };
/** one-directional conductance: i = s·ln(1 + e^(v/s)) / r, smooth ideal diode + resistor */
function soft(v, r, s = 0.02) {
  const x = v / s, sp = x > 30 ? x : x < -30 ? Math.exp(x) : Math.log1p(Math.exp(x)), sg = 1 / (1 + Math.exp(-clamp(x, -60, 60)));
  return { i: (s * sp) / r, g: sg / r };
}

// --------------------------------------------------------- batteries
CHEM.lifepo4 = [[0, 2.5], [0.03, 2.9], [0.08, 3.15], [0.15, 3.22], [0.3, 3.26], [0.5, 3.29], [0.7, 3.31], [0.9, 3.34], [0.97, 3.4], [1, 3.55]];
CHEM.nicd = [[0, 1.0], [0.1, 1.17], [0.2, 1.21], [0.5, 1.24], [0.8, 1.27], [0.9, 1.3], [1, 1.37]];

const NOM = { lifepo4: 3.2, lifepo12: 12.8, nicd: 1.2, agm: 12, gel: 12 };
for (const [type, title, chem, cells, soc, ah, r, kw, desc] of [
  ['lifepo4', 'LiFePO₄ Cell 3.2 V', 'lifepo4', 1, 80, 6, 0.008, 'lifepo4 lfp lithium iron phosphate cell 3.2v 32650 prismatic',
    'Lithium-iron-phosphate cell: very flat 3.2–3.3 V plateau over most of the charge (hard to judge SoC from voltage), 3.6 V when full, 2.5 V empty. Safe chemistry with a long cycle life.'],
  ['lifepo12', 'LiFePO₄ Battery 12.8 V (4S)', 'lifepo4', 4, 80, 100, 0.01, 'lifepo4 12v 12.8v 100ah solar battery lithium iron phosphate 4s',
    'Four LiFePO₄ cells in series (12.8 V nominal, 14.4 V charged): the drop-in replacement for a 12 V lead-acid battery in solar systems.'],
  ['nicd', 'NiCd Cell 1.2 V', 'nicd', 1, 100, 1.0, 0.02, 'nicd nickel cadmium rechargeable cell 1.2v power tool emergency light',
    'Nickel-cadmium cell: 1.2 V nominal, very low internal resistance and robust — used in emergency lights and power tools.'],
  ['agm', 'AGM Battery 12 V', 'leadacid', 6, 90, 100, 0.004, 'agm absorbed glass mat vrla sealed lead acid 12v deep cycle ups solar',
    'Absorbed-glass-mat (VRLA) lead-acid battery: sealed, very low internal resistance (high surge current) — UPS and solar banks. Charge at 14.4 V absorption / 13.6 V float.'],
  ['gel', 'Gel Battery 12 V', 'leadacid', 6, 90, 100, 0.01, 'gel battery sealed lead acid 12v deep cycle solar vrla',
    'Gel-electrolyte lead-acid battery: deep-cycle, tolerant of heat, with a higher internal resistance than AGM. Charge at 14.1 V absorption / 13.5 V float.'],
]) { const C = battery(type, title, chem, cells, soc, ah, r, kw, desc); C.nominal = NOM[type]; }

const PACK_CHEM = { liion: 'Li-ion (3.7 V)', lifepo4: 'LiFePO₄ (3.2 V)', nimh: 'NiMH (1.2 V)', nicd: 'NiCd (1.2 V)', leadacid: 'Lead-acid (2 V/cell)' };
export class BatteryPack extends Battery {
  static type = 'batpack'; static title = 'Battery Pack (configurable S/P)';
  static keywords = 'battery pack series parallel 4s 10s ev e-bike power bank configurable cells';
  static props = [
    { key: 'soc', label: 'State of charge', unit: '%', def: 80, min: 0, max: 100, knob: true },
    { key: 'chem', label: 'Chemistry', type: 'select', def: 'liion', options: Object.entries(PACK_CHEM) },
    { key: 's', label: 'Cells in series (S)', unit: '', def: 4, min: 1, max: 200 },
    { key: 'np', label: 'Cells in parallel (P)', unit: '', def: 2, min: 1, max: 100 },
    { key: 'cah', label: 'Cell capacity', unit: 'Ah', def: 2.5, min: 1e-3, max: 1000, log: true },
    { key: 'cr', label: 'Cell internal resistance', unit: 'Ω', def: 0.04, min: 1e-4, max: 100, log: true },
  ];
  static description = 'Battery pack of S cells in series and P in parallel: voltage = S × cell voltage (state-of-charge curve of the chosen chemistry), capacity = P × cell capacity, internal resistance = S/P × cell resistance. E.g. 13S4P Li-ion = 48 V e-bike pack.';
  S() { return Math.max(1, Math.round(this.p.s)); }
  P() { return Math.max(1, Math.round(this.p.np)); }
  rint() { return (this.S() * this.p.cr) / this.P(); }
  cap() { return this.P() * this.p.cah; }
  ocv(q = this.q ?? this.p.soc / 100) { return this.S() * socOCV(CHEM[this.p.chem] || CHEM.liion, q); }
  stamp(s) { const k = this.branches[0], [a, b] = this.nodes; s.addBranchKCL(a, b, k); s.addA(k, a - 1, 1); s.addA(k, b - 1, -1); s.addA(k, k, -this.rint()); }
  stampAC(ac) { const k = this.branches[0], [a, b] = this.nodes; ac.addBranchKCL(a, b, k); ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1); ac.addA(k, k, -this.rint()); }
  accept(s) {
    const i = s.x[this.branches[0]];
    this.setCurrent(i);
    if (s.mode !== 'dc') this.q = socStep(this.q, (i * s.dt) / (3600 * this.cap()));
  }
  valueLabel() { return `${this.S()}S${this.P()}P ${fmtShort(this.ocv(this.p.soc / 100), 'V')}`; }
  readings(s) { return [...super.readings(s), ['Capacity', this.cap(), 'Ah'], ['Internal resistance', this.rint(), 'Ω'], ['Energy stored', this.ocv() * this.cap() * Math.max(0, this.q ?? 0), 'Wh']]; }
  spice(n) { return `V${this.name} ${n[0]} ${n[1]} DC ${this.ocv()} Rser=${this.rint()}`; }
}
register(BatteryPack);

// ------------------------------------------------------------------ BMS
export class BMS extends withChip(Element) {
  static type = 'bms'; static title = 'Battery Protection Board (BMS)'; static category = 'Batteries';
  static prefix = 'U'; static keywords = 'bms battery management protection board dw01 8205 pcm over charge over discharge over current li-ion';
  static props = [
    { key: 'cells', label: 'Cells in series', unit: '', def: 1, min: 1, max: 24 },
    { key: 'vov', label: 'Over-charge cut-off (per cell)', unit: 'V', def: 4.25, min: 1, max: 5 },
    { key: 'vovr', label: 'Over-charge release', unit: 'V', def: 4.15, min: 1, max: 5 },
    { key: 'vuv', label: 'Over-discharge cut-off (per cell)', unit: 'V', def: 2.5, min: 0.5, max: 4 },
    { key: 'vuvr', label: 'Over-discharge release (charger connected)', unit: 'V', def: 3.0, min: 0.5, max: 4.5 },
    { key: 'ioc', label: 'Over-current trip', unit: 'A', def: 3, min: 0.01, max: 1000, log: true, knob: true },
    { key: 'ron', label: 'MOSFET on-resistance (each)', unit: 'Ω', def: 0.025, min: 1e-4, max: 10, log: true },
  ];
  static pins = [['B+', 'L'], ['B−', 'L'], ['P+', 'R'], ['P−', 'R']];
  static description = 'Li-ion protection board (DW01 + dual MOSFET style). B+/B− go to the cells, P+/P− to the load or charger. Two back-to-back MOSFETs in the negative lead: the discharge FET opens on over-discharge (released only when a charger is connected and the cell recovers) or over-current (released when the load is removed); the charge FET opens on over-charge. Each FET’s body diode still lets current flow the other way, so a cut-off pack can always be charged and an over-charged pack can still be discharged.';
  nonlinear = true;
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0, 0]; this.jc = new Junction(1e-9, 1.8); this.jd = new Junction(1e-9, 1.8); }
  internalNodeCount() { return 1; }
  connectivity() { return null; }
  reset() { this.cOn = true; this.dOn = true; this.why = ''; this.tOc = 0; this.idis = 0; this.jc.vd = 0; this.jd.vd = 0; this.postCurrents.fill(0); }
  g(on) { return on ? 1 / Math.max(this.p.ron, 1e-4) : 1e-9; }
  stamp(s) {
    const [bp, bm, pp, pm] = this.nodes, mid = this.inodes[0];
    s.addG(bp, pp, 1e3); // P+ is B+ (copper trace)
    s.addG(pm, mid, this.g(this.cOn)); s.addG(mid, bm, this.g(this.dOn));
    s.addG(pm, bm, 1e-5); // VM pull-down: lets over-current release when the load is removed
    s.addG(bp, bm, 3e-7); // ≈3 µA supply current
  }
  stampNL(s) {
    const [, bm, , pm] = this.nodes, mid = this.inodes[0];
    let v = this.jc.limit(s, s.v(pm) - s.v(mid)), d = diodeIV(v, 1e-9, 1.8, 0); // charge-FET body diode P− → mid
    s.addG(pm, mid, d.g); s.addI(pm, mid, d.i - d.g * v);
    v = this.jd.limit(s, s.v(bm) - s.v(mid)); d = diodeIV(v, 1e-9, 1.8, 0); // discharge-FET body diode B− → mid
    s.addG(bm, mid, d.g); s.addI(bm, mid, d.i - d.g * v);
  }
  stampAC(ac) { const [bp, bm, pp, pm] = this.nodes, mid = this.inodes[0]; ac.addY(bp, pp, 1e3); ac.addY(pm, mid, this.g(this.cOn)); ac.addY(mid, bm, this.g(this.dOn)); ac.addY(pm, bm, 1e-5); }
  accept(s) {
    const [bp, bm, pp, pm] = this.nodes, mid = this.inodes[0], v = (n) => s.v(n);
    this.jc.vd = v(pm) - v(mid); this.jd.vd = v(bm) - v(mid);
    const ich = (v(pm) - v(mid)) * this.g(this.cOn) + diodeIV(v(pm) - v(mid), 1e-9, 1.8, 0).i; // P− → mid
    const idis = (v(mid) - v(bm)) * this.g(this.dOn) - diodeIV(v(bm) - v(mid), 1e-9, 1.8, 0).i; // mid → B− (discharge > 0)
    const ipp = (v(bp) - v(pp)) * 1e3, ivm = (v(pm) - v(bm)) * 1e-5, iq = (v(bp) - v(bm)) * 3e-7;
    // into B+, B−, P+, P− (B− closes the loop)
    this.postCurrents = [ipp + iq, 0, -ipp, ich + ivm];
    this.postCurrents[1] = -(this.postCurrents[0] + this.postCurrents[2] + this.postCurrents[3]);
    this.idis = idis; this.i = idis;
    if (s.mode === 'dc') return;
    const n = Math.max(1, Math.round(this.p.cells)), vc = (v(bp) - v(bm)) / n;
    let ev = false;
    if (this.cOn && vc > this.p.vov) { this.cOn = false; this.why = 'over-charge'; ev = true; }
    else if (!this.cOn && vc < this.p.vovr) { this.cOn = true; ev = true; }
    if (this.dOn) {
      this.tOc = idis > this.p.ioc ? this.tOc + s.dt : 0;
      if (vc < this.p.vuv) { this.dOn = false; this.why = 'over-discharge'; ev = true; }
      else if (idis > 3 * this.p.ioc || this.tOc > 0.01) { this.dOn = false; this.why = idis > 3 * this.p.ioc ? 'short circuit' : 'over-current'; ev = true; }
    } else {
      const charger = v(pm) < v(bm) - 0.1;
      if (this.why === 'over-discharge' && charger && vc > this.p.vuvr) { this.dOn = true; ev = true; }
      if ((this.why === 'over-current' || this.why === 'short circuit') && v(pm) - v(bm) < 1) { this.dOn = true; ev = true; }
    }
    if (ev) { if (this.cOn && this.dOn) this.why = ''; s.markEvent(); }
  }
  valueLabel() { return this.why ? this.why.toUpperCase() : ''; }
  readings(s) {
    const n = Math.max(1, Math.round(this.p.cells));
    return [['Cell voltage', (s.v(this.nodes[0]) - s.v(this.nodes[1])) / n, 'V'], ['Discharge FET', this.dOn ? 'ON' : 'OFF', ''], ['Charge FET', this.cOn ? 'ON' : 'OFF', ''],
      ['Protection', this.why || 'normal', ''], ['Discharge current', this.idis || 0, 'A']];
  }
  draw(g) {
    this.drawChip(g, 'BMS');
    if (g.running) { const { bw, top } = this.geom(); g.circle(bw - 0.4 * G, top + 0.4 * G, 3, { fill: this.why ? '#ef4444' : '#22c55e' }); }
  }
}
register(BMS);

// ------------------------------------------------------- CC-CV charger
const CHG = {
  'Li-ion 1S (4.2 V)': { vcv: 4.2, vpre: 2.9, vrech: 4.05 },
  'LiFePO₄ 1S (3.6 V)': { vcv: 3.6, vpre: 2.5, vrech: 3.4 },
  'Li-ion 2S (8.4 V)': { vcv: 8.4, vpre: 5.8, vrech: 8.1 },
  'LiFePO₄ 4S (14.6 V)': { vcv: 14.6, vpre: 10, vrech: 13.6 },
  'Lead-acid 12 V (14.4 V)': { vcv: 14.4, vpre: 10.5, vrech: 12.8 },
};
export class CCCVCharger extends withChip(Element) {
  static type = 'cccv'; static title = 'CC-CV Battery Charger'; static category = 'Batteries';
  static prefix = 'U'; static keywords = 'cc cv charger tp4056 lithium battery charger constant current constant voltage termination precharge';
  static props = [
    { key: 'preset', label: 'Battery type', type: 'select', def: 'Li-ion 1S (4.2 V)', options: Object.keys(CHG).map((k) => [k, k]).concat([['custom', 'Custom']]), preset: CHG },
    { key: 'icc', label: 'Charge current (CC)', unit: 'A', def: 1, min: 0.001, max: 100, log: true, knob: true },
    { key: 'vcv', label: 'Charge voltage (CV)', unit: 'V', def: 4.2, min: 1, max: 100 },
    { key: 'iterm', label: 'Termination current', unit: '% of CC', def: 10, min: 1, max: 50 },
    { key: 'vpre', label: 'Pre-charge below', unit: 'V', def: 2.9, min: 0, max: 100 },
    { key: 'vrech', label: 'Recharge below', unit: 'V', def: 4.05, min: 0, max: 100 },
    { key: 'kind', label: 'Type', type: 'select', def: 'linear', options: [['linear', 'Linear (TP4056: Iin = Iout)'], ['smps', 'Switching (power balance)']] },
    { key: 'eff', label: 'Efficiency (switching)', unit: '', def: 0.9, min: 0.3, max: 1 },
  ];
  static pins = [['VIN', 'L'], ['GND', 'L'], ['BAT', 'R']];
  static description = 'Lithium/lead-acid charger IC: below the pre-charge threshold it trickles at 10 % of the set current; then constant current until the battery reaches the CV voltage; then holds that voltage while the current tapers; charging terminates when the current falls below the termination level and restarts when the battery drops below the recharge threshold. The linear type draws the same current from VIN as it delivers (TP4056); the switching type draws P/η.';
  nonlinear = true;
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0]; }
  connectivity() { return [[0, 1, 2]]; }
  reset() { this.st = 'cc'; this.iout = 0; this.iin = 0; this.vl = null; this.postCurrents.fill(0); }
  rcv() { return Math.max(1e-3, this.p.vcv * 0.002); }
  curve(vb) {
    if (this.st === 'off' || this.st === 'done') return { i: 0, g: 0 };
    if (this.st === 'pre') return { i: this.p.icc / 10, g: 0 };
    const w = 0.01 * this.p.icc, a = smin(this.p.icc, (this.p.vcv - vb) / this.rcv(), w), b = smax(a.y, 0, w);
    return { i: b.y, g: -b.da * a.db / this.rcv() };
  }
  stampNL(s) {
    const [, gnd, bat] = this.nodes;
    let vb = s.v(bat) - s.v(gnd);
    // limit the Newton step: the CV knee is a few mV wide
    const lim = Math.max(0.3, 0.05 * this.p.vcv);
    if (this.vl != null && Math.abs(vb - this.vl) > lim) { vb = this.vl + Math.sign(vb - this.vl) * lim; s.limited = true; }
    this.vl = vb;
    const c = this.curve(vb);
    s.addNLCurrent(gnd, bat, c.i, [[bat, gnd, c.g, vb]]);
  }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], 1e-5); }
  stampStep(s) { s.addI(this.nodes[0], this.nodes[1], this.iin); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1e-5); }
  accept(s) {
    const [vin, gnd, bat] = this.nodes, vi = s.v(vin) - s.v(gnd), vb = s.v(bat) - s.v(gnd);
    const io = this.curve(vb).i;
    this.iout = io; this.vl = vb;
    this.iin = io > 0 ? (this.p.kind === 'smps' ? (vb * io) / (this.p.eff * Math.max(vi, 0.5)) : io + 3e-4) : 3e-4;
    const iq = vi * 1e-5;
    this.postCurrents = [this.iin + iq, -this.iin - iq + io, -io]; this.i = this.iin;
    if (s.mode === 'dc') return;
    const headroom = this.p.kind === 'smps' ? vi > 0.5 : vi > vb + 0.15;
    let st = this.st;
    if (!headroom || vi < 3) st = 'off';
    else if (st === 'off') st = vb < this.p.vpre ? 'pre' : 'cc';
    else if (st === 'pre' && vb > this.p.vpre) st = 'cc';
    else if ((st === 'cc' || st === 'cv') && vb < this.p.vpre - 0.1) st = 'pre';
    else if (st === 'cc' && vb > this.p.vcv - 0.01) st = 'cv';
    else if (st === 'cv' && io < (this.p.iterm / 100) * this.p.icc) st = 'done';
    else if (st === 'done' && vb < this.p.vrech) st = 'cc';
    if (st !== this.st) { this.st = st; s.event = true; }
  }
  valueLabel() { return `${fmtShort(this.p.vcv, 'V')} ${fmtShort(this.p.icc, 'A')}`; }
  readings(s) {
    const name = { off: 'no input', pre: 'pre-charge (trickle)', cc: 'constant current', cv: 'constant voltage', done: 'charge complete' }[this.st];
    return [['Stage', name, ''], ['Charge current', this.iout || 0, 'A'], ['Battery voltage', s.v(this.nodes[2]) - s.v(this.nodes[1]), 'V'], ['Input current', this.iin || 0, 'A']];
  }
  draw(g) {
    this.drawChip(g, 'CHG');
    if (g.running) { const { bw, top } = this.geom(); g.circle(bw - 0.4 * G, top + 0.4 * G, 3, { fill: this.st === 'done' ? '#22c55e' : this.st === 'off' ? g.lo : '#ef4444' }); }
  }
}
register(CCCVCharger);

// ------------------------------------------------------------ PV array
export class PVArray extends PVModule {
  static type = 'pvarray'; static title = 'Solar PV Array'; static category = 'Renewables';
  static keywords = 'pv array solar array string modules series parallel photovoltaic plant rooftop';
  static props = [
    { key: 'irr', label: 'Irradiance', unit: 'W/m²', def: 1000, min: 0, max: 1500, knob: true },
    { key: 'temp', label: 'Cell temperature', unit: '°C', def: 25, min: -20, max: 90 },
    { key: 'ns', label: 'Modules in series (per string)', unit: '', def: 6, min: 1, max: 40 },
    { key: 'np', label: 'Parallel strings', unit: '', def: 1, min: 1, max: 50 },
    { key: 'isc', label: 'Module Isc @STC', unit: 'A', def: 9.8, min: 0.01, max: 30, log: true },
    { key: 'voc', label: 'Voc per cell @STC', unit: 'V', def: 0.66, min: 0.1, max: 2 },
    { key: 'cells', label: 'Cells per module', unit: '', def: 60, min: 1, max: 144 },
    { key: 'n', label: 'Ideality factor', unit: '', def: 1.3, min: 0.5, max: 3, hidden: true },
  ];
  static description = 'Array of identical PV modules (default 60-cell ≈300 W, Voc ≈40 V, Isc 9.8 A): strings of Ns modules in series, Np strings in parallel. Voc falls ≈0.33 %/°C and Isc rises 0.05 %/°C with cell temperature. The maximum power point sits near 80 % of Voc.';
  dT() { return (this.p.temp ?? 25) - 25; }
  onParamChange() {
    const N = Math.max(1, Math.round(this.p.cells)) * Math.max(1, Math.round(this.p.ns));
    this.nEff = this.p.n * N;
    const voc = this.p.voc * (1 - 0.0033 * this.dT()), isc = this.p.isc * Math.max(1, Math.round(this.p.np)) * (1 + 0.0005 * this.dT());
    this.p.is = isc / (Math.exp((voc * N) / (this.nEff * VT)) - 1);
    if (this.j) this.j.set(this.p.is, this.nEff); else this.j = new Junction(this.p.is, this.nEff);
  }
  iph() { return (this.p.isc * Math.max(1, Math.round(this.p.np)) * (1 + 0.0005 * this.dT()) * this.p.irr) / 1000; }
  valueLabel() { return `${Math.round(this.p.ns)}×${Math.round(this.p.np)} ${Math.round(this.p.irr)} W/m²`; }
  readings(s) { return [...super.readings(s), ['Open-circuit voltage (est.)', this.p.voc * (1 - 0.0033 * this.dT()) * this.p.cells * this.p.ns, 'V'], ['Rated power (STC, est.)', 0.78 * this.p.voc * this.p.cells * 0.94 * this.p.isc * this.p.ns * this.p.np, 'W']]; }
}
register(PVArray);

// --------------------------------------------- solar charge controllers
class ChargeCtl extends withChip(Element) {
  static category = 'Renewables';
  static prefix = 'U';
  static pins = [['PV', 'L'], ['GND', 'L'], ['BAT', 'R'], ['LOAD', 'R']];
  static loadProps = [
    { key: 'vabs', label: 'Absorption (charge) voltage', unit: 'V', def: 14.4, min: 1, max: 200 },
    { key: 'lvd', label: 'Load disconnect below', unit: 'V', def: 11.5, min: 0, max: 200 },
    { key: 'lvr', label: 'Load reconnect above', unit: 'V', def: 12.6, min: 0, max: 200 },
  ];
  nonlinear = true;
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0, 0]; }
  connectivity() { return [[0, 1, 2, 3]]; }
  resetLoad() { this.loadOn = true; this.tLow = 0; }
  stampLoad(s) { const [, , bat, load] = this.nodes; s.addG(bat, load, this.loadOn ? 50 : 1e-9); }
  loadLogic(s, vb) {
    if (this.loadOn) {
      this.tLow = vb < this.p.lvd ? this.tLow + s.dt : 0;
      if (this.tLow > 0.2) { this.loadOn = false; s.markEvent(); }
    } else if (vb > this.p.lvr) { this.loadOn = true; this.tLow = 0; s.markEvent(); }
  }
  iload(s) { const [, , bat, load] = this.nodes; return (s.v(bat) - s.v(load)) * (this.loadOn ? 50 : 1e-9); }
  draw(g) {
    this.drawChip(g, this.constructor.tag);
    if (g.running) { const { bw, top } = this.geom(); g.circle(bw - 0.4 * G, top + 0.4 * G, 3, { fill: this.loadOn ? '#22c55e' : '#ef4444' }); }
  }
}

export class MPPTController extends ChargeCtl {
  static type = 'mpptcc'; static title = 'MPPT Solar Charge Controller'; static tag = 'MPPT';
  static keywords = 'mppt solar charge controller perturb observe maximum power point tracking buck charger battery';
  static props = [
    ...ChargeCtl.loadProps,
    { key: 'imax', label: 'Maximum charge current', unit: 'A', def: 20, min: 0.1, max: 500, log: true, knob: true },
    { key: 'eff', label: 'Efficiency', unit: '', def: 0.96, min: 0.5, max: 1 },
    { key: 'tm', label: 'Tracking interval', unit: 's', def: 0.01, min: 1e-4, max: 1 },
    { key: 'dv', label: 'Perturbation step', unit: 'V', def: 0.3, min: 0.001, max: 20 },
  ];
  static description = 'Buck-type MPPT charge controller: it measures the panel’s open-circuit voltage, then perturbs the panel operating voltage and observes the power (P&O) to sit at the maximum power point, delivering that power (× efficiency) to the battery as current — more current than the panel itself supplies when the panel voltage is higher. When the battery reaches the absorption voltage or the current limit it moves off the MPP to limit power. LOAD output with low-voltage disconnect.';
  reset() { this.vref = 1e4; this.phase = 'scan'; this.t0 = null; this.voc = 0; this.e = 0; this.tw = 0; this.pPrev = 0; this.dir = -1; this.pin = 0; this.iout = 0; this.ipv = 0; this.mode = 'scan'; this.resetLoad(); this.postCurrents.fill(0); }
  sink(vpv) { return soft(vpv - this.vref, 0.05); }
  stampNL(s) {
    const [pv, gnd] = this.nodes, v = s.v(pv) - s.v(gnd), c = this.sink(v);
    s.addNLCurrent(pv, gnd, c.i, [[pv, gnd, c.g, v]]);
  }
  stamp(s) { this.stampLoad(s); }
  stampStep(s) { const [, gnd, bat] = this.nodes; s.addI(gnd, bat, this.iout); }
  stampAC(ac) { const [, , bat, load] = this.nodes; ac.addY(bat, load, this.loadOn ? 50 : 1e-9); }
  accept(s) {
    const [pv, gnd, bat] = this.nodes, vpv = s.v(pv) - s.v(gnd), vb = s.v(bat) - s.v(gnd), ipv = this.sink(vpv).i;
    this.ipv = ipv; this.pin = vpv * ipv;
    const il = this.iload(s);
    this.postCurrents = [ipv, -ipv + this.iout, -this.iout + il, -il];
    this.i = ipv;
    if (s.mode === 'dc') return;
    this.iout = vb > 1 ? clamp((this.p.eff * this.pin) / vb, 0, this.p.imax * 1.2) : 0;
    this.loadLogic(s, vb);
    if (this.phase === 'scan') {
      this.voc = Math.max(this.voc, vpv);
      this.t0 ??= s.t;
      if (s.t - this.t0 > 0.005) { this.phase = 'track'; this.vref = 0.8 * this.voc; }
      return;
    }
    this.e += this.pin * s.dt; this.tw += s.dt;
    if (this.tw >= this.p.tm) {
      const P = this.e / this.tw;
      if (vb > this.p.vabs || this.iout > this.p.imax) { this.vref += this.p.dv; this.mode = vb > this.p.vabs ? 'absorption' : 'current limit'; }
      else {
        if (P < this.pPrev) this.dir = -this.dir;
        this.vref += this.dir * this.p.dv; this.mode = 'MPPT';
      }
      this.voc = Math.max(this.voc, vpv);
      this.vref = clamp(this.vref, vb + 0.5, Math.max(vb + 0.5, this.voc));
      if (this.voc < vb + 0.5) this.mode = 'night / no sun';
      this.pPrev = P; this.e = 0; this.tw = 0;
    }
  }
  valueLabel() { return fmtShort(this.p.imax, 'A'); }
  readings(s) {
    return [['Mode', this.mode, ''], ['PV voltage', s.v(this.nodes[0]) - s.v(this.nodes[1]), 'V'], ['PV current', this.ipv || 0, 'A'], ['PV power', this.pin || 0, 'W'],
      ['Battery voltage', s.v(this.nodes[2]) - s.v(this.nodes[1]), 'V'], ['Charge current', this.iout || 0, 'A'], ['Load', this.loadOn ? 'ON' : 'disconnected (low battery)', '']];
  }
}
register(MPPTController);

export class PWMController extends ChargeCtl {
  static type = 'pwmcc'; static title = 'PWM Solar Charge Controller'; static tag = 'PWM CC';
  static keywords = 'pwm solar charge controller shunt series regulator battery cheap 12v';
  static props = [...ChargeCtl.loadProps];
  static description = 'Simple series (PWM) solar charge controller: a switch connects the panel straight to the battery (with reverse-current blocking at night), so the panel works at the battery voltage — not at its maximum power point. At the absorption voltage it starts pulsing the switch to hold the battery there. LOAD output with low-voltage disconnect.';
  reset() { this.chg = true; this.ich = 0; this.resetLoad(); this.postCurrents.fill(0); }
  sw(v) { return this.chg ? soft(v, 0.02) : { i: v * 1e-9, g: 1e-9 }; }
  stamp(s) { this.stampLoad(s); }
  stampNL(s) {
    const [pv, , bat] = this.nodes, v = s.v(pv) - s.v(bat), c = this.sw(v);
    s.addNLCurrent(pv, bat, c.i, [[pv, bat, c.g, v]]);
  }
  stampAC(ac) { const [, , bat, load] = this.nodes; ac.addY(bat, load, this.loadOn ? 50 : 1e-9); }
  preStep(s) {
    if (s.mode === 'dc') return;
    const vb = s.v(this.nodes[2]) - s.v(this.nodes[1]);
    const chg = this.chg ? vb < this.p.vabs : vb < this.p.vabs - 0.05;
    if (chg !== this.chg) { this.chg = chg; s.event = true; }
  }
  accept(s) {
    const [pv, gnd, bat] = this.nodes, ich = this.sw(s.v(pv) - s.v(bat)).i, il = this.iload(s);
    this.ich = ich;
    this.postCurrents = [ich, 0, -ich + il, -il]; this.i = ich;
    if (s.mode !== 'dc') this.loadLogic(s, s.v(bat) - s.v(gnd));
  }
  valueLabel() { return ''; }
  readings(s) {
    return [['Charging switch', this.chg ? 'ON' : 'off (pulsing at absorption)', ''], ['PV voltage', s.v(this.nodes[0]) - s.v(this.nodes[1]), 'V'], ['Charge current', this.ich || 0, 'A'],
      ['Battery voltage', s.v(this.nodes[2]) - s.v(this.nodes[1]), 'V'], ['Load', this.loadOn ? 'ON' : 'disconnected (low battery)', '']];
  }
}
register(PWMController);

// --------------------------------------------------------------- inverters
export class OffGridInverter extends withChip(Element) {
  static type = 'invoff'; static title = 'Off-Grid Inverter (battery → AC)'; static category = 'Renewables';
  static prefix = 'U'; static keywords = 'inverter off grid battery to ac pure sine wave ups 12v 24v 230v solar home system';
  static props = [
    { key: 'vrms', label: 'Output voltage (RMS)', unit: 'V', def: 230, min: 1, max: 1000, knob: true },
    { key: 'freq', label: 'Frequency', unit: 'Hz', def: 50, min: 1, max: 400 },
    { key: 'prated', label: 'Rated power', unit: 'W', def: 1000, min: 1, max: 1e6, log: true },
    { key: 'vcut', label: 'Low-battery cut-off', unit: 'V', def: 10.5, min: 0, max: 1000 },
    { key: 'vrec', label: 'Restart above', unit: 'V', def: 12.5, min: 0, max: 1000 },
    { key: 'eff', label: 'Efficiency', unit: '', def: 0.9, min: 0.3, max: 1 },
    { key: 'rout', label: 'Output resistance', unit: 'Ω', def: 0.5, min: 1e-3, max: 100, log: true },
  ];
  static pins = [['DC+', 'L'], ['DC−', 'L'], ['L', 'R'], ['N', 'R']];
  static description = 'Pure-sine inverter (averaged): makes isolated AC from a battery. The battery current follows the instantaneous output power ÷ efficiency (plus ≈1 % idle), so it pulses at twice the line frequency. Shuts down below the cut-off voltage and restarts above the restart voltage; trips on overload (> 150 % rated for 0.5 s) and retries after 5 s.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0, 0]; }
  connectivity() { return [[0, 1], [2, 3]]; }
  branchCount() { return 1; }
  reset() { this.on = true; this.why = ''; this.tLow = 0; this.tOff = 0; this.tOl = 0; this.vf = null; this.pavg = 0; this.iin = 0; this.pout = 0; this.postCurrents.fill(0); }
  stamp(s) {
    const [dp, dm, l, n] = this.nodes, k = this.branches[0];
    s.addBranchKCL(l, n, k); s.addA(k, l - 1, 1); s.addA(k, n - 1, -1); s.addA(k, k, -this.p.rout);
    s.addG(dp, dm, 1e-6);
  }
  stampStep(s) {
    if (s.mode !== 'dc' && this.on) s.b[this.branches[0]] += this.p.vrms * Math.SQRT2 * Math.sin(TAU * this.p.freq * s.tNext);
    s.addI(this.nodes[0], this.nodes[1], this.iin);
  }
  stampAC(ac) { const [dp, dm, l, n] = this.nodes, k = this.branches[0]; ac.addBranchKCL(l, n, k); ac.addA(k, l - 1, 1); ac.addA(k, n - 1, -1); ac.addA(k, k, -this.p.rout); ac.addY(dp, dm, 1e-6); }
  accept(s) {
    const [dp, dm, l, n] = this.nodes, k = this.branches[0], io = s.x[k], vdc = s.v(dp) - s.v(dm), vac = s.v(l) - s.v(n);
    this.pout = -vac * io;
    const p = this.pout > 0 ? this.pout / this.p.eff : this.pout * this.p.eff;
    this.iin = this.on ? (p + 0.01 * this.p.prated) / Math.max(vdc, 1) : 0;
    const ii = vdc * 1e-6;
    this.postCurrents = [this.iin + ii, -this.iin - ii, io, -io]; this.i = io;
    if (s.mode === 'dc') return;
    this.pavg += (this.pout - this.pavg) * Math.min(1, s.dt / 0.1);
    // the battery voltage ripples at 2× line frequency: judge it filtered
    this.vf = this.vf == null ? vdc : this.vf + (vdc - this.vf) * Math.min(1, s.dt / 0.02);
    if (this.on) {
      this.tLow = this.vf < this.p.vcut ? this.tLow + s.dt : 0;
      if (this.tLow > 0.05) { this.on = false; this.why = 'low battery'; this.tOff = 0; s.event = true; }
      this.tOl = this.pavg > 1.5 * this.p.prated ? this.tOl + s.dt : 0;
      if (this.tOl > 0.5) { this.on = false; this.why = 'overload'; this.tOff = 0; s.event = true; }
    } else {
      this.tOff += s.dt;
      if ((this.why === 'low battery' && this.vf > this.p.vrec) || (this.why === 'overload' && this.tOff > 5)) { this.on = true; this.why = ''; this.pavg = 0; s.event = true; }
    }
  }
  valueLabel() { return this.on !== false ? `${fmtShort(this.p.vrms, 'V')} ${fmtShort(this.p.freq, 'Hz')}` : (this.why || '').toUpperCase(); }
  readings(s) {
    return [['State', this.on ? 'running' : `off (${this.why})`, ''], ['Battery voltage', s.v(this.nodes[0]) - s.v(this.nodes[1]), 'V'], ['Battery current', this.iin || 0, 'A'],
      ['Output power (avg)', this.pavg || 0, 'W'], ['V(L–N)', s.v(this.nodes[2]) - s.v(this.nodes[3]), 'V']];
  }
  draw(g) {
    this.drawChip(g, 'INV');
    const ctx = g.ctx; ctx.beginPath();
    for (let k = 0; k <= 12; k++) { const x = -0.4 * G + (k / 12) * 0.8 * G, y = 0.3 * G - 0.22 * G * Math.sin((k / 12) * TAU); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.strokeStyle = this.on && g.running ? g.accent : g.muted; ctx.lineWidth = g.lw * 0.6; ctx.stroke();
  }
}
register(OffGridInverter);

export class GridTieInverter extends withChip(Element) {
  static type = 'invgrid'; static title = 'Grid-Tie Solar Inverter'; static category = 'Renewables';
  static prefix = 'U'; static keywords = 'grid tie inverter on grid solar inverter net metering mppt anti islanding export power';
  static props = [
    { key: 'pmax', label: 'Rated AC power', unit: 'W', def: 3000, min: 1, max: 1e7, log: true, knob: true },
    { key: 'vnom', label: 'Grid voltage (nominal)', unit: 'V', def: 230, min: 1, max: 1e5 },
    { key: 'eff', label: 'Efficiency', unit: '', def: 0.97, min: 0.5, max: 1 },
    { key: 'delay', label: 'Grid-OK delay before connecting', unit: 's', def: 0.2, min: 0, max: 300 },
    { key: 'tm', label: 'MPPT interval', unit: 's', def: 0.02, min: 1e-3, max: 1 },
    { key: 'dv', label: 'MPPT step', unit: 'V', def: 1, min: 0.01, max: 50 },
  ];
  static pins = [['PV+', 'L'], ['PV−', 'L'], ['L', 'R'], ['N', 'R']];
  static description = 'Grid-connected PV inverter (averaged): tracks the array’s maximum power point (P&O on the DC voltage) and injects that power into the grid as a sinusoidal current in phase with the grid voltage (unity power factor), synchronised from the zero crossings. Anti-islanding: it only connects after the grid has been within 85–110 % voltage and 47.5–52 Hz for the set delay, and stops immediately when the grid goes outside that window or disappears.';
  nonlinear = true;
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0, 0]; }
  connectivity() { return [[0, 1], [2, 3]]; }
  reset() {
    this.vref = 1e5; this.voc = 0; this.e = 0; this.tw = 0; this.pPrev = 0; this.dir = -1; this.pin = 0; this.pac = 0; this.iac = 0;
    this.pos = false; this.t0 = null; this.T = 0.02; this.sq = 0; this.ns = 0; this.vrms = 0; this.okT = 0; this.run = false; this.why = 'waiting for grid';
    this.postCurrents.fill(0);
  }
  sink(v) { return this.run ? soft(v - this.vref, 0.2) : { i: v * 1e-7, g: 1e-7 }; }
  stamp(s) { s.addG(this.nodes[2], this.nodes[3], 1e-6); }
  stampNL(s) { const [pp, pm] = this.nodes, v = s.v(pp) - s.v(pm), c = this.sink(v); s.addNLCurrent(pp, pm, c.i, [[pp, pm, c.g, v]]); }
  stampStep(s) {
    if (s.mode === 'dc' || !this.run || this.t0 == null) { this.iac = 0; return; }
    const irms = this.pac / Math.max(this.vrms, 1);
    this.iac = Math.SQRT2 * irms * Math.sin((TAU * (s.tNext - this.t0)) / this.T);
    s.addI(this.nodes[3], this.nodes[2], this.iac);
  }
  stampAC(ac) { ac.addY(this.nodes[2], this.nodes[3], 1e-6); }
  accept(s) {
    const [pp, pm, l, n] = this.nodes, vpv = s.v(pp) - s.v(pm), vg = s.v(l) - s.v(n), ipv = this.sink(vpv).i;
    this.pin = vpv * ipv;
    const ig = vg * 1e-6;
    this.postCurrents = [ipv, -ipv, -this.iac + ig, this.iac - ig]; this.i = ipv;
    if (s.mode === 'dc') return;
    // grid monitoring: zero crossings → period, RMS per cycle
    this.sq += vg * vg; this.ns++;
    const pos = this.pos ? vg > -5 : vg > 5;
    if (pos && !this.pos) {
      if (this.t0 != null) { this.T = clamp(s.t - this.t0, 1e-3, 1); this.vrms = Math.sqrt(this.sq / Math.max(1, this.ns)); }
      this.t0 = s.t; this.sq = 0; this.ns = 0;
    }
    this.pos = pos;
    if (this.t0 != null && s.t - this.t0 > 0.06) this.vrms = 0; // no zero crossing for 3 cycles: grid lost
    const f = 1 / this.T, ok = this.vrms > 0.85 * this.p.vnom && this.vrms < 1.1 * this.p.vnom && f > 47.5 && f < 52;
    if (!ok) {
      if (this.run) { this.run = false; s.event = true; }
      this.why = this.vrms < 1 ? 'grid lost (anti-islanding)' : 'grid out of range'; this.okT = 0; this.pac = 0; this.vref = 1e5;
      this.voc = Math.max(this.voc * 0.999, vpv);
      return;
    }
    this.okT += s.dt;
    if (!this.run) {
      this.voc = Math.max(this.voc, vpv);
      if (this.okT >= this.p.delay) { this.run = true; this.why = ''; this.vref = 0.8 * this.voc; this.dir = -1; s.event = true; }
      return;
    }
    this.pac += (Math.min(this.p.pmax, this.p.eff * this.pin) - this.pac) * Math.min(1, s.dt / 0.01);
    this.e += this.pin * s.dt; this.tw += s.dt;
    if (this.tw >= this.p.tm) {
      const P = this.e / this.tw;
      if (this.p.eff * P > this.p.pmax) this.vref += this.p.dv;
      else { if (P < this.pPrev) this.dir = -this.dir; this.vref += this.dir * this.p.dv; }
      this.vref = clamp(this.vref, 0.3 * this.voc, this.voc);
      this.pPrev = P; this.e = 0; this.tw = 0;
    }
  }
  valueLabel() { return fmtShort(this.p.pmax, 'W'); }
  readings(s) {
    return [['State', this.run ? 'exporting' : this.why, ''], ['PV voltage', s.v(this.nodes[0]) - s.v(this.nodes[1]), 'V'], ['PV power', this.pin || 0, 'W'],
      ['AC power exported', this.run ? this.pac : 0, 'W'], ['Grid voltage (RMS)', this.vrms || 0, 'V'], ['Grid frequency', 1 / this.T, 'Hz']];
  }
  draw(g) {
    this.drawChip(g, 'GRID-TIE');
    if (g.running) { const { bw, top } = this.geom(); g.circle(bw - 0.4 * G, top + 0.4 * G, 3, { fill: this.run ? '#22c55e' : '#f59e0b' }); }
  }
}
register(GridTieInverter);

// --------------------------------------------------------- wind turbine
const RHO = 1.225;
function cp(l) {
  if (l <= 0.1) return 0;
  const li = 1 / (1 / l - 0.035);
  return Math.max(0, 0.5176 * (116 / li - 5) * Math.exp(-21 / li) + 0.0068 * l);
}
export class WindTurbine extends Element {
  static type = 'windgen'; static title = 'Wind Turbine Generator'; static category = 'Renewables';
  static prefix = 'WT'; static keywords = 'wind turbine generator small wind pmsg rectifier battery charging renewable tip speed ratio';
  static props = [
    { key: 'wind', label: 'Wind speed', unit: 'm/s', def: 9, min: 0, max: 35, knob: true },
    { key: 'r', label: 'Rotor radius', unit: 'm', def: 1.2, min: 0.1, max: 80 },
    { key: 'prated', label: 'Rated power', unit: 'W', def: 1500, min: 1, max: 1e7, log: true },
    { key: 'ke', label: 'Generator EMF constant (rectified)', unit: 'V·s/rad', def: 0.8, min: 1e-3, max: 1e3, log: true },
    { key: 'rg', label: 'Generator + rectifier resistance', unit: 'Ω', def: 0.5, min: 1e-4, max: 1e3, log: true },
    { key: 'j', label: 'Rotor inertia', unit: 'kg·m²', def: 0.8, min: 1e-3, max: 1e7, log: true },
    { key: 'cutout', label: 'Cut-out wind speed', unit: 'm/s', def: 25, min: 5, max: 40 },
  ];
  static description = 'Small wind turbine with a permanent-magnet generator and built-in rectifier (DC output). Aerodynamic power P = ½ρπR²v³·Cp(λ), with the power coefficient Cp peaking at ≈0.48 near tip-speed ratio λ = ωR/v ≈ 8; the generator EMF is Ke·ω and the rectifier only lets current flow out of +. Above rated power the blades stall/furl to hold the rated power; above the cut-out speed the rotor is braked. Load it with a battery to see the operating point settle.';
  nonlinear = true;
  refNode = 1;
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0]; }
  localPosts() { return [[-2 * G, 0], [2 * G, 0]]; }
  localBox() { return [-2 * G, -1.8 * G, 2 * G, 0.6 * G]; }
  leads() { return [[0, -2 * G, 0, -0.7 * G, 0], [1, 2 * G, 0, 0.7 * G, 0]]; }
  reset() { this.w = 0; this.ang = 0; this.io = 0; this.ta = 0; this.postCurrents = [0, 0]; }
  out(v) { return soft(this.p.ke * this.w - v, this.p.rg, 0.05); }
  stampNL(s) {
    const [a, b] = this.nodes, v = s.v(a) - s.v(b), c = this.out(v);
    s.addNLCurrent(b, a, c.i, [[a, b, -c.g, v]]);
  }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], 1e-7); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1e-7); }
  aero(w) {
    const v = this.p.wind, R = this.p.r;
    if (v < 0.1 || v > this.p.cutout) return -5 * w * this.p.j; // parked / braked
    const l = (w * R) / v, A = Math.PI * R * R;
    // torque coefficient with a starting torque at low λ
    const ct = Math.max(l > 0.2 ? cp(l) / l : 0, 0.04 * (1 - l / 3));
    let T = 0.5 * RHO * A * R * v * v * ct;
    if (T * w > this.p.prated) T = this.p.prated / w;
    return T;
  }
  accept(s) {
    const [a, b] = this.nodes, v = s.v(a) - s.v(b), io = this.out(v).i;
    this.io = io;
    this.postCurrents = [-io - v * 1e-7, io + v * 1e-7]; this.i = -io;
    if (s.mode === 'dc') return;
    this.ta = this.aero(this.w);
    const tg = this.p.ke * io;
    this.w = Math.max(0, this.w + ((this.ta - tg - 0.002 * this.w) / this.p.j) * s.dt);
    this.ang += this.w * s.dt;
  }
  valueLabel() { return fmtQty(this.p.wind, 'm/s'); }
  readings(s) {
    const l = this.p.wind > 0.1 ? (this.w * this.p.r) / this.p.wind : 0;
    return [['Wind', this.p.wind, 'm/s'], ['Rotor speed', (this.w * 60) / TAU, 'rpm'], ['Tip-speed ratio λ', l, ''], ['Power coefficient Cp', this.w > 0 && this.p.wind > 0.1 ? (this.ta * this.w) / (0.5 * RHO * Math.PI * this.p.r ** 2 * this.p.wind ** 3) : 0, ''],
      ['Rotor power', this.ta * this.w, 'W'], ['Electrical power', (s.v(this.nodes[0]) - s.v(this.nodes[1])) * this.io, 'W'], ['Output current', this.io, 'A']];
  }
  draw(g) {
    g.line(0, -0.25 * G, 0, 0.45 * G, g.body, g.lw * 1.2);
    g.box(-0.7 * G, -0.45 * G, 0.7 * G, 0.45 * G, { stroke: g.body, width: g.lw * 0.8, fill: g.fill, r: 4 });
    g.upright(() => g.text('G', 0, 0.5, { size: 8, color: g.text2, bold: true }));
    const hub = [0, -1.05 * G], a = this.ang || 0;
    for (let k = 0; k < 3; k++) { const t = a + (k * TAU) / 3; g.line(hub[0], hub[1], hub[0] + Math.cos(t) * 0.75 * G, hub[1] + Math.sin(t) * 0.75 * G, g.accent, g.lw * 1.4); }
    g.line(0, -1.05 * G, 0, -0.45 * G, g.body, g.lw);
    g.circle(hub[0], hub[1], 2.5, { fill: g.body });
    g.text('+', -1.45 * G, -0.5 * G, { size: 10, color: g.pos, bold: true });
  }
}
register(WindTurbine);

// ----------------------------------------------------------- fuel cell
export class FuelCell extends Element {
  static type = 'fuelcell'; static title = 'Fuel Cell Stack (PEM)'; static category = 'Renewables';
  static prefix = 'FC'; static keywords = 'fuel cell pem hydrogen stack polarisation curve activation ohmic concentration losses';
  static props = [
    { key: 'cells', label: 'Cells in series', unit: '', def: 48, min: 1, max: 1000, knob: true },
    { key: 'e0', label: 'Open-circuit voltage per cell', unit: 'V', def: 1.0, min: 0.5, max: 1.3 },
    { key: 'a', label: 'Activation (Tafel) slope', unit: 'V', def: 0.05, min: 0, max: 0.3 },
    { key: 'i0', label: 'Activation current scale', unit: 'A', def: 0.5, min: 1e-4, max: 100, log: true },
    { key: 'r', label: 'Ohmic resistance per cell', unit: 'Ω', def: 0.004, min: 0, max: 1 },
    { key: 'ilim', label: 'Limiting current', unit: 'A', def: 80, min: 0.1, max: 2000, log: true },
  ];
  static description = 'PEM fuel-cell stack: each cell gives ≈1 V open circuit, then the voltage falls with current through activation losses (logarithmic), ohmic losses (linear) and concentration losses that collapse the voltage near the limiting current — the classic polarisation curve. Hydrogen use = N·I / 2F; efficiency ≈ Vcell / 1.25 V (LHV).';
  nonlinear = true;
  refNode = 1;
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0]; }
  localPosts() { return [[-2 * G, 0], [2 * G, 0]]; }
  localBox() { return [-2 * G, -G, 2 * G, G]; }
  leads() { return [[0, -2 * G, 0, -G, 0], [1, 2 * G, 0, G, 0]]; }
  branchCount() { return 1; }
  reset() { this.io = 0; this.postCurrents = [0, 0]; }
  vcell(I) {
    const p = this.p, n = Math.max(1, Math.round(p.cells));
    if (I < 0) return { v: n * (p.e0 - p.r * I * 5), d: -n * p.r * 5 };
    const x = Math.min(I / p.ilim, 0.995), c = -0.05 * Math.log(1 - x), dc = 0.05 / (p.ilim * (1 - x));
    return { v: n * (p.e0 - p.a * Math.log1p(I / p.i0) - p.r * I - c), d: -n * (p.a / (p.i0 + I) + p.r + dc) };
  }
  stamp(s) { const [a, b] = this.nodes, k = this.branches[0]; s.addBranchKCL(a, b, k); }
  stampNL(s) {
    const [a, b] = this.nodes, k = this.branches[0];
    let I = -s.x[k];
    if (!(I >= -100)) I = 0;
    I = Math.min(I, 0.99 * this.p.ilim);
    const { v, d } = this.vcell(I);
    // v_a − v_b = V(I), I = −k  →  v_a − v_b + d·k = v − d·I
    s.addA(k, a - 1, 1); s.addA(k, b - 1, -1); s.addA(k, k, d);
    s.b[k] += v - d * I;
  }
  stampAC(ac) { const [a, b] = this.nodes, k = this.branches[0], d = this.vcell(Math.max(0, this.io)).d; ac.addBranchKCL(a, b, k); ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1); ac.addA(k, k, d); }
  accept(s) { const k = s.x[this.branches[0]]; this.io = -k; this.postCurrents = [k, -k]; this.i = k; }
  valueLabel() { return `${Math.round(this.p.cells)} cells`; }
  readings(s) {
    const n = Math.max(1, Math.round(this.p.cells)), v = s.v(this.nodes[0]) - s.v(this.nodes[1]), I = this.io || 0;
    return [['Stack voltage', v, 'V'], ['Current', I, 'A'], ['Power', v * I, 'W'], ['Cell voltage', v / n, 'V'], ['Efficiency (LHV)', clamp(v / n / 1.25, 0, 1) * 100, '%'],
      ['Hydrogen use', Math.max(0, (n * I) / (2 * 96485)) * 22.414 * 60, 'L/min']];
  }
  draw(g) {
    g.box(-G, -0.8 * G, G, 0.8 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 3 });
    for (let k = 1; k < 6; k++) g.line(-G + k * G / 3, -0.8 * G, -G + k * G / 3, 0.8 * G, g.muted, g.lw * 0.4);
    g.upright(() => g.text('H₂', 0, 0, { size: 9, color: g.accent, bold: true }));
    g.text('+', -1.4 * G, -0.55 * G, { size: 10, color: g.pos, bold: true });
  }
}
register(FuelCell);
