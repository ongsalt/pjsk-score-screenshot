// Music + chart data for one server. The old song.svelte.ts merged jp and en
// into a single record; we do not do that any more - whichever server is picked
// in settings is the only one we read.
//
// https://sekai-world.github.io/sekai-master-db-diff/musics.json

import { Index } from "flexsearch";
import { SvelteMap } from "svelte/reactivity";
import type { Difficulty as DifficultyName } from "$lib/pipeline/regions";
import { isLatin, kanaToRomaji, looseRomaji } from "./romaji";
import { serverResources, settings } from "./settings.svelte";

export interface Music {
  id: number;
  seq: number;
  title: string;
  pronunciation: string;
  lyricist: string;
  composer: string;
  arranger: string;
  categories: string[];
  assetbundleName: string;
  publishedAt: number;
  releasedAt: number;
}

export interface Chart {
  id: number;
  musicId: number;
  musicDifficulty: DifficultyName;
  playLevel: number;
  totalNoteCount: number;
}

interface Searchable {
  title: string;
  pronunciation: string;
  romaji: string;
}

export interface ChartMatch {
  music: Music;
  chart?: Chart;
  /** the title matched a song exactly, not just closely */
  exact: boolean;
  /** whether the note count picked the chart, or we fell back to the pill colour */
  matchedBy: "noteCount" | "difficulty" | "none";
  /**
   * Good enough to fill the form in for you. A weak title match still comes back
   * as the best guess, but the UI leaves the choice to you rather than
   * committing to it - a title the database does not have (an en screenshot
   * against the jp server, say) otherwise lands on a random song.
   */
  confident: boolean;
}

/** lowercase, drop everything that is not a letter/digit/kana - manga-ocr eats spaces */
export function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Number}]/gu, "");
}

class MusicRepository {
  musics: Music[] = $state([]);
  charts: Chart[] = $state([]);
  byId = new SvelteMap<number, Music>();
  /** charts by their own id - the history feed looks up one per record */
  chartById = new SvelteMap<number, Chart>();
  loading = $state(false);
  error: string | null = $state(null);
  loadedServer: string | null = $state(null);

  /** normalized title / kana / romaji per song id, for exact-match checks */
  #searchable: Map<number, Searchable> = $state(new Map());
  /** flexsearch over titles, kana readings, romaji and credits */
  #index: Index | null = $state(null);

