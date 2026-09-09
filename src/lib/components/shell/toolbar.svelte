<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    meta?: string;
    back?: string;
    actions?: Snippet;
  }

  let { title, meta, back, actions }: Props = $props();
</script>

<div
  class="sticky top-0 z-10 flex items-center gap-2.5 h-13 pl-4 pr-2 border-b border-line bg-surface"
>
  {#if back}
    <a href={back} aria-label="Back" class="flex items-center justify-center size-11 -ml-3 rounded-md text-ink">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.9"
        stroke-linecap="round"
        stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg
      >
    </a>
  {/if}
  <h1 class="text-[17px] font-semibold tracking-tight truncate">{title}</h1>
  {#if meta}
    <span class="num text-xs text-faint whitespace-nowrap">{meta}</span>
  {/if}
  <div class="flex-1"></div>
  {@render actions?.()}
</div>
