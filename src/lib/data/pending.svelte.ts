import { PersistedState } from "runed";
import type { Difficulty, NumericField } from "$lib/pipeline/regions";
import { settings } from "./settings.svelte";

/**
 * A screenshot the reader was not confident about, waiting to be corrected.
 *
 * The extracted numbers persist so a reload does not throw away a half-finished
 * review of 500 imports. The screenshot itself does NOT - it lives in an
 * in-memory preview map for the current session only, and after a reload the
 * review form shows the numbers without the image.
 */
export interface PendingReview {
  id: number;
  fileName: string;
  reason: string;
  playedAt: number;
  sourceHash: string;
  musicId: number | null;
  difficulty: Difficulty | null;
  titleQuery: string;
  values: Partial<Record<NumericField, number | null>>;
  /** fields whose glyphs did not match cleanly, kept so the form can flag them */
  lowConfidence: NumericField[];
}

type Server = typeof settings.current.server;

const stores = new Map<Server, PersistedState<PendingReview[]>>();

function store(server: Server = settings.current.server) {
  let existing = stores.get(server);
  if (!existing) {
    existing = new PersistedState<PendingReview[]>(`pendingReviews:${server}`, []);
    stores.set(server, existing);
  }
  return existing;
}

/** object urls for this session only; empty after a reload, by design */
const previews = new Map<number, string>();

export function pendingReviews(): PendingReview[] {
  return store().current;
}

export function pendingById(id: number) {
  return store().current.find((entry) => entry.id === id);
}

export function previewOf(id: number) {
  return previews.get(id);
}

export function addPending(entry: Omit<PendingReview, "id">, preview?: Blob) {
  const current = store();
  const id = current.current.reduce((max, it) => Math.max(max, it.id), 0) + 1;
  current.current = [...current.current, { ...entry, id }];
  if (preview) previews.set(id, URL.createObjectURL(preview));
  return id;
}

export function updatePending(id: number, patch: Partial<PendingReview>) {
  const current = store();
  current.current = current.current.map((entry) =>
    entry.id === id ? { ...entry, ...patch } : entry,
  );
}

export function resolvePending(id: number) {
  const current = store();
  current.current = current.current.filter((entry) => entry.id !== id);
  const url = previews.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    previews.delete(id);
  }
}

export function clearPending() {
  for (const [id] of previews) resolvePending(id);
  store().current = [];
}

/** truncated sha-256 of the file bytes - enough to spot the same screenshot twice */
export async function hashFile(file: Blob): Promise<string> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return [...new Uint8Array(digest)]
      .slice(0, 8)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    // insecure context - dedup by hash simply does not apply
    return "";
  }
}
