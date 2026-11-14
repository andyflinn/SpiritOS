'use strict';
// spirit/run/spirit/element/search/contact/listElement.js
// THE CONTACTS LIST, A DROP-IN SHELL ELEMENT (goal/G30.19, G30.20). Contacts draws it as a pane, and Join as its contact
// step; introSpector draws it as a dropdown (opts.face, placeholder, all, pick(row, key)); Chat and the grants panel draw it
// through the contact picker (../contact.js). ONE CONTACT LIST (goal/G43.32; Andy: "contact: there should be only 1 list, i
// didn't even know there where two....", "all, any search-unit has ONE list shared by popup and list modes."): what the
// picker drew as a list of its own until then, this list does: any ID table, the caller's hidden filters and its marks.
// The box:
//   - One search in two tiers. contact.search answers at once from the one table (goal/G40.11): the people and relays
//     the owner keeps, owns or blocked; and starts a network search on the node, whose finds stream in, one row each,
//     stored as nothing (goal/G43.17). All of it lands in
//     the contact family's cache (spirit.data.contact.data, goal/G41.28), and this list is a view of it: every list
//     of contacts on the page shows the same rows.
//   - One list, cached by key: one row per ID, a relay as well as a person. One row of filters instead of two folds:
//     all, my puppets, blocked, relays, and at its end a network toggle, off at first (box v8): on, the rows the owner
//     has not decided about show as well. Columns: presence, status, label (sorts as text), and Add on a row
//     the owner does not keep.
//   - Each row is a contact row element (./rowElement.js) and keeps itself current, its presence among it.
//   - Pressing a row opens it: Contact for a person kept, Relay Details for a relay. A row not decided about asks that
//     node who it is and says so.
//   - It fills as soon as it is drawn; an empty search answers like any other.
// This node's relays are rows of the same search (goal/G40.11: relay.search went), each keyed by its ID, its url on it.
//
//   create(host, opts) -> { list, refresh(), mark(key, status), destroy() }; list.value and list.row are the one picked in a dropdown
//     opts.open       the mounter's panel stack's open(key, spec) (spirit/element/panel.js): a row's details open over it (goal/G43.18)
//     opts.face, opts.placeholder, opts.all, opts.pick(row, key)   as probabilitySearch's; a pane opens a pressed row
//     opts.details    a pane's press instead of opening the row; null: a press picks, as Chat's peers pane does
//     opts.filters    [{ name, when, test(row) }], the caller's hidden filters after its own (goal/G41.28; Andy: "Why can't
//                     chatter insert a hidden filter when it draws contacts?")
//     opts.statuses   [{ status, glyph }], the first the default (goal/G4.14): a mark column, each key's set by mark(key,
//                     status), its glyph itself (goal/G41.1, no icon table)
//     opts.say(text)  where it says what an Add or a card did
//     opts.onAdded(row)   after an Add
//     opts.empty                              the words when nothing matches
//
// THE CONFIGURABLE ID TABLE (goal/G41.13, Andy, Q2: "the loopback-api-location of the ID table, which must be formed like the
// shadow roll : key:ID (ID-field-rules, label (label-field rules)", "table:\"loopback://api/contact/search\"", and "if
// neccessary: key field name ... label field name"): opts.table names any ID table of the shadow roll's shape as
// loopback://api/<family>/<verb>, searched through the spirit object at that family and verb with the words typed: a search
// verb takes { text }, a table's one verb (the agent tables', auth.bundle) { op: 'search', text }. opts.key and opts.label
// name the fields of a row's label json its ID and its label are in; without them the item's key is the ID and the row's
// label (or name) its label. opts.data the branch its caller keeps them in. No table, or the contacts' own, is the contacts.
// A table's rows are no contacts: each is a plain row of its label, with no contact filters and nothing to open.
// THE INTERFACES IT CALLS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1; Andy: "EVERY FUCKING ELEMENT REQUIRES THE FUCKING
// INTERFACES IT FUCKING NEEDS"): a require made while this file runs is part of its tree, so whoever requires it waits for them.
if (window.spirit && typeof window.spirit.require === 'function') ['spirit/contact/api.js'].forEach(function (p) { Promise.resolve(window.spirit.require(p)).catch(function () {}); });
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (goal/G41.3; Andy: "lazy-load, is a tree...."): its tree, through spirit.require.
  if (window.spirit.require) ['spirit/element/search/contact/rowElement.js', 'spirit/element/search.js', 'spirit/element/rowElement.js'].forEach(function (p) { window.spirit.require(p); });
  // The contacts it is a view of are the contact family's cache (goal/G41.28), its manager loaded with it.
  window.spirit.cacheManager('contact');
  // ICONS AS THEMSELVES (goal/G30.21): the glyph is written, never a key into a table.
  // A row with that flag: mine, blocked, or relay.
  function is(kind) {
    return function (row) { return !!row && row[kind] === true; };
  }
  // Somebody the owner has not decided about: the network's finds, streamed in and stored as nothing (goal/G43.17).
  function undecided(row) { return !!row && row.keep !== true && row.mine !== true && row.blocked !== true && row.relay !== true; }
  function esc(s) { return window.spirit.escapeHtml(String(s == null ? '' : s)); }

  // ONE ROW OF FILTERS (box v8; Andy: "KILL that [all] AND KILL [book], put [network] at the very and as a toggle, when
  // its on then it shows peers from the network ALSO").
  var FILTERS = [
    // As the contact selector had it (goal/G30.7; Andy, 2026-10-20: "Gimme 3 Buttons: [all] [⭐ my puppets] [relays]
    // where all 3 are mutually exclusive"): all, then each kind the list holds any of.
    { name: 'show',
      choices: function (all) {
        var out = [{ value: 'all', word: 'all' }];
        if (all.some(is('mine'))) out.push({ value: 'mine', icon: '⭐', word: 'my puppets' });
        if (all.some(is('blocked'))) out.push({ value: 'blocked', icon: '❌', word: 'blocked' });
        if (all.some(is('relay'))) out.push({ value: 'relay', word: 'relays' });
        return out;
      },
      test: function (row, v) { return !v || v === 'all' || is(v)(row) ? 1 : 0; },
      when: function (all) { return ['mine', 'blocked', 'relay'].some(function (n) { return all.some(is(n)); }); } },
    // At its very end. Off, the rows the owner has decided about and this node's relays; on, the network's finds as well.
    { name: 'network', word: 'network', toggle: true,
      test: function (row, on) { return undecided(row) ? (on ? 1 : 0) : 1; } },
    // NO NAMELESS ROWS (goal/G40.10, box v15): the presence data marks every key a relay reports present, the relay's own
    // and this node's among them; a key with nothing but its presence is no row until a search or the book names it.
    // No button: it always holds.
    { name: 'named', when: function () { return false; },
      test: function (row) { return row && (row.name || row.relay === true) ? 1 : 0; } },
  ];

  // A PACKET TO A PEER, THROUGH THE SPIRIT OBJECT (goal/G43.24; Andy: "every element that accesses ANY api must require them
  // themselves"): spirit.peerPost, which puts the body in its packet envelope, with the node's whole answer, { ok, body,
  // card, error }; the card a card ask brings is the node's verified one (spirit/peerPost.js, answer.card).
  function peerPost(app, key, body) {
    return window.spirit.peerPost(String(key), app, body, { answer: true });
  }

  // The ID table opts.table names, { family, verb }, or null for the contacts (none named, or the contacts' own).
  function tableOf(o) {
    var m = /^loopback:\/\/api\/([^/]+)\/([^/]+)$/.exec(String(o.table || ''));
    if (!m || (m[1] === 'contact' && m[2] === 'search')) return null;
    return { family: m[1], verb: m[2] };
  }
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
  // A row of a configured table: its ID and label from the fields opts.key and opts.label name.
  function idRow(item, o) {
    var row = parseRow(item);
    var id = o.key && row[o.key] != null ? String(row[o.key]) : row.key;
    var label = o.label && row[o.label] != null ? row[o.label] : (row.label != null ? row.label : row.name);
    return Object.assign({}, row, { key: id, name: String(label == null ? '' : label) });
  }

  function create(host, opts) {
    var o = opts || {};
    var table = tableOf(o);
    var els = Object.create(null);    // key -> its row element, as the list made it
    var list = null;
    var marks = Object.create(null);  // key -> its status, mark(key, status)
    var statuses = Array.isArray(o.statuses) && o.statuses.length ? o.statuses : null;
    function say(text) { if (typeof o.say === 'function') o.say(text); }
    function markOf(key) {
      if (!statuses) return '';
      var pair = statuses.filter(function (s) { return s && s.status === marks[key]; })[0] || statuses[0];
      return (pair && pair.glyph) || '';
    }

    // THE SOURCE: the one table (contact.search, goal/G40.11), people and relays alike; or the ID table it was handed.
    function search(args) {
      var q = String((args && (args.q != null ? args.q : args.text)) || '').trim();
      // Through the spirit object (goal/G32.2): the reply's body.
      if (table) {
        var asked = table.verb === 'search' ? { text: q } : { op: 'search', text: q };
        return spirit.ready.then(function (s) { return s[table.family][table.verb](asked); }).then(function (got) {
          var items = ((got && got.items) || []).filter(function (i) { return i && i.key; }).map(function (i) { var r = idRow(i, o); return { key: String(r.key), label: JSON.stringify(r) }; });
          return { status: 200, body: { ok: true, items: items, more: !!(got && got.more) } };
        });
      }
      return spirit.ready.then(function (s) { return s.contact.search({ q: q }); }).then(function (got) {
        return { status: 200, body: { ok: true, items: (got && got.items) || [], more: !!(got && got.more) } };
      });
    }

    // A row not decided about: that node is asked who it is (its card, checked against the key it was addressed to).
    function askCard(row, key) {
      say('asking them…');
      Promise.resolve(peerPost('', key, { card: true })).then(function (r) {
        var said = (r && r.card) || null;
        if (r && r.ok && said && said.ok) say((said.name || row.name || '') + ': ' + (said.description || 'they have not said anything about themselves'));
        else say('could not reach them — ' + ((said && said.why === 'wrong key') ? 'answered by a different key' : ((said && said.error) || (r && r.error) || 'no answer')));
      }, function (e) { say('could not reach them — ' + ((e && e.message) || e)); });
    }

    // A ROW OF AN ID TABLE: its label and the caller's mark, no contact's actions.
    var idIndex = null;
    function idElement(row, key) {
      var R = window.spirit.element.spirit.element.rowElement;
      idIndex = idIndex || R.index(function () {});
      var el = R.create({ kind: 'id', key: String(key), index: idIndex, row: Object.assign({ mark: 0 }, row, { key: String(key) }),
        fields: [
          { name: 'label', from: ['name'], paint: function (v) { return esc(v.name || v.key); } },
          { name: 'mark', from: ['mark'], paint: function (v) { return esc(markOf(v.key)); } },
        ],
        actions: [] });
      els[key] = el;
      return el;
    }
    function contactElement(row, key) {
      var el = window.spirit.element.spirit.element.search.contact.rowElement.create(Object.assign({ key: key }, row), { open: o.open, mark: markOf });
      els[key] = el;
      return el;
    }
    var columns = table ? [{ field: 'label', from: 'name', label: 'Name', sort: 'text' }] : [
      { field: 'presence', label: '', width: '1.5em' },
      { field: 'status', label: '', width: '1.5em' },
      { field: 'label', from: 'name', label: 'Name', sort: 'text' },
      { field: 'add', label: '' },
    ];
    if (statuses) columns.push({ field: 'mark', label: '', width: '1.5em' });
    var details = o.details === null ? undefined : typeof o.details === 'function' ? o.details : table ? undefined : function (row, key, el) {
      if (undecided(row)) { askCard(row, key); return; }
      if (!el) return;
      // Its page opens on the navigation; what it changes comes back on the stream, so nothing is read when it closes
      // (goal/G40.8: "the stack doesn't need to handle results").
      el.act('open', {});
    };

    list = window.spirit.element.spirit.element.search.create(host, {
      // Its own data source (goal/G43.24): the search asks it, and is handed no api.
      search: search,
      // A view of the node's contacts, the branch the contact family's manager keeps (spirit.data.contact.data.branch); an
      // ID table of another family is the branch its caller names.
      data: o.data || (table ? undefined : window.spirit.data.contact.data.branch),
      server: table ? table.family : 'contact',
      verb: table ? table.verb : 'search',
      face: o.face,
      placeholder: o.placeholder || 'choose a contact…',
      all: o.all,
      pick: function (row, key) { if (typeof o.pick === 'function') o.pick(row, key); },
      args: function (text) { return table ? { text: text } : { q: text }; },
      name: function (row) { return String((row && (row.name || row.key)) || ''); },
      columns: columns,
      element: table ? idElement : contactElement,
      filters: (table ? [] : FILTERS).concat(Array.isArray(o.filters) ? o.filters : []),
      details: details,
      empty: o.empty || 'Nobody matches.',
    });

    // A ROW'S OWN BUTTON (Add): the element's action, which asks; the next search repaints the row as in the book.
    if (!table) host.addEventListener('click', function (e) {
      var t = e && e.target;
      var b = t && typeof t.closest === 'function' ? t.closest('[data-action]') : null;
      if (!b) return;
      var tr = b.closest('[data-key]');
      var el = tr ? els[tr.getAttribute('data-key')] : null;
      if (!el) return;
      say('adding…');
      // The action answers the reply's body, or refuses with the node's words (any 2xx is the node saying yes).
      Promise.resolve(el.act(b.getAttribute('data-action'), {})).then(function (row) {
        row = row || {};
        say(row.publicLabel ? 'added ' + row.publicLabel : 'added');
        if (typeof o.onAdded === 'function') o.onAdded(row);
        list.refresh();
      }, function (err) { say('could not add: ' + ((err && err.message) || err)); });
    });

    list.refresh();
    // THE ONE TABLE (goal/G40.11) IS THE CONTACT FAMILY'S CACHE (goal/G41.28): each row the shadow job hands as it changed
    // is merged into the contacts branch by its manager, and this list, a view of that branch, redraws a row whose flags
    // moved by itself; it hears no stream of its own.
    return {
      list: list,
      refresh: function () { list.refresh(); },
      // A key's mark said again, from what the list holds; only that row's mark cell repaints.
      mark: function (key, status) {
        marks[key] = status;
        var el = els[key];
        if (el && typeof el.apply === 'function') el.apply({ mark: Date.now() });
      },
      // Destroy leaves its host empty (goal/G41.19, box v23: "destroy empties it"), its filters with it.
      destroy: function () { if (list) list.destroy(); host.innerHTML = ''; },
    };
  }

  (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/search/contact/listElement.js', { create: create, filters: FILTERS }); });
}());
