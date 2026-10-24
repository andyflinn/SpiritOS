// spirit/run/shell/js/contacts/listElement.js
// THE CONTACTS LIST, A DROP-IN SHELL ELEMENT (goal/G30.19, G30.20). Contacts draws it as a pane, and Join as its contact
// step; grants and introSpector draw it as a dropdown (opts.face, placeholder, all, pick(row, key)). The box:
//   - One search in two tiers. contact.search answers at once from the book and the shadow (the peers the node has
//     heard of), and starts a network search on the node; each network result streams in as one row. All of it lands in
//     data.contacts, the faceless layer (shell/js/spiritData.js, goal/G30.16), and this list is a view of it: every list
//     of contacts on the page shows the same rows.
//   - One list, cached by key: a peer in the book and found on the network is one row. One row of filters instead of
//     two folds: all, my puppets, blocked, held, relays, and at its end a network toggle, off at first (box v8).
//     Columns: presence, status, label (sorts as text), and Add on a row the book does not hold.
//   - Each row is a contactElement and keeps itself current; this paints no presence.
//   - Pressing a row opens it: Contact for a person in the book, Relay Details for a relay. A network row asks that
//     node who it is and says so.
//   - It fills as soon as it is drawn; an empty search answers like any other.
// This node's relays stand beside the book (goal/G30.7): relay.search, a relay row keyed by its url.
//
//   create(host, opts) -> { list, refresh(), destroy() }; list.value and list.row are the one picked in a dropdown
//     opts.api        the app's shell api: verb, peerPost, callDialog
//     opts.face, opts.placeholder, opts.all, opts.pick(row, key)   as probabilitySearch's; a pane opens a pressed row
//     opts.say(text)  where it says what an Add or a card did
//     opts.onAdded(row), opts.onChanged()   after an Add, and after a dialog changed something
//     opts.empty                              the words when nothing matches
(function () {
  // ICONS AS THEMSELVES (goal/G30.21): the glyph is written, never a key into a table.
  // A row of that kind: owned, blocked, held, or a relay (this node's, or one the network or the shadow found).
  function is(kind) {
    return function (row) { return !!row && (kind === 'relay' ? (row.kind === 'relay' || row.relay === true) : row[kind] === true); };
  }

  // ONE ROW OF FILTERS (box v8; Andy: "KILL that [all] AND KILL [book], put [network] at the very and as a toggle, when
  // its on then it shows peers from the network ALSO").
  var FILTERS = [
    // As the contact selector had it (goal/G30.7; Andy, 2026-10-20: "Gimme 3 Buttons: [all] [⭐ my puppets] [relays]
    // where all 3 are mutually exclusive"): all, then each kind the list holds any of.
    { name: 'show',
      choices: function (all) {
        var out = [{ value: 'all', word: 'all' }];
        if (all.some(is('owned'))) out.push({ value: 'owned', icon: '⭐', word: 'my puppets' });
        if (all.some(is('blocked'))) out.push({ value: 'blocked', icon: '❌', word: 'blocked' });
        if (all.some(is('held'))) out.push({ value: 'held', icon: '⌛', word: 'held' });
        if (all.some(is('relay'))) out.push({ value: 'relay', word: 'relays' });
        return out;
      },
      test: function (row, v) { return !v || v === 'all' || is(v)(row) ? 1 : 0; },
      when: function (all) { return ['owned', 'blocked', 'held', 'relay'].some(function (n) { return all.some(is(n)); }); } },
    // At its very end. Off, the book and this node's relays; on, the network's peers (book: false) as well.
    { name: 'network', word: 'network', toggle: true,
      test: function (row, on) { return row.book === false && row.kind !== 'relay' && row.relay !== true ? (on ? 1 : 0) : 1; } },
  ];

  function create(host, opts) {
    var o = opts || {};
    var api = o.api;
    var els = Object.create(null);    // key -> its contactElement, as the list made it
    var relayKeys = Object.create(null);
    var list = null;
    function say(text) { if (typeof o.say === 'function') o.say(text); }
    function body(r) { return (r && r.body) || {}; }

    // THE SOURCE: the book and the shadow (contact.search), this node's relays beside them (relay.search). A relay once
    // added to the book by its key shows once, as the relay.
    function search(args) {
      var q = String((args && args.q) || '').trim();
      // Through the spirit object (goal/G32.2): each answers the reply's body.
      var book = spirit.ready.then(function (s) { return s.contact.search({ q: q }); });
      var relays = spirit.ready.then(function (s) { return s.relay.search({ q: q || '*' }); }).then(null, function () { return { items: [] }; });
      return Promise.all([book, relays]).then(function (got) {
        var rows = (got[1].items || []).map(function (i) {
          var r = null;
          try { r = JSON.parse(i.label); } catch (e) { r = null; }
          if (r && r.relayKey) relayKeys[r.relayKey] = true;
          // owned is the star, as on a puppet: this node owns that relay.
          return { key: i.key, label: JSON.stringify({ name: (r && (r.relayLabel || r.name)) || i.key, kind: 'relay', relay: true, url: i.key, owned: !!(r && r.owned), relayKey: (r && r.relayKey) || '' }) };
        });
        var people = (got[0].items || []).filter(function (i) { return !relayKeys[i.key]; });
        return { status: 200, body: { ok: true, items: people.concat(rows), more: !!got[0].more } };
      });
    }

    // A network row: that node is asked who it is (its card, checked against the key it was addressed to).
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
        if (row.book === false && row.kind !== 'relay') { askCard(row, key); return; }
        if (!el) return;
        Promise.resolve(el.act('open', { callDialog: function (id, params) { return api.callDialog(id, params); } })).then(function (result) {
          if (result && result.changed) { if (typeof o.onChanged === 'function') o.onChanged(); list.refresh(); }
        });
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
    return {
      list: list,
      refresh: function () { list.refresh(); },
      destroy: function () { list.destroy(); },
    };
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.contactList = { create: create, filters: FILTERS };
}());
