# spirit/app/testicle/element/scriptDetail.js

The script tab's file detail of testicle's face, an element of its own (goal/G47.1, box v134-135: *"every part of testicle's
face is an element of its own, just spirit/app/testicle/element/<element-name>.js"*, *"element/scriptDetail.js (the script
tab's file detail)"*). It was `fileDetail` in `../element.js`. Its test: `./scriptDetail.js`.

    spirit.element.spirit.app.testicle.element.scriptDetail.create(container, { script }) -> { destroy() }

## What it does

- **It loads its own parts** (box v142: *"all of testicle's elements must subscribe to the data they display"*; rule/26):
  testicle's `api.js` and its cache manager (`data.js`, which the page's one stream feeds), the suite search
  `spirit/app/testicle/element/search/suite.js` it draws with, and `installSpiritElement`, by which it places itself at
  `spirit.element.spirit.app.testicle.element.scriptDetail`. Mounted alone, on a page nothing else loaded them on, it has
  them. A node with no testicle refuses the interface; that refusal is never left unhandled.
- **Its box:** one `.testicle-detail` into its container, with a title line, a line for the own test, and the part below.
  It keeps what it holds inside: its overflow is not visible (the box: *"an element container always must constrain its
  children's display to its own size"*).
- **No script:** it draws its empty box, an empty title, and asks nothing.
- **A script:** the title line is the script's full path (the box: *"The detail shows as title row the full file name"*).
  Then `testicle.script.get` is asked for it, and below the title it shows either the error `script.get` gives (*"not a
  production script"*, *"no such file"*) and no search, or the suite search of that script (`search/suite.js` mounted with
  `{ script }`).
- **The own test, in red when missing** (the box: *"A script tab shows, right under its title line, the name of the
  script's own test in red when that test is missing on disc: the folder test/ beside the script, the same file name"*,
  *"When the own test is there, nothing shows in that place"*): read from the fs family's mirror of the tree
  (`spirit.data.fs`), only once the tree is whole, and drawn again as the mirror changes that path.
- **destroy()** stops its watch of the mirror, destroys the suite search it mounted, and leaves its container empty; an
  answer that arrives after it is ignored.

## What its test judges

On a scratch lab node with its DEBUG on and testicle on, the element loaded by itself on a page: it exists; with no script
the empty box and no ask; with a production script its title, then the suite search below once `script.get` answered; a name
that is no production script, the error below and no search; overflow not visible; destroyed, an empty container.

Not judged by it yet: the own test's line in red (missing own test, and nothing shown when it is there).
