# Close: desk/G2 (List, dialog, agents) and desk/G3 (Desk after the switch)

2026-09-30. Andy: *"So lets do a SpiritOS close: try this. for sourcing input,
you may read desk records. Go."* Sourced from his desk.db `records` (269 on his
node, 16:39 to 18:52; 141 his, 60 of them his chat lines) and git
`3c8d4c0a..1f22ad37` (38 commits). Lead: claude-windows. The other half:
wsl-claude, whose report is below in his own words.

## The rows

Every item closed by Andy's Done and Close. Tests were written first and
failed first, by the agent who did not build.

| Item | What | Tests / build | Checked live by Andy |
|---|---|---|---|
| G2.6 | The List paints only what the desk server says | wsl / claude | yes (the List he uses) |
| G2.7 | The item dialog paints only what the desk server says | claude / wsl | yes |
| G2.8 | agents.js and AGENTS.md work with the new Desk | wsl / claude | through the agents' own use |
| G3.1 | Start design with nothing open starts a new goal | claude / wsl | **not yet**: only possible with nothing open; closed on the tests ("i just have to believe it for now") |
| G3.2 | At startup Desk shows the latest state | wsl / claude | yes ("After a hard reload, the state of desk was exactly the same") |
| G3.3 | Opening an item with a long chat fails | claude / wsl | yes |
| G3.4 | A Go-all button for fixing rounds | wsl / claude | yes (used twice) |
| G3.5 | Dialogs close with a black X at the right of the title bar | claude / wsl | yes |
| G3.6 | Reopen is never shown in the List | wsl / claude | yes ("i see the proof now") |
| G3.7 | A goal never offers Go (its Go is Go all) | wsl / claude | yes |
| G3.8 | Close in the item dialog closes the dialog | claude / wsl | yes |
| G3.9 | Musings need no lead | wsl / claude | yes ("a musing was now suggesfully logged") |
| G3.10 | A press repaints every row it changes | claude / wsl | yes, on G3.11 ("Worked!", "Yay!") |
| G3.11 | Testing Gee-three-ten | a test item | used for G3.10 |

## Measurements

| Platform | Proves | At | Result |
|---|---|---|---|
| Windows (claude-windows) | node, shell, Desk | this commit | 233 suites, 3803 green, 0 red, 7 awaiting, 1 stood down |
| Linux (wsl-claude) | relay | owed by wsl-claude | owed by wsl-claude |

Flaky under load this stretch, green alone every time: peerPost (busy
retry), liveFrontDoor, appServerBoundary (owner-asleep world), deskWhileBackup,
shutdownWire (wsl). deskRows was flaky for a reason of its own, found at the close:
its start-up wait took a refusal for ready, so a slow start left the server empty.
That is fixed, and it was green 5 of 5 alone.

## Nodes brought up to the tree

- Andy's Windows node: its checkout is at 75bc7bf5. After it, only tests and
  agents.js changed, and agents.js runs on the agents' side. Nothing his node
  runs differs.
- The agents' nodes: agents.js runs fresh on each call, so nothing needs a restart.
- WSL side: owed by wsl-claude.
- Relays (spirit-3): nothing in this stretch touches the relay, so no update
  is owed. Only Andy touches spirit-3.

## What could not be done, or is still open

1. **The backup line lost its red mark.** It turned red when something closed
   after the last backup check, by reading his old `closed.` line. A close is a
   press since G2.6, and nothing says when the server last closed something.
   Open; it needs a fact from the desk server.
2. **The old goals are not in the new server.** desk/G1, cleanup/G1 and the
   rest live only in desk.db's old `lines`. Copying them was offered twice and
   not answered. Closed goals would be invisible even if copied, since an empty
   search shows only what is open.
3. **Two proposals were never taken up:** "a typed search shows everything,
   closed and abandoned included" and "a Make current press on a goal row".
   Not ruled.
4. **No tag was cut before the switch**, though I said one would be. Andy
   pulled first.
5. **G3.1 is closed without a live check.**
6. **Found at the close (wsl-claude):** agents.js desk sent a `by` to
   log.search, pending.get, state.get and seen.get, which refused it. Fixed at
   this commit: only the nine writes carry `by`. Checked live on his node.

## Divergences, what each was about, and readiness

- **wsl read desk/G2 as abandoned.** It was a stale read; records 27 to 54
  show Done and Close with no Abandon. About: a difference of reading.
- **Where Go all sits.** Andy's "right side of the button bar in list" was
  built as the search row; his next line, "same as design buttons when team is
  active", put it in the tab bar. About: a gap in the writing, closed by his
  second line.
- **G3.3, refuse or widen.** wsl built "refuse a line too long to come back"
  before Andy chose between that and a larger room for his browser; his rulings
  ("in the sent messages ther MUST be a MAX_PAYLOAD", "i wont need a scroll up
  page") keep what was built. About: building ahead of a ruling.
- (owed by wsl-claude: any he records.)

**Readiness: five defects reached Andy's screen past a green harness.**
- Reads refused a `by` (b349b47b).
- The dialog never showed his chat line (e548bf8c).
- Musings needed a lead that no longer exists (G3.9).
- A goal offered a Go that meant nothing (G3.7).
- Rows stayed stale after a press that changed them (G3.10).

Each suite had mounted the page on a fake (deskFake, a stand-in api) that
answered as the author assumed the real one did. The fakes, not the code,
were where the gaps lived. Four more came from the switch itself: the empty
server, the missing lead, the stale reads, and the missing tag.

## What the other agent checked

Owed by wsl-claude: what he checked, named with commits, and what he would refuse to be handed. What he did report at the close: he compiled his vault (b92d9e7, compile 17: "a comment is not a fact; change the switch that exists; say what his node runs"), and he found the agents.js reads bug in item 6 above.

## How the lead worked, for the record

- **Not listening.** For a while his lines were lost between re-arms of a
  one-shot listener, and "changed" nudges were noted but not read. Andy:
  "you're not listening". It is fixed with one permanent listener plus a
  watcher on his desk.db records that keeps its place across restarts.
- **Promises in reports.** A hash was written before it was known ("f-HEAD",
  "1b..") twice and corrected after; a record number was cited unverified and
  checked afterwards.
