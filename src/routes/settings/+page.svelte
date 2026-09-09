<script lang="ts">
  import Section from "$lib/components/section.svelte";
  import TopInset from "$lib/components/shell/top-inset.svelte";
  import { settings } from "$lib/data/settings.svelte";
</script>

<TopInset />
<main class="p-4 space-y-6">
  <Section label="Region">
    <span> Server </span>
    <select bind:value={settings.current.server}>
      <option value="en">English</option>
      <option value="jp">Japan</option>
    </select>
  </Section>

  <Section label="Export">
    <button class="border px-2 py-1 rounded"> Export to json </button>
  </Section>
</main>
