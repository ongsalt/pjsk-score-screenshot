import { PersistedState } from "runed";

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

const storage = new PersistedState<PlayRecord[]>("playRecords", []);
let currentId = Math.max(...storage.current.map((it) => it.id)) + 1;

// return a flow
export function getPlayRecordByChartId(id: number): PlayRecord[] {
  return storage.current.filter((it) => it.chartId === id);
}

export function hasPlayedSong(id: number) {
  return storage.current.some((it) => it.songId === id);
}


export function addPlayRecord(record: Omit<PlayRecord, "id">) {
  storage.current.push({
    ...record,
    id: currentId,
  });
  currentId += 1;

  // just in case
  storage.current = storage.current;
}

export function deletePlayRecord(id: number) {
  storage.current = storage.current.filter((it) => it.id);
}
