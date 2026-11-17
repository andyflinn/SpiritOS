# spirit/element/search/app/rowFormToggle.js

A rowForm that toggles (goal/G43.15). Its test is `./rowFormToggle.js`, in a real Chrome on a scratch node's face page.

Andy: *"it acts exactly like the two toggle switches in appSelector:detailElement."*, *"it is configurable with a description of what is being toggled."*

## Requirements

- `spirit.element.spirit.element.search.app.rowFormToggle.create(host, { on, words, press })`, loaded through `spirit.require`, answers `{ root, set, destroy }`.
- One rowForm with the words it was handed. Off, it shows 🔴 and its button 🟢; on, 🟢 and 🔴, as the detail's switches do.
- A press calls `press` and changes nothing by itself. `set(on, words)` redraws it with the new state and words, still one form, and a press on the redrawn button calls `press` again; a `set` with the state and words it already shows draws nothing.
- Its press is the rowForm's (goal/G47.1, Q20; Andy: *"mark the button busy from press until the mounter's answer comes"*): a press whose answer has not come leaves the button busy, disabled with its turning mark; once the answer comes, it is plain again.
- `destroy` empties its host.
