<script lang="ts">
  import { page } from "$app/state";
  import TopInset from "$lib/components/shell/top-inset.svelte";
  import {
    getPlayRecordByChartId,
    hasPlayedSong,
  } from "$lib/data/play-record.svelte.js";
  import { songId, type Song } from "$lib/data/song.svelte.js";
  import { Index } from "flexsearch";
  import { PersistedState } from "runed";

  let { children, data } = $props();

  // TODO: move this to settings
  const showEnName = new PersistedState("showEnName", true);
  const filterOnlyPlayed = new PersistedState("filterOnlyPlayed", false);

  let searchValue = $state("");

  const index = $derived.by(() => {
    const index = new Index({
      tokenize: "bidirectional",
    });
    for (const song of data.songRepository.songs) {
      const text = [
        song.jp?.title,
        song.jp?.pronunciation,
        song.jp?.arranger,
        song.jp?.composer,
        song.jp?.lyricist,
        song.en?.title,
        song.en?.pronunciation,
        song.en?.arranger,
        song.en?.composer,
        song.en?.lyricist,
      ]
        .filter((it) => it != undefined)
        .join(" ");
      index.add(songId(song), text);
    }

    return index;
  });

  const matched = $derived.by(() => {
    if (searchValue === "") {
      return data.songRepository.songs;
    } else {
      return index
        .search(searchValue)
        .map((id) => data.songRepository.songsById.get(id as number)!);
    }
  });

  const filtered = $derived.by(() => {
    if (!filterOnlyPlayed.current) {
      return matched;
    }

    return matched.filter((it) => hasPlayedSong(songId(it)));
  });

  const isRoot = $derived(page.route.id === "/history");

  function songTitle(song: Song) {
    if (showEnName.current) {
      return song.en?.title ?? song.jp?.title;
    }
    return song.jp?.title ?? song.en?.title;
  }

  function songComposer(song: Song) {
    if (showEnName.current) {
      return song.en?.composer ?? song.jp?.composer;
    }
    return song.jp?.composer ?? song.en?.composer;
  }
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
        <input type="checkbox" bind:checked={showEnName.current} />
        english name
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
      {#each filtered as song, i}
        {@const selected = songId(song).toString() === page.params.song}
        <a
          href="/history/{songId(song)}"
          class="flex flex-col hover:underline px-2.5 py-1 {selected
            ? 'bg-teal-500/7 text-teal-700'
            : ''}"
        >
          <span>
            {songTitle(song)}
          </span>
          <span class="text-sm opacity-65">
            {songComposer(song)}
          </span>
        </a>
      {:else}
        <div class="flex flex-col items-center w-full py-6">
          <span class="opacity-65 font-mono text-lg"> (*￣3￣)╭ </span>
          <span class="text-sm mt-2">No results</span>
        </div>
      {/each}
    </div>
  </section>

  <section class="overflow-y-scroll flex-1" class:max-md:hidden={isRoot}>
    {@render children?.()}
  </section>
</main>
