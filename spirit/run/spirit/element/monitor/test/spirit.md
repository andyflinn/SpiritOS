# spirit.js

`spirit/run/spirit/element/monitor/spirit.js` is the spirit job's monitor, as tiles (goal/G47.1, Q24). Its test is `./spirit.js`, in a real browser on a scratch node, on the node's own `spirit` job.

Andy: *"one container, subscribed to "spirit" that draws a few pretty tiles with icon and a value pair. hard-coded, and drop about 50% of the stupid info it shows that interests NOBODY."*, *"place the "monitor" element in run://spirit/element/monitor/spirit.js, where it'll be one of the elements that the "job" app later uses to decorate one of it's "job" details/monitors"*, *"keep it simple, with the values you suggested."*

## Requirements

- `spirit.element.spirit.element.monitor.spirit.create(container) -> { destroy() }`.
- It requires no old code: no `spirit.shell`, nothing under `shell/`, nothing through `spirit.elements`, and no `valued`. It draws its icons with `spirit/element/icon.js`.
- Until the first reading it says it is waiting. The reading the stream brings replaces that.
- Six tiles, hard-coded, in this order, each an icon, a value and its name: `Memory` (resident memory), `CPU`, `Uptime`, `Event loop delay` (its p99), `Connections`, `Jobs running` (the node's jobs whose status is running).
- Nothing else of the reading is shown: no heap, no event loop mean or max, no files or folders, no requests, no lists of counts.
- Each new reading of the spirit job writes the values, with nothing asked; the tiles stay the same tiles.
- `destroy` empties its container, and a later reading paints nothing.
