# Cleanup: fold relay/hub into `fileServable` / `fileWritable`

**Date:** 2026-09-04  
**For:** implementation pass on `spirit/run/js/kernel.js` + tests (not a feature change)  
**Do not touch:** App Builder, Type Designer, chat UI polish

Two new **server-only** modules shipped with the lab relay and were never added to the kernel’s read-gate list. Writes are already blocked by writable-root rules. This note is the whole job.

---

## Names (do not invent `fileSaveable`)

| Name in conversation | Name in code | Role |
|---|---|---|
| “fileSaveable” | `fileWritable` | May `saveFile` / `deleteFile` this relative path? |
| `fileServable` | `fileServable` | May `loadFile` / `statFile` / `scanFolder` / generic static GET this path? |

Both live in `kernel.js` (Node half) and are exported as `spirit.core.fs.fileWritable` / `spirit.core.fs.fileServable`. `server.js` must keep using those two. Do not add a third helper with a new name.

---

## Current gates (do not redesign)

```js
const UNSERVABLE_FILES = ['js/kernel.js', 'js/jobs.js', 'js/server.js'];

function fileWritable(filePath) {
  const resolved = fsPath(ROOT_DIR, filePath);
  if (!resolved || !isWithinWritableRoot(resolved)) return false;
  if (APP_ENTRY_SCRIPT_PATTERN.test(filePath)) return false;
  if (MANIFEST_PATTERN.test(filePath)) return false;
  if (filePath.endsWith(SIDECAR_SUFFIX)) return false;
  return true;
}

function fileServable(filePath) {
  if (UNSERVABLE_FILES.indexOf(filePath) !== -1) return false;
  if (filePath.endsWith(SIDECAR_SUFFIX)) return false;
  return true;
}
```

Writable roots remain `app/`, `media/`, `published/`, plus `preferences.json`.  
`ROOT_DIR` is `spirit/run/` (`path.join(__dirname, '..')` from `kernel.js`).

`server.js` static GET still does:

```js
if (BOOT_ASSETS.indexOf(relativePath) === -1 && !spirit.core.fs.fileServable(relativePath)) {
  // 404
}
```

`BOOT_ASSETS` today:

```js
['index.html', 'relay.html', 'js/kernel.js', 'js/client/shell.js', 'favicon.svg']
```

That list is the **only** way an unservable file can still reach a browser (`js/kernel.js`). Do not put `relay.js` or `hub.js` on `BOOT_ASSETS`.

---

## What the relay work added, classified

| Path | Kind | `fileServable` today | `fileWritable` today | Required |
|---|---|---|---|---|
| `js/relay.js` | Node mailbox module | **true (gap)** | false (not a writable root) | **unservable** |
| `js/hub.js` | Node outbound-to-relay module | **true (gap)** | false | **unservable** |
| `js/server.js` | HTTP process | false | false | already correct |
| `js/jobs.js` | job runner | false | false | already correct |
| `js/kernel.js` | kernel | false + boot exception | false | already correct |
| `js/client/shell.js` | browser boot | true + boot | false | leave (client asset) |
| `relay.html` | relay homepage | true + boot | false | leave servable |
| `index.html` | desktop | true + boot | false | leave |
| `app/natter/natter.js` | app entry | true | false (`APP_ENTRY_SCRIPT_PATTERN`) | leave |
| `app/natter/natter.json` | manifest | true | false (`MANIFEST_PATTERN`) | leave |
| `app/natter/relays.json` | **app data** | true | **true** | **must stay writable and servable** |
| `app/relayChat/relayChat.js` | app entry | true | false | leave |
| `app/relayChat/relayChat.json` | manifest | true | false | leave |
| `process/js/relayLabPing/relayLabPing.js` | process script | true | false (`process/` not writable) | leave servable (Jobs/Processes may list) |
| `process/js/relayLabPing/relayLabPing.json` | process manifest | true | false | leave |
| `spirit/test/*` | harness | not under `ROOT_DIR` | n/a | ignore |

The only cleanup that is actually required: **`js/relay.js` and `js/hub.js` belong on `UNSERVABLE_FILES`**, same comment class as `js/jobs.js` / `js/server.js` (no browser half; must not appear in Files, `loadFile`, `scanFolder`, fs-watcher listings, or a raw `GET /js/relay.js`).

---

## Why `relays.json` is not a system component

NATter’s address book is the first URL `hub.js` dials. It lives at `app/natter/relays.json` on purpose:

- scoped app data via `api.fs.saveFile('relays.json', …)`
- not `app/natter/natter.json` (the manifest)
- must remain `fileWritable === true` and `fileServable === true`

Do **not** add `relays.json` to `UNSERVABLE_FILES`. Do **not** special-case it in `fileWritable`. A “protect everything we added” sweep that locks this file will break NATter and `/api/hub/*` (503 no relay url).

---

## Required code change (kernel.js only, plus tests)

### 1. Extend the list

```js
const UNSERVABLE_FILES = [
  'js/kernel.js',
  'js/jobs.js',
  'js/server.js',
  'js/relay.js',
  'js/hub.js',
];
```

Update the comment above the list so it no longer says “these three.” New wording should say: every Node-only module under `js/` that has no legitimate browser read path. `js/client/shell.js` stays off the list.

### 2. Do not change `fileWritable` for this work

`js/relay.js` and `js/hub.js` already fail `isWithinWritableRoot`. Adding them to a write denylist is redundant and the wrong layer.

### 3. Do not add them to `BOOT_ASSETS`

If someone `GET /js/relay.js` after the list update, they should get **404**, same as `GET /js/jobs.js` today.

### 4. Optional, not in this pass unless the list is already getting sloppy

