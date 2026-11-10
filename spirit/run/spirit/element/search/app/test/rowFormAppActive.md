# spirit/element/search/app/rowFormAppActive.js

Activate/Deactivate for one app, a rowFormToggle that hides itself when the app is intrinsic (goal/G43.15). Its test is `./rowFormAppActive.js`, in a real Chrome on a scratch node's face page.

Andy: *"the "activate/deacivate" should be an element, too, that self-hides if the app is intrinsic, that way nobody that uses that element can forget to hide it...."*

## Requirements

- `spirit.element.spirit.element.search.app.rowFormAppActive.create(host, { key })`, loaded through `spirit.require`, answers `{ destroy }`.
- For an intrinsic app (Contacts) it shows nothing and takes no space.
- goal/G43.21, Andy: *"an app that only has node:run and no node:mount or shell:mount cannot be "activated" show rowForms should knows that."*: for an app whose row says `runOnly` (pushOrigin, publishData) it shows nothing either.
- For an app that is not intrinsic (the Agent), off, it says Activate and the app's label. A press makes the app active, and it says Deactivate. A second press makes it inactive.
- In the appSelector's pane (the box: *"The appSelector's detail and its rows use them."*), the Agent's row has its Activate or Deactivate, drawn by rowFormAppActive, a rowForm, and no button of the old installer. Contacts' row says neither.
