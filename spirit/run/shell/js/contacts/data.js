// spirit/run/shell/js/contacts/data.js
// CONTACTS' TRANSLATOR (goal/G30.20): what the stream means for data.contacts (shell/js/spiritData.js). The
// relay-presence job sets each key's present (a key the table drops goes back to not known), the peer-search job seats
// each row the network found, a contact rename sets its name. Every event ends in set or merge. Runs in node too.
(function (root) {
  var D = root.spiritData;
  if (!D || typeof D.translate !== 'function') return;
  var told = Object.create(null);   // keys the presence table has spoken of
  D.translate({
    onJob: function (job) {
      if (job.type === 'relay-presence') {
        var table = job.data.presence || {};
        Object.keys(table).forEach(function (key) {
          var proof = table[key];
          if (!proof || typeof proof !== 'object') return;
          told[key] = true;
          if ((D.branch('contacts')[key] || {}).present !== (proof.present === true)) D.merge('contacts/' + key, { present: proof.present === true });
        });
        Object.keys(told).forEach(function (key) {
          if (key in table) return;
          delete told[key];
          if (D.branch('contacts')[key]) D.merge('contacts/' + key, { present: undefined });
        });
        return;
      }
      if (job.type === 'peer-search' && job.data.item) D.seat('contacts', [job.data.item]);
    },
    onRename: function (d) { D.merge('contacts/' + d.key, { name: String(d.caption || '') }); },
  });
}(typeof window !== 'undefined' ? window : globalThis));
