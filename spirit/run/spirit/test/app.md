# app.js

`spirit/run/spirit/app.js` and its folder are the `app` family (goal/G43.2). Its test is `./app.js`.

Andy, box: *"we build a skeleton core-api-family, not a separate server, precisely the OLD way, the new family is called "app""*.

## Requirements

- `spirit/app.js` beside `spirit/app/`, which holds what every core family holds: `api.js`, `AGENTS.md`, `clientCacheManager.js`, `search.json`.
- One verb, `app.search`, one optional search string, no filters: *"it's minimum, no filters, just a search string."* A filter is refused at the door.
- The node's api names the family beside the others.
- `spirit/app/server/server.json` has `identity.icon` and `identity.label`. The plugin is exactly `server`.
- It answers as other searches do, key and label rows. It finds `server` on an empty search and on its label, and not on words that fit nothing. The row carries the icon.
- A folder counts only with its own `<name>/<name>.json`, read from the disk: a second one is found, and one without its file, `appSelector/` and `test/` are not.
- A face with no star may call it: *"and yes, a face with no star can call appSearch"*. The hidden filter that comes with that is out of scope.
