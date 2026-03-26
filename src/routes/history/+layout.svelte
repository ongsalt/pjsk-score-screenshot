<script>
  let { children, data } = $props();

  let searchValue = $state("");
  let lowerCasedSearchValue = $derived(searchValue.toLowerCase());
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
      <p>sort: default</p>
      <!-- <p>this is pretty much osu song selector</p> -->
    </div>

    <div class="flex flex-col">
      {#each songs as song, i}
        <a href="/history/{song.id}" class="flex flex-col hover:underline px-2 py-1">
          <span>
            {song.title}
          </span>
          <span class="text-sm opacity-65">
            {song.composer}
          </span>
        </a>
      {/each}
    </div>
  </section>

  <section>
    {@render children?.()}
  </section>
</main>
