# boot-sibling-generalRules.js

The general rules of a shell app or element (goal/G41.18), judged in a real browser. It runs once per file, the file its
argument, as `../../test/spirit-child-generalRules.js` does for a module:

    node shell/test/boot-sibling-generalRules.js shell/agent/agent.js

**Its name is its reach** (`../../test/TEST_SYSTEM.md`; Andy: *"the NAME of the file should tell testModule.js which
folder this it belongs to. there are some nameing standards that are supposed to tell the product test system, which
general test must be run against which modules"*). It is a `-sibling-` test beside `shell/boot.js`, so `testModule.js`
runs it for every module in `shell/` and below that has its own test. A shell file outside `shell/`, such as an agent
table's page files in `process/js/agent/table/`, is not in its reach.

Each file is its own test id. A rule a file breaks fails that file's test, not the item that brought the test.

**What is mounted is known by its path** (goal/G41.19, box v17; Andy: *"the test knows bloody fucking well if a scripts
is an app (from the path pattern), why the fuck would would it need manifests for standard patterns?"*, *"the test knows
fucking well, which are elements scripts in ./shell/js/"*):

- an **app** is `shell/<app>/<app>.js`;
- an **element** is any script under `shell/js/`;
- anything else in its reach (`shell/boot.js`, `shell/seal.js`, a Desk plugin, `shell/shared/js/`) is neither, is not
  mounted, and its run says so.

**Given no file, it judges every app and element in its reach** (goal/G41.19): an item's suite row names no file, so a
run of this test alone takes every shell module `testModule.js` gives it that is an app or an element, on one scratch
node, each file in a run of its own so each is recorded under its own module. That run records one line per file, named by the address
it opened: green when the file's own run had no red.

    node shell/test/boot-sibling-generalRules.js

**Every test name starts with the path** (Andy: *"please start the test descriptions always with the exact URL to the
server, without \"/DEBUG\" service"*; box v13: *"EVERY MOTHERFUCKING TEST NAME in the product three STARTS WITH THE
MUTHERCUCKING PATH"*): each section is named by the address the file's page is opened at, `/DEBUG` left off, such as
`/shell/agent/agent/headLessBrowser.html: it loads by itself`.

Andy, on G41.18:

- *"we may require a ./test/shell-child-generalRules.js with a test that catches all violators of this sort of thing,
  THAT's were a general test belongs"*
- *"shell-child-generalRules.js can also run headless chrome test to assert UI standards..."*
- *"who says it shouln't check general \"mountability\" of elements and apps?"*, *"mount each element or app all by
  itself, to \"unit\" tests?"*
- *"add that test: shell-child-generalRules.js"*

## How it runs

- A scratch copy of the tracked files of `spirit/run`, on a node of its own, on a free port. Neither Andy's node nor an
  agent's is touched. A working-tree change to a tracked file is in the copy; a new file is in it once git knows it.
- Headless Chrome, found where the machine keeps it (by name on Linux, in its usual folders on Windows, or
  `SPIRIT_CHROME`). It is driven over its debugging port with node's own WebSocket: no package.
- Its node's DEBUG is switched on (`node.debug { debug: { on: true } }`), and it opens the node's **DEBUG page** for
  the file, `/DEBUG/<path>/<module>/headLessBrowser.html` (goal/G41.19; `../../spirit/test/DEBUG.md`). Andy: *"i want
  to specify that wsl's element mount tests must be the first user of this DEBUG feature."* It judges what the page
  reports and the real layout it drew. It takes seconds per file, so it belongs to the general rules and not to an
  item's red.

## The page it needs: the DEBUG page, `headLessBrowser`

Made by the node from the address (`spirit/run/spirit/DEBUG/headLessBrowser.js`); there is no page file of its own, and
it names no element (Andy, of the `shell/mount.html` it replaces: *"why are there elements hard-coded in there?"*).

- It loads `/spirit.js` and nothing else of the shell by a tag. Its body holds one box of the whole page, of class
  `fill`.
- It starts the spirit object (`spirit.start()`), then requires the one module of the address through `spirit.require`.
  Nothing is preloaded (rule/26: every element loads its own parts via spirit.require), so a file that uses a part it
  did not require fails here.
- **An app** (it calls `spirit.shell.activateApp`) is mounted into the box with the api a face gives an app.
- **An element** mounts with its container alone, no options: the page creates the element its file registers on
  `spirit.elements` (box v23: *"No mount files at all: every element is mounted with its container alone, no
  options"*). An element missing its options must not throw: it mounts and says it is not configured. Its special
  cases are its own test's, on pages of its own in `./test/`.
- It reports on `window.spiritMount`:
  - `state`: `loading`, then `mounted` or `failed`;
  - `error`: why it failed;
  - `box`: the mount box;
  - `destroy`: for an element, what its create answered as destroy.

## Requirements: what it judges per file

Box v23: *"Clean mount: with its container alone it mounts, loads its own parts, throws nothing even when unconfigured
(it says it is not configured), asks for no missing file, logs no console error, and destroy leaves the container
empty."* And *"every box inside it that scrolls keeps its height and its width when given far more than it holds; each
box is its own check, named by the element's path and the box's id chain."*

- **It mounts cleanly:**
  - the node answers the DEBUG page for the file;
  - the file mounts on the bare page, with its container alone;
  - nothing it runs throws;
  - every file it asks for is there: no file request answers 4xx or fails. The door's answers and the browser's own
    favicon request are not files the page asked for;
  - it says no error on the console.
- **Every box inside it bounded, tall and wide** (rule/16; Andy: *"any container that mounts unknown stuff inside it
  should be bounded in vertically and horizontally"*):
  - every tool and tab button it draws (`[data-tool]`, `[data-tab]`) is pressed in turn, and its boxes judged after
    each press, so each box it can show is judged while it shows;
  - judged by the layout, not by names: every shown box that scrolls (overflow `auto` or `scroll`, either way) is
    given a child 5000px tall, then one 5000px wide, each taken out again. It keeps its height and its width, inside
    the mount box, the mount box not overflowing. A dropdown's list is hidden until it opens, and is not asked;
  - **each box is its own check**, titled `<path>/headLessBrowser.html: sized box <its id chain>`, such as
    `div#agent-bench > div#wb1-strip-left`, so a red names the element and the box at once;
  - the mount box never grows past its height, and the page never scrolls sideways.
- **Every icon through the icon element** (goal/G41.23; Andy, goal/G41.21: *"this element will replace icons painting
  all shell elements and apps."*; box v5: *"new-face apps will be updated to use the new "icon" element."*; Q1: *"plus
  the intrinsic apps, plus the icons app. all apps that use icons."*): every glyph it draws that is a pictograph
  (Unicode `Extended_Pictographic`, as its icons are), is shown and **stands alone**, its element's whole text, lies
  inside an element of the class the icon element (`shell/js/icon.js`) carries. A glyph among words is a character of
  the text and is left as it is (Andy: *"isn't a glyph inside flowing text just like another inline character? ...
  glyphs are legal in labels and description true, and in that context they don't need special handling"*, then
  *"narrow the rules so."*). The class is read from an icon made after the mount, so nothing is preloaded. Judged as
  drawn and after each tool and tab button is pressed, as the boxes are; the check names the first glyphs drawn outside
  it and where.
- **Every shell file that paints an icon loads the icon element** (judged once, in the run given no file, before the
  mounts: a bare mount draws no data, so most icons are seen only in the code). A shell script, no test and no vendor
  code, whose code (comments left out) holds a pictograph alone in a string or alone between two tags, or that paints
  icons it is handed (`FROM_DATA`, named by hand: the shell frame, Apps, Icons, Contacts, the Icons list and row, the
  icon selector, the workBench), names `shell/js/icon.js`. Each is its own check, named by its path. Three files whose lone glyph strings are drawn only
  before words are left out by hand (`TEXT_ONLY`, each with its reason): jobsDetails' status glyph, contactDetails'
  blocked and held marks, and the contacts list's filter icons, drawn before their words.
- **Destroy**: an element's destroy leaves its container empty. An app is closed by the face and has none of its own.

**Deferred reds, CodeMirror's** (Andy, goal/G41.19: *"comment in the test/md file for the other three, (SHORT!) why we
defer the red's on them: because it's codeMirror."*): `shell/js/codeMirror`, `shell/js/textViewer` and
`shell/textEditor/textEditor` stay red on the bounded-box check. CodeMirror's scroller sits 50px past its clipped parent
on purpose, to hide the native scrollbars (its own css: *"Things will break if this is overridden"*).

## What its test must try to break

- A file that mounts only because the page preloaded something.
- A file that asks for a file that is not there, throws, or logs an error, its options missing included.
- A box only as tall or as wide as its content, anywhere between a scrolling box and the app.
- A destroy that leaves what it drew.
- A pictograph painted as text of its own, outside the icon element, as drawn or after a press.
- A glyph among the words of a label or a description counted as an icon.
