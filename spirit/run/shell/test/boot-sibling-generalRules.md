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
- **An element** mounts by itself: the page creates the element the file registers on `spirit.elements`, in the box,
  with no options. If the page cannot tell which element the file registered, or it registered none with a `create`,
  the page fails and says what it found. A mount file is for a special case only (Andy, box v17: *"a mount test or any
  other test type only needs a manifest for special cases, like a grants panel that needs configuring with and ID
  table."*).
- **A special case** is mounted by the file beside its tests that names how (Andy: *"so the test folder needs a
  <module>-shell-child-<testname>.json if it has special call or mount requirements for that test?"*, and *"i proposed
  making it a json file."*): `<its folder>/test/<its name>-headLessBrowser.json`, named after the module and the
  generator that reads it. It is JSON, not a script: `testModule.js` runs every `.js` in a test folder as a test.
  - `{ "create": "<the element's name on spirit.elements>", "options": { ... } }`: the page calls
    `spirit.elements[create].create(box, options)` and keeps what it answered (its destroy).
  - JSON holds no function, so in the options `{ "answers": X }` is a function that answers X (the grants panel's
    search, grant, revoke and stream), and `{ "page": "api" }` is the page's api.
  - The grants panel's is `shell/js/test/grantsPanel-headLessBrowser.json`; its old name,
    `grantsPanel-boot-sibling-generalRules.json`, is gone.
- It reports on `window.spiritMount`:
  - `state`: `loading`, then `mounted` or `failed`;
  - `error`: why it failed;
  - `box`: the mount box;
  - `destroy`: for an element, what its create answered as destroy.

## Requirements: what it judges per file

- **It loads by itself:**
  - the node answers the DEBUG page for the file;
  - the file mounts on the bare page;
  - nothing it runs throws;
  - every file it asks for is there: no file request answers 4xx or fails. The door's answers and the browser's own
    favicon request are not files the page asked for;
  - it says no error on the console.
- **It draws**: its box holds something, of a height.
- **Every list in a box of a stated size (rule/16)**:
  - every tool and tab button it draws (`[data-tool]`, `[data-tab]`) is pressed in turn, so each list it can show is
    made;
  - judged by the layout, not by names: every box it drew that scrolls (overflow `auto` or `scroll`) and is shown is
    given far more than it can hold (a child 5000px tall, taken out again), and keeps its height, inside the mount box,
    the mount box not overflowing. A box only as tall as its content, anywhere above a list, lets the list grow with it.
    A dropdown's list is hidden until it opens, and is not asked;
  - the box never grows past its height, and the page never scrolls sideways.
- **Destroy**: an element's destroy leaves its box empty. An app is closed by the face and has none of its own.

## What its test must try to break

- A file that mounts only because the page preloaded something.
- A file that asks for a file that is not there, throws, or logs an error.
- A list in a box only as tall as its content, anywhere between it and the app.
- A destroy that leaves what it drew.
