<script lang="ts">
  import Judgement from "$lib/components/judgement.svelte";
  import Toolbar from "$lib/components/shell/toolbar.svelte";
  import { playRecords } from "$lib/data/play-record.svelte";
  import {
    clearMark,
    dayLabel,
    formatNumber,
    formatRate,
    fullTimestamp,
    perfectRate,
    sparkline,
  } from "$lib/data/summary";
  import { createSearchParamsSchema, useSearchParams } from "runed/kit";

  let { data } = $props();

  // ?d= keeps this shareable and survives a reload, and is what a history row links to
  const params = useSearchParams(
    createSearchParamsSchema({ d: { type: "string", default: "master" } }),
    { pushHistory: false, noScroll: true },
  );

  const chart = $derived(
    data.charts.find((it) => it.musicDifficulty === params.d) ??
      data.charts.find((it) => it.musicDifficulty === "master") ??
      data.charts.at(-1),
  );

  const records = $derived(chart ? playRecords.forChart(chart.id) : []);
  const newest = $derived([...records].sort((a, b) => b.playedAt - a.playedAt));
  const best = $derived(
    records.reduce(
      (top, record) =>
        (perfectRate(record.result) ?? -1) > (perfectRate(top?.result ?? {}) ?? -1) ? record : top,
      records[0],
    ),
  );

  const bestMiss = $derived(
    records.length ? Math.min(...records.map((r) => r.result.miss ?? Infinity)) : null,
  );

  const spark = $derived(sparkline(records));
</script>

<div class="lg:max-w-3xl">
<Toolbar title={data.music.title} back="/songs?d={chart?.musicDifficulty ?? 'master'}" />

<div class="flex gap-1.5 px-4 py-3 border-b border-line bg-surface overflow-x-auto">
  {#each data.charts as option (option.id)}
    {@const active = option.musicDifficulty === chart?.musicDifficulty}
    <button
      class="shrink-0 flex-1 min-w-16 flex flex-col items-center gap-1 px-2 py-2 rounded transition-colors"
      style={active
        ? `border: 1px solid var(--color-${option.musicDifficulty}); background: color-mix(in srgb, var(--color-${option.musicDifficulty}) 6%, transparent)`
        : "border: 1px solid var(--color-line)"}
      onclick={() => (params.d = option.musicDifficulty)}
    >
      <span
        class="num text-[15px] {active ? 'font-semibold' : 'text-muted'}"
        style={active ? `color: var(--color-${option.musicDifficulty})` : ""}
      >
        {option.playLevel}
      </span>
      <span
        class="text-[9.5px] font-semibold tracking-wider uppercase"
        style="color: var(--color-{option.musicDifficulty})"
      >
        {option.musicDifficulty}
      </span>
    </button>
  {/each}
</div>

{#if records.length === 0}
  <div class="flex flex-col items-center gap-2 py-20 text-center">
    <span class="font-mono text-lg text-faint">(*￣3￣)╭</span>
    <p class="text-sm text-muted">No runs on this chart yet.</p>
  </div>
{:else}
  <div class="flex flex-col gap-3 px-4 py-4 border-b border-line bg-surface">
    <div class="flex items-end gap-4">
      <div class="flex flex-col gap-1">
        <span class="cap">Best run</span>
        <span class="num text-[30px] font-medium tracking-tighter leading-none">
          {formatRate(perfectRate(best.result))}
        </span>
      </div>
      <div class="flex-1"></div>
      <div class="flex flex-col items-center gap-1">
        <span class="num text-base font-medium">{records.length}</span>
        <span class="text-[10.5px] text-faint">plays</span>
      </div>
      <div class="flex flex-col items-center gap-1">
        <span class="num text-base font-medium" style="color: var(--color-bad)">
          {bestMiss === null || bestMiss === Infinity ? "—" : bestMiss}
        </span>
        <span class="text-[10.5px] text-faint">best miss</span>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <Judgement result={best.result} />
      <div class="flex-1"></div>
      {#if clearMark(best.result)}
        <span class="text-[10px] font-bold tracking-wider text-accent border border-accent rounded-sm px-1.5 py-px">
          {clearMark(best.result)}
        </span>
      {/if}
      <span class="num text-xs text-ghost">{formatNumber(best.result.score)}</span>
    </div>
  </div>

  {#if spark}
    <div class="flex flex-col gap-2 px-4 pt-3.5 pb-2.5 border-b border-line bg-surface">
      <div class="flex items-baseline justify-between">
        <span class="cap">Perfect rate</span>
        <span class="num text-[11px] text-faint">{spark.count} plays</span>
      </div>
      <svg width="100%" height="84" viewBox="0 0 {spark.width} {spark.height}" fill="none">
        {#each [12, 46, 76] as y}
          <line x1="0" y1={y} x2={spark.width} y2={y} stroke="var(--color-line-soft)" stroke-width="1" />
        {/each}
        <polyline
          points={spark.points}
          stroke="var(--color-accent)"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          fill="none"
        />
        <circle cx={spark.lastX} cy={spark.lastY} r="4" fill="var(--color-accent)" />
      </svg>
    </div>
  {/if}

  <div class="flex items-center justify-between px-4 pt-3.5 pb-2">
    <span class="cap">Runs</span>
    <span class="num text-[11px] text-faint">{records.length}</span>
  </div>

  {#each newest as record (record.id)}
    <div class="flex items-center gap-2.5 px-4 py-3 border-b border-line-soft bg-surface">
      <span class="num text-[11.5px] text-faint w-12 shrink-0" title={fullTimestamp(record.playedAt)}>
        {dayLabel(record.playedAt)}
      </span>
      <div class="flex-1 min-w-0">
        <Judgement result={record.result} size="sm" />
      </div>
      <span class="num text-sm font-medium w-14 text-right">
        {formatRate(perfectRate(record.result))}
      </span>
      <span class="num text-[11px] text-ghost w-14 text-right">
        {formatNumber(record.result.score)}
      </span>
    </div>
  {/each}
{/if}
</div>
