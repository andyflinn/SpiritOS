// spirit/run/spirit/app/agent/table/tableElement.js
// WHAT THE TABLES' ELEMENTS SHARE (goal/G41.4), in the page: each table's elementTable.js and elementRow.js name their
// columns and fields and build on these two. Andy, box v22:
// "elementTable.js (an face-shell compatible interface to the table for browsers, with search-list using the probablility-group of elements in shell/js/)" and "elementRow.js (a
// panel element, to maintain and edit one row of the table)".
//
//   spirit.elements.agentTable.create(container, { api, table, detail, row, add }) -> { refresh, destroy }
//     a title row, an Add button and a probabilitySearch pane over the table's branch of spirit.data, shown at once,
//     each row by its icon and its label alone (LIST_COLUMNS); Add gives the new row its table's icon;
//     picking a row, or adding one, opens row(box, key, added, row) in the detail pane; add(open), when given, is what
//     Add does instead of opening the editor in Add mode. detail is the page's: detail.open(make, { table, id, row }) makes that row's closable
//     tab in the pane with make(box) in it, or makes its tab active (goal/G41.31), and detail.look(table) is the table's
//     { icon, name, title }. Andy, on G41.4:
//     "make the detail-panel take over the middle pane of the workBench UI please", so the agent page hands its
//     workBench's centre.
//   spirit.elements.agentRow.create(container, { api, table, id, added, look, fields, required }) -> { destroy }, an element
//   of its own (./rowElement.js), which builds on agentDetail, below:
//     one row's fields as inputs, each saved as it changes (no Save), and Delete, under a title row; added says the row was
//     just made by Add; fields
//     [{ field, label, kind }], the row's icon always the first before them (ICON_FIELD), kind one of
//       icon                            a glyph from the shell's icon selector, the table's icon until one is chosen
//       text, url, name, description   one line (name and description stop at their field rules' limits)
//       secret                          a password box: what is typed replaces the secret, left empty it stays; the
//                                       row says only whether it is set ("<field>Set"), the secret never reaches a page
//       bool                            a checkbox
//       list                            a list typed as words split by commas
//       code                            a CodeMirror editor (spirit/element/codeMirror.js)
//       pick                            a row of another table, from a dropdown search of it (pick: that table)
//       output                          a row of another table (pick: that table), shown by its icon and label, never sent
//       bundle                          a bundle of the node, from the shell's bundle selector in dropdown mode
//
// EVERY ELEMENT LISTENS BY ITSELF, THROUGH THE ONE FRAMEWORK (Andy, on G41.4: "make sure that all element LISTEN to what
// needs listening to, by themselves, automatically. This should also be a general implementation. if those table
// searches and list were make properly from a probability framework, this should not have happened"): a table is its
// branch of spirit.data, the agent family's cache manager's (spirit.data.agent.data.branch(table), goal/G41.28), which the
// stream keeps current. A list is probabilitySearch
// with that branch as its data, so a search's answer is seated there and any write redraws it; an editor watches its
// row's path there. Nothing here hears the stream by hand.
//
// THE PAGE ONLY PROPOSES (rule/19: "the ui must propose all state changes to the server and only draw changes contained
// in the servers update/change stream"): a changed field and Delete go to the server, and what an editor shows is the server's get
// and the rows its stream then brings, never what was typed.
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  var AGENT = spirit.familyPath('agent');
  var made = 0;
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function agent() { return Promise.resolve(spirit.require(AGENT)); }
  // One call of a table's verb; a refusal comes back as { refused: why }, the server's own reason when it gave one (its
  // answer's extra.why: which argument, which row), else the refusal's words.
  function whyOf(e) {
    var why = e && e.body && e.body.extra && e.body.extra.why;
    return String(why || (e && e.message) || 'refused');
  }
  function call(table, args) {
    return agent().then(function (a) { return a[table](args); }).then(function (body) { return body || {}; }, function (e) { return { refused: whyOf(e) }; });
  }
  function needs(paths) { return Promise.all(paths.map(function (p) { return spirit.require(p); })).then(function () { E = window.spirit.elements; }); }
  // A TABLE'S BRANCH IS THE agent FAMILY'S CACHE (goal/G41.28): its whole path in spirit.data, as the family's own
  // data.js keeps it (spirit.data.agent.data), loaded with this element, as part of its tree. A page where it could
  // not be loaded (the agent server not running on its node, so the family is not there) is refused, never drawn
  // without its branch.
  spirit.cacheManager('agent');
  function branchOf(table) {
    if (!((window.spirit.data || {}).agent || {}).data) throw new Error('the agent family\'s cache manager is not on this page: the agent server does not run on this node');
    return window.spirit.data.agent.data.branch(table);
  }
  function D() { return window.spirit.data; }

  // EVERY PANE'S LOOK, IN THIS ONE PLACE (Andy, on G41.4: "is it possible to organize the code so that my changes so far
  // are only done in one place?"; "both the list pane and detail pane should have similarly styled title areas ... these
  // title bits should be structured so that a style change affects them all equally"): the title row and the field
  // line, which every table's list and editor draw with (E.agentDetail).
  //   THE TITLE ROW: [icon] then the words, each part in its own span; a detail pane's words are "Add | Change" and the
  //   table's name, a list pane's the table's name alone.
  // ITS ICON IS THE ICON ELEMENT (goal/G41.23; Andy: "this element will replace icons painting all shell elements and
  // apps."): made by icon.create and written as the markup it made, since the row is text; the glyph as text only while
  // spirit/element/icon.js has not loaded (every pane that draws a title row loads it first, below).
  function iconHtml(glyph, size) {
    var I = window.spirit.element && window.spirit.element.icon;
    if (!I || typeof I.create !== 'function') return '<span style="font-size:' + size + 'em">' + esc(glyph) + '</span>';
    var hold = document.createElement('span');
    I.create(hold, { glyph: String(glyph || ''), size: size });
    return hold.innerHTML;
  }
  function titleRow(look, words) {
    var l = look || {};
    // Set as a title, bigger than the lines below it (Andy: "the type face of the list and detail title rows should be a
    // bit more title-like a bit bigger").
    return '<div class="agent-title" style="display:flex;align-items:center;gap:1em;font-size:1.3em;font-weight:600">' + iconHtml(l.icon || '', 1.2) +
      words.map(function (w, i) { return i === 0 && words.length > 1 ? '<b>' + esc(w) + '</b>' : '<span>' + esc(w) + '</span>'; }).join('') + '</div>';
  }
  //   ONE FIELD A LINE ("the simple input lines, take up all the with availabe, with only the 1em between the inputs
  //   label and the input itself"): the label at its own width, 1em, and the input taking the rest of the line to the
  //   pane's right edge.
  var STRETCH = 'width:100%;box-sizing:border-box';
  function fieldLine(labelHtml, inputHtml) {
    return '<div style="margin-top:1em;display:flex;align-items:center;gap:1em"><span style="flex:none">' + labelHtml + '</span>' +
      '<div style="flex:1 1 0;min-width:0">' + inputHtml + '</div></div>';
  }
  // EVERY LIST SHOWS A ROW BY ITS ICON AND ITS LABEL, AND NOTHING ELSE (Andy: "the list in the left side pane then will
  // only show: icon and label").
  var LIST_COLUMNS = [{ field: 'icon', label: '' }, { field: 'label', label: 'Label', sort: 'text' }];
  // A TABLE LISTED BY OTHER FIELDS, in its list and in every pick of it alike: the model's "[icon] \"model-name\"", the
  // provider's icon the server sends with the row (goal/G41.18), which is all its search answers.
  var COLUMNS_OF = { model: [{ field: 'icon', from: 'providerIcon', label: '' }, { field: 'label', label: 'Model', sort: 'text' }] };
  function columnsOf(table) { return COLUMNS_OF[table] || LIST_COLUMNS; }
  //   A SEARCH OF A TABLE, a list or a picker: probabilitySearch over its branch, its first search sent as it is made
  //   ("the table-list in the left pane must be immediately shown when the table icon is selected"), each row drawn by
  //   its icon and its label, a picker's chosen row too ("pickers for all these tables, should display: [icon][label],
  //   exactly the same as the list").
  // A row's [icon][label] by the columns it is listed with (a column's from names the row's value: the model's
  // providerIcon).
  function nameOf(r, columns) {
    if (!r) return '';
    var cols = columns;
    var valueOf = function (field) { var c = cols.filter(function (k) { return k.field === field; })[0]; return r[(c && c.from) || field]; };
    return (valueOf('icon') ? valueOf('icon') + ' ' : '') + String(valueOf('label') || r.key || '');
  }
  function search(host, o, more) {
    var columns = o.columns || columnsOf(o.table);
    var s = window.spirit.element.search.create(host, Object.assign({
      api: o.api, server: 'agent', verb: o.table, data: branchOf(o.table),
      args: function (text) { return { op: 'search', text: text }; },
      columns: columns,
      name: function (r) { return nameOf(r, columns); },
    }, more));
    s.refresh();
    return s;
  }
  // What the tables' lists and editors share, the row's editor (./rowElement.js) among them.
  E.agentDetail = { titleRow: titleRow, fieldLine: fieldLine, stretch: STRETCH, search: search, branchOf: branchOf, whyOf: whyOf,
    esc: esc, call: call, needs: needs, nameOf: nameOf, columnsOf: columnsOf };

  // o.add(open): what Add does instead of opening the editor in Add mode (no table hands one since the grant table went,
  // goal/G41.21); o.add false: no Add at all (the model table's, whose rows come from the providers: Andy, on
  // G41.18, "get RID of [Add a Model] button in the left panes model mode. NOT required."). o.row(box, key, added, row): the editor of the row picked or added. o.buttons [{ label, press }]:
  // the table's own buttons on the Add line, Add kept; o.columns: what its list shows in place of icon and label (the
  // model table's: its provider's icon with the model name, goal/G41.18).
  function createTable(container, options) {
    var o = options || {};
    // UNCONFIGURED, IT SAYS SO and throws nothing (goal/G41.19, box v23: "no throw even unconfigured").
    if (!o.table) {
      container.innerHTML = '<div class="job-manifest-note">not configured: a table of the agent server is required</div>';
      return { refresh: function () {}, destroy: function () { container.innerHTML = ''; } };
    }
    var pre = 'at' + (++made) + '-';
    var gone = false;
    var list = null;
    var look = o.detail && o.detail.look ? o.detail.look(o.table) : { name: o.table };
    var buttons = Array.isArray(o.buttons) ? o.buttons : [];
    container.innerHTML = '<div class="fill">' + titleRow(look, [look.title || look.name || o.table]) +
      '<div style="margin-top:1em">' + (o.add === false ? '' : '<button type="button" id="' + pre + 'add">Add a ' + esc(o.table) + '</button> ') +
      buttons.map(function (b, i) { return '<button type="button" id="' + pre + 'button' + i + '">' + esc(b.label) + '</button> '; }).join('') +
      '<span id="' + pre + 'note"></span></div>' +
      '<div id="' + pre + 'list" class="fill" style="min-height:12em"></div></div>';
    buttons.forEach(function (b, i) {
      container.querySelector('#' + pre + 'button' + i).addEventListener('click', function () { if (typeof b.press === 'function') b.press(); });
    });
    // added: the row was just made by Add, so its editor says Add until it is saved.
    function open(key, added, row) {
      if (typeof o.row === 'function' && o.detail) o.detail.open(function (box) { return o.row(box, key, added === true, row || null); }, { table: o.table, id: key, row: row || null });
    }
    if (o.add !== false) container.querySelector('#' + pre + 'add').addEventListener('click', function () {
      if (typeof o.add === 'function') { o.add(open); return; }
      // ADD MAKES NO ROW (Andy: "NO ROW WILL BE CREATED WITH AN \"Add\" BUTTON for provider, persona, OR JOB!!!!!!!!!!!!"):
      // it opens the detail in Add mode, an editor with no row of its own; the row is made there, whole.
      open('', true);
    });
    needs(['spirit/element/search.js', 'spirit/element/icon.js']).then(function () {
      if (gone) return;
      // The title's icon, drawn before icon.js was there, through the icon element now (goal/G41.23).
      var title = container.querySelector('.agent-title');
      if (title && title.firstElementChild && !title.querySelector('.shell-icon')) title.firstElementChild.outerHTML = iconHtml(look.icon || '', 1.2);
      list = search(container.querySelector('#' + pre + 'list'), o, {
        pick: function (row, key) { open(key, false, row); },
        empty: 'No ' + o.table + ' yet.',
      });
    });
    return {
      refresh: function () { if (list) list.refresh(); },
      destroy: function () { gone = true; if (list) list.destroy(); container.innerHTML = ''; },
    };
  }

  E.agentTable = { create: createTable };
}());
