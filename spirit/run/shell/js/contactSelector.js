// spirit/run/shell/js/contactSelector.js
// ONE SHELL ELEMENT: the contact selector, the peer picker apps build their screens with.
//
//   Andy, 2026-10-02 (goal/G2.14): "i can guarantee you: there will be many" —
//   so one file per element, each adding itself to window.spirit.elements,
//   which the shell hands to apps at mount as api.ui.elements.
//
// A THIN WRAPPER AROUND THE SHELL'S STANDARD LIST, probabilitySearch (shell/js/probabilitySearch.js), which IT LOADS
// ITSELF (rule/26, Andy: "every shell element loads its own elements dynamically through the fucking apirit.require
// functionality", and "there will be NOTHING pre-loaded after the relays-supplied boot scripts"). It stood on the old
// shell's list search (shell/shared/js/listSearch.js) until goal/G41.13, which the face never loads (goal/G40.8: "list
// search is deprecated, and forbidden in face"); its search, cache, ranking and one request on the wire are
// probabilitySearch's now, each row a row element (shell/js/rowElement.js, loaded the same way); this file says only what
// a peer row is.
//
// THE COLUMNS (the item's box): fixed, always, ★ (the contact is my puppet: an owned contact, its signed card naming
// this node its owner, goal/G19.8; "just a star in the one column, that says it all", and "if you want more info, put a
// tooltip on the star"), presence (green or white), the name; then the configurable status column, its icons from
// options.statuses [{status, glyph}], the first the default (goal/G4.14); the glyph itself (goal/G41.1, no icon table).
// THE FILTER: one row, mutually exclusive (goal/G30.7): all, then mine (★), blocked, held and relays, each shown only
// when the list holds any, each sent to contact.search as a yes-filter (mine since goal/G40.11).
//
// Rows come from the node's contact.search {q, mine, blocked, held, ...}, its label json {name, mine, blocked, held, ...}; or
// from options.search(text, ask) -> {items: [{key, label}], more}, or options.contacts [{key, label}], a caller's own rows
// (a label that is not json is a name). A row's name is the row's: a rename is published by the node (contact.rename,
// shell.js) and the list asks again.
//
// THE ROOT: .value the chosen key, .row the chosen row, one bubbling `change` on a pick; refresh() asks again;
// present(key, state, title) and mark(key, status) repaint that row's cell from what the list holds, never asking the
// node. options.face 'pane' is the list itself; the default face is the dropdown: the chosen name in a closed field, the
// list dropping down under it. options.status(row), when given, names a row's status from the row itself (Contacts:
// blocked, held). options.details(row, key, el) is the list's details, as before.
//
// THE CONFIGURABLE ID SELECTOR (goal/G41.13, Andy, Q2: "the loopback-api-location of the ID table, which must be formed
// like the shadow roll : key:ID (ID-field-rules, label (label-field rules)", "table:\"loopback://api/contact/search\"",
// and "if neccessary: key field name ... label field name"): options.table names any ID table of the shadow roll's
// shape as loopback://api/<family>/<verb>, searched through the spirit object at that family and verb with the words
// typed: a search verb takes { text }, a table's one verb (the agent tables', auth.bundle) { op: 'search', text }.
// options.key and options.label name the fields of a row's label json its ID and its label are in; without them the
// item's key is the ID and the row's label (or name) its label. No table, or the contacts' own, is the contacts.

