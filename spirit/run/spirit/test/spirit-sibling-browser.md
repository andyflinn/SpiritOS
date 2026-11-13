# spirit/test/spirit-sibling-browser.js

The -browser general test beside spirit.js (goal/G47.1, box v94, 2: *"there will be, from now on only 3 types of general
tests"*, *"existing general tests fold into the appropriate of the 3 new general test name-formats"*). It holds the page
checks of generalRules, every title kept: every product script required on a page and placed at spirit.required.<path>,
every element script's factory at spirit.element.<path>, every page module's own page green, and for a file its page:
mounted by itself, nothing thrown, nothing missing, no console error, its box kept, its pictographs in the icon element,
its fields stopping at their limits, its calls through spirit, its redraws, its writes, its searches, its destroy.
The file-reading checks of generalRules are `spirit-sibling-general.js's`, its node checks `spirit-sibling-node.js's`.

    node spirit/test/spirit-sibling-browser.js [<script> ...]

- *"with no script-argument, they will process all applicable scripts. else it will process all scripts listed in the
  arguments that fit"*: no argument, every page module; one script, its page; several, each in a run of its own.
- *"browser only scripts are tested by -general and -browser general tests"*: testicle hands it no node-only script.

generalRules' contract as it stood (its page parts are this test's):


The general rules of a module, a shell app or an element (goal/G41.18), the page rules judged in a real browser. It runs
once per file, the file its argument:

    node spirit/test/spirit-sibling-generalRules.js shell/agent/agent.js

