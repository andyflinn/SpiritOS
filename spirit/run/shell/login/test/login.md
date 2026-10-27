# shell/login/login.js

The face's Login app (goal/G30.9): the counterpart of the node's Join app, drawn as Join draws, every step a bullet,
done ones ticked, the open one expanded with its form. It draws what the shell hands it (`onSteps`) and decides
nothing. Since goal/G41.9 its Log out is the shell's are-you-sure button, armingButton.

## Requirements

- It mounts through `spirit.shell.activateLogin({ mount(container, shellApi), onSteps(h) })`, reading its steps from
  `shell/login/login.json`; it draws only once it has them.
- **It loads armingButton itself** (goal/G41.3), through `spirit.require('shell/js/armingButton.js')`.
- **Nothing of the old hand-rolled confirm is left** (goal/G41.9): no `data-armed`, no `armUntilElsewhere`, no
  `armed` class of its own. The element holds the arming, the wording and the disarm.
- **Log out is an armingButton** (`window.spirit.elements.armingButton`, by `attach` on the drawn `#face-logout` or by
  `create`), handed the shell's api: it says `Log out`, armed `Log out? Press again`; its `run` asks
  `api.post('logout')` and then reloads the page.
- **Log out is drawn only on a face**: on the home node (`facts.home`) its owner is logged in and there is nothing to log
  out of, so no button is drawn and none is made.
- The login step: one field and Log in, which asks `api.post('login', { text })`; logged in, it asks the shell to
  refresh; any other answer says the same words, so the page never says which it got.

## What its test must try to break

- A Log out that logs out on one press, or arms by hand.
- A Log out on the home node.
- The element not loaded by the app itself.
