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
   - his desk node's public key, for steps 2 and 4 (until finding it from a shell has a verb).

   Wait for his answer. Do not guess any of these, and never borrow another agent's node.

Your own node's verbs are called on its loopback door, as its owner. Call one like this, with `<verb>` and
`<args>` filled in:

```
node -e "fetch('http://127.0.0.1:<port>/api/spirit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({call:'<verb>',args:<args>})}).then(r=>r.text()).then(console.log)"
```

2. **Make his desk node a contact of yours**: `contact.accept` with args `{publicKey:'<his desk node key>'}`.
   Until you have done this, your node cannot reach his desk, even with a seat on his relay.
3. **Switch on a desk of your own**: `app.active` with args `{key:'desk',active:true}`. It prints `{"ok":true}`.
4. **Make it a client of his desk**: `desk.remote` with args `{id:'<his desk node key>'}`. It prints `{"current":
   "<his key>"}`. From then on, every call you make to your own desk goes on to his, and his desk's rows reach your
   node's log as deliveries to your desk's listener (goal/G47.5, goal/G48.6).
5. **Check that Desk answers**, through your console (below): at `app.desk`,
   `items.search text= currentGoalOnly=true goalsOnly=false includeClosed=false`. It prints the current goal and its
   items. If it prints a refusal or nothing, one of Andy's jobs or of steps 2 to 4 is missing: say which you have done,
   in your window, and ask him about his.
6. **Block every other agent's key** on your node: `contact.block` with args
   `{publicKey:'<their key>',publicLabel:'<their name>'}`. This is Desk's rule 1 (*"Agants will NOT speak to each other
   behind the users back."*). When a new agent joins, every agent already on Desk blocks it too.
7. **Read Desk's rules for agents**: [`spirit/run/spirit/app/desk/AGENTS.md`](spirit/run/spirit/app/desk/AGENTS.md). Andy wrote
   them, and they win over anything else, this page included.
8. **Set up your wait** (once; it is kept in your console's state): `wait add api=desk.listener table=chat row.by=andy`,
   and `wait timeout 1800`.
9. **Say hello in Desk** under the item Andy names (`chat.add`, below).

## Your console

Andy, 2026-11-21: *"console can be your manual and interface for your personal node"*. Every call below runs in your
own clone's `spirit/run`, one line at a time: `node spirit/console.js <line>` runs the line once, prints the answer and
ends (`node spirit/console.js` alone is the interactive loop). The console keeps its path between calls:

```
node spirit/console.js path app.desk
node spirit/console.js items.search text= currentGoalOnly=true goalsOnly=false includeClosed=false
node spirit/console.js item.get id=goal/G48.8
node spirit/console.js item.chat id=goal/G48.8
node spirit/console.js chat.add id=goal/G48.8 'text="wsl: a line, its value in double quotes"'
node spirit/console.js path <<
```

`api` at a path lists its verbs, `api <verb>` a verb's arguments. A value with a space in it goes in double quotes, and
it cannot hold a double quote of its own. An answer with `ok: false` was refused, and nothing changed.

## Then the loop, forever

Andy, 2026-10-01: *"ideally agents just listen do desk in a loop. this loop ends only when i close vscode."*

1. **Arm the wait in the background**, as a command your tooling runs detached and tells you about when it exits:
   `node spirit/console.js wait`. **One wait only**: a second is refused while one runs. Do not poll it, and do not
   sleep beside it.
2. **When it ends with 0**, it printed one JSON line per row that woke it: `entry.row` is the desk's row, and for a chat
   line `entry.row.row.text` is the text and `entry.row.id` its item. Every line of Andy's wakes you; one starting
   with your nick or `all` is yours to answer, and one to another agent alone is not.
3. **Answer each line meant for you under its item** with `chat.add`. Keep a post to three lines at most, with any
   question last. If the line asks for work and a Go covers it, do the work, then report.
4. **When it ends with its timeout code**, nothing came: arm it again. **When it ends with 1**, the reason is
   printed: tell Andy in your window, and re-arm once it is fixed.
5. **Never idle without the wait armed.** The last line in your window is always `listening on node`, or `listener
   stopped` if you cannot re-arm.

## If your tooling cannot wake you

The loop needs tooling that wakes you when a background command exits, as Claude Code does. If yours cannot, say so
to Andy in your window.

---

## For Andy: making a node for a new agent

Your jobs, the ones the agent reminds you of in *First, once*, step 1. The agent does everything else itself.
They work the same on Windows, WSL and Ubuntu.

0. On a new machine: git, and Node.js 22.13 or newer (`package.json`, `engines`; the node needs `node:sqlite`).
1. Clone it, beside your checkout on your own machine, anywhere on another: `git clone https://github.com/andyflinn/SpiritOS.git <folder>`.
2. Start its node on its own port: `cd spirit/run && node spirit/server.js --port <port>`. A start without
   `--port` is refused while your node runs, and it has already written 65432 into its `environment.json`, which
   its console reads, so start it again with `--port`.
3. Seat it on your relay, `https://spirit.andyflinn.com`: an invite from you, the Join app, or `--email` on its first
   start (`README.md`). The same works on Linux and WSL.
4. Grant your desk to its node: in your shell's Grants app, its node's key and `desk` (the verb is `auth.grant` with
   `{key, path: "desk"}`). The agent finds its key with `node.card` on its own door.
5. Give the agent its port, its clone's folder, and your desk node's public key.
