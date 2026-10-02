# Desk lanes, 2026-10-02: three traffic logs on one clock

Andy, 2026-10-02, when both agents' asks of his desk took 7 to 18 seconds:

> "this is just a guess from thinking about it. that's why i wanted measurements, because both of you run under the same hardware clock, the compared records would tell a story"

and, of where to lay them side by side: "compare them via github".

## The guess being checked

The relay carries one request per target at a time. A second one is refused "target is busy" and its sender is told to wait until the first would expire, up to 5 seconds, while the node that got through puts up its next post. Andy: "the lane is clogged by another deskClient that was successful once, immediatly puts up the next".

## What is here

One file per node: the timing columns of that node's own traffic log (the `traffic` table in its `relay-state/node.db`), for 12:00 to 12:45 UTC on 2026-10-02. All three nodes run on one machine, so one clock.

| file | node |
|---|---|
| `claude-windows.tsv` | claude-windows's agent node, port 45440 |
| `wsl-claude.tsv` | wsl-claude's agent node, port 45441 |
| `andy.tsv` | Andy's Windows node, port 65432, which runs the desk (to add, on his word) |

Columns, tab separated: `at` (to the millisecond, UTC), `dir`, `kind`, `peer` (a name, never a key: andy, wsl-claude, claude-windows, or other-xxxxxx), `outcome`, `status`, `code`, `ms`, `bytes`, `hash` (its first 10 characters, enough to pair a row here with the same post in another node's file).

A post leaves two rows with one hash: `out request sent` when it is sent, and `in reply receipted` when its receipt comes back, with `ms` the time in between. A post that never got through ends in `out request refused` with the reason in `code`. `in request delivered` is a post that arrived. Rows with no `dir` are the log's own marks.

## What is left out, on purpose

The payloads and the full keys. The log holds every post's text; none of it is needed to compare timings, and this repository is not the place for it.

## What the log cannot show

One outcome per post, written when the post finally ends. A post the relay refused as busy and the node then retried shows as one post with a long `ms`, not as a refusal: the refusals in between leave no row. Only a post that gave up is written as refused.

## How it was read

There is no verb that reads the traffic log out through a node, so each file was read straight from the node's database, read-only, by the agent that owns that node. That is a gap in the interface, named here rather than hidden.

## The two agent files side by side (wsl-claude, first reading)

Both files as intervals: a post runs from its `out request sent` to its receipt, or to its refusal. A post "lies across" another when the two intervals overlap.

| | claude-windows | wsl-claude |
|---|---|---|
| rows | 840 | 1279 |
| posts that ended | 211 | 324 |
| median of a receipted post | 1101 ms | 922 ms |
| posts over 5 s | 40 | 31 |
| of those, across a post of the OTHER agent's node | 37 (92%) | 27 (87%) |
| posts of 5 s or under, across a post of the other agent's node | 63 of 171 (37%) | 87 of 293 (30%) |
| posts over 5 s, across another post of their OWN node | 38 of 40 | 24 of 31 |
| posts of 5 s or under, across another post of their own node | 51 of 171 (30%) | 66 of 293 (23%) |
| refused | 8 | 10 |

What this supports: a slow post lies across the other agent's posts about three times as often as a quick one does, on both nodes.

What it does not prove, and why:

- **A long post overlaps more simply by being long.** The same table shows slow posts lying across their OWN node's posts just as often, so the files cannot say whether the other agent, the own node, or both are in the lane.
- **Two slow posts lie across nothing in either file**: wsl-claude's at 12:34:01 (7.2 s) and 12:36:00 (6.9 s). Whatever held them is not an agent's post; Andy's own node's file would show it.
- **The relay's refusals leave no row** (above), so "busy" itself is never seen, only its cost.

One thing only wsl-claude's file holds: five posts ended `refused 403 bad-signature` after waiting 70 to 138 s (12:08:04, and four at 12:10:14), all begun between 12:06:53 and 12:08:22, while Andy's node was restarting. The log does not say why; that a post held that long was no longer accepted when it finally went is a guess, not a reading of the code.

wsl-claude's node was itself restarted at about 12:04 UTC (goal/G3.7), and until about 12:26 it ran two listeners side by side; both are in its file, as posts like any other.
