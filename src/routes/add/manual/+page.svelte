<script lang="ts">
  import { goto } from "$app/navigation";
  import RecordForm from "$lib/components/record-form.svelte";
  import Toolbar from "$lib/components/shell/toolbar.svelte";
  import { musicRepository } from "$lib/data/music.svelte";
  import { playRecords } from "$lib/data/play-record.svelte";
  import type { Difficulty, NumericField } from "$lib/pipeline/regions";

  musicRepository.load();

  let musicId: number | null = $state(null);
  let difficulty: Difficulty | null = $state(null);
  let titleQuery = $state("");
  let values: Partial<Record<NumericField, number | null>> = $state({});
  let playedAt = $state(localNow());
  let saved = $state(false);

  const chart = $derived(
    musicId !== null && difficulty ? musicRepository.chartOf(musicId, difficulty) : undefined,
  );

  /** datetime-local wants a local ISO string without the zone */
  function localNow() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }

  function save() {
    if (musicId === null || !chart) return;
    playRecords.add({
      songId: musicId,
      chartId: chart.id,
      playedAt: playedAt ? new Date(playedAt).getTime() : Date.now(),
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
    saved = true;
    goto("/");
  }
</script>

<Toolbar title="Add by hand" back="/add" />

<div class="flex flex-col gap-3.5 p-4 max-w-2xl">
  <RecordForm bind:musicId bind:difficulty bind:titleQuery bind:values />

  <label class="flex flex-col gap-1.5">
    <span class="text-[11px] text-faint">Played at</span>
    <input
      type="datetime-local"
      bind:value={playedAt}
      class="num h-11 px-2.5 rounded-md border border-line text-[15px] bg-surface
             focus:outline-none focus:ring-2 focus:ring-accent/40"
    />
  </label>

  <div class="flex items-center gap-2 pt-1">
    <a
      href="/add"
      class="h-12 px-5 flex items-center rounded-md border border-ghost text-muted text-[15px]"
    >
      Cancel
    </a>
    <button
      class="flex-1 h-12 rounded-md bg-accent text-white text-[15px] font-semibold
             disabled:bg-ghost disabled:cursor-not-allowed"
      disabled={!chart || saved}
      onclick={save}
    >
      Save record
    </button>
  </div>
</div>
