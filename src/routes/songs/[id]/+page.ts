import { musicRepository } from "$lib/data/music.svelte";
import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const prerender = false;

export const load: PageLoad = async ({ params }) => {
  await musicRepository.load();

  const music = musicRepository.byId.get(Number.parseInt(params.id));
  if (!music) {
    error(404, "Song not found");
  }

  return { music, charts: musicRepository.chartsFor(music.id) };
};
