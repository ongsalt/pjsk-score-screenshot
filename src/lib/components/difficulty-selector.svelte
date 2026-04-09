<script lang="ts">
  import type { Difficulty } from "$lib/data/song.svelte";

  interface Props {
    difficulties: Difficulty[];
    selectedDifficulty: string;
  }

  let { difficulties, selectedDifficulty = $bindable() }: Props = $props();

  const diffNames = ["Easy", "Normal", "Hard", "Expert", "Master", "Append"];
</script>

<div class="flex gap-2 mt-4">
  {#each difficulties as diff, index}
    {@const selected = selectedDifficulty === diff.musicDifficulty}
    {#if index == 5}
      <div class="border-r mx-1"></div>
    {/if}
    <button
      class="flex w-10 flex-col items-center cursor-pointer"
      class:text-teal-500={selected}
      onclick={() => (selectedDifficulty = diff.musicDifficulty)}
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
