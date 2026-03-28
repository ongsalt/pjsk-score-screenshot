// https://sekai-world.github.io/sekai-master-db-diff/musics.json

import { queryOptions } from "@tanstack/svelte-query";
import Fuse from "fuse.js";

export type Song = {
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

export type Difficulty = {
  id: number;
  musicId: number;
  musicDifficulty: string; // "easy" | "hard" | ...
  playLevel: number;
  totalNoteCount: number;
};

export async function fetchSongs() {
  // TODO: error handling, caching and invalidation
  const res1 = await fetch(
    "https://sekai-world.github.io/sekai-master-db-diff/musics.json",
  );

  const res2 = await fetch(
    "https://sekai-world.github.io/sekai-master-db-diff/musicDifficulties.json",
  );

  return (await Promise.all([res1.json(), res2.json()])) as [
    Song[],
    Difficulty[],
  ];
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
  songsById = new Map<number, Song>();
  difficulties: Difficulty[] = $state([]);
  loading = $state(true);

  constructor() {
    this.refetch();
  }

  async refetch() {
    this.loading = true;
    // TODO: index by id
    [this.songs, this.difficulties] = await fetchSongs();
    for (const s of this.songs) {
      this.songsById.set(s.id, s);
    }
    this.loading = false;
  }

  getSongDetail(id: number) {
    const song = this.songsById.get(id);

    if (!song) {
      return undefined;
    }

    const diff = this.difficulties!.filter((it) => it.musicId == id);

    return {
      song,
      difficulties: diff,
    };
  }

  matchSong(name: string, noteCount: number) {
    const filtered = this.difficulties.filter(
      (it) => it.totalNoteCount === noteCount,
    );

    const candidates = filtered.map((it) => ({
      difficulty: it,
      song: this.songsById.get(it.musicId),
    }));

    // exact match
    const f = candidates.find((it) => it.song?.title === name);
    if (f) {
      return f;
    }

    const fuse = new Fuse(candidates, {
      keys: ["song.title"]
    });
    const matched = fuse.search(name);

    return matched[0].item;
  }
}
