// Which label belongs to what: values to the parts they sit beside (by distance and unit), the
// expressions to the dependent sources, "+ vₓ −" to the voltage across a part, an arrow with its
// "i" to the current through one, a lone "vₓ" to the node it marks, and the figure's caption.

// (a coil or a capacitor in the phasor domain carries its reactance: j4 Ω, −j2.5 Ω)
const UNIT_FOR = { resistor: ['Ω', 'S', ''], unknown: ['Ω', 'S', ''], capacitor: ['F', '-jΩ'], inductor: ['H', '+jΩ'], battery: ['V', ''], switch: [], opamp: [] };
/** a value's unit as matched to parts: an imaginary ohm value is +jΩ (a coil) or −jΩ (a capacitor) */
// (a j value is an impedance: its Ω may be left off or not read)
const unitKey = (r) => (r.imag && (r.unit === 'Ω' || !r.unit) ? (r.value >= 0 ? '+jΩ' : '-jΩ') : r.unit);

/** Gap between two boxes [x0, y0, x1, y1] (0 when they overlap). */
function gap(a, b) {
  const dx = Math.max(0, a[0] - b[2], b[0] - a[2]), dy = Math.max(0, a[1] - b[3], b[1] - a[3]);
  return Math.hypot(dx, dy);
}
const boxOf = (w) => [w.x0, w.y0, w.x1, w.y1];

function unitsFor(p) {
  // (a zener is marked with its breakdown voltage; a plain diode and a transistor by no unit)
  if (p.type === 'diode') return p.zener ? ['V'] : [];
  if (p.type === 'npn' || p.type === 'pnp') return [];
  // (a FET's IDSS and pinch-off voltage, a MOSFET's threshold and k, are taken after)
  if (/jfet|mos/.test(p.type)) return [];
  if (p.type === 'source') return p.kind === 'current' ? ['A'] : ['V', ''];
  if (p.type === 'depsource') return [];
  return UNIT_FOR[p.type] || ['Ω', 'S', ''];
}

/**
 * S: structure (readStructure), words: [{ …word, read }] (read = readWord result), arrows: from
 * findText, H: text height, fig: { box }. Returns { labels: Map(part index → { text, value,
 * control }), quantities: [{ name, kind, vertex | part, positive, read }], title, notes }.
 */
