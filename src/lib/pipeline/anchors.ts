// The result screen is not one fixed layout. The top block (title, score, high
// score) stays put, but everything below it slides: the current solo layout
// puts PERFECT at y=0.571, the older one at 0.608, and a challenge live inserts
// a チャレンジP panel that pushes it down to 0.668. Fixed boxes calibrated on one
// of those read garbage on the others - so the lower block is anchored on the
// judgement rows themselves, found by scanning for their label text.

import type { Box } from "./regions";

export interface JudgementAnchor {
  /** normalized y of the PERFECT row's centre */
  perfectY: number;
  /** normalized row pitch - PERFECT to GREAT to GOOD ... */
  pitch: number;
}

/** where the PERFECT / GREAT / GOOD / BAD / MISS labels sit, generously */
const LABEL_COLUMN: Box = { x0: 0.185, y0: 0.45, x1: 0.27, y1: 0.95 };

/** rows are ~0.06 apart on every layout seen; anything else is not the block */
const PITCH_MIN = 0.05;
const PITCH_MAX = 0.07;

export function findJudgementRows(image: ImageData): JudgementAnchor | null {
  const x0 = Math.round(LABEL_COLUMN.x0 * image.width);
  const x1 = Math.round(LABEL_COLUMN.x1 * image.width);
  const y0 = Math.round(LABEL_COLUMN.y0 * image.height);
  const y1 = Math.round(LABEL_COLUMN.y1 * image.height);

  // bright label text per row
  const counts = new Int32Array(y1 - y0);
  let peak = 0;
  for (let y = y0; y < y1; y++) {
    let count = 0;
    for (let x = x0; x < x1; x++) {
      const at = (y * image.width + x) * 4;
      const luma = image.data[at] * 0.299 + image.data[at + 1] * 0.587 + image.data[at + 2] * 0.114;
      if (luma > 140) count += 1;
    }
    counts[y - y0] = count;
    if (count > peak) peak = count;
  }
  if (peak === 0) return null;

  const cut = Math.max(3, peak * 0.15);
  const minHeight = Math.max(3, Math.round(image.height * 0.005));
  const centers: number[] = [];
  let start = -1;
  for (let i = 0; i <= counts.length; i++) {
    const on = i < counts.length && counts[i] > cut;
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      if (i - start >= minHeight) centers.push((y0 + (start + i) / 2) / image.height);
      start = -1;
    }
  }

  // the five judgement rows are the first run of five bands at a steady pitch;
  // a challenge panel or a banner above them shows up as an extra band and is
  // skipped by the pitch test
  for (let i = 0; i + 4 < centers.length; i++) {
    const gaps = [1, 2, 3, 4].map((k) => centers[i + k] - centers[i + k - 1]);
    if (gaps.every((gap) => gap >= PITCH_MIN && gap <= PITCH_MAX)) {
      return { perfectY: centers[i], pitch: gaps.reduce((a, b) => a + b, 0) / 4 };
    }
  }

  return null;
}
