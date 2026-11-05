# spirit/app/appSelector/rowFormAppActive.js

Activate/Deactivate for one app, a rowFormToggle that hides itself when the app is intrinsic (goal/G43.15). Its test is `./rowFormAppActive.js`, in a real Chrome on a scratch node's face page.

Andy: *"the "activate/deacivate" should be an element, too, that self-hides if the app is intrinsic, that way nobody that uses that element can forget to hide it...."*

## Requirements

- `spirit.elements.rowFormAppActive.create(host, { key })`, loaded through `spirit.require`, answers `{ destroy }`.
- For an intrinsic app (Contacts) it shows nothing and takes no space.
- For an app that is not intrinsic (the Agent), off, it says Activate and the app's label. A press makes the app active, and it says Deactivate. A second press makes it inactive.
- In the appSelector's pane, the Agent's row has its Activate, and Contacts' row has neither Activate nor Deactivate.
