"""Train the glyph classifier on features.f32 / labels.u8 (from features.mjs) and write the
model as a JS module the app loads (weights as int8, one scale per layer).

    python3 train.py DATA_DIR[,DATA_DIR ...] OUT_JS [HIDDEN=256] [EPOCHS=40] [WHAT]

e.g. the printed characters (render.py) alone for glyph-model.js, with the hand-written ones
(hand.py, hasy.py) and the run-together pairs (pairs.py) for glyph-model-hand.js; WHAT names
the model in the file's header. FEATURES=hand (environment) trains on features-hand.f32
(features.mjs DIR hand) instead of features.f32; EXTRA=pair adds classes after the shared ones
(pairs.py's 'pair': two characters run together, no one character); SEED (environment) seeds the
weights and the order the samples are taken in (default 1).
"""
import base64, json, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from render import CLASSES  # noqa: E402

KIND = os.environ.get('FEATURES', '')
CLASSES = CLASSES + [c for c in os.environ.get('EXTRA', '').split(',') if c]
FEAT = 'features-hand.f32' if KIND == 'hand' else 'features.f32'
# where the log aspect sits (glyph-features.js): after the 16 × 16 coverage, or after the 5 × 5 × 8
# directions and the 8 × 8 coverage; what comes before it gets a little noise in training
ASP = 5 * 5 * 8 + 64 if KIND == 'hand' else 16 * 16


def main():
    dirs, out = sys.argv[1].split(','), sys.argv[2]
    hidden = int(sys.argv[3]) if len(sys.argv) > 3 else 256
    epochs = int(sys.argv[4]) if len(sys.argv) > 4 else 40
    Xs, ys, src = [], [], []
    for k, data in enumerate(dirs):
        ys.append(np.fromfile(os.path.join(data, 'labels.u8'), dtype=np.uint8).astype(np.int64))
        Xs.append(np.fromfile(os.path.join(data, FEAT), dtype=np.float32).reshape(len(ys[-1]), -1))
        src.append(np.full(len(ys[-1]), k))
    D = Xs[0].shape[1]
    X, y, src = np.concatenate(Xs), np.concatenate(ys), np.concatenate(src)
    C = len(CLASSES)
    rng = np.random.default_rng(int(os.environ.get('SEED', '1')))
    idx = rng.permutation(len(y))
    nv = len(y) // 12
    Xv, yv, sv, Xt, yt = X[idx[:nv]], y[idx[:nv]], src[idx[:nv]], X[idx[nv:]], y[idx[nv:]]
    W1 = rng.normal(0, np.sqrt(2 / D), (D, hidden)).astype(np.float32); b1 = np.zeros(hidden, np.float32)
    W2 = rng.normal(0, np.sqrt(2 / hidden), (hidden, C)).astype(np.float32); b2 = np.zeros(C, np.float32)
    params = [W1, b1, W2, b2]
    m = [np.zeros_like(p) for p in params]; v = [np.zeros_like(p) for p in params]
    t = 0
    bs, lr0, wd = 256, 2e-3, 1e-4

    def forward(Xb):
        h = np.maximum(0, Xb @ W1 + b1)
        return h, h @ W2 + b2

    def acc(Xs, ys, ps=None):
        W1_, b1_, W2_, b2_ = ps or params
        z = np.maximum(0, Xs @ W1_ + b1_) @ W2_ + b2_
        return (z.argmax(1) == ys).mean()

    steps = epochs * (len(yt) // bs)
    for ep in range(epochs):
        perm = rng.permutation(len(yt))
        for k in range(len(yt) // bs):
            bi = perm[k * bs:(k + 1) * bs]
            Xb = Xt[bi].copy()
            # a little noise on the grids
            Xb[:, :ASP] += rng.normal(0, 0.04, (len(bi), ASP)).astype(np.float32)
            yb = yt[bi]
            h, z = forward(Xb)
            z = z - z.max(1, keepdims=True)
            p = np.exp(z); p /= p.sum(1, keepdims=True)
            g = p; g[np.arange(len(yb)), yb] -= 1; g /= len(yb)
            gW2 = h.T @ g + wd * W2; gb2 = g.sum(0)
            gh = g @ W2.T; gh[h <= 0] = 0
            gW1 = Xb.T @ gh + wd * W1; gb1 = gh.sum(0)
            t += 1
            lr = lr0 * 0.5 * (1 + np.cos(np.pi * t / steps))
            for i, (pp, gg) in enumerate(zip(params, [gW1, gb1, gW2, gb2])):
                m[i] = 0.9 * m[i] + 0.1 * gg
                v[i] = 0.999 * v[i] + 0.001 * gg * gg
                mh = m[i] / (1 - 0.9 ** t); vh = v[i] / (1 - 0.999 ** t)
                pp -= lr * mh / (np.sqrt(vh) + 1e-8)
        if ep % 5 == 4 or ep == epochs - 1:
            print(f'epoch {ep + 1}: train {acc(Xt[:20000], yt[:20000]):.4f} val {acc(Xv, yv):.4f}', flush=True)

    # int8 weights, one scale per layer
    def q(W):
        s = float(np.abs(W).max()) / 127 or 1.0
        return np.clip(np.round(W / s), -127, 127).astype(np.int8), s
    q1, s1 = q(W1); q2, s2 = q(W2)
    qa = acc(Xv, yv, [q1.astype(np.float32) * s1, b1, q2.astype(np.float32) * s2, b2])
    print(f'val with int8 weights {qa:.4f}')
    for k, data in enumerate(dirs):
        m = sv == k
        print(f'  val {os.path.basename(os.path.normpath(data))}: {acc(Xv[m], yv[m]):.4f} ({m.sum()} samples)')
    # the worst confusions
    z = np.maximum(0, Xv @ W1 + b1) @ W2 + b2
    pred = z.argmax(1)
    conf = {}
    for a, b in zip(yv, pred):
        if a != b: conf[(CLASSES[a], CLASSES[b])] = conf.get((CLASSES[a], CLASSES[b]), 0) + 1
    print('confusions', sorted(conf.items(), key=lambda kv: -kv[1])[:15])
    layers = []
    for W, b, qw, s in [(W1, b1, q1, s1), (W2, b2, q2, s2)]:
        # stored output-major: weight of input i for output j at j * inp + i
        layers.append({'inp': int(W.shape[0]), 'out': int(W.shape[1]), 'scale': s, 'w': base64.b64encode(qw.T.copy().tobytes()).decode(), 'b': [round(float(x), 5) for x in b]})
    # each class's usual shape (log width/height, 2nd to 98th percentile)
    aspect = {}
    for ci, c in enumerate(CLASSES):
        a = X[y == ci, ASP]
        if len(a): aspect[c] = [round(float(np.percentile(a, 2)), 2), round(float(np.percentile(a, 98)), 2)]
    with open(out, 'w') as f:
        what = sys.argv[5] if len(sys.argv) > 5 else 'the printed-character classifier for offline photo\n// reading'
        f.write(f'// Generated by tools/glyphs/train.py: {what} (int8 weights, one scale per layer). Do not edit by hand.\n')
        f.write('export const MODEL = ' + json.dumps({'classes': CLASSES, 'features': KIND or 'print', 'aspect': aspect, 'layers': layers}, ensure_ascii=False) + ';\n')
    print('wrote', out, os.path.getsize(out), 'bytes')


if __name__ == '__main__':
    main()
