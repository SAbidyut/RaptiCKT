// Which label belongs to what: values to the parts they sit beside (by distance and unit), the
// expressions to the dependent sources, "+ vₓ −" to the voltage across a part, an arrow with its
// "i" to the current through one, a lone "vₓ" to the node it marks, and the figure's caption.

const UNIT_FOR = { resistor: ['Ω', ''], unknown: ['Ω', ''], capacitor: ['F'], inductor: ['H'], battery: ['V', ''] };

/** Gap between two boxes [x0, y0, x1, y1] (0 when they overlap). */
function gap(a, b) {
  const dx = Math.max(0, a[0] - b[2], b[0] - a[2]), dy = Math.max(0, a[1] - b[3], b[1] - a[3]);
  return Math.hypot(dx, dy);
}
const boxOf = (w) => [w.x0, w.y0, w.x1, w.y1];

function unitsFor(p) {
  if (p.type === 'source') return p.kind === 'current' ? ['A'] : ['V', ''];
  if (p.type === 'depsource') return [];
  return UNIT_FOR[p.type] || ['Ω', ''];
}

/**
 * S: structure (readStructure), words: [{ …word, read }] (read = readWord result), arrows: from
 * findText, H: text height, fig: { box }. Returns { labels: Map(part index → { text, value,
 * control }), quantities: [{ name, kind, vertex | part, positive, read }], title, notes }.
 */
export function assignLabels(S, words, arrows, H, fig) {
  const notes = [];
  const parts = S.parts.map((p, k) => ({ ...p, k })).filter((p) => p.a != null && p.b != null && p.type !== 'loose');
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
  // ---------------------------------------------------------------- values
  const pairs = [];
  for (const p of parts) {
    const units = unitsFor(p);
    for (const w of live) {
      if (w.read.type !== 'value') continue;
      if (!units.includes(w.read.unit)) continue;
      const d = gap(p.box, boxOf(w)) / H;
      if (d > 4.5) continue;
      // a value without its unit fits less well; a value across a wire from the part less still
      pairs.push({ p, w, cost: d + (w.read.unit ? 0 : 0.6) - 0.1 * w.read.score });
    }
  }
  pairs.sort((a, b) => a.cost - b.cost);
  for (const { p, w } of pairs) {
    if (labels.has(p.k) || taken.has(w)) continue;
    labels.set(p.k, { text: w.read.text, value: w.read.value });
    taken.add(w);
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
    // a voltage across a part: + and − marks round the name, at the part's two ends
    let best = null, bd = Infinity;
    for (const p of parts) {
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
  // parts left without a value
  const bare = parts.filter((p) => !labels.has(p.k) && p.type !== 'depsource');
  if (bare.length) notes.push(`${bare.length} part${bare.length > 1 ? 's have' : ' has'} no readable value; a default was used — tap ${bare.length > 1 ? 'them' : 'it'} on the board to set ${bare.length > 1 ? 'their values' : 'its value'}.`);
  return { labels, quantities, title, notes };
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
    if ((p.axis === 'v') !== vert) continue;
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
