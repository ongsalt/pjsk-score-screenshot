import type { RecognizeResult } from "tesseract.js";

export interface BoundingLines {
  y1: number; // normalized from 0 - 1
  y2: number;
  x1: number;
}

export function parseScore(
  recognizedResult: RecognizeResult,
  width: number,
  height: number,
  boundingLines?: BoundingLines, // TODO: calculate this
) {
  
}
