<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    children?: Snippet;
    label?: string;
  }

  let { children, label }: Props = $props();
</script>

<section>
  {#if label}
    <h3 class="ml-4 mb-2 sm:text-sm">{label}</h3>
  {/if}
  <div
    class="border border-neutral-500/20 bg-white dark:bg-neutral-800 rounded-md px-4 py-2.5"
  >
    {@render children?.()}
  </div>
</section>
