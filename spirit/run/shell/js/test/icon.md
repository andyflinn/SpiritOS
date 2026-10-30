# shell/js/icon.js

The icon element (goal/G41.23, carried from goal/G41.21, box v9). Andy: *"we will create a new shell element "icon", it
centers the glyph, in a square box, the size of which follows font-size, it's size option should vary from that
base-line, be a multiplier of it."*, *"no other option than size, like like text characters, it follows, its container
in most attributes."*, and *"the glyph IS the glyph, no key-abstraction."* Its test is `./icon.js`.

## API

`window.spirit.elements.icon.create(container, { glyph, size })` makes the icon, appends it to the container and answers
it (goal/G41.19: *"every element gets a container and appends itself"*).

- `glyph` the glyph itself, shown as it is given.
- `size` the multiplier of the font size it inherits; 1 when not given. No other option.

It carries a class of its own, by which the shell's other elements are seen to paint through it (workBench's test).

## Requirements

- **A square, its side the font size times size**: in 20 pixel type a square of 20, size 2 a square of 40, size 0.5 a
  square of 10; in 10 pixel type a square of 10.
- **It never shrinks**: in a row too narrow for it, beside a label that wants more, it keeps its square.
- **The glyph centred**: its middle is the square's middle, within a tenth of the side (the font's own glyph metrics).
- **The glyph is the glyph**: `🔑` shows `🔑`; no key looked up.
- **It follows its container like a text character**: its colour is its container's.

Asked of a real browser, since a square that follows the font size is layout: `./icon-sized.html`, opened at
`/DEBUG/shell/js/test/icon-sized.html` on a scratch node with its DEBUG on (`test/headLessChrome.js`).

## Its users

*"this element will replace icons painting all shell elements and apps."* The first is the workBench's strip
(`./workBench.md`, goal/G41.23). The other shell elements and apps that paint an icon are not on this item's file list;
each moves onto it under the item that lists its files.

## What its test must try to break

- A square of the wrong side, a size ignored, or a fixed size that does not follow the font.
- An icon squeezed in a narrow row.
- A glyph off the middle of its square.
- A glyph changed, cut or looked up.
- A colour of its own; no class to know it by.
