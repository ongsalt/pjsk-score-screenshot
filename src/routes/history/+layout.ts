import { musicRepository } from "$lib/data/music.svelte";
import type { LayoutLoad } from "./$types";

export const load: LayoutLoad = async () => {
  await musicRepository.load();
};
