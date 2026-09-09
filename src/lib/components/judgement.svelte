<script lang="ts">
  import type { PlayRecord } from "$lib/data/play-record.svelte";

  interface Props {
    result: PlayRecord["result"];
    size?: "sm" | "md";
  }

  let { result, size = "md" }: Props = $props();

  // fixed perfect / great / good / bad / miss order - players read it positionally
  const cells = $derived([
    { value: result.perfect, color: "var(--color-perfect)" },
    { value: result.great, color: "var(--color-great)" },
    { value: result.good, color: "var(--color-good)" },
    { value: result.bad, color: "var(--color-bad)" },
    { value: result.miss, color: "var(--color-miss)" },
  ]);
</script>

<div class="flex items-baseline gap-1">
  {#each cells as cell, index}
    {#if index > 0}
      <span class="text-ghost {size === 'sm' ? 'text-[9.5px]' : 'text-[10px]'}">/</span>
    {/if}
    <span
      class="num font-medium {size === 'sm' ? 'text-xs' : 'text-sm'}"
      style="color: {cell.color}"
      class:opacity-40={cell.value === 0}
    >
      {cell.value ?? "—"}
    </span>
  {/each}
</div>
