# spirit/app/icons/browserIcons.js, the Icons face

Its test is `./browserIcons.js`. `spirit.elements.icons.create(container)`, mounted alone in a box of a real Chrome on a scratch node's face page with Icons switched on.

The box (goal/G43.19, v16): *"the page asks icons through its api branch; only ./nodeIcons.js writes the table, the page writes no file of its own"*; 10: *"data.js on every open page follows that one job"*. Andy, its add row (G41.27): *"[➕] [an icon:paste] [keywords, comma separated][Add]"*; of a duplicate (G40.5): *"if add icon cannot add because the icon already exists, the open the edit dialog for the existing icon."*

## Requirements

- It loads through `spirit.require` and mounts with `spirit.elements.icons.create(container)`.
- Its add row: ➕, an icon to paste, then its keywords, comma separated, and Add. The list shows the set.
- An Add with no icon says `paste an icon first` and writes nothing.
- An Add writes the icon with its keywords, split at the commas, by asking `icons.icon` and nothing of the fs family; the list shows it with no reload.
- A duplicate opens the edit dialog of the icon there, its keywords in it, with Remove, and writes nothing.
- An opened icon's keywords are written as they change; Remove takes it out of the set, closes its dialog, and the list lets it go.
- A second page shows an icon added on the first with no reload and no search of its own; an icon deleted elsewhere leaves it too.
- destroy empties its container.

The list is judged by its rows, so the line saying what a press did is never read as a row.
