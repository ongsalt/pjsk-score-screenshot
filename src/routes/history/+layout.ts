import type { LayoutLoad } from "./$types";

export const load: LayoutLoad = async ({ parent }) => {
  const { songRepository } = await parent();
  await songRepository.ready;
};