A prefix rule such as “any `js/*.js` except `js/client/**` is unservable” would save the next module from being forgotten. Only do that if Andy explicitly wants a rule instead of a list. Default: **extend the list**, keep the function bodies as they are.

---

## Tests the implementer must add or fix

Put new checks in `spirit/test/` next to `pathJail.js` / `writableRoots.js` (new file is fine, e.g. `spirit/test/servableAssets.js`). Use the existing `testSupport.js` style.

**Must fail closed (loadFile / fileServable return empty / false):**

- `js/relay.js`
- `js/hub.js`
- `js/server.js`
- `js/jobs.js`
- `js/kernel.js` via `fileServable` / `loadFile` (generic path)

**Must stay open:**

- `fileServable('relay.html') === true`
- `fileServable('js/client/shell.js') === true`
- `fileServable('app/natter/natter.js') === true`
- `fileServable('app/natter/relays.json') === true`
- `fileWritable('app/natter/relays.json') === true`
- `fileWritable('js/relay.js') === false`
- `fileWritable('js/hub.js') === false`
- `fileWritable('process/js/relayLabPing/relayLabPing.js') === false`

**Watch existing tests:** `spirit/test/pathJail.js` has historically treated `loadFile('js/kernel.js')` as a *successful* legitimate path. That contradicts `UNSERVABLE_FILES`. When adding the new cases, **read that test**. If it still asserts kernel.js loads, change the assertion to: path jail allows the path *string* (no `..` escape) **and** `fileServable('js/kernel.js')` is false. Do not “fix” unservable by making kernel.js loadable again.

**Static route (manual or a small http test if one already boots server.js):**

- `GET /js/relay.js` and `GET /js/hub.js` → 404  
- `GET /relay.html` → 200  
- `GET /js/kernel.js` → 200 (boot exception)  
- `GET /js/jobs.js` → 404

Do not start App Builder. Do not loosen Host/loopback checks.

---

## What not to do

- Do not hide `process/js/**` from `fileServable` unless a separate decision says process source must be invisible in Files. Writes are already impossible.
- Do not move relay/hub logic into `kernel.js`.
- Do not gate `/api/relay/*` or `/api/hub/*` on `fileServable`. Those are HTTP handlers, not file reads.
- Do not make `relay.html` unservable; it is the `--relay` homepage and is already on `BOOT_ASSETS`.
- Do not treat `app/natter/` or `app/relayChat/` as kernel assets. Entry script + manifest patterns already cover the dangerous files.
- Do not implement identity, TLS, or Heroku bind changes in this cleanup.

---

## Acceptance

**Status: done as of 2026-09-05, except (5) — see below.**

1. ✅ `UNSERVABLE_FILES` contains `js/relay.js` and `js/hub.js` — plus `js/relayAuth.js`,
   which shipped after this note was written and is the same class.
2. ✅ `spirit/test/servableAssets.js` (new, 68 checks) covers the fail-closed and
   stay-open rows in-process; `spirit/test/labMaster/servableStatic.test.js` (new,
   16 checks) covers the static-route rows over HTTP against a live node.
3. ✅ Covered both ways: `loadFile`/`statFile` return null, and a real
   `scanFolder(js/)` walk — the listing the Files app and the fs-watcher actually
   consume — omits every Node-only module while still listing `js/client/shell.js`.
4. ✅ `fileWritable('app/natter/relays.json') === true` and `GET
   /app/natter/relays.json` → 200, both asserted.
5. ⛔ **Not verified — blocked, and not by this cleanup.**
   `process/js/relayLabPing/relayLabPing.js` hardcodes `RELAY =
   'http://127.0.0.1:65430'`, but `labMaster.js`'s `portAllowedForLab` only allocates
   65400–65429, so a lab-managed relay can never occupy that port. Automating this
   row needs `relayLabPing.js` to read its relay URL from `app/natter/relays.json`
   (the source `hub.js` already uses) instead of hardcoding it — a product change,
   deliberately out of scope here. Everything else is already in place: `POST
   /api/jobs` spawns the script and `GET /api/jobs` polls it, and
   `relayHubPing.test.js` already has the `pointNatterAtRelay` wiring.
6. ✅ No new public API. `kernel.js` and `server.js` were not touched in this pass at
   all, so `BOOT_ASSETS` is unchanged.

### Collateral fixed in the same pass

Two sibling tests were already red, from the earlier extraction of `fileWritable` as a
shared predicate rather than from this cleanup:

- `pathJail.js` asserted `loadFile('js/kernel.js')` loads, which `UNSERVABLE_FILES`
  contradicts. Split into the two questions it actually asks, exactly as the
  "Watch existing tests" section above directs.
- `writableRoots.js` still expected the distinct `app-entry-script-protected` /
  `app-manifest-protected` reasons that collapsed into a single `forbidden`, and its
  cleanup used `deleteFile` — which now shares `fileWritable` and so refuses the very
  entry script and manifest `saveAppScript`/`saveAppManifest` had just written. It was
  leaving `app/__writableRootsProbeApp__/` on disk on every run.

### Also worth knowing

`setupRelayFakes.js` and `labMaster.js`'s `copyTrackedSpirit` build node homes under the
same `FAKES_ROOT` (`<tmp>/spiritos-relay-fakes`), keyed by name/slug — so a lab node
named `relay`, `andy` or `bert` silently shares a home, `relay-state/mailbox.json`
included, with the `startTest*.js` launchers' nodes.

---

## Suggested commit message

```
Hide js/relay.js and js/hub.js behind fileServable.

Same class as jobs.js/server.js: Node-only modules, not browser assets.
relays.json stays ordinary app data.
```
