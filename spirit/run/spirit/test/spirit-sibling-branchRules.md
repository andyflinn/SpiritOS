# spirit-sibling-branchRules.js

Every rule of a branch, judged on each branch folder (goal/G43.32). A general test beside `spirit.js`, outside every
branch. Run once per branch folder, the folder its argument; given none, every branch:

    node spirit/test/spirit-sibling-branchRules.js spirit/app/desk

Andy: *"make sure nobody can add an app implementing a family, without adhering to the rules, this means that a test
outside of each branch must assert this."*, *"such a general test must therefore "recognize" a branch folder, and assert
all rulers relating to branches."*, *"would that not actually be a general test spirit-sibling-branchRules?"*, and to Q7:
*"branch test only needs to associate a failure with either spirit/<name>/ or spirit/app/<name>/"*.

It took in, per branch, the branch rules of five tests (Q6: *"absolutely, AND MAKE SURE NO TEST GETS LOST."*):
`spirit-familyFinder.js`, `data-caches.js`, `apiDoor-familyGate.js`, `server-appFamily.js`,
`introSpector-branchVerbs.js`. What judges no branch stayed with the test of the module it judges: `./data-caches.js`
(the data set, `spirit/data.js`) and `./spirit-familyFinder.js` (the finder, on planted folders); the other three are
gone. From `./app.js`: that an app's description names its icon and label. A scratch node; never a live one.

## Requirements

### A branch folder, recognized

