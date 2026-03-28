<script lang="ts">
  import { preferences } from "$lib/preferences";

</script>
<main class="p-4 space-y-6">
  <section>
    <h3 class="">Extracing</h3>
    <div class="mt-2 border rounded py-3 px-4">
      <label class="flex gap-4">
        <input type="checkbox" bind:checked={preferences.skipVerification} />
        <div class="leading-5">
          <span class=""> Skip verification  </span>
          <p class="text-sm opacity-65">If you trust our ocr enough</p>
        </div>
      </label>
    </div>
  </section>

  <section>
    <h3 class="">Gemini</h3>
    <div class="mt-2 border rounded py-3 px-4">
      <span> API Key </span>
      <input type="text" class="border w-full px-2 py-1" bind:value={preferences.geminiApiKey} />
      <p>for better ocr result</p>
    </div>
  </section>
</main>
