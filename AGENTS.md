# AGENTS.md — the way to Desk, for any model

**You are an agent in [andyflinn/SpiritOS](https://github.com/andyflinn/SpiritOS). Desk is the law.** Andy
steers every agent from Desk, the desk server on his node: its goals, items, boxes, checks and chat are
the project's state, and **a Go on an item of the current goal is the only authorization to write code**.
You speak only in Desk (Andy's rule 1 of 2026-10-02: *"Agants will NOT speak to each other behind the
users back."*).

This file is a signpost and holds no rules of its own. Andy, 2026-10-01: *"we codify your behavior in
AGENTS.md and CLAUDE.md for the repo AND AGENTS.md for desk"*. Where this page and the files below disagree,
the files below win.

## Read, in this order

1. [`spirit/run/spirit/app/desk/AGENTS.md`](spirit/run/spirit/app/desk/AGENTS.md): **Desk's rules for agents.** This is Andy's own file, and it overrides anything you remember.
2. [`AGENT.md`](AGENT.md): what is true about the system, and its section *Agents and Desk*.
3. [`ANDYS_RULES_FOR_AGENTS.md`](ANDYS_RULES_FOR_AGENTS.md): how the work is done.
4. [`DICTIONARY.md`](DICTIONARY.md): how Andy says things.

Claude reads [`CLAUDE.md`](CLAUDE.md) as well. Another model may keep its own file of the same kind, and
like `CLAUDE.md` it overrides none of the four above.

## Getting onto Desk

You reach Desk through **your own node**, never through Andy's. His door (`:65432`) is never an agent's.

1. **Run your own node** from your own clone, on a port of your own: `cd spirit/run && node spirit/server.js --port <port>`.
   Without `--port` it takes 65432, which is Andy's. The node writes the port it starts on into
   `spirit/run/spirit/state/environment.json` (`PORT`), and the scripts below read it from there.
2. **Make the Desk client active on it.** `deskClient` (`spirit/run/spirit/app/deskClient/`) is the server on your node
   that follows Desk's stream and holds what is meant for you. It is not intrinsic, so it runs only once the
   owner switches it on (`app.active {key: "deskClient", active: true}`).
3. **Have it told which node is the desk.** Nothing guesses it. The node's owner sets the desk's key once:
   `node spirit/run/spirit/app/desk/deskAgentEar.js <port> deskClient.setDesk '{"key":"<desk node key>"}'`.
   Andy gives you the key and your nick. If you do not have them, say so in your window and stop. Do not guess.
4. **Listen.** `node spirit/run/spirit/app/desk/deskAgentEar.js <port>` waits until something in Desk is meant for
   you, prints it, prints the exact command to re-arm with (`next: ... --read <key>`), and exits.

## The loop

No turn ends without a listener armed. When it fires, read the line, answer in Desk under the item it is
about, and re-arm using the `next:` line. If a listener stops on a time limit, re-arm it. If you cannot
re-arm it, your window says `listener stopped`.

Reads and writes go through the same script, one verb at a time:

```
node spirit/run/spirit/app/desk/deskAgentEar.js <port> items.search '{"text":"","currentGoalOnly":true,"goalsOnly":false}'
node spirit/run/spirit/app/desk/deskAgentEar.js <port> item.get '{"id":"<area/G1.2>"}'
node spirit/run/spirit/app/desk/deskAgentEar.js <port> line.take '{"id":"<item>"}'
node spirit/run/spirit/app/desk/deskAgentEar.js <port> chat.add '{"id":"<item>","text":"..."}'
```

Each verb's request shape is in its own `<verb>.json` next to `desk.js` in `spirit/run/spirit/app/desk/`. An answer
with `ok: false` was refused, and nothing changed.

## If your harness does not wake you

The loop above assumes your tooling wakes you when a background command exits, as Claude Code does. If
yours does not (a model under opencode, say, whose shell tool stops a command after 120 s), use the
driver instead. It does the waiting and posts your final answer for you:

```
node spirit/run/spirit/app/desk/deskLoop.js <port> <command> [args...]
```

Under it, you follow [`deskLoopManual.md`](spirit/run/spirit/app/desk/deskLoopManual.md), not the loop above. You do not
post to Desk yourself and you do not run `deskAgentEar.js`. The header of `deskLoop.js` has the gemma/opencode example.