- **By its folder** (`testModule.js` `branchesOf`; Andy: *"app-branches are easily identified using the patterns:
  spirit/app/<name>/<name>.js, spirit/app/<name>/<name>.json"*, *"and system branches by: spirit.<name>.api.js &&
  spirit.<name>.data.js"*): a system branch is `spirit/<name>/` holding `api.js` and `data.js`, `spirit/app/` among them
  (the branch `app`); an app branch is `spirit/app/<name>/` holding `<name>.js` and `<name>.json`. A test folder is none.
- **`testModule.js` gives it one entry per branch folder**, and on a blast radius the deepest branch holding the file
  (`spirit/app/desk/desk.js` is `spirit/app/desk`'s, not `spirit/app`'s). A module in no branch gets none.
- **Every check is named by its branch folder** or a file in it. A folder given that is no branch is red.
- **The tree is every file git keeps and every file not yet added that git does not ignore**, so a new app's branch is
  judged before it is committed.
- Given no folder, it must have found over 20 branches, desk's and fs's among them.

### Its interface, where it holds an api.js

- **Its verb rules live in its `api.js`** (decided 7): it loads, and declares each verb as its arguments and their rules.
- **It stands where its family is found** (goal/G43.27, the fewest path elements): `spirit.familyPath(<name>)` is its
  `api.js`; and **no other `<name>/api.js` is in the tree** (`spirit/<name>/`, `spirit/app/<name>/`,
  `process/js/<name>/[family/]`; Andy: *"duplicate <name>/api.js raise a red."*).
- **Required on the node it is placed and binds** (decided 8: *"A branch's api.js is placed at
  spirit.required.spirit.<branch-path>.api and also binds the branch."*): in a process of its own, `spirit.require` of it
  leaves the `api.js` at `spirit.required.<its path>`, and binds every verb it declares on `spirit.<name>`, under the name
  its `functions` gives it if any (`spirit/app/api.js`: `search` is `searchApp`).

### An app branch's description

- **`<name>.json` names `identity.icon` and `identity.label`** (`AGENT.md`, an app: *"each described by its own
  <name>/<name>.json"*; Andy, box: *"containing identity:icon and identity:label"*).
- **It has no `kind` or `operated`**: the node operates the server (`./appServer-mount.md`).
- **Its name is no verb of the app family** (Andy, box: *"spirit.app also holds the family's verb, search, so no app may
  take the name of a verb."*).

### Its cache, where it holds a data.js

Andy, on G41.28: *"WSL, make sure you assert that every family in the api tree HAS a clientCacheManager, AND the a
node.js Process like DeskClient uses the Exact same code as the browser for the cache management. The only difference
is the appServer serializes the cache to disk."*

- **A branch with an interface has its `data.js`** in its own folder.
- **Its branches are named by it alone**: the names it gives `var` constants (`var ITEMS = 'desk'`); no other file hands a
  path of them to a `spirit.data` reader or writer (`D.get('desk/' + id)`).
- **It touches no file and no browser storage**: no `fs` or `path`, no file read or written, no browser storage.
- **It makes the branch of its folder's name** (goal/G43.31; Andy: *"The BRANCH name (FUCK THE TERM "Family"!!!!!!!!!!!!) is
  motherfucking <name> in spirit/app/<name>...."*, *"make sure, IN THIS ITEM that family names MATCH folder names"*):
  `makeFamily('<name>')`, `<name>` its folder's (from `./spirit-sibling-generalRules.js`).
- **One contract**: it loads, exports cache rules only as an object, and stands at `spirit.data.<name>` through
  `spirit.data.makeFamily`, the name it hands `makeFamily`.
- **A branch's watch is called `watch`** (Andy: *"that's a decision: a BRANCHE's what is called "watch""*, *"the branch is
  already implied in it's containing object."*, *"wsl, assert this in a test for branches."*): every object its reads hold
  names no member `watch` and more (`watchFile`, `watchApp`, `watchRow` are the names it replaces), and no `watch` takes
  more than the function and the row it narrows to.

### On a node, where it holds an api.js

A scratch node; an app branch switched on first (`app.active`), as its server must run to serve it.

- **The node's api tree holds it**, and **the interface it serves for it is its own `api.js`** (goal/G43.27, requirement 2:
  server.js familyDir looks for `spirit/app/<name>/api.js`; appServer.js takes the app folder itself as the family folder).
- **It serves exactly the verbs its `api.js` declares** (goal/G43.20; Andy: *"IN THIS ONE, OR WE'LL NEVER GET FUCKING
  DONE."*, *"WSL, NOTE AND ASSERT THIS IN YOUR TESTS, IN THE PROPER PLACE, DILIGENTLY WITHOUT FUCKING CHEATING."*), beyond it
  only what was decided: appServer's `DEBUG` (desk/G2.5: *"DEBUG auto-verb supplied by appServer is approved."*), and desk's
  `item.rules.add` and `item.rules.remove` (goal/G40.12). **No FS set** among them.
- **Every broken call is refused at the door** (goal/G41.30; Andy: *"this needs fixing in this item."*; an app's in its own
  process, decided 9): from its declaration, a raw call over http breaks each verb's arguments three ways, an argument of
  the wrong type, a required one left out, one the verb does not name; each answers a 4xx with a `code`, never a 2xx, a
  5xx, a handler failed, or no answer within 8 s. A branch that declares no verb has no call to break, and says so.
- **Found by its name, on a page**: a page asking `spirit.cacheManager(<name>)` gets its own `data.js`, and asks no
  `data.js` of that name that is not there (no 404); **the node serves it as a script that calls `makeFamily`**.

## What its test must try to break

- A new app, not yet committed, whose branch breaks a rule; a folder given that is no branch.
- An `api.js` that does not load or declares no verbs; one no finder reaches; a second of the name; one not placed at
  `spirit.required.<its path>` on the node, or a verb left unbound.
- A description without its icon or label, with `kind` or `operated`, or an app named as a verb of the app family.
- A branch named otherwise than its folder (`chatClerver` in `spirit/app/chat/`); a branch with an interface and no `data.js`; a branch's path named outside its manager; a manager keeping its cache on
  disk or in browser storage; a manager without the contract; a watch of another name, or told its branch.
- A branch the node does not serve, serves from another file, serves with a verb more or less, or with an FS set.
- A handler reached by a call its own declaration refuses.
- A page that cannot find a branch's manager by its name; a manager the node does not serve.
