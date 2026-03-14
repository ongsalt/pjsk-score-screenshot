import Tesseract from 'tesseract.js';

import { normalizeForMatch, normalizeText } from './normalize';
import { preprocessImage, sanitizeRawText } from './preprocess';
import type { OcrLine, OcrPage, OcrWord, RecognizeOptions, Rect } from './types';

let workerPromise: Promise<Tesseract.Worker> | null = null;
let currentLanguages = '';

function hasDomCanvasSupport(): boolean {
  return typeof document !== 'undefined' && typeof document.createElement === 'function';
}

function inferSizeFromLines(lines: OcrLine[]): { width: number; height: number } {
  if (lines.length === 0) {
    return { width: 0, height: 0 };
  }

  const width = Math.max(...lines.map((line) => line.bbox.x1));
  const height = Math.max(...lines.map((line) => line.bbox.y1));
  return { width, height };
}

function toRect(bbox: Tesseract.Bbox): Rect {
  return {
    x0: bbox.x0,
    y0: bbox.y0,
    x1: bbox.x1,
    y1: bbox.y1
  };
}

function toWord(word: Tesseract.Word): OcrWord {
  const bbox = toRect(word.bbox);
  return {
    text: normalizeText(word.text),
    normalized: normalizeForMatch(word.text),
    confidence: word.confidence,
    bbox,
    centerX: (bbox.x0 + bbox.x1) / 2,
    centerY: (bbox.y0 + bbox.y1) / 2
  };
}

function toLine(line: Tesseract.Line): OcrLine {
  const words = line.words.map(toWord).filter((word) => word.text.length > 0);
  const bbox = toRect(line.bbox);

  return {
    text: normalizeText(line.text),
    normalized: normalizeForMatch(line.text),
    confidence: line.confidence,
    words,
    bbox,
    centerY: (bbox.y0 + bbox.y1) / 2
  };
}

async function getWorker(languages: string): Promise<Tesseract.Worker> {
  if (!workerPromise || currentLanguages !== languages) {
    if (workerPromise) {
      const previousWorker = await workerPromise;
      await previousWorker.terminate();
    }

    currentLanguages = languages;
    workerPromise = Tesseract.createWorker(languages);

    const worker = await workerPromise;
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
      preserve_interword_spaces: '1'
    });
  }

  return workerPromise;
}

export async function recognizePage(
  source: string | Blob | HTMLImageElement,
  options: RecognizeOptions
): Promise<OcrPage> {
  const usePreprocess = hasDomCanvasSupport();
  const imageInput = usePreprocess ? await preprocessImage(source) : source;
  const worker = await getWorker(options.languages);

  const recognized = await worker.recognize(imageInput, {}, { blocks: true, text: true });
  const page = recognized.data;

  const lines: OcrLine[] = [];

  for (const block of page.blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        const parsedLine = toLine(line);
        if (parsedLine.text.length > 0) {
          lines.push(parsedLine);
        }
      }
    }
  }

  const words = lines.flatMap((line) => line.words);
  const inferredSize = inferSizeFromLines(lines);

  return {
    text: sanitizeRawText(page.text),
    normalizedText: normalizeForMatch(page.text),
    words,
    lines,
    width: usePreprocess && imageInput instanceof HTMLCanvasElement ? imageInput.width : inferredSize.width,
    height:
      usePreprocess && imageInput instanceof HTMLCanvasElement ? imageInput.height : inferredSize.height
  };
}

export async function terminateRecognizer(): Promise<void> {
  if (!workerPromise) {
    return;
  }

  const worker = await workerPromise;
  await worker.terminate();
  workerPromise = null;
  currentLanguages = '';
}
