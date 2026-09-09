import { PersistedState } from "runed";
import { SvelteMap } from "svelte/reactivity";
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

class PendingQueue {
  /** one queue per server, like the records themselves */
  #stores = new Map<Server, PersistedState<PendingReview[]>>();
  /** object urls for this session only; empty after a reload, by design */
  #previews = new SvelteMap<number, string>();

  #store(server: Server = settings.current.server) {
    let existing = this.#stores.get(server);
    if (!existing) {
      existing = new PersistedState<PendingReview[]>(`pendingReviews:${server}`, []);
      this.#stores.set(server, existing);
    }
    return existing;
  }

  get entries(): PendingReview[] {
    return this.#store().current;
  }

  get count() {
    return this.entries.length;
  }

  get first(): PendingReview | undefined {
    return this.entries[0];
  }

  byId(id: number) {
    return this.entries.find((entry) => entry.id === id);
  }

  previewOf(id: number) {
    return this.#previews.get(id);
  }

  add(entry: Omit<PendingReview, "id">, preview?: Blob) {
    const store = this.#store();
    const id = store.current.reduce((max, it) => Math.max(max, it.id), 0) + 1;
    store.current = [...store.current, { ...entry, id }];
    if (preview) this.#previews.set(id, URL.createObjectURL(preview));
    return id;
  }

  resolve(id: number) {
    const store = this.#store();
    store.current = store.current.filter((entry) => entry.id !== id);
    const url = this.#previews.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      this.#previews.delete(id);
    }
  }

  clear() {
    for (const id of [...this.#previews.keys()]) this.resolve(id);
    this.#store().current = [];
  }
}

export const pendingQueue = new PendingQueue();

/** truncated sha-256 of the file bytes - enough to spot the same screenshot twice */
export async function hashFile(bytes: ArrayBuffer): Promise<string> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)]
      .slice(0, 8)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    // insecure context - dedup by hash simply does not apply
    return "";
  }
}
