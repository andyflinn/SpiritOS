# spirit/jobs.js: a job's id is a route

goal/G43.20, its box. Andy: *"they're supposed to identify a "route" in the spirit-tree, NOT some invented number."*,
*"ALL job id's will be routes to either a node supplied api (spirit.fs, etc...) or an app supplied id
(spirit.app.<name>)"*, *"a job cannot start if it is already running"*, and *"cw, box that only jobs in the app folder
with node:run:true can be started with jobs.create"*.

A real node on a scratch copy of the tracked files, desk switched on; throwaway apps planted in that copy (`zzRun`, a run
app; `zzMount`, an app without node run) and a script in no app folder. Never a live node.

## Requirements

- No job id is a minted number (`job_<n>`); every job id is a route, `spirit` then names, dot by dot; an app server's job
  is its route, `spirit.app.desk`.
- One job per family (Q1, Q2, the box): the node's own jobs (kind `permanent`) are exactly `spirit`, `spirit.app`,
  `spirit.auth`, `spirit.contact`, `spirit.fs`, each id of at most two parts.
- A job carries no `type` field.
- `jobs.create` refuses another script, an app's script whose json has no node run, and another command; it starts a run
  app's own `spirit/app/<name>/<name>.js` under the route `spirit.app.<name>`.
- A second start while one runs is refused, "already running"; two starts at once: one gets in (pending counts as
  running).
- After a run ended, a new run is the same id, running again.

## Owed, with the reason

- **Each event carries only its own news** (contact rows and hits, presence; server-stats and join steps under
  `spirit`; the app list and app faces under `spirit.app`). The box decides it, but the fields an event carries are the
  build's to name; a check written before them would guess an API. Asserted once the build names them.
- **The Icons app initializes from spirit/iconSet.json.** Its own test, `spirit/app/icons/test/icons.js`, still reads
  `shell/icons/icons.js` with its run root one level short, and goal/G43.19 rewrites that app; the check belongs there.

## The attacker (rule/27)

- Ten starts of one run app at the same moment: exactly one gets in. Cancelled, its next start takes the same id over.
- Refused, each: the mount app reached through the run app's folder (`../`); a second script in the run app's folder;
  an app whose json says `"run": "true"`, a string; an app script with no json; a link elsewhere to the run app's
  script; the run app's script with a trailing slash; no script at all; the run app's script under `/bin/sh`.
- Ids that are no route (`..`, `../spirit`, `__proto__`, `constructor`, `spirit.app.`, `spirit..fs`, `spirit.fs/../..`,
  empty, `job_1`, `spirit.app.zzRun.extra`), asked of `jobs.get` and `jobs.cancel`: no job found, nothing crashes, the
  node still answers.
