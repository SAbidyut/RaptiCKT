// Source bodies in a circuit drawing: circles (independent sources) and diamonds (dependent
// sources). Candidates come from the enclosed holes of the line drawing; each is confirmed by
// fitting a circle or a diamond outline to the ink around it.

/** Holes of a 0/1 mask inside the box [x0, y0, x1, y1]: background enclosed by ink. */
export function holes(mask, w, x0, y0, x1, y1) {
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const lab = new Int32Array(bw * bh); // -1 outside, 0 unvisited background, k hole id
  const at = (x, y) => mask[(y0 + y) * w + (x0 + x)];
  const stack = [];
  const fill = (sx, sy, id, out) => {
    stack.length = 0;
    stack.push(sy * bw + sx);
    lab[sy * bw + sx] = id;
    let area = 0, sx2 = 0, sy2 = 0, minx = bw, miny = bh, maxx = -1, maxy = -1;
    while (stack.length) {
      const i = stack.pop(), x = i % bw, y = (i / bw) | 0;
      area++; sx2 += x; sy2 += y;
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
      const nb = [x > 0 ? i - 1 : -1, x < bw - 1 ? i + 1 : -1, y > 0 ? i - bw : -1, y < bh - 1 ? i + bw : -1];
      for (const j of nb) {
        if (j < 0 || lab[j]) continue;
        if (at(j % bw, (j / bw) | 0)) continue;
        lab[j] = id;
        stack.push(j);
      }
    }
    if (out) out.push({ id, area, cx: x0 + sx2 / area, cy: y0 + sy2 / area, x0: x0 + minx, y0: y0 + miny, x1: x0 + maxx, y1: y0 + maxy });
  };
  // everything reachable from the box edge is outside
  for (let x = 0; x < bw; x++) for (const y of [0, bh - 1]) if (!lab[y * bw + x] && !at(x, y)) fill(x, y, -1, null);
  for (let y = 0; y < bh; y++) for (const x of [0, bw - 1]) if (!lab[y * bw + x] && !at(x, y)) fill(x, y, -1, null);
  const out = [];
  let id = 1;
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (!lab[y * bw + x] && !at(x, y)) fill(x, y, id++, out);
  return out;
}

/** A 0/1 mask closed by r px (grown, then shrunk back): gaps up to 2r wide shut. */
function closed(mask, w, h, r) {
  const grow = (src, on) => {
    // a square's reach, row then column, in two passes
    const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      let last = -Infinity;
      for (let x = 0; x < w; x++) { if (src[y * w + x] === on) last = x; if (x - last <= r) tmp[y * w + x] = 1; }
      last = Infinity;
      for (let x = w - 1; x >= 0; x--) { if (src[y * w + x] === on) last = x; if (last - x <= r) tmp[y * w + x] = 1; }
    }
    for (let x = 0; x < w; x++) {
      let last = -Infinity;
      for (let y = 0; y < h; y++) { if (tmp[y * w + x]) last = y; if (y - last <= r) out[y * w + x] = 1; }
      last = Infinity;
      for (let y = h - 1; y >= 0; y--) { if (tmp[y * w + x]) last = y; if (last - y <= r) out[y * w + x] = 1; }
    }
    return out;
  };
  const g = grow(mask, 1);
  // shrink: what is within r of paper (outside the grown ink) goes again
  const paper = grow(g, 0);
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = g[i] && !paper[i] ? 1 : 0;
  return out;
}

/** Point on a shape's outline at parameter u ∈ [0, 1) (circle or diamond), with its outward normal. */
function outline(kind, cx, cy, r, u) {
  if (kind === 'circle') {
    const a = u * 2 * Math.PI, c = Math.cos(a), s = Math.sin(a);
    return [cx + r * c, cy + r * s, c, s];
  }
  // diamond: corners right, bottom, left, top
  const t = u * 4, k = Math.floor(t) % 4, f = t - Math.floor(t);
  const C = [[r, 0], [0, r], [-r, 0], [0, -r]];
  const [ax, ay] = C[k], [bx, by] = C[(k + 1) % 4];
  const N = [[1, 1], [-1, 1], [-1, -1], [1, -1]][k];
  return [cx + ax + (bx - ax) * f, cy + ay + (by - ay) * f, N[0] / Math.SQRT2, N[1] / Math.SQRT2];
}

