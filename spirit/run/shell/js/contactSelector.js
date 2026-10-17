// spirit/run/shell/js/contactSelector.js
// ONE SHELL ELEMENT: the contact selector, the peer picker apps build their screens with.
//
//   Andy, 2026-10-02 (goal/G2.14): "i can guarantee you: there will be many" —
//   so one file per element, each adding itself to window.spiritElements,
//   which the shell hands to apps at mount as api.ui.elements.
//
// A THIN WRAPPER AROUND THE SHARED LIST (goal/G29.6). Andy, 2026-10-17: "now i want the contactSelector to be just a
// wrapper around our new list-selector, what allows an extra (status) column to be added...", and "no fucking
// protecting old design." So the list with its search, its cache, its ranking and its one request on the wire are
// shellCreateListSearch's (shell/shared/js/listSearch.js, goal/G29.4); this file says only what a peer row is.
//
// THE COLUMNS (the item's box): fixed, always, ★ (the contact is my puppet: an owned contact, its signed card naming
// this node its owner, goal/G19.8; "just a star in the one column, that says it all", and "if you want more info, put a
// tooltip on the star"), presence (green or white), the name; then the configurable status column, its icons from
// options.statuses [{status, iconKey}], the first the default (goal/G4.14).
// THE FILTERS: one per state, owned (★), blocked and held, each shown only when the list holds any ("owned, blocked,
// held, (if our list has any)"), each sent to contact.search as a yes-filter.
//
// Rows come from the node's contact.search {q, owned, blocked, held}, its label json {name, owned, blocked, held}; or
// from options.search(text, ask) -> {items: [{key, label}], more}, or options.contacts [{key, label}], a caller's own rows
// (a label that is not json is a name). A row's name is the row's: a rename is published by the node (contact.rename,
// shell.js) and the list asks again.
//
// THE ROOT, as before: .value the chosen key, .row the chosen row, one bubbling `change` on a pick; refresh() asks again;
// present(key, state, title) and mark(key, status) repaint that row from what the list holds, never asking the node.
// options.face 'pane' is the list itself; the default face is the same list under a button, closed by a pick.
// options.status(row), when given, names a row's status from the row itself (Contacts: blocked, held).

