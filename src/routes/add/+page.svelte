<script lang="ts">
  import FilesUploader, {
    FilesUploaderState,
  } from "$lib/components/files-uploader.svelte";
  import Section from "$lib/components/section.svelte";
  import TopInset from "$lib/components/shell/top-inset.svelte";
  import { musicRepository } from "$lib/data/music.svelte";
  import { addPlayRecord } from "$lib/data/play-record.svelte";
  import {
    extractResult,
    getMangaOcr,
    MIN_CONFIDENCE,
    type ExtractedResult,
  } from "$lib/pipeline";
  import {
    DIFFICULTY_COLORS,
    type Difficulty,
    type NumericField,
  } from "$lib/pipeline/regions";

  const FIELDS = [
    ["score", "Score"],
    ["highScore", "High score"],
    ["maxCombo", "Combo"],
    ["perfect", "Perfect"],
    ["great", "Great"],
    ["good", "Good"],
    ["bad", "Bad"],
    ["miss", "Miss"],
    ["late", "Late"],
    ["early", "Early / Fast"],
    ["wrongWay", "Wrong way / Flick"],
  ] as const satisfies [NumericField, string][];

  const DIFFICULTIES = Object.keys(DIFFICULTY_COLORS) as Difficulty[];
  const OPTIONAL: NumericField[] = ["late", "early", "wrongWay"];

  const INPUT =
    "w-full rounded-lg border px-2.5 py-1.5 bg-transparent tabular-nums " +
    "border-neutral-300/60 dark:border-neutral-600 " +
    "focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500";

  interface Entry {
    file: File;
    url: string;
    status: "queued" | "reading" | "ready" | "saved" | "failed";
    error: string;
    result: ExtractedResult | null;
    musicId: number | null;
    difficulty: Difficulty | null;
    values: Record<NumericField, number | null>;
    titleQuery: string;
  }

  const uploader = new FilesUploaderState();
  let entries: Entry[] = $state([]);
  let progress: { loaded: number; total: number } | null = $state(null);
  let seen = new WeakSet<File>();

  // pick up whatever the uploader hands us, without re-reading files already done
  $effect(() => {
    const fresh = uploader.files.filter((file) => !seen.has(file));
    if (fresh.length === 0) return;

    for (const file of fresh) seen.add(file);
    entries.push(
      ...fresh.map(
        (file): Entry => ({
          file,
          url: URL.createObjectURL(file),
          status: "queued",
          error: "",
          result: null,
          musicId: null,
          difficulty: null,
          values: {} as Record<NumericField, number | null>,
          titleQuery: "",
        }),
      ),
    );

    void run();
  });

  async function run() {
    // both are lazy and cached; kicking them off here is what fills the progress bar
    const ready = Promise.all([
      musicRepository.load(),
      getMangaOcr({ onProgress: (p) => (progress = { loaded: p.loaded, total: p.total }) }),
    ]);

    for (const entry of entries) {
      if (entry.status !== "queued") continue;
      entry.status = "reading";

      try {
        await ready;
        const result = await extractResult(entry.file);
        const match = musicRepository.matchChart(
          result.title,
          result.noteCount,
          result.difficulty,
        );

        entry.result = result;
        entry.values = { ...pickValues(result) };
        // a shaky title match stays a suggestion - the chips below the box let
        // you pick, rather than us silently filing this under the wrong song
        entry.musicId = match?.confident ? match.music.id : null;
        entry.difficulty = match?.chart?.musicDifficulty ?? result.difficulty;
        entry.titleQuery = match?.confident ? match.music.title : result.title;
        entry.status = "ready";
      } catch (cause) {
        entry.error = cause instanceof Error ? cause.message : String(cause);
        entry.status = "failed";
      }
    }

    progress = null;
  }

  function pickValues(result: ExtractedResult) {
    const values = {} as Record<NumericField, number | null>;
    for (const [field] of FIELDS) values[field] = result[field];
    return values;
  }

  function chartOf(entry: Entry) {
    if (entry.musicId === null || !entry.difficulty) return undefined;
    return musicRepository.chartOf(entry.musicId, entry.difficulty);
  }

  function noteTotal(entry: Entry) {
    const parts = [
      entry.values.perfect,
      entry.values.great,
      entry.values.good,
      entry.values.bad,
      entry.values.miss,
    ];
    return parts.every((value) => value !== null && value !== undefined)
      ? parts.reduce((sum, value) => sum! + value!, 0)!
      : null;
  }

  function flagged(entry: Entry, field: NumericField) {
    const score = entry.result?.confidence[field];
    return score !== undefined && score > 0 && score < MIN_CONFIDENCE;
  }

  function save(entry: Entry) {
    const chart = chartOf(entry);
    if (entry.musicId === null || !chart) return;

    addPlayRecord({
      songId: entry.musicId,
      chartId: chart.id,
      playedAt: entry.file.lastModified || Date.now(),
      result: {
        score: entry.values.score ?? undefined,
        highScore: entry.values.highScore ?? undefined,
        maxCombo: entry.values.maxCombo ?? undefined,
        perfect: entry.values.perfect ?? undefined,
        great: entry.values.great ?? undefined,
        good: entry.values.good ?? undefined,
        bad: entry.values.bad ?? undefined,
        miss: entry.values.miss ?? undefined,
        late: entry.values.late ?? undefined,
        early: entry.values.early ?? undefined,
        wrongWay: entry.values.wrongWay ?? undefined,
      },
    });

    entry.status = "saved";
  }

  function remove(entry: Entry) {
    URL.revokeObjectURL(entry.url);
    entries = entries.filter((it) => it !== entry);
  }
