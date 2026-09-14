// Screenshot -> result fields. Numbers come from template matching (digits.ts)
// and the difficulty from the colour of the pill under the title; that is all
// extractResult() does, and it needs no model. The song title is a separate,
// deliberately optional step (readTitle) because it is the expensive and least
// reliable one: it loads 112 MiB of manga-ocr, and the judgement total plus
// difficulty plus level already identifies most charts without it.
//
// Nothing here talks to the music database - matching is musicRepository's job.

import { findJudgementRows } from "./anchors";
import { readDigits, regionContrast, MIN_CONFIDENCE } from "./digits";
import { getMangaOcr, type MangaOcrOptions } from "./manga-ocr";
import {
  ABSENT_OK_FIELDS,
  CALIBRATED_PERFECT_Y,
  CALIBRATED_PITCH,
  DIFFICULTY_CHIP,
  DIFFICULTY_COLORS,
  OPTIONAL_FIELDS,
  TITLE,
  TOP_REGIONS,
  judgementPanel,
  lowerBlockRegions,
  type Box,
  type Difficulty,
  type NumericField,
  type NumericRegion,
} from "./regions";

export interface ExtractedResult {
  score: number | null;
  highScore: number | null;
  /** chart level off the difficulty pill, a cross-check and a fallback key */
  level: number | null;
  perfect: number | null;
  great: number | null;
  good: number | null;
  bad: number | null;
  miss: number | null;
  maxCombo: number | null;
  late: number | null;
  early: number | null;
  wrongWay: number | null;

  /** false when the screenshot has no late/early/wrong-way card */
  hasJudgementDetail: boolean;
  difficulty: Difficulty | null;
  /** 0..1, gap between the best and second best pill colour */
  difficultyConfidence: number;
  /** perfect + great + good + bad + miss, used to pin down which chart this is */
  noteCount: number | null;
  /** false when the judgement rows could not be located and defaults were used */
  anchored: boolean;

  confidence: Record<NumericField, number>;
  /** fields whose glyphs did not match cleanly - the form highlights these */
  needsReview: NumericField[];
}

/** everything the digits and the pill colour give - no model involved */
export async function extractResult(source: ImageBitmapSource): Promise<ExtractedResult> {
  const image = await toImageData(source);

  const values = {} as Record<NumericField, number | null>;
  const confidence = {} as Record<NumericField, number>;
  const needsReview: NumericField[] = [];

  // the lower block sits at a different height on each layout; find it rather
  // than assume it, and fall back to the calibrated position if that fails
  const anchor = findJudgementRows(image);
  const perfectY = anchor?.perfectY ?? CALIBRATED_PERFECT_Y;
  const pitch = anchor?.pitch ?? CALIBRATED_PITCH;

  const regions: Record<NumericField, NumericRegion> = {
    ...TOP_REGIONS,
    ...lowerBlockRegions(perfectY, pitch),
  };

  // the panel is missing entirely on screenshots taken without judgement details
  const hasJudgementDetail = regionContrast(image, judgementPanel(perfectY, pitch)) > 0.15;

  for (const [key, region] of Object.entries(regions)) {
    const field = key as NumericField;
    const optional = (OPTIONAL_FIELDS as readonly string[]).includes(field);
    // high score and the timing card are legitimately absent on some modes
    const absentOk = (ABSENT_OK_FIELDS as readonly string[]).includes(field);

    if (optional && !hasJudgementDetail) {
      values[field] = null;
      confidence[field] = 0;
      continue;
    }

    const reading = readDigits(image, region, region.metric);
    const plausible =
      reading.value !== null &&
      reading.confidence >= MIN_CONFIDENCE &&
      (region.digits === undefined || reading.glyphs === region.digits) &&
      // levels run 1..40; anything else is the label bleeding into the box
      (field !== "level" || (reading.glyphs <= 2 && reading.value >= 1 && reading.value <= 40));

    values[field] = plausible ? reading.value : null;
    confidence[field] = reading.confidence;
    if (!plausible && !absentOk) needsReview.push(field);
  }

  const noteCount =
    values.perfect !== null && values.great !== null && values.good !== null &&
    values.bad !== null && values.miss !== null
      ? values.perfect + values.great + values.good + values.bad + values.miss
      : null;

  const difficulty = readDifficulty(image);

  return {
    ...values,
    hasJudgementDetail,
    difficulty: difficulty.value,
    difficultyConfidence: difficulty.confidence,
    noteCount,
    anchored: anchor !== null,
    confidence,
    needsReview,
  } as ExtractedResult;
}

