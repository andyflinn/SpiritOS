# spirit/app/appSelector/rowFormToggle.js

A rowForm that toggles (goal/G43.15). Its test is `./rowFormToggle.js`, in a real Chrome on a scratch node's face page.

Andy: *"it acts exactly like the two toggle switches in appSelector:detailElement."*, *"it is configurable with a description of what is being toggled."*

## Requirements

- `spirit.elements.rowFormToggle.create(host, { on, words, press })`, loaded through `spirit.require`, answers `{ root, set, destroy }`.
- One rowForm with the words it was handed. Off, it shows 🔴 and its button 🟢; on, 🟢 and 🔴, as the detail's switches do.
- A press calls `press` and changes nothing by itself. `set(on, words)` redraws it with the new state and words, still one form, and a press on the redrawn button calls `press` again.
- `destroy` empties its host.
