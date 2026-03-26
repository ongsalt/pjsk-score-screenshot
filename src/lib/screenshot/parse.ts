import type { RecognizeResult } from "tesseract.js";

export interface BoundingLines {
  y1: number; // normalized from 0 - 1
  y2: number;
  x1: number;
}

const DEFAULT_BOUNDING_LINE: BoundingLines = {
  y1: 0.2,
  y2: 0.55,
  x1: 0.55
}

export interface ParseResult {
  score?: number;
  scoreRank?: string; // its C B A S or so i dont remember, so just make this a string
  highScore?: number;
  maxCombo?: number;

  perfect?: number;
  great?: number;
  good?: number;
  bad?: number;
  miss?: number;

  detail: {
    late?: number;
    early?: number; // in jp this say "fast"
    wrongWay?: number; // in jp this say "flick: ${number}"
  };

  song: {
    name?: string;
    difficulty?: "easy" | "normal" | "hard" | "master" | "append";
    level?: number;
  };
}

export function parseScore(
  recognizedResult: RecognizeResult,
  width: number,
  height: number,
  boundingLines: BoundingLines = DEFAULT_BOUNDING_LINE, // TODO: calculate this
): ParseResult {

  return {
    detail: {},
    song: {},
  }
}

