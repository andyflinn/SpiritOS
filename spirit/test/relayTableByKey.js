'use strict';

// spirit/test/relayTableByKey.js
// goal/G19.15, carried into goal/G40.11: the node's relay records live in ONE table in node.db, keyed by the relay's
// public key. The URL is an address held on the record, not its identity. Since goal/G40.11 that table is seen, the
// one table for all known IDs (Andy's box, v24: "contacts.json, the relays table and the peers table move into it and
// go"): a relay is a row flagged relay, its url a direct route (seen_routes: via empty, at the relay's own key), the
// list the relays kept.
//
// ANDY'S DECISIONS (2026-10-12), asserted here and not revisited:
//   - "the authoritative info about relays on the node MUST be by ID (key)"
//   - "let's move the relays into node.db ... on boot, the node asserts the contents of "noderoutes.net" and
//     spirit.andyflinn.com in the database, by creating those rows, if they don't exist."
//   - "we will pre-seed WITH keys, we know those key, after all."
//   - SUPERSEDING "both keys ship": "No, now that we have it, we only list noderoutes.net, spirit.andyflinn.com is
//     OURS." The install seeds noderoutes.net alone; spirit is neither seeded nor trusted from install, and a node
//     that uses it claims there. A spirit row a node already has, keyed in the old files, is imported as usual.
//   - "there will be only ONE relay table in node.db." The first boot copied every keyed row of relays.json and
//     relayKeys.json into it and deleted both files (goal/G19.15); since goal/G40.11 that move lands in seen, each
//     pinned url a relay row with its url a direct route.
//   - noderoutes.net stays the floor that is never removed (goal/G16.3).
//
// WHAT IS ASSERTED
//   1. node.db has no relays table: a relay is a row of seen, keyed by the relay key, flagged relay, its url a route.
//   2. A boot on an empty relay-state yields exactly one seed row, noderoutes.net with its key; spirit is not seeded.
//   3. A boot with the old files moves every pinned url into the table (kept where it was listed, under its label;
//      seated), skips a listed relay with no pin, then deletes both files.
//   4. A second boot changes nothing; a seed already present is neither duplicated nor overwritten.
//   5. relayKeys and ownerBadge read and write through the table; neither file is ever written again.
//   6. noderoutes.net still cannot be removed.
//   7. The seed keys are data in one place.
//
// "Boot" is ownerBadge.ensureRelays, the call server.js makes before presence. Temp roots of this suite's own.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const ownerBadge = require('../run/spirit/ownerBadge.js');
const relayKeys = require('../run/spirit/relayKeys.js');
const nodeStore = require('../run/spirit/nodeStore.js');

const OWED = 'OWED by goal/G19.15: ';
const JS = path.join(__dirname, '..', 'run', 'spirit');

const SPIRIT = { url: 'https://spirit.andyflinn.com', key: 'MCowBQYDK2VwAyEAV2NFEWo+LGgWl0WRr6M8gWDiRfdn4tKTKEdkbCAsCR4=' };
const ROUTES = { url: 'https://noderoutes.net', key: 'MCowBQYDK2VwAyEA+4mt2XtbJHPmiyCri6HRaA/PyH4EPGYE/ez+YpE72Ls=' };

const LAB = { url: 'http://127.0.0.1:4100', key: 'MCowBQYDK2VwAyEAlabrelaylabrelaylabrelaylabrelaylabrelay0=' };
const GONE = { url: 'https://gone.example', key: 'MCowBQYDK2VwAyEAgonerelaygonerelaygonerelaygonerelaygone0=' };
const NOPIN = 'https://nopin.example';
const NEWR = { url: 'https://new.example', key: 'MCowBQYDK2VwAyEAnewrelaynewrelaynewrelaynewrelaynewrelay00=' };

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
function there(p) { try { fs.statSync(p); return true; } catch (e) { return false; } }
function freshRoot(tag) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-relaytable-' + tag + '-'));
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  // A node's root holds its identity (goal/G22.5): what a relay calls it is its name (relayKeys.seatLabel).
  const auth = require('../run/spirit/relayAuth.js');
  auth.saveIdentity(root, auth.generateIdentity('relaytable-' + tag));
  return root;
}
function oldFiles(root) {
  return {
    relays: there(path.join(root, 'relay-state', 'relays.json')),
    keys: there(path.join(root, 'relay-state', 'relayKeys.json')),
  };
}

