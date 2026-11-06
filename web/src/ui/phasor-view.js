// "AC circuit: phasor domain" — the circuit shown the way Alexander & Sadiku draw the frequency
// domain equivalent (Fig. 10.2): sources as phasors (20∠0° V), resistors in ohms, inductors as
// jωL (j4 Ω), capacitors as 1/(jωC) (−j2.5 Ω), a mutual inductance as jωM; running, the live
// readings are node-voltage and part-current phasors. "AC circuit: time domain" is the usual view.

import { VIEW } from '../elements/base.js';
import { C, fmtPhasor, fmtRect, num, parsePhasor, sourcePhasor, sourceOmega } from '../engine/phasor.js';
import { isCoil } from '../elements/mutual.js';

const SRC_V = new Set(['dcv', 'acv', 'square', 'pulse', 'triangle', 'sawtooth', 'noise', 'sweep']);
const SRC_I = new Set(['dci', 'aci']);
const isCap = (e) => typeof e.jNow === 'function' && e.p.c > 0;
const isSource = (e) => SRC_V.has(e.constructor.type) || SRC_I.has(e.constructor.type) || e.constructor.type === 'rail';

export const isPhasorDoc = (doc) => !!doc && doc.domain === 'phasor';

/**
 * The circuit's angular frequency: that of its sine / cosine sources (the first one), else the
 * one set for the circuit (doc.omega), else 1 rad/s — a circuit drawn straight in the phasor
 * domain (j4 Ω, −j2.5 Ω) needs some ω to turn its impedances into henries and farads.
 */
export function docOmega(doc) {
  for (const e of doc?.elements || []) {
    if (!isSource(e)) continue;
    const w = sourceOmega(e.p);
    if (w > 0) return w;
  }
  return doc?.omega > 0 ? doc.omega : 1;
}

/** Every ω the circuit's sources run at (DC = 0), for superposition across frequencies. */
export function sourceOmegas(doc) {
  const out = [];
  for (const e of doc?.elements || []) {
    if (!isSource(e)) continue;
    const w = sourceOmega(e.p);
    if (w != null && !out.some((x) => Math.abs(x - w) <= 1e-9 * Math.max(1, w))) out.push(w);
  }
  return out;
}

/** A part's impedance at ω (R, jωL, 1/(jωC)), or null when it is not a plain R, L or C. */
export function impedanceOf(e, omega) {
  const t = e.constructor.type;
  if (t === 'resistor') return [Math.max(e.p.r, 1e-12), 0];
  if (isCoil(e)) return [e.p.rs > 0 ? e.p.rs : 0, omega * e.p.l];
  if (isCap(e)) return omega > 0 ? [0, -1 / (omega * e.p.c)] : [Infinity, 0];
  return null;
}

/** The label of a part in the phasor domain (the book's frequency-domain drawing). */
export function phasorLabel(e, omega) {
  const t = e.constructor.type;
  if (t === 'resistor') return e.valueLabel();
  if (isCoil(e) || isCap(e)) return fmtRect(impedanceOf(e, omega), 'Ω', 4);
  if (t === 'mutual') return `jωM = ${fmtRect([0, omega * e.p.m], 'Ω', 4)}`;
  if (t === 'coupledl') {
    const M = e.p.k * Math.sqrt(e.p.l1 * e.p.l2);
    return `${fmtRect([0, omega * e.p.l1])}, ${fmtRect([0, omega * e.p.l2])}; jωM ${fmtRect([0, omega * M])} Ω`;
  }
  if (isSource(e)) {
    const unit = SRC_I.has(t) ? 'A' : 'V', w = sourceOmega(e.p);
    if (w === 0) return `${num(+e.p.amp || 0)} ${unit}`;
    if (w == null) return e.valueLabel();
    const ph = sourcePhasor(e.p, w);
    return fmtPhasor(ph, unit, 4) + (Math.abs(w - omega) > 1e-9 * omega ? ` (ω=${num(w)})` : '');
  }
  return e.valueLabel();
}

