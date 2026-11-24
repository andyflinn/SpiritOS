# spirit/element/monitor/job/cpu/script.js

goal/G47.1, the box, the monitor tiles: spirit/element/monitor/job/ holds six variants of the value tile; each requires the jobs family's interface and fills itself from the stats the node's spirit job publishes.

`spirit.required.spirit.element.monitor.job.cpu.create(container, { mode })` answers `{ destroy() }`; `mode` is handed on to the value tile.

Its test is `./script.js`: a real Chrome on a scratch node's face page, the node's own spirit job on the real stream.

## Requirements

- It loads through `spirit.requireScript` and places itself at `spirit.required.spirit.element.monitor.job.cpu`, with a `create`.
- It requires the jobs family's interface, `spirit/job/api.js`, and the value tile, `spirit/element/monitor/value/script.js`.
- Mounted, it is a value tile in tile mode: its icon ⚙️, drawn by the icon element, and its label CPU.
- Its value is the share of a CPU the node used, one decimal and a percent sign, worked out from the stats on the spirit job's row.
- A change written into the spirit job's row writes its value again at once, its stats unchanged.
- Destroyed, it leaves its container empty, and a later change of the row draws nothing.
