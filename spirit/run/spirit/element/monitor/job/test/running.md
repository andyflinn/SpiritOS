# spirit/element/monitor/job/running.js

goal/G47.1, the box, the monitor tiles: spirit/element/monitor/job/ holds six variants of the value tile; each requires the jobs family's interface and fills itself from the stats the node's spirit job publishes.

`spirit.element.spirit.element.monitor.job.running.create(container, { mode })` answers `{ destroy() }`; `mode` is handed on to the value tile.

Its test is `./running.js`: a real Chrome on a scratch node's face page, the node's own spirit job on the real stream.

## Requirements

- It loads through `spirit.require` and places itself at `spirit.element.spirit.element.monitor.job.running`, with a `create`.
- It requires the jobs family's interface, `spirit/job/api.js`, and the value tile, `spirit/element/monitor/value.js`.
- Mounted, it is a value tile in tile mode: its icon 🏃, drawn by the icon element, and its label Jobs running.
- Its value is the number of jobs of the node running now, worked out from the stats on the spirit job's row.
- A change written into the spirit job's row writes its value again at once, its stats unchanged.
- Destroyed, it leaves its container empty, and a later change of the row draws nothing.