VIEW.label = phasorLabel;

/**
 * The settings a part has in the phasor domain, typed the book's way: a source's phasor
 * ("20∠-30") and its ω, an inductor's or capacitor's impedance ("j4", "-j2.5"). Each
 * { key, label, unit, text, apply(text) → { prop: value } | string (an error) }.
 */
export function phasorFields(e, omega) {
  const t = e.constructor.type, out = [];
  if (isSource(e) && t !== 'rail' && (e.p.wave === 'sine' || e.p.wave === 'cos' || e.p.wave === 'dc')) {
    const unit = SRC_I.has(t) ? 'A' : 'V', w = sourceOmega(e.p);
    if (w > 0) {
      out.push({
        key: 'phasor', label: `Phasor (peak∠angle, cos reference)`, unit, text: fmtPhasor(sourcePhasor(e.p, w), '', 6).replace(/°/, ''),
        apply: (s) => {
          const z = parsePhasor(s);
          if (!z) return 'Type a phasor like 20∠30 (or 10<-45, 3 + j4)';
          return { wave: 'cos', amp: C.abs(z), phase: +C.arg(z).toFixed(6) };
        },
      });
    }
    out.push({
      key: 'omega', label: 'ω (angular frequency)', unit: 'rad/s', text: num(w > 0 ? w : 0, 6),
      apply: (s) => {
        const v = parseFloat(String(s).replace(',', '.'));
        if (!(v >= 0)) return 'Type ω in rad/s (0 for DC)';
        if (v === 0) return { wave: 'dc', amp: w > 0 ? C.abs(sourcePhasor(e.p, w)) : e.p.amp };
        return { wave: e.p.wave === 'dc' ? 'cos' : e.p.wave, freq: v / (2 * Math.PI), ...(e.p.wave === 'dc' ? { phase: 0 } : {}) };
      },
    });
  }
  if (isCoil(e) || isCap(e)) {
    const z = impedanceOf(e, omega);
    out.push({
      key: 'z', label: `Impedance at ω = ${num(omega)} rad/s`, unit: 'Ω', text: fmtRect(z, '', 6),
      apply: (s) => {
        const v = parsePhasor(s);
        if (!v) return isCoil(e) ? 'Type the impedance like j4' : 'Type the impedance like -j2.5';
        if (isCoil(e)) {
          if (!(v[1] > 0)) return 'An inductor\'s impedance is +jX (X > 0), e.g. j4';
          return { l: v[1] / omega, ...(v[0] > 0 ? { rs: v[0] } : {}) };
        }
        if (!(v[1] < 0)) return 'A capacitor\'s impedance is −jX (X > 0), e.g. -j2.5';
        return { c: -1 / (omega * v[1]) };
      },
    });
  }
  if (t === 'mutual') {
    out.push({
      key: 'zm', label: `jωM at ω = ${num(omega)} rad/s`, unit: 'Ω', text: fmtRect([0, omega * e.p.m], '', 6),
      apply: (s) => { const v = parsePhasor(s); return v && v[1] > 0 ? { m: v[1] / omega } : 'Type jωM like j2'; },
    });
  }
  return out;
}

/** Phasor readings of a part for the properties sheet: [label, text]. */
export function phasorReadings(e, sol) {
  if (!sol || !e.nodes || e.nodes.length < 2) return [];
  const out = [], V = sol.voltage(e), I = sol.current(e);
  const iu = 'A';
  if (Number.isFinite(V[0])) out.push(['V (phasor)', fmtPhasor(V, 'V')]);
  if (Number.isFinite(I[0])) out.push([`I (phasor, terminal 1 → 2)`, fmtPhasor(I, iu)]);
  if (sol.omega > 0 && Number.isFinite(I[0]) && Number.isFinite(V[0])) {
    const S = C.scale(C.mul(V, C.conj(I)), 0.5); // peak phasors: S = ½VI*
    if (C.abs(S) > 1e-15) out.push(['S = ½VI*', fmtRect(S, 'VA', 4)]);
  }
  return out;
}
