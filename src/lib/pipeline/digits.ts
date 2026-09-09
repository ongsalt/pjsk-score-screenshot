// Reads the result-screen numbers by matching each glyph against the templates
// in digit-templates.ts. The game renders these in a fixed, near-monospaced
// font, so this beats a general OCR engine on both accuracy and speed - and it
// hands back a per-glyph correlation, which is what the UI uses to decide
// whether to flag a field.
//
// The algorithm here is a straight port of scripts/gen-digit-templates.py, which
// generated the templates. Keep the two in step - especially areaResize, whose
// exact resampling is baked into the template values.

import { DIGIT_GRID, DIGIT_TEMPLATES } from "./digit-templates";
import type { Box, InkMetric } from "./regions";

/** below this the read is not trustworthy; the form marks the field for review */
export const MIN_CONFIDENCE = 0.7;

const GLYPH_SIZE = DIGIT_GRID.width * DIGIT_GRID.height;

interface Template {
  digit: string;
  aspect: number;
  vector: Float32Array;
}

const templates: Template[] = DIGIT_TEMPLATES.map((template) => ({
  digit: template.digit,
  aspect: template.aspect,
  vector: unitVector(decodeTemplate(template.data)),
}));

export interface DigitReading {
  text: string;
  value: number | null;
  /** lowest per-glyph correlation, 1 being a perfect match */
  confidence: number;
  glyphs: number;
}

interface Plane {
  values: Float32Array;
  width: number;
  height: number;
}

export function readDigits(image: ImageData, box: Box, metric: InkMetric = "luma"): DigitReading {
  const empty: DigitReading = { text: "", value: null, confidence: 0, glyphs: 0 };
  const plane = metricPlane(image, box, metric);
  if (plane.width < 2 || plane.height < 2) return empty;

  const threshold = otsu(plane.values);
  let peak = 0;
  for (const value of plane.values) if (value > peak) peak = value;
  const span = Math.max(1, peak - threshold);

  const mask = new Uint8Array(plane.values.length);
  const ink = new Float32Array(plane.values.length);
  for (let i = 0; i < plane.values.length; i++) {
    if (plane.values[i] > threshold) {
      mask[i] = 1;
      ink[i] = Math.min(1, (plane.values[i] - threshold) / span);
    }
  }

  // the digits sit on one horizontal band; find the tallest one and ignore the rest
  const rowCounts = new Int32Array(plane.height);
  let rowPeak = 0;
  for (let y = 0; y < plane.height; y++) {
    let count = 0;
    for (let x = 0; x < plane.width; x++) count += mask[y * plane.width + x];
    rowCounts[y] = count;
    if (count > rowPeak) rowPeak = count;
  }
  const rowCut = Math.max(1, rowPeak * 0.08);
  const bands = runs(plane.height, (y) => rowCounts[y] > rowCut);
  if (bands.length === 0) return empty;
  const band = bands.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a));
  const bandHeight = band.end - band.start;

  const columns = runs(plane.width, (x) => {
    for (let y = band.start; y < band.end; y++) if (mask[y * plane.width + x]) return true;
    return false;
  });

  let text = "";
  let confidence = 1;
  let glyphs = 0;

  for (const column of columns) {
    const width = column.end - column.start;
    if (width < Math.max(2, bandHeight * 0.06)) continue;

    let top = -1;
    let bottom = -1;
    for (let y = band.start; y < band.end; y++) {
      let inked = false;
      for (let x = column.start; x < column.end; x++) {
        if (mask[y * plane.width + x]) {
          inked = true;
          break;
        }
      }
      if (inked) {
        if (top < 0) top = y;
        bottom = y;
      }
    }
    // specks and stray bar edges, not glyphs
    if (top < 0 || bottom - top < bandHeight * 0.35) continue;

    const height = bottom - top + 1;
    const glyph = areaResize(ink, plane.width, column.start, top, width, height);
    const match = classify(glyph, width / height);

    text += match.digit;
    confidence = Math.min(confidence, match.score);
    glyphs += 1;
  }

  if (glyphs === 0) return empty;
  return { text, value: Number.parseInt(text, 10), confidence, glyphs };
}

/**
 * Spread between the bright pixels and the median. A region whose panel is not
 * on screen is a smooth background gradient and scores near zero.
 */
