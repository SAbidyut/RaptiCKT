// Circuit from a photo: the drawing the phone reads off a picture of a circuit diagram (a
// textbook figure, a sketch; src/vision/), described on a grid, turned into a board circuit.
// buildFromDrawing() is pure (no network, no picture) so it can be tested on hand-written
// drawings.
//
// Grid: x to the right, y down, one unit between neighbouring junctions or parts. Every part
// runs from one grid point to another along a horizontal or vertical line; wires join grid
// points; a point where a part ends, a wire bends or wires meet is one node.
//
// A drawing: { title, parts, wires, ground, quantities, asked, notes? }
//   parts: [{ kind, text, value, from, to, polarity, control }] — kind: resistor, voltage_source,
//     current_source, dependent_voltage_source, dependent_current_source, capacitor, inductor,
//     ac_voltage_source, ac_current_source, open_switch, closed_switch, opamp; value in SI units
//     (the gain for a dependent source); from / to: grid points { x, y } (an op amp's − and +
//     inputs, with its output at `out`); polarity: the end ('from' | 'to') of a source's + or
//     arrow, else 'none'; control: what a dependent source's gain multiplies ('vx', 'ix'), as
//     named in quantities.
//   wires: [{ from, to }]; ground: [{ x, y }]
//   quantities: [{ name, kind: node_voltage | voltage_across | current_through, at, part (index
//     in parts, -1 for a node voltage), positive ('from' | 'to' | 'none') }]
//   asked: names of the quantities the problem asks for.

import { getType, GRID, slantFor, slantAlong } from '../elements/index.js';
import { CircuitDoc } from './doc.js';
import { straightClear, partsHit } from './autoroute.js';

const G = GRID;
const U = 6 * G; // one grid unit on the board: an 80-unit part with a 20-unit lead at each end

// ------------------------------------------------------------------ drawing → board
const key = (p) => p.x + ',' + p.y;
const W = (p) => [p.x * U, p.y * U];

const TYPE = { resistor: 'resistor', voltage_source: 'dcv', current_source: 'dci', capacitor: 'capacitor', inductor: 'inductor', ac_voltage_source: 'acv', ac_current_source: 'aci', open_switch: 'switch', closed_switch: 'switch', dependent_current_source: 'depsrc', dependent_voltage_source: 'depsrc', opamp: 'opamp' };
const PREFIX = { resistor: 'R', dcv: 'V', dci: 'I', capacitor: 'C', inductor: 'L', acv: 'V', aci: 'I', switch: 'S', depsrc: 'D', opamp: 'U' };

/**
 * Build a board circuit from one described circuit. Returns { doc, warnings, asked, els }:
 * warnings say what could not be rebuilt as described (a part end left open, a control that
 * names nothing …); els[i] is the board part made of c.parts[i].
 */