(function () {
  var escapeHtml = function (s) { return window.spirit.escapeHtml(String(s == null ? '' : s)); };
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26). Its marks are the icon element (goal/G41.23; Andy, goal/G41.21: "this
  // element will replace icons painting all shell elements and apps.").
  var parts = function () {
    return Promise.all(['shell/js/probabilitySearch.js', 'shell/js/rowElement.js', 'shell/js/icon.js'].map(function (p) {
      return window.spirit.require ? window.spirit.require(p) : null;
    }));
  };

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
  // The ID table options.table names, { family, verb }, or null for the contacts (none named, or the contacts' own).
  function tableOf(options) {
    var m = /^loopback:\/\/api\/([^/]+)\/([^/]+)$/.exec(String(options.table || ''));
    if (!m || (m[1] === 'contact' && m[2] === 'search')) return null;
    return { family: m[1], verb: m[2] };
  }
  // A row of a configured table: its ID and label from the fields options.key and options.label name.
  function idRow(item, options) {
    var row = parseRow(item);
    var id = options.key && row[options.key] != null ? String(row[options.key]) : row.key;
    var label = options.label && row[options.label] != null ? row[options.label] : (row.label != null ? row.label : row.name);
    return Object.assign({}, row, { key: id, name: String(label == null ? '' : label) });
  }

  function createContactSelector(options) {
    options = options || {};
    var isPane = options.face === 'pane';
    var table = tableOf(options);
    var statuses = (Array.isArray(options.statuses) && options.statuses.length) ? options.statuses : [{ status: 'none' }];
    var statusOf = {};
    var presentOf = {};
    var presentTitle = {};
    var elements = {};      // key -> its row element, so present and mark repaint that row alone
    var list = null;

    var root = document.createElement('div');
    root.className = 'contact-selector ' + (isPane ? 'contact-selector-face-pane' : 'contact-selector-face-dropdown') +
      (options.className ? ' ' + options.className : '');
    root.value = '';
    root.row = null;
    var pane = document.createElement('div');
    pane.className = 'contact-selector-pane';
    root.appendChild(pane);

    function statusGlyph(row) {
      var want = Object.prototype.hasOwnProperty.call(statusOf, row.key) ? statusOf[row.key]
        : (typeof options.status === 'function' ? options.status(row) : undefined);
      var pair = statuses.filter(function (s) { return s && s.status === want; })[0] || statuses[0];
      return (pair && pair.glyph) || '';
    }
    function presenceGlyph(key) { return presentOf[key] === true ? '🟢' : '⚪'; }
    // EACH ROW A ROW ELEMENT: its cells painted from the row and from what present and mark said of its key.
    function element(row, key) {
      var el = window.spirit.elements.rowElement.create({
        kind: 'contact',
        key: key,
        row: row,
        fields: [
          { name: 'mine', paint: function (r) { return r.mine ? '<span title="Yours: a puppet whose card names this node as its owner, or a relay you own.">⭐</span>' : ''; } },
          { name: 'present', paint: function (r) { var t = presentTitle[r.key]; return '<span' + (t ? ' title="' + escapeHtml(t) + '"' : '') + '>' + presenceGlyph(r.key) + '</span>'; } },
          { name: 'name', paint: function (r) { return escapeHtml(r.name || r.key); } },
          { name: 'status', paint: function (r) { return statusGlyph(r); } },
        ],
      });
      // Its mine, presence and status cells each hold one mark standing alone: once painted, the mark is made the icon
      // element in its place (the span that carries its title, or the cell), as it is mounted and after each repaint.
      var hosts = null;
      function iconsIn() {
        var I = window.spirit.elements.icon;
        if (!hosts || !I || typeof I.create !== 'function') return;
        ['mine', 'present', 'status'].forEach(function (name) {
          var h = hosts[name];
          if (!h || (typeof h.querySelector === 'function' && h.querySelector('.shell-icon'))) return;
          var place = h.children && h.children.length === 1 ? h.children[0] : h;
          var glyph = String(place.textContent || '').trim();
          if (!glyph) return;
          place.textContent = '';
          I.create(place, { glyph: glyph });
        });
      }
      var mount = el.mount;
      el.mount = function (h) { hosts = h || null; var out = mount(h); iconsIn(); return out === undefined ? el : out; };
      var apply = el.apply;
      el.apply = function (changes) { var out = apply(changes); iconsIn(); return out; };
      elements[key] = el;
      return el;
    }
    // A cell said again, from what the selector holds: present or mark changed it.
    function repaint(key, field) {
      var el = elements[key];
      if (el && typeof el.apply === 'function') { var change = {}; change[field] = Date.now(); el.apply(change); }
    }
    function pick(row) {
      root.value = row ? row.key : '';
      root.row = row || null;
      root.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // THE ROWS' SOURCE, as the list's api: the node's contact.search, a configured ID table, or the caller's own.
    function rows(args) {
      var text = String((args && (args.q != null ? args.q : args.text)) || '');
      if (typeof options.search === 'function') return Promise.resolve(options.search(text, args || { q: text }));
      if (Array.isArray(options.contacts)) {
        var t = text.toLowerCase();
        return Promise.resolve({ items: options.contacts.filter(function (r) {
          return r && r.key && (!t || String(r.label || '').toLowerCase().indexOf(t) !== -1 || String(r.key).toLowerCase().indexOf(t) !== -1);
        }), more: false });
      }
      if (table) {
        var asked = table.verb === 'search' ? { text: text } : { op: 'search', text: text };
        return Promise.resolve(window.spirit.ready).then(function (s) { return s[table.family][table.verb](asked); }).then(function (b) { return b || {}; });
      }
      return Promise.resolve(window.spirit.ready).then(function (s) { return s.contact.search(args); }).then(function (b) { return b || {}; });
    }
    var api = {
      verb: function (name, body) {
        return rows(body || {}).then(function (answer) {
          var items = ((answer && answer.items) || []).filter(function (i) { return i && i.key; }).map(function (i) {
            var row = table ? idRow(i, options) : parseRow(i);
            return { key: String(row.key), label: JSON.stringify(row) };
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
    var any = function (name) { return function (all) { return all.some(function (r) { return r && r[name] === true; }); }; };

    parts().then(function () {
      list = window.spirit.elements.probabilitySearch.create(pane, {
        face: isPane ? 'pane' : 'dropdown',
        placeholder: isPane ? '' : (options.placeholder || 'choose a contact…'),
        all: isPane ? undefined : options.all,
        api: api,
        server: 'node',
        verb: 'contact.search',
        args: function (text, filters) {
          var a = table ? { text: text } : { q: text };
          if (filters && filters.show && filters.show !== 'all') a[filters.show] = 'yes';
          return a;
        },
        columns: [
          { field: 'mine', label: '' },
          { field: 'present', label: '' },
          { field: 'name', label: 'Name', sort: 'text' },
          { field: 'status', label: '' },
        ],
        matched: function (row) { return { name: row.name || '' }; },
        element: element,
        name: function (row) { return String((row && (row.name || row.key)) || ''); },
        // ONE ROW, MUTUALLY EXCLUSIVE (goal/G30.7; Andy, 2026-10-20: "Gimme 3 Buttons: [all] [⭐ my puppets] [relays] where
        // all 3 are mutually exclusive"): all, then each kind the list holds any of.
        filters: table ? [] : [{
          name: 'show',
          choices: function (all) {
            var out = [{ value: 'all', word: 'all' }];
            if (any('mine')(all)) out.push({ value: 'mine', icon: '⭐', word: 'my puppets' });
            if (any('blocked')(all)) out.push({ value: 'blocked', icon: '❌', word: 'blocked' });
            if (any('held')(all)) out.push({ value: 'held', icon: '⌛', word: 'held' });
            if (any('relay')(all)) out.push({ value: 'relay', word: 'relays' });
            return out;
          },
          test: function (row, value) { return !value || value === 'all' || (row && row[value] === true) ? 1 : 0; },
          when: function (all) { return ['mine', 'blocked', 'held', 'relay'].some(function (n) { return any(n)(all); }); },
        }],
        pick: function (row) { pick(row); },
        details: typeof options.details === 'function' ? options.details : undefined,
        empty: options.empty || 'Nobody matches.',
      });
      list.refresh();
    });

    root.refresh = function () { if (list) list.refresh(); };
    root.present = function (key, state, title) {
      presentOf[key] = state === true;
      if (title != null) presentTitle[key] = String(title);
      repaint(key, 'present');
    };
    root.mark = function (key, status) { statusOf[key] = status; repaint(key, 'status'); };
    return root;
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  // THE SHELL'S ELEMENT SHAPE (goal/G41.19, box v23: "every element gets a container and appends itself"): create(container,
  // options) appends the control to the container and answers it.
  window.spirit.elements.contactSelector = { create: function (container, options) { var root = createContactSelector(options); container.appendChild(root); return root; } };
})();
