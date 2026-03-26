<script lang="ts">
  let { data } = $props();

  const diffNames = ["Easy", "Normal", "Hard", "Expert", "Master", "Append"];
</script>

<main class="p-4">
  <h2 class="text-2xl">
    {data.detail.song.title}
  </h2>
  <p>
    {data.detail.song.composer}
  </p>

  <div class="flex gap-2 mt-4">
    {#each data.detail.difficulties as diff, index}
      {#if index == 5}
        <div class="border-r mx-1"></div>
      {/if}
      <div class="flex w-10 flex-col items-center">
        <div
          class="size-9 text-lg rounded-full border flex items-center justify-center"
        >
          {diff.playLevel}
        </div>
        <span class="text-sm"
          >{diffNames?.[index] ?? "Unknown"}</span
        >
      </div>
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
      {#each { length: 30 } as _, i}
        <div class="border py-2 px-4">
          <span>
            #{i + 1}
          </span>
        </div>
      {/each}
    </div>
  </div>
</main>
