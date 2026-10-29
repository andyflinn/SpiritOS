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
- It opens the node's **bare mount page**, `shell/mount.html?file=<file>`, and judges what the page reports and the real
  layout it drew. It takes seconds per file, so it belongs to the general rules and not to an item's red.

## The bare mount page it needs: `shell/mount.html`

The node's own page for mounting one shell file alone. Not built yet: today every file is red on its first check.

- It loads `/shell.css` and `/spirit.js`, and nothing else of the shell. Its body holds one box of the whole page,
  `#mount-box`, of class `fill`.
- It starts the spirit object (`spirit.start()`), then requires the one file named by `?file=` through
  `spirit.require`. Nothing is preloaded (rule/26: every element loads its own parts via spirit.require), so a file that
  uses a part it did not require fails here.
- **An app** (it calls `spirit.shell.activateApp`) is mounted into the box with an api as the face gives an app.
- **An element** is mounted by the file beside its tests that names how (Andy: *"so the test folder needs a
  <module>-shell-child-<testname>.json if it has special call or mount requirements for that test?"*, and *"i proposed
  making it a json file."*): `<its folder>/test/<its name>-boot-sibling-generalRules.json`, named after the module and
  the general test that reads it. It is JSON, not a script: `testModule.js` runs every `.js` in a test folder as a test.
  - `{ "create": "<the element's name on spirit.elements>", "options": { ... } }`: the page calls
    `spirit.elements[create].create(box, options)` and keeps what it answered (its destroy).
  - JSON holds no function, so in the options `{ "answers": X }` is a function that answers X (the grants panel's
    search, grant, revoke and stream), and `{ "page": "api" }` is the page's api.
  - An element without such a file does not mount, and says so.
- It reports on `window.spiritMount`:
  - `state`: `loading`, then `mounted` or `failed`;
  - `error`: why it failed;
  - `box`: the mount box;
  - `panes`: the box of every list made in pane mode (each `probabilitySearch.create` that is not a dropdown);
  - `destroy`: for an element, what its create answered as destroy.

## Requirements: what it judges per file

- **It loads by itself:**
  - the node serves `shell/mount.html`;
  - the file mounts on the bare page;
  - nothing it runs throws;
  - every file it asks for is there: no file request answers 4xx or fails. The door's answers and the browser's own
    favicon request are not files the page asked for;
  - it says no error on the console.
- **It draws**: its box holds something, of a height.
- **Every list in a box of a stated size (rule/16)**:
  - every tool and tab button it draws (`[data-tool]`, `[data-tab]`) is pressed in turn, so each list it can show is
    made;
  - every list box the page kept, and each box from it up to the mount box, is of class `fill`;
  - the list lies inside the mount box;
  - the box never grows past its height, and the page never scrolls sideways.
- **Destroy**: an element's destroy leaves its box empty. An app is closed by the face and has none of its own.

## What its test must try to break

- A file that mounts only because the page preloaded something.
- A file that asks for a file that is not there, throws, or logs an error.
- A list in a box only as tall as its content, anywhere between it and the app. Tried on `shell/agent/agent.js` with a
  throwaway mount page: green on all 9. With the workBench's side pane without `fill`, the five lists went red at
  `div#wb1-pane-left`.
- A destroy that leaves what it drew.
