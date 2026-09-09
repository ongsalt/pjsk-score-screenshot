<script lang="ts">
  import Toolbar from "$lib/components/shell/toolbar.svelte";
  import { musicRepository } from "$lib/data/music.svelte";
  import { hashFile, pendingQueue } from "$lib/data/pending.svelte";
  import { playRecords } from "$lib/data/play-record.svelte";
  import { extractResult, getMangaOcr, type ExtractedResult } from "$lib/pipeline";
  import type { NumericField } from "$lib/pipeline/regions";

  const KEEP: NumericField[] = [
    "score",
    "highScore",
    "maxCombo",
    "perfect",
    "great",
    "good",
    "bad",
    "miss",
    "late",
    "early",
    "wrongWay",
  ];

  let phase: "idle" | "running" | "done" = $state("idle");
  let progress = $state({ done: 0, total: 0, startedAt: 0 });
  let model: { loaded: number; total: number } | null = $state(null);
  let tally = $state({ saved: 0, duplicate: 0 });


  const rate = $derived(
    progress.done > 0 && progress.startedAt
      ? progress.done / ((Date.now() - progress.startedAt) / 1000)
      : 0,
  );

  async function onPick(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = "";
    if (files.length > 0) await run(files);
  }

  async function run(files: File[]) {
    phase = "running";
    progress = { done: 0, total: files.length, startedAt: Date.now() };
    tally = { saved: 0, duplicate: 0 };

    await Promise.all([
      musicRepository.load(),
      getMangaOcr({ onProgress: (p) => (model = { loaded: p.loaded, total: p.total }) }),
    ]);
    model = null;

    for (const file of files) {
      // one file at a time: 500 decoded screenshots will not fit in memory
      try {
        const hash = await hashFile(file);
        if (hash && (playRecords.hasSourceHash(hash) || pendingQueue.entries.some((entry) => entry.sourceHash === hash))) {
          tally.duplicate += 1;
          progress.done += 1;
          continue;
        }

        const result = await extractResult(file);
        const match = musicRepository.matchChart(result.title, result.noteCount, result.difficulty);
        const chart = match?.confident ? match.chart : undefined;
        const reason = reasonFor(result, match?.confident ?? false, chart !== undefined);

        if (!reason && chart && match) {
          playRecords.add({
            songId: match.music.id,
            chartId: chart.id,
            playedAt: file.lastModified || Date.now(),
            sourceHash: hash || undefined,
            result: {
              score: result.score ?? undefined,
              highScore: result.highScore ?? undefined,
              maxCombo: result.maxCombo ?? undefined,
              perfect: result.perfect ?? undefined,
              great: result.great ?? undefined,
              good: result.good ?? undefined,
              bad: result.bad ?? undefined,
              miss: result.miss ?? undefined,
              late: result.late ?? undefined,
              early: result.early ?? undefined,
              wrongWay: result.wrongWay ?? undefined,
            },
          });
          tally.saved += 1;
        } else {
          // only a flagged screenshot keeps a preview, and only for this session
          pendingQueue.add(
            {
              fileName: file.name,
              reason: reason || "No matching chart",
              playedAt: file.lastModified || Date.now(),
              sourceHash: hash,
              musicId: match?.confident ? match.music.id : null,
              difficulty: chart?.musicDifficulty ?? result.difficulty,
              titleQuery: match?.confident ? match.music.title : result.title,
              values: pickValues(result),
              lowConfidence: result.needsReview ?? [],
            },
            file,
          );
        }
      } catch {
        pendingQueue.add(
          {
            fileName: file.name,
            reason: "Could not read this image",
            playedAt: file.lastModified || Date.now(),
            sourceHash: "",
            musicId: null,
            difficulty: null,
            titleQuery: "",
            values: {},
            lowConfidence: [],
          },
          file,
        );
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

  function pickValues(result: ExtractedResult) {
    const values: Partial<Record<NumericField, number | null>> = {};
    for (const field of KEEP) values[field] = result[field] ?? null;
    return values;
  }
</script>

<Toolbar title="Import" meta={phase === "done" ? `${tally.saved} saved` : undefined}>
  {#snippet actions()}
    <a href="/add/manual" class="h-9 px-3 flex items-center rounded border border-line text-[13px] text-muted">
      Add by hand
    </a>
  {/snippet}
</Toolbar>

<div class="flex flex-col gap-3.5 p-4 max-w-2xl">
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
      Read on this device. Only the numbers are kept — no screenshots stored. Re-importing the same
      file is skipped.
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

  {#if phase !== "idle"}
    <div class="grid grid-cols-3 gap-2.5">
      <div class="flex flex-col gap-1 p-3.5 rounded-md border border-line bg-surface">
        <span class="num text-[22px] font-medium tracking-tight">{tally.saved}</span>
        <span class="text-[11.5px] text-faint">saved</span>
      </div>
      <div
        class="flex flex-col gap-1 p-3.5 rounded-md border
               {pendingQueue.count ? 'border-flag-line bg-flag-soft' : 'border-line bg-surface'}"
      >
        <span class="num text-[22px] font-medium tracking-tight {pendingQueue.count ? 'text-flag' : 'text-ghost'}">
          {pendingQueue.count}
        </span>
        <span class="text-[11.5px] {pendingQueue.count ? 'text-flag' : 'text-faint'}">to review</span>
      </div>
      <div class="flex flex-col gap-1 p-3.5 rounded-md border border-line bg-surface">
        <span class="num text-[22px] font-medium tracking-tight text-ghost">{tally.duplicate}</span>
        <span class="text-[11.5px] text-faint">duplicate</span>
      </div>
    </div>
  {/if}

  {#if pendingQueue.count > 0}
    <div class="flex items-baseline justify-between">
      <span class="cap">Needs review</span>
      <button class="text-[11px] text-faint hover:text-muted" onclick={() => pendingQueue.clear()}>
        Discard all
      </button>
    </div>
    <div class="flex flex-col gap-2.5">
      {#each pendingQueue.entries as entry (entry.id)}
        {@const preview = pendingQueue.previewOf(entry.id)}
        <a
          href="/add/review/{entry.id}"
          class="flex items-center gap-3 p-3 rounded-md border border-line bg-surface"
        >
          {#if preview}
            <img src={preview} alt="" class="w-14 h-8 object-cover rounded-sm shrink-0" />
          {:else}
            <div class="w-14 h-8 rounded-sm border border-dashed border-ghost shrink-0"></div>
          {/if}
          <div class="flex flex-col gap-0.5 flex-1 min-w-0">
            <span class="num text-[13px] truncate">{entry.fileName}</span>
            <span class="text-xs text-flag">{entry.reason}</span>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-faint)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </a>
      {/each}
    </div>
    <a
      href="/add/review/{pendingQueue.first?.id}"
      class="flex items-center justify-center h-12 rounded-md bg-accent text-white text-[15px] font-semibold"
    >
      Review {pendingQueue.count}
      {pendingQueue.count === 1 ? "screenshot" : "screenshots"}
    </a>
  {/if}

  {#if phase === "done" && pendingQueue.count === 0}
    <a
      href="/"
      class="flex items-center justify-center h-12 rounded-md bg-accent text-white text-[15px] font-semibold"
    >
      See your history
    </a>
  {/if}
</div>
