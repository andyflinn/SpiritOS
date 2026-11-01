// spirit/run/spirit/contact/clientCacheManager.js
// WHAT A CLIENT KNOWS OF A NODE'S CONTACTS, IN THE contact FAMILY'S OWN FOLDER (goal/G41.28). Andy: "We're not done until
// every family of the API tree as a clientCacheManager, and clients can use that to organize their spirit.data". A page
// loads it through spirit.cacheManager('contact'); it runs the translator into that page's spirit.data, under the node
// that served the rows.
//
// THE BRANCH IS THIS FILE'S, AND ONLY THIS FILE NAMES IT: every reader (the contacts rows and list, the contact
// selector) asks spirit.contactData (below), never a branch by name.
//   contacts   key -> the contact row: what a contact search answered (seated by the lists that are a view of it),
//              present from the relay-presence job, a row the network found from the peer-search job, name from a rename
// What the stream means for contacts (goal/G41.16; moved here from the contacts row element): the relay-presence job
// sets each key's present (a key the table drops goes back to not known), the peer-search job seats each row the network
// found, a contact rename sets its name. Every event ends in set, merge or seat; it asks nothing.
(function (root) {
  var CONTACTS = 'contacts';
  var ATTACHED = typeof Symbol === 'function' ? Symbol.for('spirit.contact.clientCacheManager') : '__contactClientCacheManager';
  function attach(root) {
    var D = ((root || {}).spirit || {}).data;
    if (!D || typeof D.translate !== 'function') return;
    if (D[ATTACHED]) { (root.spirit = root.spirit || {}).contactData = D[ATTACHED]; return; }
    var HOME = D.at(null, 'contact');
    var told = Object.create(null);   // keys the presence table has spoken of, by node
    D.translate({
      onJob: function (job) {
        if (!job || !job.data) return;
        var V = D.at(job.fromNode || null, 'contact');
        if (job.type === 'relay-presence') {
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
        if (job.type === 'peer-search' && job.data.item) V.seat(CONTACTS, [job.data.item]);
      },
      onRename: function (d) { D.at(d && d.fromNode || null, 'contact').merge(CONTACTS + '/' + d.key, { name: String(d.caption || '') }); },
    });
    // THE READS, ANSWERED HERE:
    //   contact(key)   a contact's row, or null;  contacts()  every contact kept, key -> row
    //   watch(fn)      fn(key, row) on every change, row undefined once it is gone; answers its release
    //   branch         the contacts' whole path, for a list that is a view of it (probabilitySearch's data)
    var contactData = {
      contact: function (key) { return key ? HOME.get(CONTACTS + '/' + key) || null : null; },
      contacts: function () { return HOME.branch(CONTACTS); },
      watch: function (fn) { return HOME.watch(CONTACTS, function (whole, v) { if (typeof fn === 'function') fn(HOME.row(whole, CONTACTS), v); }); },
      get branch() { return HOME.path(CONTACTS); },
    };
    try { Object.defineProperty(D, ATTACHED, { value: contactData }); } catch (e) { D[ATTACHED] = contactData; }
    (root.spirit = root.spirit || {}).contactData = contactData;
  }
  if (typeof module !== 'undefined' && module && module.exports) module.exports = { attach: attach };
  // A page without the data set yet loads it first, as part of this file's tree.
  var sp = root.spirit;
  if (sp && !sp.data && typeof sp.require === 'function' && typeof sp.isBrowser === 'function' && sp.isBrowser()) {
    Promise.resolve(sp.require('spirit/spiritData.js')).then(function () { attach(root); }, function () { /* no data set: nothing kept */ });
  } else attach(root);
}(typeof window !== 'undefined' ? window : globalThis));