  #chartsByMusic = $derived.by(() => {
    const map = new Map<number, Chart[]>();
    for (const chart of this.charts) {
      const list = map.get(chart.musicId);
      if (list) list.push(chart);
      else map.set(chart.musicId, [chart]);
    }
    return map;
  });

  #pending: Promise<void> | null = null;

  /** fetches once per server; call it again after switching servers */
  load(): Promise<void> {
    const server = settings.current.server;
    if (this.loadedServer === server && !this.error) return Promise.resolve();
    if (this.#pending) return this.#pending;

    this.#pending = this.#fetch(server).finally(() => {
      this.#pending = null;
    });
    return this.#pending;
  }

  /** force a re-fetch of the current server, ignoring the cached load */
  refresh(): Promise<void> {
    this.loadedServer = null;
    return this.load();
  }

  async #fetch(server: keyof typeof serverResources) {
    this.loading = true;
    this.error = null;

    try {
      const resource = serverResources[server];
      const [musics, charts] = await Promise.all([
        fetch(resource.musics).then((response) => response.json() as Promise<Music[]>),
        fetch(resource.musicDifficulties).then((response) => response.json() as Promise<Chart[]>),
      ]);

      this.musics = musics;
      this.charts = charts;
      this.byId = new SvelteMap(musics.map((music) => [music.id, music]));
      this.chartById = new SvelteMap(charts.map((chart) => [chart.id, chart]));
      // build the index now, while the page is still showing a loading state -
      // deferring it to the first keystroke costs ~100ms right when someone is
      // typing (717 songs, tokenize "full")
      this.#buildIndex(musics);
      this.loadedServer = server;
    } catch (cause) {
      this.error = cause instanceof Error ? cause.message : String(cause);
      throw cause;
    } finally {
      this.loading = false;
    }
  }

  #buildIndex(musics: Music[]) {
    const index = new Index({ tokenize: "full" });
    const searchable = new Map<number, Searchable>();

    for (const music of musics) {
      // the title is kanji we cannot read; the kana pronunciation is what makes
      // a jp song reachable by typing latin letters
      const romaji = looseRomaji(kanaToRomaji(music.pronunciation ?? ""));
      searchable.set(music.id, {
        romaji,
        title: normalizeTitle(music.title),
        pronunciation: normalizeTitle(music.pronunciation ?? ""),
      });

      index.add(
        music.id,
        normalizeTitle(
          [music.title, music.pronunciation, music.composer, music.lyricist, music.arranger]
            .filter(Boolean)
            .join(" "),
        ) + romaji,
      );
    }

    this.#searchable = searchable;
    this.#index = index;
  }

  chartsFor(musicId: number): Chart[] {
    return this.#chartsByMusic.get(musicId) ?? [];
  }

  chartOf(musicId: number, difficulty: DifficultyName) {
    return this.chartsFor(musicId).find((chart) => chart.musicDifficulty === difficulty);
  }

  /** list filter for the songs page */
  filter(query: string): Music[] {
    return query.trim() ? this.search(query, 500) : this.musics;
  }

  /** ranked lookup, used by the songs page, the matcher and the correction box */
  search(query: string, limit = 8): Music[] {
    const needle = query.trim();
    if (!needle) return [];

    const index = this.#index;
    if (!index) return [];

    const romajiNeedle = isLatin(needle) ? looseRomaji(normalizeTitle(needle)) : "";
    const hits = index.search(needle, { limit, suggest: true }) as number[];

    // a latin query also gets a pass over the romaji readings, which flexsearch
    // indexed as their own tokens
    const extra =
      romajiNeedle && hits.length < limit
        ? (index.search(romajiNeedle, { limit, suggest: true }) as number[])
        : [];

    const key = normalizeTitle(needle);
    const found = [...new Set([...hits, ...extra])]
      .map((id) => this.byId.get(id))
      .filter((music): music is Music => music !== undefined);

    // flexsearch ranks by its own relevance, which can put a song that merely
    // contains the query above the one that IS the query ("teo" -> METEOR)
    const exact = found.filter((music) => this.#isExact(music.id, key, romajiNeedle));
    const rest = found.filter((music) => !this.#isExact(music.id, key, romajiNeedle));
    return [...exact, ...rest].slice(0, limit);
  }

  #isExact(id: number, key: string, romajiKey: string) {
    const normalized = this.#searchable.get(id);
    if (!normalized) return false;
    return (
      key === normalized.title ||
      key === normalized.pronunciation ||
      (romajiKey !== "" && romajiKey === normalized.romaji)
    );
  }

  /**
   * Best (music, chart) for an OCR'd title. The judgement total is the strong
   * signal - it equals the chart's note count - so a title that is only roughly
   * right still lands on the correct chart.
   */
  matchChart(title: string, noteCount?: number | null, difficulty?: DifficultyName | null): ChartMatch | null {
    const candidates = this.search(title, 12);
    if (candidates.length === 0) return null;

    const key = normalizeTitle(title);
    const romajiKey = isLatin(title) ? looseRomaji(key) : "";

    let best: (ChartMatch & { rank: number }) | null = null;

    candidates.forEach((music, position) => {
      const charts = this.chartsFor(music.id);
      const exact = this.#isExact(music.id, key, romajiKey);

      const byNotes = noteCount ? charts.find((chart) => chart.totalNoteCount === noteCount) : undefined;
      const byDifficulty = difficulty
        ? charts.find((chart) => chart.musicDifficulty === difficulty)
        : undefined;

      const chart = byNotes ?? byDifficulty;
      const matchedBy: ChartMatch["matchedBy"] = byNotes ? "noteCount" : byDifficulty ? "difficulty" : "none";
      // the note count is the chart's fingerprint, so it outranks search position
      const rank = (byNotes ? 100 : 0) + (exact ? 50 : 0) - position;
      // fill the form in only when the title matched outright or the judgement
      // total pins the chart - a merely close title stays a suggestion
      const confident = !!byNotes || exact;

      if (!best || rank > best.rank) {
        best = { music, chart: confident ? chart : undefined, exact, matchedBy, confident, rank };
      }
    });

    if (!best) return null;
    const { rank: _rank, ...match } = best as ChartMatch & { rank: number };
    return match;
  }
}

export const musicRepository = new MusicRepository();
