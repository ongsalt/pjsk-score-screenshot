<script lang="ts">
  import Judgement from "$lib/components/judgement.svelte";
  import Toolbar from "$lib/components/shell/toolbar.svelte";
  import { musicRepository } from "$lib/data/music.svelte";
  import { addPlayRecord, playRecords } from "$lib/data/play-record.svelte";
  import { formatRate, noteTotal, perfectRate } from "$lib/data/summary";
  import {
    extractResult,
    getMangaOcr,
    MIN_CONFIDENCE,
    type ExtractedResult,
  } from "$lib/pipeline";
  import type { Difficulty, NumericField } from "$lib/pipeline/regions";

  const FIELDS = [
    ["perfect", "Perfect", "var(--color-perfect)"],
    ["great", "Great", "var(--color-great)"],
    ["good", "Good", "var(--color-good)"],
    ["bad", "Bad", "var(--color-bad)"],
    ["miss", "Miss", "var(--color-miss)"],
    ["maxCombo", "Combo", "var(--color-ink)"],
  ] as const;

  const SCORE_FIELDS = [
    ["score", "Score"],
    ["highScore", "High score"],
  ] as const;

  interface Flagged {
    file: File;
    url: string;
    reason: string;
    result: ExtractedResult;
    musicId: number | null;
    difficulty: Difficulty | null;
    values: Record<NumericField, number | null>;
    titleQuery: string;
  }

  let phase: "idle" | "running" | "done" = $state("idle");
  let progress = $state({ done: 0, total: 0, startedAt: 0 });
  let model: { loaded: number; total: number } | null = $state(null);
  let tally = $state({ matched: 0, duplicate: 0 });
  let flagged: Flagged[] = $state([]);
  let reviewing: number | null = $state(null);

  const rate = $derived(
    progress.done > 0 && progress.startedAt
      ? progress.done / ((Date.now() - progress.startedAt) / 1000)
      : 0,
  );

  async function onPick(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = "";
    if (files.length === 0) return;
    await run(files);
  }

  async function run(files: File[]) {
    phase = "running";
    progress = { done: 0, total: files.length, startedAt: Date.now() };
    tally = { matched: 0, duplicate: 0 };
    flagged = [];

    await Promise.all([
      musicRepository.load(),
      getMangaOcr({ onProgress: (p) => (model = { loaded: p.loaded, total: p.total }) }),
    ]);
    model = null;

    for (const file of files) {
      // one at a time: 500 decoded screenshots will not fit in memory at once
      try {
        const result = await extractResult(file);
        const match = musicRepository.matchChart(result.title, result.noteCount, result.difficulty);
        const chart = match?.confident ? match.chart : undefined;
        const reason = reasonFor(result, match?.confident ?? false, chart !== undefined);

        if (!reason && chart && match) {
          if (isDuplicate(match.music.id, chart.id, result)) {
            tally.duplicate += 1;
          } else {
            save(match.music.id, chart.id, result, file.lastModified);
            tally.matched += 1;
          }
        } else {
          flagged.push({
            file,
            // only the flagged ones keep an object url, and only until reviewed
            url: URL.createObjectURL(file),
            reason: reason || "No matching chart",
            result,
            musicId: match?.confident ? match.music.id : null,
            difficulty: chart?.musicDifficulty ?? result.difficulty,
            values: pickValues(result),
            titleQuery: match?.confident ? match.music.title : result.title,
          });
        }
      } catch {
        flagged.push({
          file,
          url: URL.createObjectURL(file),
          reason: "Could not read this image",
          result: {} as ExtractedResult,
          musicId: null,
          difficulty: null,
          values: {} as Record<NumericField, number | null>,
          titleQuery: "",
        });
      }

      progress.done += 1;
    }

    phase = "done";
  }

  function reasonFor(result: ExtractedResult, confident: boolean, hasChart: boolean) {
    if (result.needsReview?.length) return "Some numbers were unclear";
    if (!confident) return "Song title unreadable";
    if (!hasChart) return "No matching chart";
    return "";
  }

  function isDuplicate(songId: number, chartId: number, result: ExtractedResult) {
    return playRecords().some(
      (record) => record.chartId === chartId && record.result.score === (result.score ?? undefined),
    );
  }

  function pickValues(result: ExtractedResult) {
    const values = {} as Record<NumericField, number | null>;
    for (const [field] of [...FIELDS, ...SCORE_FIELDS]) values[field] = result[field] ?? null;
    for (const field of ["late", "early", "wrongWay"] as const) values[field] = result[field] ?? null;
    return values;
  }

  function save(songId: number, chartId: number, source: ExtractedResult | Flagged["values"], playedAt: number) {
    addPlayRecord({
      songId,
      chartId,
      playedAt: playedAt || Date.now(),
      result: {
        score: source.score ?? undefined,
        highScore: source.highScore ?? undefined,
        maxCombo: source.maxCombo ?? undefined,
        perfect: source.perfect ?? undefined,
        great: source.great ?? undefined,
        good: source.good ?? undefined,
        bad: source.bad ?? undefined,
        miss: source.miss ?? undefined,
        late: source.late ?? undefined,
        early: source.early ?? undefined,
        wrongWay: source.wrongWay ?? undefined,
      },
    });
  }

  function commitReview(index: number) {
    const entry = flagged[index];
    const chart =
      entry.musicId !== null && entry.difficulty
        ? musicRepository.chartOf(entry.musicId, entry.difficulty)
        : undefined;
    if (entry.musicId === null || !chart) return;

    save(entry.musicId, chart.id, entry.values, entry.file.lastModified);
    tally.matched += 1;
    dropReviewed(index);
  }

  function dropReviewed(index: number) {
    URL.revokeObjectURL(flagged[index].url);
    flagged.splice(index, 1);
    reviewing = flagged.length === 0 ? null : Math.min(index, flagged.length - 1);
  }

  function flaggedChart(entry: Flagged) {
    return entry.musicId !== null && entry.difficulty
      ? musicRepository.chartOf(entry.musicId, entry.difficulty)
      : undefined;
  }
