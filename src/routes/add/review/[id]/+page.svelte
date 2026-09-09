<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import RecordForm from "$lib/components/record-form.svelte";
  import Toolbar from "$lib/components/shell/toolbar.svelte";
  import { musicRepository } from "$lib/data/music.svelte";
  import { pendingQueue } from "$lib/data/pending.svelte";
  import { playRecords } from "$lib/data/play-record.svelte";

  musicRepository.load();

  const id = $derived(Number.parseInt(page.params.id ?? ""));
  // the queue is persisted state, so the form binds straight to the stored entry
  // and every correction is saved as it is typed - no draft, no syncing effect
  const entry = $derived(pendingQueue.byId(id));
  const position = $derived(pendingQueue.entries.findIndex((it) => it.id === id) + 1);

  const chart = $derived(
    entry?.musicId != null && entry.difficulty
      ? musicRepository.chartOf(entry.musicId, entry.difficulty)
      : undefined,
  );

  function next() {
    const upcoming = pendingQueue.first;
    goto(upcoming ? `/add/review/${upcoming.id}` : "/add", { replaceState: true });
  }

  function commit() {
    if (!entry || entry.musicId === null || !chart) return;
    const { values } = entry;

    playRecords.add({
      songId: entry.musicId,
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

    pendingQueue.resolve(id);
    next();
  }

  function discard() {
    pendingQueue.resolve(id);
    next();
  }
</script>

<Toolbar
  title="Review"
  meta={position > 0 ? `${position} / ${pendingQueue.count}` : undefined}
  back="/add"
/>

{#if !entry}
  <div class="flex flex-col items-center gap-3 py-20 text-center">
    <p class="text-sm text-muted">This one is already dealt with.</p>
    <a href="/add" class="h-11 px-5 flex items-center rounded-md border border-line text-sm">
      Back to import
    </a>
  </div>
{:else}
  {@const preview = pendingQueue.previewOf(entry.id)}
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
      bind:musicId={entry.musicId}
      bind:difficulty={entry.difficulty}
      bind:titleQuery={entry.titleQuery}
      bind:values={entry.values}
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
