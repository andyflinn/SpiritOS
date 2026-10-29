# process/js/deskClient/deskClient.js

The desk client (goal/G3.3 and on; this spec: goal/G41.11): a server on an agent's own node. It follows Andy's desk's
stream into its cache (spirit.data, through the desk's translator), passes the agent's asks to the desk, and wakes the
agent with what is meant for it. This spec holds what goal/G41.11 requires of it; Andy: "desk and deskClient must
work in concert, why would the deskClient let an agent do anything until the agent has received those notices? The
client has a cache, if the agent wants to know stuff, give them FIRST the cache".

## Requirements

- **The cache dump** (Andy: "a cache-dump to to a fixed file  name in relay-state/process/deskClient/<fixedFileName>.json"):
  since goal/G41.12 the cache is appServer's, `relay-state/process/deskClient/cache-<desk key in hex>.json`, and
  deskClient keeps no file of its own. The verb `cache.dump`, owner-only, asks appServer to save its cache now
  (`saveCaches`) and answers appServer's file and its bytes. With no cache kept yet it is refused `not-saved`. It
  takes no path, and deskClient writes no file at all, `cache.json` or anywhere a caller names. A caller who is not the
  owner is refused `not-owner`, and nothing is saved. Its family interface names it. For looking, never for deciding.
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
- **The cache is appServer's** (goal/G41.12): deskClient follows the desk's stream with the cache switch on
  (`stream.cache: true`); saving within 10 ms of a row, and reading the cache back at a start, are appServer's
  (`spirit/test/appServer.js`). deskClient writes no `cache.json`.
- **A restart subscribes to its desk** (Andy: "(if it restarts or similar) it calls the \"subscribe/(connect)\" verb
  do desk"): a restarted deskClient subscribes to the desk it knew, family `desk`, and names no position of its own: the
  position is appServer's. `setDesk` naming the same desk subscribes to it again; naming another, to that one.
- **The catch-up**: rows the desk hands after such a subscribe are taken as any row: a line addressed to this agent
  wakes it; a line addressed to another agent is neither its own nor its news.
- **A push drops nothing deskClient kept** (goal/G41.15, Andy: "deskClient keeps what it cached outside the current
  goal; a push of one goal never drops another's", and Q1: "nothing drops from the cache, unless the api.js from the
  server says so"): deskClient names nothing for a push to replace (no `renews`) and sweeps nothing itself. After the
  current goal is pushed whole again, an item the push leaves out stays kept, and so do another goal's items; the push
  makes its goal current; `desk/change` and a kept file list are never swept. Landing a push is appServer's.
- A delivery of several rows is appServer's bundle (goal/G41.12); deskClient sees each row alone.
- **The desk's line addressed to the cap agents** (its row's `to`, as his addressed lines) wakes the agent whose key
  it names as its own (DESK), with no take, and entitles it to answer there and take the box.

## What its test must try to break

- A dump by a stranger, a dump that does not ask appServer, or a file deskClient writes itself.
- A kept read that asks the desk, or a cache miss answered with something other than `not-kept`.
- A current-goal item whose files or checks are asked of the desk after the push.
- A grant on an item the agent holds, placed by another, that does not wake it.
- A take with no answer that wakes the agent.
- Lines cut from an answer, or past a cap, that never come.
- A wake dropped before its key comes back, or an unread wake not handed again at once.
- A cache switch left off, or a cache file of deskClient's own.
- A restarted client that does not subscribe to its desk, or names a position appServer keeps.
- A push that drops an item it leaves out, another goal's items, the position or a kept file list.
- A line for another agent that comes back in a catch-up as this agent's.

## Not testable as written here

- "An answer that does not get through" (the node's 12 s door or the listener giving up after deskClient answered)
  cannot be seen from inside deskClient: its handler's answer has left. What is tested is its stand-in: a wait that
  names no key, or an older one. The listener's half (its arm, `--read <key>`, passed to `next` as `read`) is
  `deskAgentEar.js`'s, tested beside it.
