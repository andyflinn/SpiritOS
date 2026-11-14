'use strict';
// spirit/run/spirit/app/agent/element/table/rowElement.js
// ONE ROW OF THE AGENT'S TABLES, EDITED IN THE PAGE (goal/G41.4), an element of its own (goal/G41.28; the general test:
// a file registers one element). Each table's elementRow.js names its fields and builds on this one; the title row, the
// field line, the table's searches and the one way to its server are the tables' shared element's (./tableElement.js,
// spirit.element.spirit.app.agent.element.table.tableElement), which this file loads as part of its tree.
//
//   spirit.element.spirit.app.agent.element.table.rowElement.create(container, { table, id, added, look, fields, required }) -> { destroy }
//     one row's fields as inputs, under a title row; added says the row was just made by Add; fields
//     [{ field, label, kind }], the row's icon always the first before them; the kinds are listed in ./tableElement.js.
//
// THE PAGE ONLY PROPOSES (rule/19: "the ui must propose all state changes to the server and only draw changes contained
// in the servers update/change stream"): a field changed and Delete go to the server, and what the editor shows is the
// server's get and the rows its stream then brings, never what was typed.
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the tables' shared element, whose helpers it uses.
  spirit.require('spirit/app/agent/element/table/tableElement.js');
  // And fieldInput, which holds a name or a description field to its rule (goal/G47.1: without it the label took 4096 bytes).
  spirit.require('spirit/element/fieldInput.js');
  var made = 0;
  function A() { return window.spirit.element.spirit.app.agent.element.table.tableElement; }
  function esc(s) { return A().esc(s); }
  function call(table, args) { return A().call(table, args); }
  function needs(paths) { return A().needs(paths); }
  function branchOf(table) { return A().branchOf(table); }
  function titleRow(look, words) { return A().titleRow(look, words); }
  function fieldLine(label, input) { return A().fieldLine(label, input); }
  function nameOf(r, columns) { return A().nameOf(r, columns); }
  function columnsOf(table) { return A().columnsOf(table); }
  function search(host, o, more) { return A().search(host, o, more); }
  function D() { return window.spirit.data; }
  var STRETCH = 'width:100%;box-sizing:border-box';
  // EVERY ROW'S EDITOR OPENS ON ITS ICON (Andy: "the detail panel's first input will be the icon i choose for that row"),
  // chosen with the shell's icon selector (spirit/element/search/icon.js).
  var ICON_FIELD = { field: 'icon', label: 'Icon', kind: 'icon' };

  function createRow(container, options) {
    var o = options || {};
    // UNCONFIGURED, IT SAYS SO and throws nothing (goal/G41.19, box v23: "no throw even unconfigured").
    if (!o.table) {
      container.innerHTML = '<div class="job-manifest-note">not configured: a table of the agent server is required</div>';
      return { destroy: function () { container.innerHTML = ''; } };
    }
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
    // the node has no such bundle. Both are kept by the bundle's id, so a bundle the stream sets is asked for in its turn
    // (Andy: "the bundle picker doesn not let me change values! (actually it does let me change it, i just doesn't seem to
    // hear the change from the server)").
    var bundleHeld = {};
    var bundleLabel = {};
    var pickAsked = {};
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
      if (f.kind === 'bundle' && bundleHeld[v] === false) return '<div id="' + id + '"></div><div>Bundle ' + esc(v) + ' is gone from this node: this ' + esc(o.table) + ' has no grant.</div>';
      if (f.kind === 'pick' || f.kind === 'icon' || f.kind === 'bundle') return '<div id="' + id + '"></div>';
      // AN OUTPUT FIELD IS SHOWN, NEVER PICKED OR SENT (Andy: "In model, the fucking <provider> field is OUTPUT ONLY. I NEVER
      // ordered a fucking picker for that............."): the other table's row by its icon and label, as the branch holds it.
      if (f.kind === 'output') {
        var shown = f.pick && v ? D().getPath(branchOf(f.pick) + '/' + v) : null;
        return '<div id="' + id + '">' + esc(shown ? nameOf(Object.assign({ key: v }, shown), columnsOf(f.pick)) : (v || '')) + '</div>';
      }
      if (f.kind === 'list') v = Array.isArray(v) ? v.join(', ') : '';
      return '<input type="text" id="' + id + '" style="' + STRETCH + '" value="' + esc(v) + '">';
    }
    function dropIcons() {
      Object.keys(icons).forEach(function (k) { if (icons[k] && typeof icons[k].destroy === 'function') icons[k].destroy(); });
      icons = {};
    }
    function paint() {
      if (gone) return;
      Object.keys(picks).forEach(function (k) { picks[k].destroy(); });
      picks = {};
      Object.keys(bundles).forEach(function (k) { if (bundles[k] && typeof bundles[k].destroy === 'function') bundles[k].destroy(); });
      bundles = {};
      editors = {};
      // Each icon picker lets its watches go too (goal/G47.1, -browser: "destroyed, it lets every subscription it made go").
      dropIcons();
      if (!row) { container.innerHTML = '<div class="fill">' + head() + '<div class="agent-block">' + esc(note || 'Loading…') + '</div></div>'; return; }
      var simple = fields.filter(function (f) { return f.kind !== 'code'; });
      var code = fields.filter(function (f) { return f.kind === 'code'; });
      // THE CODE FIELD TAKES THE FREE HEIGHT (Andy: "the codeMirror pane in details must not be allowed to move the
      // pane-dividers of workBench. it's width must be constrained by the middle workbench pane, it is allowed to take up
      // free vertical space"): a fill box whose CodeMirror takes the height left and scrolls inside it (shell.css
      // .text-view.fill). Its width is the centre's, which the workBench holds (spirit/element/workBench.js).
      container.innerHTML = '<div class="fill">' + head() +
        simple.map(function (f) {
          var line = fieldLine('<label for="' + pre + f.field + '">' + esc(f.label) + '</label>', cell(f, row[f.field]));
          return f.of && !(narrowCount[f.field] > 0) ? line.replace('<div ', '<div hidden ') : line;
        }).join('') +
        code.map(function (f) { return '<div class="agent-block">' + esc(f.label) + '</div><div class="text-view fill" id="' + pre + f.field + '"></div>'; }).join('') +
        '<div class="agent-block">' + (adding ? '<button type="button" id="' + pre + 'addnew">Add new ' + esc((o.look && o.look.name) || o.table) + '</button>'
          : '<button type="button" id="' + pre + 'delete">Delete</button>') + ' <span id="' + pre + 'note">' + esc(note) + '</span></div></div>';
      fields.forEach(function (f) {
        var el = input(f);
        if ((f.kind === 'name' || f.kind === 'description') && window.spirit.required.spirit.element.fieldInput) window.spirit.required.spirit.element.fieldInput.attach(el, f.kind);
        // A FIELD CHANGED SAVES THE ROW (Andy: "and why the fuck does a row not automatically save when i make a change to a
        // field?"; on Q2: "yes, send the whole row for update. it costs nothing, and we don't need more fucking verbs than
        // necessary."): an input's change, a pick, a bundle picked; there is no Save.
        if (el && f.kind !== 'pick' && f.kind !== 'icon' && f.kind !== 'bundle' && f.kind !== 'code') el.addEventListener('change', save);
        // The row's icon, or its table's while it has none.
        if (f.kind === 'icon') {
          needs(['spirit/element/search/icon.js']).then(function () {
            if (gone || !el.isConnected) return;
            icons[f.field] = window.spirit.element.spirit.element.search.icon.create(el, { value: row[f.field] || (o.look && o.look.icon) || '' });
            if (icons[f.field] && typeof icons[f.field].addEventListener === 'function') icons[f.field].addEventListener('change', save);
          });
        }
        if (f.kind === 'code') {
          needs(['spirit/element/codeMirror.js']).then(function () {
            return window.spirit.element.spirit.element.codeMirror.create(el, { mode: 'edit', text: String(row[f.field] || ''), path: f.field + '.md' });
          }).then(function (cm) { editors[f.field] = cm; });
        }
        // The field shows the row picked now, by its label from the other table's branch, until another is picked; only a
        // new pick is saved.
        if (f.kind === 'pick') {
          var other = row[f.field] ? D().getPath(branchOf(f.pick) + '/' + row[f.field]) : null;
          // THE PICK NAMES ITS ROW AS THE PANEL OPENS (Andy: "provider details: when the panel opens, pickers must reflect
          // the value or the row field (model)"): a row the page does not hold yet is asked of its table once (get).
          if (row[f.field] && !other && !pickAsked[f.field + '|' + row[f.field]]) {
            pickAsked[f.field + '|' + row[f.field]] = true;
            (function (table, key) {
              call(table, { op: 'get', id: key }).then(function (r) {
                if (gone || !r || r.refused || !r.id) return;
                D().mergePath(branchOf(table) + '/' + key, r);
                paint();
              });
            }(f.pick, row[f.field]));
          }
          var current = other ? nameOf(Object.assign({ key: row[f.field] }, other), columnsOf(f.pick)) : '';
          needs(['spirit/element/search.js', 'spirit/element/icon.js']).then(function () {
            if (gone) return;
            picks[f.field] = search(el, { table: f.pick }, Object.assign({
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
          needs(['spirit/element/search/bundle.js']).then(function () {
            if (gone || !(window.spirit.element.spirit.element.search && window.spirit.element.spirit.element.search.bundle && window.spirit.element.spirit.element.search.bundle.create)) return;
            // The bundle by its label, as the node has it (Andy: "why would the bundle picker show \"bundle 2\" for it's
            // selection instead of the fucking label?"); its number only once the node has no such bundle.
            var says = !row[f.field] ? 'Pick a bundle' : bundleLabel[row[f.field]] !== undefined ? bundleLabel[row[f.field]] : bundleHeld[row[f.field]] === false ? 'bundle ' + row[f.field] : '…';
            bundles[f.field] = window.spirit.element.spirit.element.search.bundle.create(el, { placeholder: says });
            if (bundles[f.field] && typeof bundles[f.field].addEventListener === 'function') bundles[f.field].addEventListener('change', save);
          });
          if (row[f.field] && bundleHeld[row[f.field]] === undefined) {
            bundleHeld[row[f.field]] = true;
            var named = row[f.field];
            Promise.resolve(spirit.ready).then(function (s) { return s.auth.bundle({ op: 'get', id: Number(named) }); }).then(function (got) {
              if (gone || String(row[f.field]) !== String(named)) return;
              bundleLabel[named] = String((got && got.label) || named);
              paint();
            }, function (e) {
              // The node's word for it (no-such-bundle); any other refusal says nothing of the bundle.
              var code = String((e && (e.code || (e.body && e.body.code))) || '');
              if (gone || !/^no-such-/.test(code) || String(row[f.field]) !== String(named)) return;
              bundleHeld[named] = false;
              paint();
            });
          }
        }
      });
      // DELETE ASKS ARE-YOU-SURE (Andy: "and why are the 'Delete' buttons in the detail panels not armingButtons?"): the
      // shell's arming button, loaded here (rule/26); the first press arms, the second deletes.
      if (adding) { container.querySelector('#' + pre + 'addnew').addEventListener('click', addNew); return; }
      var del = container.querySelector('#' + pre + 'delete');
      needs(['spirit/element/armingButton.js']).then(function () {
        if (gone || !del.isConnected || !window.spirit.element.spirit.element.armingButton) return;
        window.spirit.element.spirit.element.armingButton.attach(del, { label: 'Delete', run: remove });
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
        if (f.kind === 'output') return;
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
        // ITS TAB BECOMES THIS ROW'S (goal/G41.31; Andy: "an unsaved add-tab will say: "new  <row-type>*""): said up the page, for
        // whoever holds the editor, since the tab is not this element's.
        if (typeof container.dispatchEvent === 'function' && typeof CustomEvent === 'function') container.dispatchEvent(new CustomEvent('agent-row-added', { bubbles: true, detail: { table: o.table, id: o.id, row: a } }));
      });
    }
    // THE ROW AS spirit.data HOLDS IT: what the stream writes there repaints this editor, a delete says so. Asked of the
    // agent family's cache, which alone names its addresses: its table's branch, watch(id, fn) (spirit/app/agent/data.js).
    var unwatch = function () {};
    function attach() {
    var B = window.spirit.data.agent.data[o.table];
    unwatch = !B ? function () {} : B.watch(o.id, function (value) {
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
      D().setPath(path, r);
      // A set that changes nothing tells no watcher: the editor takes the answer itself.
      if (!row) { row = D().getPath(path) || r; paint(); }
    });
    }
    if (adding) { row = {}; paint(); } else attach();
    return { destroy: function () { gone = true; unwatch(); dropIcons(); Object.keys(picks).forEach(function (k) { picks[k].destroy(); }); Object.keys(bundles).forEach(function (k) { if (bundles[k] && typeof bundles[k].destroy === 'function') bundles[k].destroy(); }); container.innerHTML = ''; } };
  }

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/agent/element/table/rowElement.js', { create: createRow }); });
}());
