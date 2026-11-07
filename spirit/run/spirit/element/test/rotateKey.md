# spirit/element/rotateKey.js

The rotate key dialog, an element (goal/G43.24, requirement 8; cycle-10/R13): what rotating this node's cipher key does
and costs, then one two-press button that does it. A crisis measure (Andy, 2026-09-26: *"so rotation is a crisis.measure
and should not be used wastefully"*, *"it must be made available in a portion of the UI with the are-you-sure
mechanism"*). nodeInfo opens it as a layer over Info through panel.js, as file opens fstat (Andy: *"it's just a panel
that opens exactly overtop of the calling panel, new-shell-style."*, *"like fstat"*); that opening is judged in
`./nodeInfo.js` and on a real page in `./nodeInfoRotate.js`. Its test is `./rotateKey.js`.

## Requirements

- **Mounted the new shell's way**: it sets `spirit.elements.rotateKey = { create(container) -> { destroy() } }`, mounted
  with its container alone. No
  `spirit.shell.activateApp`, no `callDialog` or `closeDialog` of the old shell.
- **What it needs, it gets itself** (Andy: *"every fucking element gets the interfaces it needs"*): the rotation is the
  node family's own verb, `spirit.node.rotateCipher({})`, its answer read through `spirit.outcome`; no `api.verb`.
- **It loads `spirit/element/armingButton.js` itself**, through `spirit.require` (rule/26).
- **Its explanation first, as it is**: its title *Rotate this node's cipher key*; *When to use it*, *What it does*, *What
  it costs*, *What it does not do*, each in the dialog's words; and *It is a crisis measure, not a routine one.* Then its
  button.
- **Its button is the shell's armingButton** (goal/G41.9): `armingButton.attach`, saying `Rotate the key`, armed
  `Rotate the key: press again`; it is handed no api and hands none on (goal/G43.24): the button hears a click elsewhere
  itself, listening on the document while armed. The first
  press only arms it and asks nothing; disarmed, the next press arms it again; the second press in a row runs.
- **Its run asks `spirit.node.rotateCipher({})` once.** While the node has not answered, the button is drawn disabled.
  Answered, it says *Rotated* and *This node's card is now number &lt;at&gt;, handed to &lt;relays&gt; relay(s).*, the
  explanation staying and the button gone. A refusal is said in the node's words (its error, else its code), escaped
  with `spirit.escapeHtml`, and the button is back, disarmed; no answer at all is said as *no answer*.
- **Every create starts disarmed and without an old result**: two presses must mean two presses in this visit.
- **Nothing hand-rolled**: no `data-armed`, no call to `armUntilElsewhere`, no armed flag (`rkArmed`) or armed class of
  its own.
- `destroy()` empties its container; destroyed before the arming button loads, it attaches nothing.

## What its test must try to break

- A Rotate that is not an arming button, loses today's wording, or does not pass the api on.
- One press that rotates, or a run that rotates more than once, or a press on the disabled button while waiting.
- A result or refusal not said, a refusal not escaped, or a result left over into the next create.
- The explanation's words changed or gone.
- An `api` (an `api.verb`, one handed on), an `activateApp`, `data-armed` or `armUntilElsewhere` back in the file.
