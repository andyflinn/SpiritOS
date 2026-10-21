// spirit/run/shell/js/rows/contactElement.js
// ONE CONTACT, AS A ROW ELEMENT (goal/G30.18). Its subject is a public key; its fields presence (the dot), status
// (owned, blocked, held), label (the name, editable in a details dialog) and add (a button on a row the book does not
// hold). It is fed by the relay-presence job and by contact renames, so a peer arriving repaints that peer's dot and a
// rename that peer's label, and nothing else. rowElement.js does the shared work; this file says what a contact is.
//
// THE STREAM DISPATCH OF CONTACTS (the box: per kind, in the element's own file): one subscription for every contact
// row on the page, and an index by key. A row registers on create and leaves on destroy. The same subscription carries
// the network search (goal/G30.19): each update of the 'peer-search' job is one row found, handed to found(fn), so a
// list adds the people it did not have.
//
// What a row offers depends on what it is (goal/G30.19): a row in the book open (Contact), block, unblock and remove
// (contact.forget); a row found on the network add (peer.acquire, at the relay that found it); a relay open (Relay
// Details). An action asks and paints nothing: the node's confirmed change on the stream repaints. The label's editor
// checks js/fieldRules.js (the one definition both sides use) before it asks contact.label. expandInfo asks contact.get,
// once.
(function () {
  var E = window.spiritElements = window.spiritElements || {};
  var contacts = null;
  var subscribed = false;
  var finders = [];
  var table = null;
  var told = Object.create(null);   // keys the presence table has spoken of

  function icons() { return (window.spirit && spirit.core && spirit.core.const && spirit.core.const.ICON) || {}; }
  function esc(s) {
    var f = window.spirit && spirit.core && spirit.core.util && spirit.core.util.escapeHtml;
    return f ? f(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  // The label's rule, from the one definition (goal/G4.16).
  function nameRules() {
    var R = window.spiritFieldRules || {};
    return { normalize: R.normalize, problem: R.problem, maxBytes: R.MAX_BYTES };
  }

  function presenceOf(t, key) {
    var proof = t && t[key];
    return proof && typeof proof === 'object' ? proof.present === true : undefined;
  }
  function dispatch(idx) {
    if (subscribed) return;
    subscribed = true;
    function take(job) {
      if (!job) return;
      if (job.type === 'peer-search') {
        var item = job.data && job.data.item;
        if (item && item.key) finders.slice().forEach(function (fn) { try { fn(item); } catch (e) { /* one list's fault */ } });
        return;
      }
      if (job.type !== 'relay-presence') return;
      table = (job.data && job.data.presence) || {};
      idx.keys().forEach(function (key) {
        // A key the table never mentioned keeps what its row said (the relay that found it): the nearer answer wins. A
        // key it mentioned and dropped goes white: nobody is in a position to say any more.
        var present = presenceOf(table, key);
        if (present === undefined) {
          if (!told[key]) return;
          delete told[key];
        } else told[key] = true;
        idx.forKey(key).forEach(function (el) { el.apply({ present: present }); });
      });
    }
    spirit.core.jobs.subscribe({
      // The snapshot's presence only: a network row found before this page opened is not news.
      onSnapshot: function (jobs) { (jobs || []).forEach(function (j) { if (j && j.type === 'relay-presence') take(j); }); },
      onUpdate: take,
      onContactRename: function (d) {
        if (!d || !d.key) return;
        idx.forKey(String(d.key)).forEach(function (el) { el.apply({ name: String(d.caption || '') }); });
      },
    });
  }
  function index() {
    contacts = contacts || E.rowElement.index(dispatch);
    return contacts;
  }

  // The network search's rows, one { key, label } at a time; answers the unsubscribe.
  function found(fn) {
    if (typeof fn !== 'function') return function () {};
    finders.push(fn);
    dispatch(index());
    return function () { finders = finders.filter(function (x) { return x !== fn; }); };
  }

  function create(row) {
    var r = row || {};
    var key = String(r.key || r.publicKey || '');
    var relay = r.kind === 'relay' || r.relay === true;
    var inBook = r.book !== false;
    var known = presenceOf(table, key);
    var actions = relay ? [
      { name: 'open', label: 'Open', run: function (el, ctx) {
        return typeof ctx.callDialog === 'function' ? ctx.callDialog('shell/natterDetails', { url: String(el.row.url || el.key) }) : null;
      } },
    ] : inBook ? [
      { name: 'open', label: 'Open', run: function (el, ctx) {
        return typeof ctx.callDialog === 'function' ? ctx.callDialog('shell/contactsDetails', { key: el.key }) : null;
      } },
      { name: 'block', label: 'Block', run: function (el) { return spirit.core.ask('contact.block', { publicKey: el.key }); } },
      { name: 'unblock', label: 'Unblock', run: function (el) { return spirit.core.ask('contact.unblock', { publicKey: el.key }); } },
      { name: 'remove', label: 'Remove', run: function (el) { return spirit.core.ask('contact.forget', { publicKey: el.key }); } },
    ] : [
      // Acquired at the relay that found them, under the name they gave it.
      { name: 'add', label: 'Add', run: function (el) {
        return spirit.core.ask('peer.acquire', { publicKey: el.key, url: String(el.row.relay || ''), via: 'handle', publicLabel: String(el.row.publicLabel || '') });
      } },
    ];
    return E.rowElement.create({
      kind: 'contact',
      key: key,
      index: index(),
      row: { key: key, name: r.name || '', owned: r.owned === true, blocked: r.blocked === true, held: r.held === true,
        present: known !== undefined ? known : r.present, book: inBook, kind: relay ? 'relay' : (r.kind || 'node'),
        relay: typeof r.relay === 'string' ? r.relay : '', url: r.url || '', publicLabel: r.publicLabel || '' },
      fields: [
        // The dot, and what it means on its title, where the question is asked (Contacts' wording, goal/G2.9).
        { name: 'presence', from: ['present'], paint: function (v) {
          var I = icons();
          var dot = v.present === true ? (I.GREEN_CIRCLE || '') : v.present === false ? (I.RED_CIRCLE || '') : (I.WHITE_CIRCLE || '');
          var title = v.present === true ? 'present — a relay says they are connected'
            : v.present === false ? 'absent — a relay says they are not connected'
            : 'not known — no relay you are connected to mentions this key';
          return '<span title="' + esc(title) + '">' + dot + '</span>';
        } },
        { name: 'status', from: ['owned', 'blocked', 'held'], paint: function (v) {
          var I = icons();
          return v.blocked ? (I.NO || '') : v.held ? (I.WAITING || '') : v.owned ? (I.STAR || '') : '';
        } },
        { name: 'label', from: ['name'], rule: nameRules(), paint: function (v) { return esc(v.name); },
          // In a details dialog: checked here first, then asked; the rename on the stream repaints.
          edit: function (el, text) {
            var R = nameRules();
            var wanted = typeof R.normalize === 'function' ? R.normalize(text) : String(text || '').trim();
            var bad = typeof R.problem === 'function' ? R.problem(wanted) : '';
            if (bad) return Promise.resolve({ ok: false, error: bad });
            return spirit.core.ask('contact.label', { publicKey: el.key, myLabel: wanted });
          } },
        { name: 'add', from: ['book', 'kind'], paint: function (v) {
          return v.book === false && v.kind !== 'relay' ? '<button type="button" class="cancel-btn" data-action="add">Add</button>' : '';
        } },
      ],
      actions: actions,
      expand: function (el) {
        if (relay || !inBook) return Promise.resolve(null);
        return spirit.core.ask('contact.get', { key: el.key }).then(function (a) { return a && a.body; });
      },
    });
  }

  E.contactElement = { create: create, found: found };
}());
