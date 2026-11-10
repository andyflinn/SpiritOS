# spirit/element/search.js, its bubble laid out

The search element's bubble, in a real browser (goal/G41.26). Its test is `./search-bubble.js`; the
element's other tests run in node (`./search.md`).

Andy, on G41.26: *"why do the icons in the probabilitySearch row have different width's? do they not use the icon
element? I'd like it, if the controls in the search bubble look better aligned."*

Asked of a real browser, since widths and places are layout: `./search-bubble-laid.html`, opened at
`/DEBUG/spirit/element/test/search-bubble-laid.html` on a scratch node with its DEBUG on
(`spirit/test/headLessChrome.js`), a pane and a dropdown, each with a filter.

## Requirements

In a pane and in a dropdown's pane alike:

- **The 🪣 row of selectors on top** (Andy: *"the selectorRow must start with a\n🪣icon"*): its 🪣 the icon element
  too, a square of its font size, over the 🗜; its first selector starting where the search input does.
- **The row icons are the icon element** (`spirit/element/icon.js`): 🗜 and 🔎 are spans of class `shell-icon`.
- **Each icon is a square of its font size**, whatever its glyph. A bare glyph takes its own width, which differs
  from glyph to glyph and from browser to browser.
- **The icons stand one under the other**, as wide as each other.
- **Each row's first control starts at the same place**: the first filter over the search input.

## What its test must try to break

- 🗜 or 🔎 drawn as a bare glyph: its class, and its width that is not its font size (here 20px at 16px).
- The rows' first controls at different places.
