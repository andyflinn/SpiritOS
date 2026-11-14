# spirit/app/testicle/element/settingsPanel.js

The ⚙ settings panel of testicle's face, an element of its own (goal/G47.1, box v134-135: *"every part of testicle's face is
an element of its own"*, *"element/settingsPanel.js (the ⚙ settings panel)"*). It was `configPanel` in `../element.js`. Its
test: `./settingsPanel.js`.

    spirit.element.spirit.app.testicle.element.settingsPanel.create(container) -> { destroy() }

## What it does

- **It loads its own parts** (rule/26): the toggle row `spirit/element/search/app/rowFormToggle.js` and testicle's `api.js`,
  then testicle's cache manager (`data.js`). A node with no testicle refuses the interface: the panel says so below its form;
  the refusal is never left unhandled.
- **Its box:** one `.testicle-config` into its container, its overflow not visible, titled *"⚙ Configuration"* (box v79, 2:
  *"this icon will open a panel in the left workbech pane, titled: "⚙ Configuration""*).
- **One switch, interactive | auto** (box v79, 2: *"the one switch it maintains in a rowForm is: interactive | auto where the
  default will be "interactive""*): a `rowFormToggle`, on for interactive, off for auto. It shows the preference
  `interactive`: asked of `testicle.preferences` once and kept in testicle's branch, then followed there as the stream keeps
  it.
- **No save** (box v80, 2: *"a change is sent to the server at once, and the server streams it back, which sets the
  switch"*): a press sends the other mode by `testicle.preferences({ interactive })`; the switch moves only when the stream
  brings the change back. A refusal is said below the form.
- **destroy()** stops its watch and leaves its container empty.

## What its test judges

On a scratch lab node with its DEBUG on and testicle on, the panel loaded by itself and mounted: its title *"⚙
Configuration"*; the switch at interactive at the start, as the node's preference; a press sends auto, the node is auto and
the switch follows the stream; a second press sends interactive back; overflow not visible; destroyed, an empty container.

Not judged by it yet: a refusal said below the form.