(function () {
  var escapeHtml = spirit.core.util.escapeHtml;

  function parseRow(item) {
    var key = String((item && item.key) || '');
    var label = item && item.label;
    var row = null;
    if (typeof label === 'string') { try { row = JSON.parse(label); } catch (e) { row = null; } }
    else if (label && typeof label === 'object') row = label;
    if (!row || typeof row !== 'object') row = { name: typeof label === 'string' ? label : '' };
    row.key = key;
    return row;
  }

  function createContactSelector(options) {
    options = options || {};
    var isPane = options.face === 'pane';
    var ICON = (spirit.core.const && spirit.core.const.ICON) || {};
    var statuses = (Array.isArray(options.statuses) && options.statuses.length) ? options.statuses : [{ status: 'none' }];
    var statusOf = {};
    var presentOf = {};
    var presentTitle = {};
    var list = null;

    var root = document.createElement('div');
    root.className = 'contact-selector ' + (isPane ? 'contact-selector-face-pane' : 'contact-selector-face-dropdown') +
      (options.className ? ' ' + options.className : '');
    root.value = '';
    root.row = null;

    var field = null;
    if (!isPane) {
      field = document.createElement('button');
      field.type = 'button';
      field.className = 'contact-selector-field';
      root.appendChild(field);
    }
    var pane = document.createElement('div');
    pane.className = 'contact-selector-pane';
    root.appendChild(pane);

    function statusGlyph(row) {
      var want = Object.prototype.hasOwnProperty.call(statusOf, row.key) ? statusOf[row.key]
        : (typeof options.status === 'function' ? options.status(row) : undefined);
      var pair = statuses.filter(function (s) { return s && s.status === want; })[0] || statuses[0];
      return (pair && pair.iconKey && ICON[pair.iconKey]) || '';
    }
    function presenceGlyph(key) { return presentOf[key] === true ? (ICON.GREEN_CIRCLE || '●') : (ICON.WHITE_CIRCLE || '○'); }

    function paint(row) {
      var star = row.owned ? '<span title="Your puppet: its card names this node as its owner.">' + (ICON.STAR || '★') + '</span>' : '';
      var pt = presentTitle[row.key];
      return '<td class="icon-cell">' + star + '</td>' +
        '<td class="icon-cell"' + (pt ? ' title="' + escapeHtml(pt) + '"' : '') + '>' + presenceGlyph(row.key) + '</td>' +
        // THE CURRENT ROW (goal/G4.14, Andy: "the pane usually has a \"current\" which is the equivalent of selected in
        // the drop-box"): the chosen key's name drawn as chosen.
        '<td class="label-cell' + (row.key === root.value ? ' current" style="font-weight:bold"' : '"') + '>' + escapeHtml(row.name || row.key) + '</td>' +
        '<td class="icon-cell">' + statusGlyph(row) + '</td>';
    }

    function paintField() {
      if (!field) return;
      var label = root.row ? (root.row.name || root.row.key) : (options.placeholder || 'choose a contact…');
      field.innerHTML = '<span class="contact-selector-name">' + escapeHtml(label) + '</span><span class="contact-selector-caret">▾</span>';
    }
    function setOpen(open) {
      if (isPane) return;
      pane.hidden = !open;
      // Open, the pane stands alone; the button returns when it closes (Andy, goal/G4.10).
      if (field) field.hidden = !!open;
      if (open && list) list.refresh();
    }
    function pick(row) {
      root.value = row.key;
      root.row = row;
      list.redraw();
      paintField();
      setOpen(false);
      root.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // THE ROWS' SOURCE, as the list's api: the node's contact.search, or the caller's own.
    function rows(args) {
      var text = String((args && args.q) || '');
      // The caller's own search gets the words and the whole ask, so the filters reach it too (Contacts asks the node).
      if (typeof options.search === 'function') return Promise.resolve(options.search(text, args || { q: text }));
      if (Array.isArray(options.contacts)) {
        var t = text.toLowerCase();
        return Promise.resolve({ items: options.contacts.filter(function (r) {
          return r && r.key && (!t || String(r.label || '').toLowerCase().indexOf(t) !== -1 || String(r.key).toLowerCase().indexOf(t) !== -1);
        }), more: false });
      }
      return spirit.core.ask('contact.search', args).then(function (a) { return (a && a.body) || {}; });
    }
    var api = {
      verb: function (name, body) {
        var ask = (body && body.ask && body.ask.node) || {};
        return rows(ask['contact.search'] || {}).then(function (answer) {
          var items = ((answer && answer.items) || []).filter(function (i) { return i && i.key; }).map(function (i) {
            return { key: String(i.key), label: JSON.stringify(parseRow(i)) };
          });
          return { status: 200, body: { items: items, more: !!(answer && answer.more), total: Number(answer && answer.total) || items.length } };
        });
      },
      // A rename is the node's word on its stream (contact.rename, said once on document by shell.js).
      onPublished: function (fn) {
        if (typeof document.addEventListener !== 'function') return function () {};
        document.addEventListener('contact.rename', fn);
        return function () { if (typeof document.removeEventListener === 'function') document.removeEventListener('contact.rename', fn); };
      },
    };
    var yes = function (name) { return function (row, value) { return !value || row[name] === true ? 1 : 0; }; };
    var any = function (name) { return function (all) { return all.some(function (r) { return r && r[name] === true; }); }; };
    list = window.spiritElements.shellCreateListSearch(pane, {
      api: api,
      server: 'node',
      verb: 'contact.search',
      args: function (text, filters) {
        var a = { q: text };
        ['owned', 'blocked', 'held'].forEach(function (n) { if (filters[n] === 'yes') a[n] = 'yes'; });
        return a;
      },
      filters: [
        { name: 'owned', choices: [{ value: '', word: 'all' }, { value: 'yes', icon: ICON.STAR || '★', word: 'my puppets' }], test: yes('owned'), when: any('owned') },
        { name: 'blocked', choices: [{ value: '', word: 'all' }, { value: 'yes', icon: ICON.NO || '', word: 'blocked' }], test: yes('blocked'), when: any('blocked') },
        { name: 'held', choices: [{ value: '', word: 'all' }, { value: 'yes', icon: ICON.WAITING || '', word: 'held' }], test: yes('held'), when: any('held') },
      ],
      paint: paint,
      press: function (row) { pick(row); },
      empty: options.empty || 'Nobody matches.',
    });

    root.refresh = function () { list.refresh(); };
    // Whether a key is present now: true green, anything else white; kept by key, so it holds across a redraw.
    root.present = function (key, state, title) {
      presentOf[key] = state === true;
      if (title != null) presentTitle[key] = String(title);
      list.redraw();
    };
    root.mark = function (key, status) { statusOf[key] = status; list.redraw(); };

    if (field) {
      field.addEventListener('click', function () { setOpen(pane.hidden); });
      if (typeof document.addEventListener === 'function') document.addEventListener('click', function (event) {
        if (!pane.hidden && event && event.target && root.contains && !root.contains(event.target)) setOpen(false);
      });
    }
    paintField();
    if (!isPane) pane.hidden = true;
    list.refresh();
    return root;
  }

  window.spiritElements = window.spiritElements || {};
  window.spiritElements.createContactSelector = createContactSelector;
})();
