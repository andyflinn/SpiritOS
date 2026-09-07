# Cleanup order (after AGENT.md feedback)

Andy: preferences/media in this clone are not precious. App Builder and AI apps may be scrapped. Do not spend design on those.

## Order

1. **Name/icon lock for intrinsic** (and then for anything that will become intrinsic). Must exist *before* folder moves, because today’s lock is `!app._scriptPath` and dies when an app gets a path.
2. **Spirit grid dedupe** — fixed list ∪ `listIntrinsicApps()` must not draw two tiles.
3. **Id map before prune** — `stats` → `app/stats` (etc.) applied *before* `pruneStalePreferences` on first load after a move. Cheap even though Andy does not need the old labels.
4. **First-paint decision** — eager read of intrinsic manifests at boot, *or* accept empty Spirit until fs-watcher SSE. Decide in the sitting that moves the first of the five. Recommendation: eager list of intrinsic ids so a dead watcher still shows Spirit.
5. **Move one app at a time** into `app/<name>/`, `intrinsic: true` **in the same commit**. Start with the smallest (Stats or Processes), not Groups (Groups is the mover).
6. **`api` surface for system apps** — Files / Process Browser / launchers need explicit methods (unscoped read, `spirit.shell.*` helpers) *before* those four are required to stop using globals. Do not “fix” them by grabbing `spirit` after the move.
7. **`api.hub` + Relay Chat** — separate sitting. Lint `fetch('/api/` over `app/*` only after Relay Chat is migrated. Badge summary stays `api.hub.status`.

## Do not

- Inline apps into `index.html`
- Move Natter
- Design around App Builder Apply
- Open all five moves in one sitting
