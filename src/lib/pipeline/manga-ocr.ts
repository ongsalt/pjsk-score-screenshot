import {
  loadAsset,
  loadManifest,
  type LoadProgress,
  type ModelConfig,
} from "./loader";
// onnxruntime fetches this at init; letting vite emit it keeps the runtime on
// our own origin instead of a cdn (24.6 MiB, so it clears cloudflare's cap)
import ortWasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url";
import type * as Ort from "onnxruntime-web/webgpu";

export interface MangaOcrOptions {
  /** where scripts/fetch-model.sh put the split model */
  baseUrl?: string;
  device?: "webgpu" | "wasm";
  onProgress?: (progress: LoadProgress) => void;
}

const SPECIAL_TOKENS = ["[PAD]", "[UNK]", "[CLS]", "[SEP]", "[MASK]"];

let runtime: Promise<typeof Ort> | null = null;

function getOrt() {
  // dynamic so nothing touches wasm during prerender
  runtime ??= import("onnxruntime-web/webgpu").then((ort) => {
    ort.env.wasm.wasmPaths = { wasm: ortWasmUrl };
    return ort;
  });
  return runtime;
}

export class MangaOcr {
  #ort: typeof Ort;
  #encoder: Ort.InferenceSession;
  #decoder: Ort.InferenceSession;
  #vocab: string[];
  #specialIds: Set<number>;
  #config: ModelConfig;
  /** sessions are not reentrant, so recognize() calls line up behind each other */
  #pending: Promise<unknown> = Promise.resolve();

