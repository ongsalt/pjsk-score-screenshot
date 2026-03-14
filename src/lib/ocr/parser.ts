import type { Difficulty, Result } from "$lib/spec";

import {
  hasMeaningfulText,
  isMostlyNumeric,
  parseIntegerFromText,
} from "./normalize";
import type { OcrLine, OcrPage, ParsedResult, SongGuess } from "./types";

const SCORE_RANKS = ["sss", "ss", "s", "a", "b", "c", "d"];

interface NumericPoint {
  value: number;
  x: number;
  y: number;
}

function readNumericPoints(page: OcrPage): NumericPoint[] {
  const points: NumericPoint[] = [];

  for (const line of page.lines) {
    for (const word of line.words) {
      const value = parseIntegerFromText(word.text);
      if (value === null) {
        continue;
      }

      points.push({
        value,
        x: word.centerX,
        y: word.centerY,
      });
    }
  }

  return points;
}

function pickScore(page: OcrPage, points: NumericPoint[]): number {
  const candidates = points
    .filter((point) => point.y < page.height * 0.36)
    .filter((point) => point.x > page.width * 0.16)
    .filter((point) => point.value >= 10000)
    .sort((a, b) => b.value - a.value);

  return candidates[0]?.value ?? 0;
}

function pickHighScore(
  page: OcrPage,
  points: NumericPoint[],
  score: number,
): number {
  const candidates = points
    .filter((point) => point.y < page.height * 0.5)
    .filter((point) => point.x > page.width * 0.45)
    .filter((point) => point.value >= 10000)
    .filter((point) => point.value !== score)
    .sort((a, b) => b.value - a.value);

  return candidates[0]?.value ?? 0;
}

function pickJudgeValues(page: OcrPage, points: NumericPoint[]): number[] {
  console.log(points);
  const candidates = points
    .filter((point) => point.y > page.height * 0.45 && point.y)
    .filter((point) => point.x > page.width * 0.3)
    .filter((point) => point.value <= 9999)
    .sort((a, b) => {
      const dx = a.x - b.x;
      if (dx != 0) {
        return dx;
      }

      return a.y - b.y;
    });

  // group

  const deduped: NumericPoint[] = [];
  for (const point of candidates) {
    const previous = deduped[deduped.length - 1];
    if (previous && Math.abs(previous.y - point.y) < page.height * 0.02) {
      if (point.value > previous.value) {
        deduped[deduped.length - 1] = point;
      }
      continue;
    }
    deduped.push(point);
  }

  return deduped.slice(0, 5).map((point) => point.value);
}

function pickMaxCombo(
  page: OcrPage,
  points: NumericPoint[],
  usedJudgeValues: number[],
): number {
  const candidates = points
    .filter((point) => point.y > page.height * 0.48)
    .filter((point) => point.x > page.width * 0.42)
    .filter((point) => point.value <= 9999)
    .filter((point) => !usedJudgeValues.includes(point.value))
    .sort((a, b) => b.value - a.value);

  return candidates[0]?.value ?? 0;
}

function guessSongName(page: OcrPage): SongGuess {
  const candidates = page.lines
    .filter((line) => line.bbox.y0 < page.height * 0.3)
    .filter((line) => line.bbox.x0 < page.width * 0.72)
    .filter((line) => hasMeaningfulText(line.text))
    .filter((line) => !isMostlyNumeric(line.text))
    .sort(
      (a, b) => b.text.length * b.confidence - a.text.length * a.confidence,
    );

  const best = candidates[0];
  if (!best) {
    return { name: "", confidence: 0 };
  }

  return {
    name: best.text,
    confidence: Math.min(1, best.confidence / 90),
  };
}

function guessRank(page: OcrPage): string {
  const leftTopLines = page.lines.filter(
    (line) =>
      line.bbox.x0 < page.width * 0.4 && line.bbox.y0 < page.height * 0.6,
  );

  for (const rank of SCORE_RANKS) {
    const found = leftTopLines
      .flatMap((line) => line.words)
      .find((word) => word.normalized === rank);

    if (found) {
      return rank.toUpperCase();
    }
  }

  return "";
}

function guessLevel(page: OcrPage, points: NumericPoint[]): number {
  const candidates = points
    .filter((point) => point.y < page.height * 0.32)
    .filter((point) => point.x > page.width * 0.55)
    .filter((point) => point.value > 0 && point.value <= 40)
    .sort((a, b) => b.y - a.y);

  return candidates[0]?.value ?? 0;
}

function guessDifficultyFromPosition(page: OcrPage): Difficulty {
  const candidates = page.lines
    .filter((line) => line.bbox.y0 < page.height * 0.32)
    .filter((line) => line.bbox.x0 > page.width * 0.44)
    .filter((line) => hasMeaningfulText(line.text))
    .filter((line) => !isMostlyNumeric(line.text))
    .sort((a, b) => b.confidence - a.confidence);

  const text = candidates[0]?.normalized ?? "";

  if (text.includes("easy")) {
    return "easy";
  }
  if (text.includes("normal")) {
    return "normal";
  }
  if (text.includes("hard")) {
    return "hard";
  }
  if (text.includes("master")) {
    return "master";
  }
  if (text.includes("append")) {
    return "append";
  }

  return "";
}

export function parseResultFromPage(page: OcrPage): ParsedResult {
  const warnings: string[] = [];
  const points = readNumericPoints(page);

  const score = pickScore(page, points);
  const highScore = pickHighScore(page, points, score);
  const judgeValues = pickJudgeValues(page, points);

  const perfect = judgeValues[0] ?? 0;
  const great = judgeValues[1] ?? 0;
  const good = judgeValues[2] ?? 0;
  const bad = judgeValues[3] ?? 0;
  const miss = judgeValues[4] ?? 0;
  const maxCombo = pickMaxCombo(page, points, judgeValues);

  if (score === 0) {
    warnings.push("Main score could not be located by position.");
  }

  if (highScore === 0) {
    warnings.push("High score could not be located by position.");
  }

  if (judgeValues.length < 5) {
    warnings.push(
      "Could not confidently locate all PERFECT/GREAT/GOOD/BAD/MISS rows by position.",
    );
  }

  const song = guessSongName(page);
  if (song.confidence < 0.3) {
    warnings.push("Song title could not be confidently located by position.");
  }

  const difficulty = guessDifficultyFromPosition(page);
  if (difficulty === "") {
    warnings.push(
      "Difficulty could not be inferred from position and was left empty.",
    );
  }

  const level = guessLevel(page, points);
  if (level === 0) {
    warnings.push(
      "Song level could not be inferred from position and was left as 0.",
    );
  }

  const result: Result = {
    score,
    scoreRank: guessRank(page),
    highScore,
    perfect,
    great,
    good,
    bad,
    miss,
    maxCombo,
    song: {
      name: song.name,
      difficulty,
      level,
    },
  };

  // Detail fields are intentionally omitted unless we have reliable positional anchors.

  return {
    result,
    warnings,
  };
}
