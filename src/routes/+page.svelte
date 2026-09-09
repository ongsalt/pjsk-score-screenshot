<script lang="ts">
  import Judgement from "$lib/components/judgement.svelte";
  import Toolbar from "$lib/components/shell/toolbar.svelte";
  import { musicRepository } from "$lib/data/music.svelte";
  import { playRecords } from "$lib/data/play-record.svelte";
  import {
    clearMark,
    formatNumber,
    formatRate,
    fullTimestamp,
    groupByDay,
    perfectRate,
    timeLabel,
  } from "$lib/data/summary";

  const FILTERS = [
    { id: "all", label: "All" },
    { id: "master", label: "Master" },
    { id: "cleared", label: "FC only" },
  ] as const;

  let filter: (typeof FILTERS)[number]["id"] = $state("all");

  musicRepository.load();

  const records = $derived(playRecords.all);

  const filtered = $derived(
    records.filter((record) => {
      if (filter === "cleared") return clearMark(record.result) !== null;
      if (filter === "master") {
        return musicRepository.chartById.get(record.chartId)?.musicDifficulty === "master";
      }
      return true;
    }),
  );

  const groups = $derived(groupByDay(filtered));

  const totals = $derived({
    plays: records.length,
    fullCombo: records.filter((r) => clearMark(r.result) !== null).length,
    allPerfect: records.filter((r) => clearMark(r.result) === "AP").length,
  });

  function chartOf(chartId: number) {
    return musicRepository.chartById.get(chartId);
  }

</script>

<Toolbar title="History" />

<div class="flex items-center gap-4 px-4 py-3 border-b border-line bg-surface">
  {#each [["plays", totals.plays, ""], ["full combo", totals.fullCombo, "text-accent"], ["all perfect", totals.allPerfect, "text-accent"]] as [label, value, tone], index}
    {#if index > 0}
      <div class="w-px h-7 bg-line"></div>
    {/if}
    <div class="flex flex-col gap-0.5">
      <span class="num text-[19px] font-medium tracking-tight {tone}">{value}</span>
      <span class="text-[11px] text-faint">{label}</span>
    </div>
  {/each}
</div>

<div class="flex items-center gap-1.5 px-4 py-2.5 border-b border-line bg-surface">
  {#each FILTERS as option}
    <button
      class="h-8 px-3 rounded text-[13px] transition-colors
             {filter === option.id
        ? 'bg-ink text-white font-medium'
        : 'border border-line text-muted'}"
      onclick={() => (filter = option.id)}
    >
      {option.label}
    </button>
  {/each}
</div>

{#each groups as group (group.label)}
  <div class="flex items-center justify-between px-4 pt-3 pb-2">
    <span class="cap" title={fullTimestamp(group.records[0].playedAt)}>{group.label}</span>
    <span class="num text-[11px] text-faint">{group.records.length}</span>
  </div>

  {#each group.records as record (record.id)}
    {@const chart = chartOf(record.chartId)}
    {@const music = musicRepository.byId.get(record.songId)}
    {@const difficulty = chart?.musicDifficulty ?? "master"}
    {@const mark = clearMark(record.result)}
    <a
      href="/songs/{record.songId}?d={difficulty}"
      class="flex gap-3 px-4 py-3.5 border-b border-line-soft bg-surface active:bg-sunken"
    >
      <div class="w-[3px] rounded-sm shrink-0" style="background: var(--color-{difficulty})"></div>
      <div class="flex flex-col gap-2 flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-[15px] font-normal tracking-tight truncate flex-1">
            {music?.title ?? `#${record.songId}`}
          </span>
          {#if mark}
            <span class="text-[10px] font-bold tracking-wider text-accent border border-accent rounded-sm px-1.5 py-px">
              {mark}
            </span>
          {/if}
          <span
            class="text-[10px] font-semibold tracking-wider rounded-sm px-1.5 py-0.5"
            style="color: var(--color-{difficulty}); background: color-mix(in srgb, var(--color-{difficulty}) 8%, transparent)"
          >
            {difficulty.toUpperCase()}
            {chart?.playLevel ?? ""}
          </span>
        </div>

        <div class="flex items-baseline gap-2">
          <Judgement result={record.result} />
          <div class="flex-1"></div>
          <span class="num text-[15px] font-medium tracking-tight">
            {formatRate(perfectRate(record.result))}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <span class="num text-[11.5px] text-faint" title={fullTimestamp(record.playedAt)}>
            {timeLabel(record.playedAt)}
          </span>
          <span class="text-ghost">·</span>
          <span class="num text-[11.5px] text-faint">{formatNumber(record.result.score)}</span>
        </div>
      </div>
    </a>
  {/each}
{:else}
  <div class="flex flex-col items-center gap-3 py-20 px-6 text-center">
    <span class="font-mono text-lg text-faint">(*￣3￣)╭</span>
    <p class="text-sm text-muted">No plays recorded yet.</p>
    <a href="/add" class="h-11 px-5 flex items-center rounded-md bg-accent text-white text-sm font-semibold">
      Import screenshots
    </a>
  </div>
{/each}
