// Electronic devices of a printed circuit drawing, found by their solid ink before the line
// drawing is thinned (thinning turns a filled triangle or a thick bar into a tangle of spurs):
// diodes — a filled triangle pointing at a bar across the wire (a zener's bar bent at its ends);
// bipolar transistors — a thick base bar, the base lead meeting it square on one side, the
// collector and emitter leaving the other side at a slant, an arrowhead on the emitter (pointing
// out of an npn, in to a pnp); and junction FETs — a thick channel bar, the drain and source
// leaving one side square near its ends, the gate's lead on the other with an arrowhead
// (pointing in for an n channel, out for a p channel). Each comes back as a region the wires
// are cut at, with the points its terminals lie at.

/** Distance from each ink pixel to the nearest paper (chamfer 1, √2), 0 on paper. */
export function inkDepth(mask, W, H) {
  const D = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) D[i] = mask[i] ? 1e9 : 0;
  const R = Math.SQRT2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!D[i]) continue;
      if (!x || !y || x === W - 1 || y === H - 1) { D[i] = 1; continue; }
      D[i] = Math.min(D[i], D[i - 1] + 1, D[i - W] + 1, D[i - W - 1] + R, D[i - W + 1] + R);
    }
  }
  for (let y = H - 2; y > 0; y--) {
    for (let x = W - 2; x > 0; x--) {
      const i = y * W + x;
      if (D[i]) D[i] = Math.min(D[i], D[i + 1] + 1, D[i + W] + 1, D[i + W + 1] + R, D[i + W - 1] + R);
    }
  }
  return D;
}

/** A 0/1 mask closed by r px: grown by r, then shrunk back (gaps up to 2r wide shut). */
function closeGaps(mask, W, H, r) {
  const paper = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) paper[i] = mask[i] ? 0 : 1;
  const toInk = inkDepth(paper, W, H);
  const grown = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) grown[i] = mask[i] || toInk[i] <= r ? 1 : 0;
  const depth = inkDepth(grown, W, H), out = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = mask[i] || depth[i] > r ? 1 : 0;
  return out;
}

/** A copy of a 0/1 mask with its holes (paper enclosed by ink, 4-way) up to maxArea px filled. */
function fillHoles(mask, W, H, maxArea) {
  const out = Uint8Array.from(mask), seen = new Uint8Array(W * H), stack = [], list = [];
  for (let i = 0; i < W * H; i++) {
    if (mask[i] || seen[i]) continue;
    let open = false;
    list.length = 0;
    seen[i] = 1; stack.push(i);
    while (stack.length) {
      const j = stack.pop(), x = j % W, y = (j - x) / W;
      list.push(j);
      if (!x || !y || x === W - 1 || y === H - 1 || list.length > maxArea) open = true;
      for (const k of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, y > 0 ? j - W : -1, y < H - 1 ? j + W : -1]) if (k >= 0 && !mask[k] && !seen[k]) { seen[k] = 1; stack.push(k); }
    }
    if (!open) for (const j of list) out[j] = 1;
  }
  return out;
}

/** Within pad·0.3 of a capsule [x0, y0, x1, y1, radius] (a segment grown by its radius)? */
function inCapsule([x0, y0, x1, y1, rr], x, y, pad) {
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / L2));
  return Math.hypot(x - x0 - t * dx, y - y0 - t * dy) <= rr + 0.3 * pad;
}

/** Connected pieces (8-way) of the pixels at least `t` deep: [{ px: [indices], max, at }]. */
function deepParts(D, W, H, t) {
  const seen = new Uint8Array(W * H), out = [], stack = [];
  for (let i = 0; i < W * H; i++) {
    if (seen[i] || D[i] < t) continue;
    const px = [];
    let max = 0, at = i;
    seen[i] = 1; stack.push(i);
    while (stack.length) {
      const j = stack.pop(), x = j % W, y = (j - x) / W;
      px.push(j);
      if (D[j] > max) { max = D[j]; at = j; }
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx, Y = y + dy, k = Y * W + X;
          if (X < 0 || Y < 0 || X >= W || Y >= H || seen[k] || D[k] < t) continue;
          seen[k] = 1; stack.push(k);
        }
      }
    }
    out.push({ px, max, at });
  }
  return out;
}

