# tableElement.js

`spirit/run/process/js/agent/table/tableElement.js` is what the tables' elements share, in the page (goal/G41.4). Each
table's `elementTable.js` and `elementRow.js` name their columns and fields and build on it. Its test is
`./tableElement.js`.

Andy, box v22: *"elementTable.js (an face-shell compatible interface to the table for browsers, with search-list using
the probablility-group of elements in shell/js/)"* and *"elementRow.js (a panel element, to maintain and edit one row of
the table)"*.

## Requirements

- It registers `spirit.elements.agentTable`, `spirit.elements.agentRow` and `spirit.elements.agentDetail`.
- **Every pane's look is in one place** (Andy: *"is it possible to organize the code so that my changes so far are only
  done in one place?"*). `agentDetail` holds:
  - `titleRow(look, words)`: the `agent-title` row, the icon, then the words, each in a part of its own. It is set as a
    title, bigger and semibold (*"a bit more title-like a bit bigger"*), and escapes what it shows.
  - `fieldLine(label, input)`: the label at its own width, 1em, then the input to the pane's right edge (*"with only the
    1em between the inputs label and the input itself"*).
  - `search(host, o, more)`: the one table search, for lists and pickers alike.
  - `branchOf(table)` is `agent.<table>`.
  - `whyOf(refusal)` is the server's own reason (its `extra.why`), else the refusal's words, else `refused`.
- **A table**, `agentTable.create(container, { api, table, detail, row, add, matched, buttons, columns })`:
  - Its title row is the table's icon and title, from `detail.look(table)`.
  - It has an Add button.
  - Its list is a `probabilitySearch` over the agent server's verb for that table, seated in the branch
    `agent.<table>` of spirit.data. It is searched as it is made (*"must be immediately shown"*), asking
    `{ op: 'search', text }`.
  - Every row is shown by its icon and its label alone (*"will only show: icon and label"*). A picker names a row the
    same way.
  - Given `columns`, the list shows those in place of icon and label (goal/G41.18: the model table shows its provider's
    icon and its model name). A table that hands none keeps icon and label.
  - A row picked opens `row(box, key, false, row)` in the detail pane.
  - Add calls `<table> { op: 'add', icon }` through the agent's interface, the new row taking its table's icon. It then
    opens the new row's editor, added. A refused Add says `Not added: <the server's reason>` and opens nothing.
  - Given `add(open)`, Add calls that instead and asks the server nothing (the grant table's).
  - Given `add: false`, no Add is drawn; its buttons and title row are (goal/G41.18: the model table's, whose rows come
    from the providers).
  - Given `buttons`, `[{ label, press }]`, each is drawn on the Add line by its label, Add kept, its id
    `<prefix>button<i>`; pressed, it calls its `press()` (goal/G41.18: the model table's *"provider models"*).
  - `destroy` destroys the list and empties the box.
- **A row's editor**, `agentRow.create(container, { api, table, id, added, look, fields })`:
  - Its row is the one at `agent.<table>/<id>` in spirit.data. It asks `{ op: 'get', id }` as it opens, whatever the
    branch holds, and puts the answer there: a search answers only what a list shows, so a row in the branch may be
    slim (goal/G41.18; Andy: *"that exactly what GET is for, to bring in the rest for detail panels etc..."*).
  - Its title row says Add while the row is new, and Change once saved or when opened from the list.
  - The icon is its first field (*"the detail panel's first input will be the icon i choose for that row"*). It is
    chosen with the shell's icon selector, on the table's icon while the row has none.
  - Each field shows the row: a line its value, a bool its tick, a list its words split by commas. A secret is an
    empty password box that says only whether it is set.
  - **It follows its row by itself** (Andy: *"make sure that all element LISTEN to what needs listening to, by
    themselves, automatically"*): a row written to its path shows at once, and a row deleted there says `Deleted.`
  - **The page only proposes (rule/19):**
    - Save calls `{ op: 'set', id }` with only what changed. An empty secret and an unchanged field are not sent, and
      a typed secret is.
    - The row changes only by the stream, never by what was typed.
    - A Save taken says `Saved.` and Change. A refused one says `Not saved: <the server's reason>`.
    - Delete calls `{ op: 'delete', id }`.
  - `destroy` empties its box, and it hears its row no more.

- It requires no data script (goal/G41.16): each table's row element (`<table>/elementRow.js`) takes its own rows
  from the stream into `agent.<table>`.

## What its test must try to break

- A list that waits for a click before it shows, or shows more than icon and label when its table hands no columns.
- A table's own button not drawn, or drawn in place of Add; columns handed and not used.
- A Save that sends the whole row, an empty secret, or draws what was typed before the stream says it.
- A refusal shown as its bare code ("no such argument") instead of the server's reason.
- An editor that does not follow its row in spirit.data, or keeps hearing it after destroy.
