# shell/js/appHeader/appHeader.js

The shell's app header element (goal/G6.1): an empty div an app fills with its top bar, sticking at the top of the
app's pane, above its content. `create(container)` appends it and answers it. Its test is `./appHeader.js`.

## Requirements (goal/G41.22)

Andy: *"The desk main page now has a giant gap between the shells title bar and it's first row of buttons."* Since
goal/G41.22 the app's own pane scrolls, and it starts under the shell's title bar, so a header that kept the title
bar's height as its sticking offset sat one title bar too low.

Asked of a real browser: `./appHeader-pinned.html`, opened at `/DEBUG/shell/js/appHeader/test/appHeader-pinned.html` on
a scratch node with its DEBUG on (`test/headLessChrome.js`), puts a header with a row of buttons in the home page's app
area (`#app-container` > `#app-header`, `#app-content` > `.app-pane`, under `/shell.css`), 3000 pixels of content
under it.

- The header sits at the top of its app's pane, which starts under the title bar: no gap between them.
- The content under it starts at or below the header's bottom: nothing is overlapped.
- The pane scrolled, the header stays at the pane's top.

## What its test must try to break

- A header offset by the title bar's height, or any gap above it.
- A header over the first rows of its content.
- A header that scrolls away with the content.
