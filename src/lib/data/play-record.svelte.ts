import { PersistedState } from "runed";
import { z } from "zod";
import { serverResources, settings } from "./settings.svelte";

// free tier d1 is more than enough for this
export interface PlayRecord {
  id: number;
  songId: number;
  chartId: number;
  result: {
    score?: number;
    scoreRank?: string;
    highScore?: number;
    maxCombo?: number;

    perfect?: number;
    great?: number;
    good?: number;
    bad?: number;
    miss?: number;

    late?: number;
    early?: number;
    wrongWay?: number;
  };
  playedAt: number;
  /** sha-256 (truncated) of the screenshot this came from, so re-importing the
   *  same file is caught even though the image itself is never kept */
  sourceHash?: string;

  // createdAt: number;
}

type Server = typeof settings.current.server;

/**
 * Records are stored per server. Song and chart ids only mean anything inside
 * one server's database - the same song has a different id on jp and en - so a
 * single shared list would point half the records at the wrong charts.
 */
class PlayRecords {
  // one store per server, built up front: a getter that creates state on first
  // read runs during render, and that is where state must never be written
  #stores = new Map<Server, PersistedState<PlayRecord[]>>(
    (Object.keys(serverResources) as Server[]).map((server) => [
      server,
      new PersistedState<PlayRecord[]>(`playRecords:${server}`, this.#adopt(server)),
    ]),
  );

  #store(server: Server = settings.current.server) {
    return this.#stores.get(server)!;
  }

  /**
   * Records written before the split lived under a single "playRecords" key with
   * no server attached. They were all made against whatever server was selected
   * at the time, so hand them to that one. The old key is left alone.
   */
  #adopt(server: Server): PlayRecord[] {
    if (typeof localStorage === "undefined") return [];
    if (server !== settings.current.server) return [];
    if (localStorage.getItem(`playRecords:${server}`) !== null) return [];

    try {
      const legacy = localStorage.getItem("playRecords");
      return legacy ? (JSON.parse(legacy) as PlayRecord[]) : [];
    } catch {
      return [];
    }
  }

  /** every record on the current server, newest last */
  get all(): PlayRecord[] {
    return this.#store().current;
  }

  get count() {
    return this.all.length;
  }

  on(server: Server): PlayRecord[] {
    return this.#store(server).current;
  }

  forChart(chartId: number): PlayRecord[] {
    return this.all.filter((record) => record.chartId === chartId);
  }

  hasSong(songId: number) {
    return this.all.some((record) => record.songId === songId);
  }

  hasSourceHash(hash: string) {
    return hash !== "" && this.all.some((record) => record.sourceHash === hash);
  }

  add(record: Omit<PlayRecord, "id">) {
    const store = this.#store();
    const id = store.current.reduce((max, it) => Math.max(max, it.id), 0) + 1;
    store.current = [...store.current, { ...record, id }];
    return id;
  }

  remove(id: number) {
    const store = this.#store();
    store.current = store.current.filter((record) => record.id !== id);
  }

  /** everything on one server, gone. The caller confirms; this does not. */
  clear(server: Server = settings.current.server) {
    this.#store(server).current = [];
  }

  /**
   * Merge an export into a server's store. Ids are per device, so they are
   * reassigned; a record already here (same screenshot hash, or failing that
   * the same chart, time and score) is skipped rather than doubled.
   */
  import(records: PlayRecord[], server: Server): { added: number; skipped: number } {
    const store = this.#store(server);
    const existing = store.current;
    const seen = new Set(existing.map(identity));
    let nextId = existing.reduce((max, it) => Math.max(max, it.id), 0) + 1;

    const added: PlayRecord[] = [];
    for (const record of records) {
      const key = identity(record);
      if (seen.has(key)) continue;
      seen.add(key);
      added.push({ ...record, id: nextId++ });
    }

    store.current = [...existing, ...added];
    return { added: added.length, skipped: records.length - added.length };
  }
}

/** what makes two records the same play, across devices and re-imports */
function identity(record: PlayRecord) {
  return record.sourceHash
    ? `hash:${record.sourceHash}`
    : `play:${record.chartId}/${record.playedAt}/${record.result.score ?? ""}`;
}

/** the export file, validated before a single record is touched */
export const exportSchema = z.object({
  server: z.enum(["jp", "en"]),
  exportedAt: z.string().optional(),
  records: z.array(
    z.object({
      id: z.number(),
      songId: z.number(),
      chartId: z.number(),
      playedAt: z.number(),
      sourceHash: z.string().optional(),
      result: z.object({
        score: z.number().optional(),
        scoreRank: z.string().optional(),
        highScore: z.number().optional(),
        maxCombo: z.number().optional(),
        perfect: z.number().optional(),
        great: z.number().optional(),
        good: z.number().optional(),
        bad: z.number().optional(),
        miss: z.number().optional(),
        late: z.number().optional(),
        early: z.number().optional(),
        wrongWay: z.number().optional(),
      }),
    }),
  ),
});

export type RecordExport = z.infer<typeof exportSchema>;

export const playRecords = new PlayRecords();
