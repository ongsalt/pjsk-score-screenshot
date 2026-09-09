// Cloudflare will not serve a static asset larger than 25 MiB, so the onnx
// weights are shipped as `split` parts (see scripts/fetch-model.sh) and glued
// back together here before onnxruntime ever sees them.

export interface AssetPart {
  path: string;
  size: number;
}

export interface AssetEntry {
  file: string;
  size: number;
  sha256: string;
  parts: AssetPart[];
}

export interface ModelConfig {
  imageSize: number;
  imageMean: [number, number, number];
  imageStd: [number, number, number];
  rescaleFactor: number;
  vocabSize: number;
  decoderStartTokenId: number;
  eosTokenId: number;
  padTokenId: number;
  maxLength: number;
  noRepeatNgramSize: number;
}

export interface Manifest {
  model: string;
  dtype: string;
  generatedAt: string;
  vocab: string;
  config: ModelConfig;
  assets: {
    encoder: AssetEntry;
    decoder: AssetEntry;
  };
}

export interface LoadProgress {
  /** bytes of the whole model pulled so far */
  loaded: number;
  total: number;
  file: string;
}

const CACHE_NAME = "manga-ocr-assets";

export async function loadManifest(baseUrl: string): Promise<Manifest> {
  const response = await fetch(`${baseUrl}/manifest.json`);
  if (!response.ok) {
    throw new Error(`missing model manifest at ${baseUrl} (${response.status})`);
  }
  return response.json();
}

/**
 * Downloads every part of an asset and rejoins them into one buffer.
 * Parts are content addressed by the sha of the whole file, so they can be
 * cached forever and a regenerated model busts the cache on its own.
 */
export async function loadAsset(
  baseUrl: string,
  entry: AssetEntry,
  onChunk?: (bytes: number) => void,
  concurrency = 3,
): Promise<Uint8Array> {
  const buffer = new Uint8Array(entry.size);
  const cache = await openCache();

  let offset = 0;
  const jobs = entry.parts.map((part) => {
    const job = { part, offset };
    offset += part.size;
    return job;
  });

  if (offset !== entry.size) {
    throw new Error(`${entry.file}: parts add up to ${offset}, expected ${entry.size}`);
  }

  const queue = jobs[Symbol.iterator]();
  await Promise.all(
    Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
      for (const { part, offset } of queue) {
        await loadPart(`${baseUrl}/${part.path}?v=${entry.sha256.slice(0, 8)}`, buffer, offset, cache, onChunk);
      }
    }),
  );

  return buffer;
}

async function loadPart(
  url: string,
  buffer: Uint8Array,
  offset: number,
  cache: Cache | null,
  onChunk?: (bytes: number) => void,
) {
  let response = (await cache?.match(url)) ?? null;

  if (!response) {
    response = await fetch(url);
    if (!response.ok) {
      throw new Error(`failed to fetch ${url} (${response.status})`);
    }
    // clone before the body is consumed below; failures here are not fatal
    cache?.put(url, response.clone()).catch(() => {});
  }

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    buffer.set(bytes, offset);
    onChunk?.(bytes.byteLength);
    return;
  }

  const reader = response.body.getReader();
  let at = offset;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer.set(value, at);
    at += value.byteLength;
    onChunk?.(value.byteLength);
  }
}

async function openCache(): Promise<Cache | null> {
  try {
    return typeof caches !== "undefined" ? await caches.open(CACHE_NAME) : null;
  } catch {
    // private mode / insecure context
    return null;
  }
}