/** Fraction of the outline with ink within ±tol of it; also how much ink lies just outside. */
export function fitScore(mask, w, h, kind, cx, cy, r, tol, n = 48) {
  let hit = 0, outer = 0, inner = 0;
  const ink = (x, y) => {
    const X = Math.round(x), Y = Math.round(y);
    return X >= 0 && Y >= 0 && X < w && Y < h && mask[Y * w + X] === 1;
  };
  for (let k = 0; k < n; k++) {
    const [x, y, nx, ny] = outline(kind, cx, cy, r, (k + 0.5) / n);
    let on = false;
    for (let d = -tol; d <= tol + 1e-9 && !on; d += Math.max(0.5, tol / 2)) on = ink(x + nx * d, y + ny * d);
    if (on) hit++;
    const [ox, oy] = outline(kind, cx, cy, r * 1.4 + tol, (k + 0.5) / n);
    if (ink(ox, oy)) outer++;
    const [ix, iy] = outline(kind, cx, cy, Math.max(1, r * 0.6 - tol), (k + 0.5) / n);
    if (ink(ix, iy)) inner++;
  }
  return { score: hit / n, outer: outer / n, inner: inner / n };
}

/** fitScore for an oval (rx across, ry down): the share of its outline with ink on it. */
function ovalScore(mask, w, h, cx, cy, rx, ry, tol, n = 48) {
  let hit = 0, outer = 0;
  const ink = (x, y) => {
    const X = Math.round(x), Y = Math.round(y);
    return X >= 0 && Y >= 0 && X < w && Y < h && mask[Y * w + X] === 1;
  };
  for (let k = 0; k < n; k++) {
    const a = ((k + 0.5) / n) * 2 * Math.PI, c = Math.cos(a), s = Math.sin(a);
    // the outward normal of an ellipse at that point
    let nx = c / rx, ny = s / ry;
    const nl = Math.hypot(nx, ny);
    nx /= nl; ny /= nl;
    const x = cx + rx * c, y = cy + ry * s;
    let on = false;
    for (let d = -tol; d <= tol + 1e-9 && !on; d += Math.max(0.5, tol / 2)) on = ink(x + nx * d, y + ny * d);
    if (on) hit++;
    if (ink(cx + (rx * 1.4 + tol) * c, cy + (ry * 1.4 + tol) * s)) outer++;
  }
  return { score: hit / n, outer: outer / n };
}

/**
 * Circle or diamond? Cast rays from the centre and find where each crosses the outline (the
 * middle of the outermost ink run before 1.5 r): a circle keeps that distance constant, a
 * diamond's grows towards its corners as r / (|cos| + |sin|). Returns the better model with its
 * size, the centre nudged to fit it best, and the typical misfit in pixels.
 */
