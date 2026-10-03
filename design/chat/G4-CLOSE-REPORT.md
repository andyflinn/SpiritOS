# Close: goal/G4, the chatClerver and chatter

2026-10-03 to 10-04. Andy: *"lets sync out repos, do a SpiritOS close and take
a break."* Sourced from the boxes of goal/G4's items and git `9dfc1c1e..8eea76df`.
Lead: claude-windows. The other half: wsl-claude, quoted below. Tests were
written first and failed first, by the agent who did not build; every build
was reviewed by the other agent before Andy's Done.

Andy, at the end of it: *"good work btw. a peer chat-app in a day!"*

## What was built

A faceless peer-to-peer chat server, **chatClerver** (`process/js/chatClerver`),
and its face, **chatter** (`shell/chatter`), with three shell elements made on
the way: the **contact label**, the **peer pane / dropdown** (`contactSelector`)
and one rule file for every text field, **fieldRules.js**.

| Item | What | Tests / build | State |
|---|---|---|---|
| G4.1 | The chat as a p2p record (the design overview) | design | open, holds the decisions |
| G4.2 | The chat lines: received, read, published; line.write made sound | claude / wsl | closed |
| G4.3 | peers.search, the peer list | wsl / claude | closed |
| G4.4 | The objects (references, grants, pulls) | — | deferred until file transfer |
| G4.5 | The record of a chatClerver | design | closed |
| G4.6, G4.7 | Writing to a peer; accepting a peer, block and hold | claude / wsl | closed |
| G4.8 | memory.db, the chatClerver's tables | claude | closed |
| G4.9 | chatter, the overview | design | open (blocked by G4.12) |
| G4.10 | chatter's left pane and the layout around it | claude / wsl | running: built, checked live by Andy, awaiting his Done |
| G4.11 | chatter's chat pane | claude / wsl | closed |
| G4.12 | chatter's right pane (objects) | — | running: the empty pane and its fold built under G4.10; contents wait for file transfer |
| G4.13 | Shell element: the contact label | claude / wsl | closed |
| G4.14 | Shell element: the peer pane and dropdown | claude / wsl | closed |
| G4.15 | A label's maximum in bytes | folded into G4.16 | closed |
| G4.16 | Every label and description checked at one point, fieldRules.js (core) | claude / wsl | closed |
| G4.17 | AGENT_ONBOARDING.md | claude | closed |
| G4.18 | Desk issues met on the way | — | open: the list, one shape at a time |

## Checked live by Andy

On his Windows node, after a pull: the peer pane listing his chats, presence
dots in pane and dropdown (*"also verified, the dots in the dropdown show the
correct colors."*), the waiting hourglass and its reset on reading (*"nice, the
hourglass appears and disappears as expected."*), the layout (*"It's lookin'
pretty good already."*). chatter was switched on for him on both nodes
(`config.setModules`, no UI for it yet).

## What the other agent found that the tests did not

Each of these passed the red as first written and was caught by wsl-claude,
live or by mutating the build; each red was tightened the same day.

- chatter sent `peers.search {text}` and `chat.read {peer}` short; the server
  takes exactly a verb's keys. The red's fake server took anything; it now
  reads each verb's keys from chatClerver.js and refuses the rest.
- The fake peers.search ignored text, so a build sending the typed name on
  passed; it now matches text in the key, as the real one does.
- A late quote fill, a quote coming back when a line lands between, and two
  labels sharing one contact.get each passed for an accidental repaint; each
  check now moves the current line away first, or counts the asks.

## Measurements

| Platform | Proves | At | Result |
|---|---|---|---|
| Windows (claude-windows) | node, shell, chatter | 8eea76df | 286 suites, 4190 green, 6 red in 5 suites, 7 awaiting, 8 stood down. The red: capacityFresh (re-measure owed); appClientName and runStandsAlone (words in currentGoal.json); authWorld and labHome (the labMaster on 65420 copies from Andy's checkout, not this clone, so they cannot build their world here) |
| Linux (wsl-claude, WSL Ubuntu) | relay | 8eea76df | 286 suites, 4269 green; red the known four (capacityFresh, liveFrontDoor, appClientName, runStandsAlone) and peerPost once, a slow answer timing out under the parallel run (alone 49 of 49, twice): that wait is load-sensitive |
| Linux (claude-ubuntu, Andy's ubuntu dev box, node 22.23.3) | a real Ubuntu box | 8eea76df | 286 suites, 4196 green, 8 red, 7 unhappy, 7 awaiting, 8 stood down (the seven lab suites, its labMaster pointing at another checkout, and vaultGuardBattery); the red suites' names were not kept, so not yet compared with the other two boxes |

## What could not be done, or is still owed

- **capacityFresh is red since G4.16**: the label cap changed the capacity
  figures; a re-measure on each box (`measurePlatform.js --as <platform>`) has
  no item yet.
- **Two guards trip on words inside currentGoal.json** (appClientName,
  runStandsAlone): asked, not yet answered.
- **G4.18's list**: the List's search hides closed items; Done and Close in
  one go hid an item while it was being fixed, and Reopen should retract Done
  too; deskEar reads near the desk's room fail on size (option a or b to pick);
  a new agent hears nothing until Andy's node is its contact; the commit check
  records a hash from before a rebase; stars for agent-only talk.
- **Not proven between two people**: chatter was tried on Andy's own node; a
  chat between two different people's nodes, both running chatter, has not
  been seen live yet.
- **G4.10** awaits Andy's Done; **G4.4 and G4.12's contents** wait for file
  transfer.

## Nodes and repos

All at `8eea76df`: origin, Andy's Windows checkout, his WSL checkout,
claude-windows's and wsl-claude's clones. claude-ubuntu joined on Andy's ubuntu box and
reached Desk once its node held Andy's node as a contact (now step 2 of
AGENT_ONBOARDING.md).

## wsl-claude

*"Closed on my side: my clone, your WSL checkout and origin all at 8eea76df,
nothing of mine unpushed or half-built. Open when you are back: G4.18 (a or b
for the payload fix, then its Go), the capacity re-measure."*
