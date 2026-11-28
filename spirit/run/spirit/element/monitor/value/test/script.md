# spirit/element/monitor/value/script.js

goal/G47.1, the box, the monitor tiles: spirit/element/monitor/value/script.js is a value, mounted with an icon, a label, a value and a mode; its value can be set again later. The mode defaults to tile; row comes later.

`spirit.required.spirit.element.monitor.value.create(container, { icon, label, value, mode })` answers `{ set(value), destroy() }`.

Its test is `./script.js`: a real Chrome on a scratch node's face page.

## Requirements

- It loads through `spirit.requireScript` and places itself at `spirit.required.spirit.element.monitor.value`, with a `create`.
- Mounted with an icon, a label and a value, it is a tile (`.stat-tile`) showing all three, the icon drawn by the icon element.
- Handed no mode, it is shown as a tile; handed a mode it does not know yet (row, until row is built), it is shown as a tile.
- Handed no value, it shows a dash.
- `set` writes a new value in place; `set` with the value it already shows writes it again, so a tile filled from a stream redraws on every change written into what it watches (spirit/testicle/general/browser/pageRules/script.js).
- Destroyed, it leaves its container empty, and a later `set` draws nothing.
