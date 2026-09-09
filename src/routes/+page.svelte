<script lang="ts">
  import Judgement from "$lib/components/judgement.svelte";
  import Toolbar from "$lib/components/shell/toolbar.svelte";
  import { musicRepository } from "$lib/data/music.svelte";
  import { playRecords, type PlayRecord } from "$lib/data/play-record.svelte";
  import {
    clearMark,
    dayLabel,
    formatNumber,
    formatRate,
    fullTimestamp,
    groupByDay,
    perfectRate,
    timeLabel,
  } from "$lib/data/summary";
  import { MediaQuery } from "svelte/reactivity";
  import { createSearchParamsSchema, useSearchParams } from "runed/kit";
  import { WindowVirtualizer, Virtualizer } from "virtua/svelte";

  const FILTERS = [
    { id: "all", label: "All" },
    { id: "master", label: "Master" },
    { id: "cleared", label: "FC only" },
  ] as const;

  musicRepository.load();

  const params = useSearchParams(
    createSearchParamsSchema({
      f: { type: "string", default: "all" },
      run: { type: "number", default: 0 },
    }),
    { pushHistory: false, noScroll: true },
  );

  // the table and the stacked rows are different layouts, not one restyled - the
  // media query keeps only one of them in the dom
  const desktop = new MediaQuery("(min-width: 1024px)");

  const filter = $derived(FILTERS.find((option) => option.id === params.f)?.id ?? "all");
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

  /** newest first, flat for the table */
  const newest = $derived([...filtered].sort((a, b) => b.playedAt - a.playedAt));
  const groups = $derived(groupByDay(filtered));

  const totals = $derived({
    plays: records.length,
    fullCombo: records.filter((record) => clearMark(record.result) !== null).length,
    allPerfect: records.filter((record) => clearMark(record.result) === "AP").length,
  });

  const selected = $derived(newest.find((record) => record.id === params.run) ?? newest[0]);

  function chartOf(chartId: number) {
    return musicRepository.chartById.get(chartId);
  }

  function difficultyOf(record: PlayRecord) {
    return chartOf(record.chartId)?.musicDifficulty ?? "master";
  }

  function titleOf(record: PlayRecord) {
    return musicRepository.byId.get(record.songId)?.title ?? `#${record.songId}`;
  }
</script>

