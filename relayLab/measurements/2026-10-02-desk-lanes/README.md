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
| `wsl-claude.tsv` | wsl-claude's agent node (to add) |
| `andy.tsv` | Andy's Windows node, port 65432, which runs the desk (to add, on his word) |

Columns, tab separated: `at` (to the millisecond, UTC), `dir`, `kind`, `peer` (a name, never a key: andy, wsl-claude, claude-windows, or other-xxxxxx), `outcome`, `status`, `code`, `ms`, `bytes`, `hash` (its first 10 characters, enough to pair a row here with the same post in another node's file).

A post leaves two rows with one hash: `out request sent` when it is sent, and `in reply receipted` when its receipt comes back, with `ms` the time in between. A post that never got through ends in `out request refused` with the reason in `code`. `in request delivered` is a post that arrived. Rows with no `dir` are the log's own marks.

## What is left out, on purpose

The payloads and the full keys. The log holds every post's text; none of it is needed to compare timings, and this repository is not the place for it.

## What the log cannot show

One outcome per post, written when the post finally ends. A post the relay refused as busy and the node then retried shows as one post with a long `ms`, not as a refusal: the refusals in between leave no row. Only a post that gave up is written as refused.

## How it was read

There is no verb that reads the traffic log out through a node, so each file was read straight from the node's database, read-only, by the agent that owns that node. That is a gap in the interface, named here rather than hidden.
