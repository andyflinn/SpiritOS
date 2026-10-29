// spirit/run/shell/js/contacts/listElement.js
// THE CONTACTS LIST, A DROP-IN SHELL ELEMENT (goal/G30.19, G30.20). Contacts draws it as a pane, and Join as its contact
// step; grants and introSpector draw it as a dropdown (opts.face, placeholder, all, pick(row, key)). The box:
//   - One search in two tiers. contact.search answers at once from the one table (goal/G40.11): the people and relays
//     the owner keeps, owns, holds or blocked; and starts a network search on the node, whose finds land in the table
//     held, each streaming in as one row. All of it lands in
//     data.contacts, the faceless layer (shell/js/spiritData.js, goal/G30.16), and this list is a view of it: every list
//     of contacts on the page shows the same rows.
//   - One list, cached by key: one row per ID, a relay as well as a person. One row of filters instead of two folds:
//     all, my puppets, blocked, held, relays, and at its end a network toggle, off at first (box v8): on, the held rows
//     the owner has not decided about show as well. Columns: presence, status, label (sorts as text), and Add on a row
//     the owner does not keep.
//   - Each row is a contactElement and keeps itself current; this paints no presence.
//   - Pressing a row opens it: Contact for a person kept, Relay Details for a relay. A held row asks that node who it
//     is and says so.
//   - It fills as soon as it is drawn; an empty search answers like any other.
// This node's relays are rows of the same search (goal/G40.11: relay.search went), each keyed by its ID, its url on it.
//
//   create(host, opts) -> { list, refresh(), destroy() }; list.value and list.row are the one picked in a dropdown
//     opts.api        the app's shell api: verb, peerPost
//     opts.face, opts.placeholder, opts.all, opts.pick(row, key)   as probabilitySearch's; a pane opens a pressed row
//     opts.say(text)  where it says what an Add or a card did
//     opts.onAdded(row)   after an Add
//     opts.empty                              the words when nothing matches
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (goal/G41.3; Andy: "lazy-load, is a tree...."): its tree, through spirit.require.
  if (window.spirit.require) ['shell/js/contacts/rowElement.js', 'shell/js/probabilitySearch.js'].forEach(function (p) { window.spirit.require(p); });
  // ICONS AS THEMSELVES (goal/G30.21): the glyph is written, never a key into a table.
  // A row with that flag: mine, blocked, held, or relay.
  function is(kind) {
    return function (row) { return !!row && row[kind] === true; };
  }
  // Held and nothing else: somebody the owner has not decided about (the network's finds, a stranger who wrote).
  function undecided(row) { return !!row && row.held === true && row.keep !== true && row.mine !== true && row.blocked !== true && row.relay !== true; }

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
        if (all.some(is('held'))) out.push({ value: 'held', icon: '⌛', word: 'held' });
        if (all.some(is('relay'))) out.push({ value: 'relay', word: 'relays' });
        return out;
      },
      test: function (row, v) { return !v || v === 'all' || is(v)(row) ? 1 : 0; },
      when: function (all) { return ['mine', 'blocked', 'held', 'relay'].some(function (n) { return all.some(is(n)); }); } },
    // At its very end. Off, the rows the owner has decided about and this node's relays; on, the held ones as well.
    { name: 'network', word: 'network', toggle: true,
      test: function (row, on) { return undecided(row) ? (on ? 1 : 0) : 1; } },
    // NO NAMELESS ROWS (goal/G40.10, box v15): the presence data marks every key a relay reports present, the relay's own
    // and this node's among them; a key with nothing but its presence is no row until a search or the book names it.
    // No button: it always holds.
    { name: 'named', when: function () { return false; },
      test: function (row) { return row && (row.name || row.relay === true) ? 1 : 0; } },
  ];

  function create(host, opts) {
    var o = opts || {};
    var api = o.api;
    var els = Object.create(null);    // key -> its contactElement, as the list made it
    var list = null;
    function say(text) { if (typeof o.say === 'function') o.say(text); }
    function body(r) { return (r && r.body) || {}; }

    // THE SOURCE: the one table (contact.search, goal/G40.11), people and relays alike.
    function search(args) {
      var q = String((args && args.q) || '').trim();
      // Through the spirit object (goal/G32.2): the reply's body.
      return spirit.ready.then(function (s) { return s.contact.search({ q: q }); }).then(function (got) {
        return { status: 200, body: { ok: true, items: (got && got.items) || [], more: !!(got && got.more) } };
      });
    }

    // A held row: that node is asked who it is (its card, checked against the key it was addressed to).
    function askCard(row, key) {
      say('asking them…');
      Promise.resolve(api.peerPost('', key, { card: true })).then(function (r) {
        var said = (r && r.card) || null;
        if (r && r.ok && said && said.ok) say((said.name || row.name || '') + ': ' + (said.description || 'they have not said anything about themselves'));
        else say('could not reach them — ' + ((said && said.why === 'wrong key') ? 'answered by a different key' : ((said && said.error) || (r && r.error) || 'no answer')));
      }, function (e) { say('could not reach them — ' + ((e && e.message) || e)); });
    }

    list = window.spirit.elements.probabilitySearch.create(host, {
      api: { verb: function (name, args) { return search(args); } },
      data: 'contacts',
      server: 'contact',
      verb: 'search',
      face: o.face,
      placeholder: o.placeholder || 'choose a contact…',
      all: o.all,
      pick: function (row, key) { if (typeof o.pick === 'function') o.pick(row, key); },
      args: function (text) { return { q: text }; },
      columns: [
        { field: 'presence', label: '', width: '1.5em' },
        { field: 'status', label: '', width: '1.5em' },
        { field: 'label', from: 'name', label: 'Name', sort: 'text' },
        { field: 'add', label: '' },
      ],
      element: function (row, key) { var el = window.spirit.elements.contactElement.create(Object.assign({ key: key }, row)); els[key] = el; return el; },
      matched: function (row) { return { name: String((row && row.name) || ''), publicLabel: String((row && row.publicLabel) || '') }; },
      filters: FILTERS,
      details: function (row, key, el) {
        if (undecided(row)) { askCard(row, key); return; }
        if (!el) return;
        // Its page opens on the navigation; what it changes comes back on the stream, so nothing is read when it closes
        // (goal/G40.8: "the stack doesn't need to handle results").
        el.act('open', {});
      },
      empty: o.empty || 'Nobody matches.',
    });

    // A ROW'S OWN BUTTON (Add): the element's action, which asks; the next search repaints the row as in the book.
    host.addEventListener('click', function (e) {
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
    // THE ONE TABLE ON THE STREAM (goal/G40.11): the shadow job hands each row of the table as it changed. A row this
    // list does not show yet that the owner now lists (kept, owned, held, blocked), or a row it shows whose flags moved,
    // makes the list search again; presence alone is the presence data's, and repaints nothing here. It lets go once
    // the list left the page.
    var FLAGS = ['keep', 'mine', 'relay', 'held', 'blocked', 'seated'];
    var rowsStop = null;
    function rowsTake(job) {
      if (!job || job.type !== 'shadow' || !job.data || !job.data.row) return;
      if (!host.isConnected) { if (rowsStop) rowsStop(); return; }
      var row = job.data.row;
      var el = els[row.publicKey];
      var listed = row.keep || row.mine || row.held || row.blocked;
      var moved = el ? (row.gone || FLAGS.some(function (f) { return (el.row && el.row[f] === true) !== (row[f] === true); })) : !!listed;
      if (moved) list.refresh();
    }
    if (window.spirit && window.spirit.events && typeof window.spirit.events.subscribe === 'function') {
      rowsStop = window.spirit.events.subscribe({ onUpdate: rowsTake });
    }
    return {
      list: list,
      refresh: function () { list.refresh(); },
      destroy: function () { list.destroy(); },
    };
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.contactList = { create: create, filters: FILTERS };
}());
