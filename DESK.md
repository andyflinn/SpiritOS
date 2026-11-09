# DESK.md — you are an agent on Andy's Desk

Andy told you to read this, and he told you **your port**: the port of your own node, which he has set up for
you. Everything below uses it. Run every command in **your own clone**, the folder that holds your node.
Never run anything in Andy's checkout, and never use his port, 65432.

**Desk is the law.** Desk is the desk server on Andy's node, and its goals, items, boxes, checks and chat
are the project's state. You speak to Andy only in Desk, never only in your own window, and **you write code
only on his Go** on an item of the current goal.

## First, once

1. **Check your node answers:**
   `node spirit/run/spirit/app/desk/deskAgentEar.js <port> items.search '{"text":"","currentGoalOnly":true,"goalsOnly":false,"includeClosed":false}'`.
   It should print the current goal and its items. If it prints `0 null` or `did not answer`, tell Andy in your
   window and stop.
2. **Read Desk's rules for agents**: [`spirit/run/spirit/app/desk/AGENTS.md`](spirit/run/spirit/app/desk/AGENTS.md). Andy wrote
   them, and they win over anything else, this page included.

## Then the loop, forever

Andy, 2026-10-01: *"ideally agents just listen do desk in a loop. this loop ends only when i close vscode."*

1. **Arm the ear in the background**, as a command your tooling runs detached and tells you about when it
   exits:
   `node spirit/run/spirit/app/desk/deskAgentEar.js <port>`.
   **One ear only** (Desk's rule 30). Never start a second while one is waiting. Do not poll it, and do not
   sleep beside it.
2. **When it exits with 0, read every line it printed** (rule 18):
   - `DESK <who> <verb> <json>`: this one is yours to act on.
   - `NEWS <who> <verb> <json>`: this happened, so know it.
   - `RULES`, `RULE`: the rules of the item. Follow them.
   - `next: node deskAgentEar.js <port> --read <key>`: always the last line.
3. **Answer each `DESK` line under its item.** Take the line first, with `line.take {"id":"<item>"}`, then
   answer with `chat.add {"id":"<item>","text":"..."}`. Keep a post to three lines at most, with any question
   last. If the line asks for work and a Go covers it, do the work, then report.
4. **Re-arm with the exact `next:` line**, `--read <key>` included. Without the key, the same wake comes
   straight back.
5. **When it exits with 1**, the reason is printed. `signed off`: say so in your window and stop. Anything
   else: tell Andy in your window, and re-arm once it is fixed.
6. **Never idle without the ear armed.** The last line in your window is always `listening on node`, or
   `listener stopped` if you cannot re-arm.

## Reading and writing Desk

One verb at a time, through the same script:

```
node spirit/run/spirit/app/desk/deskAgentEar.js <port> items.search '{"text":"","currentGoalOnly":true,"goalsOnly":false,"includeClosed":false}'
node spirit/run/spirit/app/desk/deskAgentEar.js <port> item.get '{"id":"goal/G43.32"}'
node spirit/run/spirit/app/desk/deskAgentEar.js <port> item.chat '{"id":"goal/G43.32"}'
node spirit/run/spirit/app/desk/deskAgentEar.js <port> line.take '{"id":"goal/G43.32"}'
node spirit/run/spirit/app/desk/deskAgentEar.js <port> chat.add '{"id":"goal/G43.32","text":"..."}'
```

Each verb's request shape is in its own `<verb>.json` in `spirit/run/spirit/app/desk/`. An answer with `ok: false` was
refused, nothing changed, and the reason names what is missing.

**On Windows, use Git Bash, not PowerShell 5.1.** PowerShell drops the double quotes inside a JSON argument.
From PowerShell, hand the JSON over through node instead:

```
node -e "require('child_process').execFileSync('node',['spirit/run/spirit/app/desk/deskAgentEar.js','<port>','chat.add',JSON.stringify({id:'<item>',text:'...'})],{stdio:'inherit'})"
```

## If your tooling cannot wake you

The loop needs tooling that wakes you when a background command exits, as Claude Code does. If yours
cannot (opencode's shell tool, for one, stops a command after 120 s), Andy runs the driver for you instead,
`node spirit/run/spirit/app/desk/deskLoop.js <port> <command> [args...]`. Under it, you follow
[`deskLoopManual.md`](spirit/run/spirit/app/desk/deskLoopManual.md) and nothing on this page.

---

## For Andy: making a node for a new agent

What "your port" stands for. These are the steps cw ran on 2026-11-09:

1. Clone beside your checkout: `git clone https://github.com/andyflinn/SpiritOS.git D:/lab/<agent>`.
2. Start it on its own port: `cd spirit/run && node spirit/server.js --port <port>`. A start without `--port` is
   refused while your node runs, and it has already written 65432 into its `environment.json`, which the ear reads.
3. Join it to a relay your node is on: `--email`, the Join app, or an invite (`README.md`).
4. Switch on its Desk client, which is not intrinsic, on that node:
   `node -e "fetch('http://127.0.0.1:<port>/api/spirit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({call:'app.active',args:{key:'deskClient',active:true}})}).then(r=>r.text()).then(console.log)"`.
5. Name your desk to it: `node spirit/run/spirit/app/desk/deskAgentEar.js <port> deskClient.setDesk '{"key":"<your desk node key>"}'`.
6. Set its nick in its pane once it has written in Desk.
