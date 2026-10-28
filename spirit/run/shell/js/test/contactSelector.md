# contactSelector.js

`spirit/run/shell/js/contactSelector.js` is the contact selector. Since goal/G41.13 it is the configurable ID selector
of the grants app's add-grant row. Its test is `./contactSelector.js`; this spec covers what G41.13 adds.

Andy, Q2: *"the loopback-api-location of the ID table, which must be formed like the shadow roll : key:ID (ID-field-rules,
label (label-field rules)"*, *"table:\"loopback://api/contact/search\""*, and *"if neccessary: key field name ('id',
'contactID', what ever this ID based table calls its key); label field name ('label', 'relayLabel', what ever this ID
based table calls its label)"*.

## Requirements

- It registers `spirit.elements.createContactSelector(options)`. Its root is answered at once, nothing chosen, with
  `refresh`, `present` and `mark`, as Chatter and the shell use it.
- It loads what it uses itself (rule/26): on a bare page it requires `shell/js/probabilitySearch.js`, then builds on
  it. Nothing of the old shell's list search is in it (goal/G40.8).
- With no table named, it searches the contacts, `contact.search`, and a row is the contact's key and name, as before.
- `options.table` is the ID table's loopback api location, `loopback://api/<family>/<verb>`. It is searched through
  the spirit object at that family and verb. A table of the agent tables' norm is asked `{ op: 'search', text }` (Andy:
  *"the config info is auth.bundle (an api that conforms to the same interface norm as
  \"process/js/agent/table/<tableName>\")"*). Naming the contacts' table is the same as naming none.
- `options.key` names the field a row's ID is in, and `options.label` the field its label is in.
- A pick sets `.value` to that ID.

## What its test must try to break

- A configured table that is asked anywhere but its own family and verb.
- A row whose ID or label is read from the wrong field.
- The contacts' default broken by the new options.
- An element counted on that the selector did not load itself.
