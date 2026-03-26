<script lang="ts">
  import FilesUploader from "$lib/components/files-uploader.svelte";

  // 1. normalize image format
  // 2. apply filter
  // 3. with queue:
  //    - ocr (extract text) -> parse
  //    - or llm
</script>

<svelte:head>
  <title>PJSK Result OCR Demo</title>
</svelte:head>

<main class="px-6 pt-4 space-y-2">
  <FilesUploader />
  <div class="border">
    <h2>Settings</h2>
    <label>
      ocr engine
      <select name="" id="">
        <option value="">Tesseract (local)</option>
        <option value="">Gemini 3.1 Flash-Lite Preview</option>
      </select>
      <p>
        warning: tesseract is free and can be run locally, gemini is not but it
        give better result.
      </p>
      <p>note: pls bring your own key</p>
    </label>
  </div>

  <button class="border">start</button>
</main>
