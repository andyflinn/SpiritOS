# spirit/test/app-child-browser.js

The -browser general test beside `spirit/app.js` (goal/G47.1, box v140-142): it judges the scripts under `spirit/app/` and
below in a page, the page twin of `app-child-general.js`. What holds for every page script is
`spirit-sibling-browser.js`'s.

    node spirit/test/app-child-browser.js [<script> ...]

Handed scripts, each in its reach is judged, its result reported for that script; handed none, every script under
`spirit/app/` the tree keeps.

## Requirements

Andy: *"i just want the fucking status box to fail a fucking test if it does NOT fucking mount its own shit by itself"*;
the box: *"a new general test, spirit/test/app-child-browser.js: every element under spirit/app/, mounted alone on a scratch
node with its app's server on, is red unless it loaded its own app's api.js and data.js."*

- Its reach: a script under `spirit/app/<name>/`, in no test folder.
- One scratch node (the tracked files) with the server of every app judged turned on, where the app's folder holds one
  (`spirit/app/<name>/<name>.js`; Andy: *"a server MUST be mounted if a mountable server exists in that app folder before a
  test is conducted"*); no page is opened before each of them answers its interface.
- Each script is opened alone on its bare DEBUG page, `spirit.js` and that file (`spirit/DEBUG/headLessBrowser.js`). Whether
  it installs an element the page says, no code read.
- An element, mounted: `spirit/app/<name>/api.js` and `spirit/app/<name>/data.js`, each that the app's folder holds, stand
  in the page's `spirit.required`. On a bare page nothing else loaded them, so a missing one is red at 0.8: it leans on its
  mounter. One title, reported for each script.
- A script that installs no element, or an app with neither file, is said as a comment, never green.
- No made-up data: nothing is planted (box v113).
