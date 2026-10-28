// spirit/run/process/js/agent/table/tableElement.js
// WHAT THE TABLES' ELEMENTS SHARE (goal/G41.4), in the page: each table's elementTable.js and elementRow.js name their
// columns and fields and build on these two. Andy, box v22: "elementTable.js (an face-shell compatible interface to the
// table for browsers, with search-list using the probablility-group of elements in shell/js/)" and "elementRow.js (a
// panel element, to maintain and edit one row of the table)".
//
//   spirit.elements.agentTable.create(container, { api, table, columns, detail, row(box, id) }) -> { refresh, destroy }
//     a probabilitySearch pane over the table's search (agent.<table> {op: search}), an Add button above it; picking a
//     row, or adding one, opens it in row(box, id) in the detail pane. detail is the page's: detail.open(make) empties
//     the pane, destroys what was in it and puts make(box) there. Andy, on G41.4: "make the detail-panel take over the
//     middle pane of the workBench UI please", so the agent page hands its workBench's centre.
//   spirit.elements.agentRow.create(container, { api, table, id, added, look, fields }) -> { destroy }
//     one row's fields as inputs, Save and Delete, under a title row: look { icon, name } is the page's for the table
//     (detail.look(table)), added says the row was just made by Add; fields [{ field, label, kind }], kind one of
//       text, url, name, description   one line (name and description stop at their field rules' limits)
//       secret                          a password box: what is typed replaces the secret, left empty it stays; the
//                                       row says only whether it is set ("<field>Set"), the secret never reaches a page
//       bool                            a checkbox
//       list                            a list typed as words split by commas
//       code                            a CodeMirror editor (shell/js/codeMirror.js)
//       pick                            a row of another table, from a dropdown search of it (pick: that table)
//
// THE PAGE ONLY PROPOSES (rule/19: "the ui must propose all state changes to the server and only draw changes contained
// in the servers update/change stream"): Save and Delete go to the server, and what the editor shows is the server's get
// and the rows its stream then brings, never what was typed.
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  var AGENT = spirit.familyPath('agent');
  var made = 0;
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function agent() { return Promise.resolve(spirit.require(AGENT)); }
  // One call of a table's verb; a refusal comes back as { refused: why }.
  function call(table, args) {
    return agent().then(function (a) { return a[table](args); }).then(function (body) { return body || {}; }, function (e) { return { refused: (e && e.message) || 'refused' }; });
  }
  function needs(paths) { return Promise.all(paths.map(function (p) { return spirit.require(p); })).then(function () { E = window.spirit.elements; }); }

  function createTable(container, o) {
    var pre = 'at' + (++made) + '-';
    var gone = false;
    var list = null;
    container.innerHTML = '<div class="fill">' +
      '<div><button type="button" id="' + pre + 'add">Add a ' + esc(o.table) + '</button> <span id="' + pre + 'note"></span></div>' +
      '<div id="' + pre + 'list" class="fill" style="min-height:12em"></div></div>';
    // added: the row was just made by Add, so its editor says Add until it is saved.
    function open(id, added) {
      if (id && typeof o.row === 'function' && o.detail) o.detail.open(function (box) { return o.row(box, id, added === true); });
    }
    container.querySelector('#' + pre + 'add').addEventListener('click', function () {
      call(o.table, { op: 'add' }).then(function (r) {
        if (gone) return;
        container.querySelector('#' + pre + 'note').textContent = r.refused ? 'Not added: ' + r.refused : '';
        if (r.id) { open(r.id, true); if (list) list.refresh(); }
      });
    });
    needs(['shell/js/probabilitySearch.js']).then(function () {
      if (gone) return;
      list = E.probabilitySearch.create(container.querySelector('#' + pre + 'list'), {
        api: o.api, server: 'agent', verb: o.table,
        args: function (text) { return { op: 'search', text: text }; },
        columns: o.columns,
        pick: function (row, key) { open(key); },
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
    var off = null;
    var added = o.added === true;
    function input(f) { return container.querySelector('#' + pre + f.field); }
    // THE TITLE ROW (Andy, on G41.4: "add a title row to the detail pane containing: [Table-Icon] \"Add | Change\"
    // [Table-name]"): Add while the row is new, Change once it was saved or when it was opened from the list.
    function head() {
      var look = o.look || {};
      return '<div style="display:flex;align-items:center;gap:1em"><span style="font-size:20px">' + esc(look.icon || '') + '</span>' +
        '<b>' + (added ? 'Add' : 'Change') + '</b><span>' + esc(look.name || o.table) + '</span></div>';
    }
    // ONE FIELD A ROW, ORDERLY (Andy: "the simple input fields take up one row each, make them look more orderly, perhaps
    // the input field stretches to the right edge of the pane"): the labels in one column, each input stretched to the
    // pane's right edge in the other.
    var STRETCH = 'width:100%;box-sizing:border-box';
    function cell(f, v) {
      var id = pre + f.field;
      if (f.kind === 'bool') return '<input type="checkbox" id="' + id + '"' + (v ? ' checked' : '') + '>';
      if (f.kind === 'secret') return '<input type="password" id="' + id + '" style="' + STRETCH + '" autocomplete="off" placeholder="' + (row[f.field + 'Set'] ? 'set; type to replace' : 'not set') + '">';
      if (f.kind === 'pick') return '<div id="' + id + '"></div>';
      if (f.kind === 'list') v = Array.isArray(v) ? v.join(', ') : '';
      return '<input type="text" id="' + id + '" style="' + STRETCH + '" value="' + esc(v) + '">';
    }
    function paint(note) {
      if (gone) return;
      if (!row) { container.innerHTML = '<div>' + esc(note || 'Loading…') + '</div>'; return; }
      Object.keys(picks).forEach(function (k) { picks[k].destroy(); });
      picks = {};
      editors = {};
      var simple = o.fields.filter(function (f) { return f.kind !== 'code'; });
      var code = o.fields.filter(function (f) { return f.kind === 'code'; });
      // THE CODE FIELD TAKES THE FREE HEIGHT (Andy: "the codeMirror pane in details must not be allowed to move the
      // pane-dividers of workBench. it's width must be constrained by the middle workbench pane, it is allowed to take up
      // free vertical space"): a fill box whose CodeMirror takes the height left and scrolls inside it (shell.css
      // .text-view.fill). Its width is the centre's, which the workBench holds (shell/js/workBench.js).
      container.innerHTML = '<div class="fill">' + head() +
        '<div style="margin-top:1em;display:grid;grid-template-columns:max-content minmax(0,1fr);gap:1em;align-items:center">' +
        simple.map(function (f) { return '<label for="' + pre + f.field + '">' + esc(f.label) + '</label>' + cell(f, row[f.field]); }).join('') + '</div>' +
        code.map(function (f) { return '<div style="margin-top:1em">' + esc(f.label) + '</div><div class="text-view fill" id="' + pre + f.field + '"></div>'; }).join('') +
        '<div style="margin-top:1em"><button type="button" id="' + pre + 'save">Save</button> <button type="button" id="' + pre + 'delete">Delete</button> <span id="' + pre + 'note">' + esc(note || '') + '</span></div></div>';
      o.fields.forEach(function (f) {
        var el = input(f);
        if ((f.kind === 'name' || f.kind === 'description') && E.fieldInput) E.fieldInput.attach(el, f.kind);
        if (f.kind === 'code') {
          needs(['shell/js/codeMirror.js']).then(function () {
            return E.codeMirror.create(el, { mode: 'edit', text: String(row[f.field] || ''), path: f.field + '.md' });
          }).then(function (cm) { editors[f.field] = cm; });
        }
        // The field shows the row picked now, by its label, until another is picked; only a new pick is saved.
        if (f.kind === 'pick') {
          var now = row[f.field] ? call(f.pick, { op: 'get', id: row[f.field] }) : Promise.resolve({});
          Promise.all([needs(['shell/js/probabilitySearch.js']), now]).then(function (got) {
            if (gone) return;
            var current = got[1] && !got[1].refused ? (got[1].label || got[1].id) : '';
            picks[f.field] = E.probabilitySearch.create(el, {
              api: o.api, server: 'agent', verb: f.pick, face: 'dropdown', placeholder: current || 'Pick a ' + f.pick,
              args: function (text) { return { op: 'search', text: text }; },
              columns: [{ field: 'label', label: 'Label', sort: 'text' }],
              name: function (r) { return r.label || r.id; },
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
      o.fields.forEach(function (f) {
        var el = input(f);
        var v;
        if (f.kind === 'bool') v = !!(el && el.checked);
        else if (f.kind === 'code') v = editors[f.field] ? editors[f.field].value() : undefined;
        else if (f.kind === 'pick') v = picks[f.field] && picks[f.field].value ? picks[f.field].value : undefined;
        else if (f.kind === 'list') v = String((el && el.value) || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        else v = el ? String(el.value || '') : undefined;
        if (f.kind === 'secret' && !v) return;
        if (f.kind === 'url' && !v) return;
        if (v !== undefined && JSON.stringify(v) !== JSON.stringify(row[f.field])) out[f.field] = v;
      });
      return out;
    }
    function load(note) {
      return call(o.table, { op: 'get', id: o.id }).then(function (r) {
        if (gone) return;
        if (r.refused) { row = null; paint('Not found: ' + r.refused); return; }
        row = r;
        paint(note);
      });
    }
    function save() {
      call(o.table, changes()).then(function (r) {
        if (gone) return;
        if (!r.refused) added = false;
        load(r.refused ? 'Not saved: ' + r.refused : 'Saved.');
      });
    }
    function remove() {
      call(o.table, { op: 'delete', id: o.id }).then(function (r) {
        if (gone) return;
        if (r.refused) { load('Not deleted: ' + r.refused); return; }
        row = null;
        container.innerHTML = '<div>Deleted.</div>';
      });
    }
    // The row as the stream brings it: another window's change repaints this one.
    if (o.api && typeof o.api.onPublished === 'function') {
      off = o.api.onPublished(function (x) {
        var a = x && x.agent;
        if (!a || a.table !== o.table) return;
        if (a.removed && a.id === o.id) { row = null; container.innerHTML = '<div>Deleted.</div>'; return; }
        if (a.row && a.row.id === o.id) { row = a.row; paint(''); }
      }, 'agent');
    }
    paint();
    load();
    return { destroy: function () { gone = true; if (typeof off === 'function') off(); Object.keys(picks).forEach(function (k) { picks[k].destroy(); }); container.innerHTML = ''; } };
  }

  E.agentTable = { create: createTable };
  E.agentRow = { create: createRow };
}());
