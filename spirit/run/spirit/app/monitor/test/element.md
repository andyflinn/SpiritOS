# element.js

`spirit/run/spirit/app/monitor/element.js` is the app of the same name (goal/G43.6). Its test is `./element.js`, in a real browser on a scratch node, on the node's own `server-stats` job.

Andy, box: *"An app that reads and displays a stream, called "monitor". It resides in spirit.app.monitor"*.

## Requirements

- `monitor.json`: an icon, today 🦻 (an icon; which one is Andy's and not tested, goal/G47.1), label `Monitor`, intrinsic true (Andy's 7f6ebbbe), mount `element.js`, shell mount and tile true, node mount false.
- `spirit.required.spirit.app.monitor.element.create(container) -> { destroy() }` (goal/G43.32); no `spirit.app.monitor.createApp`, and no monitor on `spirit.elements`.
- It requires no old code: no `spirit.shell`, nothing under `shell/`, nothing through `spirit.elements`. It opens no other app. It loads and shows `spirit/element/monitor/job/script.js` (since goal/G47.1, the box, the monitor tiles; it was `spirit/element/monitor/spirit.js`, now gone), the spirit job's monitor (goal/G47.1, Q24; Andy: *"throw out "valued" completely"*), and names no `valued`.
- Opened, it shows that element's six tiles; what they show is the element's, in `spirit/element/monitor/test/spirit.md`.
- `destroy` empties its container, and a later reading paints nothing.