export function buildFromDrawing(c) {
  const doc = new CircuitDoc(c.title || 'Circuit from photo');
  doc.description = 'Read from a photo.';
  doc.bigLabels = true; // its values written big: the board shows values, not the drawing's names
  const warnings = [];
  const parts = (c.parts || []).filter((p) => p && TYPE[p.kind] && p.from && p.to && key(p.from) !== key(p.to) && (p.kind !== 'opamp' || (p.out && key(p.out) !== key(p.from) && key(p.out) !== key(p.to))));
  if (parts.length < (c.parts || []).length) warnings.push('Some parts could not be placed (both ends on one point, or an unknown kind) and were left out.');
  const count = {};
  const made = [];
  const quantities = c.quantities || [];
  // every point that must be a connection: part ends, ground, node-voltage labels
  const points = new Map();
  const mark = (p) => points.set(key(p), p);
  for (const p of parts) { mark(p.from); mark(p.to); if (p.out) mark(p.out); }
  for (const g of c.ground || []) mark(g);
  for (const q of quantities) if (q.kind === 'node_voltage' && q.at) mark(q.at);
  for (const w of c.wires || []) { mark(w.from); mark(w.to); }

  parts.forEach((p) => {
    const type = TYPE[p.kind];
    const C = getType(type);
    if (type === 'opamp') { made.push(placeOpAmp(doc, p, C, count)); return; }
    const P = W(p.from), Q = W(p.to), mx = (P[0] + Q[0]) / 2, my = (P[1] + Q[1]) / 2;
    const el = new C(mx, my);
    count[type] = (count[type] || 0) + 1;
    el.name = `${PREFIX[type]}${count[type]}`;
    const v = Number.isFinite(p.value) ? p.value : 0;
    if (type === 'resistor') el.p.r = v > 0 ? v : 1;
    else if (type === 'dcv' || type === 'dci' || type === 'acv' || type === 'aci') el.p.amp = v;
    else if (type === 'capacitor') el.p.c = v > 0 ? v : 1e-6;
    else if (type === 'inductor') el.p.l = v > 0 ? v : 1e-3;
    else if (type === 'switch') el.p.closed = p.kind === 'closed_switch';
    // the first terminal goes at: + of a voltage source, the tail of a current source's arrow
    let head = p.from;
    const isV = p.kind === 'voltage_source' || p.kind === 'ac_voltage_source' || p.kind === 'dependent_voltage_source';
    const isI = p.kind === 'current_source' || p.kind === 'ac_current_source' || p.kind === 'dependent_current_source';
    if (isV && p.polarity === 'to') head = p.to;
    if (isI) head = p.polarity === 'from' ? p.to : p.from;
    const tail = head === p.from ? p.to : p.from;
    const H = W(head), T = W(tail), horiz = P[1] === Q[1], vert = P[0] === Q[0];
    // drawn slanting: slanted on the board too, at the angle it was drawn, along the line between
    // its two points, its leads running on in line to them
    const slant = !horiz && !vert;
    if (slant && el.canSlant()) slantBetween(el, H, T);
    else el.rot = (slant ? Math.abs(T[1] - H[1]) <= Math.abs(T[0] - H[0]) : horiz) ? (H[0] < T[0] ? 0 : 2) : H[1] < T[1] ? 1 : 3;
    el.onParamChange?.();
    doc.elements.push(el);
    const [p0, p1] = el.getPosts();
    const lead = (from, post) => {
      if (from[0] === post[0] && from[1] === post[1]) return;
      doc.addWire(slant || from[0] === post[0] || from[1] === post[1] ? [from, post] : [from, [post[0], from[1]], post]);
    };
    lead(H, p0); lead(T, p1);
    made.push({ part: p, el, head, tail });
  });

  // plain wires, split at every connection point on them so each junction is explicit
  for (const w of c.wires || []) {
    if (!w.from || !w.to || key(w.from) === key(w.to)) continue;
    // (a wire drawn slanting runs straight)
    const segs = [[w.from, w.to]];
    for (const [a, b] of segs) {
      if (key(a) === key(b)) continue;
      const inside = [...points.values()].filter((p) => {
        if (key(p) === key(a) || key(p) === key(b)) return false;
        if (a.x === b.x) return p.x === a.x && p.y > Math.min(a.y, b.y) && p.y < Math.max(a.y, b.y);
        if (a.y === b.y) return p.y === a.y && p.x > Math.min(a.x, b.x) && p.x < Math.max(a.x, b.x);
        return (b.x - a.x) * (p.y - a.y) === (b.y - a.y) * (p.x - a.x) && (p.x - a.x) * (b.x - a.x) > 0 && (p.x - b.x) * (a.x - b.x) > 0;
      }).sort((p, q) => (Math.abs(p.x - a.x) + Math.abs(p.y - a.y)) - (Math.abs(q.x - a.x) + Math.abs(q.y - a.y)));
      let at = a;
      for (const p of [...inside, b]) { doc.addWire([W(at), W(p)]); at = p; }
    }
  }

  // ground: as drawn, else at the lowest-left point of the circuit (the usual reference)
  const grounds = (c.ground || []).length ? c.ground : [];
  for (const g of grounds) doc.elements.push(new (getType('ground'))(...W(g)));

  // named quantities: a node voltage that controls a dependent source gets a net label (the
  // source reads it by that name); the drawing's other names are not put on the board
  const byName = new Map();
  const controls = new Set(parts.filter((p) => p.control).map((p) => p.control));
  for (const q of quantities) {
    if (!q || !q.name) continue;
    byName.set(q.name, q);
    if (q.kind === 'node_voltage' && q.at && controls.has(q.name)) {
      const nl = new (getType('netlabel'))(0, 0);
      nl.p.name = q.name;
      const [x, y] = W(q.at);
      // its terminal on the point, the tag pointing where nothing else leaves it
      const [dx, dy, rot] = freeSide(c, parts, q.at, points);
      nl.rot = rot; nl.x = x + dx * G; nl.y = y + dy * G;
      nl.onParamChange?.();
      doc.elements.push(nl);
    }
  }
  const needGround = !grounds.length && made.some(({ part }) => part.control && byName.get(part.control)?.kind === 'node_voltage');
  if (needGround || (!grounds.length && made.length)) {
    // the bottom wire is the reference in a textbook drawing: its leftmost point
    const pts = [...points.values()];
    const maxY = Math.max(...pts.map((p) => p.y));
    const g = pts.filter((p) => p.y === maxY).sort((p, q) => p.x - q.x)[0];
    if (g) doc.elements.push(new (getType('ground'))(...W(g)));
    if (needGround) warnings.push('No ground was drawn: the bottom wire was taken as 0 V for the node voltages.');
  }

  // a side drawn straight in the photo, bent on the grid: straight again
  straightenRuns(doc);

  // dependent sources: what controls them
  for (const { part, el } of made) {
    if (el.constructor.type !== 'depsrc') continue;
    const q = byName.get(part.control);
    const isI = part.kind === 'dependent_current_source';
    el.p.gain = Number.isFinite(part.value) ? part.value : 1;
    el.p.sym = part.control || '';
    if (!q) { warnings.push(`${el.name} (${part.text}) is controlled by "${part.control}", which is not marked on the drawing: set its control in the part's settings.`); el.p.kind = isI ? 'vccs' : 'vcvs'; el.p.ctrl = ''; continue; }
    if (q.kind === 'node_voltage') { el.p.kind = isI ? 'vccs' : 'vcvs'; el.p.ctrl = `node:${q.name}`; continue; }
    const ref = made[q.part];
    if (!ref) { warnings.push(`${el.name}: the part that "${q.name}" refers to is missing.`); continue; }
    // the reference part's first terminal is its head: flip the gain when the marking runs the other way
    const posEnd = q.positive === 'to' ? ref.part.to : ref.part.from;
    const sameWay = q.kind === 'voltage_across' ? key(posEnd) === key(ref.head) : key(posEnd) === key(ref.tail);
    if (!sameWay) el.p.gain = -el.p.gain;
    if (q.kind === 'voltage_across') { el.p.kind = isI ? 'vccs' : 'vcvs'; el.p.ctrl = `v:${ref.el.name}`; } else { el.p.kind = isI ? 'cccs' : 'ccvs'; el.p.ctrl = `i:${ref.el.name}`; }
    el.onParamChange?.();
  }

  // a part end that nothing joins
  const used = new Map();
  const bump = (p) => used.set(key(p), (used.get(key(p)) || 0) + 1);
  for (const p of parts) { bump(p.from); bump(p.to); if (p.out) bump(p.out); }
  for (const w of c.wires || []) { bump(w.from); bump(w.to); }
  for (const g of grounds) bump(g);
  const loose = [];
  for (const { part, el } of made) for (const p of [part.from, part.to, ...(part.out ? [part.out] : [])]) if ((used.get(key(p)) || 0) < 2 && !wireThrough(c.wires || [], p)) loose.push(el.name);
  if (loose.length) warnings.push(`Not joined to anything at one end: ${[...new Set(loose)].join(', ')}. Check the photo and add the missing wire.`);
  // (els: the board part made of each of the drawing's parts, null where one was left out)
  return { doc, warnings, asked: c.asked || [], els: (c.parts || []).map((p) => made.find((m) => m.part === p)?.el || null) };
}

