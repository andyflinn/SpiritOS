# spirit/element/installSpiritElement.js

The one helper that places an element (goal/G43.32). Andy: *"this can be done with ONE single helper function
spirit/element/installSpiritElement(spirit,elementPath) - every element knows it's path, and if the helper is resident in
the required they ALL autoinsert themselves without name-space-collision"*, *"element scripts installed by the above
logic place their element-factory at spirit.element.<path-of-fucking-element-script>"*, and on Q5: *"element scripts
themselves are who installs the element factory at spirit.element.<path-of-element-script>"*. Its test is
`./installSpiritElement.js`, on the real spirit object in node.

## Requirements

- `spirit.require('spirit/element/installSpiritElement.js')` answers the helper, a function, and it is resident at
  `spirit.required.spirit.element.installSpiritElement`.
- `installSpiritElement(spirit, elementPath, factory)`: the element script hands its own run-root path and its factory;
  the factory then stands at `spirit.element.<its path>`, one key per folder and its name without `.js` the last
  (`spirit/element/icon.js` at `spirit.element.spirit.element.icon`, `spirit/app/<name>/element.js` at
  `spirit.element.spirit.app.<name>.element`). It answers the factory.
- **No name-space collision**: `x.js` and `x/y.js` both stand, `x/y.js`'s factory at `x`'s place `.y`, whichever is
  placed first; what stood before still stands.

On a page every element script's factory is asked at its place by the general rules
(`spirit/test/spirit-sibling-generalRules.md`, every product script placed where it is required).

## What its test must try to break

- A helper that is not resident in `spirit.required`, or answers a promise on the node.
- A factory placed under any other name than its path.
- A folder's element overwritten by the file of the same name, or the other way round.
