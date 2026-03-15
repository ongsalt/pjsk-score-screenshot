<script lang="ts">
  import type { ExtractionOutput } from "$lib";
  import { extractResultFromImage } from "$lib";

  let selectedFile = $state<File | null>(null);
  let previewUrl = $state<string>("");
  let result = $state<ExtractionOutput | null>(null);
  let errorMessage = $state<string>("");
  let isProcessing = $state(false);

  function setPreview(file: File | null): void {
    if (!file) {
      previewUrl = "";
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
      result = await extractResultFromImage(source);
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
      <h1>Extract score data from screenshots</h1>
    </header>

    <section>
      <article>
        <div>
          <label>
            <input type="file" accept="image/*" onchange={onFileChange} />
            <span class="text-blue-600"> Select screenshot </span>
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