/**
 * Straighten the sides the grid bent. A side of a delta or a star, drawn as one straight line in
 * the photo (a corner, a wire, a part, a wire, a node), can come out of the grid with a kink or
 * two, as its points are rounded to rows and columns one by one. A run of straight wires and
 * parts through points nothing else touches, turning no more than 28° at each, is laid again as
 * one straight line between its two ends, its parts spread along it in order, each the way round
 * it was; a run that would then cross or touch something is left as it was.
 */
function straightenRuns(doc) {
  const k = (p) => p[0] + ',' + p[1], same = (a, b) => a[0] === b[0] && a[1] === b[1];
  const movable = doc.elements.filter((e) => e.canSlant());
  const edges = [];
  for (const w of doc.wires) if (w.pts.length === 2 && !same(w.pts[0], w.pts[1])) edges.push({ w, a: w.pts[0], b: w.pts[1] });
  for (const e of movable) { const [a, b] = e.getPosts(); edges.push({ e, a, b }); }
  const at = new Map();
  for (const ed of edges) for (const p of [ed.a, ed.b]) { if (!at.has(k(p))) at.set(k(p), []); at.get(k(p)).push(ed); }
  // points something else holds on to: other parts' terminals, the corners of bent wires
  const held = new Set();
  for (const e of doc.elements) if (!movable.includes(e)) for (const p of e.getPosts()) held.add(k(p));
  for (const w of doc.wires) if (w.pts.length !== 2) for (const p of w.pts) held.add(k(p));
  const free = (p) => !held.has(k(p)) && at.get(k(p)).length === 2;
  const dir = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  const turn = (a, b) => { const d = Math.abs(a - b) % (2 * Math.PI); return Math.min(d, 2 * Math.PI - d); };
  const MAX = (28 * Math.PI) / 180;
  const done = new Set();
  for (const first of edges) {
    if (done.has(first)) continue;
    // grow the run both ways through free points that do not turn too much
    const run = [first], pts = [first.a, first.b];
    done.add(first);
    for (const back of [false, true]) {
      for (;;) {
        const end = back ? pts[0] : pts[pts.length - 1], prev = back ? pts[1] : pts[pts.length - 2];
        if (!free(end)) break;
        const next = at.get(k(end)).find((ed) => !run.includes(ed));
        if (!next || done.has(next)) break;
        const far = same(next.a, end) ? next.b : next.a;
        if (turn(dir(prev, end), dir(end, far)) > MAX) break;
        done.add(next);
        if (back) { run.unshift(next); pts.unshift(far); } else { run.push(next); pts.push(far); }
      }
    }
    if (run.length < 2) continue;
    const A = pts[0], B = pts[pts.length - 1];
    const cross = (p) => (B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0]);
    if (pts.every((p) => Math.abs(cross(p)) < 1e-6)) continue; // straight already
    layRunStraight(doc, run, pts);
  }
}

