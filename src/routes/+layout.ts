import { dev } from "$app/environment";
import { SongRepository } from "$lib/data/song.svelte";
import type { LayoutLoad } from "./$types";

export const prerender = !dev;
export const ssr = false;

export const load: LayoutLoad = async () => {
  const songRepository = new SongRepository();

  return {
    songRepository,
  };
};
