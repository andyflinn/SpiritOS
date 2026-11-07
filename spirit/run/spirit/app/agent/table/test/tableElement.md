# tableElement.js

`spirit/run/spirit/app/agent/table/tableElement.js` is what the tables' elements share, in the page (goal/G41.4). Each
table's `elementTable.js` and the row editor (`../rowElement.js`) build on it. Its test is
`./tableElement.js`.

Andy, box v22: *"elementTable.js (an face-shell compatible interface to the table for browsers, with search-list using the probablility-group of elements in shell/js/)"* and *"elementRow.js (a panel element, to maintain and edit one row of
the table)"*.

## Requirements

- It registers `spirit.elements.agentTable` and the shared `spirit.elements.agentDetail`, and no other element: one file,
  one element (goal/G41.28). The row's editor, `agentRow`, is `./rowElement.js`'s, which builds on `agentDetail`, and
  is tested in its own suite (`./rowElement.md`).
- **Every pane's look is in one place** (Andy: *"is it possible to organize the code so that my changes so far are only
  done in one place?"*). `agentDetail` holds:
  - `titleRow(look, words)`: the `agent-title` row, the icon, then the words, each in a part of its own. It is set as a
    title, bigger and semibold (*"a bit more title-like a bit bigger"*), and escapes what it shows.
  - `fieldLine(label, input)`: the label at its own width, 1em, then the input to the pane's right edge (*"with only the
    1em between the inputs label and the input itself"*).
  - `search(host, o, more)`: the one table search, for lists and pickers alike.
  - `branchOf(table)` is the home node's `<node>/agent/<table>`, as the agent family's cache manager names it
    (`spirit.data.agent.data.branch`, goal/G41.28). With no agent family's cache on the page (its server not running on the
    node) it refuses and says why: no list is drawn without its branch.
  - `whyOf(refusal)` is the server's own reason (its `extra.why`), else the refusal's words, else `refused`.
- **A table**, `agentTable.create(container, { api, table, detail, row, add, matched, buttons, columns })`:
  - Its title row is the table's icon and title, from `detail.look(table)`.
  - It has an Add button.
  - Its list is a `probabilitySearch` over the agent server's verb for that table, seated in the branch
    `<node>/agent/<table>` of spirit.data. It is searched as it is made (*"must be immediately shown"*), asking
    `{ op: 'search', text }`.
  - Every row is shown by its icon and its label alone (*"will only show: icon and label"*). A picker names a row the
    same way.
  - Given `columns`, the list shows those in place of icon and label (goal/G41.18: the model table shows its provider's
    icon and its model name). A table that hands none keeps icon and label.
  - A row picked opens `row(box, key, false, row)` in the detail pane.
  - Add asks the server nothing: it opens an editor in Add mode, with no row of its own (goal/G41.21, below).
  - Given `add(open)`, Add calls that instead and asks the server nothing (no table hands one since the grant table went).
  - Given `add: false`, no Add is drawn; its buttons and title row are (goal/G41.18: the model table's, whose rows come
    from the providers).
  - Given `buttons`, `[{ label, press }]`, each is drawn on the Add line by its label, Add kept, its id
    `<prefix>button<i>`; pressed, it calls its `press()` (goal/G41.18: the model table's *"provider models"*).
  - `destroy` destroys the list and empties the box.
  - Unconfigured (no `table`), it says it is not configured and throws nothing; its `destroy` empties the box
    (goal/G41.19).

- It requires no data script (goal/G41.16): the agent family's cache manager
  (`spirit/app/agent/data.js`, goal/G41.28), asked for by the element as it runs, takes the tables'
  rows from the stream into `<node>/agent/<table>`.

### Add (goal/G41.21, box v23)

Andy: *"NO ROW WILL BE CREATED WITH AN "Add" BUTTON for provider, persona, OR JOB!!!!!!!!!!!!"*, *"the proper way to do
such a thing is, the detail panel has and "Add" mode, with an "Add new <provider|persona|job>" button at the bottom.
Only when all fields, including icon, are filled, will the "Add" button not respopnd with an error."*

- Pressing a table's Add asks the server nothing; it opens an editor with no row of its own, in Add mode
  (`row(box, '', true)`).

## What its test must try to break

- agentRow registered by this file; a branch answered when the agent family's cache is not on the page; an
  unconfigured table that throws or says nothing.

- A list that waits for a click before it shows, or shows more than icon and label when its table hands no columns.
- A table's own button not drawn, or drawn in place of Add; columns handed and not used.
- A refusal shown as its bare code ("no such argument") instead of the server's reason.