/** Lay one run (edges along points pts, see straightenRuns) straight from its first point to its last. */
function layRunStraight(doc, run, pts) {
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  const A = pts[0], B = pts[pts.length - 1];
  const dx = (B[0] - A[0]) / G, dy = (B[1] - A[1]) / G;
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a)), n = gcd(Math.abs(dx), Math.abs(dy));
  if (!n || !Number.isInteger(dx) || !Number.isInteger(dy) || !slantAlong(dx, dy, 4)) return;
  const parts = run.map((ed, i) => (ed.e ? { e: ed.e, headFirst: same(ed.e.getPosts()[0], pts[i]) } : null)).filter(Boolean);
  if (!parts.length || parts.length * 2 > n) return;
  // as they were, to put back if the straight run runs into something
  const keep = parts.map(({ e }) => ({ e, sv: e.sv, rot: e.rot, x: e.x, y: e.y }));
  const oldWires = run.filter((ed) => ed.w).map((ed) => ed.w);
  const p = dx / n, q = dy / n, S = (s) => [A[0] + s * p * G, A[1] + s * q * G];
  let at = A;
  const chain = [];
  parts.forEach(({ e, headFirst }, i) => {
    const s0 = Math.round((i * n) / parts.length), s1 = Math.round(((i + 1) * n) / parts.length);
    const [H, T] = headFirst ? [S(s0), S(s1)] : [S(s1), S(s0)];
    slantBetween(e, H, T);
    const [h, t] = e.getPosts(), near = headFirst ? h : t, far = headFirst ? t : h;
    chain.push([at, near]);
    at = far;
  });
  chain.push([at, B]);
  doc.wires = doc.wires.filter((w) => !oldWires.includes(w));
  const added = chain.filter(([a, b]) => !same(a, b)).map(([a, b]) => doc.addWire([a, b]));
  const mine = new Set(added), els = new Set(parts.map(({ e }) => e));
  const clear = added.every((w) => straightClear(doc, w.pts[0], w.pts[1], mine))
    && parts.every(({ e }) => doc.elements.every((o) => o === e || els.has(o) || !partsHit(e, o)));
  if (clear) return;
  for (const o of keep) Object.assign(o.e, { sv: o.sv, rot: o.rot, x: o.x, y: o.y });
  doc.wires = doc.wires.filter((w) => !mine.has(w)).concat(oldWires);
}

/**
 * Slant a two-terminal part to lie on the line from board point H to board point T (its first
 * terminal towards H), in the middle of it, its terminals on grid points of that line; when the
 * line has none near enough, at the nearest angle the grid allows.
 */
function slantBetween(el, H, T) {
  const n = (2 * el.localPosts()[1][0]) / G, dx = (T[0] - H[0]) / G, dy = (T[1] - H[1]) / G;
  const along = slantAlong(dx, dy, n);
  if (along) {
    const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a)), k = gcd(Math.abs(dx), Math.abs(dy));
    const p = dx / k, q = dy / k, m = Math.max(1, Math.min(Math.round(along[0] / p || along[1] / q), k - 2));
    const t = Math.floor((k - m) / 2);
    el.setSlant([p * m, q * m]);
    el.x = H[0] + (t + m / 2) * p * G; el.y = H[1] + (t + m / 2) * q * G;
    return;
  }
  el.setSlant(slantFor(Math.atan2(dy, dx), n));
  el.x = (H[0] + T[0]) / 2; el.y = (H[1] + T[1]) / 2;
  el.snapPosts();
}

