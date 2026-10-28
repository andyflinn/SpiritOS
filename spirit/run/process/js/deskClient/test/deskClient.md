# process/js/deskClient/deskClient.js

The desk client (goal/G3.3 and on; this spec: goal/G41.11): a server on an agent's own node. It follows Andy's desk's
stream into its cache (spirit.data, through the desk's translator), passes the agent's asks to the desk, and wakes the
agent with what is meant for it. This spec holds what goal/G41.11 requires of it; Andy: "desk and deskClient must
work in concert, why would the deskClient let an agent do anything until the agent has received those notices? The
client has a cache, if the agent wants to know stuff, give them FIRST the cache".

## Requirements

- **The cache dump** (Andy: "a cache-dump to to a fixed file  name in relay-state/process/deskClient/<fixedFileName>.json"):
  the verb `cache.dump`, owner-only, writes the whole cache, its spirit.data tree, as JSON to `<state>/cache.json`
  (the node's state folder for deskClient, `relay-state/process/deskClient/`), and nowhere else, whatever the caller
  names: no file but `cache.json` appears in the state folder. A caller who is not the owner is refused `not-owner`.
  (Since the cache is saved on every update, `cache.json` may stand before any dump.) Its family interface
  (`deskClient.family/api.js`) names it. For looking, never for deciding.
- **The cache, whole from the first push**: the file list and the checks of every item of the current goal are kept
  from the first push of its facts, whole, so the agent's `item.files` and `item.checks` of such an item are answered
  from the cache and the desk is not asked.
- **The cache, current**: a part the desk moves is answered as moved: after a box row of version 6, `item.box`
  answers version 6; a file the desk adds later is in the kept list.
- **A kept read** (the commit check's interface, `process/js/desk/test/commitCheck.js`): the `desk` verb takes
  `kept` beside `name` and `json`. With `kept: true` it is answered from the cache only, and the desk is never asked:
  a verb of `KEPT_READS` the cache holds is answered as the desk would (`item.files` as `{ files, filesMore }`,
  `item.checks` as `{ checks }`), and a kept `item.get` carries `current` (the current goal's id) and `self` (its own
  agent's name) beside the item. Anything the cache cannot answer, or a verb that is no kept read, is answered
  `{ ok: false, code: 'not-kept', why }`.
- **The grant wake**: a G granted on an item wakes, as its own (DESK), the agent that placed it, and the agent holding
  the item's phase, who placed none.
- **One line, one agent**: his line addressed to nobody is taken at the desk first; only a take the desk answered
  wakes the agent. A take with no answer (a lagging desk) wakes nobody.
- **No wake is lost**: a line leaves the queue only once its agent has it. What does not fit one answer stays for the
  next wait, which hands it over at once; nothing that comes while the agent is busy is dropped by a cap. Every one of
  250 lines that came while it was busy is handed over, over as many waits as it takes.
- **A wake is dropped only once read** (Andy, goal/G41: "The desk ear must not successfully start listening if there
  is a wake waiting", and of the read key: "good idea, make the red assert it"): `next` answers each wake with its
  `key`. A wait that names no key, or an older one (`read`), gets the unread wake again at once, under the same key;
  naming its key drops it, and the next wait hands only what came after, under a new key.
- **The news cap sheds only news never handed**, by bytes (Andy's standing rule: every store sheds past a cap), and
  the next wake says how many went; a line of a wake not yet read is never shed.
- **The cache is saved on every update** (Andy: "on every update the deskClient receives, it saves the cache,
  (10ms?)"): within `CACHE_SAVE_MS` (10 ms) of a row, `<state>/cache.json` holds the whole cache as it stands.
- **A restart reads the cache back and subscribes from its position** (Andy: "(if it restarts or similar) it calls the
  \"subscribe/(connect)\" verb do desk, (re-use that verb) with the position number as argument"): a deskClient started
  on the same state folder holds what it kept before any push, and subscribes with `since` = the newest change it
  heard (`desk/change`). `setDesk` naming the same desk subscribes from there; naming another desk, from 0.
- **The catch-up**: rows the desk hands after such a subscribe are taken as any row: a line addressed to this agent
  wakes it; a line addressed to another agent is neither its own nor its news.
- **A push replaces the items and rules whole** (Q5, Andy: "YES"): deskClient names `renews: ['deskItems',
  'deskRules']`; once a push has landed (`{ bootstrapped: true }`), an item it no longer holds is gone, while the
  position (`desk/current`, `desk/change`) and the parts read (`deskItem`, a kept file list) are never swept.
- **A bundle is its rows**: a publish `{ change, rows: [...] }` is taken row by row, as each row alone would be.
- **The desk's line addressed to the cap agents** (its row's `to`, as his addressed lines) wakes the agent whose key
  it names as its own (DESK), with no take, and entitles it to answer there and take the box.

## Since goal/G41.12 (box v32)

- **The client role**: deskClient calls `setMode("client")` of spirit/appServer.js at its startup, never `"server"`;
  the cache and its file are spirit/appServer.js's (no cache.json of its own, no renews, no position of its own).
- **Its asks of the desk go through spirit/appServer.js**: `server.ask(desk key, 'desk', verb, args, how)`, answered
  `{ status, body }` (cw), so spirit/appServer.js bundles them.
- **The shared current goal** (Andy: "the desk client MUST use process/js/desk/currentGoal.json to update it's
  knowledge"): a read of a part its cache lacks, which the desk answers "ok" alone, is answered from the
  currentGoal.json of its checkout. The test takes an item with a box from that file as it stands.
- Not asserted yet: the merge format of currentGoal.json with the cache (Andy: "in a format that allows deskClient to
  merge it with it's cache"); the box names none.

## What its test must try to break

- A dump written by a stranger, or anywhere but `cache.json`, or not the whole tree.
- A kept read that asks the desk, or a cache miss answered with something other than `not-kept`.
- A current-goal item whose files or checks are asked of the desk after the push.
- A grant on an item the agent holds, placed by another, that does not wake it.
- A take with no answer that wakes the agent.
- Lines cut from an answer, or past a cap, that never come.
- A wake dropped before its key comes back, or an unread wake not handed again at once.
- A cache not saved after a row, or not read back after a restart.
- A restarted client that subscribes from 0, or from a position it did not hear.
- A push that leaves a deleted item's facts, or sweeps the position or a kept file list.
- A line for another agent that comes back in a catch-up as this agent's.

## Not testable as written here

- "An answer that does not get through" (the node's 12 s door or the listener giving up after deskClient answered)
  cannot be seen from inside deskClient: its handler's answer has left. What is tested is its stand-in: a wait that
  names no key, or an older one. The listener's half (its arm, `--read <key>`, passed to `next` as `read`) is
  `deskAgentEar.js`'s, tested beside it.
- **No cap offer** (box v38: the desk refuses box changes from agents): a desk line addressed to the agent wakes it with
  no take; box.take and box.write go to the desk as asked, no gate of its own; nothing of the cap offer is left.
- **Searches from the cache** (found live on 63d88daf: chat.search answered {"ok":true}, no lines): an agent's
  chat.search, the desk answering ok, finds the line the stream brought in its items.
