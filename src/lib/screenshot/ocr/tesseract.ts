import { preprocessImage } from "$lib/ocr/preprocess";
import Tesseract, { type Bbox } from "tesseract.js";

export class OCRWorker {
  ready: Promise<void>;
  #worker?: Tesseract.Worker;

  constructor() {
    this.ready = (async () => {
      this.#worker = await Tesseract.createWorker("eng+jpn");
      // this.#worker = await Tesseract.createWorker("eng");
      await this.#worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
        preserve_interword_spaces: "1",
        tessedit_char_blacklist: "©°",
      });
    })();
  }

  async recognize(
    source: string | Blob | HTMLImageElement, // we shuold normalize this first
    options: Partial<RecognizeOptions> = {},
  ): Promise<RecognizeResult> {
    const parsedOptions: RecognizeOptions = { ...DEFAULT_OPTIONS, ...options };
    const usePreprocess = parsedOptions.preprecess && hasDomCanvasSupport();
    const imageInput = usePreprocess ? await preprocessImage(source) : source;

    const recognized = await this.#worker!.recognize(
      imageInput,
      {},
      { blocks: true, text: true },
    );

    return {
      blocks:
        recognized.data.blocks?.map((it) => ({
          bounds: it.bbox,
          normalizedBounds: normalize(1, 1, it.bbox),
          confidence: it.confidence,
          text: it.text,
        })) ?? [],
    };
  }
}

function hasDomCanvasSupport(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof document.createElement === "function"
  );
}

interface RecognizeResult {
  blocks: Block[];
}

interface Block {
  text: string;
  confidence: number;
  bounds: {
    x0: number;
    x1: number;
    y0: number;
    y1: number;
  };
  normalizedBounds: {
    x0: number;
    x1: number;
    y0: number;
    y1: number;
  };
}

function normalize(
  width: number,
  height: number,
  bbox: Bbox,
): Block["normalizedBounds"] {
  return {
    x0: bbox.x0 / width,
    x1: bbox.x1 / width,
    y0: bbox.y0 / height,
    y1: bbox.y1 / height,
  };
}

interface RecognizeOptions {
  preprecess: boolean;
}

const DEFAULT_OPTIONS: RecognizeOptions = {
  preprecess: true,
};
