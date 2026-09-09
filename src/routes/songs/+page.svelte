<script lang="ts">
  import Judgement from "$lib/components/judgement.svelte";
  import Toolbar from "$lib/components/shell/toolbar.svelte";
  import {
    musicRepository,
    type Chart,
    type Music,
  } from "$lib/data/music.svelte";
  import { playRecords, type PlayRecord } from "$lib/data/play-record.svelte";
  import {
    clearMark,
    dayLabel,
    formatNumber,
    formatRate,
    perfectRate,
    sparkline,
  } from "$lib/data/summary";
  import type { Difficulty } from "$lib/pipeline/regions";
  import { createSearchParamsSchema, useSearchParams } from "runed/kit";
  import { WindowVirtualizer, Virtualizer } from "virtua/svelte";
  import { MediaQuery } from "svelte/reactivity";

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
    sel: { type: "number", default: 0 },
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

  // table + detail on desktop is a different layout, not the phone list
  // stretched, so only one of the two is ever in the dom
  const desktop = new MediaQuery("(min-width: 1024px)");

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

  /** the row the detail panel is showing */
  const selected = $derived(ranked.byMusic.get(params.sel) ?? rows[0]);
  const selectedCharts = $derived(selected ? musicRepository.chartsFor(selected.music.id) : []);
  const spark = $derived(selected ? sparkline(selected.records, 324, 72) : null);
  const recent = $derived(
    selected ? [...selected.records].sort((a, b) => b.playedAt - a.playedAt).slice(0, 4) : [],
  );
</script>

