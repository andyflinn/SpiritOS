# spirit/app/icons/element.js, the Icons face

Its test is `./browserIcons.js`. `spirit.element.spirit.app.icons.icons.create(container)`, mounted alone in a box of a real Chrome on a scratch node's face page with Icons switched on.

The box (goal/G43.19, v16): *"the page asks icons through its api branch; only ./nodeIcons.js writes the table, the page writes no file of its own"*; 10: *"data.js on every open page follows that one job"*. Andy, its add row (G41.27): *"[➕] [an icon:paste] [keywords, comma separated][Add]"*; of a duplicate (G40.5): *"if add icon cannot add because the icon already exists, the open the edit dialog for the existing icon."*

## Requirements

- It loads through `spirit.require` and mounts with `spirit.element.spirit.app.icons.icons.create(container)`.
- Its add row: ➕, an icon to paste, then its keywords, comma separated, and Add. The list shows the set.
- An Add with no icon says `paste an icon first` and writes nothing.
- An Add writes the icon with its keywords, split at the commas, by asking `icons.icon` and nothing of the fs family; the list shows it with no reload.
- A duplicate opens the edit dialog of the icon there, its keywords in it, with Remove, and writes nothing.
- **Over the app, as contact's detail** (Andy: *"the icon detail panel is supposed to open overtop of the icon app..... like contact detail etc."*): the dialog is a panel layer covering the whole face, the icon's glyph on it, the add row under it (judged by what is on top where the add row stands); its close brings the face back; a press on the icon's row opens it the same way.
- An opened icon's keywords are written as they change.
- **Remove is an armingButton** (Andy: *"icon detail, delete should be an armingButton."*): a first press arms it and removes nothing, a click elsewhere disarms it, and a second press takes the icon out of the set, closes its dialog, and the list lets it go.
- A second page shows an icon added on the first with no reload and no search of its own; an icon deleted elsewhere leaves it too.
- destroy empties its container.

The list is judged by its rows, so the line saying what a press did is never read as a row.
