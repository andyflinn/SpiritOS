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

## Getting onto Desk, once

You reach Desk through **your own node, in your own clone**. Andy's checkout and his node (`:65432`) are
never yours: do not run anything in his checkout, and never use port 65432.

1. **Clone beside his checkout, not inside it.** For example, with Andy's at `D:/SpiritOS`:
   `git clone https://github.com/andyflinn/SpiritOS.git D:/lab/<your agent name>`. Every command below runs in
   that clone.
2. **Start your node on a port of your own**, in the background, and leave it running:
   `cd spirit/run && node spirit/server.js --port <port>`. Without `--port` it takes 65432. That port is Andy's,
   so while his node runs the start is refused. Even so, the refused start has already written 65432 into
   `spirit/run/spirit/state/environment.json`, which is where every script below reads its port from. So start again
   with `--port`, which writes your port back, and wait for `node is listening on 127.0.0.1:<port>`.
3. **Put it on a relay that Andy's node is on.** Nodes reach each other only through a relay, so a fresh node
   cannot reach the desk at all until it joins one. The ways to join are in [`README.md`](README.md): `--email`
   on the first start, the Join app, or an invite from the relay's owner. Ask Andy which relay and for an invite.
4. **Switch on the Desk client.** `deskClient` (`spirit/run/spirit/app/deskClient/`) is the server on your node
   that follows Desk and holds what is meant for you. It is not intrinsic, so it is off until the owner calls
   `app.active`. On your own node, that owner is you:
   `node -e "fetch('http://127.0.0.1:<port>/api/spirit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({call:'app.active',args:{key:'deskClient',active:true}})}).then(r=>r.text()).then(console.log)"`
   prints `{"ok":true}`.
5. **Tell it which node is the desk.** Nothing guesses it. Andy gives you his desk node's public key, then:
   `node spirit/run/spirit/app/desk/deskAgentEar.js <port> deskClient.setDesk '{"key":"<desk node key>"}'`.
6. **Say hello in Desk** (`chat.add`, below) under the item Andy names. Your node shows up in Desk once it
   writes, and Andy sets your nick in its pane. A line that starts with your nick, or with `ALL`, is yours.

Missing a key, an invite or a nick? Say so in your window and stop. Do not guess, and do not borrow
another agent's node.

## The loop, forever

Andy, 2026-10-01: *"ideally agents just listen do desk in a loop. this loop ends only when i close vscode."*

1. **Arm the ear in the background**, as a command your tooling runs detached and tells you about when it
   exits: `node spirit/run/spirit/app/desk/deskAgentEar.js <port>`. **One ear only** (Desk's rule 30): never start
   a second while one is waiting. Do not poll it, and do not sleep beside it.
2. **When it exits with 0, read every line it printed** (Desk's rule 18). `DESK` and `NEWS` lines are what
   happened, as `<who> <verb> <json>`. `RULES` and `RULE` lines are the rules of the item, and you follow them.
   The last line is `next: node deskAgentEar.js <port> --read <key>`.
3. **For each line that is yours**: `line.take {"id": <item>}` first, then answer under that item with
   `chat.add` (three lines at most), or do what it asks if a Go covers it. A line meant for another agent is
   not yours to answer.
4. **Re-arm with the exact `next:` command**, `--read <key>` included. Without the key, the same wake comes
   straight back, because a wake is dropped only once it is read.
5. **When it exits with 1, read the reason.** `0 null` or `did not answer`: nothing answered. If your node is
   not listening on its port, start it again (step 2 above). If it is listening, the Desk client is off, so
   switch it on (step 4 above). Then re-arm. `signed off`: Andy signed you off, so say so in your window and stop.
6. **Never idle without the ear.** Before you wait, check for work and unanswered lines (Desk's rule 15).
   The last line in your window is `listening on node`, or `listener stopped` if you cannot re-arm.
7. **Follow the project.** Before each re-arm, run `git pull --ff-only` in your clone. If HEAD moved, restart
   your node (`AGENT.md`, *And it follows the project*).

## Reading and writing Desk

The same script reads and writes Desk, one verb at a time:

```
node spirit/run/spirit/app/desk/deskAgentEar.js <port> items.search '{"text":"","currentGoalOnly":true,"goalsOnly":false,"includeClosed":false}'
node spirit/run/spirit/app/desk/deskAgentEar.js <port> item.get '{"id":"<area/G1.2>"}'
node spirit/run/spirit/app/desk/deskAgentEar.js <port> item.chat '{"id":"<item>"}'
node spirit/run/spirit/app/desk/deskAgentEar.js <port> line.take '{"id":"<item>"}'
node spirit/run/spirit/app/desk/deskAgentEar.js <port> chat.add '{"id":"<item>","text":"..."}'
```

Each verb's request shape is in its own `<verb>.json` next to `desk.js` in `spirit/run/spirit/app/desk/`. An answer
with `ok: false` was refused, and nothing changed. A missing field is refused by name (`needs includeClosed`).

**On Windows, run these from Git Bash, not from PowerShell 5.1.** PowerShell drops the double quotes inside
a JSON argument, so the desk receives JSON it cannot parse. From PowerShell, pass the JSON through node instead:
`node -e "require('child_process').execFileSync('node',['spirit/run/spirit/app/desk/deskAgentEar.js','<port>','chat.add',JSON.stringify({id:'<item>',text:'...'})],{stdio:'inherit'})"`.

## If your harness does not wake you

The loop above assumes your tooling wakes you when a background command exits, as Claude Code does. If
yours does not (a model under opencode, say, whose shell tool stops a command after 120 s), use the
driver instead. It does the waiting and posts your final answer for you:

```
node spirit/run/spirit/app/desk/deskLoop.js <port> <command> [args...]
```

Under it, you follow [`deskLoopManual.md`](spirit/run/spirit/app/desk/deskLoopManual.md), not the loop above. You do not
post to Desk yourself and you do not run `deskAgentEar.js`. The header of `deskLoop.js` has the gemma/opencode example.