</script>

<Toolbar title="Import" meta={phase === "done" ? `${tally.matched} saved` : undefined} />

{#if reviewing !== null && flagged[reviewing]}
  {@const entry = flagged[reviewing]}
  {@const chart = flaggedChart(entry)}
  {@const total = noteTotal(entry.values)}
  {@const matches = musicRepository.search(entry.titleQuery, 6)}

  <div class="flex flex-col gap-3.5 p-4">
    <div class="flex items-center justify-between">
      <button class="text-sm text-muted" onclick={() => (reviewing = null)}>← All flagged</button>
      <span class="num text-xs text-faint">{reviewing + 1} / {flagged.length}</span>
    </div>

    <img src={entry.url} alt="" class="w-full max-h-40 object-cover rounded-md border border-line" />
    <p class="text-xs text-flag">{entry.reason}</p>

    <div class="flex flex-col gap-2">
      <span class="cap">Song</span>
      <input
        bind:value={entry.titleQuery}
        class="h-11 px-3 rounded-md border border-line bg-surface text-[15px]
               focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
      />
      <div class="flex flex-wrap gap-1.5">
        {#each matches as hit}
          <button
            class="h-8 px-3 rounded-full border text-[13px] transition-colors
                   {hit.music.id === entry.musicId
              ? 'border-accent text-accent'
              : 'border-line text-muted'}"
            onclick={() => {
              entry.musicId = hit.music.id;
              entry.titleQuery = hit.music.title;
            }}
          >
            {hit.music.title}
          </button>
        {/each}
      </div>
    </div>

    {#if entry.musicId !== null}
      <div class="flex flex-col gap-2">
        <span class="cap">Difficulty</span>
        <div class="flex gap-1.5">
          {#each musicRepository.chartsFor(entry.musicId) as option}
            {@const active = entry.difficulty === option.musicDifficulty}
            <button
              class="flex-1 h-10 rounded text-[11px] font-semibold uppercase tracking-wide"
              style={active
                ? `color: var(--color-${option.musicDifficulty}); border: 1px solid var(--color-${option.musicDifficulty}); background: color-mix(in srgb, var(--color-${option.musicDifficulty}) 6%, transparent)`
                : "border: 1px solid var(--color-line); color: var(--color-muted)"}
              onclick={() => (entry.difficulty = option.musicDifficulty)}
            >
              {option.musicDifficulty.slice(0, 3)}
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
            {total} read · chart has {chart.totalNoteCount}
          </span>
        {/if}
      </div>
      <div class="grid grid-cols-3 gap-2.5">
        {#each FIELDS as [field, label, color]}
          {@const flag = (entry.result.confidence?.[field] ?? 1) < MIN_CONFIDENCE}
          <label class="flex flex-col gap-1.5">
            <span class="text-[11px] text-faint">{label}</span>
            <input
              type="number"
              bind:value={entry.values[field]}
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
        {#each SCORE_FIELDS as [field, label]}
          <label class="flex flex-col gap-1.5">
            <span class="text-[11px] text-faint">{label}</span>
            <input
              type="number"
              bind:value={entry.values[field]}
              class="num h-11 px-2.5 rounded-md border border-line text-[15px] text-muted bg-surface
                     focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </label>
        {/each}
      </div>
    </div>

    <div class="flex items-center gap-2 pt-1">
      <button
        class="h-12 px-5 rounded-md border border-ghost text-muted text-[15px]"
        onclick={() => dropReviewed(reviewing!)}>Skip</button
      >
      <button
        class="flex-1 h-12 rounded-md bg-accent text-white text-[15px] font-semibold
               disabled:bg-ghost disabled:cursor-not-allowed"
        disabled={!chart}
        onclick={() => commitReview(reviewing!)}
      >
        Save and next
      </button>
    </div>
  </div>
{:else}
  <div class="flex flex-col gap-3.5 p-4">
    {#if phase === "idle"}
      <label
        class="flex flex-col items-center justify-center gap-2 h-40 rounded-md border border-dashed border-ghost bg-surface cursor-pointer"
      >
        <input type="file" multiple accept="image/*" class="hidden" onchange={onPick} />
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" />
        </svg>
        <span class="text-[15px] font-medium">Choose result screenshots</span>
        <span class="text-xs text-faint">Hundreds at a time is fine</span>
      </label>
      <p class="text-[11.5px] text-faint">
        Read on this device. Only the numbers are kept — no screenshots stored.
      </p>
    {/if}

    {#if model}
      <div class="flex flex-col gap-3 p-4 rounded-md border border-line bg-surface">
        <div class="flex items-baseline justify-between">
          <span class="text-[15px] font-medium">Loading recognizer</span>
          <span class="num text-[13px] text-muted">
            {(model.loaded / 1024 / 1024).toFixed(0)} / {(model.total / 1024 / 1024).toFixed(0)} MiB
          </span>
        </div>
        <div class="h-1.5 rounded-full bg-line-soft overflow-hidden">
          <div class="h-full bg-accent transition-all" style="width: {(model.loaded / model.total) * 100}%"></div>
        </div>
        <span class="num text-xs text-faint">First run only, cached afterwards</span>
      </div>
    {/if}

    {#if phase === "running"}
      <div class="flex flex-col gap-3 p-4 rounded-md border border-line bg-surface">
        <div class="flex items-baseline justify-between">
          <span class="text-[15px] font-medium">Reading screenshots</span>
          <span class="num text-[13px] text-muted">{progress.done} / {progress.total}</span>
        </div>
        <div class="h-1.5 rounded-full bg-line-soft overflow-hidden">
          <div
            class="h-full bg-accent transition-all"
            style="width: {(progress.done / Math.max(1, progress.total)) * 100}%"
          ></div>
        </div>
        <span class="num text-xs text-faint">
          {rate.toFixed(1)} / sec
          {#if rate > 0}· {Math.ceil((progress.total - progress.done) / rate)}s left{/if}
        </span>
      </div>
    {/if}

    {#if phase === "done" || flagged.length > 0}
      <div class="grid grid-cols-3 gap-2.5">
        <div class="flex flex-col gap-1 p-3.5 rounded-md border border-line bg-surface">
          <span class="num text-[22px] font-medium tracking-tight">{tally.matched}</span>
          <span class="text-[11.5px] text-faint">saved</span>
        </div>
        <div
          class="flex flex-col gap-1 p-3.5 rounded-md border bg-surface
                 {flagged.length ? 'border-flag-line bg-flag-soft' : 'border-line'}"
        >
          <span class="num text-[22px] font-medium tracking-tight {flagged.length ? 'text-flag' : 'text-ghost'}">
            {flagged.length}
          </span>
          <span class="text-[11.5px] {flagged.length ? 'text-flag' : 'text-faint'}">to review</span>
        </div>
        <div class="flex flex-col gap-1 p-3.5 rounded-md border border-line bg-surface">
          <span class="num text-[22px] font-medium tracking-tight text-ghost">{tally.duplicate}</span>
          <span class="text-[11.5px] text-faint">duplicate</span>
        </div>
      </div>
    {/if}

    {#if flagged.length > 0}
      <div class="flex items-baseline justify-between">
        <span class="cap">Needs review</span>
        <span class="text-[11px] text-faint">held until reviewed</span>
      </div>
      <div class="flex flex-col gap-2.5">
        {#each flagged as entry, index}
          <button
            class="flex items-center gap-3 p-3 rounded-md border border-line bg-surface text-left"
            onclick={() => (reviewing = index)}
          >
            <img src={entry.url} alt="" class="w-14 h-8 object-cover rounded-sm shrink-0" />
            <div class="flex flex-col gap-0.5 flex-1 min-w-0">
              <span class="text-sm truncate">{entry.file.name}</span>
              <span class="text-xs text-flag">{entry.reason}</span>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-faint)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        {/each}
      </div>
    {/if}

    {#if phase === "done" && flagged.length === 0}
      <a
        href="/"
        class="flex items-center justify-center h-12 rounded-md bg-accent text-white text-[15px] font-semibold"
      >
        See your history
      </a>
    {/if}
  </div>
{/if}
