# spirit/element/jobDetail.js, one job

Its test is `./jobDetail.js`. The box (goal/G43.29, v3): *"The detail is today's shell/jobsDetails dialog, drawn by a spirit/element/ file of its own"*, and *"Each works exactly as the old one"*. Written from reading the old `shell/jobsDetails/jobsDetails.js`.

`spirit.element.jobDetail.create(host, { id, close })`, mounted alone in a box of a real Chrome on a scratch node's face page; a running process from a planted `node.run` app.

## Requirements

- A node's own job (`spirit.fs`): its facts Status, Id, Kind, Updated, and neither Cancel nor Delete (*"never for a node-operated one"*).
- Its events box: a file saved through `fs.save` (spirit.fs reports what it is asked, not a file written past it) (in a folder of its own: the run folder's top is refused) shows as an event line naming the file, with no reload; judged by the name, never the count, the window being full at 256; a click puts it in the Extract box (CodeMirror), written out as `JSON.stringify(object, null, 2)`.
- A running process offers Cancel and no Delete; Cancel ends it, the node then removes it (goal/G29.16), and the screen stays and says it is no longer listed, `close` not called.
- A failed process stays listed (G29.16): it offers Delete and no Cancel; Delete deletes the job on the node, and the screen goes with it: `close` is called.
- A job not there says it is no longer listed, with no button.
- destroy empties its host; the page throws nothing.
