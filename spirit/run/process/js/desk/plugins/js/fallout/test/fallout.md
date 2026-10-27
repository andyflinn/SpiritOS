# process/js/desk/plugins/js/fallout/fallout.js

The Fallout plugin (goal/G27.14), in its reduced scope: its own goal, plugin/fallout, and its Fallout tab under Apps.
Andy, 2026-10-17: "I just want a Fallout app, that searches "reds" in verifier, and shows me a table of test items that
match the search term." Its tab asks this node's deskVerify itself (Andy: "correct. fallout talks to deskVerify
only."); the plugin stays for its goal and its tab.

## Requirements

- It exports the plugin contract, `function (desk) -> { refuses, handles, verbs }`, and answers `{ verbs: {} }`.
- **It adds no verb to the desk** (goal/G29.5): the wrapper verbs `fallout.reds`, `fallout.summary` and
  `fallout.history` are deleted.
- It gives no `refuses` and no `handles`: it governs no call.
- It reads and writes nothing of the desk at its mount.

## What its test must try to break

- A verb back on the desk (any of the deleted wrappers).
- A mount that writes to the desk or publishes.
- A mount that depends on the desk it is handed.
