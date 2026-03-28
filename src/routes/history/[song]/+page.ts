import { getSongDetail } from "$lib/data/song.svelte";
import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
  try {
    const detail = (await getSongDetail(parseInt(params.song)))!;
    return {
      detail,
    };
  } catch {
    error(404, "Chart not founded");
  }
};
