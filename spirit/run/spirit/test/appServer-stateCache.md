# spirit/appServer.js: its cache in spirit/state/<name>/cache/

goal/G43.20, its box. Andy: *"cache, which is written by spirit/appServer.js was ALWAYS supposed to go into
spirit/state/<name>/cache/"*, and *"NO FUCKING RESCUE CODE, MOVE YOUR OWN deskClient cache where it belongs."*

A throwaway follower app planted in a scratch copy of the tracked files, run as the node runs a server: a stream with
its cache on, following a sender whose family has a data.js here (desk). What it kept is read back at its start; then its
`saveCaches` (deskClient's `cache.dump`) writes it again. Never a live node.

## Requirements

- What it kept in `spirit/state/<name>/cache/<id>.json` comes back at its start, and its cache.dump writes
  `spirit/state/<name>/cache/<id>.json` again; no cache file is written in `spirit/state/<name>/` itself.
- No rescue: a cache file at the old place, `spirit/state/<name>/<id>.json`, is not read back, and it is left where it was.

## What its test must try to break

- The cache read or written in `spirit/state/<name>/` itself (today: red, 3 of 6).
- A rescue that reads or moves the old file.

## The attacker (rule/27)

Each case spoils `cache/` before the follower starts, and it must still start and save:
- a file named for one sender holding another's key: not read;
- only a half-written `<id>.json.tmp`, as a kill leaves it: not read;
- a file that is no JSON, and one of the wrong shape (`rows` no list, `run` a number, `n` negative): nothing read back.
- After all of it `spirit/state/follower/` holds nothing beside `cache/`, `data/`, `node.json` and its socket.
