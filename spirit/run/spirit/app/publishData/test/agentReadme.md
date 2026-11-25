# spirit/app/publishData/agentReadme.js

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
  `relay.allowanceFor(512, relayAtRestRss in MB)` in seats of `relay.SEAT_STREAMS` (spirit/relay/processor/script.js); streams are
  members times SEAT_STREAMS; peers are 512 MB of disk over `perReachablePeerBytes`, 0 when that is not measured;
  `measuredAt` and `commit` carried as text, `''` when left out.
- **write**: its README is judged where publishData writes it, in `./publishData.md` (goal/G47.1, box v170); its old
  layout (the agent's name, Machine Description, Measurements, Studies) went with that box.
- **machineOf**: platform, OS, arch, total and used RAM, node's release, version, LTS and path from this process; the
  SpiritOS node processes (node processes running spirit/server/script.js, counted from the process list); the time asked.

## What its test must try to break

- A members figure that is not the relay's rule, or peers divided by zero.
- A summary made from a capacity with no memory at rest.

- Its scratch folder lies outside the run folder (the system temp folder), so no `run://test/` is made (Andy: *"the product only has one name in run:// and that is "spirit""*).
