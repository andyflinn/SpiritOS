# spirit/element/search/file/script.js, the file selector

goal/G43.32, the box: *"every branch's search is search/<branch>.js, the selector, and its folder holds list.js,
row.js and detail.js"*. The selector is a thin element over its own list, `./file/list.js`, as
`../../bundle/test/script.js` is over `./bundle/list.js`. Its test is `./script.js`: the browser file in node on a window of its own,
its list a recorder in its place. What the list does is judged by `../list/test/script.js`.

## Requirements

- It requires its own list as it runs.
- It places `spirit.required.spirit.element.search.file.create`, by its path.
- `create(container, options)` draws its list in that container, with the options as they are, and answers what the list
  answers.

## What its test must try to break

- A selector that draws no list, or another one.
- A list drawn in another box, or with options changed.
- A selector placed anywhere but at its path.
