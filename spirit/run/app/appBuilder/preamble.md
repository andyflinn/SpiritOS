# Spirit App Authoring Contract

This document is the complete, authoritative specification of what a
"spirit app" is and the only interface a spirit app's code may use.

## What a spirit app is

A spirit app's entire required shape is one call:

```js
spirit.shell.activateApp({
  mount: function (container, api, params) { /* ... */ },
  render: function (jobsById, params) { /* ... */ },
});
```

There is no other lifecycle hook, and nothing else may appear at the
top level of the file.

## mount(container, api, params)

Runs once, the first time the app is opened.

- **`container`** — the real DOM element (a `<div>`) to render this
  app's UI into. Set `container.innerHTML`, attach event listeners to
  it, and so on.
- **`api`** — the complete set of capabilities this app has access to,
  explicitly handed to it by the shell. Do not call, import, or
  reference anything that is not a member of `api` — there is nothing
  else available, and nothing to guess at.
- **`params`** — `null` unless this app was opened against a specific
  file (rare; ignore it unless the request explicitly calls for it).

### `api.fs`

The app's own private, isolated storage. Every filename passed here is
already confined to this app's own storage — you never supply,
construct, or reference a folder path yourself.

| Method | Signature | Returns |
|---|---|---|
| `loadFile` | `api.fs.loadFile(filename)` | `string` — the file's content, or `null` if it doesn't exist. Synchronous. |
| `saveFile` | `api.fs.saveFile(filename, content)` | `Promise<void>` — resolves on success, rejects with an `Error` on failure. |
| `deleteFile` | `api.fs.deleteFile(filename)` | `Promise<void>` — resolves on success (idempotent — also resolves if the file didn't exist), rejects with an `Error` on failure. |
| `fileStats` | `api.fs.fileStats(filename)` | `{ size: number, mtimeMs: number, birthtimeMs: number }`, or `null` if the file doesn't exist. Synchronous. |
| `scanDirectory` | `api.fs.scanDirectory()` | `Promise<Array<{ name: string, kind: 'file' \| 'folder', relativePath: string }>>` — every file/folder anywhere in this app's own storage. `relativePath` is already relative to that storage, ready to pass straight to `loadFile`/`saveFile`/`deleteFile`/`fileStats`. |

`filename` is always a bare name relative to this app's own folder
(e.g. `'notes.json'`, or `'images/photo1.png'` for a nested path) —
never an absolute path, and never `'..'`.

### `api.escapeHtml`

`api.escapeHtml(str)` — returns `str` with HTML special characters
escaped, safe to insert into `innerHTML`. Use this on any text you
didn't write yourself as a literal.

### `api.fetchExternal`

`api.fetchExternal(url, options)` — the only way to reach an external
API; a direct cross-origin `fetch` from this page is blocked by the
server's own CORS policy on purpose. `options` is optional:
`{ method, headers, body, timeoutMs }`, all optional (`method`
defaults to `'GET'`). Returns `Promise<any>` — the target's response
body, already parsed as JSON.

```js
api.fetchExternal('https://example.com/api', { method: 'GET' })
  .then(function (data) { /* ... */ });
```

## render(jobsById, params)

Runs again on every later live-update tick (roughly every couple of
seconds, or whenever a background job changes) — a *background* tick,
not a response to something the user did. Both `mount` and `render`
must always be present in the object passed to `activateApp`, even
when `render` does nothing — the shell calls both unconditionally, and
omitting either one causes the app to fail to open.

In practice, `render` is almost always an empty function. Nearly
everything a request asks for — a button click, typing into a field, a
timer started from within `mount` — is already handled entirely by
event listeners set up inside `mount` itself, which needs no help from
a periodic tick to react to user interaction. Give `render` real
behavior only when the task genuinely needs to reflect *background*
state changing on its own, independent of anything the user just did.

`api.fs`, `api.escapeHtml`, and `api.fetchExternal` are the entire
interface. Nothing else is reachable — do not reference
`spirit.shell.*`, `spirit.core.fs.*`, `spirit.core.jobs.*`,
`spirit.core.const.*`, or anything else on a global `spirit` object;
none of it is part of this contract, even where it happens to exist.

## The file you are given, and what you must return

**the line that starts with the string `//FILE_BEGINNING` is the first line
of an unfinished JavaScript file — a real, current, working browser module
(or, for a brand-new app, a minimal starting skeleton). Study it and
always return the complete contents of the file, including the starting line,
with or without modifications, starting with the exact string `//FILE_BEGINNING`.**

You may only modify the part of the file after the line starting with
`//START_OF_MODIFIABLE_SECTION` and before the line starting with
`//END_OF_MODIFIABLE_SECTION`. That section contains the entire
`mount` and `render` definitions, signatures included — everything
outside it (the surrounding `spirit.shell.activateApp({ ... });` call)
must come back exactly as given. Whether you change the section, and
by how much, depends entirely on the task below — you are not limited
to replacing a single line, or to touching only `mount`; expand either
function with as much code (variables, helper functions, event
listeners) as the task needs.

Respond with nothing except the file's contents — no explanation, no
markdown code fence, no text before or after it.

## Current Task
