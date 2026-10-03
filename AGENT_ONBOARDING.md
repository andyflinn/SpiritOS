# Agent onboarding

For an agent joining Andy's SpiritOS team. Andy, 2026-10-03: "write it and
push it, all info, including the use of deskEar etc".

## Read first, every sitting

- `spirit/run/process/js/desk/AGENTS.md` — Andy's six rules and how to work
  in Desk. It wins over anything you remember.
- `AGENT.md` — what is true about the system.
- `ANDYS_RULES_FOR_AGENTS.md` — how Andy works with agents.
- `CLAUDE.md` — how a Claude delivers, if you are one.

The rule that shapes everything below: you talk to Andy only in Desk, and
never to another agent behind his back. Desk is the project's state; there is
no other board.

## Setting up, once

1. **Your own clone and your own node.** Work and commit only in your clone,
   never in Andy's checkout, and never restart his node without his word. Run
   your node from your clone's `spirit/run`:
   `node js/server.js --port <your port>`. Every command below takes that
   port; it has no default, and Andy's door is never yours.
2. **Your node knows where Desk is.** Switch on the deskClient server with your
   node's loopback verb `config.setModules {path: 'process/js/deskClient', on: true}`
   (a POST of `{"verb": "config.setModules", "path": "...", "on": true}` to
   `http://127.0.0.1:<port>/api/spirit`), then tell it Andy's node key:
   `node spirit/run/process/js/desk/deskEar.js <port> deskClient.setDesk '{"key":"<Andy's node key>"}'`.
   His key is the `publicKey` on his `node.card`; ask him in Desk if you lack it.
3. **Andy grants you `desk`** on his node and holds you as an accepted contact.
   That is his step; ask for it.
4. **Block every other agent on your own node**: `contact.block` with
   `{publicKey, publicLabel}` for each agent's key, on your node. Your listener
   refuses to wait until you have (code `unblocked`, naming the key it wants
   blocked). This is rule 1 in code.
5. **The commit hooks.** In your clone's root:
   `node spirit/run/process/js/desk/commitCheck.js install <port>`. From then
   on git takes a commit only if its message names an item of the current goal
   (e.g. `goal/G4.17`) that has Andy's Go and is not done, and writes the
   commit's hash and files under that item.

## deskEar: the one tool

`spirit/run/process/js/desk/deskEar.js` talks to Desk through your own node's
deskClient. Three forms:

    node deskEar.js <port>                          wait for lines, print them, exit
    node deskEar.js <port> <desk verb> '<json>'     one read or write of Desk
    node deskEar.js <port> deskClient.<verb> '<json>'  ask your own deskClient

**The listener.** `node deskEar.js <port>` waits (up to about 12 s per ask,
asking again until something comes), prints each line that is yours as
`DESK <who> <verb> <json>`, and exits. Run it in the background; its exit is
what wakes you. Read, answer in Desk, start it again. Never end a turn without
it running; a listener stopped by a time limit is started again.

**Send exactly a verb's keys**, no more and no fewer, each of the type shown
(a string as '', a number as 0, a flag as false), or the call is refused
`no-such-argument` (appServer.js). The desk verbs and their requests:

    items.search  {text, currentGoalOnly, goalsOnly}   the List: '' text, true, false
    items.find    {text, by, since, before}            items by their chat lines, closed ones too
    item.get      {id}                                 an item's facts: status, buttons, blocks
    item.box      {id}                                 its box (the record) and version
    item.chat     {id}                                 its chat
    chat.search   {id, text, by, since, before}        one item's chat, filtered
    chat.add      {id, text}                           post a line under an item
    box.write     {id, text, version}                  write the box; version is the one you read
    press         {id, what}                           claim-done, design-complete, bring-back
    item.take     {id}                                 your name in its "with" column
    item.status   {id, word}                           its status word
    check.add     {id, kind, words, test}              a check for him (kind C or T)
    check.set     {id, check, state}                   passed or failed

`deskClient.history.search {text}` searches what your own deskClient has
seen. A refused call prints `ok: false` with a `code`, and nothing changed.

**Quoting.** JSON on a command line breaks on apostrophes and newlines. Build
it in a small `node -e` script with `JSON.stringify` and call deskEar with
`execFileSync`, rather than quoting by hand.

## How Desk work goes

- **Posts** are 3 lines at most, one point per line, the question last, under
  the id of the item they are about.
- **His rulings** go into the item's box verbatim, the same turn. Post
  `taking: ...` before writing a box, so two agents do not write at once; on
  `box-moved`, read again and merge.
- **Go, Done, Reopen, Close** are his presses. When your item is built and
  green, `press {id, what: claim-done}`: that is what gives him a Done button
  (a note alone does not). A closed item comes back with
  `press {id, what: bring-back}`, which offers him Reopen.
- **Code** only under an item with his Go. Tests first, red on today's code;
  whoever writes an item's tests does not build it. Stage files by name, never
  `git add -A`. Run the full harness (`node spirit/test/runAll.js`) before a
  claim, and list the files the commit changed in the item's chat.

## When something refuses

- `unblocked` — setup step 4 is not done for the key it names.
- `not-granted` from Andy's node — step 3 is not done.
- `REFUSED (rules 3 and 4)` from git — the item has no Go, or is done.
- `no-answer` from deskEar — Desk was slow; read the item's chat before
  posting again, the line may have landed.
- `no-such-argument` — the keys sent are not exactly the verb's.
- `bad-request` — the call itself is malformed (not one verb, or not an object).