// A second connection, read only, so what is asserted is the file on disc and not any module's view of it.
function query(root, sql) {
  const file = nodeStore.dbPath(root);
  if (!there(file)) return null;
  const db = new (require('node:sqlite').DatabaseSync)(file, { readOnly: true });
  try { return db.prepare(sql).all(); }
  catch (e) { return { error: String(e.message || e) }; }
  finally { db.close(); }
}
// Every relay row of the one table, with its url (its direct route), as { key, url, myLabel, keep, seated }.
function tableRows(root) {
  const r = query(root, "SELECT s.publicKey AS key, r.url AS url, s.myLabel AS myLabel, s.keep AS keep, s.seated AS seated " +
    "FROM seen s LEFT JOIN seen_routes r ON r.publicKey = s.publicKey AND r.via = '' AND r.at = s.publicKey " +
    "WHERE s.relay = 1 ORDER BY s.publicKey");
  return Array.isArray(r) ? r : [];
}
function rowOf(root, key) {
  return tableRows(root).filter(function (r) { return r.key === key; });
}

test.startTest('Relay records on the node, in one node.db table keyed by the relay key (goal/G19.15)');

// ── 1 + 2. A FRESH NODE ─────────────────────────────────────────────────
test.subHeading('1. no relays table: a relay is a row of the one table, keyed by its key; 2. a fresh boot yields the seed');
{
  const root = freshRoot('fresh');
  let seeded = null;
  try { seeded = ownerBadge.ensureRelays(root); } catch (e) { seeded = { threw: String(e.message || e) }; }

  const cols = query(root, 'PRAGMA table_info(seen)');
  const pk = Array.isArray(cols) ? cols.filter(function (c) { return c.pk > 0; }).map(function (c) { return c.name; }) : [];
  const names = Array.isArray(cols) ? cols.map(function (c) { return c.name; }) : [];
  if (pk.length === 1 && pk[0] === 'publicKey' && names.indexOf('relay') !== -1 && names.indexOf('url') === -1) {
    test.check('a relay is a row of seen, keyed by its key alone, flagged relay; the url is no column of it');
  } else test.fail('seen is not the relays\' table: ' + short(cols));
  const routeCols = query(root, 'PRAGMA table_info(seen_routes)');
  if (Array.isArray(routeCols) && routeCols.some(function (c) { return c.name === 'url'; })) test.check('and the url is a route on the record, not its identity');
  else test.fail('seen_routes has no url: ' + short(routeCols));

  // NO relay table of its own: nothing in node.db but seen names who a relay is. relay_record is the relays'
  // REPORTS (cycle 11), which is a record of figures, not of who a relay is.
  const tables = query(root, "SELECT name FROM sqlite_schema WHERE type = 'table'");
  const relayish = Array.isArray(tables) ? tables.map(function (t) { return t.name; })
    .filter(function (n) { return /relay/i.test(n) && n !== 'relay_record'; }) : [];
  if (Array.isArray(tables) && relayish.length === 0) test.check('and there is no relays table beside it');
  else test.fail('relay tables in node.db: ' + short(relayish));

  const rows = tableRows(root);
  const byKey = {};
  rows.forEach(function (r) { byKey[r.key] = r; });
  if (rows.length === 1 && byKey[ROUTES.key] && byKey[ROUTES.key].url === ROUTES.url) {
    test.check('an empty relay-state boots to exactly one seed row, noderoutes.net under its shipped key');
  } else {
    test.fail(OWED + 'the fresh table is not the one keyed seed: ' + short(rows));
  }

  const listed = Array.isArray(seeded) ? seeded.map(function (r) { return r.url; }) : [];
  if (listed.length === 1 && listed[0] === ROUTES.url) {
    test.check('and ensureRelays hands back that one row');
  } else {
    test.fail(OWED + 'ensureRelays answered ' + short(seeded));
  }

  if (relayKeys.pinned(root, ROUTES.url) === ROUTES.key) {
    test.check('and its key is pinned from install: first contact with noderoutes.net is a match, not a trust');
  } else {
    test.fail(OWED + 'the seed is not pinned: ' + short(relayKeys.pinned(root, ROUTES.url)));
  }

  // "spirit.andyflinn.com is OURS": not seeded, not listed, not trusted from install.
  if (!byKey[SPIRIT.key] && rows.every(function (r) { return r.url !== SPIRIT.url; }) &&
      relayKeys.pinned(root, SPIRIT.url) === '' && relayKeys.check(root, SPIRIT.url, SPIRIT.key) === 'new') {
    test.check('and spirit.andyflinn.com is not seeded: no row, no pin, first contact is new');
  } else {
    test.fail(OWED + 'spirit.andyflinn.com was seeded: ' + short(rows));
  }

  // A seed is pinned, but this node holds no seat on it until a claim says so.
  const seated = relayKeys.seatedUrls(root);
  if (Array.isArray(seated) && seated.length === 0) test.check('and a seed is not a seat: the node claimed nothing');
  else test.fail(OWED + 'a fresh node reads as seated on: ' + short(seated));

  const f = oldFiles(root);
  if (!f.relays && !f.keys) test.check('and neither relays.json nor relayKeys.json was written');
  else test.fail(OWED + 'a fresh boot wrote the old files: ' + short(f));
}

