<script lang="ts">
  import FilesUploader, { FilesUploaderState } from "$lib/components/files-uploader.svelte";
  import { preferences } from "$lib/preferences";
  import { geminiFuckingDoYourJob, toBase64 } from "$lib/screenshot/ocr/gemini";
  import { OCRWorker } from "$lib/screenshot/ocr/tesseract";

  // 0. select images
  // 1. normalize image format
  // 2. apply filter
  // 3. with queue:
  //    - ocr (extract text) -> parse
  //    - or llm
  // 4. fill missing detail
  // 5. confirm

  const filesUploaderState = new FilesUploaderState()

  let result: any = $state(null)
  let model = $state("gemini")

  const engine = new OCRWorker()

  async function start() {
    const image = filesUploaderState.files[0]
    if (!image) {
      return
    }
    // 
    console.log(await toBase64(image))

    if (model == "gemini") {
      result = JSON.parse((await geminiFuckingDoYourJob(preferences.geminiApiKey, image)).text ?? "")
    } else {
      result = await engine.recognize(image)
    }
  }

</script>

<main class="px-6 pt-4 space-y-2">
  <FilesUploader state={filesUploaderState} />
  <div class="border">
    <h2>Settings</h2>
    <label>
      ocr engine
      <select bind:value={model}>
        <option value="tesseract">Tesseract (local)</option>
        <option value="gemini">Gemini 3.1 Flash-Lite Preview</option>
      </select>
      <p>
        warning: tesseract is free and can be run locally, gemini is not but it
        give better result.
      </p>
      <p>note: pls bring your own key</p>
    </label>
  </div>

  <button class="border" onclick={start}>start</button>

  <div class="prose">
    <pre>{JSON.stringify(result, null, 2)}</pre>
  </div>
</main>
