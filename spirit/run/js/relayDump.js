'use strict';

// spirit/run/js/relayDump.js
// WHAT A RELAY HOLDS, ASKED OVER SSH — read-only, until cycle 4's monitor.
//
// Cycle 3 moved the relay's data into relay-state/relay.db (relayStore.js),
// so `cat routingTable.json` no longer answers anything. This is what an
// owner types instead:
//
//   node js/relayDump.js                 counts: members, invites, partners
//   node js/relayDump.js key <publicKey> one member, and any partnership
//   node js/relayDump.js label <label>   who holds a label (at most 10)
//
// NEVER A WHOLE-ROLL PRINT. The roll is not served to anybody (0012
// widened), and a dump that printed it would be the member list back again
// for whoever holds a shell. Counts and lookups answer every question an
// owner has over SSH without it.
//
// Opens the store read-only: no schema created, nothing imported, a write
// throws. Safe beside a running relay.

const path = require('path');
const relayStore = require('./relayStore');

const LABEL_LIMIT = 10;

function short(key) {
  const s = String(key || '');
  return s.length > 20 ? s.slice(0, 12) + '…' + s.slice(-6) : s;
}

function run(rootDir, args, out) {
  if (!relayStore.available()) {
    out('node:sqlite is not available in Node ' + process.version + ' (22.13 or later)');
    return 2;
  }
  const store = relayStore.openReadOnly(rootDir);
  if (!store) {
    out('no relay.db under ' + path.join(rootDir, 'relay-state'));
    return 1;
  }
  try {
    const verb = args[0];
    if (!verb) {
      const partners = store.partners.all();
      const byStatus = {};
      partners.forEach(function (p) { byStatus[p.status] = (byStatus[p.status] || 0) + 1; });
      out('members   ' + store.members.count());
      out('invites   ' + store.invites.all().length);
      out('partners  ' + partners.length +
        (partners.length ? '  ' + JSON.stringify(byStatus) : ''));
      return 0;
    }
    if (verb === 'key' && args[1]) {
      const m = store.members.get(args[1]);
      if (!m) { out('no member with that key'); return 1; }
      out(JSON.stringify(m, null, 2));
      store.partners.byOwner(m.publicKey).forEach(function (p) {
        out('partner   ' + p.status + '  ' + p.url + '  relay ' + short(p.relayKey));
      });
      return 0;
    }
    if (verb === 'label' && args[1]) {
      const rows = store.members.byLabel(args[1], LABEL_LIMIT);
      if (!rows.length) { out('nobody holds that label'); return 1; }
      rows.forEach(function (m) {
        out((m.owner ? 'owner  ' : 'member ') + m.publicLabel + '  ' + m.publicKey);
      });
      if (rows.length === LABEL_LIMIT) out('(first ' + LABEL_LIMIT + ' shown)');
      return 0;
    }
    out('usage: node js/relayDump.js [key <publicKey> | label <label>]');
    return 1;
  } finally {
    store.close();
  }
}

if (require.main === module) {
  process.exitCode = run(path.join(__dirname, '..'), process.argv.slice(2), console.log);
}

module.exports = { run: run };
