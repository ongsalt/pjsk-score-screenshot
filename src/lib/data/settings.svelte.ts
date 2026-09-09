import { PersistedState } from "runed";

type Settings = {
  server: "en" | "jp";
};

const defaultSettings: Settings = {
  server: "jp",
};

export const settings = new PersistedState("settings", defaultSettings);

export type ServerResource = {
  musics: string;
  musicDifficulties: string;
};

export const serverResources: Record<Settings["server"], ServerResource> = {
  en: {
    musics: "https://sekai-world.github.io/sekai-master-db-en-diff/musics.json",
    musicDifficulties:
      "https://sekai-world.github.io/sekai-master-db-en-diff/musicDifficulties.json",
  },
  jp: {
    musics: "https://sekai-world.github.io/sekai-master-db-diff/musics.json",
    musicDifficulties:
      "https://sekai-world.github.io/sekai-master-db-diff/musicDifficulties.json",
  },
};
