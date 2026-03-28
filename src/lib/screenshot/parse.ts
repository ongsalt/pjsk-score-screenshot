import { songId, type SongRepository } from "$lib/data/song.svelte";
import { he } from "zod/locales";
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

  // this shit should never be optional, but who know
  perfect?: number;
  great?: number;
  good?: number;
  bad?: number;
  miss?: number;
  noteCount?: number;

  late?: number;
  early?: number; // in jp this say "fast"
  wrongWay?: number; // in jp this say "flick: ${number}"

  song: {
    id?: number;
    difficultyId?: number;
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
  const judgements = parseJudgement(recognizedResult);
  const songDetail = parseSongDetail(
    recognizedResult,
    // songRepository,
    // judgements.noteCount,
  );

  const lateEarly = parseLateEarly(recognizedResult, width, height);

  return {
    ...judgements,
    ...lateEarly,
    song: {
      name: songDetail,
      // id: map(songDetail?.song, songId) ?? undefined,
      // name: songDetail?.song?.en?.title ?? songDetail?.song?.jp?.title,
      // difficultyId: songDetail?.difficulty?.id,
      // difficulty: songDetail?.difficulty?.musicDifficulty as any,
      // level: songDetail?.difficulty?.playLevel,
    },
  };
}

function parseJudgement(recognizedResult: RecognizeResult) {
  const blocks = recognizedResult.blocks;

  const groups = cluster(blocks, (it) => it.bounds.x0, 35);
  // console.log(groups);

  // there is only 2 group with the same x that contain more than 3 element
  // ["score", "highscore", ...judgementList] and [diffName, ...count]
  const secondGroup = groups.filter((it) => it.length > 3)[1];
  if (groups.length < 2) {
  }
  console.log(groups);
  const onlyLast5 = takeLastN(secondGroup, 5);
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
    noteCount: prefect + great + good + bad + miss,
  };
}

function parseLateEarly(
  recognizedResult: RecognizeResult,
  width: number,
  height: number,
) {
  const x = width / 2;
  const y = height;

  const { blocks } = recognizedResult;

  function distance(bounds: RecognizeResult["blocks"][number]["bounds"]) {
    return Math.sqrt((bounds.x1 - x) ** 2 + (bounds.y1 - y) ** 2);
  }

  function removeNonInt() {

  }

  // 4 closest number from bottom center
  // removing those with text "flick" or "wrong way"
  const candidates = blocks
    // .filter((it) => !isNaN(parseInt(it.text.trim())))
    .filter(
      (it) =>
        !it.text.toLowerCase().includes("flick") &&
        !it.text.toLowerCase().includes("wrong"),
    )
    .map((it) => ({ ...it, distance: distance(it.bounds) }))
    .toSorted((a, b) => a.distance - b.distance)
    .slice(0, 3)
    .map(it => it.text.trim())
    .map(it => it.replace(/\D/g, '')) // match every char
    .map(it => parseInt(it)) // match every char

  console.log(candidates);

  return {
    late: candidates[1],
    early: candidates[2],
    wrongWay: candidates[0],
  };
}

function parseSongDetail(recognizedResult: RecognizeResult) {
  const name = recognizedResult.blocks[0].text.trim();

  // lv and difficulty is around here, but its sometime cannot be parsed
  return name;
}

function cluster<T>(
  items: T[],
  by: (item: T) => number,
  threshold: number = 14,
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

function takeLastN<T>(array: T[], amount: number): T[] {
  return array.length === amount ? array : array.slice(-amount - 1, -1);
}
