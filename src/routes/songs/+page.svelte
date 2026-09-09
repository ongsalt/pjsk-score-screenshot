<script lang="ts">
  import Judgement from "$lib/components/judgement.svelte";
  import Toolbar from "$lib/components/shell/toolbar.svelte";
  import { musicRepository } from "$lib/data/music.svelte";
  import { playRecords } from "$lib/data/play-record.svelte";
  import { clearMark, formatRate, perfectRate } from "$lib/data/summary";
  import type { Difficulty } from "$lib/pipeline/regions";
  import { PersistedState } from "runed";

  const DIFFICULTIES: Difficulty[] = ["hard", "expert", "master", "append"];

  const difficulty = new PersistedState<Difficulty>("songsDifficulty", "master");
  let onlyPlayed = $state(true);
  let query = $state("");

  musicRepository.load();

  // one pass over the records, then every row is a map lookup
  const byChart = $derived.by(() => {
    const map = new Map<number, ReturnType<typeof playRecords>>();
    for (const record of playRecords()) {
      const list = map.get(record.chartId);
      if (list) list.push(record);
      else map.set(record.chartId, [record]);
    }
    return map;
  });

  const rows = $derived.by(() => {
    const musics = query ? musicRepository.filter(query) : musicRepository.musics;

    return musics
      .map((music) => {
        const chart = musicRepository.chartOf(music.id, difficulty.current);
        const records = chart ? (byChart.get(chart.id) ?? []) : [];
        const best = records.reduce(
          (top, record) =>
            (perfectRate(record.result) ?? -1) > (perfectRate(top?.result ?? {}) ?? -1) ? record : top,
          records[0],
        );
        return { music, chart, records, best };
      })
      .filter((row) => row.chart && (!onlyPlayed || row.records.length > 0))
      .sort((a, b) => (perfectRate(b.best?.result ?? {}) ?? -1) - (perfectRate(a.best?.result ?? {}) ?? -1));
  });
</script>

<Toolbar title="Songs" meta={`${rows.length}`} />

<div class="flex gap-1.5 px-4 py-2.5 border-b border-line bg-surface">
  {#each DIFFICULTIES as value}
    {@const active = difficulty.current === value}
    <button
      class="flex-1 h-9 rounded text-xs font-semibold uppercase tracking-wide transition-colors"
      style={active
        ? `color: var(--color-${value}); border: 1px solid var(--color-${value}); background: color-mix(in srgb, var(--color-${value}) 6%, transparent)`
        : "border: 1px solid var(--color-line); color: var(--color-muted)"}
      onclick={() => (difficulty.current = value)}
    >
      {value}
    </button>
  {/each}
</div>

<div class="flex items-center gap-1.5 px-4 py-2.5 border-b border-line bg-surface">
  <button
    class="h-8 px-3 rounded text-[13px] transition-colors
           {onlyPlayed ? 'bg-ink text-white font-medium' : 'border border-line text-muted'}"
    onclick={() => (onlyPlayed = true)}>Played</button
  >
  <button
    class="h-8 px-3 rounded text-[13px] transition-colors
           {!onlyPlayed ? 'bg-ink text-white font-medium' : 'border border-line text-muted'}"
    onclick={() => (onlyPlayed = false)}>All</button
  >
  <input
    bind:value={query}
    placeholder="Search"
    class="flex-1 h-8 px-2.5 rounded border border-line text-[13px] bg-transparent
           focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
  />
</div>

{#each rows as row (row.music.id)}
  {@const played = row.records.length > 0}
  <a
    href="/songs/{row.music.id}"
    class="flex items-center gap-3 px-4 py-3.5 border-b border-line-soft bg-surface active:bg-sunken"
  >
    <div
      class="flex items-center justify-center size-10 rounded shrink-0"
      style="border: 1px solid var(--color-{difficulty.current}); background: color-mix(in srgb, var(--color-{difficulty.current}) 6%, transparent)"
    >
      <span class="num text-[15px] font-semibold" style="color: var(--color-{difficulty.current})">
        {row.chart?.playLevel}
      </span>
    </div>

    <div class="flex flex-col gap-1.5 flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <span class="text-[14.5px] tracking-tight truncate {played ? '' : 'text-faint'}">
          {row.music.title}
        </span>
        {#if played && clearMark(row.best.result)}
          <span class="text-[10px] font-bold tracking-wider text-accent border border-accent rounded-sm px-1.5 py-px">
            {clearMark(row.best.result)}
          </span>
        {/if}
      </div>
      {#if played}
        <Judgement result={row.best.result} size="sm" />
      {:else}
        <span class="text-xs text-ghost truncate">{row.music.composer}</span>
      {/if}
    </div>

    <div class="flex flex-col items-end gap-1 shrink-0">
      <span class="num text-base font-medium {played ? '' : 'text-ghost'}">
        {played ? formatRate(perfectRate(row.best.result)) : "—"}
      </span>
      <span class="num text-[11px] {played ? 'text-faint' : 'text-ghost'}">
        {played ? `${row.records.length} plays` : "unplayed"}
      </span>
    </div>
  </a>
{:else}
  <div class="flex flex-col items-center gap-2 py-20 text-center">
    <span class="font-mono text-lg text-faint">(*￣3￣)╭</span>
    <p class="text-sm text-muted">
      {musicRepository.loading ? "Loading songs…" : "Nothing here"}
    </p>
  </div>
{/each}
