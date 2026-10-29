// spirit/run/process/js/agent/table/tableElement.js
// WHAT THE TABLES' ELEMENTS SHARE (goal/G41.4), in the page: each table's elementTable.js and elementRow.js name their
// columns and fields and build on these two. Andy, box v22: "elementTable.js (an face-shell compatible interface to the
// table for browsers, with search-list using the probablility-group of elements in shell/js/)" and "elementRow.js (a
// panel element, to maintain and edit one row of the table)".
//
//   spirit.elements.agentTable.create(container, { api, table, matched, detail, row, add }) -> { refresh, destroy }
//     a title row, an Add button and a probabilitySearch pane over the table's branch of spirit.data, shown at once,
//     each row by its icon and its label alone (LIST_COLUMNS); Add gives the new row its table's icon;
//     picking a row, or adding one, opens row(box, key, added, row) in the detail pane; add(open), when given, is what
//     Add does instead of adding an empty row. detail is the page's: detail.open(make) empties the pane, destroys what
//     was in it and puts make(box) there, and detail.look(table) is the table's { icon, name, title }. Andy, on G41.4:
//     "make the detail-panel take over the middle pane of the workBench UI please", so the agent page hands its
//     workBench's centre.
//   spirit.elements.agentRow.create(container, { api, table, id, added, look, fields }) -> { destroy }
//     one row's fields as inputs, Save and Delete, under a title row; added says the row was just made by Add; fields
//     [{ field, label, kind }], the row's icon always the first before them (ICON_FIELD), kind one of
//       icon                            a glyph from the shell's icon selector, the table's icon until one is chosen
//       text, url, name, description   one line (name and description stop at their field rules' limits)
//       secret                          a password box: what is typed replaces the secret, left empty it stays; the
//                                       row says only whether it is set ("<field>Set"), the secret never reaches a page
//       bool                            a checkbox
//       list                            a list typed as words split by commas
//       code                            a CodeMirror editor (shell/js/codeMirror.js)
//       pick                            a row of another table, from a dropdown search of it (pick: that table)
//
// EVERY ELEMENT LISTENS BY ITSELF, THROUGH THE ONE FRAMEWORK (Andy, on G41.4: "make sure that all element LISTEN to what
// needs listening to, by themselves, automatically. This should also be a general implementation. if those table
// searches and list were make properly from a probability framework, this should not have happened"): a table is its
// branch of spirit.data, agent.<table>, which the stream keeps current through that table's own row element
// (<table>/elementRow.js, goal/G41.16). A list is probabilitySearch
// with that branch as its data, so a search's answer is seated there and any write redraws it; an editor watches its
// row's path there. Nothing here hears the stream by hand.
//
// THE PAGE ONLY PROPOSES (rule/19: "the ui must propose all state changes to the server and only draw changes contained
// in the servers update/change stream"): Save and Delete go to the server, and what an editor shows is the server's get
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
  function branchOf(table) { return 'agent.' + table; }
  function D() { return window.spirit.data; }

  // EVERY PANE'S LOOK, IN THIS ONE PLACE (Andy, on G41.4: "is it possible to organize the code so that my changes so far
  // are only done in one place?"; "both the list pane and detail pane should have similarly styled title areas ... these
  // title bits should be structured so that a style change affects them all equally"): the title row and the field
  // line, which every table's list and editor draw with, the grant editor included (E.agentDetail).
  //   THE TITLE ROW: [icon] then the words, each part in its own span; a detail pane's words are "Add | Change" and the
  //   table's name, a list pane's the table's name alone.
  function titleRow(look, words) {
    var l = look || {};
    // Set as a title, bigger than the lines below it (Andy: "the type face of the list and detail title rows should be a
    // bit more title-like a bit bigger").
    return '<div class="agent-title" style="display:flex;align-items:center;gap:1em;font-size:1.3em;font-weight:600"><span style="font-size:1.2em">' + esc(l.icon || '') + '</span>' +
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
  //   A SEARCH OF A TABLE, a list or a picker: probabilitySearch over its branch, its first search sent as it is made
  //   ("the table-list in the left pane must be immediately shown when the table icon is selected"), each row drawn by
  //   its icon and its label, a picker's chosen row too ("pickers for all these tables, should display: [icon][label],
  //   exactly the same as the list").
  function search(host, o, more) {
    var s = E.probabilitySearch.create(host, Object.assign({
      api: o.api, server: 'agent', verb: o.table, data: branchOf(o.table),
      args: function (text) { return { op: 'search', text: text }; },
      columns: LIST_COLUMNS,
      name: function (r) { return (r && r.icon ? r.icon + ' ' : '') + String((r && (r.label || r.key)) || ''); },
    }, more));
    s.refresh();
    return s;
  }
  E.agentDetail = { titleRow: titleRow, fieldLine: fieldLine, stretch: STRETCH, search: search, branchOf: branchOf, whyOf: whyOf };

  // EVERY ROW'S EDITOR OPENS ON ITS ICON (Andy: "the detail panel's first input will be the icon i choose for that row"),
  // chosen with the shell's icon selector (shell/js/iconSelector.js).
  var ICON_FIELD = { field: 'icon', label: 'Icon', kind: 'icon' };

  // o.add(open): what Add does instead of an empty row (the grant table's: an empty editor, since a grant is made from a
  // job and a path). o.row(box, key, added, row): the editor of the row picked or added.
  function createTable(container, o) {
    var pre = 'at' + (++made) + '-';
    var gone = false;
    var list = null;
    var look = o.detail && o.detail.look ? o.detail.look(o.table) : { name: o.table };
    container.innerHTML = '<div class="fill">' + titleRow(look, [look.title || look.name || o.table]) +
      '<div style="margin-top:1em"><button type="button" id="' + pre + 'add">Add a ' + esc(o.table) + '</button> <span id="' + pre + 'note"></span></div>' +
      '<div id="' + pre + 'list" class="fill" style="min-height:12em"></div></div>';
    // added: the row was just made by Add, so its editor says Add until it is saved.
    function open(key, added, row) {
      if (typeof o.row === 'function' && o.detail) o.detail.open(function (box) { return o.row(box, key, added === true, row || null); });
    }
    container.querySelector('#' + pre + 'add').addEventListener('click', function () {
      if (typeof o.add === 'function') { o.add(open); return; }
      // The new row reaches the list by the stream, as every change does.
      // A NEW ROW TAKES ITS TABLE'S ICON (Andy: "all table rows will have an icon, by default the tables icon").
      call(o.table, look.icon ? { op: 'add', icon: look.icon } : { op: 'add' }).then(function (r) {
        if (gone) return;
        container.querySelector('#' + pre + 'note').textContent = r.refused ? 'Not added: ' + r.refused : '';
        if (r.id) open(r.id, true);
      });
    });
    needs(['shell/js/probabilitySearch.js']).then(function () {
      if (gone) return;
      list = search(container.querySelector('#' + pre + 'list'), o, {
        matched: o.matched,
        pick: function (row, key) { open(key, false, row); },
        empty: 'No ' + o.table + ' yet.',
      });
    });
    return {
      refresh: function () { if (list) list.refresh(); },
      destroy: function () { gone = true; if (list) list.destroy(); container.innerHTML = ''; },
    };
  }

  function createRow(container, o) {
    var pre = 'ar' + (++made) + '-';
    var gone = false;
    var row = null;
    var editors = {};
    var picks = {};
    var icons = {};
    var note = '';
    var added = o.added === true;
    var path = branchOf(o.table) + '/' + o.id;
    var fields = [ICON_FIELD].concat(o.fields || []);
    function input(f) { return container.querySelector('#' + pre + f.field); }
    // The title says Add while the row is new, Change once it was saved or when it was opened from the list.
    function head() { return titleRow(o.look, [added ? 'Add' : 'Change', (o.look && o.look.name) || o.table]); }
    function cell(f, v) {
      var id = pre + f.field;
      if (f.kind === 'bool') return '<input type="checkbox" id="' + id + '"' + (v ? ' checked' : '') + '>';
      if (f.kind === 'secret') return '<input type="password" id="' + id + '" style="' + STRETCH + '" autocomplete="off" placeholder="' + (row[f.field + 'Set'] ? 'set; type to replace' : 'not set') + '">';
      if (f.kind === 'pick' || f.kind === 'icon') return '<div id="' + id + '"></div>';
      if (f.kind === 'list') v = Array.isArray(v) ? v.join(', ') : '';
      return '<input type="text" id="' + id + '" style="' + STRETCH + '" value="' + esc(v) + '">';
    }
    function paint() {
      if (gone) return;
      Object.keys(picks).forEach(function (k) { picks[k].destroy(); });
      picks = {};
      editors = {};
      icons = {};
      if (!row) { container.innerHTML = '<div class="fill">' + head() + '<div style="margin-top:1em">' + esc(note || 'Loading…') + '</div></div>'; return; }
      var simple = fields.filter(function (f) { return f.kind !== 'code'; });
      var code = fields.filter(function (f) { return f.kind === 'code'; });
      // THE CODE FIELD TAKES THE FREE HEIGHT (Andy: "the codeMirror pane in details must not be allowed to move the
      // pane-dividers of workBench. it's width must be constrained by the middle workbench pane, it is allowed to take up
      // free vertical space"): a fill box whose CodeMirror takes the height left and scrolls inside it (shell.css
      // .text-view.fill). Its width is the centre's, which the workBench holds (shell/js/workBench.js).
      container.innerHTML = '<div class="fill">' + head() +
        simple.map(function (f) { return fieldLine('<label for="' + pre + f.field + '">' + esc(f.label) + '</label>', cell(f, row[f.field])); }).join('') +
        code.map(function (f) { return '<div style="margin-top:1em">' + esc(f.label) + '</div><div class="text-view fill" id="' + pre + f.field + '"></div>'; }).join('') +
        '<div style="margin-top:1em"><button type="button" id="' + pre + 'save">Save</button> <button type="button" id="' + pre + 'delete">Delete</button> <span id="' + pre + 'note">' + esc(note) + '</span></div></div>';
      fields.forEach(function (f) {
        var el = input(f);
        if ((f.kind === 'name' || f.kind === 'description') && E.fieldInput) E.fieldInput.attach(el, f.kind);
        // The row's icon, or its table's while it has none.
        if (f.kind === 'icon') {
          needs(['shell/js/iconSelector.js']).then(function () {
            if (gone || !el.isConnected) return;
            icons[f.field] = E.createIconSelector(null, { value: row[f.field] || (o.look && o.look.icon) || '' });
            el.appendChild(icons[f.field]);
          });
        }
        if (f.kind === 'code') {
          needs(['shell/js/codeMirror.js']).then(function () {
            return E.codeMirror.create(el, { mode: 'edit', text: String(row[f.field] || ''), path: f.field + '.md' });
          }).then(function (cm) { editors[f.field] = cm; });
        }
        // The field shows the row picked now, by its label from the other table's branch, until another is picked; only a
        // new pick is saved.
        if (f.kind === 'pick') {
          var other = row[f.field] ? D().get(branchOf(f.pick) + '/' + row[f.field]) : null;
          var current = other ? (other.icon ? other.icon + ' ' : '') + (other.label || row[f.field]) : '';
          needs(['shell/js/probabilitySearch.js']).then(function () {
            if (gone) return;
            picks[f.field] = search(el, { api: o.api, table: f.pick }, {
              face: 'dropdown', placeholder: current || 'Pick a ' + f.pick,
            });
          });
        }
      });
      container.querySelector('#' + pre + 'save').addEventListener('click', save);
      container.querySelector('#' + pre + 'delete').addEventListener('click', remove);
    }
    // What was changed, as the verb takes it: a secret only when typed, a pick only when picked.
    function changes() {
      var out = { op: 'set', id: o.id };
      fields.forEach(function (f) {
        var el = input(f);
        var v;
        if (f.kind === 'bool') v = !!(el && el.checked);
        else if (f.kind === 'code') v = editors[f.field] ? editors[f.field].value() : undefined;
        else if (f.kind === 'pick') v = picks[f.field] && picks[f.field].value ? picks[f.field].value : undefined;
        else if (f.kind === 'icon') v = icons[f.field] && icons[f.field].value ? String(icons[f.field].value) : undefined;
        else if (f.kind === 'list') v = String((el && el.value) || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        else v = el ? String(el.value || '') : undefined;
        if (f.kind === 'secret' && !v) return;
        if (f.kind === 'url' && !v) return;
        if (v !== undefined && JSON.stringify(v) !== JSON.stringify(row[f.field])) out[f.field] = v;
      });
      return out;
    }
    // Save and Delete only propose: the editor repaints when the stream writes the row's path (or deletes it), and says
    // a refusal in its note.
    function save() {
      call(o.table, changes()).then(function (r) {
        if (gone) return;
        if (!r.refused) added = false;
        note = r.refused ? 'Not saved: ' + r.refused : 'Saved.';
        paint();
      });
    }
    function remove() {
      call(o.table, { op: 'delete', id: o.id }).then(function (r) {
        if (gone || !r.refused) return;
        note = 'Not deleted: ' + r.refused;
        paint();
      });
    }
    // THE ROW AS spirit.data HOLDS IT: what the stream writes there repaints this editor, a delete says so.
    var unwatch = D().watch(path, function (p, value) {
      if (value === undefined) { row = null; note = 'Deleted.'; paint(); return; }
      row = value;
      paint();
    });
    // Its first state: what the branch holds, else the server's get, put where the stream writes it.
    row = D().get(path) || null;
    paint();
    if (!row) {
      call(o.table, { op: 'get', id: o.id }).then(function (r) {
        if (gone) return;
        if (r.refused) { note = 'Not found: ' + r.refused; paint(); return; }
        D().set(path, r);
      });
    }
    return { destroy: function () { gone = true; unwatch(); Object.keys(picks).forEach(function (k) { picks[k].destroy(); }); container.innerHTML = ''; } };
  }

  E.agentTable = { create: createTable };
  E.agentRow = { create: createRow };
}());
