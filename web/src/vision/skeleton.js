// Line drawings as graphs: thin the ink to 1-px centre lines, then split the centre lines into
// nodes (line ends and junctions) and the paths between them.

const DX = [0, 1, 1, 1, 0, -1, -1, -1];
const DY = [-1, -1, 0, 1, 1, 1, 0, -1];

/** Zhang–Suen thinning of a 0/1 mask (a copy is returned). */
export function thin(mask, w, h) {
  const s = Uint8Array.from(mask);
  const del = [];
  const p = new Array(8);
  for (let changed = true, iter = 0; changed && iter < 60; iter++) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (!s[i]) continue;
          for (let k = 0; k < 8; k++) p[k] = s[i + DY[k] * w + DX[k]];
          let b = 0, a = 0;
          for (let k = 0; k < 8; k++) { b += p[k]; if (!p[k] && p[(k + 1) & 7]) a++; }
          if (b < 2 || b > 6 || a !== 1) continue;
          // p[0]=N p[2]=E p[4]=S p[6]=W
          if (pass === 0 ? (p[0] && p[2] && p[4]) || (p[2] && p[4] && p[6]) : (p[0] && p[2] && p[6]) || (p[0] && p[4] && p[6])) continue;
          del.push(i);
        }
      }
      if (del.length) changed = true;
      for (const i of del) s[i] = 0;
    }
  }
  // clear the image border (thinning never looks at it)
  for (let x = 0; x < w; x++) { s[x] = 0; s[(h - 1) * w + x] = 0; }
  for (let y = 0; y < h; y++) { s[y * w] = 0; s[y * w + w - 1] = 0; }
  return s;
}

/**
 * Graph of a 1-px skeleton. nodes: { id, x, y, px: [pixel indices], edges: [edge ids] };
 * edges: { id, a, b, path: [pixel indices from a to b, both nodes excluded] }.
 * A node is a line end or a junction (three or more branches); a closed loop with neither gets
 * one node of its own. Diagonal steps that a straight step already covers are ignored, so a
 * pixel in the middle of a line always has exactly two neighbours.
 */
export function skeletonGraph(skel, w, h) {
  const n = w * h;
  const pixels = [];
  for (let i = 0; i < n; i++) if (skel[i]) pixels.push(i);
  // neighbours in the thinned sense
  const nbr = new Map();
  for (const i of pixels) {
    const x = i % w, y = (i / w) | 0;
    const list = [];
    for (let k = 0; k < 8; k++) {
      const X = x + DX[k], Y = y + DY[k];
      if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
      const q = Y * w + X;
      if (!skel[q]) continue;
      if (k & 1) {
        // diagonal: only when neither of the two pixels beside the step is set
        if (skel[y * w + X] || skel[Y * w + x]) continue;
      }
      list.push(q);
    }
    nbr.set(i, list);
  }
  const isNode = (i) => nbr.get(i).length !== 2;
  const nodeOf = new Int32Array(n).fill(-1);
  const nodes = [];
  for (const i of pixels) {
    if (!isNode(i) || nodeOf[i] >= 0) continue;
    const id = nodes.length, px = [];
    const stack = [i];
    nodeOf[i] = id;
    while (stack.length) {
      const j = stack.pop();
      px.push(j);
      for (const q of nbr.get(j)) if (isNode(q) && nodeOf[q] < 0) { nodeOf[q] = id; stack.push(q); }
    }
    let sx = 0, sy = 0;
    for (const j of px) { sx += j % w; sy += (j / w) | 0; }
    nodes.push({ id, x: sx / px.length, y: sy / px.length, px, edges: [] });
  }
  const edges = [];
  const seen = new Uint8Array(n);
  const addEdge = (a, b, path) => {
    const id = edges.length;
    edges.push({ id, a, b, path });
    nodes[a].edges.push(id);
    nodes[b].edges.push(id);
  };
  const walk = (from, first) => {
    const path = [];
    let prev = from, cur = first;
    while (nodeOf[cur] < 0) {
      seen[cur] = 1;
      path.push(cur);
      const [p, q] = nbr.get(cur);
      const next = p === prev ? q : p;
      prev = cur; cur = next;
      if (seen[cur] && nodeOf[cur] < 0) return { end: -1, path }; // a loop with no node
    }
    return { end: nodeOf[cur], path };
  };
  const linked = new Set();
  for (const node of nodes) {
    for (const i of node.px) {
      for (const q of nbr.get(i)) {
        if (nodeOf[q] >= 0) {
          const o = nodeOf[q];
          if (o !== node.id) {
            const key = Math.min(o, node.id) + ',' + Math.max(o, node.id);
            if (!linked.has(key)) { linked.add(key); addEdge(node.id, o, []); }
          }
          continue;
        }
        if (seen[q]) continue;
        const t = walk(i, q);
        if (t.end >= 0) addEdge(node.id, t.end, t.path);
      }
    }
  }
  // closed loops with no node at all
  for (const i of pixels) {
    if (seen[i] || nodeOf[i] >= 0) continue;
    const id = nodes.length;
    nodes.push({ id, x: i % w, y: (i / w) | 0, px: [i], edges: [] });
    nodeOf[i] = id;
    const [q] = nbr.get(i);
    const t = walk(i, q);
    addEdge(id, id, t.path);
  }
  return { nodes, edges, w, h };
}