// ── 3 + 4. THE OLD FILES MOVE INTO THE ONE TABLE; A SECOND BOOT CHANGES NOTHING ──
test.subHeading('3. the first boot moves the old files into the table and deletes them; 4. a second boot changes nothing');
{
  const root = freshRoot('import');
  const rs = path.join(root, 'relay-state');
  fs.writeFileSync(path.join(rs, 'relays.json'), JSON.stringify([{ label: 'lab', url: LAB.url + '/' }, { label: 'never-reached', url: NOPIN }], null, 2));
  fs.writeFileSync(path.join(rs, 'relayKeys.json'), JSON.stringify({
    'http://127.0.0.1:4100': { publicKey: LAB.key, firstSeen: '2026-03-01T00:00:00.000Z', acceptedAt: '2026-03-02T00:00:00.000Z' },
    'https://gone.example': { publicKey: GONE.key, firstSeen: '2026-04-01T00:00:00.000Z', acceptedAt: '2026-04-02T00:00:00.000Z' },
  }, null, 2));
  // A seed already present, with the owner's own name for it.
  relayKeys.list(root, ROUTES.url, 'my-routes', ROUTES.key);

  let first = null;
  try { first = ownerBadge.ensureRelays(root); } catch (e) { first = { threw: String(e.message || e) }; }

  const lab = rowOf(root, LAB.key)[0];
  if (lab && lab.url === LAB.url && lab.myLabel === 'lab' && lab.keep === 1 && lab.seated === 1 && relayKeys.pinned(root, LAB.url) === LAB.key) {
    test.check('a listed, pinned relay moves in as a kept, seated row under its label, its url a direct route');
  } else {
    test.fail(OWED + 'the lab row did not come across whole: ' + short(lab));
  }
  const gone = rowOf(root, GONE.key)[0];
  if (gone && gone.url === GONE.url && gone.keep === 0 && relayKeys.pinned(root, GONE.url) === GONE.key) {
    test.check('a pinned relay that was not listed moves in too, not kept: its pin is not forgotten');
  } else {
    test.fail(OWED + 'the pinned, unlisted row was lost: ' + short(gone));
  }
  if (tableRows(root).every(function (r) { return r.url !== NOPIN; })) test.check('a listed relay with no pin is not copied: nothing can key it');
  else test.fail(OWED + 'the unpinned row was copied');
  const f = oldFiles(root);
  if (!f.relays && !f.keys) test.check('and both old files are deleted once the rows are in');
  else test.fail(OWED + 'the old files are still there: ' + short(f));

  const routes = rowOf(root, ROUTES.key);
  if (routes.length === 1 && routes[0].myLabel === 'my-routes' && routes[0].url === ROUTES.url) {
    test.check('a seed already present is one row, and its name is the node\'s own');
  } else {
    test.fail(OWED + 'the present seed was duplicated or overwritten: ' + short(routes));
  }

  const before = JSON.stringify(tableRows(root));
  let second = null;
  try { second = ownerBadge.ensureRelays(root); } catch (e) { second = { threw: String(e.message || e) }; }
  if (JSON.stringify(tableRows(root)) === before && JSON.stringify(second) === JSON.stringify(first)) {
    test.check('a second boot changes nothing');
  } else {
    test.fail(OWED + 'a second boot moved the table: ' + short(tableRows(root)));
  }
}

