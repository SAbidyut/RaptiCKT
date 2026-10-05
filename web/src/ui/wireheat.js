// Heating of the drawn wires. Each wire that has a cable type gets a conductor-
// temperature model (elements/cables.js) driven, after every simulation step,
// by the current in its wire segments (KCL on the wire tree, see WireGraph).
// Schematic wires have no resistance of their own, so they never change the
// solution — until one burns through: then it is taken out of the circuit.

import { CableHeat } from '../elements/cables.js';

export class WireHeat {
  constructor(doc, graph) {
    this.graph = graph;
    this.list = [];
    const byWire = new Map();
    graph.edges.forEach((ed, k) => {
      const w = ed.wire;
      if (!w.cable || w.burnt) return;
      if (!byWire.has(w)) byWire.set(w, []);
      byWire.get(w).push(k);
    });
    for (const [w, edges] of byWire) {
      if (!w.heat) w.heat = new CableHeat(w.cable); else w.heat.setSpec(w.cable);
      this.list.push([w, Int32Array.from(edges)]);
    }
    this.active = this.list.length > 0;
    if (this.active) graph.prepareFast(doc);
  }

  /** Reset every wire to ambient (a fresh start of the simulation). */
  static resetAll(doc) { for (const w of doc.wires) if (w.heat) w.heat.reset(); }

  /** After one accepted step: heat the wires. Returns the wires that just burnt through. */
  step(sim) {
    if (!this.active) return null;
    this.graph.fastCurrents();
    const I = this.graph.fI;
    let burnt = null;
    for (const [w, edges] of this.list) {
      if (w.burnt) continue;
      let i = 0;
      for (const k of edges) if (Math.abs(I[k]) > Math.abs(i)) i = I[k];
      if (w.heat.step(i, sim) && w.heat.state === 'burnt') (burnt ||= []).push(w);
    }
    return burnt;
  }
}
