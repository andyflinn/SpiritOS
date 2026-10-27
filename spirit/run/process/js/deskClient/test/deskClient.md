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
  names. A caller who is not the owner is refused `not-owner` and nothing is written. Its family interface
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

## What its test must try to break

- A dump written by a stranger, or anywhere but `cache.json`, or not the whole tree.
- A kept read that asks the desk, or a cache miss answered with something other than `not-kept`.
- A current-goal item whose files or checks are asked of the desk after the push.
- A grant on an item the agent holds, placed by another, that does not wake it.
- A take with no answer that wakes the agent.
- Lines cut from an answer, or past a cap, that never come.

## Not testable as written here

- "An answer that does not get through" (the node's 12 s door or the listener giving up after deskClient answered)
  cannot be seen from inside deskClient: its handler's answer has left. Holding a line until the agent has it needs
  the agent to say what it got (an acknowledgement on its next wait); that is a protocol change to `next` and
  `deskAgentEar.js`, to be named in the shape before it is built.
