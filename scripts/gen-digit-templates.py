#!/usr/bin/env python3
"""
Regenerates src/lib/pipeline/digit-templates.ts from every screenshot listed in
example/truth.json.

The segmentation here mirrors src/lib/pipeline/digits.ts and anchors.ts exactly -
same otsu, same run splitting, same area-average resample - so a glyph cut out
here is the glyph the browser will cut out. Keep them in step.

    python3 scripts/gen-digit-templates.py
"""
from PIL import Image
import numpy as np, base64, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GW, GH = 16, 24

# --- geometry, mirrored from regions.ts ------------------------------------
TOP = {
    'score':     dict(x0=0.274, y0=0.280, x1=0.525, y1=0.385, metric='luma', digits=8),
    'highScore': dict(x0=0.398, y0=0.392, x1=0.525, y1=0.455, metric='luma', digits=8),
}
LABEL_COLUMN = (0.185, 0.45, 0.27, 0.95)
PITCH_MIN, PITCH_MAX = 0.05, 0.07

def lower_block(py, pitch):
    half = pitch * 0.45
    row = lambda i: dict(x0=0.278, x1=0.348, y0=py + i*pitch - half, y1=py + i*pitch + half, metric='luma', digits=4)
    at = lambda off, h, x0, x1, m: dict(x0=x0, x1=x1, y0=py + off*pitch - h, y1=py + off*pitch + h, metric=m, digits=None)
    return {
        'perfect': row(0), 'great': row(1), 'good': row(2), 'bad': row(3), 'miss': row(4),
        'maxCombo': dict(at(0, 0.0335, 0.435, 0.518, 'luma'), digits=4),
        'late':     at(2.72, 0.0235, 0.368, 0.415, 'white'),
        'early':    at(2.72, 0.0235, 0.466, 0.503, 'white'),
        'wrongWay': at(3.77, 0.024, 0.468, 0.503, 'white'),
    }

# --- anchors.ts -----------------------------------------------------------
def find_judgement_rows(rgb):
    H, W, _ = rgb.shape
    x0, y0, x1, y1 = (round(LABEL_COLUMN[0]*W), round(LABEL_COLUMN[1]*H), round(LABEL_COLUMN[2]*W), round(LABEL_COLUMN[3]*H))
    lum = rgb[y0:y1, x0:x1].astype(float) @ [0.299, 0.587, 0.114]
    counts = (lum > 140).sum(1)
    peak = counts.max()
    if peak == 0: return None
    cut = max(3, peak * 0.15); min_h = max(3, round(H * 0.005))
    centers, start = [], -1
    for i in range(len(counts) + 1):
        on = i < len(counts) and counts[i] > cut
        if on and start < 0: start = i
        if not on and start >= 0:
            if i - start >= min_h: centers.append((y0 + (start + i) / 2) / H)
            start = -1
    for i in range(len(centers) - 4):
        gaps = [centers[i+k] - centers[i+k-1] for k in range(1, 5)]
        if all(PITCH_MIN <= g <= PITCH_MAX for g in gaps):
            return centers[i], sum(gaps) / 4
    return None

# --- digits.ts -------------------------------------------------------------
def otsu(m):
    hist, _ = np.histogram(np.clip(np.round(m), 0, 255), bins=256, range=(0, 256)); tot = m.size
    s_all = (hist * np.arange(256)).sum(); wb = 0; sb = 0; best = (-1, 128)
    for t in range(256):
        wb += hist[t]
        if wb == 0 or wb == tot: continue
        wf = tot - wb; sb += t * hist[t]
        v = wb * wf * ((sb / wb) - ((s_all - sb) / wf)) ** 2
        if v > best[0]: best = (v, t)
    return best[1]

def runs(mask):
    out = []; s = None
    for i, v in enumerate(mask):
        if v and s is None: s = i
        elif not v and s is not None: out.append((s, i)); s = None
    if s is not None: out.append((s, len(mask)))
    return out

def area_resize(src, dw, dh):
    sh, sw = src.shape; out = np.zeros((dh, dw))
    for dy in range(dh):
        y0 = dy * sh / dh; y1 = (dy + 1) * sh / dh
        for dx in range(dw):
            x0 = dx * sw / dw; x1 = (dx + 1) * sw / dw
            acc = 0.0; wsum = 0.0
            for sy in range(int(np.floor(y0)), min(sh, int(np.ceil(y1)))):
                wy = min(y1, sy + 1) - max(y0, sy)
                if wy <= 0: continue
                for sx in range(int(np.floor(x0)), min(sw, int(np.ceil(x1)))):
                    wx = min(x1, sx + 1) - max(x0, sx)
                    if wx <= 0: continue
                    acc += src[sy, sx] * wy * wx; wsum += wy * wx
            out[dy, dx] = acc / wsum if wsum > 0 else 0
    return out

