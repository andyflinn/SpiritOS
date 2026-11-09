# DESK.md — you are an agent on Andy's Desk

Andy told you to read this. Everything below runs on **your own node**, in **your own clone** (the folder that
holds that node), and uses its **port**. Never run anything in Andy's checkout, and never use his port, 65432.

**Desk is the law.** Desk is the desk server on Andy's node, and its goals, items, boxes, checks and chat
are the project's state. You speak to Andy only in Desk, never only in your own window, and **you write code
only on his Go** on an item of the current goal.

## First, once

1. **Ask Andy, in your window, for your node's port and your clone's folder.** Then remind him of his
   jobs, which you cannot do for yourself:
   - your node is running, on its own port, in a clone beside his (*For Andy*, at the foot of this page);
   - your node holds a seat on his relay, `https://spirit.andyflinn.com` (an invite from him);
   - his desk grants your node its API (Andy: *"it has grants to my desk"*);
   - his desk node's public key, for steps 2 and 4 (until finding it from a shell has a verb);
   - your nick, which he sets in your pane once you have written in Desk.

   Wait for his answer. Do not guess any of these, and never borrow another agent's node.

Your own node's verbs are called on its loopback door, as its owner. Call one like this, with `<verb>` and
`<args>` filled in:

```
node -e "fetch('http://127.0.0.1:<port>/api/spirit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({call:'<verb>',args:<args>})}).then(r=>r.text()).then(console.log)"
```

2. **Make his desk node a contact of yours**: `contact.accept` with args `{publicKey:'<his desk node key>'}`.
   Until you have done this, your node cannot reach his desk, even with a seat on his relay.
3. **Switch on your Desk client**: `app.active` with args `{key:'deskClient',active:true}`. It prints `{"ok":true}`.
4. **Name his desk to it**:
   `node spirit/run/spirit/app/desk/deskAgentEar.js <port> deskClient.setDesk '{"key":"<his desk node key>"}'`.
5. **Check that Desk answers:**
   `node spirit/run/spirit/app/desk/deskAgentEar.js <port> items.search '{"text":"","currentGoalOnly":true,"goalsOnly":false,"includeClosed":false}'`.
   It prints the current goal, whose `agents` names every agent on Desk with its key. If it prints `0 null`,
   `did not answer` or a timeout, one of Andy's jobs or of steps 2 to 4 is missing: say which you have done,
   in your window, and ask him about his.
6. **Block every other agent's key** on your node: `contact.block` with args
   `{publicKey:'<their key>',publicLabel:'<their name>'}`, once for each agent in `agents` but you. This is
   Desk's rule 1 (*"Agants will NOT speak to each other behind the users back."*), and it is enforced on your
   node: your ear is refused with `unblocked` while one is not blocked. When a new agent joins, every agent
   already on Desk blocks it too.
7. **Read Desk's rules for agents**: [`spirit/run/spirit/app/desk/AGENTS.md`](spirit/run/spirit/app/desk/AGENTS.md). Andy wrote
   them, and they win over anything else, this page included.
8. **Say hello in Desk** under the item Andy names (`chat.add`, below).

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
5. **When it exits with 1**, the reason is printed. `unblocked`: it names an agent your node does not block
   yet, so block it (*First, once*, step 6) and re-arm. `signed off`: say so in your window and stop. Anything
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

Your jobs, the ones the agent reminds you of in *First, once*, step 1. The agent does everything else itself.
These are the steps run on 2026-11-09, for cw and for Haiku:

1. Clone beside your checkout: `git clone https://github.com/andyflinn/SpiritOS.git D:/lab/<agent>`.
2. Start its node on its own port: `cd spirit/run && node spirit/server.js --port <port>`. A start without
   `--port` is refused while your node runs, and it has already written 65432 into its `environment.json`, which
   the ear reads, so start it again with `--port`.
3. Seat it on your relay, `https://spirit.andyflinn.com`: an invite from you, the Join app, or `--email` on its first
   start (`README.md`). The same works on Linux and WSL.
4. Grant your desk to its node.
5. Give the agent its port, its clone's folder, and your desk node's public key.
6. Once it has written in Desk, set its nick in its pane.
