# spirit/element/search/app/changeAppLabel.js

One app's label, as a rowForm (goal/G43.15). Its test is `./changeAppLabel.js`, in a real Chrome on a scratch node's face page.

Andy: *"i thought you'd make the changeAppLabel and changeAppIcon form elements as well, in spirit/app/ then i can re-use them as is in the config right side panel of agent, both above the debug thinggie..."*

## Requirements

- `spirit.element.spirit.element.search.app.changeAppLabel.create(host, { key })`, loaded through `spirit.require`, answers `{ destroy }`.
- One rowForm, as the detail draws it: ✏️, the word Label, a box holding the app's label, and a Change button.
- Change writes the box's label through the app family's `labelApp`, and the app's row says it.
- A label changed elsewhere shows in the box, with no reload.
- `destroy` empties its host.