export function outlineKind(mask, w, h, cx, cy, r, sw) {
  const N = 72;
  const ink = (x, y) => {
    const X = Math.round(x), Y = Math.round(y);
    return X >= 0 && Y >= 0 && X < w && Y < h && mask[Y * w + X] === 1;
  };
  const rho = (ox, oy) => {
    const out = new Float32Array(N).fill(NaN);
    for (let k = 0; k < N; k++) {
      const a = (k + 0.5) / N * 2 * Math.PI, c = Math.cos(a), s = Math.sin(a);
      let inRun = false, start = 0, last = NaN;
      const t0 = 0.45 * r, t1 = 1.55 * r;
      for (let t = t0; t <= t1; t += 0.5) {
        const on = ink(ox + c * t, oy + s * t);
        if (on && !inRun) { inRun = true; start = t; }
        if (!on && inRun) { inRun = false; last = (start + t - 0.5) / 2; }
      }
      if (inRun) continue; // still in ink at the far end: a wire leaving here
      out[k] = last;
    }
    return out;
  };
  const pct = (a, q) => { const b = a.filter((v) => Number.isFinite(v)).sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(q * b.length))] : NaN; };
  const kd = (k) => { const a = (k + 0.5) / N * 2 * Math.PI; return 1 / (Math.abs(Math.cos(a)) + Math.abs(Math.sin(a))); };
  const tried = new Map();
  const fit = (x, y) => {
    const key = `${x},${y}`;
    if (tried.has(key)) return tried.get(key);
    const p = rho(x, y);
    let r = null;
    if (p.filter((v) => Number.isFinite(v)).length >= N * 0.5) {
      const Rc = pct(Array.from(p), 0.5), Rd = pct(Array.from(p, (v, k) => v / kd(k)), 0.5);
      // the misfit of most rays, not just half of them: from off centre, half of a diamond's rays
      // still fit a smaller diamond
      const rc = pct(Array.from(p, (v) => Math.abs(v - Rc)), 0.7);
      const rd = pct(Array.from(p, (v, k) => Math.abs(v - Rd * kd(k))), 0.7);
      r = rc <= rd ? { kind: 'circle', r: Rc, res: rc, cx: x, cy: y } : { kind: 'diamond', r: Rd, res: rd, cx: x, cy: y };
    }
    tried.set(key, r);
    return r;
  };
  // walk the centre downhill (a thick outline lets the first fit sit a few pixels off)
  let best = null, ox = cx, oy = cy;
  for (let round = 0; round < 8; round++) {
    let step = null;
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const f = fit(ox + dx, oy + dy);
        if (f && (!step || f.res < step.res)) step = f;
      }
    }
    if (!step || (best && step.res >= best.res)) break;
    best = step;
    if (step.cx === ox && step.cy === oy) break;
    ox = step.cx; oy = step.cy;
  }
  return best;
}

/**
 * Circles and diamonds of the line drawing (mask) inside a box, with their centre and radius
 * (half the diagonal for a diamond): [{ kind, cx, cy, r, score }].
 */
