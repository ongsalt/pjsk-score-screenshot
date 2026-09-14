# Reactivity graph

Who is a signal, who derives from whom, and where writes are allowed. Keep this
current when touching anything under `src/lib/data` or a page's `$derived`s.
Two bugs have already come from not having it: a lookup map held in a plain
field (replaced after fetch, nobody notified) and a slot created lazily inside a
getter (a state write during render, which throws on server switch).

## Rules

1. **A field that is ever reassigned must be `$state`.** Whether the value is a
   Map, a SvelteMap or an array makes no difference to that - the *field* is the
   signal. `SvelteMap` is only for maps that are mutated in place.
2. **No state writes on a read path.** Getters and `$derived` bodies run during
   render. They may read anything; they may not create, replace or mutate state.
   All per-server stores and slots are therefore built up front in field
   initialisers, never on first access.
3. **Writes happen in three places only:** event handlers, `async`
   continuations after an `await`, and effects. `#fetch` writes after its
   `await`; `add`/`resolve`/`hydrate` are called from handlers.
4. **`untrack` is a last resort and must say why.** The one use is documented
   below with an open question attached to it.

## Sources

| signal | kind | written by |
| --- | --- | --- |
| `settings.current` | PersistedState | Settings page, nav rail |
| `playRecords` → `#stores[server].current` | PersistedState ×2 (eager) | `add`, `remove` |
| `pendingQueue` → `#stores[server].current` | PersistedState ×2 (eager) | `add`, `resolve`, `clear` |
| `pendingQueue.#previews` | SvelteMap (mutated) | `add`, `resolve`, `hydrate` (async) |
| `musicRepository` → `ServerData` fields ×2 (eager) | `$state` each | `#fetch`, after its awaits |
| URL params (`useSearchParams`) | runed | user input via `bind:`, `params.x = …` |
| `MediaQuery` | svelte/reactivity | the browser |

`musicRepository.musics`, `.byId`, `.chartById`, `.loading`, … are getters that
read **`settings.current.server`** and then the chosen slot's field. Both are
tracked, so every consumer re-runs on a server switch as well as on data load.

## Derivations

```
settings.server ─┬─► musicRepository.<field>  (getter, picks the slot)
                 ├─► playRecords.all           (getter, picks the store)
                 └─► pendingQueue.entries      (getter, picks the store)

+layout.svelte   $effect(server) ──► musicRepository.load()   [untracked call]

/ (history)      records = playRecords.all
                 filtered(records, params.f, chartById)
                 newest / groups(filtered) ──► rows; selected(newest, params.run)

/songs           ranked  = f(musics, playRecords.all, difficulty)   [body untracked, see below]
                 rows    = f(query, onlyPlayed, ranked, search())
                 selected(params.sel, ranked, rows) ──► detail panel

/songs/[id]      chart(data.charts, params.d) ──► records = playRecords.forChart(chart.id)
                 best / bestMiss / spark(records)

/add             pendingQueue.entries, tally, progress (all written from the import loop)
/add/review/[id] entry = pendingQueue.byId(id)  ──► form binds straight into entry.*
```

## Open item

`/songs` `ranked` is a `$derived` whose body is wrapped in `untrack`, reading
`musics`, `playRecords.all` and `difficulty` deliberately first. Before that it
re-ran on clearing the search box - an invalidation that should not have
reached it. The cause was never identified; the three candidates are
`useSearchParams.get()` writing its cache on read, `PersistedState.current`'s
subscriber, and (fixed since) the lookup maps changing identity. With those
maps now proper `$state` and `chartOf` no longer a `$derived`, the `untrack`
may be unnecessary. Remove it and re-test before assuming it still is.