/** the pill is a flat saturated colour, so the median of its saturated half is enough */
function readDifficulty(image: ImageData) {
  const x0 = Math.round(DIFFICULTY_CHIP.x0 * image.width);
  const x1 = Math.round(DIFFICULTY_CHIP.x1 * image.width);
  const y0 = Math.round(DIFFICULTY_CHIP.y0 * image.height);
  const y1 = Math.round(DIFFICULTY_CHIP.y1 * image.height);

  const pixels: [number, number, number, number][] = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const at = (y * image.width + x) * 4;
      const r = image.data[at];
      const g = image.data[at + 1];
      const b = image.data[at + 2];
      pixels.push([r, g, b, Math.max(r, g, b) - Math.min(r, g, b)]);
    }
  }
  if (pixels.length === 0) return { value: null, confidence: 0 };

  const cutoff = median(pixels.map((p) => p[3]));
  const chip = pixels.filter((p) => p[3] >= cutoff);
  const colour: [number, number, number] = [
    median(chip.map((p) => p[0])),
    median(chip.map((p) => p[1])),
    median(chip.map((p) => p[2])),
  ];

  const ranked = (Object.entries(DIFFICULTY_COLORS) as [Difficulty, [number, number, number]][])
    .map(([name, reference]) => ({ name, distance: chromaDistance(colour, reference) }))
    .sort((a, b) => a.distance - b.distance);

  return {
    value: ranked[0].distance < 0.2 ? ranked[0].name : null,
    // how much better the winner is than the runner up
    confidence: Math.min(1, (ranked[1].distance - ranked[0].distance) * 5),
  };
}

/** compare hue/ratio rather than raw rgb so screenshot brightness does not matter */
function chromaDistance(a: [number, number, number], b: [number, number, number]) {
  const sa = Math.max(1, a[0] + a[1] + a[2]);
  const sb = Math.max(1, b[0] + b[1] + b[2]);
  let sum = 0;
  for (let i = 0; i < 3; i++) sum += (a[i] / sa - b[i] / sb) ** 2;
  return Math.sqrt(sum);
}

/**
 * The song title via manga-ocr. Loads the model on first use, so only call it
 * when the numbers could not identify the chart on their own.
 */
export async function readTitle(source: ImageBitmapSource, options?: MangaOcrOptions) {
  const crop = tightCrop(await toImageData(source), TITLE);
  if (!crop) return "";
  const ocr = await getMangaOcr(options);
  return await ocr.recognize(crop);
}

/**
 * The title is dark text on the light header bar, so trim to the dark pixels
 * before handing it over - manga-ocr wants a tight line, not a padded box.
 */
function tightCrop(image: ImageData, box: Box): ImageData | null {
  const x0 = Math.round(box.x0 * image.width);
  const x1 = Math.round(box.x1 * image.width);
  const y0 = Math.round(box.y0 * image.height);
  const y1 = Math.round(box.y1 * image.height);
  const width = x1 - x0;
  const height = y1 - y0;
  if (width < 2 || height < 2) return null;

  const luma = new Float32Array(width * height);
  let min = 255;
  let max = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = ((y0 + y) * image.width + (x0 + x)) * 4;
      const value =
        image.data[at] * 0.299 + image.data[at + 1] * 0.587 + image.data[at + 2] * 0.114;
      luma[y * width + x] = value;
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }
  if (max - min < 20) return null;

  const threshold = min + (max - min) * 0.5;
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (luma[y * width + x] < threshold) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < left || bottom < top) return null;

  const pad = Math.round((bottom - top + 1) * 0.15);
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  right = Math.min(width - 1, right + pad);
  bottom = Math.min(height - 1, bottom + pad);

  const cropWidth = right - left + 1;
  const cropHeight = bottom - top + 1;
  const out = new ImageData(cropWidth, cropHeight);
  for (let y = 0; y < cropHeight; y++) {
    for (let x = 0; x < cropWidth; x++) {
      const from = ((y0 + top + y) * image.width + (x0 + left + x)) * 4;
      const to = (y * cropWidth + x) * 4;
      out.data[to] = image.data[from];
      out.data[to + 1] = image.data[from + 1];
      out.data[to + 2] = image.data[from + 2];
      out.data[to + 3] = 255;
    }
  }
  return out;
}

export async function toImageData(source: ImageBitmapSource): Promise<ImageData> {
  if (typeof ImageData !== "undefined" && source instanceof ImageData) return source;

  const bitmap = await createImageBitmap(source);
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(bitmap.width, bitmap.height)
      : Object.assign(document.createElement("canvas"), {
          width: bitmap.width,
          height: bitmap.height,
        });

  const context = canvas.getContext("2d", { willReadFrequently: true }) as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!context) throw new Error("no 2d canvas context");

  context.drawImage(bitmap, 0, 0);
  const data = context.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close();
  return data;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
