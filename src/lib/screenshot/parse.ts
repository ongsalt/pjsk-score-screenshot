import type { RecognizeResult } from "./ocr/tesseract";

export interface BoundingLines {
  y1: number; // normalized from 0 - 1
  y2: number;
  x1: number;
}

const DEFAULT_BOUNDING_LINE: BoundingLines = {
  y1: 0.2,
  y2: 0.55,
  x1: 0.55,
};

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

export function parseResult(
  recognizedResult: RecognizeResult,
  width: number,
  height: number,
  boundingLines: BoundingLines = DEFAULT_BOUNDING_LINE, // TODO: calculate this
): ParseResult {
  const song = parseSongDetail(recognizedResult);
  const judgements = parseJudgement(recognizedResult, width, height, boundingLines);

  return {
    ...judgements,
    detail: {},
    song: {
      name: song.name,
    },
  };
}

function parseJudgement(recognizedResult: RecognizeResult) {
  const blocks = recognizedResult.blocks;

  const groups = cluster(blocks, (it) => it.bounds.x0);
  // console.log(groups);

  // there is only 2 group with the same x that contain more than 3 element
  // ["score", "highscore", ...judgementList] and [diffName, ...count]
  const secondGroup = groups.filter((it) => it.length > 3)[1];
  const onlyLast5 =
    secondGroup.length === 5 ? secondGroup : secondGroup.slice(-5, -1);
  const [prefect, great, good, bad, miss] = onlyLast5
    .toSorted((a, b) => a.bounds.y0 - b.bounds.y0)
    .map((it) => parseInt(it.text.trim()));

  return {
    prefect,
    great,
    good,
    bad,
    miss,
  };
}

function parseSongDetail(
  recognizedResult: RecognizeResult,
  // width: number,
  // height: number,
  // boundingLines: BoundingLines = DEFAULT_BOUNDING_LINE, // TODO: calculate this
) {
  const name = recognizedResult.blocks[0].text;

  // lv and difficulty is around here, but its sometime cannot be parsed
  return {
    name,
  };
}

function cluster<T>(
  items: T[],
  by: (item: T) => number,
  threshold: number = 4,
) {
  const groups: T[][] = [];

  const sorted = items.toSorted((a, b) => by(a) - by(b));
  for (const item of sorted) {
    const s = by(item);
    const prev = map(groups.at(-1)?.at(-1), by) ?? -threshold;

    if (s - prev > threshold || groups.length === 0) {
      groups.push([item]);
    } else {
      groups.at(-1)!.push(item);
    }
  }

  return groups;
}

function map<T, S>(value: T | null | undefined, fn: (value: T) => S) {
  if (value == null || value == undefined) {
    return value as null | undefined;
  }

  return fn(value);
}