def glyphs(rgb, box):
    H, W, _ = rgb.shape
    a = rgb[round(box['y0']*H):round(box['y1']*H), round(box['x0']*W):round(box['x1']*W)].astype(float)
    if a.size == 0: return []
    m = a.min(2) if box['metric'] == 'white' else a @ [0.299, 0.587, 0.114]
    t = otsu(m); b = m > t
    ink = np.clip((m - t) / max(1.0, m.max() - t), 0, 1) * b
    rows = b.sum(1); rb = runs(rows > max(1, rows.max() * 0.08))
    if not rb: return []
    y0, y1 = max(rb, key=lambda r: r[1] - r[0]); h = y1 - y0
    strip = b[y0:y1]; istrip = ink[y0:y1]
    out = []
    for x0, x1 in runs(strip.sum(0) > 0):
        if x1 - x0 < max(2, h * 0.06): continue
        g = strip[:, x0:x1]; ys = np.where(g.any(1))[0]
        if len(ys) < 2 or (ys[-1] - ys[0]) < h * 0.35: continue
        gi = istrip[ys[0]:ys[-1] + 1, x0:x1]
        out.append((area_resize(gi, GW, GH).flatten(), (x1 - x0) / (ys[-1] - ys[0] + 1)))
    return out

def norm(v):
    v = v - v.mean(); n = np.linalg.norm(v); return v / n if n > 0 else v

# --- harvest ----------------------------------------------------------------
truth = json.load(open(os.path.join(ROOT, 'example/truth.json')))
samples = {str(d): [] for d in range(10)}
skipped = []

for rel, t in truth.items():
    if rel.startswith('_'): continue
    im = Image.open(os.path.join(ROOT, 'example', rel)).convert('RGB')
    rgb = np.asarray(im)
    anchor = find_judgement_rows(rgb)
    if anchor is None:
        skipped.append((rel, 'no anchor')); continue
    regions = dict(TOP); regions.update(lower_block(*anchor))

    for field, box in regions.items():
        want = t.get(field)
        if want is None: continue                       # absent on this screenshot
        expect = str(want).zfill(box['digits']) if box['digits'] else str(want)
        gs = glyphs(rgb, box)
        if len(gs) != len(expect):
            skipped.append((rel, f'{field}: {len(gs)} glyphs for "{expect}"')); continue
        for (v, asp), ch in zip(gs, expect): samples[ch].append((v, asp))

if skipped:
    print('skipped (segmentation did not match the truth):', file=sys.stderr)
    for s in skipped: print('  ', *s, file=sys.stderr)

tpl = {}
for d, ss in samples.items():
    if not ss: sys.exit(f'digit {d} has no samples at all')
    stack = np.stack([s[0] for s in ss])
    tpl[d] = dict(raw=stack.mean(0), v=norm(stack.mean(0)), aspect=float(np.mean([s[1] for s in ss])), n=len(ss))

# --- round trip ---------------------------------------------------------------
def classify(v, a):
    vn = norm(v); best = (-9, None)
    for d, t in tpl.items():
        s = float(vn @ t['v']) - 0.25 * abs(a - t['aspect'])
        if s > best[0]: best = (s, d)
    return best

bad = 0; worst = 1.0
for d, ss in samples.items():
    for v, a in ss:
        s, got = classify(v, a)
        worst = min(worst, s)
        if got != d: bad += 1
total = sum(len(ss) for ss in samples.values())
print(f'{total} glyphs from {len([k for k in truth if not k.startswith("_")])} screenshots; '
      f'per digit: {", ".join(f"{d}:{tpl[d]["n"]}" for d in sorted(tpl))}')
print(f'round trip: {bad} misclassified, worst score {worst:.3f}')
if bad: sys.exit('templates do not round-trip; not writing')

lines = []
for d in sorted(tpl):
    q = np.clip(np.round(tpl[d]['raw'] * 255), 0, 255).astype(np.uint8)
    lines.append(f'  {{ digit: "{d}", aspect: {tpl[d]["aspect"]:.4f}, data: "{base64.b64encode(q.tobytes()).decode()}" }},')
ts = ('// Generated by scripts/gen-digit-templates.py - do not edit by hand.\n'
      '// Mean glyph bitmaps for the Project Sekai result-screen digits, harvested from\n'
      f'// every screenshot in example/truth.json ({total} glyphs) and stored as {GW}x{GH}\n'
      '// area-averaged ink maps (uint8, row major).\n\n'
      f'export const DIGIT_GRID = {{ width: {GW}, height: {GH} }} as const;\n\n'
      'export interface DigitTemplate {\n  digit: string;\n  /** mean glyph width / height, used to tell 1 from the rest */\n  aspect: number;\n'
      f'  /** base64 of {GW*GH} bytes */\n  data: string;\n}}\n\n'
      'export const DIGIT_TEMPLATES: DigitTemplate[] = [\n' + '\n'.join(lines) + '\n];\n')
open(os.path.join(ROOT, 'src/lib/pipeline/digit-templates.ts'), 'w').write(ts)
print('wrote src/lib/pipeline/digit-templates.ts')
