<script lang="ts">
  import Section from "$lib/components/section.svelte";
  import TopInset from "$lib/components/shell/top-inset.svelte";
  import { preferences } from "$lib/preferences";
</script>

<TopInset />
<main class="p-4 space-y-6">
  <Section label="Extracing">
    <label class="flex gap-4">
      <input type="checkbox" bind:checked={preferences.skipVerification} />
      <div class="leading-5">
        <span class=""> Skip verification </span>
        <p class="text-sm opacity-65">If you trust our ocr enough</p>
      </div>
    </label>
  </Section>

  <Section label="Gemini">
    <span> API Key </span>
    <input
      type="text"
      class="border w-full px-2 py-1"
      bind:value={preferences.geminiApiKey}
    />
    <p>for better ocr result</p>
  </Section>
</main>
