import { preprocessImage } from "$lib/ocr/preprocess";
import Tesseract from "tesseract.js";

export class OCRWorker {
  ready: Promise<void>;
  #worker?: Tesseract.Worker;

  constructor() {
    this.ready = (async () => {
      this.#worker = await Tesseract.createWorker("eng+jpn");
      await this.#worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
        preserve_interword_spaces: "1",
      });
    })();
  }

  async recognize(
    source: string | Blob | HTMLImageElement, // we shuold normalize this first
    options: Partial<RecognizeOptions> = {},
  ) {
    const parsedOptions: RecognizeOptions = { ...DEFAULT_OPTIONS, ...options };
    const usePreprocess = parsedOptions.preprecess && hasDomCanvasSupport();
    const imageInput = usePreprocess ? await preprocessImage(source) : source;

    const recognized = await this.#worker!.recognize(
      imageInput,
      {},
      { blocks: true, text: true },
    );

    return recognized;
  }
}

function hasDomCanvasSupport(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof document.createElement === "function"
  );
}

interface RecognizeOptions {
  preprecess: boolean;
}

const DEFAULT_OPTIONS: RecognizeOptions = {
  preprecess: true,
};
