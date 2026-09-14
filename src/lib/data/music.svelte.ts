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
  /**
   * how the chart was chosen: the judgement total under a title hit, the
   * (notes, difficulty, level) fingerprint alone when the title was unreadable,
   * or just the pill colour as a last resort
   */
  matchedBy: "noteCount" | "fingerprint" | "difficulty" | "none";
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

type Server = keyof typeof serverResources;

/**
 * Everything belonging to one server: its songs, its charts and its search
 * index. Song and chart ids only mean anything inside one of these, so they are
 * never mixed - and keeping a slot per server makes switching back instant
 * rather than a refetch.
 */
class ServerData {
  musics: Music[] = $state([]);
  charts: Chart[] = $state([]);
  byId = new SvelteMap<number, Music>();
  /** charts by their own id - the history feed looks up one per record */
  chartById = new SvelteMap<number, Chart>();
  chartsByMusic: Map<number, Chart[]> = $state(new Map());
  /** charts by total note count - the judgement sum is a fingerprint for the chart */
  chartsByNotes: Map<number, Chart[]> = $state(new Map());
  /** normalized title / kana / romaji per song id, for exact-match checks */
  searchable: Map<number, Searchable> = $state(new Map());
  /** flexsearch over titles, kana readings, romaji and credits */
  index: Index | null = $state(null);

  loading = $state(false);
  loaded = $state(false);
  error: string | null = $state(null);
  /** this slot's own in-flight fetch, so two servers can never collide */
  pending: Promise<void> | null = null;
}

class MusicRepository {
  #slots = new SvelteMap<Server, ServerData>();

  /** the slot for a server, created empty on first use */
  #slot(server: Server = settings.current.server): ServerData {
    let slot = this.#slots.get(server);
    if (!slot) {
      slot = new ServerData();
      this.#slots.set(server, slot);
    }
    return slot;
  }

  get musics() {
    return this.#slot().musics;
  }

  get charts() {
    return this.#slot().charts;
  }

  get byId() {
    return this.#slot().byId;
  }

  get chartById() {
    return this.#slot().chartById;
  }

  get loading() {
    return this.#slot().loading;
  }

  get error() {
    return this.#slot().error;
  }

  get loaded() {
    return this.#slot().loaded;
  }

  /** fetches a server's database once; a no-op once that slot is filled */
  load(server: Server = settings.current.server): Promise<void> {
    const slot = this.#slot(server);
    if (slot.loaded && !slot.error) return Promise.resolve();

    slot.pending ??= this.#fetch(server, slot).finally(() => {
      slot.pending = null;
    });
    return slot.pending;
  }

  /** force a re-fetch of the current server, ignoring what the slot holds */
  refresh(): Promise<void> {
    const server = settings.current.server;
    this.#slot(server).loaded = false;
    return this.load(server);
  }

  async #fetch(server: Server, slot: ServerData) {
    slot.loading = true;
    slot.error = null;

    try {
      const resource = serverResources[server];
      const [musics, charts] = await Promise.all([
        fetch(resource.musics).then((response) => response.json() as Promise<Music[]>),
        fetch(resource.musicDifficulties).then((response) => response.json() as Promise<Chart[]>),
      ]);

      const chartsByMusic = new Map<number, Chart[]>();
      const chartsByNotes = new Map<number, Chart[]>();
      for (const chart of charts) {
        const byMusic = chartsByMusic.get(chart.musicId);
        if (byMusic) byMusic.push(chart);
        else chartsByMusic.set(chart.musicId, [chart]);
        const byNotes = chartsByNotes.get(chart.totalNoteCount);
        if (byNotes) byNotes.push(chart);
        else chartsByNotes.set(chart.totalNoteCount, [chart]);
      }

      slot.musics = musics;
      slot.charts = charts;
      slot.byId = new SvelteMap(musics.map((music) => [music.id, music]));
      slot.chartById = new SvelteMap(charts.map((chart) => [chart.id, chart]));
      slot.chartsByMusic = chartsByMusic;
      slot.chartsByNotes = chartsByNotes;
      // build the index now, while the page is still showing a loading state -
      // deferring it to the first keystroke costs ~100ms right when someone is
      // typing (717 songs, tokenize "full")
      this.#buildIndex(musics, slot);
      slot.loaded = true;
    } catch (cause) {
      slot.error = cause instanceof Error ? cause.message : String(cause);
      throw cause;
    } finally {
      slot.loading = false;
    }
  }

  #buildIndex(musics: Music[], slot: ServerData) {
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

    slot.searchable = searchable;
    slot.index = index;
  }

  chartsFor(musicId: number): Chart[] {
    return this.#slot().chartsByMusic.get(musicId) ?? [];
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

    const index = this.#slot().index;
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
    const normalized = this.#slot().searchable.get(id);
    if (!normalized) return false;
    return (
      key === normalized.title ||
      key === normalized.pronunciation ||
      (romajiKey !== "" && romajiKey === normalized.romaji)
    );
  }

  /**
   * Best (music, chart) for what the screenshot reader produced.
   *
   * The judgement total is the strongest signal - it equals the chart's note
   * count, so a title that is only roughly right still lands on the correct
   * chart. When the title is unreadable altogether, (notes, difficulty, level)
   * alone identifies 82% of charts outright, and that is the fallback.
   *
   * An exact title with a note count that matches NONE of the song's charts is
   * deliberately not confident: it means a misread digit or a chart the database
   * has since revised, and either way a person should look before it is saved.
   */
  matchChart(
    title: string,
    noteCount?: number | null,
    difficulty?: DifficultyName | null,
    level?: number | null,
  ): ChartMatch | null {
    const candidates = this.search(title, 12);
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
      const rank = (byNotes ? 100 : 0) + (exact ? 50 : 0) - position;
      // with no judgement total to check against, an exact title is the best we have
      const confident = !!byNotes || (exact && !noteCount);

      if (!best || rank > best.rank) {
        best = { music, chart: confident ? chart : undefined, exact, matchedBy, confident, rank };
      }
    });

    if (best && (best as ChartMatch).confident) {
      const { rank: _rank, ...match } = best as ChartMatch & { rank: number };
      return match;
    }

    // title got nowhere useful; let the numbers identify the chart on their own
    const fingerprint = this.#byFingerprint(noteCount, difficulty, level);
    if (fingerprint) {
      return {
        music: this.byId.get(fingerprint.musicId)!,
        chart: fingerprint,
        exact: false,
        matchedBy: "fingerprint",
        confident: true,
      };
    }

    if (!best) return null;
    const { rank: _rank, ...match } = best as ChartMatch & { rank: number };
    return match;
  }

  /** the one chart with this note count, difficulty and level - or nothing */
  #byFingerprint(noteCount?: number | null, difficulty?: DifficultyName | null, level?: number | null) {
    if (!noteCount) return undefined;
    const matches = (this.#slot().chartsByNotes.get(noteCount) ?? []).filter(
      (chart) =>
        (!difficulty || chart.musicDifficulty === difficulty) &&
        (!level || chart.playLevel === level),
    );
    return matches.length === 1 ? matches[0] : undefined;
  }
}

export const musicRepository = new MusicRepository();
