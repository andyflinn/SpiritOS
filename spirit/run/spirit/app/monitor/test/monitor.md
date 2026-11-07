# monitor.js

`spirit/run/spirit/app/monitor/monitor.js` is the app of the same name (goal/G43.6). Its test is `./monitor.js`, in a real browser on a scratch node, on the node's own `server-stats` job.

Andy, box: *"An app that reads and displays a stream, called "monitor". It resides in spirit.app.monitor"*.

## Requirements

- `monitor.json`: icon 🦻, label `Monitor`, intrinsic true (Andy's 7f6ebbbe), mount `monitor.js`, shell mount and tile true, node mount false.
- `spirit.app.monitor.createApp(container) -> { destroy() }`, beside `spirit.app.searchApp`, the function that implements the family's verb `app.search`, and on neither `spirit.elements` nor `spirit.element`.
- It requires no old code: no `spirit.shell`, nothing under `shell/`, nothing through `spirit.elements`. It opens no other app. It loads and uses `spirit/element/search/valued.js`.
- Until the first reading it says it is waiting. The reading the stream brings replaces that.
- One `valued` fills the app, under one search field: the 11 numbers (`Memory (RSS)`, `Heap used`, `CPU`, `Uptime`, `Event loop mean`, `Event loop max`, `Event loop p99`, `Files`, `Folders`, `SSE connections`, `Requests total`) and the four groups of counts (`Jobs by status`, `Files by MIME type`, `Requests by method`, `Requests by status class`), each count a row. `Jobs by status` replaces `Active jobs`.
- Each new reading repaints the numbers, with nothing asked. Words put the row that fits first. A repaint keeps the search words, that order and the scroll.
- `destroy` empties its container, and a later reading paints nothing.
