// spirit/run/spirit/app/agent/table/provider/elementRow.js
// ONE PROVIDER ROW IN THE PAGE (goal/G41.4): its fields to maintain and edit, each saved as it changes (no Save), and Delete, drawn from the server's
// answer and its stream only (rule/19). Built on the tables' row element (../rowElement.js).
//   spirit.elements.providerRow.create(container, api, id, added, detail) -> { destroy }   added: just made by Add; detail: the
//   page's detail pane, whose look(table) gives the title row its icon and name
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  // Its table's rows are the agent family's cache (goal/G41.28): the family's own data.js
  // (spirit/app/agent/data.js) translates them into the table's branch; it is loaded here, with
  // this element.
  window.spirit.cacheManager('agent');
  var FIELDS = [{ field: 'label', label: 'Label', kind: 'name' }, { field: 'url', label: 'URL', kind: 'url' }, { field: 'apiKey', label: 'API key', kind: 'secret' },
    // goal/G41.21, box v17: "a Model field at the bottom. It is a pick field ... showing only the models whose provider is
    // this provider": of names the model table's field that holds this provider's id; hidden while it holds none.
    { field: 'model', label: 'Model', kind: 'pick', pick: 'model', of: 'providerId' }];
  E.providerRow = {
    create: function (container, api, id, added, detail) {
      var made = null;
      var gone = false;
      Promise.resolve(spirit.require('spirit/app/agent/table/rowElement.js')).then(function () {
        if (gone) return;
        made = window.spirit.elements.agentRow.create(container, {
          api: api, table: 'provider', id: id, added: added === true, look: detail && detail.look ? detail.look('provider') : null, fields: FIELDS,
          // Its mandatory fields, as its server names them (goal/G41.21: "# mandatory fields (server AND ui)").
          required: ['icon', 'label', 'url'],
        });
      });
      return { destroy: function () { gone = true; if (made) made.destroy(); } };
    },
  };
}());
