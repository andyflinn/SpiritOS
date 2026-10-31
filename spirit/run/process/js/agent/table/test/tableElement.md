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
    chosen with the shell's icon selector, `iconSelector.create(the icon field, …)` (the shell's element shape,
    goal/G41.19), on the table's icon while the row has none.
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

## Requirements (goal/G41.21, box v17)

- **A pick field narrowed to its row: `of`.** What its dropdown **offers** is narrowed, not only what it asks (Andy:
  *"the model picker in provider details of course shows models at all, when it must show models from that
  provider"*): the dropdown is a view of its table's whole branch, so of the page's rows it lets through only those whose
  `<field>` holds this row's id, judged by the real list's own `probabilitySearch.order`.
  The rows are what the real model table's search answers (../provider/server.js and ../model/server.js on a scratch
  agent.db, seated in the page's branch as the list seats them), and each row it offers shows the model, never an empty
  row (Andy: *"the model picker for the provider table showed a bunch of EMPTY rows"*: its columns asked icon and label,
  which the model table's search does not answer).
  Further: A pick field `{ kind: 'pick', pick: <table>, of: <field> }` searches its
  table narrowed to the rows whose `<field>` holds this row's id: its dropdown's `args(text)` is
  `{ op: 'search', text, <field>: <this row's id> }`, and it asks the table the same narrowed search. While that search
  answers no row, the field is hidden (*"The Model field is hidden while the model table holds no model of this
  provider"*); with one, it is shown.
- **A bundle field: kind `bundle`.** The editor loads `shell/js/bundleSelector.js` itself and makes a bundle selector in
  the field, in dropdown mode; the bundle picked is saved as the field (`{ op: 'set', id, bundle }`). It lists every
  bundle, whoever owns it (goal/G41.25, Andy: *"so the bundle pickers in the persona and job details will always list ALL
  bundles"*): the selector is mounted for no app server.
- **The bundle by its label** (Andy: *"why would the bundle picker show "bundle 2" for it's selection instead of the
  fucking label?"*): the bundle field shows the job's bundle by the label the node has for it (`auth.bundle { op: get }`),
  never as the word bundle and its number.
- **A field changed saves the whole row at once; there is no Save** (Andy: *"and why the fuck does a row not
  automatically save when i make a change to a field?"*, and on Q2: *"yes, send the whole row for update. it costs
  nothing, and we don't need more fucking verbs than necessary."*): the editor draws no Save button; an edit of a field
  (its change event), a tick, a secret typed, or a bundle picked sends `{ op: set, id, ...every field it shows }` by
  itself, a secret only when typed so an untyped key is kept. A refused save says the server's reason. The editor still
  draws only what the stream brings (rule/19).
- **Delete is an are-you-sure button** (Andy: *"and why are the 'Delete' buttons in the detail panels not
  armingButtons?"*): the editor loads `shell/js/armingButton.js` itself and attaches its Delete button; a first press
  deletes nothing, the second calls `{ op: delete, id }` once.
- **A bundle gone is said** (*"A bundle deleted while a job names it leaves that job with no grant, and the job says so
  in its detail panel, never silently."*): a row naming a bundle asks the node for it (`auth.bundle { op: get, id }`);
  one the node no longer has is said in the panel, the bundle and that the job has no grant. One the node has is not.

### A pick saves, whatever else is unpicked (goal/G41.21)

Andy: *"when i pick a persona, provider, or a bundle, the UI responds to ALL three of those picker changes with exactly
these words: "Not saved: agent.job: provider must be a peer's public key".... WTF!"*, *"that message could not be more
stupid, when the user just selected a key by label for the respective table!!!!!"*. Against the real job, persona and
provider tables on a scratch agent.db, a job with no provider and no persona yet: picking its persona saves it, then a
bundle, then a provider, each taken by the job table, and the editor never says Not saved. A field not picked and empty
is no value to send.

### Add mode (goal/G41.21, box v23)

Andy: *"NO ROW WILL BE CREATED WITH AN "Add" BUTTON for provider, persona, OR JOB!!!!!!!!!!!!"*, *"the proper way to do
such a thing is, the detail panel has and "Add" mode, with an "Add new <provider|persona|job>" button at the bottom.
Only when all fields, including icon, are filled, will the "Add" button not respopnd with an error."*

- Pressing a table's Add asks the server nothing; it opens an editor with no row of its own, in Add mode.
- In Add mode the editor asks no get, saves nothing when a field changes, has no Delete, and its bottom button says
  `Add new <name>`.
- Pressed with a mandatory field (`o.required`) empty, it makes nothing and says which; what was typed stays.
- With every mandatory field filled, it adds the whole row once (`{ op: add, ...every field }`), and the editor is the
  new row's from then on, its title Change.

### An output field (goal/G41.21)

Andy: *"In model, the fucking <provider> field is OUTPUT ONLY. I NEVER ordered a fucking picker for that............."*. A field of kind `output`, naming the table it points to (`pick`), shows that table's row by its icon and label; it has no picker and no input, and a save of the row never sends it.

### A bundle field follows the server (goal/G41.21)

Andy: *"persona detail: the bundle picker doesn not let me change values! (actually it does let me change it, i just doesn't seem to hear the change from the server)"*: the row's bundle changed on the stream, the bundle field says the new bundle by its label.

## What its test must try to break

- A list that waits for a click before it shows, or shows more than icon and label when its table hands no columns.
- A table's own button not drawn, or drawn in place of Add; columns handed and not used.
- A Save that sends the whole row, an empty secret, or draws what was typed before the stream says it.
- A refusal shown as its bare code ("no such argument") instead of the server's reason.
- An editor that does not follow its row in spirit.data, or keeps hearing it after destroy.
- A narrowed pick searching the whole table, or shown with nothing to pick; a bundle field drawn as a pane, or not saved.
- A bundle the node no longer has left unsaid.
- A narrowed pick offering the branch's other rows, the server's ask narrowed alone.
- A dropdown row drawn empty, its columns asking fields its table's search does not answer.
- A bundle shown as its number; a Delete that deletes on its first press.
- A field edit that waits for a Save, a Save button left, or a save sending part of the row.
- An Add that makes a row before it is valid; an Add mode that saves on a change, loses what was typed, or has a Delete.
- A pick refused for a field the user never touched.
- An output field drawn as a picker or an input, or sent with a save.
- A bundle field that keeps the label of the bundle it first showed.
