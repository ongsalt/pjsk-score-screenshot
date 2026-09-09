import type { PlayRecord } from "./play-record.svelte";

type Result = PlayRecord["result"];

/** perfect + great + good + bad + miss, which equals the chart's note count */
export function noteTotal(result: Result): number | null {
  const parts = [result.perfect, result.great, result.good, result.bad, result.miss];
  if (parts.some((value) => value === undefined)) return null;
  return parts.reduce((sum, value) => sum! + value!, 0)!;
}

/**
 * What players actually judge a run by. Score depends on team power, so it says
 * nothing about how well the chart was played - this does.
 */
export function perfectRate(result: Result): number | null {
  const total = noteTotal(result);
  if (!total || result.perfect === undefined) return null;
  return result.perfect / total;
}

export function formatRate(rate: number | null) {
  return rate === null ? "—" : `${(rate * 100).toFixed(1)}%`;
}

/** bad and miss break combo in this game; good does not */
export function clearMark(result: Result): "AP" | "FC" | null {
  const { great, good, bad, miss } = result;
  if ([bad, miss].some((value) => value === undefined)) return null;
  if (bad !== 0 || miss !== 0) return null;
  if (great === 0 && good === 0) return "AP";
  return "FC";
}

export function formatNumber(value: number | undefined | null) {
  return value === undefined || value === null ? "—" : value.toLocaleString("en-US");
}

const DAY = 24 * 60 * 60 * 1000;

export function dayLabel(timestamp: number) {
  if (!timestamp) return "Undated";
  const date = new Date(timestamp);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  if (timestamp >= startOfToday) return "Today";
  if (timestamp >= startOfToday - DAY) return "Yesterday";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function timeLabel(timestamp: number) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** newest first, split into day buckets for the history feed */
export function groupByDay<T extends { playedAt: number }>(records: T[]) {
  const sorted = [...records].sort((a, b) => b.playedAt - a.playedAt);
  const groups: { label: string; records: T[] }[] = [];

  for (const record of sorted) {
    const label = dayLabel(record.playedAt);
    const last = groups.at(-1);
    if (last?.label === label) last.records.push(record);
    else groups.push({ label, records: [record] });
  }

  return groups;
}
