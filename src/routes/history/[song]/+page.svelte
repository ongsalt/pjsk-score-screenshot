<script lang="ts">
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

  const diffNames = ["Easy", "Normal", "Hard", "Expert", "Master", "Append"];
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

  <div class="flex gap-2 mt-4">
    {#each data.detail.difficulties as diff, index}
      {@const selected = selectedDifficulty.current === diff.musicDifficulty}
      {#if index == 5}
        <div class="border-r mx-1"></div>
      {/if}
      <button
        class="flex w-10 flex-col items-center cursor-pointer"
        class:text-teal-500={selected}
        onclick={() => (selectedDifficulty.current = diff.musicDifficulty)}
      >
        <div
          class="size-9 text-lg rounded-full border flex items-center justify-center"
          class:border-teal-500={selected}
        >
          {diff.playLevel}
        </div>
        <span class="text-sm">{diffNames?.[index] ?? "Unknown"}</span>
      </button>
    {/each}
  </div>

  <div class="mt-3">
    <h3>Record</h3>
    <label>
      sort
      <select>
        <option value="">Time</option>
        <option value="">Score</option>
        <option value="">Combo</option>
      </select>
    </label>

    <div class="space-y-1 mt-3">
      {#each records as record, i}
        <div class="border py-2 px-4">
          <span>
            #{i + 1}
          </span>
        </div>
      {:else}
        <p>No record</p>
      {/each}
    </div>
  </div>
</main>
