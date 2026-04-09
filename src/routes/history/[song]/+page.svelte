<script lang="ts">
  import DifficultySelector from "$lib/components/difficulty-selector.svelte";
  import TopInset from "$lib/components/shell/top-inset.svelte";
  import { getPlayRecordByChartId } from "$lib/data/play-record.svelte.js";
  import { PersistedState } from "runed";

  let { data } = $props();
  const song = $derived(data.detail.song);

  const selectedDifficulty = new PersistedState("selectedDifficulty", "master");

  $effect(() => {
    if (
      selectedDifficulty.current === "append" &&
      data.detail.difficulties.length <= 5
    ) {
      selectedDifficulty.current = "master";
    }
  });

  const chart = $derived(
    data.detail.difficulties.find(
      (it) => it.musicDifficulty === selectedDifficulty.current,
    ),
  );

  const records = $derived(chart ? getPlayRecordByChartId(chart?.id) : []);
</script>

<TopInset />
<main class="p-4">
  <h2 class="text-2xl">
    {song.en?.title ?? song.jp?.title}
  </h2>
  <p>
    {song.en?.composer ?? song.jp?.composer}
  </p>

  <DifficultySelector
    difficulties={data.detail.difficulties}
    bind:selectedDifficulty={selectedDifficulty.current}
  />

  <div class="mt-3">
    <h3>Record</h3>
    <label>
      sort
      <select>
        <option value="default">Default</option>
        <option value="date">Date</option>
        <option value="score">Score</option>
        <option value="combo">Combo</option>
      </select>
    </label>

    <div class="space-y-1 mt-3">
      {#each records as record, i}
        <div class="border py-2 px-4 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span>
              #{i + 1}
            </span>
            <span>{record.result.scoreRank ?? "?"}</span>
            <div>
              <span>{record.result.score ?? "?"}</span>
            </div>

            <div class="border px-2 py-0.5 flex gap-3">
              <span
                >{record.result.perfect}/{record.result.great}/{record.result
                  .good}/{record.result.bad}/{record.result.miss}</span
              >
            </div>
          </div>

          <span class="hover:underline underline-offset-2">menu</span>
        </div>
      {:else}
        <p>No record</p>
      {/each}
    </div>
  </div>
</main>
