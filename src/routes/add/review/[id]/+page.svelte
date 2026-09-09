<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import RecordForm from "$lib/components/record-form.svelte";
  import Toolbar from "$lib/components/shell/toolbar.svelte";
  import { musicRepository } from "$lib/data/music.svelte";
  import {
    pendingById,
    pendingReviews,
    previewOf,
    resolvePending,
    updatePending,
    type PendingReview,
  } from "$lib/data/pending.svelte";
  import { addPlayRecord } from "$lib/data/play-record.svelte";
  import type { Difficulty, NumericField } from "$lib/pipeline/regions";

  musicRepository.load();

  const id = $derived(Number.parseInt(page.params.id ?? ""));
  const entry = $derived(pendingById(id));
  const queue = $derived(pendingReviews());
  const position = $derived(queue.findIndex((it) => it.id === id) + 1);

  // a local draft so the form can bind, mirrored back into the persisted queue
  // as it changes - reloading mid-review keeps the corrections made so far
  let loaded: number | null = $state(null);
  let musicId: number | null = $state(null);
  let difficulty: Difficulty | null = $state(null);
  let titleQuery = $state("");
  let values: Partial<Record<NumericField, number | null>> = $state({});

  $effect(() => {
    if (loaded === id || !entry) return;
    musicId = entry.musicId;
    difficulty = entry.difficulty;
    titleQuery = entry.titleQuery;
    values = { ...entry.values };
    loaded = id;
  });

  $effect(() => {
    const patch: Partial<PendingReview> = { musicId, difficulty, titleQuery, values: { ...values } };
    if (loaded === id) updatePending(id, patch);
  });

  const chart = $derived(
    musicId !== null && difficulty ? musicRepository.chartOf(musicId, difficulty) : undefined,
  );

  function next() {
    const remaining = pendingReviews();
    if (remaining.length === 0) goto("/add");
    else goto(`/add/review/${remaining[0].id}`, { replaceState: true });
  }

  function commit() {
    if (!entry || musicId === null || !chart) return;
    addPlayRecord({
      songId: musicId,
      chartId: chart.id,
      playedAt: entry.playedAt || Date.now(),
      sourceHash: entry.sourceHash || undefined,
      result: {
        score: values.score ?? undefined,
        highScore: values.highScore ?? undefined,
        maxCombo: values.maxCombo ?? undefined,
        perfect: values.perfect ?? undefined,
        great: values.great ?? undefined,
        good: values.good ?? undefined,
        bad: values.bad ?? undefined,
        miss: values.miss ?? undefined,
        late: values.late ?? undefined,
        early: values.early ?? undefined,
        wrongWay: values.wrongWay ?? undefined,
      },
    });
    resolvePending(id);
    next();
  }

  function discard() {
    resolvePending(id);
    next();
  }
</script>

<Toolbar title="Review" meta={position > 0 ? `${position} / ${queue.length}` : undefined} back="/add" />

{#if !entry}
  <div class="flex flex-col items-center gap-3 py-20 text-center">
    <p class="text-sm text-muted">This one is already dealt with.</p>
    <a href="/add" class="h-11 px-5 flex items-center rounded-md border border-line text-sm">
      Back to import
    </a>
  </div>
{:else}
  {@const preview = previewOf(entry.id)}
  <div class="flex flex-col gap-3.5 p-4 max-w-2xl">
    {#if preview}
      <img src={preview} alt="" class="w-full max-h-44 object-cover rounded-md border border-line" />
    {:else}
      <div
        class="flex items-center gap-2 px-3.5 py-3 rounded-md border border-dashed border-ghost text-[13px] text-faint"
      >
        <span class="num truncate">{entry.fileName}</span>
        <span class="shrink-0">· screenshot not kept</span>
      </div>
    {/if}

    <p class="text-xs text-flag">{entry.reason}</p>

    <RecordForm
      bind:musicId
      bind:difficulty
      bind:titleQuery
      bind:values
      lowConfidence={entry.lowConfidence}
    />

    <div class="flex items-center gap-2 pt-1">
      <button class="h-12 px-5 rounded-md border border-ghost text-muted text-[15px]" onclick={discard}>
        Discard
      </button>
      <button
        class="flex-1 h-12 rounded-md bg-accent text-white text-[15px] font-semibold
               disabled:bg-ghost disabled:cursor-not-allowed"
        disabled={!chart}
        onclick={commit}
      >
        Save and next
      </button>
    </div>
  </div>
{/if}