/** Points of an edge from its a node to its b node: [[x, y], …] including both node centres. */
export function edgePoints(g, e, from = e.a) {
  const { w } = g;
  const pts = [[g.nodes[e.a].x, g.nodes[e.a].y]];
  for (const i of e.path) pts.push([i % w, (i / w) | 0]);
  pts.push([g.nodes[e.b].x, g.nodes[e.b].y]);
  return from === e.a ? pts : pts.reverse();
}

/** Ramer–Douglas–Peucker: indices of the points kept. */
export function simplify(pts, eps) {
  const keep = new Uint8Array(pts.length);
  keep[0] = 1; keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    if (b <= a + 1) continue;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    let best = -1, bd = -1;
    for (let i = a + 1; i < b; i++) {
      const d = L > 1e-9 ? Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L : Math.hypot(pts[i][0] - ax, pts[i][1] - ay);
      if (d > bd) { bd = d; best = i; }
    }
    if (bd > eps) { keep[best] = 1; stack.push([a, best], [best, b]); }
  }
  const out = [];
  for (let i = 0; i < pts.length; i++) if (keep[i]) out.push(i);
  return out;
}

/**
 * Remove short spurs (a line end hanging off a junction, left by thinning thick strokes) and
 * then join the two edges of every node left with exactly two. Mutates and returns a compacted
 * graph.
 */
export function pruneSpurs(g, maxLen) {
  const alive = g.edges.map(() => true);
  const deg = (nd) => nd.edges.filter((id) => alive[id]).length;
  for (let round = 0; round < 3; round++) {
    let changed = false;
    for (const e of g.edges) {
      if (!alive[e.id] || e.a === e.b) continue;
      const A = g.nodes[e.a], B = g.nodes[e.b];
      const da = deg(A), db = deg(B);
      const len = e.path.length + 1;
      if (len > maxLen) continue;
      if ((da === 1 && db >= 3) || (db === 1 && da >= 3)) { alive[e.id] = false; changed = true; }
    }
    if (!changed) break;
  }
  // rebuild: drop dead edges and isolated end nodes, merge degree-2 nodes
  const edges = [];
  for (const e of g.edges) if (alive[e.id]) edges.push({ ...e });
  return compact(g, edges);
}

function compact(g, edges) {
  const nodes = g.nodes.map((nd) => ({ ...nd, edges: [] }));
  edges.forEach((e, k) => { e.id = k; nodes[e.a].edges.push(k); if (e.b !== e.a) nodes[e.b].edges.push(k); else nodes[e.a].edges.push(k); });
  // merge through nodes with exactly two different edges (a bend in a path, not a junction)
  const dead = new Set();
  let merged = true;
  while (merged) {
    merged = false;
    for (const nd of nodes) {
      if (nd.dead || nd.edges.length !== 2) continue;
      const [i, j] = nd.edges;
      if (i === j) continue;
      const e1 = edges[i], e2 = edges[j];
      if (dead.has(i) || dead.has(j)) continue;
      // e1: … → nd, e2: nd → …
      const p1 = e1.b === nd.id ? e1.path : [...e1.path].reverse();
      const s1 = e1.b === nd.id ? e1.a : e1.b;
      const p2 = e2.a === nd.id ? e2.path : [...e2.path].reverse();
      const s2 = e2.a === nd.id ? e2.b : e2.a;
      if (s1 === nd.id || s2 === nd.id) continue;
      const ne = { id: edges.length, a: s1, b: s2, path: [...p1, ...nd.px, ...p2] };
      edges.push(ne);
      dead.add(i); dead.add(j);
      nd.dead = true; nd.edges = [];
      const A = nodes[s1], B = nodes[s2];
      A.edges = A.edges.map((x) => (x === i ? ne.id : x));
      B.edges = B.edges.map((x) => (x === j ? ne.id : x));
      if (s1 === s2) { /* a loop: both ends on the same node */ }
      merged = true;
    }
  }
  const keepE = edges.filter((e) => !dead.has(e.id));
  const keepN = nodes.filter((nd) => !nd.dead && nd.edges.length > 0);
  const nid = new Map(keepN.map((nd, k) => [nd.id, k]));
  const eid = new Map(keepE.map((e, k) => [e.id, k]));
  const outN = keepN.map((nd, k) => ({ ...nd, id: k, edges: nd.edges.filter((x) => eid.has(x)).map((x) => eid.get(x)) }));
  const outE = keepE.map((e, k) => ({ ...e, id: k, a: nid.get(e.a), b: nid.get(e.b) }));
  return { nodes: outN, edges: outE, w: g.w, h: g.h };
}
