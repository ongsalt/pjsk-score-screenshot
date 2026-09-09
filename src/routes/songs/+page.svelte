<script lang="ts">
  import Judgement from "$lib/components/judgement.svelte";
  import Toolbar from "$lib/components/shell/toolbar.svelte";
  import {
    musicRepository,
    type Chart,
    type Music,
  } from "$lib/data/music.svelte";
  import { playRecords, type PlayRecord } from "$lib/data/play-record.svelte";
  import { clearMark, formatRate, perfectRate } from "$lib/data/summary";
  import type { Difficulty } from "$lib/pipeline/regions";
  import { createSearchParamsSchema, useSearchParams } from "runed/kit";
  import { WindowVirtualizer } from "virtua/svelte";

  const DIFFICULTIES: Difficulty[] = [
    "easy",
    "normal",
    "hard",
    "expert",
    "master",
    "append",
  ];

  musicRepository.load();

  // the url is the state: reloading or sharing a link lands on the same view
  const schema = createSearchParamsSchema({
    d: { type: "string", default: "master" },
    show: { type: "string", default: "played" },
    q: { type: "string", default: "" },
  });
  const params = useSearchParams(schema, {
    pushHistory: false,
    noScroll: true,
    debounce: 200,
  });
  $effect(() => () => params.cleanup());

  const difficulty = $derived(
    (DIFFICULTIES.find((value) => value === params.d) ??
      "master") as Difficulty,
  );
  const onlyPlayed = $derived(params.show !== "all");
  const query = $derived(params.q.trim());

  interface Row {
    music: Music;
    chart: Chart;
    records: PlayRecord[];
    best?: PlayRecord;
    /** best perfect rate on this chart, null when nothing here can be rated */
    rate: number | null;
  }

  /**
   * One row per song that has a chart at the selected difficulty, ranked by best
   * perfect rate.
   *
   * Deliberately independent of the search box. This used to live inside the
   * same derived as the filtering, so every keystroke - and clearing the box
   * again - re-derived every song's best record. `perfectRate` walks a record
   * that comes out of storage behind a proxy, where every field read is a trap,
   * and the sort comparator called it twice per comparison on top of that.
   *
   * chartOf() is the repository's own cached index; rebuilding one here from
   * `charts` measured slower, because that array is deep reactive state and
   * walking it is thousands of proxy reads.
   */
  const ranked = $derived.by(() => {
    const byChart = new Map<number, PlayRecord[]>();
    for (const record of playRecords.all) {
      const list = byChart.get(record.chartId);
      if (list) list.push(record);
      else byChart.set(record.chartId, [record]);
    }

    const rows: Row[] = [];
    for (const music of musicRepository.musics) {
      const chart = musicRepository.chartOf(music.id, difficulty);
      if (!chart) continue;

      const records = byChart.get(chart.id) ?? [];
      // the newest play is the fallback: a record whose judgement counts came
      // out of the screenshot incomplete has no rate, but it is still a play
      let best = records.at(-1);
      let rate: number | null = null;
      for (const record of records) {
        const value = perfectRate(record.result);
        if (value !== null && (rate === null || value > rate)) {
          rate = value;
          best = record;
        }
      }

      rows.push({ music, chart, records, best, rate });
    }

    rows.sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
    return { rows, byMusic: new Map(rows.map((row) => [row.music.id, row])) };
  });

  /**
   * Search results keep the repository's own relevance order. It goes out of its
   * way to put the song you actually typed ahead of the ones that merely contain
   * it ("teo" -> TEO, not METEOR), and re-sorting the hits by rate here buried
   * an exact title somewhere in the middle of the list. Only the unsearched list
   * is ranked by rate.
   */
  const rows = $derived.by(() => {
    const base = query
      ? musicRepository
          .filter(query)
          .map((music) => ranked.byMusic.get(music.id))
          .filter((row) => row !== undefined)
      : ranked.rows;

    return onlyPlayed ? base.filter((row) => row.records.length > 0) : base;
  });
</script>

<Toolbar title="Songs" meta={`${rows.length}`} />

<div
  class="flex gap-1.5 px-4 py-2.5 border-b border-line bg-surface overflow-x-auto"
>
  {#each DIFFICULTIES as value}
    {@const active = difficulty === value}
    <button
      class="shrink-0 h-9 px-3 rounded text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap transition-colors"
      style={active
        ? `color: var(--color-${value}); border: 1px solid var(--color-${value}); background: color-mix(in srgb, var(--color-${value}) 6%, transparent)`
        : "border: 1px solid var(--color-line); color: var(--color-muted)"}
      onclick={() => (params.d = value)}
    >
      {value}
    </button>
  {/each}
</div>

<div
  class="flex items-center gap-1.5 px-4 py-2.5 border-b border-line bg-surface"
>
  <button
    class="h-8 px-3 rounded text-[13px] transition-colors
           {onlyPlayed
      ? 'bg-ink text-white font-medium'
      : 'border border-line text-muted'}"
    onclick={() => (params.show = "played")}>Played</button
  >
  <button
    class="h-8 px-3 rounded text-[13px] transition-colors
           {!onlyPlayed
      ? 'bg-ink text-white font-medium'
      : 'border border-line text-muted'}"
    onclick={() => (params.show = "all")}>All</button
  >
  <input
    bind:value={params.q}
    placeholder="Search"
    class="flex-1 h-8 px-2.5 rounded border border-line text-[13px] bg-transparent
           focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
  />
</div>

<WindowVirtualizer data={rows} getKey={(row) => row.music.id}>
  {#snippet children(row, index)}
    {@const best = row.best}
    {@const mark = best ? clearMark(best.result) : null}
    <a
      href="/songs/{row.music.id}?d={difficulty}"
      class="flex items-center gap-3 px-4 py-3.5 border-t border-line-soft bg-surface active:bg-sunken {index == rows.length - 1 ? 'border-b' : ''}"
    >
      <div
        class="flex items-center justify-center size-10 rounded shrink-0"
        style="border: 1px solid var(--color-{difficulty}); background: color-mix(in srgb, var(--color-{difficulty}) 6%, transparent)"
      >
        <span
          class="num text-[15px] font-semibold"
          style="color: var(--color-{difficulty})"
        >
          {row.chart.playLevel}
        </span>
      </div>

      <div class="flex flex-col gap-1.5 flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span
            class="text-[14.5px] tracking-tight truncate {best
              ? ''
              : 'text-faint'}"
          >
            {row.music.title}
          </span>
          {#if mark}
            <span
              class="text-[10px] font-bold tracking-wider text-accent border border-accent rounded-sm px-1.5 py-px"
            >
              {mark}
            </span>
          {/if}
        </div>
        {#if best}
          <Judgement result={best.result} size="sm" />
        {:else}
          <span class="text-xs text-ghost truncate">{row.music.composer}</span>
        {/if}
      </div>

      <div class="flex flex-col items-end gap-1 shrink-0">
        <span class="num text-base font-medium {best ? '' : 'text-ghost'}">
          {formatRate(row.rate)}
        </span>
        <span class="num text-[11px] {best ? 'text-faint' : 'text-ghost'}">
          {best ? `${row.records.length} plays` : "unplayed"}
        </span>
      </div>
    </a>
  {/snippet}
</WindowVirtualizer>

{#if rows.length === 0}
  <div class="flex flex-col items-center gap-2 py-20 text-center">
    <span class="font-mono text-lg text-faint">(*￣3￣)╭</span>
    <p class="text-sm text-muted">
      {musicRepository.loading ? "Loading songs…" : "Nothing here"}
    </p>
  </div>
{/if}
