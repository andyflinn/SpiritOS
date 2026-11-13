# spirit/element/search/icon/rowElement.js — its own test

One icon as a row element (goal/G30.21; Andy: *"it's the icon we store or use"*): its fields the glyph and the keywords it
is found by. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). The browser file runs
in node on a bare window; the shared row element and the icon element are stand-ins.

- It stands at `spirit.element.spirit.element.search.icon.rowElement` with a `create`, and loads the shared row element
  and the icon element itself (goal/G41.3, G41.23).
- `create(row)`: kind `icon`, keyed by its glyph (its key when it has no glyph), no actions; fields `glyph` and
  `keywords`; no keywords is none; rows share one index.
- The keywords drawn joined by a comma, escaped.
- The glyph: plain text, escaped, while the icon element has not loaded; the icon element's markup once it is in
  (goal/G41.23; Andy, goal/G41.21: *"this element will replace icons painting all shell elements and apps."*).

## What its test must try to break

The icon element bypassed once it is loaded; a row keyed by something other than its glyph; a glyph drawn as markup.
