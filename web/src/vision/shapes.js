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
  const hs = holes(mask, w, bx0, by0, bx1, by1);
  const minR = 1.6 * sw, maxR = 16 * sw;
  const cands = [];
  for (const ho of hs) {
    const req = Math.sqrt(ho.area / Math.PI);
    const hw = ho.x1 - ho.x0 + 1, hh = ho.y1 - ho.y0 + 1;
    if (req < minR * 0.5 || req > maxR) continue;
    if (Math.max(hw, hh) > 2.6 * Math.min(hw, hh)) continue;
    // a window of the circuit (a mesh) is a near-rectangle; a disc fills π/4 of its box, a
    // diamond half, a half disc about 0.8
    if (ho.area > 0.88 * hw * hh) continue;
    cands.push(ho);
  }
  const found = [];
  const score = (f) => f.score - 0.5 * Math.max(0, f.outer - 0.2) - 0.3 * Math.max(0, f.inner - 0.35);
  for (const ho of cands) {
    const req = Math.sqrt(ho.area / Math.PI);
    // the hole may be half of the shape (an arrow across a source splits it in two)
    const rMin = Math.max(minR, req * 0.85), rMax = Math.min(maxR, req * 2.3 + sw);
    const span = Math.max(ho.x1 - ho.x0, ho.y1 - ho.y0) * 0.75 + sw;
    const coarse = Math.max(1, sw * 0.75);
    let pick = null;
    for (const kind of ['circle', 'diamond']) {
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
      search(Math.min(span, 2 * coarse));
      if (best.v < 0.85) search(span);
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
  for (const s of found) if (!out.some((o) => Math.hypot(o.cx - s.cx, o.cy - s.cy) < Math.max(o.r, s.r) * 0.8)) out.push(s);
  return out;
}
