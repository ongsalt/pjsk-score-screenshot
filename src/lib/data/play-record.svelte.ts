import { PersistedState } from "runed";
import { settings } from "./settings.svelte";

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
  #stores = new Map<Server, PersistedState<PlayRecord[]>>();

  #store(server: Server = settings.current.server) {
    let existing = this.#stores.get(server);
    if (!existing) {
      existing = new PersistedState<PlayRecord[]>(`playRecords:${server}`, this.#adopt(server));
      this.#stores.set(server, existing);
    }
    return existing;
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
}

export const playRecords = new PlayRecords();
