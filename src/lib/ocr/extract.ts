import { parseResultFromPage } from './parser';
import { recognizePage } from './recognizer';
import type { ExtractOptions, ExtractionOutput } from './types';

const DEFAULT_LANGUAGES = 'eng+jpn';

export async function extractResultFromImage(
  source: string | Blob | HTMLImageElement,
  options: ExtractOptions = {}
): Promise<ExtractionOutput> {
  const page = await recognizePage(source, {
    languages: options.languages ?? DEFAULT_LANGUAGES
  });

  const parsed = parseResultFromPage(page);

  return {
    result: parsed.result,
    warnings: parsed.warnings,
    rawText: options.includeRawText === false ? '' : page.text
  };
}

export const OCR_DEFAULT_LANGUAGES = DEFAULT_LANGUAGES;