</script>

<TopInset />

<main class="px-6 pt-4 pb-24 space-y-4 max-w-4xl">
  <header class="space-y-1">
    <h1 class="text-2xl font-semibold">Add records</h1>
    <p class="text-sm opacity-60">
      Drop result screenshots in. Numbers are read off the image, the song is matched
      against the {musicRepository.loadedServer ?? "…"} database. Everything stays editable.
    </p>
  </header>

  <FilesUploader state={uploader} />

  {#if progress}
    {@const percent = Math.round((progress.loaded / progress.total) * 100)}
    <Section label="Loading recognizer">
      <div class="h-2 rounded-full bg-neutral-300/40 dark:bg-neutral-700 overflow-hidden">
        <div class="h-full bg-teal-500 transition-all duration-300" style="width: {percent}%"></div>
      </div>
      <p class="text-sm mt-2 opacity-60">
        {(progress.loaded / 1024 / 1024).toFixed(0)} / {(progress.total / 1024 / 1024).toFixed(0)} MiB
        &mdash; first run only, cached afterwards
      </p>
    </Section>
  {/if}

  {#each entries as entry (entry.url)}
    {@const chart = chartOf(entry)}
    {@const total = noteTotal(entry)}
    {@const matches = musicRepository.search(entry.titleQuery, 6)}

    <Section>
      <div class="flex gap-5 max-sm:flex-col">
        <img
          src={entry.url}
          alt=""
          class="w-56 max-sm:w-full rounded-xl self-start ring-1 ring-neutral-300/40 dark:ring-neutral-700"
        />

        <div class="flex-1 min-w-0 space-y-4">
          {#if entry.status === "reading"}
            <p class="text-sm opacity-60 animate-pulse">Reading…</p>
          {:else if entry.status === "failed"}
            <p class="text-sm text-red-500">{entry.error}</p>
          {:else if entry.result}
            <div class="space-y-2">
              <span class="text-xs uppercase tracking-wide opacity-50">Song</span>
              <input class={INPUT} placeholder="Song title" bind:value={entry.titleQuery} />

              {#if entry.musicId === null || entry.titleQuery !== musicRepository.byId.get(entry.musicId)?.title}
                <div class="flex flex-wrap gap-1.5">
                  {#each matches as hit}
                    <button
                      class="text-sm rounded-full px-3 py-1 border cursor-pointer transition-colors
                             border-neutral-300/60 dark:border-neutral-600 hover:border-teal-500"
                      class:!border-teal-500={hit.music.id === entry.musicId}
                      class:text-teal-500={hit.music.id === entry.musicId}
                      onclick={() => {
                        entry.musicId = hit.music.id;
                        entry.titleQuery = hit.music.title;
                      }}
                    >
                      {hit.music.title}
                    </button>
                  {/each}
                  {#if matches.length === 0}
                    <span class="text-sm opacity-50">No match — type to search</span>
                  {/if}
                </div>
              {/if}
            </div>

            <div class="space-y-2">
              <span class="text-xs uppercase tracking-wide opacity-50">Difficulty</span>
              <div class="flex gap-1.5 flex-wrap">
                {#each DIFFICULTIES as difficulty}
                  {@const colour = `rgb(${DIFFICULTY_COLORS[difficulty].join(",")})`}
                  {@const known = entry.musicId !== null
                    ? musicRepository.chartOf(entry.musicId, difficulty)
                    : undefined}
                  {@const active = entry.difficulty === difficulty}
                  <button
                    class="text-sm rounded-full px-3 py-1 border cursor-pointer transition-colors
                           disabled:opacity-25 disabled:cursor-not-allowed capitalize"
                    style="border-color: {colour}; {active
                      ? `background:${colour};color:#fff;`
                      : `color:${colour};`}"
                    disabled={entry.musicId !== null && !known}
                    onclick={() => (entry.difficulty = difficulty)}
                  >
                    {difficulty}{known ? ` · ${known.playLevel}` : ""}
                  </button>
                {/each}
              </div>
            </div>

            <div class="space-y-2">
              <span class="text-xs uppercase tracking-wide opacity-50">Result</span>
              <div class="grid grid-cols-3 max-sm:grid-cols-2 gap-2.5">
                {#each FIELDS as [field, label]}
                  {@const dim = !entry.result.hasJudgementDetail && OPTIONAL.includes(field)}
                  <label class="flex flex-col gap-1" class:opacity-40={dim}>
                    <span class="text-xs opacity-70">{label}</span>
                    <input
                      type="number"
                      class="{INPUT} {flagged(entry, field)
                        ? '!border-amber-500 ring-2 ring-amber-500/30'
                        : ''}"
                      bind:value={entry.values[field]}
                    />
                  </label>
                {/each}
              </div>
            </div>

            <div class="text-sm space-y-1">
              {#if !entry.result.hasJudgementDetail}
                <p class="opacity-60">No late/early panel on this screenshot.</p>
              {/if}
              {#if entry.result.needsReview.length > 0}
                <p class="text-amber-600 dark:text-amber-400">
                  Check the highlighted {entry.result.needsReview.length === 1 ? "field" : "fields"}:
                  {entry.result.needsReview.join(", ")}
                </p>
              {/if}
              {#if chart && total !== null}
                {@const ok = total === chart.totalNoteCount}
                <p class={ok ? "text-teal-600 dark:text-teal-400" : "text-amber-600 dark:text-amber-400"}>
                  {ok ? "✓" : "!"} notes {total} / chart {chart.totalNoteCount}
                  {ok ? "" : "— wrong chart?"}
                </p>
              {/if}
            </div>

            <div class="flex gap-3 items-center pt-1">
              <button
                class="rounded-lg px-4 py-1.5 cursor-pointer transition-colors font-medium
                       bg-teal-500 text-white hover:bg-teal-600
                       disabled:bg-neutral-300 dark:disabled:bg-neutral-700 disabled:cursor-not-allowed"
                disabled={!chart || entry.status === "saved"}
                onclick={() => save(entry)}
              >
                {entry.status === "saved" ? "Saved ✓" : "Save"}
              </button>
              <button
                class="text-sm opacity-60 hover:opacity-100 cursor-pointer"
                onclick={() => remove(entry)}
              >
                Remove
              </button>
              {#if !chart}
                <span class="text-sm opacity-50">Pick a song and difficulty to save</span>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </Section>
  {/each}
</main>
