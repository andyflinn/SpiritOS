# Done

**Appended by `node spirit/test/runAll.js`, one line per requirement in the full run where it left the board. Never rewritten.** "Named by" lists the test files that mention it now; a row nobody names left the board without a test saying it was built.

The lines before 2026-09-27's first automatic one were backfilled once from wsl-claude's run log, which starts on 2026-09-25; anything finished earlier is in git history only.

| Left the board | Requirement | Title | Commit | Named by |
|---|---|---|---|---|
| 2026-09-26 | puppets/G5 | the owner switch in a puppet | c5b16ed | **no test names it: built, or dropped?** |
| 2026-09-26 | cycle-10/R5 | STRICT: unsealed is refused in both directions | 780426a | agentsSeal.js, cardFetch.js |
| 2026-09-27 | puppets/G6 | a puppet's stored owner key, owner-only | d66c790 | agentsRecord.js, puppetOwner.js |
| 2026-09-27 | puppets/G7 | the loopback shim | 3b30b1a | agentsRecord.js, puppetDoor.js |
| 2026-09-27 | cycle-10/R13 | Get the damn rotate-button into the info app | 3053ca8 | agentsRecord.js |
| 2026-09-27 | cycle-11/C3 | the state the record cannot mark: its own node being down | ca4646b | cycleRequirements.js, relayRecord.js |
| 2026-09-27 | puppets/G4 | `peerOwnerPost()` on the owner's node | f97f348 | ownerPost.js |
| 2026-09-27 | public-app-server/G10 | a server reports the box it sits on: four fields, one opinion withheld | 8ccc194 | appServerBoundary.js, boxesSuite.js |
| 2026-09-27 | public-app-server/G8 | layer 1 splits by PROMISE, and the stable half is named | 31a5220 | appServerBoundary.js |
| 2026-09-27 | puppets/G3 | one suite that makes every api call | ad0b289 | everyVerb.js, oneDoor.js |
| 2026-09-27 | public-app-server/G18 | the app process serves its owner node over a named pipe, not a TCP port | 3b4133e | **no test names it: built, or dropped?** |
| 2026-09-27 | public-app-server/G17 | join's answer travels back to the browser | e2cda60 | appServers.js, faceLastLeg.js, faceRouteSuite.js, oneDoor.js, puppetPost.js |
