import { SongRepository } from "$lib/data/song.svelte";
import type { LayoutLoad } from "./history/$types";

export const ssr = false;

export const load: LayoutLoad = async () => {
  const songRepository = new SongRepository();

  return {
    songRepository,
  };
};
