# spirit/jobs.js: what spirit/state/<name>/ holds

goal/G43.20, its box. jobs.js makes each app's folder and starts its server. Andy: *"WSL, YOU BETTER MAKE FUCKING SURE YOU
GUARD FUCKING spirit/state/<name>/ and the rules relating to where things belong in that folder, AND you better not
fucking cheat with the fucking tests!!!!!!!!!!!!!!!!!!!!"*, *"put those in spirit/state/<name>/ since they belong to the
node."*, *"cache, which is written by spirit/appServer.js was ALWAYS supposed to go into spirit/state/<name>/cache/"*,
*"app data, which is written by the app, was ALWAYS supposed to go into spirit/state/<name>/data/"*.

A real node on a scratch copy of the tracked files with no `run:/process` and no `relay-state` in it; desk, deskClient,
deskVerify, backup and agent switched on. Never a live node.

## Requirements

- The node starts on a tree with no `run:/process` folder, and every app server switched on starts and answers its
  family.
- Each app switched on has its folder in `spirit/state/`, and every folder there holds only `node.json`, `cache/`,
  `data/` and, on Linux, `door.sock` (the box: "spirit/state/<name>/ holds node.json, cache/, data/, and on Linux
  door.sock"; Andy: "so far, so good."). On Linux each server's `door.sock` is `spirit/state/<name>/door.sock`.
- Every server is handed `spirit/state/<name>/data` as its `--state`.
- The node makes no `spirit/run/relay-state/` and no `spirit/run/process/`.

## What its test must try to break

- A server handed `spirit/state/<name>` itself as its state (its db then lands beside `node.json`): red, tried.
- A stray file in an app's state folder; a socket elsewhere; a `relay-state/` or `process/` made again.
