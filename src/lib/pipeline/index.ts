import { MangaOcr, type MangaOcrOptions } from "./manga-ocr";

export { MangaOcr, getMangaOcr, type MangaOcrOptions } from "./manga-ocr";
export { extractResult, type ExtractedResult } from "./extract";
export { readDigits, regionContrast, MIN_CONFIDENCE } from "./digits";
export type { Difficulty, NumericField } from "./regions";
export type { LoadProgress, Manifest, ModelConfig } from "./loader";

import { getMangaOcr } from "./manga-ocr";

export async function idk(blob: Blob) {
  const ocr = await getMangaOcr();
  return await ocr.recognize(blob);
}