// ── 5 + 6. READS AND WRITES GO THROUGH THE TABLE ────────────────────────
test.subHeading('5. relayKeys and ownerBadge read and write the table; 6. noderoutes.net is kept');
{
  const root = freshRoot('writes');
  try { ownerBadge.ensureRelays(root); } catch (e) { /* section 1 reports it */ }

  // A claim on a relay this node never met: the key it learned at first contact keys the row.
  let added = null;
  try { added = ownerBadge.addRelay(root, NEWR.url, 'newbie', NEWR.key); } catch (e) { added = { threw: String(e.message || e) }; }
  const newRow = rowOf(root, NEWR.key)[0];
  if (newRow && newRow.url === NEWR.url && newRow.myLabel === 'newbie' && newRow.keep === 1 &&
      Array.isArray(added) && added.map(function (r) { return r.url; }).indexOf(NEWR.url) !== -1) {
    test.check('addRelay writes a kept row keyed by the relay key, under its name, and it is on the list');
  } else {
    test.fail(OWED + 'addRelay did not land a keyed row: ' + short(newRow) + ' / ' + short(added));
  }

  try { relayKeys.seat(root, NEWR.url); } catch (e) { /* asserted below */ }
  const myName = require('../run/spirit/relayAuth.js').loadIdentity(root).name;
  if ((rowOf(root, NEWR.key)[0] || {}).seated === 1 && relayKeys.seatedUrls(root).indexOf(NEWR.url) !== -1 &&
      relayKeys.seatLabel(root, NEWR.url) === myName) {
    test.check('seat flags the same keyed row seated, seatedUrls reads it back, and what it calls this node is its name');
  } else {
    test.fail(OWED + 'the seat did not reach the table: ' + short(rowOf(root, NEWR.key)));
  }

  // A pin on a url nobody listed: the record exists, keyed, and the list does not grow.
  try { relayKeys.accept(root, LAB.url, LAB.key); } catch (e) { /* asserted below */ }
  const labRow = rowOf(root, LAB.key)[0];
  const list = ownerBadge.loadRelays(root).map(function (r) { return r.url; });
  if (labRow && labRow.url === LAB.url && relayKeys.check(root, LAB.url, LAB.key) === 'match' && list.indexOf(LAB.url) === -1) {
    test.check('accept pins into the table by key, and a pin alone does not list a relay');
  } else {
    test.fail(OWED + 'accept did not pin by key: ' + short(labRow) + ' / list ' + short(list));
  }
  if (relayKeys.acceptedKeys(root)[LAB.key] === LAB.url && relayKeys.acceptedKeys(root)[ROUTES.key] === ROUTES.url) {
    test.check('acceptedKeys answers from the table, seeds included');
  } else {
    test.fail(OWED + 'acceptedKeys: ' + short(relayKeys.acceptedKeys(root)));
  }

  const kept = ownerBadge.removeRelay(root, ROUTES.url);
  if (kept && kept.ok === false && kept.status === 409 && ownerBadge.configuredUrls(root).indexOf(ROUTES.url) !== -1) {
    test.check('noderoutes.net still cannot be removed: ' + kept.error);
  } else {
    test.fail(OWED + 'noderoutes.net was removed: ' + short(kept));
  }

  // A seat this node still holds keeps a relay listed (goal/G30.7); given up, the relay may go.
  relayKeys.unseat(root, NEWR.url);
  const went = ownerBadge.removeRelay(root, NEWR.url);
  if (went && went.ok === true && ownerBadge.configuredUrls(root).indexOf(NEWR.url) === -1 &&
      relayKeys.pinned(root, NEWR.url) === NEWR.key) {
    test.check('another relay can go from the list, and its pin stays on its keyed row');
  } else {
    test.fail(OWED + 'removing new.example: ' + short(went) + ' pinned=' + relayKeys.pinned(root, NEWR.url));
  }

  const f = oldFiles(root);
  if (!f.relays && !f.keys) test.check('and after every write, neither old file exists');
  else test.fail(OWED + 'a write recreated an old file: ' + short(f));
}

// ── 7. THE FILES ARE NEVER WRITTEN, AND THE SEEDS ARE DATA IN ONE PLACE ─
test.subHeading('7. no node code writes the old files; the one seed key lives in one place');
{
  const writers = ['relayKeys.js', 'ownerBadge.js'].filter(function (name) {
    return /writeFileSync|renameSync/.test(fs.readFileSync(path.join(JS, name), 'utf8'));
  });
  if (!writers.length) test.check('relayKeys.js and ownerBadge.js write no file: the table is their store');
  else test.fail(OWED + 'still writing files: ' + writers.join(', '));

  const holders = fs.readdirSync(JS).filter(function (name) {
    if (!/\.js$/.test(name)) return false;
    const text = fs.readFileSync(path.join(JS, name), 'utf8');
    return text.indexOf(ROUTES.key) !== -1;
  });
  if (holders.length === 1 && holders[0] === 'ownerBadge.js') test.check('the seed key is written down once, beside the seed row: ' + holders[0]);
  else test.fail(OWED + 'the seed key is in: ' + short(holders));

  // spirit's key ships nowhere: "spirit.andyflinn.com is OURS."
  const spiritHolders = fs.readdirSync(JS).filter(function (name) {
    return /\.js$/.test(name) && fs.readFileSync(path.join(JS, name), 'utf8').indexOf(SPIRIT.key) !== -1;
  });
  if (!spiritHolders.length) test.check('and spirit.andyflinn.com\'s key ships in no node file');
  else test.fail(OWED + 'spirit\'s key ships in: ' + short(spiritHolders));

  const seeds = ownerBadge.SEED_RELAYS || [];
  if (seeds.length === 1 && seeds[0].key === ROUTES.key && seeds[0].url === ROUTES.url &&
      ownerBadge.KEPT_RELAY && ownerBadge.KEPT_RELAY.url === ROUTES.url) {
    test.check('SEED_RELAYS is noderoutes.net alone, with its key, and it is still the kept relay');
  } else {
    test.fail(OWED + 'SEED_RELAYS: ' + short(seeds));
  }
}

test.reportSuccessFailureCount();
