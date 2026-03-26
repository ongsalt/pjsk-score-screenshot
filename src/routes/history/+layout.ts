import { getSongs } from "$lib/data/song";
import type { LayoutLoad } from "./$types";

export const load: LayoutLoad = async () => {
  return {
    songs: await getSongs(),
  };
};
