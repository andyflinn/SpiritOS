# rowElement.js

`spirit/run/spirit/app/agent/table/rowElement.js` is one row of the agent's tables, edited in the page (goal/G41.4), an
element of its own (goal/G41.28). Each table's `elementRow.js` names its fields and builds on it. Its test is
`./rowElement.js`.

Andy, box v22: *"elementRow.js (a panel element, to maintain and edit one row of the table)"*.

## Requirements

- It registers `spirit.elements.agentRow`, and no other element: one file, one element (goal/G41.28). The title row,
  the field line, the table's searches and the one way to its server are the tables' shared element's
  (`./tableElement.js`, `spirit.elements.agentDetail`), which it loads itself as part of its tree (rule/26).
- **Unconfigured** (`agentRow.create(box, {})`, as the general test mounts every element by itself), it says it is not
  configured and throws nothing; its `destroy` empties the box (goal/G41.19, box v23), as the table does.
- **A row's editor**, `agentRow.create(container, { api, table, id, added, look, fields })`:
  - Its row is the one at `<node>/agent/<table>/<id>` in spirit.data. It asks `{ op: 'get', id }` as it opens, whatever the
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
- **A bundle field: kind `bundle`.** The editor loads `spirit/element/search/bundle.js` itself and makes a bundle selector in
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
  armingButtons?"*): the editor loads `spirit/element/armingButton.js` itself and attaches its Delete button; a first press
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

- agentTable registered by this file; the shared element not loaded by it; an unconfigured row that throws, or draws
  an editor instead of saying it is not configured.
- A Save that sends the whole row, an empty secret, or draws what was typed before the stream says it.
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