  private constructor(init: {
    ort: typeof Ort;
    encoder: Ort.InferenceSession;
    decoder: Ort.InferenceSession;
    vocab: string[];
    config: ModelConfig;
  }) {
    this.#ort = init.ort;
    this.#encoder = init.encoder;
    this.#decoder = init.decoder;
    this.#vocab = init.vocab;
    this.#config = init.config;
    this.#specialIds = new Set(
      SPECIAL_TOKENS.map((token) => init.vocab.indexOf(token)).filter((id) => id >= 0),
    );
  }

  static async load(options: MangaOcrOptions = {}): Promise<MangaOcr> {
    const baseUrl = options.baseUrl ?? "/ocr";
    const device = options.device ?? (hasWebGPU() ? "webgpu" : "wasm");

    const [ort, manifest] = await Promise.all([getOrt(), loadManifest(baseUrl)]);
    const total = manifest.assets.encoder.size + manifest.assets.decoder.size;

    let loaded = 0;
    const track = (file: string) => (bytes: number) => {
      loaded += bytes;
      options.onProgress?.({ loaded, total, file });
    };

    const [encoderBytes, decoderBytes, vocabText] = await Promise.all([
      loadAsset(baseUrl, manifest.assets.encoder, track("encoder")),
      loadAsset(baseUrl, manifest.assets.decoder, track("decoder")),
      fetch(`${baseUrl}/${manifest.vocab}`).then((response) => response.text()),
    ]);

    const sessionOptions: Ort.InferenceSession.SessionOptions = {
      executionProviders: device === "webgpu" ? ["webgpu", "wasm"] : ["wasm"],
      graphOptimizationLevel: "all",
    };

    // one at a time: the WebGPU EP shares a device across sessions and warns
    // ("another WebGPU EP inference session is being created") when two are
    // built at once. The downloads above are what benefit from running in
    // parallel; session creation is cheap by comparison.
    const encoder = await ort.InferenceSession.create(encoderBytes, sessionOptions);
    const decoder = await ort.InferenceSession.create(decoderBytes, sessionOptions);

    const vocab = vocabText.split("\n");
    if (vocab.at(-1) === "") vocab.pop();

    return new MangaOcr({ ort, encoder, decoder, vocab, config: manifest.config });
  }

  /** anything createImageBitmap eats: Blob, ImageBitmap, canvas, ImageData, <img> */
  async recognize(image: ImageBitmapSource): Promise<string> {
    const run = this.#pending.then(() => this.#recognize(image));
    this.#pending = run.catch(() => {});
    return run;
  }

  async #recognize(image: ImageBitmapSource): Promise<string> {
    const { Tensor } = this.#ort;
    const config = this.#config;

    const pixelValues = await toPixelValues(image, config);
    const { last_hidden_state } = await this.#encoder.run({
      pixel_values: new Tensor("float32", pixelValues, [1, 3, config.imageSize, config.imageSize]),
    });

    const ids = [config.decoderStartTokenId];

    for (let step = 0; step < config.maxLength; step++) {
      // the exported decoder has no kv cache, so every step re-reads the prefix
      const { logits } = await this.#decoder.run({
        input_ids: new Tensor("int64", BigInt64Array.from(ids, BigInt), [1, ids.length]),
        encoder_hidden_states: last_hidden_state,
      });

      const scores = logits.data as Float32Array;
      const offset = (ids.length - 1) * config.vocabSize;
      const banned = bannedNgramTokens(ids, config.noRepeatNgramSize);

      let next = -1;
      let bestScore = -Infinity;
      for (let id = 0; id < config.vocabSize; id++) {
        const score = scores[offset + id];
        if (score > bestScore && !banned.has(id)) {
          bestScore = score;
          next = id;
        }
      }

      if (next < 0 || next === config.eosTokenId) break;
      ids.push(next);
    }

    return this.#decode(ids);
  }

  #decode(ids: number[]): string {
    let text = "";
    for (const id of ids) {
      if (this.#specialIds.has(id)) continue;
      const token = this.#vocab[id] ?? "";
      text += token.startsWith("##") ? token.slice(2) : token;
    }
    // manga-ocr drops all whitespace, the char tokenizer never emits any anyway
    return text.replace(/\s+/g, "");
  }

  async release() {
    await Promise.all([this.#encoder.release(), this.#decoder.release()]);
  }
}

let instance: Promise<MangaOcr> | null = null;

/** loads the model once and reuses it (~112 MiB, cached by the browser after) */
export function getMangaOcr(options?: MangaOcrOptions) {
  instance ??= MangaOcr.load(options);
  return instance;
}

function hasWebGPU() {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

/**
 * ViTImageProcessor: squash to 224x224, rescale to 0..1, normalize.
 * manga-ocr feeds `img.convert('L').convert('RGB')`, so all three planes carry
 * the same luma.
 */
async function toPixelValues(image: ImageBitmapSource, config: ModelConfig) {
  const size = config.imageSize;
  const bitmap = await createImageBitmap(image);

  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(size, size)
      : Object.assign(document.createElement("canvas"), { width: size, height: size });

  const context = canvas.getContext("2d", { willReadFrequently: true }) as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!context) throw new Error("no 2d canvas context");

  // transparent pixels would otherwise composite to black
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size, size);
  context.drawImage(bitmap, 0, 0, size, size);
  bitmap.close();

  const { data } = context.getImageData(0, 0, size, size);
  const plane = size * size;
  const pixels = new Float32Array(3 * plane);
  const [meanR, meanG, meanB] = config.imageMean;
  const [stdR, stdG, stdB] = config.imageStd;

  for (let i = 0; i < plane; i++) {
    const offset = i * 4;
    // PIL "L": ITU-R 601-2 luma
    const luma =
      (data[offset] * 299 + data[offset + 1] * 587 + data[offset + 2] * 114) / 1000;
    const value = luma * config.rescaleFactor;
    pixels[i] = (value - meanR) / stdR;
    pixels[plane + i] = (value - meanG) / stdG;
    pixels[2 * plane + i] = (value - meanB) / stdB;
  }

  return pixels;
}

/** generation_config sets no_repeat_ngram_size: 3, which keeps it out of loops */
function bannedNgramTokens(ids: number[], size: number): Set<number> {
  const banned = new Set<number>();
  if (size < 2 || ids.length < size) return banned;

  const prefix = ids.slice(ids.length - (size - 1)).join(",");
  for (let start = 0; start + size <= ids.length; start++) {
    if (ids.slice(start, start + size - 1).join(",") === prefix) {
      banned.add(ids[start + size - 1]);
    }
  }
  return banned;
}
