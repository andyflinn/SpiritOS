# spirit/element/monitor/job.js

goal/G47.1, the box, the monitor tiles: spirit/element/monitor/job.js replaces spirit/element/monitor/spirit.js; it lays out the six job tiles. The monitor app's wrapper mounts it, and the old file goes.

`spirit.element.spirit.element.monitor.job.create(container)` answers `{ destroy() }`. The six tiles are elements of their own in `./job/` (memory, cpu, uptime, delay, connections, running; no file named jobs, Andy's rule of the singular), each filling itself from the node's spirit job; it reads no stats itself.

Its test is `./job.js`: a real Chrome on a scratch node's page, the node's own spirit job on the real stream.

## Requirements

- job.js is there, and spirit/element/monitor/spirit.js is gone.
- It requires each of the six job tiles, and reads no stats itself.
- It loads through `spirit.require` and places itself at `spirit.element.spirit.element.monitor.job`, with a `create`; the six tiles stand beside it, at `spirit.element.spirit.element.monitor.job.<name>`.
- Mounted, it lays out the six tiles in one grid (`.stats-grid`), in order: Memory, CPU, Uptime, Event loop delay, Connections, Jobs running.
- Once the stream's reading is in, each tile holds its icon and a value.
- Destroyed, it leaves its container empty, and a later change of the spirit job draws nothing.