export function findShapes(mask, w, h, box, sw) {
  const [bx0, by0, bx1, by1] = box;
  // (a body drawn by hand may not quite close where the pen started: look for big holes with
  // gaps of a line's width or two shut too — small ones so made are only the narrow corners of
  // a zigzag or a coil)
  const hs = holes(mask, w, bx0, by0, bx1, by1);
  for (const ho of holes(closed(mask, w, h, Math.max(1, Math.round(1.2 * sw))), w, bx0, by0, bx1, by1)) {
    if (ho.area >= Math.PI * 25 * sw * sw && !hs.some((o) => Math.hypot(o.cx - ho.cx, o.cy - ho.cy) < 2 * sw && o.area > 0.5 * ho.area)) hs.push(ho);
  }
  const minR = 1.6 * sw, maxR = 16 * sw;
  const cands = [];
  for (const ho of hs) {
    const req = Math.sqrt(ho.area / Math.PI);
    const hw = ho.x1 - ho.x0 + 1, hh = ho.y1 - ho.y0 + 1;
    // (a source drawn by hand with a thin pen is big for its line: an oval hole up to twice as
    // big is looked at as an oval only)
    if (req < minR * 0.5 || req > 2 * maxR || (req > maxR && ho.area > 0.84 * hw * hh)) continue;
    if (Math.max(hw, hh) > 2.6 * Math.min(hw, hh)) continue;
    // a window of the circuit (a mesh) is a near-rectangle; a disc fills π/4 of its box, a
    // diamond half, a half disc about 0.8
    if (ho.area > 0.88 * hw * hh) continue;
    cands.push(ho);
  }
  // a ring split in two by a wire or an arrow run through it: its halves side by side, a line's
  // width apart, of a size, and together about as wide as tall
  for (let i = 0; i < hs.length; i++) {
    for (let j = i + 1; j < hs.length; j++) {
      const a = hs[i], b = hs[j];
      if (Math.min(a.area, b.area) < 0.5 * Math.max(a.area, b.area)) continue;
      const gx = Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1), gy = Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1);
      if (!((gx > 0 && gx <= 2.5 * sw && gy < 0) || (gy > 0 && gy <= 2.5 * sw && gx < 0))) continue;
      const u = { area: a.area + b.area, x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
      const uw = u.x1 - u.x0 + 1, uh = u.y1 - u.y0 + 1;
      if (Math.max(uw, uh) > 1.5 * Math.min(uw, uh) || Math.sqrt(u.area / Math.PI) > maxR) continue;
      cands.push({ ...u, cx: (u.x0 + u.x1) / 2, cy: (u.y0 + u.y1) / 2, split: true });
    }
  }
  const found = [];
  const hw = (ho) => ho.x1 - ho.x0 + 1, hh = (ho) => ho.y1 - ho.y0 + 1;
  const score = (f) => f.score - 0.5 * Math.max(0, f.outer - 0.2) - 0.3 * Math.max(0, f.inner - 0.35);
  for (const ho of cands) {
    const req = Math.sqrt(ho.area / Math.PI);
    // the hole may be half of the shape (an arrow across a source splits it in two)
    // (a split ring's two halves: the ring is round them both, centred between them)
    const big = Math.max(ho.x1 - ho.x0, ho.y1 - ho.y0) + 1;
    const rMin = ho.split ? Math.max(minR, 0.45 * big) : Math.max(minR, req * 0.85), rMax = Math.min(maxR, ho.split ? 0.5 * big + 1.5 * sw : req * 2.3 + sw);
    const span = Math.max(ho.x1 - ho.x0, ho.y1 - ho.y0) * 0.75 + sw;
    const coarse = Math.max(1, sw * 0.75);
    let pick = null;
    for (const kind of req > maxR ? [] : ['circle', 'diamond']) {
      // coarse search over centre and size, then a finer one with a tighter band
      let best = null;
      const search = (sp) => {
        for (let dy = -sp; dy <= sp; dy += coarse) {
          for (let dx = -sp; dx <= sp; dx += coarse) {
            for (let r = rMin; r <= rMax; r += Math.max(1, sw * 0.5)) {
              const f = fitScore(mask, w, h, kind, ho.cx + dx, ho.cy + dy, r, Math.max(1.5, sw * 0.7), 32);
              // (a thick outline fits a few centres equally: the hole's middle breaks the tie)
              const v = score(f) - 0.01 * Math.hypot(dx, dy) / sw;
              if (!best || v > best.v) best = { cx: ho.cx + dx, cy: ho.cy + dy, r, v };
            }
          }
        }
      };
      // a whole hole is centred on the shape; only a half (split by an arrow) needs the wide search
      search(Math.min(span, ho.split ? coarse : 2 * coarse));
      if (best && best.v < 0.85 && !ho.split) search(span);
      if (!best || best.v < 0.72) continue;
      let ref = null;
      for (let dy = -coarse; dy <= coarse; dy += 0.5) {
        for (let dx = -coarse; dx <= coarse; dx += 0.5) {
          for (let r = best.r - sw; r <= best.r + sw; r += 0.5) {
            const f = fitScore(mask, w, h, kind, best.cx + dx, best.cy + dy, r, Math.max(1, sw * 0.45), 64);
            const v = score(f) - 0.01 * Math.hypot(best.cx + dx - ho.cx, best.cy + dy - ho.cy) / sw;
            if (!ref || v > ref.v) ref = { kind, cx: best.cx + dx, cy: best.cy + dy, r, v };
          }
        }
      }
      if (ref && (!pick || ref.v > pick.v)) pick = ref;
    }
    // drawn by hand (or photographed askew) a body is often an oval: fit one to the hole
    if ((!pick || pick.v < 0.7) && Math.min(hw(ho), hh(ho)) >= 8 * sw && Math.max(hw(ho), hh(ho)) <= 1.8 * Math.min(hw(ho), hh(ho)) && ho.area >= 0.68 * hw(ho) * hh(ho) && ho.area <= 0.84 * hw(ho) * hh(ho)) {
      let best = null;
      const st = Math.max(1, sw / 2);
      for (let dy = -st; dy <= st; dy += st) {
        for (let dx = -st; dx <= st; dx += st) {
          for (let ex = -st; ex <= 2 * st; ex += st) {
            for (let ey = -st; ey <= 2 * st; ey += st) {
              const rx = hw(ho) / 2 + ex, ry = hh(ho) / 2 + ey;
              const f = ovalScore(mask, w, h, ho.cx + dx, ho.cy + dy, rx, ry, Math.max(1.5, sw * 0.7));
              const v = f.score - 0.5 * Math.max(0, f.outer - 0.2);
              if (!best || v > best.v) best = { cx: ho.cx + dx, cy: ho.cy + dy, rx, ry, v };
            }
          }
        }
      }
      if (best && best.v >= 0.75) { found.push({ kind: 'circle', cx: best.cx, cy: best.cy, r: (best.rx + best.ry) / 2, rx: best.rx, ry: best.ry, score: best.v }); continue; }
    }
    if (!pick || pick.v < 0.7) continue;
    // a small ring (an open terminal) is too small to tell its outline's shape
    if (pick.r < 3 * sw) { found.push({ kind: 'circle', cx: pick.cx, cy: pick.cy, r: pick.r, score: pick.v }); continue; }
    // a thick outline fits both models loosely: decide by the shape of the outline itself
    const o = outlineKind(mask, w, h, pick.cx, pick.cy, pick.kind === 'diamond' ? pick.r * 0.85 : pick.r, sw);
    if (o && o.res < Math.max(1.2, 0.45 * sw)) found.push({ kind: o.kind, cx: o.cx, cy: o.cy, r: o.r, score: pick.v, res: o.res });
    else found.push({ kind: pick.kind, cx: pick.cx, cy: pick.cy, r: pick.r, score: pick.v });
  }
  // one shape per place: keep the best of overlapping fits
  found.sort((a, b) => b.score - a.score);
  const out = [];
  const inside = (s, ho) => (s.kind === 'diamond' ? Math.abs(ho.cx - s.cx) + Math.abs(ho.cy - s.cy) : Math.hypot((ho.cx - s.cx) / (s.rx || s.r), (ho.cy - s.cy) / (s.ry || s.r)) * s.r) < s.r;
  for (const s of found) {
    if (out.some((o) => Math.hypot(o.cx - s.cx, o.cy - s.cy) < Math.max(o.r, s.r) * 0.8)) continue;
    // a body is hollow: the holes inside it fill most of it (a coil's loops fit a circle or a
    // diamond drawn round one of them, its other strokes on the outline) — or, a wire or an
    // arrow drawn through it, two halves on either side of its middle fill a good part of it
    const area = s.kind === 'diamond' ? 2 * s.r * s.r : Math.PI * (s.rx || s.r) * (s.ry || s.r);
    const own = hs.filter((ho) => inside(s, ho)), filled = own.reduce((t, ho) => t + ho.area, 0);
    const halves = own.some((a) => own.some((b) => (a.cx - s.cx) * (b.cx - s.cx) + (a.cy - s.cy) * (b.cy - s.cy) < 0 && Math.min(a.area, b.area) >= 0.5 * Math.max(a.area, b.area)));
    if (filled < 0.5 * area && !(halves && filled >= 0.3 * area)) continue;
    // and stands alone: a little ring in a row of them is a turn of a coil drawn in loops
    if (s.r < 3 * sw && hs.filter((ho) => ho.area >= 0.3 * area && ho.area <= 3 * area && Math.hypot(ho.cx - s.cx, ho.cy - s.cy) > s.r && Math.hypot(ho.cx - s.cx, ho.cy - s.cy) < 5 * s.r).length >= 2) continue;
    out.push(s);
  }
  return out;
}
