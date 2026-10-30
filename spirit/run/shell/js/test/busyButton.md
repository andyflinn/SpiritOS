# shell/js/busyButton.js

The button that waits for its request (goal/G41.23). Andy, goal/G41.18, 2026-10-29: *"i need a new shell element:
busySpinnerButton or someting. it has an animated icon showing to the left of the buttons label, when the button is
waiting for somekind of completion...."*, and *"this is for all buttons that wait for potentially long requests, that
have no progress bar ability..."*. Its test is `./busyButton.js`.

## API

Made the way armingButton is (`shell/js/armingButton.js`):

`window.spirit.elements.busyButton.attach(button, { run })` makes a button already in the page a busy one, and answers
it. Its label is its own text.

`window.spirit.elements.busyButton.create(container, { label, run, title, className })` is `attach` on a new
`<button type="button">`, its label, title and class put on it, appended to the container (goal/G41.19: *"every element
gets a container and appends itself"*).

- `run()` the request a press makes. It answers a promise, or a value, or throws.

## Requirements

- **Pressed, it greys out and turns**: the press runs `run()` once; the button is `disabled` while it waits, and an
  element shows left of its label, turning, the label still said.
- **The turn is shell.css's**, the one sheet, so every app spins the same: the icon's animation is a keyframes rule of
  `/shell.css`; the element adds no sheet and no style of its own.
- **A second press while it waits does nothing**, so no request is sent twice (Andy, goal/G41.23: *"yes."*): not by a
  click, and not by a click event a script dispatches.
- **Answered, it is a plain button again**: success or refusal (the promise rejects), a throw as `run` is called, or a
  value that is no promise: enabled, no element in it, its label alone. The next press runs it again.
- **A refusal and a throw reach no further** than the button: nothing unhandled in the page. Saying the refusal is
  the app's, in its own request.

Asked of a real browser, since an icon left of a label is layout and its turn an animation: `./busyButton-pressed.html`,
opened at `/DEBUG/shell/js/test/busyButton-pressed.html` on a scratch node with its DEBUG on (`test/headLessChrome.js`).

## First users

Ask in the agent's Update model list (`process/js/agent/table/model/updatePanel.js`) and Grant in the grants panel
(`shell/js/grantsPanel.js`), each tested in its own folder: it loads the busyButton itself, its button is attached, and
the request it hands the button waits until the server has answered. The other apps' own busy flags move onto it later
(box).

## What its test must try to break

- A made button not appended to its container, or without its title and class.
- A press that runs nothing, or twice; a second press while it waits that sends a second request.
- A busy button that is not greyed, whose icon is not left of its label, or that drops its label.
- An icon that does not turn, or turns by a style of the element's own instead of shell.css.
- A button left busy after a refusal, a throw or an answer at once; a refusal or a throw left unhandled.
