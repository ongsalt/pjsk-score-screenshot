import { PersistedState } from "runed";
import { SvelteMap } from "svelte/reactivity";
import type { Difficulty, NumericField } from "$lib/pipeline/regions";
import { serverResources, settings } from "./settings.svelte";

/**
 * A screenshot the reader was not confident about, waiting to be corrected.
 *
 * The extracted numbers persist in localStorage, and the screenshot itself is
 * kept in the origin private file system - so a reload mid-way through 500
 * imports loses nothing, and you can still see what you are correcting. The
 * file is deleted the moment the entry is reviewed or discarded: nothing
 * outlives the queue. Clean imports are never written anywhere.
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

/**
 * Screenshots awaiting review live in OPFS under pending/<server>/<id>. It is
 * a real filesystem, so hundreds of flagged shots cost nothing in memory, and
 * it is private to this origin. Older browsers without it simply get no
 * preview after a reload - the numbers are still there.
 */
async function pendingDirectory(server: Server) {
  if (typeof navigator === "undefined" || !navigator.storage?.getDirectory) return null;
  try {
    const root = await navigator.storage.getDirectory();
    const pending = await root.getDirectoryHandle("pending", { create: true });
    return await pending.getDirectoryHandle(server, { create: true });
  } catch {
    return null;
  }
}

async function writeShot(server: Server, id: number, file: Blob) {
  const dir = await pendingDirectory(server);
  if (!dir) return;
  try {
    const handle = await dir.getFileHandle(String(id), { create: true });
    const writable = await handle.createWritable();
    await writable.write(file);
    await writable.close();
  } catch {
    // no createWritable on this browser - the session preview still works
  }
}

async function readShot(server: Server, id: number): Promise<File | null> {
  const dir = await pendingDirectory(server);
  if (!dir) return null;
  try {
    return await (await dir.getFileHandle(String(id))).getFile();
  } catch {
    return null;
  }
}

async function removeShot(server: Server, id: number) {
  const dir = await pendingDirectory(server);
  if (!dir) return;
  try {
    await dir.removeEntry(String(id));
  } catch {
    // already gone
  }
}

class PendingQueue {
  /** one queue per server, like the records themselves */
  // one store per server, built up front: a getter that creates state on first
  // read runs during render, and that is where state must never be written
  #stores = new Map<Server, PersistedState<PendingReview[]>>(
    (Object.keys(serverResources) as Server[]).map((server) => [
      server,
      new PersistedState<PendingReview[]>(`pendingReviews:${server}`, []),
    ]),
  );
  /** object urls for the screenshots, keyed "<server>/<id>" - ids repeat across servers */
  #previews = new SvelteMap<string, string>();
  #hydrating = new Set<string>();

  #store(server: Server = settings.current.server) {
    return this.#stores.get(server)!;
  }

  #key(id: number, server: Server = settings.current.server) {
    return `${server}/${id}`;
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

  /** an object url for the screenshot, or undefined until hydrate() has read it back */
  previewOf(id: number) {
    return this.#previews.get(this.#key(id));
  }

  /**
   * After a reload the previews are on disk but not in memory: read back the
   * ones for this server's queue. Safe to call repeatedly.
   */
  async hydrate() {
    const server = settings.current.server;
    await Promise.all(
      this.#store(server).current.map(async (entry) => {
        const key = this.#key(entry.id, server);
        if (this.#previews.has(key) || this.#hydrating.has(key)) return;
        this.#hydrating.add(key);
        try {
          const file = await readShot(server, entry.id);
          if (file) this.#previews.set(key, URL.createObjectURL(file));
        } finally {
          this.#hydrating.delete(key);
        }
      }),
    );
  }

  add(entry: Omit<PendingReview, "id">, screenshot?: Blob) {
    const server = settings.current.server;
    const store = this.#store(server);
    const id = store.current.reduce((max, it) => Math.max(max, it.id), 0) + 1;
    store.current = [...store.current, { ...entry, id }];

    if (screenshot) {
      this.#previews.set(this.#key(id, server), URL.createObjectURL(screenshot));
      // kept on disk until this entry is reviewed
      void writeShot(server, id, screenshot);
    }
    return id;
  }

  resolve(id: number) {
    const server = settings.current.server;
    const store = this.#store(server);
    store.current = store.current.filter((entry) => entry.id !== id);

    const key = this.#key(id, server);
    const url = this.#previews.get(key);
    if (url) {
      URL.revokeObjectURL(url);
      this.#previews.delete(key);
    }
    void removeShot(server, id);
  }

  clear() {
    for (const entry of [...this.entries]) this.resolve(entry.id);
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
