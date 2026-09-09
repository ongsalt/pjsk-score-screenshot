// Where things live on the result screen, as fractions of the screenshot.
//
// Calibrated against example/jp_with_judgement.png (1594x735) and
// example/en_with_judgement.png (2340x1080) - both ~2.167 aspect, and every
// region lands identically on both, so plain fractions are enough for now.
//
// KNOWN GAP: a screenshot taken mid-transition has the whole layout slid to the
// left, which throws every box off. Not handled - the extractor reports low
// confidence and the /add form lets you fix it by hand.

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * How to tell ink from background:
 * - `luma`: bright text on a dark panel (everything on the left half)
 * - `white`: white text sitting on a saturated pink/blue bar, where luminance
 *   alone would pick the bar instead of the digits
 */
export type InkMetric = "luma" | "white";

export interface NumericRegion extends Box {
  metric: InkMetric;
  /** how many digits the game pads this field to, for a sanity check */
  digits?: number;
}

const REGION_DEFS = {
  score: { x0: 0.274, y0: 0.28, x1: 0.525, y1: 0.385, metric: "luma", digits: 8 },
  highScore: { x0: 0.398, y0: 0.392, x1: 0.525, y1: 0.455, metric: "luma", digits: 8 },
  perfect: { x0: 0.278, y0: 0.578, x1: 0.348, y1: 0.632, metric: "luma", digits: 4 },
  great: { x0: 0.278, y0: 0.638, x1: 0.348, y1: 0.692, metric: "luma", digits: 4 },
  good: { x0: 0.278, y0: 0.698, x1: 0.348, y1: 0.752, metric: "luma", digits: 4 },
  bad: { x0: 0.278, y0: 0.758, x1: 0.348, y1: 0.812, metric: "luma", digits: 4 },
  miss: { x0: 0.278, y0: 0.818, x1: 0.348, y1: 0.872, metric: "luma", digits: 4 },
  maxCombo: { x0: 0.435, y0: 0.575, x1: 0.518, y1: 0.642, metric: "luma" },
  late: { x0: 0.368, y0: 0.748, x1: 0.415, y1: 0.795, metric: "white" },
  early: { x0: 0.466, y0: 0.748, x1: 0.503, y1: 0.795, metric: "white" },
  wrongWay: { x0: 0.468, y0: 0.81, x1: 0.503, y1: 0.858, metric: "white" },
} as const satisfies Record<string, NumericRegion>;

export type NumericField = keyof typeof REGION_DEFS;

export const NUMERIC_REGIONS: Record<NumericField, NumericRegion> = REGION_DEFS;

/** only present on "with judgement" screenshots */
export const OPTIONAL_FIELDS = ["late", "early", "wrongWay"] as const;

/** the whole late/early/wrong-way card, used to detect whether it is there at all */
export const JUDGEMENT_PANEL: Box = { x0: 0.36, y0: 0.7, x1: 0.52, y1: 0.87 };

/** song title, dark text on the light header bar - feed this one to manga-ocr */
export const TITLE: Box = { x0: 0.248, y0: 0.026, x1: 0.5, y1: 0.084 };

/** the coloured difficulty pill under the title */
export const DIFFICULTY_CHIP: Box = { x0: 0.258, y0: 0.098, x1: 0.33, y1: 0.13 };

export type Difficulty = "easy" | "normal" | "hard" | "expert" | "master" | "append";

/**
 * Pill colours. `expert` and `master` are sampled straight off the examples;
 * the rest are the game's palette. Matched on chromaticity, not raw rgb, so
 * screenshot brightness does not matter.
 */
export const DIFFICULTY_COLORS: Record<Difficulty, [number, number, number]> = {
  easy: [0x66, 0xdd, 0x11],
  normal: [0x33, 0xbb, 0xdd],
  hard: [0xff, 0xaa, 0x00],
  expert: [0xff, 0x44, 0x77],
  master: [0xcc, 0x33, 0xff],
  append: [0xff, 0x88, 0xbb],
};