export function assignLabels(S, words, arrows, H, fig) {
  const notes = [];
  const parts = S.parts.map((p, k) => ({ ...p, k })).filter((p) => p.a != null && p.b != null && p.type !== 'loose');
  // the dots of coupled coils (the dot convention): small solid round marks on their own, by a
  // coil's end — no label
  const coils = parts.filter((p) => p.type === 'inductor');
  const dots = new Map();
  if (coils.length >= 2) {
    words = words.filter((w) => {
      const bw = w.x1 - w.x0 + 1, bh = w.y1 - w.y0 + 1;
      if (w.glyphs.length !== 1 || bw > 0.85 * H || bh > 0.85 * H || Math.max(bw, bh) > 1.6 * Math.min(bw, bh) || (w.glyphs[0].area ?? bw * bh) < 0.55 * bw * bh) return true;
      let best = null, bd = 2.2 * H;
      for (const p of coils) for (const end of ['a', 'b']) {
        const V = S.vertices[p[end]], d = Math.hypot(V.x - w.cx, V.y - w.cy);
        if (d < bd) { bd = d; best = [p, end]; }
      }
      if (!best) return true;
      if (!dots.has(best[0].k)) dots.set(best[0].k, best[1]);
      return false;
    });
  }
  // the caption names the figure; what is written under it is the problem text, not labels
  // a number like 4.89 with no unit under the drawing is a caption whose "Figure" did not read
  for (const w of words) {
    if (w.read.type === 'value' && !w.read.unit && /^\d+\.\d+$/.test(w.read.text) && w.y0 > fig.box[3]) w.read = { ...w.read, type: 'caption', text: `Figure ${w.read.text}` };
  }
  const caps = words.filter((w) => w.read.type === 'caption' && w.cy > fig.box[1]).sort((a, b) => b.read.score - a.read.score);
  const cap = caps.find((w) => w.y0 > fig.box[3] - H) || caps[0];
  const title = cap ? cap.read.text : '';
  // well below the drawing is caption and problem text (a caption number reads like a value)
  const live = words.filter((w) => w.read.type && w.read.type !== 'caption' && !(cap && w.y0 > cap.y0 - 0.3 * H) && w.y0 < fig.box[3] + 2 * H);
  const labels = new Map();
  const taken = new Set();
  // ---------------------------------------------------------------- supplies
  // an open terminal with a voltage beside it (+16 V, a bare 10 V over the ring) is a supply
  // rail: the value nearest it, nearer it than to any source or battery
  const supplies = [];
  const srcs = parts.filter((p) => unitsFor(p).includes('V'));
  // (a terminal on a source's own wires is the source's end, its voltage the source's: no supply)
  const root = S.vertices.map((_, k) => k), find = (a) => { while (root[a] !== a) a = root[a] = root[root[a]]; return a; };
  for (const wv of S.wires) root[find(wv.a)] = find(wv.b);
  // (nor one on ground, or a second on one node)
  const driven = new Set([...srcs.flatMap((p) => [find(p.a), find(p.b)]), ...S.grounds.map((g) => find(g.v))]);
  for (const t of [...(S.terminals || [])].sort((a, b) => a.cy - b.cy)) {
    if (driven.has(find(t.v))) continue;
    let best = null, bd = Infinity;
    // (a voltage, or a bare number with a "V" written a little apart after it)
    const volts = (w) => w.read.type === 'value' && (w.read.unit === 'V' || (!w.read.unit && live.some((x) => /^[vV]$/.test(x.read.raw || '') && Math.abs(x.cy - w.cy) < 0.6 * H && x.x0 > w.x1 && x.x0 - w.x1 < 1.5 * H)));
    for (const w of live) {
      if (taken.has(w) || !volts(w)) continue;
      const d = gap([t.cx - t.r, t.cy - t.r, t.cx + t.r, t.cy + t.r], boxOf(w)) / H;
      // (by a bare wire end, only right beside it, where the wire runs on to: "+16 V" printed
      // over a wire running up to it)
      if (d > (t.free ? 1.4 : 2.2) || d >= bd || srcs.some((p) => gap(p.box, boxOf(w)) / H < d)) continue;
      if (t.free) {
        const dx = w.cx - t.cx, dy = w.cy - t.cy, ahead = dx * t.free[0] + dy * t.free[1], aside = Math.abs(-dx * t.free[1] + dy * t.free[0]);
        if (ahead <= 0 || aside > 0.6 * (w.x1 - w.x0) + 0.5 * H) continue;
      }
      bd = d; best = w;
    }
    if (!best) continue;
    taken.add(best);
    driven.add(find(t.v));
    supplies.push({ v: t.v, value: best.read.value, text: best.read.text });
  }
  // a transistor's "β = 50" read in two words (the β as a μ or a b, the "=" as nothing): a bare
  // number just after it on its line is its gain, no part's value
  const betas = [];
  if (parts.some((p) => p.type === 'npn' || p.type === 'pnp')) {
    for (const w of live) {
      if (w.read.type === 'beta') { betas.push({ w, value: w.read.value, text: w.read.text }); continue; }
      if (!/^[μβb]$/.test(w.read.raw || '')) continue;
      // (the "=" read as minus signs in front of it: "−50")
      const n = live.find((x) => !taken.has(x) && x.read.type === 'value' && !x.read.unit && x.read.value !== 0 && Math.abs(x.cy - w.cy) < 0.6 * H && x.x0 > w.x1 && x.x0 - w.x1 < 3 * H);
      if (n) { taken.add(n); taken.add(w); betas.push({ w: n, value: Math.abs(n.read.value), text: `β = ${Math.abs(n.read.value)}` }); }
    }
  }
  // ---------------------------------------------------------------- values
  const pairs = [];
  for (const p of parts) {
    const units = unitsFor(p);
    for (const w of live) {
      if (w.read.type !== 'value') continue;
      if (!units.includes(unitKey(w.read)) || taken.has(w)) continue;
      const d = gap(p.box, boxOf(w)) / H;
      if (d > 4.5) continue;
      // a coil's value sits beside it, level with its middle; one far along its axis is more
      // likely the mutual inductance between two coils (j3 Ω by the curved arrow)
      const along = p.type === 'inductor' ? Math.max(0, (p.axis === 'v' ? Math.abs(w.cy - (p.box[1] + p.box[3]) / 2) - (p.box[3] - p.box[1]) / 2 : Math.abs(w.cx - (p.box[0] + p.box[2]) / 2) - (p.box[2] - p.box[0]) / 2)) / H : 0;
      // a value without its unit fits less well; a value across a wire from the part less still
      pairs.push({ p, w, cost: d + 0.8 * along + (w.read.unit ? 0 : 0.6) - 0.1 * w.read.score });
    }
  }
  pairs.sort((a, b) => a.cost - b.cost);
  // (a conductance gives the resistance 1/G)
  const valueOf = (w) => {
    const r = w.read;
    return {
      text: r.text, value: r.unit === 'S' && r.value > 0 ? +(1 / r.value).toPrecision(12) : r.value,
      // phasor-domain and time-domain readings: a reactance (j4 Ω), a phasor's angle, cos 4t
      ...(r.imag ? { reactance: true } : {}), ...(r.phase != null ? { phase: r.phase } : {}), ...(r.wave ? { wave: r.wave, omega: r.omega } : {}),
    };
  };
  const owner = new Map(); // word → the part it went to
  for (const { p, w } of pairs) {
    if (labels.has(p.k) || taken.has(w)) continue;
    labels.set(p.k, valueOf(w));
    taken.add(w);
    owner.set(w, p);
  }
  // a part left without a value whose near value went to a neighbour with another value as near
  // it (a value printed between two sources, taken by the one whose own value is a little
  // further off): the neighbour takes that one
  for (const p of parts) {
    if (labels.has(p.k)) continue;
    for (const x of pairs) {
      if (x.p !== p || x.cost > 1.5 || !owner.has(x.w)) continue;
      const q = owner.get(x.w);
      const y = pairs.find((z) => z.p === q && z.cost <= 1.5 && !taken.has(z.w));
      if (!y) continue;
      labels.set(q.k, valueOf(y.w)); taken.add(y.w); owner.set(y.w, q);
      labels.set(p.k, valueOf(x.w)); owner.set(x.w, p);
      break;
    }
  }
  // a FET's IDSS (a current printed beside it, "IDSS = 8 mA"), and its pinch-off voltage printed
  // with it ("VP = −4 V", just under or beside it)
  const nearest = (box, ok, most) => {
    let best = null, bd = most;
    for (const w of live) {
      if (taken.has(w) || w.read.type !== 'value' || !ok(w.read)) continue;
      const d = gap(box, boxOf(w)) / H;
      if (d < bd) { bd = d; best = w; }
    }
    return best;
  };
  // (the value printed after a name: on its line, just right of it; the name itself may read as
  // no label at all, "VGS(Th)" as "vcstIbj")
  const named = words.filter((w) => !(cap && w.y0 > cap.y0 - 0.3 * H) && w.y0 < fig.box[3] + 2 * H);
  const after = (re, ok, near) => {
    for (const n of named) {
      if (!re.test(n.read.raw || '') || gap(near, boxOf(n)) / H > 8) continue;
      const v = live.find((w) => !taken.has(w) && w.read.type === 'value' && ok(w.read) && Math.abs(w.cy - n.cy) < 0.6 * H && w.x0 > n.x0 && w.x0 - n.x1 < 4 * H);
      if (v) return v;
    }
    return null;
  };
  for (const p of parts) {
    if (!/jfet|depnmos/.test(p.type) || labels.has(p.k)) continue;
    const id = after(/^[Il1|][oODd0][s5S][s5S]/, (r) => r.unit === 'A' && r.value > 0, p.box) || nearest(p.box, (r) => r.unit === 'A' && r.value > 0, 8);
    if (!id) continue;
    taken.add(id);
    const L = { text: `IDSS = ${id.read.text}`, value: id.read.value };
    const vp = after(/^[vV][pP]/, (r) => r.unit === 'V' && r.value !== 0, boxOf(id)) || nearest(boxOf(id), (r) => r.unit === 'V' && r.value !== 0, 2.5);
    if (vp) { L.vp = vp.read.value; L.text += `, VP = ${vp.read.text}`; taken.add(vp); }
    labels.set(p.k, L);
  }
  // an enhancement MOSFET's threshold, "VGS(Th) = 3 V", and its k: printed as "k = 0.3 × 10⁻³ A/V²",
  // or from the drain current it gives at a gate voltage, "ID(on) = 6 mA" at "VGS(on) = 8 V"
  // (the voltages printed after names beginning with V near it: the threshold is below the gate
  // voltage of its "on" point, whose name may read with or without its "on")
  const allAfter = (re, ok, near) => {
    const out = [];
    for (const n of named) {
      if (!re.test(n.read.raw || '') || gap(near, boxOf(n)) / H > 8) continue;
      const v = live.find((w) => !taken.has(w) && !out.some((o) => o.w === w) && w.read.type === 'value' && ok(w.read) && Math.abs(w.cy - n.cy) < 0.6 * H && w.x0 > n.x0 && w.x0 - n.x1 < 4 * H);
      if (v) out.push({ n, w: v });
    }
    return out;
  };
  for (const p of parts) {
    if ((p.type !== 'nmos' && p.type !== 'pmos') || labels.has(p.k)) continue;
    const vs = allAfter(/^v/, (r) => r.unit === 'V' && r.value !== 0, p.box);
    if (!vs.length) continue;
    const named0 = vs.filter((x) => !/on/.test(x.n.read.raw)), byV = [...vs].sort((a, b) => Math.abs(a.w.read.value) - Math.abs(b.w.read.value));
    const th = (named0.length === 1 ? named0[0] : byV[0]).w;
    taken.add(th);
    const vt = Math.abs(th.read.value), L = { text: `VGS(Th) = ${vt} V`, value: 0, vt };
    const kw = named.find((w) => /^k-{0,2}[0-9.]+[x×]10-?[0-9]+$/.test(w.read.raw || '') && gap(p.box, boxOf(w)) / H < 8);
    if (kw) {
      const [, a, e] = /^k-{0,2}([0-9.]+)[x×]10-?([0-9]+)$/.exec(kw.read.raw);
      L.k = +a * 10 ** -e; L.text += `, k = ${a} × 10⁻${e}`;
    } else {
      const on = vs.map((x) => x.w).filter((w) => w !== th && Math.abs(w.read.value) > vt).sort((a, b) => Math.abs(b.read.value) - Math.abs(a.read.value))[0];
      const id = on && nearest(boxOf(on), (r) => r.unit === 'A' && r.value !== 0, 2.5);
      if (on && id) {
        taken.add(on); taken.add(id);
        L.k = +(Math.abs(id.read.value) / (Math.abs(on.read.value) - vt) ** 2).toPrecision(6);
        L.text += `, ID(on) = ${+(Math.abs(id.read.value) * 1e3).toPrecision(4)} mA at ${Math.abs(on.read.value)} V`;
      }
    }
    labels.set(p.k, L);
  }
  // a transistor's β, printed beside it
  for (const { w, value, text } of betas) {
    let best = null, bd = Infinity;
    for (const p of parts) {
      if ((p.type !== 'npn' && p.type !== 'pnp') || labels.has(p.k)) continue;
      const d = gap(p.box, boxOf(w)) / H;
      if (d < bd) { bd = d; best = p; }
    }
    if (best && bd < 6) { labels.set(best.k, { text, value }); taken.add(w); }
  }
  // ---------------------------------------------------------------- dependent sources
  const deps = [];
  for (const p of parts.filter((q) => q.type === 'depsource')) {
    let best = null, bd = Infinity;
    for (const w of live) {
      if (taken.has(w) || w.read.type !== 'dep') continue;
      const d = gap(p.box, boxOf(w)) / H;
      if (d < bd && d < 5) { bd = d; best = w; }
    }
    if (best) {
      taken.add(best);
      deps.push({ p, read: best.read });
      labels.set(p.k, { text: best.read.text, value: best.read.coef, control: best.read.name });
    } else notes.push('A dependent source has no readable expression next to it: set its gain and control on the board.');
  }
  // an expression next to a circle: a dependent source drawn as a circle
  for (const p of parts.filter((q) => q.type === 'source' && !labels.has(q.k))) {
    const w = live.find((x) => !taken.has(x) && x.read.type === 'dep' && gap(p.box, boxOf(x)) / H < 3);
    if (w) {
      taken.add(w);
      S.parts[p.k].type = 'depsource';
      deps.push({ p, read: w.read });
      labels.set(p.k, { text: w.read.text, value: w.read.coef, control: w.read.name });
    }
  }
  // ---------------------------------------------------------------- marked quantities
  const quantities = [];
  const signs = live.filter((w) => w.read.type === 'sign' && !taken.has(w));
  const names = live.filter((w) => w.read.type === 'name' && !taken.has(w));
  const usedArrows = new Set();
  // (arrowheads drawn on the wires mark currents too)
  arrows = [...arrows, ...(S.marks || [])];
  for (const w of names) {
    const r = w.read;
    // a current: the arrow beside the name, and the part in the arrow's branch
    if (r.var === 'i') {
      let arrow = null, ad = Infinity;
      for (const a of arrows) {
        if (usedArrows.has(a)) continue;
        const d = gap(boxOf(w), [a.x0, a.y0, a.x1, a.y1]) / H;
        if (d < ad && d < 2.5) { ad = d; arrow = a; }
      }
      if (!arrow) continue;
      const part = branchPart(S, parts, arrow, H);
      if (!part) continue;
      usedArrows.add(arrow);
      taken.add(w);
      const A = S.vertices[part.a], B = S.vertices[part.b];
      const toB = (B.x - A.x) * arrow.dir[0] + (B.y - A.y) * arrow.dir[1] > 0;
      quantities.push({ name: r.name, kind: 'current_through', part: part.k, positive: toB ? 'to' : 'from', read: r });
      continue;
    }
    if (r.var !== 'v') continue;
    // a voltage across a part: + and − marks round the name, at the part's two ends (an op
    // amp's are its inputs)
    let best = null, bd = Infinity;
    for (const p of parts) {
      if (p.type === 'opamp' || p.out != null) continue;
      const d = gap(p.box, boxOf(w)) / H;
      if (d < bd) { bd = d; best = p; }
    }
    const plus = best && bd < 3 ? signs.filter((s) => s.read.sign === '+' && gap(best.box, boxOf(s)) / H < 3 && gap(boxOf(w), boxOf(s)) / H < 4) : [];
    const minus = best && bd < 3 ? signs.filter((s) => s.read.sign === '-' && gap(best.box, boxOf(s)) / H < 3 && gap(boxOf(w), boxOf(s)) / H < 4) : [];
    if (plus.length || minus.length) {
      const A = S.vertices[best.a], B = S.vertices[best.b];
      const s = plus.length ? plus[0] : minus[0];
      const sx = s.cx, sy = s.cy;
      const nearA = Math.hypot(sx - A.x, sy - A.y) < Math.hypot(sx - B.x, sy - B.y);
      const plusAtA = plus.length ? nearA : !nearA;
      for (const x of [...plus, ...minus]) taken.add(x);
      taken.add(w);
      quantities.push({ name: r.name, kind: 'voltage_across', part: best.k, positive: plusAtA ? 'from' : 'to', read: r });
      continue;
    }
    // a node voltage: the wire point nearest to the name
    let vtx = -1, vd = Infinity;
    const onWire = new Set();
    for (const wv of S.wires) { onWire.add(wv.a); onWire.add(wv.b); }
    for (const v of onWire) {
      const V = S.vertices[v];
      const d = Math.hypot(V.x - w.cx, V.y - w.cy);
      if (d < vd) { vd = d; vtx = v; }
    }
    if (vtx >= 0 && vd / H < 5) {
      taken.add(w);
      quantities.push({ name: r.name, kind: 'node_voltage', vertex: vtx, read: r });
    }
  }
  // a current's name beside its arrow that read as something else: a capital I is a 1 in shape
  // (I_A read as "1 A", I_B as "18": a capital B, which the reader has no class for, reads as an
  // 8 or an H)
  // (what it reads as at first sight, the likeliest characters, before they are made a label)
  const asName = (w) => [w.read.raw, w.read.chars].find((c) => /^[1I][A-Za-z0-9]{1,2}$/.test(c || ''));
  for (const a of arrows) {
    if (usedArrows.has(a)) continue;
    let best = null, bd = Infinity;
    for (const w of words) {
      if (taken.has(w) || w.read.type === 'caption' || !asName(w)) continue;
      const d = gap(boxOf(w), [a.x0, a.y0, a.x1, a.y1]) / H;
      if (d < bd && d < 2.5) { bd = d; best = w; }
    }
    const part = best && branchPart(S, parts, a, H);
    if (!part) continue;
    const name = 'I' + asName(best).slice(1).replace(/[8H]/g, 'B');
    usedArrows.add(a);
    taken.add(best);
    const A = S.vertices[part.a], B = S.vertices[part.b];
    const toB = (B.x - A.x) * a.dir[0] + (B.y - A.y) * a.dir[1] > 0;
    quantities.push({ name, kind: 'current_through', part: part.k, positive: toB ? 'to' : 'from', read: { type: 'name', name, var: 'i', sub: name.slice(1), text: name, score: best.read.score ?? -1 } });
  }
  // ---------------------------------------------------------------- what controls each dependent source
  for (const { p, read } of deps) {
    const same = quantities.filter((q) => q.name[0] === read.var);
    let q = same.find((x) => x.name === read.name);
    if (!q && same.length === 1) q = same[0];
    if (!q && same.length > 1) q = same.sort((a, b) => subDist(a.name, read.name) - subDist(b.name, read.name))[0];
    if (q) {
      // one name for both: a subscript read on only one of them wins, else the surer reading
      const sure = (r) => r.score / Math.max(1, (r.chars || r.text).length);
      const name = q.name.length !== read.name.length ? (q.name.length > read.name.length ? q.name : read.name) : sure(read) > sure(q.read) + 0.5 ? read.name : q.name;
      q.name = name;
      labels.get(p.k).control = name;
      labels.get(p.k).text = `${+read.coef.toPrecision(4)}${name}`;
    } else notes.push(`What controls the dependent source "${read.text}" is not marked on the drawing: set its control on the board.`);
  }
  // a capacitor's −j4 Ω whose thin minus did not read (j4 Ω beside a capacitor, nearer it than
  // to any coil): a capacitor is never +jX, so it is its −j4 Ω
  for (const p of parts) {
    if (p.type !== 'capacitor' || labels.has(p.k)) continue;
    let best = null, bd = 2.5;
    for (const w of live) {
      if (taken.has(w) || w.read.type !== 'value' || unitKey(w.read) !== '+jΩ') continue;
      const d = gap(p.box, boxOf(w)) / H;
      if (d >= bd || coils.some((q) => gap(q.box, boxOf(w)) / H <= d)) continue;
      bd = d; best = w;
    }
    if (!best) continue;
    taken.add(best);
    labels.set(p.k, { text: '−' + best.read.text.replace(/^[−-]/, ''), value: -Math.abs(best.read.value), reactance: true });
  }
  // coupled coils: a reactance (or an M in henries) left over between two coils is their mutual
  // inductance, the two coils nearest it; the dots say which ends are in phase
  const mutuals = [];
  if (coils.length >= 2) {
    for (const w of live) {
      if (taken.has(w) || w.read.type !== 'value' || !(unitKey(w.read) === '+jΩ' || w.read.unit === 'H')) continue;
      const near = coils.map((p) => ({ p, d: gap(p.box, boxOf(w)) / H })).sort((a, b) => a.d - b.d);
      if (near[1].d > 9) continue; // (its label is printed by the curved arrow, which may arc well out)
      taken.add(w);
      mutuals.push({ a: near[0].p.k, b: near[1].p.k, value: w.read.value, reactance: !!w.read.imag, text: w.read.text });
    }
    for (const [k, end] of dots) labels.set(k, { ...(labels.get(k) || {}), dot: end });
    if (mutuals.length && dots.size < 2) notes.push('The dots of the coupled coils could not all be seen: check their ends (each coil’s Dot setting) — they set the sign of M.');
  }
  // parts left without a value (a dot alone is no value)
  const bare = parts.filter((p) => !(labels.has(p.k) && labels.get(p.k).value != null) && p.type !== 'depsource' && p.type !== 'opamp' && p.out == null && !(p.type === 'diode' && !p.zener));
  if (bare.length) notes.push(`${bare.length} part${bare.length > 1 ? 's have' : ' has'} no readable value; a default was used — tap ${bare.length > 1 ? 'them' : 'it'} on the board to set ${bare.length > 1 ? 'their values' : 'its value'}.`);
  return { labels, quantities, title, notes, supplies, mutuals };
}

function subDist(a, b) {
  const x = a.slice(1), y = b.slice(1);
  if (x === y) return 0;
  return (x[0] === y[0] ? 0.5 : 1) + Math.abs(x.length - y.length) * 0.3;
}

/** The part in the same branch as a current arrow (parallel to it, beside or in line with it). */
function branchPart(S, parts, arrow, H) {
  const vert = arrow.dir[0] === 0;
  let best = null, bd = Infinity;
  for (const p of parts) {
    if ((p.axis === 'v') !== vert || p.type === 'opamp' || p.out != null) continue;
    const A = S.vertices[p.a], B = S.vertices[p.b];
    // across the branch: how far the arrow is from the part's line; along it: how far from its span
    const across = vert ? Math.abs(arrow.cx - (A.x + B.x) / 2) : Math.abs(arrow.cy - (A.y + B.y) / 2);
    const lo = vert ? Math.min(A.y, B.y) : Math.min(A.x, B.x), hi = vert ? Math.max(A.y, B.y) : Math.max(A.x, B.x);
    const t = vert ? arrow.cy : arrow.cx;
    const along = Math.max(0, lo - t, t - hi);
    if (across > 3 * H) continue;
    const d = across + 0.5 * along;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
