# process/js/deskClient/agentReadme.js

An agent's README in the measurement tree (goal/G33.5), written by publishData.js into `agents/<agent>/`. Andy's box:
the agent's name as the title, then "Machine Description", "Summary" in three bullets, then "Measurements", "that
little table". The members figure is the relay's own rule (Andy chose it, box v11).

## API

- `write(out, agent, machine?)` writes `out/README.md`, and `out/summary.json` when there is a summary, from
  `out/capacity.json` and the files there; machine defaults to `machineOf()`. Answers the summary, or null.
- `summaryOf(capacity)` -> `{ members, ramMB, perMember, streams, peers, diskMB, measuredAt, commit }`, or null.
- `machineOf()` -> the facts of this machine now.

## Requirements

- **summaryOf**: null without a capacity whose `relayAtRestRss` is a positive number. Members are
  `relay.allowanceFor(512, relayAtRestRss in MB)` in seats of `relay.SEAT_STREAMS` (spirit/relay.js); streams are
  members times SEAT_STREAMS; peers are 512 MB of disk over `perReachablePeerBytes`, 0 when that is not measured;
  `measuredAt` and `commit` carried as text, `''` when left out.
- **write**, README.md in order:
  - `# <agent>`.
  - `## Machine Description`: OS (type and release) with platform and arch, total RAM and RAM used in MB (en-US
    grouping), node.js release, version, LTS name when it has one and its path, the number of SpiritOS node processes,
    and when it was written (UTC, to the second).
  - `## Summary`: three bullets (members for 512 MB of RAM; live streams, 3 per member, naming what each is for; peers
    for 512 MB of disk), or `- not measured yet`.
  - `## Measurements`: rows for the box (platform.md), harness (harness.txt), capacity, packets and test state, each
    dated `YYYY-MM-DD, `commit8`` from its json (the box from capacity.json, else packets.json); a row whose file is not
    there, or whose json cannot be read, says `not measured yet`.
  - `## Studies`: each folder of `studies/`, sorted, as a link; `none yet` when there is none.
  - summary.json: the summary with the agent, written only when there is one.
- **machineOf**: platform, OS, arch, total and used RAM, node's release, version, LTS and path from this process; the
  SpiritOS node processes (node processes running spirit/server.js, counted from the process list); the time asked.

## What its test must try to break

- A members figure that is not the relay's rule, or peers divided by zero.
- A summary made from a capacity with no memory at rest.
- Headings out of order; a row dated when its file is not there.
- A summary.json written with nothing measured.
- A loose file in studies/ listed as a study.
