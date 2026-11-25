# spirit/app/testicle/element/statusBox.js

The monitor row of testicle's face with its status box, an element of its own (goal/G47.1, box v134-135: *"every part of
testicle's face is an element of its own"*, *"element/statusBox.js (the monitor row with its status box)"*). It was
`monitorRow` in `../element.js`. Its test: `./statusBox.js`.

    spirit.required.spirit.app.testicle.element.statusBox.create(container) -> { destroy() }

## What it does

- **It loads its own parts** (rule/26; Andy: *"the fucking status box must require the fucking api and make sure the fucking
  data.js is installed"*): the icon element, `spirit/data/script.js`, testicle's `api.js` and testicle's cache manager (`data.js`,
  which the page's one stream feeds). Mounted alone, it gets its data by itself.
- **Its box:** one `.testicle-status` into its container, its overflow hidden: an inline block of the status icons on the left
  (`.testicle-icons`), then an inline block of two rows on top of each other (`.testicle-rows`, two `.testicle-row`), each
  one line, ellipsed (goal/G47.4, the box, ### status bar: *"the status icons in an inline block on the left edge; after it,
  a second inline block of two rows on top of each other, so the icons get the extra height."*).
- **The mode first** (box v80, 2: *"🤖 auto / 🖖 interactive, ahead of the 🛌/🚶‍➡️ icon, from the stream"*): from testicle's
  preferences, asked once, then followed in the branch the stream keeps.
- **The busy icon:** 🛌 idle, 🚶‍➡️ working, drawn through the icon element, from the stream's monitor; its title says idle or
  working.
- **Row 1:** *"<suites owed>: <suite file name>"*: suites owed as testicle streams it (suites marked needs running, in the
  current run or not, a suite counted once), and the running suite. **Row 2:** *"<tests reported>: <script file name>"*,
  counting up as the running suite reports. During classification row 1 names the classifier's file and row 2 reads
  *"<n> of <total>"* and the script, n counting up. The numbers are related info, *"watching water boil"*.
- **In a bubble** (Andy: *"the whole status block in a bubble, the icons vertically centered in that bubble."*): the box is
  the shared `.shell-bubble`, the icons centred in its height.
- **Sized** (Andy: *"the icons must be of size 2em. the two numbers, starting the two rows must be fixed width, 6em, right
  aligned, and invisible when zero."*, then *"a width of 4em for the two numbers is likely enough."*): the icons at 2em;
  each row's number in a box of its own (`.testicle-num`), 4em
  wide, right aligned, hidden at zero with its room kept, its words after it (`.testicle-words`).
- **No test titles and no results** of suites or tests in the bar; **both rows empty** when no run is active.
- **The stream:** suites owed and classifications owed, sent when either changes and once to a page as it connects; while
  classifying, the running message names the classifier, its total and its count; no doing text.
- **destroy()** stops its watches and leaves its container empty.

## What its test judges

On a real testicle, nothing fed by hand (box v142): a scratch lab node with testicle on, the box mounted alone on a page
that loaded it by itself; one box with the mode and the busy icon; the icons in a block on the left and two rows stacked
right of it; the mode the node answers (🖖, interactive); 🚶‍➡️ while testicle classified the tree, row 1 naming the classifier
and row 2 counting *"<n> of <total>"* up; 🛌 and both rows empty once idle; two planted scripts with their own tests pressed,
one holding and one failing: row 1 their suite, row 2 the tests reported (1) and their script, never a title or a result,
both rows empty after; no doing text from the stream; the whole block one shared bubble, the icons vertically centred in it; the icons at twice the container's font size; every row drawn
beginning with its number in an element of its own, 4em wide, right aligned, a zero never seen and any other number seen; overflow hidden, each row one line, ellipsed; the node set to auto and
back, 🤖 then 🖖 by itself (box v143); in auto mode row 1's number equal to the suites testicle's database holds marked, and
following them down as suites report; a page loaded anew while nothing changes holding suites owed and classifications owed
as the database says them; destroyed, an empty container.