{#if desktop.current}
  <div class="flex h-screen overflow-hidden">
    <section class="flex-1 flex flex-col min-w-0">
      <div class="flex items-center gap-3 h-13 px-4 border-b border-line bg-surface shrink-0">
        <h1 class="text-[15px] font-semibold tracking-tight">History</h1>
        <span class="num text-xs text-faint">
          {totals.plays} plays · {totals.fullCombo} FC · {totals.allPerfect} AP
        </span>
        <div class="flex-1"></div>
        {#each FILTERS as option}
          <button
            class="h-8 px-3 rounded text-[12.5px] transition-colors
                   {filter === option.id
              ? 'bg-ink text-white font-medium'
              : 'border border-line text-muted'}"
            onclick={() => (params.f = option.id)}
          >
            {option.label}
          </button>
        {/each}
      </div>

      <div
        class="grid items-center gap-3.5 h-8 px-4 border-b border-line bg-sunken shrink-0"
        style="grid-template-columns: 116px 1fr 116px 190px 62px 82px 44px"
      >
        <span class="cap text-[10px]">When</span>
        <span class="cap text-[10px]">Song</span>
        <span class="cap text-[10px]">Chart</span>
        <span class="cap text-[10px]">Perfect / Great / Good / Bad / Miss</span>
        <span class="cap text-[10px] text-right">Rate</span>
        <span class="cap text-[10px] text-right">Score</span>
        <span></span>
      </div>

      <div class="flex-1 overflow-y-auto">
        {#if newest.length === 0}
          <div class="flex flex-col items-center gap-3 py-20 text-center">
            <span class="font-mono text-lg text-faint">(*￣3￣)╭</span>
            <p class="text-sm text-muted">No plays recorded yet.</p>
            <a href="/add" class="h-10 px-4 flex items-center rounded-md bg-accent text-white text-sm font-semibold">
              Import screenshots
            </a>
          </div>
        {:else}
          <Virtualizer data={newest} getKey={(record) => record.id}>
            {#snippet children(record)}
              {@const chart = chartOf(record.chartId)}
              {@const difficulty = difficultyOf(record)}
              {@const mark = clearMark(record.result)}
              <button
                class="w-full grid items-center gap-3.5 h-11 px-4 border-b border-line-soft text-left
                       {selected?.id === record.id ? 'bg-accent-soft' : 'bg-surface hover:bg-sunken'}"
                style="grid-template-columns: 116px 1fr 116px 190px 62px 82px 44px"
                onclick={() => (params.run = record.id)}
              >
                <span class="num text-xs text-faint truncate" title={fullTimestamp(record.playedAt)}>
                  {dayLabel(record.playedAt)}
                  {timeLabel(record.playedAt)}
                </span>
                <span class="text-[13.5px] truncate">{titleOf(record)}</span>
                <span
                  class="justify-self-start text-[10px] font-semibold tracking-wider rounded-sm px-1.5 py-0.5"
                  style="color: var(--color-{difficulty}); background: color-mix(in srgb, var(--color-{difficulty}) 8%, transparent)"
                >
                  {difficulty.toUpperCase()}
                  {chart?.playLevel ?? ""}
                </span>
                <Judgement result={record.result} size="sm" />
                <span class="num text-[13.5px] font-medium text-right">
                  {formatRate(perfectRate(record.result))}
                </span>
                <span class="num text-xs text-ghost text-right">
                  {formatNumber(record.result.score)}
                </span>
                <span class="text-[10px] font-bold tracking-wider text-accent text-right">
                  {mark ?? ""}
                </span>
              </button>
            {/snippet}
          </Virtualizer>
        {/if}
      </div>
    </section>

    <aside class="w-90 shrink-0 border-l border-line bg-surface overflow-y-auto">
      <div class="flex items-center h-13 px-4 border-b border-line">
        <span class="text-[13px] font-semibold">Run detail</span>
      </div>

      {#if !selected}
        <p class="p-4 text-sm text-faint">Nothing selected.</p>
      {:else}
        {@const chart = chartOf(selected.chartId)}
        {@const difficulty = difficultyOf(selected)}
        {@const mark = clearMark(selected.result)}
        <div class="flex flex-col gap-4 p-4">
          <div class="flex gap-3.5 items-center">
            <!-- placeholder for cover art -->
            <div
              class="size-18 rounded-md shrink-0 border border-line"
              style="background: color-mix(in srgb, var(--color-{difficulty}) 10%, var(--color-sunken))"
            ></div>
            <div class="flex flex-col gap-1.5 min-w-0">
              <a
                href="/songs/{selected.songId}?d={difficulty}"
                class="text-[15px] font-semibold tracking-tight truncate hover:underline"
              >
                {titleOf(selected)}
              </a>
              <div class="flex items-center gap-2">
                <span
                  class="text-[10px] font-semibold tracking-wider rounded-sm px-1.5 py-0.5"
                  style="color: var(--color-{difficulty}); background: color-mix(in srgb, var(--color-{difficulty}) 8%, transparent)"
                >
                  {difficulty.toUpperCase()}
                  {chart?.playLevel ?? ""}
                </span>
                {#if chart}
                  <span class="num text-xs text-faint">{chart.totalNoteCount} notes</span>
                {/if}
              </div>
              <span class="num text-[11.5px] text-ghost">{fullTimestamp(selected.playedAt)}</span>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <span class="cap">Judgement</span>
            <div class="flex flex-col rounded-md border border-line overflow-hidden">
              {#each [["Perfect", selected.result.perfect, "perfect"], ["Great", selected.result.great, "great"], ["Good", selected.result.good, "good"], ["Bad", selected.result.bad, "bad"], ["Miss", selected.result.miss, "miss"]] as [label, value, tone], index}
                <div
                  class="flex items-center justify-between h-10 px-3 {index < 4
                    ? 'border-b border-line-soft'
                    : ''}"
                >
                  <span class="text-[13px]" style="color: var(--color-{tone})">{label}</span>
                  <span class="num text-[15px] font-medium {value ? '' : 'text-ghost'}">
                    {value ?? "—"}
                  </span>
                </div>
              {/each}
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2.5">
            <div class="flex flex-col gap-1 p-3 rounded-md border border-line">
              <span class="num text-[17px] font-medium">
                {formatRate(perfectRate(selected.result))}
              </span>
              <span class="text-[11px] text-faint">perfect rate</span>
            </div>
            <div class="flex flex-col gap-1 p-3 rounded-md border border-line">
              <span class="num text-[17px] font-medium">
                {formatNumber(selected.result.maxCombo)}
              </span>
              <span class="text-[11px] text-faint">max combo</span>
            </div>
            <div class="flex flex-col gap-1 p-3 rounded-md border border-line">
              <span class="num text-[17px] font-medium">
                {formatNumber(selected.result.late)} / {formatNumber(selected.result.early)}
              </span>
              <span class="text-[11px] text-faint">late / fast</span>
            </div>
            <div class="flex flex-col gap-1 p-3 rounded-md border border-line">
              <span class="num text-[17px] font-medium">{formatNumber(selected.result.score)}</span>
              <span class="text-[11px] text-faint">score</span>
            </div>
          </div>

          {#if mark}
            <span
              class="self-start text-[10px] font-bold tracking-wider text-accent border border-accent rounded-sm px-2 py-1"
            >
              {mark === "AP" ? "ALL PERFECT" : "FULL COMBO"}
            </span>
          {/if}
        </div>
      {/if}
    </aside>
  </div>
{:else}
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
        onclick={() => (params.f = option.id)}
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

    <WindowVirtualizer data={group.records} getKey={(record) => record.id}>
      {#snippet children(record)}
        {@const chart = chartOf(record.chartId)}
        {@const difficulty = difficultyOf(record)}
        {@const mark = clearMark(record.result)}
        <a
          href="/songs/{record.songId}?d={difficulty}"
          class="flex gap-3 px-4 py-3.5 border-b border-line-soft bg-surface active:bg-sunken"
        >
          <div class="w-[3px] rounded-sm shrink-0" style="background: var(--color-{difficulty})"></div>
          <div class="flex flex-col gap-2 flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-[15px] font-normal tracking-tight truncate flex-1">
                {titleOf(record)}
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
      {/snippet}
    </WindowVirtualizer>
  {:else}
    <div class="flex flex-col items-center gap-3 py-20 px-6 text-center">
      <span class="font-mono text-lg text-faint">(*￣3￣)╭</span>
      <p class="text-sm text-muted">No plays recorded yet.</p>
      <a href="/add" class="h-11 px-5 flex items-center rounded-md bg-accent text-white text-sm font-semibold">
        Import screenshots
      </a>
    </div>
  {/each}
{/if}