{#if desktop.current}
  <div class="flex h-screen overflow-hidden">
    <section class="flex-1 flex flex-col min-w-0">
      <div class="flex items-center gap-3 h-13 px-4 border-b border-line bg-surface shrink-0">
        <h1 class="text-[15px] font-semibold tracking-tight">Songs</h1>
        <span class="num text-xs text-faint whitespace-nowrap">
          {rows.length} of {musicRepository.musics.length}
        </span>
        <div class="flex-1"></div>
        <input
          bind:value={params.q}
          placeholder="Search"
          class="w-56 h-8 px-2.5 rounded border border-line text-[12.5px] bg-transparent
                 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
        />
        <button
          class="h-8 px-3 rounded text-[12.5px] transition-colors
                 {onlyPlayed ? 'bg-ink text-white font-medium' : 'border border-line text-muted'}"
          onclick={() => (params.show = "played")}>Played</button
        >
        <button
          class="h-8 px-3 rounded text-[12.5px] transition-colors
                 {!onlyPlayed ? 'bg-ink text-white font-medium' : 'border border-line text-muted'}"
          onclick={() => (params.show = "all")}>All</button
        >
      </div>

      <div class="flex gap-1.5 px-4 py-2.5 border-b border-line bg-surface shrink-0">
        {#each DIFFICULTIES as value}
          {@const active = difficulty === value}
          <button
            class="h-8 px-3 rounded text-[11px] font-semibold uppercase tracking-wide transition-colors"
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
        class="grid items-center gap-3.5 h-8 px-4 border-b border-line bg-sunken shrink-0"
        style="grid-template-columns: 44px 1fr 190px 62px 60px 40px"
      >
        <span class="cap text-[10px]">Lv</span>
        <span class="cap text-[10px]">Song</span>
        <span class="cap text-[10px]">Best run · P / G / G / B / M</span>
        <span class="cap text-[10px] text-right">Rate</span>
        <span class="cap text-[10px] text-right">Plays</span>
        <span></span>
      </div>

      <div class="flex-1 overflow-y-auto">
        {#if rows.length === 0}
          <div class="flex flex-col items-center gap-2 py-20 text-center">
            <span class="font-mono text-lg text-faint">(*￣3￣)╭</span>
            <p class="text-sm text-muted">
              {musicRepository.loading ? "Loading songs…" : "Nothing here"}
            </p>
          </div>
        {:else}
          <Virtualizer data={rows} getKey={(row) => row.music.id}>
            {#snippet children(row)}
              {@const best = row.best}
              {@const mark = best ? clearMark(best.result) : null}
              <button
                class="w-full grid items-center gap-3.5 h-11 px-4 border-b border-line-soft text-left
                       {selected?.music.id === row.music.id ? 'bg-accent-soft' : 'bg-surface hover:bg-sunken'}"
                style="grid-template-columns: 44px 1fr 190px 62px 60px 40px"
                onclick={() => (params.sel = row.music.id)}
              >
                <div
                  class="flex items-center justify-center w-8.5 h-8.5 rounded"
                  style="border: 1px solid var(--color-{difficulty}); background: color-mix(in srgb, var(--color-{difficulty}) 6%, transparent)"
                >
                  <span class="num text-[13px] font-semibold" style="color: var(--color-{difficulty})">
                    {row.chart.playLevel}
                  </span>
                </div>
                <span class="text-[13.5px] truncate {best ? '' : 'text-faint'}">{row.music.title}</span>
                {#if best}
                  <Judgement result={best.result} size="sm" />
                  <span class="num text-[13.5px] font-medium text-right">{formatRate(row.rate)}</span>
                  <span class="num text-xs text-faint text-right">{row.records.length}</span>
                {:else}
                  <span class="text-xs text-ghost">never played</span>
                  <span class="num text-[13.5px] text-ghost text-right">—</span>
                  <span class="num text-xs text-ghost text-right">0</span>
                {/if}
                <span class="text-[10px] font-bold tracking-wider text-accent text-right">{mark ?? ""}</span>
              </button>
            {/snippet}
          </Virtualizer>
        {/if}
      </div>
    </section>

    <aside class="w-90 shrink-0 border-l border-line bg-surface overflow-y-auto">
      <div class="flex items-center h-13 px-4 border-b border-line">
        <span class="text-[13px] font-semibold">Chart detail</span>
      </div>

      {#if !selected}
        <p class="p-4 text-sm text-faint">Nothing selected.</p>
      {:else}
        <div class="flex flex-col gap-4 p-4">
          <div class="flex gap-3.5 items-center">
            <!-- placeholder for cover art -->
            <div
              class="size-18 rounded-md shrink-0 border border-line"
              style="background: color-mix(in srgb, var(--color-{difficulty}) 10%, var(--color-sunken))"
            ></div>
            <div class="flex flex-col gap-1.5 min-w-0">
              <a
                href="/songs/{selected.music.id}?d={difficulty}"
                class="text-[15px] font-semibold tracking-tight truncate hover:underline"
              >
                {selected.music.title}
              </a>
              <span class="text-xs text-faint truncate">{selected.music.composer}</span>
              <span class="num text-[11.5px] text-ghost">
                {selected.chart.totalNoteCount} notes · {selected.records.length} plays
              </span>
            </div>
          </div>

          <div class="flex gap-1.5">
            {#each selectedCharts as option (option.id)}
              {@const active = option.musicDifficulty === difficulty}
              <button
                class="flex-1 flex flex-col items-center gap-1 py-1.5 rounded"
                style={active
                  ? `border: 1px solid var(--color-${option.musicDifficulty}); background: color-mix(in srgb, var(--color-${option.musicDifficulty}) 6%, transparent)`
                  : "border: 1px solid var(--color-line)"}
                onclick={() => (params.d = option.musicDifficulty)}
              >
                <span
                  class="num text-[13px] {active ? 'font-semibold' : 'text-muted'}"
                  style={active ? `color: var(--color-${option.musicDifficulty})` : ""}
                >
                  {option.playLevel}
                </span>
                <span
                  class="text-[8.5px] font-semibold tracking-wider uppercase"
                  style="color: var(--color-{option.musicDifficulty})"
                >
                  {option.musicDifficulty}
                </span>
              </button>
            {/each}
          </div>

          {#if selected.best}
            <div class="flex flex-col gap-2.5 p-3.5 rounded-md border border-line">
              <div class="flex items-end justify-between">
                <div class="flex flex-col gap-1">
                  <span class="cap">Best run</span>
                  <span class="num text-[28px] font-medium tracking-tighter leading-none">
                    {formatRate(selected.rate)}
                  </span>
                </div>
                <span class="num text-xs text-ghost">{formatNumber(selected.best.result.score)}</span>
              </div>
              <Judgement result={selected.best.result} />
            </div>

            {#if spark}
              <div class="flex flex-col gap-2">
                <div class="flex items-baseline justify-between">
                  <span class="cap">Perfect rate</span>
                  <span class="num text-[11px] text-faint">{spark.count} plays</span>
                </div>
                <svg width="100%" height="72" viewBox="0 0 {spark.width} {spark.height}" fill="none">
                  {#each [10, 40, 66] as y}
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

            <div class="flex flex-col gap-2">
              <span class="cap">Recent runs</span>
              <div class="flex flex-col rounded-md border border-line overflow-hidden">
                {#each recent as record, index (record.id)}
                  <div
                    class="flex items-center gap-2.5 px-3 py-2 {index < recent.length - 1
                      ? 'border-b border-line-soft'
                      : ''}"
                  >
                    <span class="num text-[11px] text-faint w-11">{dayLabel(record.playedAt)}</span>
                    <div class="flex-1 min-w-0"><Judgement result={record.result} size="sm" /></div>
                    <span class="num text-[12.5px] font-medium">
                      {formatRate(perfectRate(record.result))}
                    </span>
                  </div>
                {/each}
              </div>
            </div>
          {:else}
            <p class="text-sm text-faint">No runs on this chart yet.</p>
          {/if}
        </div>
      {/if}
    </aside>
  </div>
{:else}
  <div class="lg:max-w-4xl">

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
  </div>
{/if}
