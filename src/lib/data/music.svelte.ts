// Music + chart data for one server. The old song.svelte.ts merged jp and en
// into a single record; we do not do that any more - whichever server is picked
// in settings is the only one we read.
//
// https://sekai-world.github.io/sekai-master-db-diff/musics.json

import { SvelteMap } from "svelte/reactivity";
import type { Difficulty as DifficultyName } from "$lib/pipeline/regions";
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

export interface ChartMatch {
  music: Music;
  chart?: Chart;
  /** 0..1 title similarity */
  score: number;
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

/** Dice coefficient over character bigrams; forgiving of the odd wrong glyph */
export function similarity(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;

  const bigrams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const gram = a.slice(i, i + 2);
    bigrams.set(gram, (bigrams.get(gram) ?? 0) + 1);
  }

  let hits = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const gram = b.slice(i, i + 2);
    const left = bigrams.get(gram) ?? 0;
    if (left > 0) {
      bigrams.set(gram, left - 1);
      hits += 1;
    }
  }

  return (2 * hits) / (a.length + b.length - 2);
}

class MusicRepository {
  musics: Music[] = $state([]);
  charts: Chart[] = $state([]);
  byId = new SvelteMap<number, Music>();
  loading = $state(false);
  error: string | null = $state(null);
  loadedServer: string | null = $state(null);

  #normalized = $derived(
    this.musics.map((music) => ({
      music,
      title: normalizeTitle(music.title),
      pronunciation: normalizeTitle(music.pronunciation ?? ""),
    })),
  );

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
      this.loadedServer = server;
    } catch (cause) {
      this.error = cause instanceof Error ? cause.message : String(cause);
      throw cause;
    } finally {
      this.loading = false;
    }
  }

  chartsFor(musicId: number): Chart[] {
    return this.#chartsByMusic.get(musicId) ?? [];
  }

  chartOf(musicId: number, difficulty: DifficultyName) {
    return this.chartsFor(musicId).find((chart) => chart.musicDifficulty === difficulty);
  }

  /** ranked title search, used by both the matcher and the correction box */
  search(query: string, limit = 8) {
    const needle = normalizeTitle(query);
    if (!needle) return [];

    return this.#normalized
      .map(({ music, title, pronunciation }) => ({
        music,
        score: Math.max(similarity(needle, title), similarity(needle, pronunciation)),
      }))
      .filter((hit) => hit.score > 0.2)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Best (music, chart) for an OCR'd title. The judgement total is the strong
   * signal - it equals the chart's note count - so a title that is only roughly
   * right still lands on the correct chart.
   */
  matchChart(title: string, noteCount?: number | null, difficulty?: DifficultyName | null): ChartMatch | null {
    const candidates = this.search(title, 12);
    if (candidates.length === 0) return null;

    let best: (ChartMatch & { ranked: number }) | null = null;

    for (const { music, score } of candidates) {
      const charts = this.chartsFor(music.id);

      const byNotes = noteCount ? charts.find((chart) => chart.totalNoteCount === noteCount) : undefined;
      const byDifficulty = difficulty
        ? charts.find((chart) => chart.musicDifficulty === difficulty)
        : undefined;

      const chart = byNotes ?? byDifficulty;
      const matchedBy: ChartMatch["matchedBy"] = byNotes ? "noteCount" : byDifficulty ? "difficulty" : "none";
      // an exact note-count hit outweighs a slightly better title match
      const ranked = score + (byNotes ? 0.5 : 0);
      const confident = byNotes ? score >= 0.35 : score >= 0.6;

      if (!best || ranked > best.ranked) {
        best = { music, chart: confident ? chart : undefined, score, matchedBy, confident, ranked };
      }
    }

    if (!best) return null;
    const { ranked: _ranked, ...match } = best;
    return match;
  }
}

export const musicRepository = new MusicRepository();
