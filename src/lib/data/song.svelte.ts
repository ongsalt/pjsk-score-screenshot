// https://sekai-world.github.io/sekai-master-db-diff/musics.json

import { queryOptions } from "@tanstack/svelte-query";
import { Index } from "flexsearch";
import { SvelteMap } from "svelte/reactivity";

export type ApiSong = {
  id: number;
  seq: number;
  releaseConditionId: number;
  categories: string[];
  title: string;
  pronunciation: string;
  creatorArtistId: number;
  lyricist: string;
  composer: string;
  arranger: string;
  dancerCount: number;
  selfDancerPosition: number;
  assetbundleName: string;
  liveTalkBackgroundAssetbundleName: string;
  publishedAt: number;
  releasedAt: number;
  liveStageId: number;
  fillerSec: number;
  isNewlyWrittenMusic: boolean;
  isFullLength: boolean;
};

export type Song = {
  jp?: ApiSong;
  en?: ApiSong;
  // cn?: ApiSong;
};

export type Difficulty = {
  id: number;
  musicId: number;
  musicDifficulty: string; // "easy" | "hard" | ...
  playLevel: number;
  totalNoteCount: number;
};

export async function fetchSongs(): Promise<
  [Map<number, Song>, Map<number, Difficulty>]
> {
  // TODO: error handling, caching and invalidation
  const res1 = await fetch(
    "https://sekai-world.github.io/sekai-master-db-diff/musics.json",
  );

  const res2 = await fetch(
    "https://sekai-world.github.io/sekai-master-db-diff/musicDifficulties.json",
  );

  const res3 = await fetch(
    "https://sekai-world.github.io/sekai-master-db-en-diff/musics.json",
  );

  const res4 = await fetch(
    "https://sekai-world.github.io/sekai-master-db-en-diff/musicDifficulties.json",
  );

  // chu future express doesnt exist in jp
  // TODO: server exclusive song

  const [jpSongs, jpDifficulties, enSongs, enDifficulties] = (await Promise.all([
    res1.json(),
    res2.json(),
    res3.json(),
    res4.json(),
  ])) as [ApiSong[], Difficulty[], ApiSong[], Difficulty[]];

  const songs = new Map<number, Song>();
  for (const song of enSongs) {
    songs.set(song.id, {
      en: song,
    });
  }

  for (const song of jpSongs) {
    const existing = songs.get(song.id);
    if (existing) {
      existing.jp = song;
    } else {
      songs.set(song.id, {
        jp: song,
      });
    }
  }

  // TODO: merge this with en, songs gonna get append chart on one server before other
  const difficulties = new Map(jpDifficulties.map((it) => [it.id, it]));

  return [songs, difficulties];
}

const fetchSongsOptions = queryOptions({
  queryFn: () => fetchSongs,
  queryKey: ["sekai-master-diff-db", "songs"],
  refetchOnWindowFocus: false,
  staleTime: Infinity,
  refetchOnMount: false,
});

export class SongRepository {
  songs: Song[] = $state([]);
  songsById = new SvelteMap<number, Song>();
  difficulties = new SvelteMap<number, Difficulty>();
  loading = $state(true);
  ready: Promise<any>;

  #songNameIndex = $derived.by(() => {
    const index = new Index({
      // tokenize: "tolerant",
      // encoder: new Encoder(Charset.Normalize)
    });
    for (const song of this.songs) {
      const text = [song.en?.title, song.jp?.title]
        .filter((it) => it != undefined)
        .join(" ");
      const id = songId(song);
      index.add(id, text);
    }

    return index;
  });


  constructor() {
    this.ready = this.refetch();
  }

  async refetch() {
    this.loading = true;
    // TODO: index by id
    const res = await fetchSongs();
    this.songs = [...res[0].values()];
    this.songsById = new SvelteMap(res[0]);
    this.difficulties = new SvelteMap(res[1]);
    this.loading = false;
  }

  getSongDetail(id: number) {
    const song = this.songsById.get(id);
    if (!song) {
      return undefined;
    }

    const diff = this.difficulties.values().filter((it) => it.musicId === id);

    return {
      song,
      difficulties: [...diff],
    };
  }

  // TODO: we cant infer note count reliably because hold note miss info is no where to be found
  // wait is this true, or does it register as Great insteaad
  matchChart(name: string, noteCount: number) {
    const matched = this.#songNameIndex.search(name, {
      suggest: true,
    });
    const id = matched.at(0);
    if (!id) {
      return;
    }

    const difficulty = this.difficulties
      .values()
      .filter((it) => it.musicId === id)
      .find((it) => it.totalNoteCount === noteCount);

    return {
      difficulty,
      song: this.songsById.get(id as number),
    };
  }
}

export function songId(song: Song) {
  return (song.en?.id ?? song.jp?.id)!;
}
