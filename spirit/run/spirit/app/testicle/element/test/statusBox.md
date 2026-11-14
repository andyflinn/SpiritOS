# spirit/app/testicle/element/statusBox.js

The monitor row of testicle's face with its status box, an element of its own (goal/G47.1, box v134-135: *"every part of
testicle's face is an element of its own"*, *"element/statusBox.js (the monitor row with its status box)"*). It was
`monitorRow` in `../element.js`. Its test: `./statusBox.js`.

    spirit.element.spirit.app.testicle.element.statusBox.create(container) -> { destroy() }

## What it does

- **It loads its own parts** (rule/26; Andy: *"the fucking status box must require the fucking api and make sure the fucking
  data.js is installed"*): the icon element, `spirit/data.js`, testicle's `api.js` and testicle's cache manager (`data.js`,
  which the page's one stream feeds). Mounted alone, it gets its data by itself.
- **Its box:** one `.testicle-status` row into its container, of a constant height (1.8em), one line, its overflow hidden, the
  message ellipsed and never wrapped (the box: *"The row has a constant height, and the message is ellipsed, never
  wrapped"*).
- **The mode first** (box v80, 2: *"🤖 auto / 🖖 interactive, ahead of the 🛌/🚶‍➡️ icon, from the stream"*): from testicle's
  preferences, asked once, then followed in the branch the stream keeps.
- **The busy icon:** 🛌 idle, 🚶‍➡️ working, drawn through the icon element, from the stream's monitor; its title says idle or
  working.
- **The line**, the first of these that has words:
  - **each suite as it reports** (box v134-135: *"knows which suite is running and for which scripts, and shows "<x> of <n>
    reported: <script> <success|failure>""*): the stream's `monitor.running` names the suite, its scripts and when it
    started; every suite row of that suite and one of those scripts set since the start (its outcome green or red) is one
    reported, the newest named with its outcome. A run seen for the first time asks `testicle.suite.search` once for each
    of its scripts, so a box mounted mid-run counts those that reported before it was there;
  - **what the server is doing** (Andy: *"do that"*): the monitor's `doing`, while it classifies or tests;
  - **the last change:** the monitor's last row change, in words, a test row's flip left off.
- **destroy()** stops its watches and leaves its container empty.

## What its test judges

On a real testicle, nothing fed by hand (box v142): a scratch lab node with testicle on, the box mounted alone on a page
that loaded it by itself; one box with the mode, the busy icon and the line; the mode the node answers (🖖, interactive);
🚶‍➡️ and what it was doing while testicle classified the tree, as the stream said; 🛌 once idle; two planted scripts with their
own tests pressed, one holding and one failing, each shown *"1 of 1 reported: <script> <success|failure>"* as testicle
streams it; the node set to auto and back, 🤖 then 🖖 by itself (box v143, *"subscribe to the data they display"*);
overflow hidden, one line, the message ellipsed; destroyed, an empty container.

Not judged by it yet: the last change in words (shown when nothing runs and nothing is being done).