**Its name is its reach** (`./TEST_SYSTEM.md`; Andy: *"the NAME of the file should tell testModule.js which
folder this it belongs to. there are some nameing standards that are supposed to tell the product test system, which
general test must be run against which modules"*). It is a `-sibling-` test beside `spirit.js`, so `testModule.js` runs
it for every module in `spirit/run/` and below, with its own test or without (goal/G47.1): `shell/` and the agent tables' pages alike
(goal/G41.27; Andy: *"1. The checks judge every module under spirit/run/: the test is
spirit/run/test/spirit-sibling-generalRules.js instead of shell-child. No page moves; one test covers shell/ and the
agent tables alike."*). It was `shell/test/boot-sibling-generalRules.js`, whose reach was `shell/` and hung on
`shell/boot.js`.

`spirit.js` has been at `spirit/run/spirit/spirit.js` since goal/G43.18; `testModule.js` finds it there for the run
root's test folder (`./TEST_SYSTEM.md`), so this file is a general test, run once per module it judges.

Each file is its own test id. A rule a file breaks fails that file's test, not the item that brought the test.

**What is mounted is known by its path** (goal/G41.19, box v17; Andy: *"the test knows bloody fucking well if a scripts
is an app (from the path pattern), why the fuck would would it need manifests for standard patterns?"*,
*"the test knows fucking well, which are elements scripts in ./shell/js/"*):

- an **app** is `shell/<app>/<app>.js`;
- an **element** is any script under `spirit/element/`. The agent tables' pages (goal/G41.27; Andy, Q5: *"it covers
  them, too"*) have been in `spirit/app/agent/table/` since goal/G43.12, which no pattern of the test matches, so today
  none of them is counted as an element;
- also an element: `spirit/app/app/element.js` and the files of `spirit/app/appSelector/` (goal/G43.2), and an app of
  the new folder, `spirit/app/<name>/<name>.js` (goal/G43.2);
- anything else in its reach (any other module) is neither, is not mounted, and its run says
  so.

**Given no file, it judges every app and element in its reach** (goal/G41.19): an item's suite row names no file, so a
run of this test alone takes every shell module `testModule.js` gives it that is an app or an element, on one scratch
node, each file in a run of its own so each is recorded under its own module. That run records one line per file, named by the address
it opened: green when the file's own run had no red.

    node spirit/test/spirit-sibling-generalRules.js

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

### How it runs

- A scratch copy of the tracked files of `spirit/run`, on a node of its own, on a free port. Neither Andy's node nor an
  agent's is touched. A working-tree change to a tracked file is in the copy; a new file is in it once git knows it.
- **The agent server is turned on there** (goal/G41.28), as its owner turns it on: `active` in
  `spirit/state/agent/node.json` (`spirit/job.js`) is written before the node starts. The agent tables' pages draw the
  agent family's cache, which is there only while that server runs, so they are judged as they are used, not refused.
- Headless Chrome, found where the machine keeps it (by name on Linux, in its usual folders on Windows, or
  `SPIRIT_CHROME`). It is driven over its debugging port with node's own WebSocket: no package.
- Its node's DEBUG is switched on (`node.debug { debug: { on: true } }`), and it opens the node's **DEBUG page** for
  the file, `/DEBUG/<path>/<module>/headLessBrowser.html` (goal/G41.19; `../../spirit/test/DEBUG.md`). Andy: *"i want
  to specify that wsl's element mount tests must be the first user of this DEBUG feature."* It judges what the page
  reports and the real layout it drew. It takes seconds per file, so it belongs to the general rules and not to an
  item's red.

### The page it needs: the DEBUG page, `headLessBrowser`

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

### Requirements: what it judges per file

Box v23: *"Clean mount: with its container alone it mounts, loads its own parts, throws nothing even when unconfigured
(it says it is not configured), asks for no missing file, logs no console error, and destroy leaves the container
empty."* And *"every box inside it that scrolls keeps its height and its width when given far more than it holds; each
box is its own check, named by the element's path and the box's id chain."*

- **The general rules of a module** (goal/G40.6; folded in from `spirit-child-generalRules.js`, goal/G47.1; Andy: *"for
  now, fold those two into spirit-sibling-generalRules.js"*), judged in its code, on every file handed, and in the run
  given no file over every product script. Andy: *"it will assert, the require path rule it will assert that the
  spirit-object becomes a global at the top of all modules"*; spirit.js itself: *"it must establish the global spirit
  object early in the code, it must follow the require-path restrictions we discussed."*
  - **The global early**, judged in "it requires spirit.js first" (Andy, 2026-11-13, G47.1 box v73: *"if a module
    requires anything, it must require spirit.js first. Other modules are required using spirit.require(), unless they
    are native node.js modules."*): a module requiring nothing holds it; one requiring anything has `spirit.js` first,
    and any other plain require is one of node's own modules. `spirit.js` sets the global before its first require.
    Page code (no `module.exports`, speaks to `window`) is never loaded by node.
  - **The require rule** (goal/G40's box): *"a require path that starts with ../ may only add a file name, never descend
    into a subfolder of an ancestor; any other require path starts with <module>/, the module's own children. A sibling
    in the module's own folder is legal."* A package or a node built-in is not a path; a computed path cannot be read.
  - Its test must try to break it with a module requiring anything before `spirit.js`, a `spirit.js` requiring before it
    sets the global, and a require descending into an ancestor's subfolder.
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
  inside an element of the class the icon element (`spirit/element/icon.js`) carries. A glyph among words is a character of
  the text and is left as it is (Andy: *"isn't a glyph inside flowing text just like another inline character? ...
  glyphs are legal in labels and description true, and in that context they don't need special handling"*, then
  *"narrow the rules so."*). The class is read from an icon made after the mount, so nothing is preloaded. Judged as
  drawn and after each tool and tab button is pressed, as the boxes are; the check names the first glyphs drawn outside
  it and where.
- **Every shell file that paints an icon loads the icon element** (judged once, in the run given no file, before the
  mounts: a bare mount draws no data, so most icons are seen only in the code). A shell script, no test and no vendor
  code, whose code (comments left out) holds a pictograph alone in a string or alone between two tags, or that paints
  icons it is handed (`FROM_DATA`, named by hand: the shell frame, Apps, Icons, Contacts, the Icons list and row, the
  icon selector, the workBench), names `spirit/element/icon.js`, or hands them to the one-row form, `spirit/element/rowForm.js`,
  which paints them through the icon element and loads it itself (goal/G41.27). Each is its own check, named by its path. Two files whose lone glyph strings are drawn only
  before words are left out by hand (`TEXT_ONLY`, each with its reason): contactDetails' blocked mark, and the contacts
  list's filter icons, drawn before their words. The files read are only those git
  tracks under `shell/`: the `spirit/` entries of both lists are never read, and `shell/boot.js` (now
  `spirit/shell/boot.js`), `shell/apps/apps.js` and `shell/icons/icons.js` are no longer in the tree.
- **Every field stops at its limit** (goal/G41.27; Andy: *"in the general UI tests (headless browser), any input field
  must be checked for size-limits, and get a "red" if it violates that rule."*): every text field it draws (a textarea,
  or an input of type text, email, search, url, tel or password, shown and editable), after its tools are pressed, is
  typed twice the longest field the rules allow (`spirit/fieldRules.js`, its largest `*MAX_BYTES`) through the
  browser's own input (`Input.insertText`, which fires `beforeinput` as typing does), and keeps no more than that. A
  field nothing holds keeps it all. Each field it lets through is named by its id chain and its placeholder.
- **Every button pressed, one at a time**, after the fields are judged, each watched from the press until the node has
  answered every write it sent, or two seconds.
- **All it sends goes through spirit** (goal/G41.27; Andy: *"can it assert that no element posts or fetches by itself,
  and that all wire-stuff goes through spirit?"*): every fetch, XMLHttpRequest, WebSocket, EventSource and sendBeacon
  the page makes, watched from before its first script, is made by spirit's own code (`spirit.js`, its families,
  `spirit/client/`, the page's data set `spirit/data.js`), told by the file the call was made in. The one
  exception is `boot.js`, the face's own transport, now `spirit/shell/boot.js` (Andy: *"boot.js MUST be an exception to
  the rules."*).
  **Two reds outside goal/G41.28, still red** (Andy: *"WSL will drop Q23 from this item, and mark those two related reds
  as outside it"*): login fetching its steps file and the file viewer (`spirit/element/fstat.js`) fetching a file at
  home. Each red says so. `shell/login/login.js` is no longer in the tree.
- **What it changes, it listens for** (Andy: *"elements that change things, also subscribe to the changes they cause,
  since andy request an element generates would imply that it must listen for confirmation of the results"*): a module
  that sent a write (a call it made that is not the stream, not an interface, and carries no read op or read verb)
  holds, while mounted, a `spirit.event.subscribe` or `spirit.data.watchPath` of its own making (a family view's watch, `spirit.data.viewAt(node, family).watch`, counts as one, under its whole path).
- **While a write is out, it draws nothing of its own** (rule/19; the box: *"after a press, until the stream answers, an
  element may change only its busy spinner, its button's disabled state and its fine print; any other change it makes
  is red"*): from a press that sent a write until the node has answered it, the only changes in its box are a busy mark
  (`shell-busy`), a button's `disabled`, `aria-busy` or class, and fine print (`job-manifest-note`, `job-start-error`,
  `job-refusal`, `fine-print`). A press that sends no write is not judged.
- **Its searches match the whole row** (goal/G41.28; Andy, box v15: *"All client side searches will be fixed, too, and
  search the whole row, as cached in spirit.data."*): judged in its code, no app or element but the search element
  itself hands a search a `matched(...)` of its own, a few fields in place of the whole row.
- **What it needs, it requires itself** (goal/G43.24; Andy: *"every element that accesses ANY api must require them
  themselves, (fast if an other element already required it), that way anybody can mount any element without knowing
  what it actually needs...."*, *"wsl, you may as well add that to the general headless browser test."*): judged in its
  code, it takes no interface from what it is handed (no `api.verb`, `api.escapeHtml`, nor an `api` off its options);
  it reaches its verbs through the spirit object itself.
- **Every search it makes ranks spirit.data** (box v15: *"every probabilitySearch on a page is made with a spirit.data
  branch (its data option), and draws only rows that branch holds. A list fed by its own rows() or by answers alone goes
  red."*): every probabilitySearch the page makes, watched as it is made, has a `data` branch and no `rows()` of its own.
  And every row a search draws (its `[data-key]` rows on screen, after its tools and buttons are pressed) is a row its
  branch holds in `spirit.data` (`spirit.data.rowsOf(branch)`): a list that keeps its rows anywhere else draws what the
  branch does not hold.
  **One exception, deferred and still red** (the box: *"the only exception is introspector, deferred for network-scope
  design reasons."*): the probability search keeps rows of its own for introSpector's selectors over another node, so
  its own page, mounted bare, still makes one, and introSpector's own page makes two. Each red names the deferral; it is
  not met, so it is not green.
- **What it changes, it listens for through spirit.data** (goal/G41.28; Andy: *"EVERY FUCKING ELEMENT is verified to
  make sure when it changes shit it listens to fucking update via the spirit object"*, and *"YOUR TEST WILL MAKE SURE THAT
  THE CACHING AND LISTENING IS DONE TO FUCKING SPEC AS GOOD AS YOU POSSIBLY CAN"*), judged three ways:
  - on the page: a module that sent a write holds a `spirit.data.watchPath` of its own making, its searches' included. A
    subscription to the raw stream does not count: taken into a store of its own, it is how the Desk List kept rows
    `spirit.data` never held;
  - its watching redraws it: a marked row written into each `spirit.data` path it watches must change its box within a
    second. A path is by server node first (goal/G41.28), `<node>/<family>/<branch>[/<row>]`, a watch of the home node
    holding `~` for the page's node: a branch gets a row of its own, a row path is set and put back. A watch that redraws nothing is not
    listening. A box that shows nothing at all (a selector hidden until its family is chosen) has nothing to redraw,
    and is not judged. **A closed dropdown draws its list when it opens**: while nothing it watches has redrawn, each
    closed dropdown on the page is opened in turn, what it watches written again, and shut. **A redraw proved in its own test** (Andy, Q24: *"Shall deskDetails' own test be the proof that it
    redraws from the verifier, since the page sweep opens no item?"* *"yes."*): `spirit/app/desk/element/deskDetails/deskDetails.js` draws
    the verifier's run only for an item open, which a bare mount never has; its own test is run, and the check is green
    only when its check *"a verifier publish taken into spirit.data redraws the run"* passed. So for Join (Andy,
    goal/G43.32: *"cw, yes"*, to *"shall join's own test prove that it redraws, as you ruled for deskDetails in Q24?"*):
    `spirit/element/joinList.js` and the Join app that mounts it, `spirit/app/join/element.js`, draw only the join news on
    the spirit job, which a marked row cannot change; `spirit/element/test/joinList.js` is run, and the check is green only
    when its check *"a new join on the spirit job, taken into spirit.data, redraws the steps"* passed;
  - in its code, since a bare mount seldom has a row to change: a module whose code sends a write (an op that changes a
    row, a setting verb named as a string such as `'node.setName'`, a relay `join` or `face`, a `grant`, a `saveFile`)
    holds a `.watch(` or makes a search on a `spirit.data` branch. The code rule is a net for what the page cannot
    reach, not the whole judgement.
- **Nothing judged is no pass** (Andy: *"You fucking fudge tests to get away with total fucking sloppyness!"*): a rule
  that finds nothing to judge on a page (no field, no write, no search, no row drawn, no subscription, no watch) says
  *not judged on this page* and counts as neither green nor red.
- **Destroy**: an element's destroy leaves its container empty, and **lets go every subscription it made** (rule/8). An
  app is closed by the face and has none of its own.

**What is seen, not the box** (goal/G41.27; Andy: *"change the test for codeMirror."*): a box is judged by what the
boxes above it that clip (overflow other than `visible`) leave of it on screen. CodeMirror's scroller sits 50px past its
frame on purpose, to hide the native scrollbars (its own css: *"Things will break if this is overridden"*), and its frame
cuts the extra off, so nothing spills: `spirit/element/codeMirror` and `shell/textEditor/textEditor` are no longer deferred.
**CodeMirror's own scrollbars are not containers** (goal/G41.28): `CodeMirror-vscrollbar` and `CodeMirror-hscrollbar`
hold only the library's own sizer, as long as the text, and nothing is ever mounted in one; they are not asked. The
editor's scroller still is.

### What its test must try to break

- A file that mounts only because the page preloaded something.
- A file that asks for a file that is not there, throws, or logs an error, its options missing included.
- A box only as tall or as wide as its content, anywhere between a scrolling box and the app; a box clipped on purpose
  by a frame above it counted as spilling.
- A destroy that leaves what it drew.
- A pictograph painted as text of its own, outside the icon element, as drawn or after a press.
- A glyph among the words of a label or a description counted as an icon.
- A field nothing holds; a field held only by a rule not loaded on the page.
- A fetch, XMLHttpRequest, WebSocket, EventSource or sendBeacon of its own.
- A draw made after a press and before its write is answered; a press that sends no write judged all the same.
- A subscription still held after destroy.
- A write sent by a module that watches nothing in spirit.data, or only the raw stream; a write in code with no watch
  beside it; a watch that redraws nothing.
- A rule that found nothing to judge counted as green.
- A list that hands its search a matched(); a search made with no data branch, or fed by its own rows(); a row drawn
  that its branch does not hold.

**The app family's selector is an element too** (goal/G43.2): `spirit/app/app/element.js` and the three files beside it in `spirit/app/appSelector/` are judged as the shell's elements are.

### Requirements (goal/G43.30): run://process is named nowhere

Andy, goal/G43.20: *"that whole run://process folder NEEDS killing with ALL references to it in code, test and documentation."*; goal/G43.30: *"WSL, your tests make sure that none of the affected modules even mention "spirit/run/process/""*.

- **Every file it judges** names neither `spirit/run/process` nor `run://process`, in its code or its comments: the whole text is read.
- **Run with no file** (every module): every tracked `.js`, `.html` and `.json` of spirit/run/ outside a test folder and the vendored folders is read the same way, and none may name it; the count read is said, and none read is red.

### What its test must try to break (goal/G43.30)

- A mention in a comment, or written `run:/process`; a module the scan skips because it is neither an app nor an element.

### goal/G43.31: every branch is named as its folder

Judged on each branch folder by `./spirit-sibling-branchRules.js` since goal/G43.32.

### Requirements (goal/G43.32): run://test/ is moved into run://spirit/test/

Andy: *"we'll move the contents of run://test/   into run://spirit/test/ first."*; on Q2: *"We need special rules for
run://spirit/test/  it will be where run://spirit/app/test/ finds it's main tools."*; and his concluding point: *"this move
will free the run:// folder namespace and SpiritOS will only take up 1 name ("spirit") in it. .gitignore will be updated
to ignore the run:/ folder except for run://spirit/"*.

Judged in the run with no file:

- **The old folder is empty**: git tracks no file in `run://test/`.
- **The new folder holds the move**: the files `run://test/` held on 2026-11-10 (testReport-verifier.js and .md since folded into test/testReport.js and .md, goal/G45.1), `test/test/` included, stand in
  `run://spirit/test/`.
- **Nothing names the old folder**: no tracked `.js`, `.md`, `.html` or `.json` under spirit/run/, tests and documents
  included and the vendored folders left out, names it as a path or as `run://test/`, in code, comment or text. This suite's
  own `.js` and `.md` are the only files left out, since they must name it to judge it; the `.js` builds the name.
- **The tools are not tests**: `testModule.js`, wherever it stands, lists none of `testReport.js`, `testModule.js` and
  `headLessChrome.js` as a test. Their own tests stay in `test/test/`.
- **Git ignores run:// except run://spirit/**: `.gitignore` holds `/spirit/run/*` and `!/spirit/run/spirit/`, and no other
  line naming a path under run:// outside run://spirit/; a new file in run:// outside spirit/ is ignored, and a new file in
  run://spirit/ is not (`git check-ignore --no-index`).

### What its test must try to break (goal/G43.32)

- A file left behind in the old folder, or one of the 19 that did not arrive.
- A mention in a comment or a document, or written `run://test/`.
- A tool listed as a test, so `noFuckingGarbage` judges it as a test named after no module.
- A `.gitignore` line for a path under run:// that `/spirit/run/*` already covers; `run://spirit/` ignored by mistake.

### Requirements (goal/G43.32, the refactor): every product script loads the tree through `spirit.require`

Andy: *"every script (other than spirit/spirit.js) must start with ... 'use strict'; 'let spirit = require(spirit) or the
html pages <script href=spirit/spirit.js> kind of thing; all other scripts should be loaded using spirit.require()"*,
*"node modules designated to provide node.js functionality: require('http' | 'fs' etc.) are exempt"*, *"i see no reason
codemirrors vendored scripts cannot be spirit.required...."*, *"just rename the bloody script"*, and *"this item deals
with PRODUCT files, NOT tests."* Judged by reading every tracked `.js` under `spirit/run/spirit/`, test folders and
vendored code left out; with no file, all of them in one check; with a file, that one, each reason its own red.

- **It starts with `'use strict';`**, its first statement, comments aside. `spirit/spirit.js` too.
- **It takes the spirit object first**: its first `require()` names `spirit.js`; a page script, which has none, finds
  spirit on the page, which loaded `spirit/spirit.js` by its script tag.
- **Nothing else of the tree is loaded but by `spirit.require`**: any other `require()` names one of node's own modules
  (`fs`, `http`, `node:sqlite`, ...), as a plain string. A relative path, a computed path or another package is red.
  `spirit/spirit.js`, which is `spirit.require`, is not judged on this.
- **No script name holds a dot of its own** besides `.js`.

- **Placed where it is required** (testing point 3; Andy: *"a general test for any scriptFile.js is to spirit.require()
  it."*, *"I'm NOT demanding that all scripts load in all environments, I'm demanding that they're placed in the spirit
  object according to these rules IF they are required."*): every product script is `spirit.require()`d alone, on the
  node (in the scratch copy beside the scratch node, a process of its own) and on a page (the scratch node's face
  page, a fresh page each). Where it loads, it stands at `spirit.required.<its path>`, and on the node the answer came
  at once, not a promise; a branch's `api.js` binds its branch (decided 8), so it is waited on and judged by its place. Where it does not load nothing is judged; that some load on each side is itself checked.
- **An element script**, one that calls `installSpiritElement`, has a factory with a `create` at
  `spirit.element.<its path>` once required on a page.
- **One helper places elements**: `spirit/element/installSpiritElement.js` is there, and no other product script puts
  an element on `spirit.element` or `spirit.elements` by hand (an assignment, or an `Object.assign` into them);
  `spirit/spirit.js`, which makes the spirit object, excepted.
- **The old place is gone** (decided 6: an app's element is placed like every element, and *"the shell, the app selector,
  the file opener and the desk find it there"*): no product script names `spirit.elements` (or any `.elements`) any more.

### What its test must try to break (goal/G43.32, the refactor)

- A script with no `'use strict'`, or one that has it after its first statement.
- `require('./x.js')`, `require(path.join(...))`, or `require('fs')` before `spirit.js`.
- A require written in a comment or a string is no require: the code is read with its comments blanked.
- Too few scripts found (fewer than 100): nothing judged is red, never green.
- A script that loads but stands nowhere in `spirit.required`, or answers a promise on the node.
- An element script that loads on a page with no factory at its place, or one that does not load there at all.
- `spirit.element.x = ...` or `spirit.elements.x = ...` written by hand outside the helper.
