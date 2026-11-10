# spirit/app/agent/test/agent-centreTabs.js

goal/G41.31. The agent app's centre is a tabContainer, judged by real clicks in a real Chrome on a scratch node, at `/face.html`.

## Requirements

- **A tabContainer stands in the centre**, from the start, with no tabs.
- **Each panel is a closable tab, activated if it exists, created if not.** Headers: provider, model, persona and job `<icon> <label>`; chat `<chat-icon> <persona-label>`, a tab of its own beside its persona's; a node's bundle `<bundle-name>`; a bundle not node-owned `(<bundle-name>)` in italic print.
- **The tabs stay when the left tool changes** (Q1).
- **A label changed anywhere: its header follows.** A tab closes when it hears its row deleted. Its close button takes it away, and the row stays.
- **A tab has one listener on its row**: a press on a row that has its tab adds none, and closing the tab lets go of it. Not in Andy's words: found at verify, a listener stacked per press; a fault of the build, not a new requirement.
- **An unsaved add-tab says `new <row-type>*`.** Saved, it reads as its row, and pressing that row in the list activates it: no second tab.
- Grants keeps `<owner>-<bundle>`: `spirit/app/grants/test/element.js`.

## What its test must try to break

- A second tab for a row, or for a saved Add. A persona's tab and its chat's taken for one. A header that keeps an old label.
