// spirit/run/shell/js/contacts/rowElement.js
// ONE CONTACT, AS A ROW ELEMENT (goal/G30.18). Its subject is a public key; its fields presence (the dot), status
// (owned, blocked, held), label (the name, editable in a details dialog) and add (a button on a row the book does not
// hold). It reads data.contacts of the faceless layer (shell/js/spiritData.js, goal/G30.16), which presence, renames, the
// network search and every contact search keep, so a peer arriving repaints that peer's dot and a rename that peer's
// label, and nothing else. rowElement.js does the shared work; this file says what a contact is.
//
// THE DISPATCH OF CONTACTS: one watch on data.contacts for every contact row on the page, and an index by key. A row
// registers on create and leaves on destroy. A row found on the network joins every list through the tree.
//
// What a row offers depends on what it is (goal/G30.19): a row in the book open (Contact), block, unblock and remove
// (contact.forget); a row found on the network add (peer.acquire, at the relay that found it); a relay open (Relay
// Details). An action asks and paints nothing: the node's confirmed change on the stream repaints. The label's editor
// checks js/fieldRules.js (the one definition both sides use) before it asks contact.label. expandInfo asks contact.get,
// once.
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  var contacts = null;
  var subscribed = false;

  // ICONS AS THEMSELVES (goal/G30.21): the glyph is written, never a key into a table.
  function esc(s) {
    var f = window.spirit && spirit.escapeHtml;
    return f ? f(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  // The label's rule, from the one definition (goal/G4.16).
  function nameRules() {
    var R = window.spirit.fieldRules || {};
    return { normalize: R.normalize, problem: R.problem, maxBytes: R.MAX_BYTES };
  }

  function known(key) { var D = window.spirit.data; return (D && D.get('contacts/' + key)) || null; }
  // A RELAY'S ROW FOLLOWS ITS OWN KEY (goal/G40.5). Its row is keyed by its url, the presence table by public keys, and
  // the node marks a relay's own key present while it holds the stream to it. So a relay row reads that key: present
  // while the stream is held, absent otherwise (a relay the node holds no stream to is not connected).
  var relayRows = Object.create(null);   // relay key -> the url its row is keyed by
  // A write to data.contacts, by key, to the rows that show that key: only the fields a row shows.
  function dispatch(idx) {
    if (subscribed || !window.spirit.data) return;
    subscribed = true;
    window.spirit.data.watch('contacts', function (path, v) {
      var key = String(path).slice('contacts/'.length);
      if (!key || !v) return;
      var changes = {};
      ['present', 'name', 'owned', 'blocked', 'held', 'book'].forEach(function (f) { if (f in v) changes[f] = v[f]; });
      idx.forKey(key).forEach(function (el) { el.apply(changes); });
      if (relayRows[key] && 'present' in v) idx.forKey(relayRows[key]).forEach(function (el) { el.apply({ present: v.present === true }); });
    });
  }
  function index() {
    contacts = contacts || E.rowElement.index(dispatch);
    return contacts;
  }

  function create(row) {
    var r = row || {};
    var key = String(r.key || r.publicKey || '');
    var relay = r.kind === 'relay' || r.relay === true;
    var inBook = r.book !== false;
    var was = known(key) || {};
    var relayKey = relay ? String(r.relayKey || '') : '';
    if (relayKey) relayRows[relayKey] = key;
    var actions = relay ? [
      // Its page on the navigation (goal/G40.8): the relay's details, an element, no app.
      { name: 'open', label: 'Open', run: function (el) {
        return window.spirit.elements.natterDetails.open({ url: String(el.row.url || el.key) });
      } },
    ] : inBook ? [
      { name: 'open', label: 'Open', run: function (el) {
        return window.spirit.elements.contactDetails.open({ key: el.key });
      } },
      // Through the spirit object (goal/G32.2): each a checked call answering the reply's body, refusing otherwise.
      { name: 'block', label: 'Block', run: function (el) { return spirit.ready.then(function (s) { return s.contact.block({ publicKey: el.key }); }); } },
      { name: 'unblock', label: 'Unblock', run: function (el) { return spirit.ready.then(function (s) { return s.contact.unblock({ publicKey: el.key }); }); } },
      { name: 'remove', label: 'Remove', run: function (el) { return spirit.ready.then(function (s) { return s.contact.forget({ publicKey: el.key }); }); } },
    ] : [
      // Acquired at the relay that found them, under the name they gave it.
      { name: 'add', label: 'Add', run: function (el) {
        var ask = { publicKey: el.key, via: 'handle', publicLabel: String(el.row.publicLabel || '') };
        if (el.row.relay) ask.url = String(el.row.relay);
        return spirit.ready.then(function (s) { return s.peer.acquire(ask); });
      } },
    ];
    return E.rowElement.create({
      kind: 'contact',
      key: key,
      index: index(),
      row: { key: key, name: r.name || '', owned: r.owned === true, blocked: r.blocked === true, held: r.held === true,
        present: relayKey ? (known(relayKey) || {}).present === true : was.present !== undefined ? was.present : r.present, book: inBook, kind: relay ? 'relay' : (r.kind || 'node'),
        relay: typeof r.relay === 'string' ? r.relay : '', url: r.url || '', publicLabel: r.publicLabel || '' },
      fields: [
        // The dot, and what it means on its title, where the question is asked (Contacts' wording, goal/G2.9).
        { name: 'presence', from: ['present'], paint: function (v) {
          var dot = v.present === true ? '🟢' : v.present === false ? '🔴' : '⚪';
          var title = v.present === true ? 'present — a relay says they are connected'
            : v.present === false ? 'absent — a relay says they are not connected'
            : 'not known — no relay you are connected to mentions this key';
          return '<span title="' + esc(title) + '">' + dot + '</span>';
        } },
        { name: 'status', from: ['owned', 'blocked', 'held'], paint: function (v) {
          return v.blocked ? '❌' : v.held ? '⌛' : v.owned ? '⭐' : '';
        } },
        { name: 'label', from: ['name'], rule: nameRules(), paint: function (v) { return esc(v.name); },
          // In a details dialog: checked here first, then asked; the rename on the stream repaints.
          edit: function (el, text) {
            var R = nameRules();
            var wanted = typeof R.normalize === 'function' ? R.normalize(text) : String(text || '').trim();
            var bad = typeof R.problem === 'function' ? R.problem(wanted) : '';
            if (bad) return Promise.resolve({ ok: false, error: bad });
            return spirit.ready.then(function (s) { return s.contact.label({ publicKey: el.key, myLabel: wanted }); })
              .then(function (body) { return { ok: true, body: body }; }, function (e) { return { ok: false, error: (e && e.message) || 'not renamed' }; });
          } },
        { name: 'add', from: ['book', 'kind'], paint: function (v) {
          return v.book === false && v.kind !== 'relay' ? '<button type="button" class="cancel-btn" data-action="add">Add</button>' : '';
        } },
      ],
      actions: actions,
      expand: function (el) {
        if (relay || !inBook) return Promise.resolve(null);
        return spirit.ready.then(function (s) { return s.contact.get({ key: el.key }); });
      },
    });
  }

  E.contactElement = { create: create };
}());
