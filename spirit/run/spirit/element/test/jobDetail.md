# spirit/element/jobDetail.js, one job

Its test is `./jobDetail.js`. The box (goal/G43.29, v3): *"The detail is today's shell/jobsDetails dialog, drawn by a spirit/element/ file of its own"*, and *"Each works exactly as the old one"*. Written from reading the old `shell/jobsDetails/jobsDetails.js`.

`spirit.element.jobDetail.create(host, { id, close })`, mounted alone in a box of a real Chrome on a scratch node's face page; a running process from a planted `node.run` app.

## Requirements

- A node's own job (`spirit.fs`): its facts Status, Id, Kind, Updated, and neither Cancel nor Delete (*"never for a node-operated one"*).
- Its events box: a file change on the node shows as a new event line with no reload; a click puts it in the Extract box (CodeMirror), written out as `JSON.stringify(object, null, 2)`.
- A running process offers Cancel and no Delete; Cancel cancels it on the node, and the screen stays and shows it stop; terminal, it offers Delete instead; Delete deletes the job on the node, and the screen goes with it: `close` is called.
- A job not there says it is no longer listed, with no button.
- destroy empties its host; the page throws nothing.
