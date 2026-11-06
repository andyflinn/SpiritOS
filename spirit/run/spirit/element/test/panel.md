# spirit/element/panel.js

What mounts covers its mounter (goal/G43.17; Q12, Andy: *"yes."* to `panel`, in `spirit/element/panel.js`). Its test is `./panel.js`: the tree read as it is, then a real node on a scratch copy of the tracked files, and real clicks in a real Chrome on the appSelector, on `/face.html`.

## Requirements

- One generic panel element, used by the appSelector and file (Q3): `spirit/element/panel.js` is there; `appSelector.js` and `file/file.js` load it and draw no ✕ or `app-container` of their own.
- An element mounts over the one that mounts it, in the same pane, under the title bar [icon] <label> [✕] (Q2): Files over the tiles under `📁 Files`, a file over Files under its own bar below the Files bar, what is under it out of view.
- ✕ shows the mounter again. A closed layer is hidden, not destroyed: it stays on the page out of view, and reopening it shows the same layer.
- Each pane keeps its own stack: the outer ✕ closes the file and Files at once, and the tiles show again. Reopened in the same session Files shows what was there, its words kept; after a reload it starts with none.
- The appSelector's ✕ hides too (Q3): the Agent's detail, closed, stays on the page, and pressed again the same one shows.
- A deactivated app's layer only leaves the view (Q11): the Agent's open layer, switched off by `app.active`, leaves the view and stays on the page, its tile gone; after the shell boots again nothing of `spirit/app/agent/` is loaded.
- Nothing throws on the page up to the Agent switched off; after that its kept layer is the Agent's own (Q11).
