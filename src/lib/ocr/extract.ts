import { parseResultFromPage } from './parser';
import { recognizePage } from './recognizer';
import type { ExtractOptions, ExtractionOutput } from './types';


export async function extractResultFromImage(
  source: string | Blob | HTMLImageElement,
  // options: ExtractOptions = {}
): Promise<ExtractionOutput> {
  const page = await recognizePage(source, {
    
  });

  const parsed = parseResultFromPage(page);

  return {
    result: parsed.result,
    warnings: parsed.warnings,
    // rawText: options.includeRawText === false ? '' : page.text
    rawText: page.text
  };
}

