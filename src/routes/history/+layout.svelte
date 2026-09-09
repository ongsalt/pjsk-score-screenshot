<script lang="ts">
  import { page } from "$app/state";
  import TopInset from "$lib/components/shell/top-inset.svelte";
  import { musicRepository } from "$lib/data/music.svelte";
  import { hasPlayedSong } from "$lib/data/play-record.svelte.js";
  import { PersistedState } from "runed";

  let { children } = $props();

  const filterOnlyPlayed = new PersistedState("filterOnlyPlayed", false);

  let searchValue = $state("");

  const matched = $derived(musicRepository.filter(searchValue));

  const filtered = $derived(
    filterOnlyPlayed.current
      ? matched.filter((music) => hasPlayedSong(music.id))
      : matched,
  );

  const isRoot = $derived(page.route.id === "/history");
</script>

<main class="flex h-screen">
  <section
    class="md:border-r max-md:flex-1 overflow-scroll w-72"
    class:max-md:hidden={!isRoot}
  >
    <div class="border-b p-1 sticky z-10 top-0 flex flex-col backdrop-blur-xl">
      <TopInset />
      <input
        type="text"
        bind:value={searchValue}
        class="border rounded px-2 py-0.5"
        placeholder="Search"
      />
      <label>
        <input type="checkbox" bind:checked={filterOnlyPlayed.current} />
        only played
      </label>
      <label>
        sort
        <select name="" id="" class="border">
          <option value="">default</option>
          <option value="">last played</option>
        </select>
      </label>
      <!-- titles come from whichever server is picked in settings -->
    </div>

    <div class="flex flex-col">
      {#each filtered as music}
        {@const selected = music.id.toString() === page.params.song}
        <a
          href="/history/{music.id}"
          class="flex flex-col hover:underline px-2.5 py-1 {selected
            ? 'bg-teal-500/7 text-teal-700'
            : ''}"
        >
          <span>
            {music.title}
          </span>
          <span class="text-sm opacity-65">
            {music.composer}
          </span>
        </a>
      {:else}
        <div class="flex flex-col items-center w-full py-6">
          <span class="opacity-65 font-mono text-lg"> (*￣3￣)╭ </span>
          <span class="text-sm mt-2">
            {musicRepository.loading ? "Loading…" : "No results"}
          </span>
        </div>
      {/each}
    </div>
  </section>

  <section class="overflow-y-scroll flex-1" class:max-md:hidden={isRoot}>
    {@render children?.()}
  </section>
</main>
