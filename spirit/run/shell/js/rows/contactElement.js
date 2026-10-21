// spirit/run/shell/js/rows/contactElement.js
// ONE CONTACT, AS A ROW ELEMENT (goal/G30.18). Its subject is a public key; its fields presence (the dot), status
// (owned, blocked, held) and label (the name, editable in a details dialog). It is fed by the relay-presence job and by
// contact renames, so a peer arriving repaints that peer's dot and a rename that peer's label, and nothing else.
// rowElement.js does the shared work; this file says what a contact is.
//
// THE STREAM DISPATCH OF CONTACTS (the box: per kind, in the element's own file): one subscription for every contact
// row on the page, and an index by key. A row registers on create and leaves on destroy.
//
// Actions: open (Contact, the details dialog), block, unblock, remove (contact.forget). An action asks and paints
// nothing: the node's confirmed change on the stream repaints. The label's editor checks js/fieldRules.js (the one
// definition both sides use) before it asks contact.label. expandInfo asks contact.get, once.
(function () {
  var E = window.spiritElements = window.spiritElements || {};
  var contacts = null;

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

  function presenceOf(table, key) {
    var proof = table && table[key];
    return proof && typeof proof === 'object' ? proof.present === true : undefined;
  }
  function dispatch(idx) {
    function take(job) {
      if (!job || job.type !== 'relay-presence') return;
      var table = (job.data && job.data.presence) || {};
      idx.keys().forEach(function (key) {
        var present = presenceOf(table, key);
        idx.forKey(key).forEach(function (el) { el.apply({ present: present }); });
      });
    }
    spirit.core.jobs.subscribe({
      onSnapshot: function (jobs) { (jobs || []).forEach(take); },
      onUpdate: take,
      onContactRename: function (d) {
        if (!d || !d.key) return;
        idx.forKey(String(d.key)).forEach(function (el) { el.apply({ name: String(d.caption || '') }); });
      },
    });
  }

  function create(row) {
    var r = row || {};
    var key = String(r.key || r.publicKey || '');
    contacts = contacts || E.rowElement.index(dispatch);
    return E.rowElement.create({
      kind: 'contact',
      key: key,
      index: contacts,
      row: { key: key, name: r.name || '', owned: r.owned === true, blocked: r.blocked === true, held: r.held === true, present: r.present },
      fields: [
        { name: 'presence', from: ['present'], paint: function (v) {
          var I = icons();
          return v.present === true ? (I.GREEN_CIRCLE || '') : v.present === false ? (I.RED_CIRCLE || '') : (I.WHITE_CIRCLE || '');
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
      ],
      actions: [
        { name: 'open', label: 'Open', run: function (el, ctx) {
          return typeof ctx.callDialog === 'function' ? ctx.callDialog('shell/contactsDetails', { key: el.key }) : null;
        } },
        { name: 'block', label: 'Block', run: function (el) { return spirit.core.ask('contact.block', { publicKey: el.key }); } },
        { name: 'unblock', label: 'Unblock', run: function (el) { return spirit.core.ask('contact.unblock', { publicKey: el.key }); } },
        { name: 'remove', label: 'Remove', run: function (el) { return spirit.core.ask('contact.forget', { publicKey: el.key }); } },
      ],
      expand: function (el) {
        return spirit.core.ask('contact.get', { key: el.key }).then(function (a) { return a && a.body; });
      },
    });
  }

  E.contactElement = { create: create };
}());
