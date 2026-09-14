// Where things live on the result screen, as fractions of the screenshot.
//
// The TOP block (score, high score, title, difficulty) is fixed: the same
// fractions land on every layout seen so far. The LOWER block (judgements,
// combo, late/fast, flick) moves between layouts, so its boxes are not fixed
// fractions - they are built from the detected PERFECT row by
// `lowerBlockRegions()`. See anchors.ts for why.
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

/** fixed on every layout: the top block does not move */
export const TOP_REGIONS = {
  score: { x0: 0.274, y0: 0.28, x1: 0.525, y1: 0.385, metric: "luma", digits: 8 },
  highScore: { x0: 0.398, y0: 0.392, x1: 0.525, y1: 0.455, metric: "luma", digits: 8 },
  /** the digits after "Lv." on the difficulty pill; the label ends at ~0.375 on both servers */
  level: { x0: 0.378, y0: 0.095, x1: 0.415, y1: 0.135, metric: "luma" },
} as const satisfies Record<string, NumericRegion>;

export type NumericField =
  | keyof typeof TOP_REGIONS
  | "perfect"
  | "great"
  | "good"
  | "bad"
  | "miss"
  | "maxCombo"
  | "late"
  | "early"
  | "wrongWay";

export const NUMERIC_FIELDS: NumericField[] = [
  "score",
  "highScore",
  "level",
  "perfect",
  "great",
  "good",
  "bad",
  "miss",
  "maxCombo",
  "late",
  "early",
  "wrongWay",
];

/** the judgement rows in screen order */
export const JUDGEMENT_ROWS = ["perfect", "great", "good", "bad", "miss"] as const;

/** only present on "with judgement" screenshots */
export const OPTIONAL_FIELDS = ["late", "early", "wrongWay"] as const;

/** high score is simply absent on some live modes */
export const ABSENT_OK_FIELDS = ["highScore", ...OPTIONAL_FIELDS] as const;

/**
 * The PERFECT row as the calibration screenshots' detector saw it. Every lower
 * block box below is expressed relative to the row that is actually found.
 */
export const CALIBRATED_PERFECT_Y = 0.6085;
export const CALIBRATED_PITCH = 0.06;

/**
 * Lower-block boxes, placed off the detected PERFECT row and row pitch. The x
 * ranges are the calibrated ones - only the vertical position varies between
 * layouts. Offsets are in units of row pitch so a differently scaled UI still
 * lines up.
 */
export function lowerBlockRegions(perfectY: number, pitch: number) {
  const rowHalf = pitch * 0.45;
  const row = (index: number, extra: Partial<NumericRegion> = {}): NumericRegion => ({
    x0: 0.278,
    x1: 0.348,
    y0: perfectY + index * pitch - rowHalf,
    y1: perfectY + index * pitch + rowHalf,
    metric: "luma",
    digits: 4,
    ...extra,
  });
  const at = (offset: number, half: number, box: Pick<Box, "x0" | "x1">, metric: InkMetric): NumericRegion => ({
    ...box,
    y0: perfectY + offset * pitch - half,
    y1: perfectY + offset * pitch + half,
    metric,
  });

  return {
    perfect: row(0),
    great: row(1),
    good: row(2),
    bad: row(3),
    miss: row(4),
    // COMBO sits on the PERFECT row, zero-padded to four digits like the rows
    maxCombo: { ...at(0, 0.0335, { x0: 0.435, x1: 0.518 }, "luma"), digits: 4 },
    // the late/fast bar and the flick line hang a fixed distance below the rows
    late: at(2.72, 0.0235, { x0: 0.368, x1: 0.415 }, "white"),
    early: at(2.72, 0.0235, { x0: 0.466, x1: 0.503 }, "white"),
    wrongWay: at(3.77, 0.024, { x0: 0.468, x1: 0.503 }, "white"),
  } satisfies Record<Exclude<NumericField, keyof typeof TOP_REGIONS>, NumericRegion>;
}

/** the whole late/early/wrong-way card, used to detect whether it is there at all */
export function judgementPanel(perfectY: number, pitch: number): Box {
  return { x0: 0.36, y0: perfectY + 1.55 * pitch, x1: 0.52, y1: perfectY + 4.35 * pitch };
}

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
