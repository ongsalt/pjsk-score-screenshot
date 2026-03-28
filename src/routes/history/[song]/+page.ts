import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const prerender = false;

export const load: PageLoad = async ({ params, parent }) => {
  const { songRepository } = await parent();
  await songRepository.ready;

  const detail = songRepository.getSongDetail(parseInt(params.song));
  if (!detail) {
    error(404, "Chart not founded");
  }

  return {
    detail,
  };
};