/**
 * An op amp (ideal) between its − input (p.from), its + input (p.to) and its output (p.out):
 * turned to point the way it was drawn, mirrored to keep its − input where it was drawn, set
 * between its inputs' line and its output, its pins led to the three points. Returns
 * { part, el, head, tail } as for the other parts.
 */
function placeOpAmp(doc, p, C, count) {
  const el = new C(0, 0);
  count.opamp = (count.opamp || 0) + 1;
  el.name = `${PREFIX.opamp}${count.opamp}`;
  const M = W(p.from), P = W(p.to), O = W(p.out);
  // the inputs' line, level or upright, and the side the output is on
  const upright = M[0] === P[0] || Math.abs(M[0] - P[0]) < Math.abs(M[1] - P[1]);
  const mx = (M[0] + P[0]) / 2, my = (M[1] + P[1]) / 2;
  el.rot = upright ? (O[0] >= mx ? 0 : 2) : (O[1] >= my ? 1 : 3);
  // (between the inputs and the output, or two grid steps out from the inputs when they are
  // level with it)
  if (upright) { el.x = O[0] === mx ? mx + 3 * G : (mx + O[0]) / 2; el.y = my; } else { el.y = O[1] === my ? my + 3 * G : (my + O[1]) / 2; el.x = mx; }
  // the − pin on the − input's side
  const across = upright ? 1 : 0;
  for (const flip of [false, true]) {
    el.flip = flip;
    const [pm, pp] = el.getPosts();
    if (Math.sign(pm[across] - pp[across]) === Math.sign(M[across] - P[across])) break;
  }
  el.onParamChange?.();
  doc.elements.push(el);
  const [pm, pp, po] = el.getPosts();
  // each lead along the inputs' line first, then across to the pin (so the two inputs' leads
  // do not run over each other)
  const lead = (from, post) => {
    if (from[0] === post[0] || from[1] === post[1]) { doc.addWire([from, post]); return; }
    doc.addWire(upright ? [from, [post[0], from[1]], post] : [from, [from[0], post[1]], post]);
  };
  lead(M, pm); lead(P, pp);
  if (O[0] === po[0] || O[1] === po[1]) doc.addWire([O, po]);
  else doc.addWire(upright ? [O, [O[0], po[1]], po] : [O, [po[0], O[1]], po]);
  return { part: p, el, head: p.from, tail: p.to };
}

/**
 * Which way a label can stick out of point p without lying on a part or wire: [dx, dy, rot] of
 * a net label whose terminal sits on p. Up on the top row, down on the bottom row, else the
 * first free side.
 */
function freeSide(c, parts, p, points) {
  const used = new Set();
  const dir = (a, b) => (b.x > a.x ? 'r' : b.x < a.x ? 'l' : b.y > a.y ? 'd' : 'u');
  for (const s of [...parts, ...(c.wires || [])]) {
    if (!s.from || !s.to) continue;
    if (key(s.from) === key(p)) used.add(dir(p, s.to));
    else if (key(s.to) === key(p)) used.add(dir(p, s.from));
    else if (wireThrough([s], p)) { used.add(dir(s.from, s.to)); used.add(dir(s.to, s.from)); }
  }
  const ys = [...points.values()].map((q) => q.y);
  const order = p.y === Math.min(...ys) ? ['u', 'r', 'l', 'd'] : p.y === Math.max(...ys) ? ['d', 'r', 'l', 'u'] : ['u', 'r', 'l', 'd'];
  const side = order.find((d) => !used.has(d)) || 'u';
  return { r: [1, 0, 0], d: [0, 1, 1], l: [-1, 0, 2], u: [0, -1, 3] }[side];
}

/** a point lying on the middle of a wire segment counts as joined */
function wireThrough(wires, p) {
  return wires.some((w) => {
    const [a, b] = [w.from, w.to];
    if (a.x === b.x) return p.x === a.x && p.y > Math.min(a.y, b.y) && p.y < Math.max(a.y, b.y);
    if (a.y === b.y) return p.y === a.y && p.x > Math.min(a.x, b.x) && p.x < Math.max(a.x, b.x);
    return (b.x - a.x) * (p.y - a.y) === (b.y - a.y) * (p.x - a.x) && (p.x - a.x) * (b.x - a.x) > 0 && (p.x - b.x) * (a.x - b.x) > 0;
  });
}
