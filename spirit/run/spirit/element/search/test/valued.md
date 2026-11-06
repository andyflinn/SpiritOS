# valued.js

`spirit/run/spirit/element/search/valued.js` is a list of rows of name and value (goal/G43.6). Its test is `./valued.js`, in a real browser on a scratch node.

Andy, box: *"It will be spirit.element.valued, on disc and in spirit"*, and *"It is searchable (probabilitySearch), over rows it already holds, with no node verb."*

## Requirements

- `spirit.element.valued.create(container, { rows(), columns }) -> { redraw(), destroy() }`, and nothing on `spirit.elements`. It reaches no old code.
- It shows every row it is handed under its columns, with one search field, and its list scrolls inside the box it is given (rule/16).
- `redraw()` shows what `rows()` answers now, keeping the words and the scroll.
- Words put the matching row first, and it asks the node nothing.
- `destroy()` leaves its container empty.
