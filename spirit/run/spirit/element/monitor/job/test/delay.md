# spirit/element/monitor/job/delay.js

goal/G47.1, the box, the monitor tiles: spirit/element/monitor/job/ holds six variants of the value tile; each requires the jobs family's interface and fills itself from the stats the node's spirit job publishes.

`spirit.required.spirit.element.monitor.job.delay.create(container, { mode })` answers `{ destroy() }`; `mode` is handed on to the value tile.

Its test is `./delay.js`: a real Chrome on a scratch node's face page, the node's own spirit job on the real stream.

## Requirements

- It loads through `spirit.requireScript` and places itself at `spirit.required.spirit.element.monitor.job.delay`, with a `create`.
- It requires the jobs family's interface, `spirit/job/api.js`, and the value tile, `spirit/element/monitor/value.js`.
- Mounted, it is a value tile in tile mode: its icon 🔁, drawn by the icon element, and its label Event loop delay.
- Its value is the 99th percentile of the event loop delay of the node, one decimal and ms, worked out from the stats on the spirit job's row.
- A change written into the spirit job's row writes its value again at once, its stats unchanged.
- Destroyed, it leaves its container empty, and a later change of the row draws nothing.
