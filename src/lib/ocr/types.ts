import type { Difficulty, Result } from '$lib/spec';

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrWord {
  text: string;
  normalized: string;
  confidence: number;
  bbox: Rect;
  centerX: number;
  centerY: number;
}

export interface OcrLine {
  text: string;
  normalized: string;
  confidence: number;
  words: OcrWord[];
  bbox: Rect;
  centerY: number;
}

export interface OcrPage {
  text: string;
  normalizedText: string;
  words: OcrWord[];
  lines: OcrLine[];
  width: number;
  height: number;
}

export interface ParsedResult {
  result: Result;
  warnings: string[];
}

export interface ExtractionOutput {
  result: Result;
  warnings: string[];
  rawText: string;
}

export interface RecognizeOptions {
  languages: string;
}

export interface ExtractOptions {
  languages?: string;
  includeRawText?: boolean;
}

export interface LabelMatch {
  line: OcrLine;
  label: string;
}

export interface SongGuess {
  name: string;
  confidence: number;
}

export interface DifficultyGuess {
  difficulty: Difficulty;
  confidence: number;
}
