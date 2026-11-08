// spirit/run/spirit/contact/data.js
// WHAT A CLIENT KNOWS OF A NODE'S CONTACTS, IN THE contact FAMILY'S OWN FOLDER (goal/G41.28). Andy: "We're not done until
// every family of the API tree as a clientCacheManager, and clients can use that to organize their spirit.data". A page
// loads it through spirit.cacheManager('contact'); it runs the translator into that page's spirit.data, under the node
// that served the rows.
//
// THE BRANCH IS THIS FILE'S, AND ONLY THIS FILE NAMES IT: every reader (the contacts rows and list, the contact
// selector) asks spirit.data.contact.data (below), never a branch by name.
//   contacts   key -> the contact row: what a contact search answered (seated by the lists that are a view of it),
//              present from the spirit.contact job, a row the network found from the peer-search job, name from a rename
// What the stream means for contacts (goal/G41.16; moved here from the contacts row element): the spirit.contact job
// sets each key's present (a key the table drops goes back to not known), the peer-search job seats each row the network
// found, a contact rename sets its name, the shadow job sets each row of the one table as it changed. Every event ends in
// set, merge, del or seat; it asks nothing.
(function () {
  var CONTACTS = 'contacts';
  var D = typeof window !== 'undefined' ? window.spirit.data : require('../data.js');
  D.makeFamily('contact', function () {
    var HOME = D.viewAt(null, 'contact');
    var told = Object.create(null);   // keys the presence table has spoken of, by node
    D.addTranslator({
      onJob: function (job) {
        if (!job || !job.data) return;
        var V = D.viewAt(job.fromNode || null, 'contact');
        // THE ONE CONTACT JOB, spirit.contact (goal/G43.20, Q1): presence, a search hit or a row, each event only its own.
        if (job.id !== 'spirit.contact') return;
        if (job.data.presence) {
          var n = V.node();
          var spoke = told[n] = told[n] || Object.create(null);
          var table = job.data.presence || {};
          Object.keys(table).forEach(function (key) {
            var proof = table[key];
            if (!proof || typeof proof !== 'object') return;
            spoke[key] = true;
            if ((V.branch(CONTACTS)[key] || {}).present !== (proof.present === true)) V.merge(CONTACTS + '/' + key, { present: proof.present === true });
          });
          Object.keys(spoke).forEach(function (key) {
            if (key in table) return;
            delete spoke[key];
            if (V.branch(CONTACTS)[key]) V.merge(CONTACTS + '/' + key, { present: undefined });
          });
          return;
        }
        if (job.data.item) V.seat(CONTACTS, [job.data.item]);
        // THE ONE TABLE (goal/G40.11): the node's shadow job hands each row of the contacts table as it changed, people
        // and relays, by its public key; a row gone is let go (moved here from the clients that heard it themselves).
        if (job.data.row && job.data.row.publicKey) {
          var r = job.data.row;
          if (r.gone === true) V.del(CONTACTS + '/' + r.publicKey);
          else V.merge(CONTACTS + '/' + r.publicKey, r);
        }
      },
      onRename: function (d) { D.viewAt(d && d.fromNode || null, 'contact').merge(CONTACTS + '/' + d.key, { name: String(d.caption || '') }); },
    });
    // THE READS, ANSWERED HERE:
    //   contact(key)   a contact's row, or null;  contacts()  every contact kept, key -> row
    //   watch(fn)      fn(key, row) on every change, row undefined once it is gone; answers its release
    //   branch         the contacts' whole path, for a list that is a view of it (probabilitySearch's data)
    var contactReads = {
      contact: function (key) { return key ? HOME.get(CONTACTS + '/' + key) || null : null; },
      contacts: function () { return HOME.branch(CONTACTS); },
      watch: function (fn) { return HOME.watch(CONTACTS, function (whole, v) { if (typeof fn === 'function') fn(HOME.row(whole, CONTACTS), v); }); },
      get branch() { return HOME.path(CONTACTS); },
    };
    return contactReads;
  });
}());
