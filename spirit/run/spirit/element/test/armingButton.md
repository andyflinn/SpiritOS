# spirit/element/armingButton.js

The are-you-sure button (goal/G41.9; Andy: "create shell-element \"armingButton\" with test folders and all"). One
element for every two-press confirm in the shell, in place of the copies each app hand-rolled. The rule it carries is
the shell's: UI_DESIGN_STYLE.md, "An armed button disarms the moment attention moves" (Andy, 2026-09-17: "whenever i
click anywhere else on the screen ... the button must reset, back to its original state, and the whole are-you-sure
procedure must be done from scratch").

## API

`window.spirit.element.armingButton.attach(button, { label, armedLabel, run })` makes a button already in the
page an arming one, and answers it, carrying `disarm()` and `armed()`. Most apps draw their buttons as markup and draw
them again on every change; they attach after each draw. A button drawn again is a new button, unarmed.

`window.spirit.element.armingButton.create(container, { label, armedLabel, run, title, className })` is `attach`
on a new `<button type="button">`, its title and class put on it, appended to the container (box v23: *"every element
gets a container and appends itself"*).

- `label` what it says unarmed (for `attach`, by default the button's own text); `armedLabel` what it says armed, by default `<label>? Press again`.
- `run()` what the second press does.
- `title`, `className` put on the button as they are.

## Requirements

- **The first press arms it** and runs nothing: the button carries `data-armed` (the shell paints it red,
  shell.css) and says `armedLabel`; armed, it listens for clicks on the document itself.
- **The second press runs it**: it disarms first, then calls `run()` once.
- **A click anywhere else puts it back**, heard by the button itself (goal/G43.24; Andy: *"every element that accesses ANY
  api must require them themselves ... that way anybody can mount any element without knowing what it actually
  needs...."*): armed, it adds a click listener to the document, which disarms it on any click but the press that armed
  it and one on the button; disarmed, it removes it. Unarmed, its label again, no `data-armed`; the next press arms again
  from scratch. No shell hook is handed to it: mounted with its container alone it does all of this.
- **One loaded at a time is the element's** (UI_DESIGN_STYLE.md left it to each app): arming one disarms any other
  armingButton armed before it.
- **Its disarm is harmless twice.**
- `armed()` says whether it is armed; `disarm()` puts it back from the app's side (a screen opened on a new subject).

- **A button says what it does before it is pressed** (goal/G41.30; Andy: *"the button for that has nothing written on it"*):
  `attach` with a `label`, on a button drawn empty, shows that label at once.

## What its test must try to break

- A made button not appended to its container.
- A single press that runs; a second press that runs twice or not at all.
- A disarm that leaves it red, or the armed wording behind.
- Two buttons armed at once.
- A listener left on the document once it is disarmed; a confirming press that the click elsewhere eats.
- A disarm called twice that throws or re-arms.
