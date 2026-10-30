# model/updatePanel.js

The Update model list pane (goal/G41.18): it asks a provider for its models, and shows what it answered. Its test is
`./updatePanel.js`, over the real shared table element (`../../tableElement.js`) and spirit.data, with the search
element and the agent server's interface as stubs.

Andy, box v17: *"the title of the new center-pane is: \"🧠 Update model list\""*, *"then a form row: from
[provider-dropdown] [ask-Button]"*, and *"when a provider is selected. The ask button will ask the provider for a
model-list, which is then shown below the the ask form above, with a remark \"model list updated.\""*. The model table's
`provider models` button opens it in the centre (`./model.md`); the asking itself is the provider table's ask
(`../../provider/test/provider.md`).

## Requirements

- It registers `spirit.elements.modelUpdate.create(container, api, detail)`, answering `{ destroy }`.
- It loads what it uses itself (rule/26): the shared table element and the search element.
- Its title row is the panes' own title row (`agentDetail.titleRow`): 🧠, then `Update model list`.
- Its form row:
  - the word `from`;
  - a dropdown search of the provider table: the pickers' own search (`agentDetail.search`), face `dropdown`, over the
    branch `agent.provider`, of the agent server;
  - the `Ask` button, its id ending `-ask`.
- Ask with no provider chosen asks nothing.
- Ask with a provider chosen calls `provider { op: 'ask', id }` through the agent's interface, the provider picked.
- Below the form it shows the list the answer carries, each model by its label and its model name, escaped. When the
  answer says `updated: true`, it adds the remark `model list updated.`
- An answer of no models (`updated: false`) has no such remark.
- A refused ask says the server's reason (`agentDetail.whyOf`), with no remark, and the list of an earlier ask is no
  longer shown.
- Not asserted here: the model list in the left pane follows by the stream alone (rule/19); this pane draws the ask's
  answer and writes no row.
- `destroy` destroys the dropdown and empties the pane.

### Ask is a busyButton (goal/G41.23)

Box: *"first users: Ask in the agent's Update model list, and Grant in the grants panel"*. The busyButton is tested in
its own folder (`shell/js/test/busyButton.md`); here a stand-in keeps what it is handed.

- The pane loads `shell/js/busyButton.js` itself (rule/26).
- Its Ask button is attached as a busyButton, the ask its request (`run`).
- A press asks once, and the request it hands the button waits while the provider has not answered; it settles once
  the provider answers, so the button is plain again.

## What its test must try to break

- An ask sent with no provider, or to any table but the provider table.
- The remark said when nothing was updated, or after a refusal.
- A model's label unescaped; an earlier list left standing under a refusal.
- An Ask button that is no busyButton, or one whose request answers before the provider does.
