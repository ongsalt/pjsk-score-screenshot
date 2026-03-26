<script>
  let { children, data } = $props();

  let searchValue = $state("");
  let lowerCasedSearchValue = $derived(searchValue.toLowerCase().trim());
  // TODO: better search, en name
  const songs = $derived(
    data.songs.filter(
      (it) =>
        it.arranger.toLowerCase().includes(lowerCasedSearchValue) ||
        it.composer.toLowerCase().includes(lowerCasedSearchValue) ||
        it.lyricist.toLowerCase().includes(lowerCasedSearchValue) ||
        it.title.toLowerCase().includes(lowerCasedSearchValue) ||
        it.pronunciation.toLowerCase().includes(lowerCasedSearchValue) ||
        it.id.toString() === lowerCasedSearchValue,
    ),
  );
</script>

<main class="flex h-screen">
  <section class="border-r overflow-scroll w-72">
    <div class="border-b p-1 sticky z-10 top-0 flex flex-col backdrop-blur-xl">
      <input
        type="text"
        bind:value={searchValue}
        class="border rounded px-2 py-0.5"
        placeholder="Search"
      />
      <label>
        <input type="checkbox" />
        only played
      </label>
      <label>
        sort
        <select name="" id="" class="border">
          <option value="">default</option>
          <option value="">last played</option>
        </select>
      </label>
      <!-- <p>this is pretty much osu song selector</p> -->
    </div>

    <div class="flex flex-col">
      {#each songs as song, i}
        <a
          href="/history/{song.id}"
          class="flex flex-col hover:underline px-2 py-1"
        >
          <span>
            {song.title}
          </span>
          <span class="text-sm opacity-65">
            {song.composer}
          </span>
        </a>
      {:else}
        <div class="flex flex-col items-center w-full py-6">
          <span class="opacity-65 font-mono text-lg">
            (*￣3￣)╭
          </span>
          <span class="text-sm  mt-2">No results</span>
        </div>
      {/each}
    </div>
  </section>

  <section class="overflow-y-scroll flex-1">
    {@render children?.()}
  </section>
</main>
