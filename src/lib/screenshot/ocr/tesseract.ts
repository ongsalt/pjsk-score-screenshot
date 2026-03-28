import { grayscale, PhotonImage, threshold } from "@silvia-odwyer/photon";
import initPhoton from "@silvia-odwyer/photon";
import wasmUrl from "@silvia-odwyer/photon/photon_rs_bg.wasm?url";
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

      // await initPhoton({ module_or_path: wasmUrl });
      console.log(grayscale);
    })();
  }

  async recognize(
    source: Blob | Buffer, // we shuold normalize this first
    options: Partial<RecognizeOptions> = {},
  ): Promise<RecognizeResult> {
    // const photonImage = !browser
    //   ? PhotonImage.new_from_byteslice(source)
    //   : PhotonImage.new_from_blob(source as Blob);
    // const photonImage = PhotonImage.new_from_blob(source);
    // grayscale(photonImage);
    // // threshold(photonImage, 142);
    // const buffer = photonImage.get_bytes();
    // const imageInput = new Blob([buffer as any], { type: "image/png" });

    // const parsedOptions: RecognizeOptions = { ...DEFAULT_OPTIONS, ...options };
    // const imageInput = usePreprocess ? await preprocessImage(source) : source;
    const imageInput = source

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

export interface RecognizeResult {
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
  preprocess: boolean;
}

const DEFAULT_OPTIONS: RecognizeOptions = {
  preprocess: true,
};
