# spirit/element/rowForm.js

The one-row form, a shell element (goal/G41.27). Its test is `./rowForm.js`.

Andy, box: *"new shell element: rowForm"*, *"one row forms show as blocks taking up the full width of their container,
and wrap, if it's form elements don't have enough space."*, *"they form a bubble with transparent background, and a
border with the color of the type-face. The bubble is one shared style, the same probabilitySearch's search bubble
uses."*, *"the first element is always an icon shell-element, and takes the (top-) left position in the one-row
form"*, *"the last element is always a button that is positioned at the (bottom-) right for the form."*, *"between the
icon and the button is a span, into which the form elements can be dropped."*, and *"a line saying what a press did (a
refusal, a result) is the mounter's, below the bubble, not in it."*

## API

`window.spirit.element.rowForm.create(container, { icon, button })` draws the form into the container and answers
`{ root, span, button }`. `icon` is the glyph, `button` the button's words. The mounter drops its form elements into
`span` and wires `button` itself (a busyButton or a click).

## Requirements

- **A block the full width of its container**, edge to edge, in a wide container and a narrow one.
- **A bubble**: its background transparent, its border all round the colour of its type-face, rounded.
- **One shared style**: its bubble and probabilitySearch's search bubble carry one class, which `shell.css` draws
  (transparent, `currentColor`); probabilitySearch keeps no copy of that style of its own.
- **Its first element is the icon element** (`spirit/element/icon.js`, class `shell-icon`), the glyph it was given, at the top
  left inside the bubble.
- **Its last element is a button** with the words it was given, at the bottom right inside the bubble.
- **The span stands between them** and takes the form elements. With room, the icon, the elements and the button stand
  on one row.
- **It wraps**: elements too wide for one row go onto more rows, the bubble growing, nothing standing past the bubble or
  its container; the icon stays at the top left and the button at the bottom right.
- **The press is the mounter's**: the button unwired, a press changes nothing in the form.

Asked of a real browser, since widths, wrapping and places are layout: `./rowForm-laid.html`, opened at
`/DEBUG/spirit/element/test/rowForm-laid.html` on a scratch node with its DEBUG on (`test/headLessChrome.js`), forms in
containers of 600px and 260px, and a probabilitySearch beside them.

## What its test must try to break

- A form that does not wrap, or is only as wide as its content.
- An icon not first, or not the icon element; a button not last, or at the top when the form wraps.
- A bubble of its own style instead of the shared class, or probabilitySearch keeping its own copy.

## Its own spacing (goal/G43.15)

Andy: *"rowForms should carry their own upper 1em spacing, so when they're invisible, they space disappears with them"*.

- Its root carries 1em above it, its own margin, so two forms one under the other stand 1em apart.
- Hidden, a form takes that 1em with it: the next one stands 1em below what is above.