export function regionContrast(image: ImageData, box: Box, metric: InkMetric = "luma"): number {
  const plane = metricPlane(image, box, metric);
  if (plane.values.length === 0) return 0;
  const sorted = Float32Array.from(plane.values).sort();
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
  return (at(0.99) - at(0.5)) / 255;
}

function classify(glyph: Float32Array, aspect: number) {
  const vector = unitVector(glyph);
  let best = { digit: "", score: -Infinity };
  for (const template of templates) {
    let dot = 0;
    for (let i = 0; i < GLYPH_SIZE; i++) dot += vector[i] * template.vector[i];
    // the aspect term is what keeps a 1 from matching everything
    const score = dot - 0.25 * Math.abs(aspect - template.aspect);
    if (score > best.score) best = { digit: template.digit, score };
  }
  return best;
}

function metricPlane(image: ImageData, box: Box, metric: InkMetric): Plane {
  const x0 = clamp(Math.round(box.x0 * image.width), 0, image.width);
  const x1 = clamp(Math.round(box.x1 * image.width), 0, image.width);
  const y0 = clamp(Math.round(box.y0 * image.height), 0, image.height);
  const y1 = clamp(Math.round(box.y1 * image.height), 0, image.height);
  const width = Math.max(0, x1 - x0);
  const height = Math.max(0, y1 - y0);
  const values = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const source = ((y0 + y) * image.width + (x0 + x)) * 4;
      const r = image.data[source];
      const g = image.data[source + 1];
      const b = image.data[source + 2];
      values[y * width + x] =
        metric === "white" ? Math.min(r, g, b) : r * 0.299 + g * 0.587 + b * 0.114;
    }
  }

  return { values, width, height };
}

function otsu(values: Float32Array): number {
  const histogram = new Int32Array(256);
  for (const value of values) histogram[clamp(Math.round(value), 0, 255)] += 1;

  const total = values.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];

  let background = 0;
  let weighted = 0;
  let best = -1;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    background += histogram[t];
    if (background === 0 || background === total) continue;
    const foreground = total - background;
    weighted += t * histogram[t];
    const meanBackground = weighted / background;
    const meanForeground = (sum - weighted) / foreground;
    const variance =
      background * foreground * (meanBackground - meanForeground) * (meanBackground - meanForeground);
    if (variance > best) {
      best = variance;
      threshold = t;
    }
  }

  return threshold;
}

/** area-average resample of one glyph onto the template grid */
function areaResize(
  ink: Float32Array,
  stride: number,
  left: number,
  top: number,
  width: number,
  height: number,
): Float32Array {
  const { width: gw, height: gh } = DIGIT_GRID;
  const out = new Float32Array(gw * gh);

  for (let dy = 0; dy < gh; dy++) {
    const sy0 = (dy * height) / gh;
    const sy1 = ((dy + 1) * height) / gh;
    for (let dx = 0; dx < gw; dx++) {
      const sx0 = (dx * width) / gw;
      const sx1 = ((dx + 1) * width) / gw;

      let acc = 0;
      let weight = 0;
      for (let sy = Math.floor(sy0); sy < Math.min(height, Math.ceil(sy1)); sy++) {
        const wy = Math.min(sy1, sy + 1) - Math.max(sy0, sy);
        if (wy <= 0) continue;
        for (let sx = Math.floor(sx0); sx < Math.min(width, Math.ceil(sx1)); sx++) {
          const wx = Math.min(sx1, sx + 1) - Math.max(sx0, sx);
          if (wx <= 0) continue;
          acc += ink[(top + sy) * stride + (left + sx)] * wy * wx;
          weight += wy * wx;
        }
      }
      out[dy * gw + dx] = weight > 0 ? acc / weight : 0;
    }
  }

  return out;
}

function unitVector(values: Float32Array): Float32Array {
  let mean = 0;
  for (const value of values) mean += value;
  mean /= values.length;

  const out = new Float32Array(values.length);
  let norm = 0;
  for (let i = 0; i < values.length; i++) {
    out[i] = values[i] - mean;
    norm += out[i] * out[i];
  }

  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}

function decodeTemplate(data: string): Float32Array {
  const binary = atob(data);
  const out = new Float32Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i) / 255;
  return out;
}

function runs(length: number, test: (index: number) => boolean) {
  const out: { start: number; end: number }[] = [];
  let start = -1;
  for (let i = 0; i < length; i++) {
    if (test(i)) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      out.push({ start, end: i });
      start = -1;
    }
  }
  if (start >= 0) out.push({ start, end: length });
  return out;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
