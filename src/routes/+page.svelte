<script lang="ts">
  import sampleImage from "../../example/Screenshot_20260309_021208.png";

  import { OCR_DEFAULT_LANGUAGES, extractResultFromImage } from "$lib";
  import type { ExtractionOutput } from "$lib";

  let selectedFile = $state<File | null>(null);
  let previewUrl = $state<string>(sampleImage);
  let result = $state<ExtractionOutput | null>(null);
  let errorMessage = $state<string>("");
  let isProcessing = $state(false);

  function setPreview(file: File | null): void {
    if (!file) {
      previewUrl = sampleImage;
      return;
    }

    previewUrl = URL.createObjectURL(file);
  }

  function onFileChange(event: Event): void {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const file = target.files?.[0] ?? null;
    selectedFile = file;
    result = null;
    errorMessage = "";
    setPreview(file);
  }

  async function runExtraction(source: string | File): Promise<void> {
    isProcessing = true;
    errorMessage = "";

    try {
      result = await extractResultFromImage(source, {
        languages: OCR_DEFAULT_LANGUAGES,
        includeRawText: true,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Extraction failed.";
      errorMessage = message;
    } finally {
      isProcessing = false;
    }
  }

  async function analyzeSelectedFile(): Promise<void> {
    if (!selectedFile) {
      errorMessage = "Choose an image first.";
      return;
    }

    await runExtraction(selectedFile);
  }
</script>

<svelte:head>
  <title>PJSK Result OCR Demo</title>
</svelte:head>

<main>
  <div class="prose">
    <header>
      <p>Project Sekai Result OCR</p>
      <h1>Extract score data from screenshots</h1>
      <p>
        This demo runs fully in-browser using Tesseract.js WASM and a semantic
        parser that matches labels by position and multilingual keyword maps.
      </p>
    </header>

    <section>
      <article>
        <div>
          <label>
            <input
              type="file"
              accept="image/*"
              onchange={onFileChange}
            />
            <span class="text-blue-600">
              Select screenshot
            </span>
          </label>
          <button
            class="text-blue-600"
            type="button"
            onclick={analyzeSelectedFile}
            disabled={isProcessing}
          >
            {isProcessing ? "Analyzing..." : "Analyze selected image"}
          </button>
        </div>

        <div>
          <img src={previewUrl} alt="Screenshot preview" />
        </div>

        {#if errorMessage}
          <p>
            {errorMessage}
          </p>
        {/if}
      </article>

      <article>
        <h2>Extracted JSON</h2>
        {#if result}
          <pre>{JSON.stringify(result.result, null, 2)}</pre>

          {#if result.warnings.length > 0}
            <h3>Warnings</h3>
            <ul>
              {#each result.warnings as warning}
                <li>{warning}</li>
              {/each}
            </ul>
          {/if}

          <h3>Raw OCR text</h3>
          <pre>{JSON.stringify(result.result)}</pre>
        {:else}
          <p>Run OCR to see structured output.</p>
        {/if}
      </article>
    </section>
  </div>
</main>
