// https://sekai-world.github.io/sekai-master-db-diff/musics.json

import { runOnce } from "$lib/utils";

type Song = {
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

type Difficulty = {
  id: number;
  musicId: number;
  musicDifficulty: string; // "easy" | "hard" | ...
  playLevel: number;
  totalNoteCount: number;
};

let songs: Song[] | null = null;
let difficulties: Difficulty[] | null = null;

const fetchSongs = runOnce(async () => {
  // TODO: error handling, caching and invalidation
  const res1 = await fetch(
    "https://sekai-world.github.io/sekai-master-db-diff/musics.json",
  );

  const res2 = await fetch(
    "https://sekai-world.github.io/sekai-master-db-diff/musicDifficulties.json",
  );

  [songs, difficulties] = await Promise.all([res1.json(), res2.json()]);
});

export async function getSongs() {
  await fetchSongs();

  return songs!;
}

export async function getSongDetail(id: number) {
  await fetchSongs();

  const song = songs!.find((it) => it.id == id);

  if (!song) {
    return undefined;
  }

  const diff = difficulties!.filter((it) => it.musicId == id);
  
  return {
    song,
    difficulties: diff,
  };
}
