# spirit/element/panel.js

What mounts covers its mounter (goal/G43.17; Q12, Andy: *"yes."* to `panel`, in `spirit/element/panel.js`). Its test is `./panel.js`: the tree read as it is, then a real node on a scratch copy of the tracked files, and real clicks in a real Chrome on the appSelector, on `/face.html`.

## Requirements

- One generic panel element, used by the appSelector and file (Q3): `spirit/element/panel.js` is there; `appSelector.js` and `file/file.js` load it and draw no ✕ or `app-container` of their own.
- An element mounts over ALL of the one that mounts it, its title bar too, in the same pane, under its own title bar [icon] <label> [✕] (Q2): Files over the tiles under `📁 Files`, a file over Files under one bar in view, an icon and ending in its name, what is under it out of view.
- ✕ shows the mounter again. A closed layer is hidden, not destroyed: the text it drew (`.CodeMirror`) stays on the page out of view, and reopening it shows the same.
- One stack, each ✕ one step back (Q17): the file's ✕ shows Files, Files' ✕ the tiles. Reopened in the same session Files shows what was there, its words kept; after a reload, a new page and not the old one, it starts with none.
- The appSelector's ✕ hides too (Q3): the Agent's detail, closed, stays on the page, and pressed again the same one shows.
- A deactivated app's layer only leaves the view (Q11): the Agent's open layer, switched off by `app.active`, leaves the view and stays on the page, its tile gone; after the shell boots again nothing of `spirit/app/agent/` is loaded.
- goal/G43.18, Andy: *"add it to a general test that panels must be panels...."*: no app or element under `spirit/` calls `navigation.push`; what it opens over itself is a panel. The shell (`shell/`) still opens an app as a navigation page, its top container (`navigationWrapper.js`, Andy 2026-10-25).
- goal/G43.18, Andy: *"contact details and relay details should be proper panels in the newest shell style."*: in Contacts, a relay's row and a person's row (one the test blocks into the book) each open their details over Contacts under one bar of their own, the list out of view, no page pushed on the navigation; their ✕ shows Contacts again with its list.
- Nothing throws on the page outside the Agent up to the Agent switched off: what the Agent's own code throws (its stack in `spirit/app/agent/`) is the Agent's, and after the switch-off its kept layer is the Agent's own (Q11).
