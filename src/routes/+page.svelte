<script lang="ts">
  import FilesUploader, {
    FilesUploaderState,
  } from "$lib/components/files-uploader.svelte";
  import Section from "$lib/components/section.svelte";
  import TopInset from "$lib/components/shell/top-inset.svelte";
  import { addPlayRecord } from "$lib/data/play-record.svelte.js";
  import { songId } from "$lib/data/song.svelte.js";
  import { queues } from "$lib/globals.svelte.js";
  import { preferences } from "$lib/preferences";
  import { geminiFuckingDoYourJob } from "$lib/screenshot/ocr/gemini";
  import { OCRWorker } from "$lib/screenshot/ocr/tesseract";
  import { parseResult } from "$lib/screenshot/parse";
  import { TaskQueue } from "$lib/shared/task-queue.svelte.js";
  import { PersistedState } from "runed";

  let { data } = $props();

  // 0. select images
  //    hash, remove duplicated
  //  what if there is a result within 1 min of each other?
  // 1. normalize image format
  // 2. apply filter: greyscale
  // 3. with queue:
  //    - ocr (extract text) -> parse
  //    - or llm
  // 4. fill missing detail
  // 5. confirm

  // const taskHostOrSomething

  const filesUploaderState = new FilesUploaderState();
  let jsonDisplay: any = $state(null);

  const songRepository = $derived(data.songRepository);
  const model = new PersistedState("preferredModel", "tesseract");
  const engine = new OCRWorker();

  async function start() {
    if (filesUploaderState.files.length <= 0) {
      return;
    }

    const queue = new TaskQueue(model.current == "gemini" ? 4 : 8);

    filesUploaderState.files.forEach((image, index) => {
      queue.enqueue(async () => {
        // wtf is this shi
        const i = new Image();
        i.src = filesUploaderState.previewUrls[index]!;
        // const metadata = await ExifReader.load(image)

        if (model.current == "gemini") {
          jsonDisplay = JSON.parse(
            (await geminiFuckingDoYourJob(preferences.geminiApiKey, image))
              .text ?? "",
          );
        } else {
          const r = await engine.recognize(image);
          const parsed = parseResult(r, i.naturalWidth, i.naturalHeight);
          const chart = songRepository.matchChart(
            parsed.song.name!,
            parsed.noteCount!,
          );

          // TODO: ask user to fill missing detail
          // TODO: notify potential duplicate score with settings
          addPlayRecord({
            chartId: chart!.difficulty!.id,
            songId: songId(chart!.song!),
            playedAt: 0, // TODO: get metadata
            result: {
              ...parsed,
            },
          });
          jsonDisplay = [parsed, chart, r];
          // we shuold notify the user somehow
        }
      });
    });

    queues.push(queue);
    await queue.wait();
    // Remove???
    jsonDisplay = "Done processing. see `History` page";
  }
</script>

<TopInset />
<main class="px-6 pt-4 space-y-2">
  <FilesUploader state={filesUploaderState} />

  <!-- <div class="border" id="canvas-host" >
  </div> -->

  <Section>
    <label>
      ocr engine
      <select bind:value={model.current}>
        <option value="tesseract">Tesseract (local)</option>
        <option value="gemini">Gemini 3.1 Flash-Lite Preview</option>
      </select>
      <p>
        warning: tesseract is free and can be run locally, gemini is not but it
        give better result.
      </p>
      {#if model.current === "gemini" && preferences.geminiApiKey === ""}
        <p>
          No gemini api key. You can enter it in the <a
            href="/settings"
            class="underline underline-offset-2 text-teal-500">Settings</a
          > page
        </p>
      {/if}
      <p>note: pls bring your own key</p>
    </label>
  </Section>

  <p>
    `playedAt` is from file metadata
  </p>

  <button class="border" onclick={start}>start</button>

  <div class="prose">
    <pre>{JSON.stringify(jsonDisplay, null, 2)}</pre>
  </div>
</main>
