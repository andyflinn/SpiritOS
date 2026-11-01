# shell/icons/icons.js, its add row

The icons app's add row, a rowForm (goal/G41.27). Its test is `./icons.js`.

Andy, on G41.27: *"icons app:\n[➕] [an icon:paste] [keywords, comma separated][Add]"*. The box: *"spirit.elements.rowForm.create(container,
{ icon, button }) -> { root, span, button }"*, *"The mounter drops its form elements into span and wires the button
itself"*, and *"a line saying what a press did (a refusal, a result) is the mounter's, below the bubble, not in it."*

Asked of a real browser, the real rowForm composed: `./icons-laid.html`, opened at
`/DEBUG/shell/icons/test/icons-laid.html` on a scratch node with its DEBUG on (`test/headLessChrome.js`), mounts the
app in a box of 600 by 400 and keeps each rowForm it makes.

## Requirements

- **Its add row is one rowForm** in the app, its icon ➕ and its button Add.
- **Its span holds the icon to paste, then the keywords**: two inputs, the first's placeholder asking for an icon to
  paste, the second's `keywords, comma separated`, and nothing else.
- **Its Add is the rowForm's button**, the only Add in the app.
- **The add row stands on top**, above the list.
- **Its Add is wired**: pressed with no icon, it says `paste an icon first`, on a line below the bubble, not in it.

## What its test must try to break

- An add row of its own instead of a rowForm, or with another icon or button.
- An input out of order, or one more in the span.
- An Add the form does not hold, or not wired; the line of what it did inside the bubble.
