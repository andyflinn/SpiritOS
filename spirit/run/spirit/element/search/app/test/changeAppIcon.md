# spirit/element/search/app/changeAppIcon.js

One app's icon, as a rowForm (goal/G43.15). Its test is `./changeAppIcon.js`, in a real Chrome on a scratch node's face page.

Andy: *"i thought you'd make the changeAppLabel and changeAppIcon form elements as well, in spirit/app/ then i can re-use them as is in the config right side panel of agent, both above the debug thinggie..."*

## Requirements

- `spirit.element.spirit.element.search.app.changeAppIcon.create(host, { key })`, loaded through `spirit.require`, answers `{ destroy }`.
- A rowForm as the detail draws it: ✏️, the word Icon, the app's icon, the icon dropdown, and a Change button.
- Change with nothing picked changes nothing.
- A glyph picked in the dropdown, then Change, writes it through the app family's `iconApp`, and the app's row says it.
- An icon changed elsewhere shows, with no reload.
- `destroy` empties its host.
