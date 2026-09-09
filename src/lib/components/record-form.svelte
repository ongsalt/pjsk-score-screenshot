<script lang="ts">
  import { musicRepository } from "$lib/data/music.svelte";
  import { noteTotal } from "$lib/data/summary";
  import type { Difficulty, NumericField } from "$lib/pipeline/regions";

  interface Props {
    musicId: number | null;
    difficulty: Difficulty | null;
    titleQuery: string;
    values: Partial<Record<NumericField, number | null>>;
    /** fields the reader was unsure about, highlighted for a second look */
    lowConfidence?: NumericField[];
  }

  let {
    musicId = $bindable(),
    difficulty = $bindable(),
    titleQuery = $bindable(),
    values = $bindable(),
    lowConfidence = [],
  }: Props = $props();

  const JUDGEMENT = [
    ["perfect", "Perfect", "var(--color-perfect)"],
    ["great", "Great", "var(--color-great)"],
    ["good", "Good", "var(--color-good)"],
    ["bad", "Bad", "var(--color-bad)"],
    ["miss", "Miss", "var(--color-miss)"],
    ["maxCombo", "Combo", "var(--color-ink)"],
  ] as const;

  const SCORE = [
    ["score", "Score"],
    ["highScore", "High score"],
  ] as const;

  const TIMING = [
    ["late", "Late"],
    ["early", "Fast / Early"],
    ["wrongWay", "Flick / Wrong way"],
  ] as const;

  const matches = $derived(musicRepository.search(titleQuery, 6));
  const charts = $derived(musicId === null ? [] : musicRepository.chartsFor(musicId));
  const chart = $derived(
    musicId !== null && difficulty ? musicRepository.chartOf(musicId, difficulty) : undefined,
  );
  const total = $derived(noteTotal(values));
</script>

<div class="flex flex-col gap-2">
  <span class="cap">Song</span>
  <input
    bind:value={titleQuery}
    placeholder="Search songs"
    class="h-11 px-3 rounded-md border border-line bg-surface text-[15px]
           focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
  />
  <div class="flex flex-wrap gap-1.5">
    {#each matches as hit (hit.id)}
      <button
        class="h-8 px-3 rounded-full border text-[13px] transition-colors
               {hit.id === musicId ? 'border-accent text-accent' : 'border-line text-muted'}"
        onclick={() => {
          musicId = hit.id;
          titleQuery = hit.title;
        }}
      >
        {hit.title}
      </button>
    {:else}
      {#if titleQuery}
        <span class="text-[13px] text-faint">No song matches that</span>
      {/if}
    {/each}
  </div>
</div>

{#if charts.length > 0}
  <div class="flex flex-col gap-2">
    <span class="cap">Difficulty</span>
    <div class="flex flex-wrap gap-1.5">
      {#each charts as option (option.id)}
        {@const active = difficulty === option.musicDifficulty}
        <button
          class="h-11 px-3 rounded text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap"
          style={active
            ? `color: var(--color-${option.musicDifficulty}); border: 1px solid var(--color-${option.musicDifficulty}); background: color-mix(in srgb, var(--color-${option.musicDifficulty}) 6%, transparent)`
            : "border: 1px solid var(--color-line); color: var(--color-muted)"}
          onclick={() => (difficulty = option.musicDifficulty)}
        >
          {option.musicDifficulty}
          {option.playLevel}
        </button>
      {/each}
    </div>
  </div>
{/if}

<div class="flex flex-col gap-2.5">
  <div class="flex items-baseline justify-between">
    <span class="cap">Judgement</span>
    {#if chart && total !== null}
      <span class="num text-[11.5px] {total === chart.totalNoteCount ? 'text-accent' : 'text-flag'}">
        {total} entered · chart has {chart.totalNoteCount}
      </span>
    {/if}
  </div>
  <div class="grid grid-cols-3 gap-2.5">
    {#each JUDGEMENT as [field, label, color]}
      {@const flag = lowConfidence.includes(field)}
      <label class="flex flex-col gap-1.5">
        <span class="text-[11px] text-faint">{label}</span>
        <input
          type="number"
          bind:value={values[field]}
          class="num h-11 px-2.5 rounded-md border text-[17px] font-medium bg-surface
                 focus:outline-none focus:ring-2 focus:ring-accent/40
                 {flag ? 'border-flag-line bg-flag-soft' : 'border-line'}"
          style="color: {color}"
        />
      </label>
    {/each}
  </div>
</div>

<div class="flex flex-col gap-2.5">
  <span class="cap">Score</span>
  <div class="grid grid-cols-2 gap-2.5">
    {#each SCORE as [field, label]}
      <label class="flex flex-col gap-1.5">
        <span class="text-[11px] text-faint">{label}</span>
        <input
          type="number"
          bind:value={values[field]}
          class="num h-11 px-2.5 rounded-md border border-line text-[15px] text-muted bg-surface
                 focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </label>
    {/each}
  </div>
</div>

<details class="rounded-md border border-line bg-surface">
  <summary class="px-3.5 py-3 text-[13px] text-muted cursor-pointer">Timing detail</summary>
  <div class="grid grid-cols-3 gap-2.5 px-3.5 pb-3.5">
    {#each TIMING as [field, label]}
      <label class="flex flex-col gap-1.5">
        <span class="text-[11px] text-faint">{label}</span>
        <input
          type="number"
          bind:value={values[field]}
          class="num h-11 px-2.5 rounded-md border border-line text-[15px] bg-surface
                 focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </label>
    {/each}
  </div>
</details>
