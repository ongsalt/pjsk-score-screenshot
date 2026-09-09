import type { PlayRecord } from "./play-record.svelte";

type Result = PlayRecord["result"];

/**
 * The judgement fields, however they arrive - saved records use `undefined` for
 * a missing value, the import form uses `null` while a field is empty.
 */
type Judgements = {
  perfect?: number | null;
  great?: number | null;
  good?: number | null;
  bad?: number | null;
  miss?: number | null;
};

/** perfect + great + good + bad + miss, which equals the chart's note count */
export function noteTotal(result: Judgements): number | null {
  const parts = [result.perfect, result.great, result.good, result.bad, result.miss];
  if (parts.some((value) => value === undefined || value === null)) return null;
  return parts.reduce((sum, value) => sum! + value!, 0)!;
}

/**
 * What players actually judge a run by. Score depends on team power, so it says
 * nothing about how well the chart was played - this does.
 */
export function perfectRate(result: Judgements): number | null {
  const total = noteTotal(result);
  if (!total || result.perfect === undefined || result.perfect === null) return null;
  return result.perfect / total;
}

export function formatRate(rate: number | null) {
  return rate === null ? "—" : `${(rate * 100).toFixed(1)}%`;
}

/** bad and miss break combo in this game; good does not */
export function clearMark(result: Judgements): "AP" | "FC" | null {
  const { great, good, bad, miss } = result;
  if ([bad, miss].some((value) => value === undefined || value === null)) return null;
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

/** for a title attribute - the exact moment behind a relative label */
export function fullTimestamp(timestamp: number) {
  return timestamp ? new Date(timestamp).toLocaleString() : "No timestamp recorded";
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

export interface Sparkline {
  /** polyline points attribute */
  points: string;
  lastX: string;
  lastY: string;
  width: number;
  height: number;
  count: number;
}

/**
 * Perfect rate over time, scaled to whatever range this chart actually spans -
 * the interesting variation is in the last couple of percent, so a 0-100 axis
 * would flatten every line into the same shape.
 */
export function sparkline(
  records: { playedAt: number; result: Judgements }[],
  width = 358,
  height = 84,
): Sparkline | null {
  const points = [...records]
    .sort((a, b) => a.playedAt - b.playedAt)
    .map((record) => perfectRate(record.result))
    .filter((rate): rate is number => rate !== null);

  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const x = (index: number) => 6 + (index * (width - 12)) / (points.length - 1);
  const y = (value: number) => height - 8 - ((value - min) / span) * (height - 20);

  return {
    points: points.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" "),
    lastX: x(points.length - 1).toFixed(1),
    lastY: y(points.at(-1)!).toFixed(1),
    width,
    height,
    count: points.length,
  };
}
