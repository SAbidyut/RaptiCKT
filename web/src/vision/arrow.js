// Which way an arrow points, from the width of its ink along its length: the head is the wide
// part; the shaft is the long narrow part on one side of it, so the tip is on the other side.

/**
 * width: ink width at each step along the arrow (index 0 → the far end). Returns +1 when the tip
 * is at the far end, -1 when at index 0, 0 when it cannot tell (no head, or a bar).
 */
export function arrowTip(width, sw) {
  const L = width.length;
  const nz = [...width].filter((v) => v > 0).sort((a, b) => a - b);
  if (nz.length < 4) return 0;
  const shaft = Math.max(1, nz[nz.length >> 2]);
  let max = 0;
  for (const v of width) max = Math.max(max, v);
  if (max < Math.max(1.6 * shaft, shaft + 1.1 * sw)) return 0;
  // the head: the longest run of wide steps
  const wide = (v) => v > shaft + 0.4 * (max - shaft);
  let best = null;
  for (let t = 0; t < L;) {
    if (!wide(width[t])) { t++; continue; }
    let e = t;
    while (e + 1 < L && (wide(width[e + 1]) || (e + 2 < L && wide(width[e + 2])))) e++;
    if (!best || e - t > best[1] - best[0]) best = [t, e];
    t = e + 1;
  }
  // the shaft: the side with the longer narrow stretch
  const narrow = (v) => v > 0 && v <= shaft + 0.25 * (max - shaft);
  let lo = 0, hi = 0;
  for (let t = 0; t < best[0]; t++) if (narrow(width[t])) lo++;
  for (let t = best[1] + 1; t < L; t++) if (narrow(width[t])) hi++;
  if (Math.abs(hi - lo) < 2) return 0;
  return hi > lo ? -1 : 1;
}