/**
 * The devices of a figure's line drawing (`art`, a W×H 0/1 mask; sw its line width):
 * [{ kind: 'diode' | 'npn' | 'pnp' | 'njfet' | 'pjfet', cx, cy, r, box, inside(x, y, pad), pins,
 * zener? }]. pins: a diode's { a (anode), k (cathode) }, a bipolar transistor's { b, c, e }, a
 * FET's { g, d, s }: [x, y] each, where its wires leave it.
 */
export function findDevices(art0, W, H, sw) {
  // (a filled triangle may print with a speck of paper inside it, or a bigger one open to the
  // outside by a crack: the ink as drawn has its small holes filled; the solid ink its cracks
  // closed and its holes filled too, for a second look at what is deep)
  const solid = fillHoles(closeGaps(art0, W, H, 0.8 * sw), W, H, 40 * sw * sw);
  const art = fillHoles(art0, W, H, 10 * sw * sw);
  const D = inkDepth(art, W, H);
  const on = (m) => (x, y) => {
    const X = Math.round(x), Y = Math.round(y);
    return X >= 0 && Y >= 0 && X < W && Y < H && m[Y * W + X] === 1;
  };
  const ink = on(art);
  // the run of ink through point p across direction u (p ± t·u): its two ends' t, or null when
  // p is on paper (f: which ink)
  const across = (px, py, ux, uy, max, f = ink) => {
    if (!f(px, py)) return null;
    let lo = 0, hi = 0;
    const st = 0.5;
    while (lo > -max && f(px + (lo - st) * ux, py + (lo - st) * uy)) lo -= st;
    while (hi < max && f(px + (hi + st) * ux, py + (hi + st) * uy)) hi += st;
    return [lo, hi];
  };
  // runs of ink met going along a line: from p, t in [t0, t1] along u → [{ t0, t1, mid }]
  const runsAlong = (px, py, ux, uy, t0, t1) => {
    const out = [];
    let cur = null;
    for (let t = t0; t <= t1; t += 0.5) {
      if (ink(px + t * ux, py + t * uy)) { if (!cur) cur = { t0: t, t1: t }; else cur.t1 = t; } else if (cur) { out.push(cur); cur = null; }
    }
    if (cur) out.push(cur);
    for (const r of out) r.mid = (r.t0 + r.t1) / 2;
    return out;
  };
  const devices = [];
  const taken = (x, y) => devices.some((d) => d.inside(x, y, 0));
  // a line followed from (x1, y1) the way (dx, dy), as long as it runs straight on (and `most` at
  // most): where it ends ({ x, y, len, dx, dy }), and the arrowhead on it, if any — its widest place: 'out' when
  // that is near the start (it points on, away from where it was followed from), else 'in'
  const follow = (x1, y1, dx, dy, most = 60 * sw) => {
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl; dy /= dl;
    let x = x1, y = y1, run = 0, ex = x1, ey = y1;
    const widths = [];
    for (let k = 0; k < 120 && run < most; k++) {
      const nxp = x + 0.5 * sw * dx, nyp = y + 0.5 * sw * dy;
      // the ink just ahead, within a line's width of the line (an arrowhead on it is ink all
      // across, and keeps it centred; where it bends into the next wire, the ink drifts to one
      // side and then ends)
      let n = 0, sum = 0;
      for (let o = -0.8 * sw; o <= 0.8 * sw + 1e-9; o += 0.2 * sw) if (ink(nxp - o * dy, nyp + o * dx)) { n++; sum += o; }
      if (!n) break;
      const off = sum / n;
      if (Math.abs(off) > 0.45 * sw) break;
      const step = Math.max(-0.15 * sw, Math.min(0.15 * sw, off));
      x = nxp - step * dy; y = nyp + step * dx;
      const w = across(x, y, -dy, dx, 3 * sw);
      widths.push({ s: run, w: w ? w[1] - w[0] : 0 });
      run += 0.5 * sw; ex = x; ey = y;
      // (re-aimed along what was followed so far)
      if (run >= 3 * sw) { const L = Math.hypot(x - x1, y - y1); dx = (x - x1) / L; dy = (y - y1) / L; }
    }
    // (where it turns into the next wire, the wire's ink lies across it too)
    while (widths.length > 4 && run - widths[widths.length - 1].s < 1.5 * sw) widths.pop();
    const ws = widths.map((q) => q.w).sort((a, b) => a - b);
    const med = ws.length ? ws[ws.length >> 1] : 0, top = ws.length ? ws[ws.length - 1] : 0;
    let arrow = null;
    if (top >= Math.max(2 * med, 1.8 * sw)) {
      const cut = (top + med) / 2, wide = widths.filter((q) => q.w >= cut);
      const s0 = wide[0].s, s1 = wide[wide.length - 1].s, at = widths.find((q) => q.w === top).s;
      arrow = at - s0 <= s1 - at ? 'out' : 'in';
    }
    return { x: ex, y: ey, len: run, dx, dy, arrow, top };
  };

  // ---------------------------------------------------------------- diodes
  // a filled triangle is far deeper than any line, a joint's dot or an arrowhead on a wire
  // (as drawn, holes filled; then what only its cracks closed make solid)
  const Ds = inkDepth(solid, W, H);
  for (const [c, DX, full] of [...deepParts(D, W, H, 1.2 * sw).map((q) => [q, D, ink]), ...deepParts(Ds, W, H, 1.2 * sw).map((q) => [q, Ds, on(solid)])]) {
    if (c.max < 1.75 * sw) continue;
    const ri = c.max;
    // its centre: the middle of its deepest pixels
    let sx = 0, sy = 0, n = 0;
    for (const j of c.px) if (DX[j] >= c.max - 0.35 * sw) { sx += j % W; sy += (j - (j % W)) / W; n++; }
    const cx = sx / n, cy = sy / n;
    if (taken(cx, cy)) continue;
    // the two wires leaving it: thin runs of ink across a ring round it, facing each other
    const R = 3.4 * ri, cuts = [];
    const N = Math.max(90, Math.round((2 * Math.PI * R) / (0.5 * sw)));
    let cur = null;
    const hit = [];
    for (let k = 0; k < N; k++) { const a = (2 * Math.PI * k) / N; hit.push(ink(cx + R * Math.cos(a), cy + R * Math.sin(a))); }
    const start = hit.indexOf(false);
    if (start < 0) continue;
    for (let s = 1; s <= N; s++) {
      const k = (start + s) % N;
      if (hit[k]) { if (!cur) cur = { k0: s, k1: s }; else cur.k1 = s; } else if (cur) { cuts.push(cur); cur = null; }
    }
    const arcs = cuts.map((q) => ({ a: (2 * Math.PI * (start + (q.k0 + q.k1) / 2)) / N, len: ((q.k1 - q.k0 + 1) * 2 * Math.PI * R) / N })).filter((q) => q.len <= 3 * sw);
    // (a wire runs on from the body out past the ring; a letter beside it does not)
    const radial = (a) => {
      const ca = Math.cos(a), sa = Math.sin(a);
      let n = 0, k = 0;
      for (let t = 1.2 * ri; t <= 5 * ri; t += 0.5, k++) if ([0, 0.35, -0.35, 0.7, -0.7].some((o) => ink(cx + t * ca - o * sw * sa, cy + t * sa + o * sw * ca))) n++;
      return n / k;
    };
    for (const q of arcs) q.on = radial(q.a);
    let pair = null, best = -0.9;
    for (let i = 0; i < arcs.length; i++) for (let j = i + 1; j < arcs.length; j++) { const cs = Math.cos(arcs[i].a - arcs[j].a); if (Math.min(arcs[i].on, arcs[j].on) >= 0.8 && cs < best) { best = cs; pair = [arcs[i], arcs[j]]; } }
    if (!pair) continue;
    let ux = Math.cos(pair[1].a) - Math.cos(pair[0].a), uy = Math.sin(pair[1].a) - Math.sin(pair[0].a);
    const ul = Math.hypot(ux, uy); ux /= ul; uy /= ul;
    // across the triangle: wide near its base, narrow near its point
    const wid = (t) => { const r = across(cx + t * ux, cy + t * uy, -uy, ux, 4 * ri, full); return r ? r[1] - r[0] : 0; };
    // (a little way off its middle: printed small or blurred, its depth overstates it)
    const wPlus = wid(0.6 * ri), wMinus = wid(-0.6 * ri);
    if (Math.max(wPlus, wMinus) < 1.5 * Math.min(wPlus, wMinus) || Math.max(wPlus, wMinus) < 2.2 * ri) continue;
    const s = wPlus < wMinus ? 1 : -1; // the way it points
    // the bar just past its point, across the wire
    let bar = null;
    for (let t = 1.4 * ri; t <= 3.0 * ri; t += 0.5) {
      const w = wid(s * t);
      if (w >= 2.2 * ri && (!bar || w > bar.w)) bar = { t, w };
    }
    if (!bar) continue;
    // a zener's bar turns at its ends, one end each way along the wire: ink beside the bar's
    // ends reaching past the bar on opposite sides
    const vx = -uy, vy = ux, bx = cx + s * bar.t * ux, by = cy + s * bar.t * uy;
    // (the bar's own thickness taken off the wire, which runs on through its middle)
    const mid = across(bx + 0.25 * bar.w * vx, by + 0.25 * bar.w * vy, ux, uy, 3 * sw);
    const hooks = [-1, 1].map((side) => {
      const r = mid && across(bx + side * (bar.w / 2 - 0.4 * sw) * vx, by + side * (bar.w / 2 - 0.4 * sw) * vy, ux, uy, 3 * sw);
      return !r ? 0 : r[1] - mid[1] >= sw ? 1 : mid[0] - r[0] >= sw ? -1 : 0;
    });
    const bent = hooks[0] && hooks[1] === -hooks[0] ? 2 : 0;
    const pin = (sgn, arc) => [cx + R * Math.cos(arc.a) * 0.92, cy + R * Math.sin(arc.a) * 0.92, sgn];
    const tail = pair.find((q) => Math.cos(q.a) * ux * s + Math.sin(q.a) * uy * s < 0), head = pair.find((q) => q !== tail);
    const r0 = Math.max(3.0 * ri, Math.hypot(bar.t, bar.w / 2) + 0.8 * sw);
    devices.push({
      kind: 'diode', cx, cy, r: r0, zener: bent === 2,
      box: [cx - r0, cy - r0, cx + r0, cy + r0],
      inside: (x, y, pad) => Math.hypot(x - cx, y - cy) <= r0 + 0.3 * pad,
      pins: { a: pin(-1, tail).slice(0, 2), k: pin(1, head).slice(0, 2) },
    });
  }

  // ---------------------------------------------------------------- bipolar transistors
  for (const c of deepParts(D, W, H, sw)) {
    if (c.px.length < 3 * sw) continue;
    // a straight thick bar: its pixels along one line
    let mx = 0, my = 0;
    for (const j of c.px) { mx += j % W; my += (j - (j % W)) / W; }
    mx /= c.px.length; my /= c.px.length;
    let sxx = 0, syy = 0, sxy = 0;
    for (const j of c.px) { const x = (j % W) - mx, y = (j - (j % W)) / W - my; sxx += x * x; syy += y * y; sxy += x * y; }
    sxx /= c.px.length; syy /= c.px.length; sxy /= c.px.length;
    const tr = sxx + syy, det = sxx * syy - sxy * sxy, l1 = tr / 2 + Math.sqrt(Math.max(0, (tr * tr) / 4 - det)), l2 = tr - l1;
    const len = Math.sqrt(12 * l1), thick = Math.sqrt(12 * Math.max(0, l2));
    if (len < 3.5 * sw || len > 45 * sw || thick > 0.3 * len) continue;
    let vx = sxy, vy = l1 - sxx;
    if (Math.hypot(vx, vy) < 1e-9) { vx = sxx >= syy ? 1 : 0; vy = sxx >= syy ? 0 : 1; }
    const vl = Math.hypot(vx, vy); vx /= vl; vy /= vl;
    const nx = -vy, ny = vx;
    if (taken(mx, my)) continue;
    // the bar's half length and half width
    let hl = 0;
    while (hl < 30 * sw && ink(mx + (hl + 0.5) * vx, my + (hl + 0.5) * vy) && ink(mx - (hl + 0.5) * vx, my - (hl + 0.5) * vy)) hl += 0.5;
    // (measured off its middle, where the base lead runs on from it)
    const rs = [-0.6, -0.35, 0.35, 0.6].map((f) => across(mx + f * hl * vx, my + f * hl * vy, nx, ny, 4 * sw)).filter(Boolean);
    const med = (a) => a.sort((x, y) => x - y)[a.length >> 1];
    const r = rs.length >= 3 ? [med(rs.map((q) => q[0])), med(rs.map((q) => q[1]))] : null;
    if (!r || hl < 2.5 * sw) continue;
    const cxb = mx + ((r[0] + r[1]) / 2) * nx, cyb = my + ((r[0] + r[1]) / 2) * ny, ht = (r[1] - r[0]) / 2;
    // what leaves each side of the bar, near it and a little further out
    const probe = (side, d) => runsAlong(cxb + side * d * nx, cyb + side * d * ny, vx, vy, -hl - 3 * sw, hl + 3 * sw).filter((q) => q.t1 - q.t0 <= 3.5 * sw);
    const d1 = ht + 1.6 * sw, d2 = ht + 3.4 * sw;
    const at = (side, d, t) => [cxb + side * d * nx + t * vx, cyb + side * d * ny + t * vy];
    let found = null;
    for (const side of [-1, 1]) {
      const b1 = probe(-side, d1), b2 = probe(-side, d2);
      // the base (or gate) lead: one line meeting the bar square on the far side
      if (b1.length !== 1 || b2.length !== 1 || Math.abs(b1[0].mid) > 0.8 * hl || Math.abs(b1[0].mid - b2[0].mid) > 0.8 * sw) continue;
      const s1 = probe(side, d1);
      const s2 = runsAlong(cxb + side * d2 * nx, cyb + side * d2 * ny, vx, vy, -hl - 4 * sw, hl + 4 * sw);
      // a bipolar transistor's collector and emitter: two lines leaving this side, one from each
      // half of the bar, spreading apart (the line nearest the bar's middle, and where it is a
      // little further out — an arrowhead there is wide, and its ink is the line's too)
      const slants = [-1, 1].map((h) => {
        const p = s1.filter((q) => q.mid * h >= 0.15 * hl && Math.abs(q.mid) <= hl + 1.5 * sw).sort((a, b) => Math.abs(a.mid) - Math.abs(b.mid))[0];
        if (!p) return null;
        const q = s2.filter((r) => r.t1 * h >= p.mid * h - 0.5 * sw && r.t0 * h <= p.mid * h + 4 * sw).sort((a, b) => Math.abs(a.mid - p.mid) - Math.abs(b.mid - p.mid))[0];
        if (!q) return null;
        const t2 = q.t1 - q.t0 <= 2.5 * sw ? q.mid : p.mid + h * (d2 - d1);
        const k = ((t2 - p.mid) * h) / (d2 - d1);
        return k >= 0.3 && k <= 4 ? [p.mid, t2] : null;
      });
      if (slants.every(Boolean) && Math.abs(b1[0].mid) <= 0.45 * hl) { found = { kind: 'bjt', side, legs: slants, lead: b1[0].mid }; break; }
      // a junction FET's drain and source: two lines leaving this side square, near the bar's
      // two ends
      const square = [-1, 1].map((h) => {
        const p = s1.filter((q) => q.mid * h >= 0.4 * hl && Math.abs(q.mid) <= hl + sw && q.t1 - q.t0 <= 2.5 * sw).sort((a, b) => Math.abs(b.mid) - Math.abs(a.mid))[0];
        return p && s2.some((q) => Math.abs(q.mid - p.mid) <= 0.8 * sw && q.t1 - q.t0 <= 2.5 * sw) ? [p.mid, p.mid] : null;
      });
      if (square.every(Boolean)) { found = { kind: 'jfet', side, legs: square, lead: b1[0].mid }; break; }
    }
    if (!found) continue;
    // follow each leg out from the bar, as long as it runs straight on: where it ends is the
    // terminal; its widest place is an arrowhead
    const { side } = found;
    const legs = found.legs.map(([t1, t2]) => {
      const [x1, y1] = at(side, d1, t1), [x2, y2] = at(side, d2, t2);
      const l = follow(x1, y1, x2 - x1, y2 - y1);
      return { ...l, x0: x1 - l.dx * (d1 - ht), y0: y1 - l.dy * (d1 - ht), len: l.len + (d1 - ht) };
    });
    if (legs.some((l) => l.len < 3 * sw)) continue;
    let kind, pins;
    const [lx, ly] = at(-side, ht + 2.6 * sw, found.lead);
    if (found.kind === 'bjt') {
      // the emitter: the leg with an arrowhead, clearly wider than anything on the other
      const [g0, g1] = legs, em = (g0.top || 0) >= (g1.top || 0) ? g0 : g1, col = em === g0 ? g1 : g0;
      if (!em.arrow || em.top < 1.4 * (col.top || 0)) continue;
      kind = em.arrow === 'out' ? 'npn' : 'pnp';
      pins = { b: [lx, ly], c: [col.x, col.y], e: [em.x, em.y] };
    } else {
      // the gate's arrowhead points at the channel of an n-channel FET, away from a p-channel's
      const [x1, y1] = at(-side, ht + 0.6 * sw, found.lead);
      // (only near the channel: further on, the lead may run into a joint)
      const g = follow(x1, y1, -side * nx, -side * ny, 4 * sw + 0.8 * hl);
      if (!g.arrow || g.len < 2 * sw) continue;
      kind = g.arrow === 'in' ? 'njfet' : 'pjfet';
      // (the drain is the end the gate is drawn further from; level, the upper or left one)
      const [g0, g1] = legs, off = (q) => Math.abs(q - found.lead);
      const t0 = found.legs[0][0], t1 = found.legs[1][0];
      let dr = Math.abs(off(t0) - off(t1)) > 0.5 * sw ? (off(t0) > off(t1) ? g0 : g1) : g0.y + 0.01 * g0.x < g1.y + 0.01 * g1.x ? g0 : g1;
      if (kind === 'pjfet' && Math.abs(off(t0) - off(t1)) <= 0.5 * sw) dr = dr === g0 ? g1 : g0;
      pins = { g: [lx, ly], d: [dr.x, dr.y], s: dr === g0 ? [g1.x, g1.y] : [g0.x, g0.y] };
    }
    // the region: the bar, and each leg to its end
    const caps = [
      [cxb - hl * vx, cyb - hl * vy, cxb + hl * vx, cyb + hl * vy, ht + 1.5 * sw],
      ...legs.map((l) => [l.x0, l.y0, l.x, l.y, Math.max(1.6 * sw, (l.top || 0) / 2 + 0.6 * sw)]),
    ];
    const xs = caps.flatMap((q) => [q[0] - q[4], q[2] + q[4], q[0] + q[4], q[2] - q[4]]), ys = caps.flatMap((q) => [q[1] - q[4], q[3] + q[4], q[1] + q[4], q[3] - q[4]]);
    const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    devices.push({
      kind, cx: (box[0] + box[2]) / 2, cy: (box[1] + box[3]) / 2, r: Math.max(box[2] - box[0], box[3] - box[1]) / 2, box,
      inside: (x, y, pad) => caps.some((q) => inCapsule(q, x, y, pad)),
      pins,
    });
  }
  return devices;
}
