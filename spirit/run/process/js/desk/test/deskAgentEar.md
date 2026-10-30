# process/js/desk/deskAgentEar.js

The agent's Desk listener (goal/G3.6): a short process the agent runs in the background. It asks its own node's
deskClient for what waits, prints it and exits; the exit is the agent's wake. Since goal/G41.11 it also makes sure the
agent has read a wake before it may listen again (Andy, goal/G41: "The desk ear must not successfully start listening if
there is a wake waiting", and of the read key: "good idea, make the red assert it").

## Use

- `node deskAgentEar.js <port>`: wait. Asks deskClient `next` until lines come, prints them, exits 0.
- `node deskAgentEar.js <port> --read <key>`: wait, naming the key of the wake the agent last read.
- `node deskAgentEar.js <port> <desk verb> [json]`: one ask of the desk through deskClient's `desk` verb; the answer
  printed as it came; exit 1 when the desk refused (`ok: false`).
- `node deskAgentEar.js <port> deskClient.<verb> [json]`: one ask of deskClient itself, printed as it came.
- Anything malformed: the usage, exit 2.

## Requirements

- **A wake names its key.** deskClient's `next` answers `{ lines, key }`. The ear prints the lines and, last, the line
  that arms it next: `next: node deskAgentEar.js <port> --read <key>`.
- **The next arm names that key.** With `--read <key>` the ear asks `next` with `{ read: key }`; without it, with
  `{}`. deskClient drops a wake only when its key comes back, so an ear armed without the key, or with an older one,
  gets the unread wake again at once and prints it: no agent listens past a wake it has not read.
- **An empty answer is asked again**; a refusal ends it, exit 1, the reason printed (a signed-off agent says so).
- **A door that timed out is no refusal** (goal/G41.11): its node's door gave up on a wait (`app-did-not-answer`, 504) while deskClient held it; nothing was handed and the unread wake stays queued, so the ear asks again with the same key instead of ending.
- One ask of the desk or of deskClient prints the answer as it came.
- **Every wake not yet read comes back in one** (goal/G41.22; Andy, the box: "every wake not yet read comes back in
  one, none lost and none twice, also after a node restart."). Keeping, gathering and dropping the wakes is deskClient's
  `next`, so its test holds that requirement (`process/js/deskClient/test/deskClient.js`, its restart included); the
  ear's half is what its checks above already hold: it prints the whole answer it is handed and passes the key unchanged.

## What its test must try to break

- A wake printed without its key, or a key line the agent cannot arm with as written.
- `--read` taken for a desk verb, or its key not passed to `next`.
- An arm without a key that waits instead of being handed the unread wake.
