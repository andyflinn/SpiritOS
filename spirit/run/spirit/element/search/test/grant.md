# spirit/element/search/grant.js, the grant selector

goal/G43.32, the box: *"every branch's search is search/<branch>.js, the selector, and its folder holds listElement.js,
rowElement.js and detailElement.js"*. The selector is a thin element over its own list, `./grant/listElement.js`, as
`./bundle.js` is over `./bundle/listElement.js`. Its test is `./grant.js`: the browser file in node on a window of its own,
its list a recorder in its place. What the list does is judged by `../grant/test/listElement.js`.

## Requirements

- It requires its own list as it runs.
- It places `spirit.element.spirit.element.search.grant.create`, by its path.
- `create(container, options)` draws its list in that container, with the options as they are, and answers what the list
  answers.

## What its test must try to break

- A selector that draws no list, or another one.
- A list drawn in another box, or with options changed.
- A selector placed anywhere but at its path.
