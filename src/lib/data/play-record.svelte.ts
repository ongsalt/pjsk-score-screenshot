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

  // createdAt: number;
}

type Server = typeof settings.current.server;

/**
 * Records are stored per server. Song and chart ids only mean anything inside
 * one server's database - the same song has a different id on jp and en - so a
 * single shared list would point half the records at the wrong charts.
 */
const stores = new Map<Server, PersistedState<PlayRecord[]>>();

function store(server: Server = settings.current.server) {
  let existing = stores.get(server);
  if (!existing) {
    existing = new PersistedState<PlayRecord[]>(`playRecords:${server}`, adopt(server));
    stores.set(server, existing);
  }
  return existing;
}

/**
 * Records written before the split lived under a single "playRecords" key with
 * no server attached. They were all made against whatever server was selected
 * at the time, so hand them to that one. The old key is left alone.
 */
function adopt(server: Server): PlayRecord[] {
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

export function playRecords(server?: Server): PlayRecord[] {
  return store(server).current;
}

// return a flow
export function getPlayRecordByChartId(id: number): PlayRecord[] {
  return playRecords().filter((it) => it.chartId === id);
}

export function hasPlayedSong(id: number) {
  return playRecords().some((it) => it.songId === id);
}

export function addPlayRecord(record: Omit<PlayRecord, "id">) {
  const current = store();
  const nextId = current.current.reduce((max, it) => Math.max(max, it.id), 0) + 1;
  current.current = [...current.current, { ...record, id: nextId }];
}

export function deletePlayRecord(id: number) {
  const current = store();
  current.current = current.current.filter((it) => it.id !== id);
}
