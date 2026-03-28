import { OCRWorker } from "$lib/screenshot/ocr/tesseract";
import { parseResult } from "$lib/screenshot/parse";
import { readFile } from "node:fs/promises";
import { imageSize } from "image-size";
import { beforeAll, expect, test } from "vitest";
import { SongRepository } from "$lib/data/song.svelte";

// we can use @silvia-odwyer/photon-node

const songRepository = new SongRepository();
const engine = new OCRWorker();
beforeAll(async () => {
  await engine.ready;
  await songRepository.ready;
});

async function parse(filename: string) {
  const file = await readFile(filename);
  const { height, width } = imageSize(file);
  const res = await engine.recognize(file);
  return parseResult(res, height, width, songRepository);
}

test("Parsing EN result with judgement", async () => {
  const result = await parse("example/en_with_judgement.png");

  expect(result.song.id).toBe(308); // The peachy key
  expect(result).toMatchObject({
    perfect: 1036,
    great: 37,
    good: 0,
    bad: 0,
    miss: 0,
  });
});

test("Parsing JP result with judgement", async () => {
  const result = await parse("example/jp_with_judgement.png");

  expect(result.song.id).toBe(646); // 透明なパレット
  expect(result).toMatchObject({
    perfect: 1001,
    great: 23,
    good: 0,
    bad: 0,
    miss: 3,
  });
});
