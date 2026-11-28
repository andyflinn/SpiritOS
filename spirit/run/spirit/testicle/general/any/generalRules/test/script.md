# The general rules module

goal/G49.27, step 2a. Its test is `./script.js`; the module is `../script.js`, the part `generalRules` of the old -general runner of spirit/test/ (its tree rules with it) moved into a rule module.

The box: *"Each module has its own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red."*

## Requirements

- It hands out `{ appliesTo, resource, own, forbids, checks }`: resource `node`, own `false` (its node checks use the run's one shared scratch node).
- On a planted run, a product script with `'use strict'` that takes spirit first keeps *"it starts with 'use strict', takes spirit first, and loads the tree only through spirit.requireScript"*; one that starts with a plain require is red on it. Only that title's body runs, so no node is started.

## The runner judging the general rules in a scratch tree

goal/G47.1; folded here from `spirit/test/test/spirit-sibling-general.js` (goal/G49.27: one test file per module). A scratch copy of the tracked files of spirit/run, in a git index of its own, with the planted scripts below; the old -general runner of spirit/test/ runs there as its own process, handed one planted script, and the verdict of one of this module's titles is read from what it prints.

### The module rule

Moved from `spirit/test/script.js` (Andy: *"11. is script-sibling-general"*). A planted `spirit/zzGarbage/late.js` requires `fs` before `spirit.js`.

- Handed `spirit/script.js`, "it sets the global spirit before its first require" is green.
- Handed `late.js`, "it requires spirit.js first" is red, under that script.

### What it changes, it listens for, through a child on a branch

wsl, of the model table: *"the list it mounts ... is what shows the result, so it does listen, through its child"*; cw: *"A child it mounts on a branch counts as its listening"*. Three planted elements in `spirit/element/zzListen/`: `child.js`, which loads the search element and makes its search on a branch worked out from the name it is handed; `writer.js`, which writes, requires `child.js` and hands it a branch by name; and `deaf.js`, which writes and has no watch, no search and no child.

- Handed `writer.js`, "it sends writes and watches the store" is green.
- Handed `deaf.js`, the same check is red.

### Nothing on the global object or on process but spirit

Andy: *"no developer will want to use a system that pollutes global name-spaces."*, *"go on this"*. Two planted node scripts in `spirit/zzGlobal/`: `leaky.js`, which assigns `global.zzLeaked`, and `clean.js`, which hands out its value through `module.exports` alone. The runner is handed the scratch tree as its run, as testicle hands one (`SPIRIT_MOUNT_RUN`).

- Handed `leaky.js`, "loaded in a node, it adds nothing to the global object or to process but spirit" is red, under that script.
- Handed `clean.js`, the same check is green.

### No temp path of its own

The box: *"nothing else builds a temp path"*. A planted `spirit/zzGlobal/ownTemp.js` calls the system temp folder itself.

- Handed `ownTemp.js`, "it builds no temp path of its own: its temp folder comes from spirit/tempFolder/script.js" is red, under that script.
- Handed `clean.js`, the same check is green.

## Its contract, as the old runner's spec said it (moved here, goal/G49.27, step 3: the runners of spirit/testicle/run/ have no part of their own)

### generalRules (was script-sibling-generalRules.js; its file-reading checks are this part, its node checks spirit/testicle/general/node/placeRules/script.js, its page checks spirit/testicle/general/browser/pageRules/script.js)

Given no file, the tree's rules: no module names spirit/run/process; elements placed by the loader alone and
none reading spirit.elements; run://test/ moved into run://spirit/test/ and named nowhere; testModule.js listing no tool as
a test; .gitignore covering run:// but run://spirit/; every product script holding the shape, taking spirit.js first,
its require paths within the rule; every file that paints icons loading the icon element. Given a file, its code: no
spirit/run/process named; the shape; spirit.js first (or page code, or spirit.js itself); loaded alone in a node (a product script that is no page code, the node and the relay
themselves never loaded), nothing on the global object or on process but spirit, a new name there counted against the
script when its own code assigns it (goal/G47.1; Andy: *"no developer will want to use a system that pollutes global
name-spaces."*; severity 0.7, Andy: *"name-space pollution is 0.7"*; the page side is spirit/testicle/general/browser/pageRules/script.js's); no temp path of its own, no call of the system temp folder in its code, its temp
folder from spirit/tempFolder/script.js (the box: *"nothing else builds a temp path"*), the helper, its own test and the lab's own
test, which reads the temp folder's top to find no copy of the tree there, the three that may; its require paths; for an
element, no matched() of its own, its writes watched in spirit.required.spirit.data (a watch of its own, a search on a branch, or a child element it requires that searches a branch,
handed the branch by name), no api taken from what it is handed. Its full
contract, page parts included, is in `spirit/testicle/general/browser/pageRules/script.js`.

### The desk's verifier deleted (goal/G47.1, box v101)

- Over the whole repository, the files outside `spirit/run` too: no tracked file names the deleted verifier, by path or by
  content, in any case. One check, severity 0.4, naming the files that still do. The test builds the name, so it names it
  nowhere itself.

### The elements' old homes

The element move's rules (goal/G43.5), here since goal/G47.1 (Andy: *"1, 2 and 3 Belong in spirit/test/script.js"*, *"the rest belong in motherfucking script-sibling-general/browser/node respectively"*). They judge files, so a red lands on the file at fault. Handed a file, that file; handed nothing, every file git tracks under `spirit/`, code, tests and documents, vendored code and the general tests' own files left out.

Andy, the move's box: *"We are ONLY moving the contents of "run://shell/js/" to "run://spirit/element/""*, *"both file-location AND the home in spirit.required (singular)"*, *"uncluding tests"*.

- No file names `shell/js`.
- No file reaches an element through `spirit.elements`.
- No code reaches through `spirit.required` for an element the tree does not hold: since goal/G43.32 every element stands at `spirit.required.<its path>`, so `spirit.required.<keys>` is a script `<keys>.js` or a folder `<keys>/` of the tree, its members after it. No element is named in the test; the tree answers. Found live: *"contact detail don't load in contacts"*.
- Andy's own words are never rewritten: a double-quoted part of a comment or a document is left out, a quote over several lines too.

That every element loads on a page and stands at `spirit.required.<its path>` is `spirit/testicle/general/browser/pageRules/script.js`'s, over every element script of the tree. The old move's fixed lists of files and names are dropped: they went stale when the files moved again.


### Moved from the scripts' own tests (goal/G47.1)

Rules that read every file, once in one script's test, so their red landed on that script. Each is said over the tree, and on a file handed.

- **Every `spirit.requireScript` of a written path names a file that exists.** Andy: *"every spirit.requireScript of a written path names a file that exists"*, in place of search.js's list of old paths: read from the code, so a require that runs only on a click is judged too. `spirit.requireScript('<path>')`, and a list of written paths a require is mapped over.
- **No tracked file of the repository names `spirit/run/node_modules`, and `.gitignore` keeps no exception for it** (goal/G43.25, from `../job/engine/test/script.js`). The suites that compare the libraries with the commit before their move name it on purpose.
- **No `<verb>.warning.txt` is left** (goal/G43.27, from `spirit/element/search/grant/grantsPanel/test/script.js`). Andy: *"compare that to giving a linux user root authority, he then can fuck up the whole system, not our problem."*
- **Under `spirit/element/search/` every name is a word, and every folder sits beside its `<name>.js`** (goal/G43.18, from `spirit/element/search/test/script.js`). Andy: *"all "probabilitySearch" elements follow the EXACT SAME PATTERN."*
- `spirit.elements` is judged in code only, string insides left out: a test may name it to say it is gone.
- **A search's parts are named by their word** (goal/G47.4, the box: *"A search's parts are named by their word: list.js, row.js and detail.js, in place of list.js, row.js and detail.js"*; *"The guard first: the general test is red on any file named list.js, row.js or detail.js, and on any code that still names them"*): every script under `spirit/` (vendored folders aside) is red if its file is named `list.js`, `row.js` or `detail.js`, and red if its code names any of the three: read with its strings kept, so a require path or a place on the spirit object counts, and its comments left out. Its own titles build the old names from their parts, so this suite does not name them in code.
- **The search branch** (goal/G47.4, box v9: *"spirit/search/ is a branch whose js api is two searches and nothing else: string, at spirit/search/string, and object, at spirit/search/object"*; the two probability match files at the root go, and *"nothing names the old files after the move"*; the bucket becomes the helper `spirit/listLimiter/script.js`): every script under `spirit/` is red if its file keeps one of the three old names, and red if its code names one of the old files (strings kept, so a require path counts; comments left out). The functions keep their names, so a call of one is no old file. Its titles build the old names from their parts.
