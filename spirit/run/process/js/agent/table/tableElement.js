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
  // ITS ICON IS THE ICON ELEMENT (goal/G41.23; Andy: "this element will replace icons painting all shell elements and
  // apps."): made by icon.create and written as the markup it made, since the row is text; the glyph as text only while
  // shell/js/icon.js has not loaded (every pane that draws a title row loads it first, below).
  function iconHtml(glyph, size) {
    var I = window.spirit.elements && window.spirit.elements.icon;
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
  var COLUMNS_OF = { model: [{ field: 'icon', from: 'providerIcon', label: '' }, { field: 'label', from: 'modelName', label: 'Model', sort: 'text' }] };
  function columnsOf(table) { return COLUMNS_OF[table] || LIST_COLUMNS; }
  //   A SEARCH OF A TABLE, a list or a picker: probabilitySearch over its branch, its first search sent as it is made
  //   ("the table-list in the left pane must be immediately shown when the table icon is selected"), each row drawn by
  //   its icon and its label, a picker's chosen row too ("pickers for all these tables, should display: [icon][label],
  //   exactly the same as the list").
  // A row's [icon][label] by the columns it is listed with (a column's from names the row's value: the model's
  // providerIcon and modelName).
  function nameOf(r, columns) {
    if (!r) return '';
    var cols = columns;
    var valueOf = function (field) { var c = cols.filter(function (k) { return k.field === field; })[0]; return r[(c && c.from) || field]; };
    return (valueOf('icon') ? valueOf('icon') + ' ' : '') + String(valueOf('label') || r.key || '');
  }
  function search(host, o, more) {
    var columns = o.columns || columnsOf(o.table);
    var s = E.probabilitySearch.create(host, Object.assign({
      api: o.api, server: 'agent', verb: o.table, data: branchOf(o.table),
      args: function (text) { return { op: 'search', text: text }; },
      columns: columns,
      name: function (r) { return nameOf(r, columns); },
    }, more));
    s.refresh();
    return s;
  }
  E.agentDetail = { titleRow: titleRow, fieldLine: fieldLine, stretch: STRETCH, search: search, branchOf: branchOf, whyOf: whyOf };

  // EVERY ROW'S EDITOR OPENS ON ITS ICON (Andy: "the detail panel's first input will be the icon i choose for that row"),
  // chosen with the shell's icon selector (shell/js/iconSelector.js).
  var ICON_FIELD = { field: 'icon', label: 'Icon', kind: 'icon' };

  // o.add(open): what Add does instead of an empty row (the grant table's: an empty editor, since a grant is made from a
  // job and a path); o.add false: no Add at all (the model table's, whose rows come from the providers: Andy, on
  // G41.18, "get RID of [Add a Model] button in the left panes model mode. NOT required."). o.row(box, key, added, row): the editor of the row picked or added. o.buttons [{ label, press }]:
  // the table's own buttons on the Add line, Add kept; o.columns: what its list shows in place of icon and label (the
  // model table's "provider models" and its provider's icon with the model name, goal/G41.18).
  function createTable(container, o) {
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
      if (typeof o.row === 'function' && o.detail) o.detail.open(function (box) { return o.row(box, key, added === true, row || null); });
    }
    if (o.add !== false) container.querySelector('#' + pre + 'add').addEventListener('click', function () {
      if (typeof o.add === 'function') { o.add(open); return; }
      // ADD MAKES NO ROW (Andy: "NO ROW WILL BE CREATED WITH AN \"Add\" BUTTON for provider, persona, OR JOB!!!!!!!!!!!!"):
      // it opens the detail in Add mode, an editor with no row of its own; the row is made there, whole.
      open('', true);
    });
    needs(['shell/js/probabilitySearch.js', 'shell/js/icon.js']).then(function () {
      if (gone) return;
      // The title's icon, drawn before icon.js was there, through the icon element now (goal/G41.23).
      var title = container.querySelector('.agent-title');
      if (title && title.firstElementChild && !title.querySelector('.shell-icon')) title.firstElementChild.outerHTML = iconHtml(look.icon || '', 1.2);
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
    var bundles = {};
    // A PICK NARROWED TO THIS ROW (goal/G41.21; f.of): how many rows of its table hold this row's id, asked once an
    // editor opens; while none do, its line is hidden (Andy, box v17: "The Model field is hidden while the model table
    // holds no model of this provider.").
    var narrowCount = {};
    // A BUNDLE GONE (Andy, box v17: "A bundle deleted while a job names it leaves that job with no grant, and the job says
    // so in its detail panel, never silently."): the bundle named is asked of the node once (auth.bundle get); false while
    // the node has no such bundle.
    var bundleHeld = {};
    var bundleLabel = {};
    // ITS ROWS ARE THIS ROW'S ONLY (Andy: "the model picker in provider details of course shows models at all, when it
    // must show models from that provider"): a list that is a view of its table's whole branch draws every row the page
    // holds, whatever its search asked. The shell keeps that branch (Andy: "the SHELL must do the caching automatically,
    // using translators...."), so the pick stays its view and the list's own filter leaves out a row whose f.of is not
    // this row's id; the filter has no buttons (when: never). A row a plain search seated carries no f.of (Andy, on
    // G41.18: "only the ID and the fields shown in a table"), so what the narrowed ask answered counts as this row's too
    // (narrowKeys). Its search asks the same narrowed.
    var narrowKeys = {};
    function narrowedTo(f) {
      var mine = narrowKeys[f.field] = narrowKeys[f.field] || {};
      return {
        filters: [{ name: f.of, when: function () { return false; }, test: function (r) {
          if (!r) return 0;
          if (r[f.of] != null && r[f.of] !== '') return String(r[f.of]) === String(o.id) ? 1 : 0;
          return mine[String(r.key || r.id)] ? 1 : 0;
        } }],
        args: function (text) { var a = { op: 'search', text: text }; a[f.of] = o.id; return a; },
      };
    }
    var note = '';
    var added = o.added === true;
    // THE ADD MODE (Andy: "the detail panel has and \"Add\" mode, with an \"Add new <provider|persona|job>\" button at the
    // bottom. Only when all fields, including icon, are filled, will the \"Add\" button not respopnd with an error."): an
    // editor with no id. It asks no get, a field changed saves nothing, and its button adds the whole row once every one
    // of the table's mandatory fields (o.required, as its server names them) is filled; from then on it is that row's.
    var adding = !o.id;
    var required = Array.isArray(o.required) ? o.required : [];
    var path = branchOf(o.table) + '/' + o.id;
    var fields = [ICON_FIELD].concat(o.fields || []);
    function input(f) { return container.querySelector('#' + pre + f.field); }
    // The title says Add while the row is new, Change once it was saved or when it was opened from the list.
    function head() { return titleRow(o.look, [added ? 'Add' : 'Change', (o.look && o.look.name) || o.table]); }
    function cell(f, v) {
      var id = pre + f.field;
      if (f.kind === 'bool') return '<input type="checkbox" id="' + id + '"' + (v ? ' checked' : '') + '>';
      if (f.kind === 'secret') return '<input type="password" id="' + id + '" style="' + STRETCH + '" autocomplete="off" placeholder="' + (row[f.field + 'Set'] ? 'set; type to replace' : 'not set') + '">';
      if (f.kind === 'bundle' && bundleHeld[f.field] === false) return '<div id="' + id + '"></div><div>Bundle ' + esc(v) + ' is gone from this node: this ' + esc(o.table) + ' has no grant.</div>';
      if (f.kind === 'pick' || f.kind === 'icon' || f.kind === 'bundle') return '<div id="' + id + '"></div>';
      if (f.kind === 'list') v = Array.isArray(v) ? v.join(', ') : '';
      return '<input type="text" id="' + id + '" style="' + STRETCH + '" value="' + esc(v) + '">';
    }
    function paint() {
      if (gone) return;
      Object.keys(picks).forEach(function (k) { picks[k].destroy(); });
      picks = {};
      Object.keys(bundles).forEach(function (k) { if (bundles[k] && typeof bundles[k].destroy === 'function') bundles[k].destroy(); });
      bundles = {};
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
        simple.map(function (f) {
          var line = fieldLine('<label for="' + pre + f.field + '">' + esc(f.label) + '</label>', cell(f, row[f.field]));
          return f.of && !(narrowCount[f.field] > 0) ? line.replace('<div ', '<div hidden ') : line;
        }).join('') +
        code.map(function (f) { return '<div style="margin-top:1em">' + esc(f.label) + '</div><div class="text-view fill" id="' + pre + f.field + '"></div>'; }).join('') +
        '<div style="margin-top:1em">' + (adding ? '<button type="button" id="' + pre + 'addnew">Add new ' + esc((o.look && o.look.name) || o.table) + '</button>'
          : '<button type="button" id="' + pre + 'delete">Delete</button>') + ' <span id="' + pre + 'note">' + esc(note) + '</span></div></div>';
      fields.forEach(function (f) {
        var el = input(f);
        if ((f.kind === 'name' || f.kind === 'description') && E.fieldInput) E.fieldInput.attach(el, f.kind);
        // A FIELD CHANGED SAVES THE ROW (Andy: "and why the fuck does a row not automatically save when i make a change to a
        // field?"; on Q2: "yes, send the whole row for update. it costs nothing, and we don't need more fucking verbs than
        // necessary."): an input's change, a pick, a bundle picked; there is no Save.
        if (el && f.kind !== 'pick' && f.kind !== 'icon' && f.kind !== 'bundle' && f.kind !== 'code') el.addEventListener('change', save);
        // The row's icon, or its table's while it has none.
        if (f.kind === 'icon') {
          needs(['shell/js/iconSelector.js']).then(function () {
            if (gone || !el.isConnected) return;
            icons[f.field] = E.iconSelector.create(el, { value: row[f.field] || (o.look && o.look.icon) || '' });
            if (icons[f.field] && typeof icons[f.field].addEventListener === 'function') icons[f.field].addEventListener('change', save);
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
          var current = other ? nameOf(Object.assign({ key: row[f.field] }, other), columnsOf(f.pick)) : '';
          needs(['shell/js/probabilitySearch.js', 'shell/js/icon.js']).then(function () {
            if (gone) return;
            picks[f.field] = search(el, { api: o.api, table: f.pick }, Object.assign({
              face: 'dropdown', placeholder: current || 'Pick a ' + f.pick, pick: function () { save(); },
            }, f.of ? narrowedTo(f) : {}));
          });
          // Its table's rows of this row, counted once; a change of whether there are any draws the editor again.
          if (f.of && narrowCount[f.field] === undefined) {
            narrowCount[f.field] = 0;
            var q = { op: 'search', text: '' };
            q[f.of] = o.id;
            call(f.pick, q).then(function (r) {
              var n = r && Array.isArray(r.items) ? r.items.length : 0;
              var mine = narrowKeys[f.field] = narrowKeys[f.field] || {};
              (n ? r.items : []).forEach(function (it) { if (it && it.key != null) mine[String(it.key)] = true; });
              if (!gone && picks[f.field] && typeof picks[f.field].redraw === 'function') picks[f.field].redraw();
              if (gone || n === narrowCount[f.field]) return;
              narrowCount[f.field] = n;
              paint();
            });
          }
        }
        // A BUNDLE FIELD (goal/G41.21; Andy, box v17: "sets it with a bundleSelector in dropdown mode"): the shell's bundle
        // selector, loaded here (rule/26); only a new pick is saved, as for a pick field.
        if (f.kind === 'bundle') {
          needs(['shell/js/bundleSelector.js']).then(function () {
            if (gone || !E.bundleSelector) return;
            // The bundle by its label, as the node has it (Andy: "why would the bundle picker show \"bundle 2\" for it's
            // selection instead of the fucking label?"); its number only once the node has no such bundle.
            var says = !row[f.field] ? 'Pick a bundle' : bundleLabel[f.field] !== undefined ? bundleLabel[f.field] : bundleHeld[f.field] === false ? 'bundle ' + row[f.field] : '…';
            bundles[f.field] = E.bundleSelector.create(el, { api: o.api, placeholder: says });
            if (bundles[f.field] && typeof bundles[f.field].addEventListener === 'function') bundles[f.field].addEventListener('change', save);
          });
          if (row[f.field] && bundleHeld[f.field] === undefined) {
            bundleHeld[f.field] = true;
            var named = row[f.field];
            Promise.resolve(spirit.ready).then(function (s) { return s.auth.bundle({ op: 'get', id: Number(named) }); }).then(function (got) {
              if (gone || String(row[f.field]) !== String(named)) return;
              bundleLabel[f.field] = String((got && got.label) || named);
              paint();
            }, function (e) {
              // The node's word for it (no-such-bundle); any other refusal says nothing of the bundle.
              var code = String((e && (e.code || (e.body && e.body.code))) || '');
              if (gone || !/^no-such-/.test(code) || String(row[f.field]) !== String(named)) return;
              bundleHeld[f.field] = false;
              paint();
            });
          }
        }
      });
      // DELETE ASKS ARE-YOU-SURE (Andy: "and why are the 'Delete' buttons in the detail panels not armingButtons?"): the
      // shell's arming button, loaded here (rule/26); the first press arms, the second deletes.
      if (adding) { container.querySelector('#' + pre + 'addnew').addEventListener('click', addNew); return; }
      var del = container.querySelector('#' + pre + 'delete');
      needs(['shell/js/armingButton.js']).then(function () {
        if (gone || !del.isConnected || !E.armingButton) return;
        E.armingButton.attach(del, { label: 'Delete', run: remove, api: o.api });
      });
    }
    // THE WHOLE ROW, as the verb takes it (Andy, Q2: "yes, send the whole row for update"): every field as the editor shows
    // it, a pick or a bundle not picked again as the row holds it; a secret only when typed, so an untyped key is kept.
    function changes() {
      var out = { op: 'set', id: o.id };
      fields.forEach(function (f) {
        var el = input(f);
        var v;
        if (f.kind === 'bool') v = !!(el && el.checked);
        else if (f.kind === 'code') v = editors[f.field] ? editors[f.field].value() : row[f.field];
        else if (f.kind === 'pick') v = picks[f.field] && picks[f.field].value ? picks[f.field].value : row[f.field];
        else if (f.kind === 'bundle') v = bundles[f.field] && bundles[f.field].value !== '' && bundles[f.field].value != null ? String(bundles[f.field].value) : row[f.field];
        else if (f.kind === 'icon') v = icons[f.field] && icons[f.field].value ? String(icons[f.field].value) : row[f.field];
        else if (f.kind === 'list') v = String((el && el.value) || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        else v = el ? String(el.value || '') : undefined;
        if (f.kind === 'secret' && !v) return;
        if (f.kind === 'url' && !v) return;
        // A pick or a bundle never picked holds no key, so it is not sent (Andy: "when i pick a persona, provider, or a
        // bundle, the UI responds to ALL three of those picker changes with exactly these words: \"Not saved: agent.job:
        // provider must be a peer's public key\"").
        if ((f.kind === 'pick' || f.kind === 'bundle') && (v === '' || v == null)) return;
        if (v !== undefined && v !== null) out[f.field] = v;
      });
      return out;
    }
    // A save and Delete only propose: the editor repaints when the stream writes the row's path (or deletes it), and says
    // a refusal in its note.
    function save() {
      if (adding) return;
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
    // Add new: the mandatory fields missing are said and nothing is made, what was typed kept; with them all, the whole
    // row is added once and the editor becomes its.
    function addNew() {
      var a = changes();
      delete a.id;
      a.op = 'add';
      Object.keys(a).forEach(function (k) { if (k !== 'op') row[k] = a[k]; });
      var lacks = required.filter(function (k) { return a[k] == null || String(a[k]).trim() === ''; });
      if (lacks.length) { note = 'Not added: ' + lacks.join(', ') + (lacks.length > 1 ? ' are' : ' is') + ' required'; paint(); return; }
      call(o.table, a).then(function (r) {
        if (gone) return;
        if (r.refused || !r.id) { note = 'Not added: ' + (r.refused || 'no row'); paint(); return; }
        o.id = r.id;
        adding = false;
        added = false;
        note = 'Added.';
        path = branchOf(o.table) + '/' + o.id;
        attach();
      });
    }
    // THE ROW AS spirit.data HOLDS IT: what the stream writes there repaints this editor, a delete says so.
    var unwatch = function () {};
    function attach() {
    unwatch = D().watch(path, function (p, value) {
      if (value === undefined) { row = null; note = 'Deleted.'; paint(); return; }
      row = value;
      paint();
    });
    // ITS FIRST STATE IS ALWAYS THE SERVER'S get (Andy, on G41.18: "that exactly what GET is for, to bring in the rest for
    // detail panels etc..."): a search answers only the fields its list shows, so what the branch holds may be a slim
    // row. The whole row is put where the stream writes it, and the editor draws from there.
    var had = row;
    row = null;
    if (!had) paint();
    call(o.table, { op: 'get', id: o.id }).then(function (r) {
      if (gone) return;
      if (r.refused) { note = 'Not found: ' + r.refused; paint(); return; }
      D().set(path, r);
      // A set that changes nothing tells no watcher: the editor takes the answer itself.
      if (!row) { row = D().get(path) || r; paint(); }
    });
    }
    if (adding) { row = {}; paint(); } else attach();
    return { destroy: function () { gone = true; unwatch(); Object.keys(picks).forEach(function (k) { picks[k].destroy(); }); Object.keys(bundles).forEach(function (k) { if (bundles[k] && typeof bundles[k].destroy === 'function') bundles[k].destroy(); }); container.innerHTML = ''; } };
  }

  E.agentTable = { create: createTable };
  E.agentRow = { create: createRow };
}());
