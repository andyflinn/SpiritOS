// spirit/run/spirit/element/search/contact/rowElement.js
// ONE CONTACT, AS A ROW ELEMENT (goal/G30.18). Its subject is a public key; its fields presence (the dot), status
// (mine, blocked, held: the row's flags in the one table, goal/G40.11), label (the name, editable in a details dialog)
// and add (a button on a row the owner does not keep). It reads the node's contacts as the contact family's cache
// manager keeps them (spirit.data.contact.data, goal/G41.28), which presence, renames, the network search and every contact
// search keep, so a peer arriving repaints that peer's dot and a rename that peer's label, and nothing else.
// rowElement.js does the shared work; this file says what a contact is.
//
// THE DISPATCH OF CONTACTS: one watch on the contacts for every contact row on the page, and an index by key. A row
// registers on create and leaves on destroy. A row found on the network joins every list through the tree.
//
// What a row offers depends on what it is (goal/G30.19): a kept or blocked row open (Contact), block, unblock and
// remove (contact.forget); a held row add (peer.acquire); a relay open (Relay Details). An action asks and paints
// nothing: the node's confirmed change on the stream repaints. The label's editor
// checks js/fieldRules.js (the one definition both sides use) before it asks contact.label. expandInfo asks contact.get,
// once.
(function () {
  var E = (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (goal/G41.3; Andy: "lazy-load, is a tree...."): its tree, through spirit.require.
  if (window.spirit.require) window.spirit.require('spirit/element/rowElement.js');
  // ITS DOT AND ITS MARK ARE THE ICON ELEMENT (goal/G41.23; Andy, goal/G41.21: "this element will replace icons painting
  // all shell elements and apps."): an icon that stands alone, loaded here too.
  var iconReady = Promise.resolve(window.spirit.require ? window.spirit.require('spirit/element/icon.js') : null).then(null, function () { /* the glyph stays as text */ });
  var contacts = null;

  // A NODE'S CONTACTS ARE THE contact FAMILY'S CACHE (goal/G41.28): what the stream means for them, and their branch, are
  // the family's own data.js's (spirit/contact/data.js), which this element loads itself
  // (rule/26), as part of its tree; a row reads spirit.data.contact.data.
  function contactReads() { return (window.spirit && ((window.spirit.data || {}).contact || {}).data) || null; }
  var contactReady = Promise.resolve(window.spirit.cacheManager('contact')).then(function () { return contactReads(); });

  // ICONS AS THEMSELVES (goal/G30.21): the glyph is written, never a key into a table.
  function esc(s) {
    var f = window.spirit && spirit.escapeHtml;
    return f ? f(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  // A cell is painted as html (the shared row element's paint), so an icon is a place that names its glyph (data-icon),
  // the glyph in it as text; once the cell is in the page, the icon element is made there (iconsIn).
  function iconPlace(glyph, title) {
    return '<span data-icon="' + esc(glyph) + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + esc(glyph) + '</span>';
  }
  function iconsIn(hosts) {
    var I = E.icon;
    if (!hosts || !I || typeof I.create !== 'function') return;
    var p = hosts.presence;
    if (p && typeof p.querySelectorAll === 'function') {
      Array.prototype.forEach.call(p.querySelectorAll('[data-icon]'), function (place) {
        if (place.querySelector('.shell-icon')) return;
        place.textContent = '';
        I.create(place, { glyph: place.getAttribute('data-icon') });
      });
    }
    // The status cell holds its mark alone, or nothing.
    var s = hosts.status;
    var mark = s ? String(s.textContent || '').trim() : '';
    if (s && mark && !(typeof s.querySelector === 'function' && s.querySelector('.shell-icon'))) { s.textContent = ''; I.create(s, { glyph: mark }); }
  }
  // The label's rule, from the one definition (goal/G4.16).
  function nameRules() {
    var R = window.spirit.fieldRules || {};
    return { normalize: R.normalize, problem: R.problem, maxBytes: R.MAX_BYTES };
  }

  function known(key) { var C = contactReads(); return C ? C.contact(key) : null; }
  // A RELAY'S ROW IS KEYED BY ITS OWN ID (goal/G40.11: a row of the one table), and the node marks a relay's own key
  // present while it holds the stream to it (goal/G40.5): its dot is its own key's, like anybody's.
  // A write to data.contacts, by key, to the rows that show that key: only the fields a row shows.
  // Its release answered to the index, which lets it go with the kind's last row (rowElement.index).
  // Made once the contact family's manager is on the page; let go at once if the index lets it go first.
  function dispatch(idx) {
    var off = null;
    var gone = false;
    function listen(C) {
      if (gone || !C || off) return;
      off = C.watch(function (key, v) {
        if (!key || !v) return;
        var changes = {};
        // relay and url too (goal/G41.32; Andy: "where the fuck did the contents of the relayPanel disappear to"): the presence
        // stream can put a row on the page before the search says what it is, so a relay is known as its row says so.
        ['present', 'name', 'keep', 'mine', 'blocked', 'held', 'relay', 'url'].forEach(function (f) { if (f in v) changes[f] = v[f]; });
        idx.forKey(key).forEach(function (el) { el.apply(changes); });
      });
    }
    // At once when the manager is on the page already, so a change in the tick a row mounts is heard.
    listen(contactReads());
    if (!off) contactReady.then(listen);
    return function () { gone = true; if (typeof off === 'function') off(); };
  }
  function index() {
    contacts = contacts || E.rowElement.index(dispatch);
    return contacts;
  }

  function create(row) {
    var r = row || {};
    var key = String(r.key || r.publicKey || '');
    var was = known(key) || {};
    // What it is, from the row as the page holds it, whichever came first: the search's answer or the stream.
    var relay = r.relay === true || was.relay === true;
    // Kept, owned or blocked: the owner has decided about them, and a block has to stay undoable. A held row waits for
    // the yes, which is Add.
    function bookOf(v) { return v.keep === true || v.mine === true || v.blocked === true; }
    var relayActions = [
      // Its page on the navigation (goal/G40.8): the relay's details, an element, no app.
      // The page loads when it is first opened (goal/G41.3), through spirit.require.
      { name: 'open', label: 'Open', run: function (el) {
        return window.spirit.require('spirit/element/relayPanel.js').then(function () { return window.spirit.element.relayPanel.open({ key: el.key }); });
      } },
    ];
    var bookActions = [
      { name: 'open', label: 'Open', run: function (el) {
        return window.spirit.require('spirit/element/contactDetails/contactDetails.js').then(function () { return window.spirit.element.contactDetails.open({ key: el.key }); });
      } },
      // Through the spirit object (goal/G32.2): each a checked call answering the reply's body, refusing otherwise.
      { name: 'block', label: 'Block', run: function (el) { return spirit.ready.then(function (s) { return s.contact.block({ publicKey: el.key }); }); } },
      { name: 'unblock', label: 'Unblock', run: function (el) { return spirit.ready.then(function (s) { return s.contact.unblock({ publicKey: el.key }); }); } },
      { name: 'remove', label: 'Remove', run: function (el) { return spirit.ready.then(function (s) { return s.contact.forget({ publicKey: el.key }); }); } },
    ];
    var heldActions = [
      // Acquired at the relay that found them, under the name they gave it.
      { name: 'add', label: 'Add', run: function (el) {
        var ask = { publicKey: el.key, publicLabel: String(el.row.publicLabel || '') };
        return spirit.ready.then(function (s) { return s.peer.acquire(ask); });
      } },
    ];
    function offered(v) { return v.relay === true ? relayActions : bookOf(v) ? bookActions : heldActions; }
    // WHAT A ROW OFFERS FOLLOWS ITS FLAGS (goal/G40.13): a row added stays on the page and is now a row of the book, so
    // its actions are refilled as the stream moves its flags, never kept as they were when it was made. The one array is
    // the element's own, so its act reads it as it stands.
    var actions = offered(Object.assign({}, r, { relay: relay })).slice();
    var made = null;
    made = E.rowElement.create({
      kind: 'contact',
      key: key,
      index: index(),
      row: { key: key, name: r.name || '', keep: r.keep === true, mine: r.mine === true, blocked: r.blocked === true,
        held: r.held === true, seated: r.seated === true, relay: relay,
        present: was.present !== undefined ? was.present : r.present, url: r.url || '', publicLabel: r.publicLabel || '' },
      fields: [
        // The dot, and what it means on its title, where the question is asked (Contacts' wording, goal/G2.9).
        { name: 'presence', from: ['present'], paint: function (v) {
          var dot = v.present === true ? '🟢' : v.present === false ? '🔴' : '⚪';
          var title = v.present === true ? 'present — a relay says they are connected'
            : v.present === false ? 'absent — a relay says they are not connected'
            : 'not known — no relay you are connected to mentions this key';
          return iconPlace(dot, title);
        } },
        { name: 'status', from: ['mine', 'blocked', 'held'], paint: function (v) {
          // The cell is the mark alone, so the cell itself is its place (iconsIn).
          return v.blocked ? '❌' : v.held ? '⌛' : v.mine ? '⭐' : '';
        } },
        // A RELAY'S LABEL IS MARKED (goal/G41.32; Andy: "the contact list should do something to mark a relay, like print its label in bold-italic.").
        { name: 'label', from: ['name', 'relay'], rule: nameRules(), paint: function (v) { return v.relay === true ? '<b><i>' + esc(v.name) + '</i></b>' : esc(v.name); },
          // In a details dialog: checked here first, then asked; the rename on the stream repaints.
          edit: function (el, text) {
            var R = nameRules();
            var wanted = typeof R.normalize === 'function' ? R.normalize(text) : String(text || '').trim();
            var bad = typeof R.problem === 'function' ? R.problem(wanted) : '';
            if (bad) return Promise.resolve({ ok: false, error: bad });
            return spirit.ready.then(function (s) { return s.contact.label({ publicKey: el.key, myLabel: wanted }); })
              .then(function (body) { return { ok: true, body: body }; }, function (e) { return { ok: false, error: (e && e.message) || 'not renamed' }; });
          } },
        { name: 'add', from: ['keep', 'mine', 'blocked', 'relay'], paint: function (v) {
          return !bookOf(v) && v.relay !== true ? '<button type="button" class="cancel-btn" data-action="add">Add</button>' : '';
        } },
      ],
      actions: actions,
      expand: function (el) {
        if (relay || !bookOf(el.row)) return Promise.resolve(null);
        return spirit.ready.then(function (s) { return s.contact.get({ key: el.key }); });
      },
    });
    // Its icons made in each cell it paints: as it is mounted, once icon.js is in, and after each repaint.
    var hosts = null;
    var mount = made.mount;
    made.mount = function (h) {
      hosts = h || null;
      var out = mount(h);
      iconsIn(hosts);
      iconReady.then(function () { iconsIn(hosts); });
      return out === undefined ? made : out;
    };
    var apply = made.apply;
    made.apply = function (changes) {
      apply(changes);
      iconsIn(hosts);
      var now = offered(made.row);
      if (now[0] === actions[0]) return;
      actions.splice.apply(actions, [0, actions.length].concat(now));
      made.actions = now.map(function (a) { return { name: a.name, label: a.label || a.name }; });
    };
    return made;
  }

  E.contactElement = { create: create };
}());
