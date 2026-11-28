'use strict';

// spirit/run/spirit/relay/store/test/script.js
// The tests of spirit/relay/store/script.js, and of no other module, in this one file (spec: ./script.md). The relay's
// roll and waiting room on disc, in one sqlite file: each exported function and every store call a caller relies on,
// on real relay.db files under scratch roots in the system's temporary folder, rows written and read back through the
// module itself. No live node's state is touched.

require('../../../script.js');
const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const S = require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/testicle/testReport/script.js');
// ITS TEMP FOLDERS FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"): one of its own for each
// it asks, under its suite's path, the whole of it removed when the suite ends.
const tempFolder = require('../../../tempFolder/script.js').tempFolder;
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/test/relayStore/' + name + tempAsked); }
// ITS STORES CLOSED BEFORE ITS FOLDER GOES (goal/G49.7, Andy's Windows red "it leaves no temp folder behind"; cw's hand-over): on
// Windows a folder holding an open relay.db cannot be removed, and this after, registered first, ran before the one that
// closes them (below), so it removed nothing there.
test.after(function () {
  try { relayStore.closeAll(); } catch (e) { /* none open */ }
  try { fs.rmSync(tempFolder.path('spirit/test/relayStore'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ }
});
const relayStore = S.requireScript('spirit/relay/store/script.js');

const W = { roots: [], home: null, store: null, ro: null, roError: null, uniqueError: null, small: null, full: 0 };
function scratch() {
  const d = ownTemp('spirit-relaystore-');
  W.roots.push(d);
  return d;
}
function dbFile(root) { return path.join(root, 'spirit', 'state', 'relay.db'); }
function threw(fn) { try { fn(); return false; } catch (e) { return true; } }
const KEY_A = 'relaystore-key-a-' + process.pid;
const KEY_B = 'relaystore-key-b-' + process.pid;
const KEY_C = 'relaystore-key-c-' + process.pid;
const NOBODY = 'relaystore-nobody-' + process.pid;

// ── the driver and the label rule ──────────────────────────────────
test.run('available says this Node can load the sqlite driver', 0.2, function () {
  return relayStore.available() === true;
}, test.limit.quick);
test.run('normLabel trims a label and keeps its case', 0.4, function () {
  return relayStore.normLabel('  Andy Flinn \t') === 'Andy Flinn' && relayStore.normLabel('x') === 'x';
}, test.limit.quick);
test.run('normLabel makes null and undefined the empty label and a number a string', 0.4, function () {
  return relayStore.normLabel(null) === '' && relayStore.normLabel(undefined) === '' && relayStore.normLabel(42) === '42';
}, test.limit.quick);

// ── open ───────────────────────────────────────────────────────────
test.run('openReadOnly answers null on a root with no database and creates nothing', 0.4, function () {
  const root = scratch();
  return relayStore.openReadOnly(root) === null && !fs.existsSync(path.join(root, 'spirit'));
}, test.limit.quick);
test.run('compact on a root with no database refuses, saying there is none yet', 0.4, function () {
  const out = relayStore.compact(scratch());
  return !!out && out.ok === false && out.why === 'no database yet';
}, test.limit.quick);
test.run('open creates spirit/state/relay.db under the root and names it as its path', 0.2, function () {
  W.home = scratch();
  W.store = relayStore.open(W.home);
  return fs.existsSync(dbFile(W.home)) && W.store.path === dbFile(W.home);
}, test.limit.quick);
test.run('open on the same root, however written, answers the same store', 0.4, function () {
  if (!W.store) return false;
  return relayStore.open(W.home) === W.store && relayStore.open(W.home + path.sep + '.') === W.store;
}, test.limit.quick);
test.run('a new store has no members and no invites', 0.4, function () {
  if (!W.store) return false;
  return W.store.members.count() === 0 && W.store.invites.all().length === 0;
}, test.limit.quick);

// ── members ────────────────────────────────────────────────────────
test.run('members.put stores a member and answers its row with the label as given and empty face fields', 0.4, function () {
  if (!W.store) return false;
  const m = W.store.members.put({ publicKey: KEY_A, publicLabel: ' Andy ', claimedAt: '2026-01-02T00:00:00.000Z', card: 'card-a-1' });
  return !!m && m.publicKey === KEY_A && m.publicLabel === ' Andy ' && m.claimedAt === '2026-01-02T00:00:00.000Z' &&
    m.card === 'card-a-1' && m.faceName === '' && m.faceEmail === '' && m.email === '' && m.emailVerified === false;
}, test.limit.quick);
test.run('a member row carries no owner field, since no row knows who owns the relay', 0.8, function () {
  if (!W.store) return false;
  const m = W.store.members.get(KEY_A) || {};
  return Object.keys(m).sort().join(',') === 'card,claimedAt,email,emailVerified,faceEmail,faceName,publicKey,publicLabel';
}, test.limit.quick);
test.run('members.get reads a member back by its key', 0.4, function () {
  if (!W.store) return false;
  const m = W.store.members.get(KEY_A);
  return !!m && m.publicKey === KEY_A && m.card === 'card-a-1';
}, test.limit.quick);
test.run('members.get answers null for an unknown key, an empty key and null', 0.4, function () {
  if (!W.store) return false;
  return W.store.members.get(NOBODY) === null && W.store.members.get('') === null && W.store.members.get(null) === null;
}, test.limit.quick);
test.run('a member put again with no card keeps the card it had', 0.8, function () {
  if (!W.store) return false;
  const m = W.store.members.put({ publicKey: KEY_A, publicLabel: 'Andy', claimedAt: '2026-01-02T00:00:00.000Z' });
  return !!m && m.publicLabel === 'Andy' && m.card === 'card-a-1' && W.store.members.count() === 1;
}, test.limit.quick);
test.run('a member put again with a new card takes the new card', 0.4, function () {
  if (!W.store) return false;
  const m = W.store.members.put({ publicKey: KEY_A, publicLabel: 'Andy', claimedAt: '2026-01-02T00:00:00.000Z', card: 'card-a-2' });
  return !!m && m.card === 'card-a-2';
}, test.limit.quick);
test.run('members.put with no label stores the empty label', 0.4, function () {
  if (!W.store) return false;
  const m = W.store.members.put({ publicKey: KEY_C, claimedAt: '2026-01-01T00:00:00.000Z' });
  return !!m && m.publicLabel === '' && m.card === '' && W.store.members.count() === 2;
}, test.limit.quick);
test.run('members.count counts the roll', 0.4, function () {
  if (!W.store) return false;
  W.store.members.put({ publicKey: KEY_B, publicLabel: 'Andy', claimedAt: '2026-01-03T00:00:00.000Z' });
  return W.store.members.count() === 3;
}, test.limit.quick);
test.run('members.byLabel finds a label trimmed, and answers at most two holders by default', 0.4, function () {
  if (!W.store) return false;
  W.store.members.put({ publicKey: 'relaystore-key-d-' + process.pid, publicLabel: 'Andy ', claimedAt: '2026-01-04T00:00:00.000Z' });
  const two = W.store.members.byLabel('  Andy  ');
  return two.length === 2 && two.every(function (m) { return m.publicLabel.trim() === 'Andy'; });
}, test.limit.quick);
test.run('members.byLabel answers every holder up to the limit asked', 0.4, function () {
  if (!W.store) return false;
  return W.store.members.byLabel('Andy', 10).length === 3 && W.store.members.byLabel('Andy', 1).length === 1;
}, test.limit.quick);
test.run('members.byLabel compares exactly: another case or an unknown label finds nobody', 0.4, function () {
  if (!W.store) return false;
  return W.store.members.byLabel('andy', 10).length === 0 && W.store.members.byLabel('Nobody here', 10).length === 0;
}, test.limit.quick);
test.run('members.byKeys answers the known keys in the order asked and drops the unknown', 0.4, function () {
  if (!W.store) return false;
  const got = W.store.members.byKeys([KEY_B, NOBODY, null, KEY_A]).map(function (m) { return m.publicKey; });
  return got.join(',') === KEY_B + ',' + KEY_A;
}, test.limit.quick);
test.run('members.byKeys of nothing answers an empty list', 0.4, function () {
  if (!W.store) return false;
  const a = W.store.members.byKeys(null);
  const b = W.store.members.byKeys([]);
  return Array.isArray(a) && a.length === 0 && Array.isArray(b) && b.length === 0;
}, test.limit.quick);
test.run('members.each walks the whole roll in the order of claim', 0.4, function () {
  if (!W.store) return false;
  const seen = [];
  W.store.members.each(function (m) { seen.push(m.claimedAt); });
  return seen.length === 4 && seen.join(',') === seen.slice().sort().join(',') && seen[0] === '2026-01-01T00:00:00.000Z';
}, test.limit.quick);
test.run('members.each stops when the callback answers false', 0.4, function () {
  if (!W.store) return false;
  let n = 0;
  W.store.members.each(function () { n++; return n === 2 ? false : undefined; });
  return n === 2;
}, test.limit.quick);
test.run('members.remove takes a member off the roll and answers true', 0.4, function () {
  if (!W.store) return false;
  const k = 'relaystore-key-d-' + process.pid;
  return W.store.members.remove(k) === true && W.store.members.get(k) === null && W.store.members.count() === 3;
}, test.limit.quick);
test.run('members.remove of an unknown key or null answers false and removes nobody', 0.4, function () {
  if (!W.store) return false;
  return W.store.members.remove(NOBODY) === false && W.store.members.remove(null) === false && W.store.members.count() === 3;
}, test.limit.quick);

// ── the face name and email ────────────────────────────────────────
test.run('members.setFace writes a member\'s face name and email, and byFace finds the member', 0.4, function () {
  if (!W.store) return false;
  if (W.store.members.setFace(KEY_A, 'andy', 'andy@example.org') !== true) return false;
  const m = W.store.members.byFace('andy');
  return !!m && m.publicKey === KEY_A && m.faceName === 'andy' && m.faceEmail === 'andy@example.org';
}, test.limit.quick);
test.run('members.setFace refuses a face name another member holds and leaves both as they were', 0.8, function () {
  if (!W.store) return false;
  const out = W.store.members.setFace(KEY_B, 'andy', 'thief@example.org');
  const b = W.store.members.get(KEY_B) || {};
  const holder = W.store.members.byFace('andy') || {};
  return out === false && b.faceName === '' && holder.publicKey === KEY_A && holder.faceEmail === 'andy@example.org';
}, test.limit.quick);
test.run('members.setFace answers false for a member not on the roll', 0.4, function () {
  if (!W.store) return false;
  return W.store.members.setFace(NOBODY, 'ghost', '') === false && W.store.members.byFace('ghost') === null;
}, test.limit.quick);
test.run('two members with no face name do not collide', 0.4, function () {
  if (!W.store) return false;
  return W.store.members.setFace(KEY_B, '', '') === true && W.store.members.setFace(KEY_C, '', '') === true;
}, test.limit.quick);
test.run('members.byFace of an unknown name answers null', 0.4, function () {
  if (!W.store) return false;
  return W.store.members.byFace('nobody-by-that-name') === null;
}, test.limit.quick);
test.run('a face name set to empty frees it for another member', 0.4, function () {
  if (!W.store) return false;
  if (W.store.members.setFace(KEY_A, '', '') !== true) return false;
  if (W.store.members.setFace(KEY_B, 'andy', 'b@example.org') !== true) return false;
  const m = W.store.members.byFace('andy') || {};
  return m.publicKey === KEY_B;
}, test.limit.quick);
test.run('members.setEmail writes the email as verified', 0.4, function () {
  if (!W.store) return false;
  if (W.store.members.setEmail(KEY_A, 'proved@example.org') !== true) return false;
  const m = W.store.members.get(KEY_A) || {};
  return m.email === 'proved@example.org' && m.emailVerified === true;
}, test.limit.quick);
test.run('members.setEmail answers false for a member not on the roll', 0.4, function () {
  if (!W.store) return false;
  return W.store.members.setEmail(NOBODY, 'x@example.org') === false;
}, test.limit.quick);

// ── face logins ────────────────────────────────────────────────────
test.run('a member with no face logins has an empty list', 0.4, function () {
  if (!W.store) return false;
  const l = W.store.members.faceLogins(KEY_A);
  return Array.isArray(l) && l.length === 0;
}, test.limit.quick);
test.run('members.setFaceLogins stores the list and faceLogins reads it back', 0.4, function () {
  if (!W.store) return false;
  const list = [{ hash: 'hash-one-' + process.pid, until: 1000 }, { hash: 'hash-two-' + process.pid, until: 2000 }];
  if (W.store.members.setFaceLogins(KEY_A, list) !== true) return false;
  return JSON.stringify(W.store.members.faceLogins(KEY_A)) === JSON.stringify(list);
}, test.limit.quick);
test.run('members.byFaceLogin finds the member holding a login hash', 0.8, function () {
  if (!W.store) return false;
  const m = W.store.members.byFaceLogin('hash-two-' + process.pid);
  return !!m && m.publicKey === KEY_A;
}, test.limit.quick);
test.run('members.byFaceLogin of part of a hash, an unknown hash or an empty one answers null', 0.8, function () {
  if (!W.store) return false;
  return W.store.members.byFaceLogin('hash-two-') === null && W.store.members.byFaceLogin('hash-none') === null &&
    W.store.members.byFaceLogin('') === null && W.store.members.byFaceLogin(null) === null;
}, test.limit.quick);
test.run('members.setFaceLogins of something not a list stores an empty list', 0.4, function () {
  if (!W.store) return false;
  if (W.store.members.setFaceLogins(KEY_C, [{ hash: 'h', until: 1 }]) !== true) return false;
  if (W.store.members.setFaceLogins(KEY_C, { hash: 'h' }) !== true) return false;
  const l = W.store.members.faceLogins(KEY_C);
  return Array.isArray(l) && l.length === 0;
}, test.limit.quick);
test.run('face logins of a member not on the roll: setting answers false and reading an empty list', 0.4, function () {
  if (!W.store) return false;
  const l = W.store.members.faceLogins(NOBODY);
  return W.store.members.setFaceLogins(NOBODY, [{ hash: 'x', until: 1 }]) === false && Array.isArray(l) && l.length === 0;
}, test.limit.quick);
test.run('a member\'s face logins go with the row when it is removed', 0.8, function () {
  if (!W.store) return false;
  const k = 'relaystore-key-e-' + process.pid;
  W.store.members.put({ publicKey: k, publicLabel: 'leaver', claimedAt: '2026-01-05T00:00:00.000Z' });
  W.store.members.setFaceLogins(k, [{ hash: 'hash-leaver-' + process.pid, until: 1 }]);
  if (!W.store.members.byFaceLogin('hash-leaver-' + process.pid)) return false;
  W.store.members.remove(k);
  return W.store.members.byFaceLogin('hash-leaver-' + process.pid) === null && W.store.members.faceLogins(k).length === 0;
}, test.limit.quick);

// ── invites ────────────────────────────────────────────────────────
test.run('invites.add stores an invite and answers its row, invitedBy empty when not given', 0.4, function () {
  if (!W.store) return false;
  const r = W.store.invites.add({ token: 'tok-late', label: 'Bob', expiresAt: '2099-01-01T00:00:00.000Z' });
  return !!r && r.token === 'tok-late' && r.label === 'Bob' && r.expiresAt === '2099-01-01T00:00:00.000Z' && r.invitedBy === '';
}, test.limit.quick);
test.run('invites.get reads an invite by its token and answers null for an unknown one', 0.4, function () {
  if (!W.store) return false;
  W.store.invites.add({ token: 'tok-early', label: 'Bob', expiresAt: '2000-01-01T00:00:00.000Z', invitedBy: KEY_A });
  const r = W.store.invites.get('tok-early') || {};
  return r.invitedBy === KEY_A && W.store.invites.get('tok-none') === null && W.store.invites.get(null) === null;
}, test.limit.quick);
test.run('a token added twice is refused with a constraint error and the first stays', 0.8, function () {
  if (!W.store) return false;
  try { W.store.invites.add({ token: 'tok-late', label: 'Mallory', expiresAt: '2099-01-01T00:00:00.000Z' }); return false; } catch (e) { W.uniqueError = e; }
  return (W.store.invites.get('tok-late') || {}).label === 'Bob';
}, test.limit.quick);
test.run('invites.all answers the waiting room in the order of expiry', 0.4, function () {
  if (!W.store) return false;
  W.store.invites.add({ token: 'tok-mid', label: 'Carol', expiresAt: '2050-01-01T00:00:00.000Z' });
  return W.store.invites.all().map(function (r) { return r.token; }).join(',') === 'tok-early,tok-mid,tok-late';
}, test.limit.quick);
test.run('invites.byLabel answers every invite with that exact label', 0.4, function () {
  if (!W.store) return false;
  const bob = W.store.invites.byLabel('Bob').map(function (r) { return r.token; }).sort().join(',');
  return bob === 'tok-early,tok-late' && W.store.invites.byLabel('bob').length === 0 && W.store.invites.byLabel(null).length === 0;
}, test.limit.quick);
test.run('invites.sweepExpired removes the invites expired before now and answers how many', 0.4, function () {
  if (!W.store) return false;
  const n = W.store.invites.sweepExpired('2026-11-16T00:00:00.000Z');
  return n === 1 && W.store.invites.get('tok-early') === null && !!W.store.invites.get('tok-late');
}, test.limit.quick);
test.run('invites.remove spends one invite and answers true, and false for one not there', 0.4, function () {
  if (!W.store) return false;
  return W.store.invites.remove('tok-mid') === true && W.store.invites.get('tok-mid') === null &&
    W.store.invites.remove('tok-mid') === false && W.store.invites.remove(null) === false;
}, test.limit.quick);
test.run('invites.removeLabel removes every invite for a label and answers how many', 0.4, function () {
  if (!W.store) return false;
  W.store.invites.add({ token: 'tok-bob-2', label: 'Bob', expiresAt: '2098-01-01T00:00:00.000Z' });
  return W.store.invites.removeLabel('Bob') === 2 && W.store.invites.all().length === 0 && W.store.invites.removeLabel('Bob') === 0;
}, test.limit.quick);

// ── transaction ────────────────────────────────────────────────────
test.run('transaction lands every write and answers what its function answers', 0.4, function () {
  if (!W.store) return false;
  const out = W.store.transaction(function () {
    W.store.invites.add({ token: 'tx-1', label: 'T', expiresAt: '2099-01-01T00:00:00.000Z' });
    W.store.invites.add({ token: 'tx-2', label: 'T', expiresAt: '2099-01-01T00:00:00.000Z' });
    return 'done';
  });
  return out === 'done' && W.store.invites.byLabel('T').length === 2;
}, test.limit.quick);
test.run('a transaction that throws lands none of its writes and the throw reaches the caller', 0.8, function () {
  if (!W.store) return false;
  let thrown = false;
  try {
    W.store.transaction(function () {
      W.store.invites.add({ token: 'tx-3', label: 'U', expiresAt: '2099-01-01T00:00:00.000Z' });
      W.store.members.remove(KEY_C);
      throw new Error('stop');
    });
  } catch (e) { thrown = e && e.message === 'stop'; }
  return thrown && W.store.invites.get('tx-3') === null && !!W.store.members.get(KEY_C);
}, test.limit.quick);
test.run('the store still writes after a rolled back transaction', 0.4, function () {
  if (!W.store) return false;
  return W.store.invites.removeLabel('T') === 2;
}, test.limit.quick);

// ── on disc ────────────────────────────────────────────────────────
test.run('bytes answers the size of relay.db, no journal left after a commit', 0.4, function () {
  if (!W.store) return false;
  const size = fs.statSync(dbFile(W.home)).size;
  return size > 0 && !fs.existsSync(dbFile(W.home) + '-journal') && W.store.bytes() === size;
}, test.limit.quick);
test.run('a label written to the roll is in the file before it is deleted', 0.2, function () {
  if (!W.store) return false;
  W.store.members.put({ publicKey: 'relaystore-secret-' + process.pid, publicLabel: 'SECRET-LABEL-' + process.pid, claimedAt: '2026-01-06T00:00:00.000Z' });
  W.store.invites.add({ token: 'tok-secret', label: 'SECRET-INVITE-' + process.pid, expiresAt: '2099-01-01T00:00:00.000Z' });
  const buf = fs.readFileSync(dbFile(W.home));
  return buf.indexOf('SECRET-LABEL-' + process.pid) >= 0 && buf.indexOf('SECRET-INVITE-' + process.pid) >= 0;
}, test.limit.quick);
test.run('a removed member and a spent invite are gone from the file, not only from the queries', 0.8, function () {
  if (!W.store) return false;
  W.store.members.remove('relaystore-secret-' + process.pid);
  W.store.invites.remove('tok-secret');
  const buf = fs.readFileSync(dbFile(W.home));
  return buf.indexOf('SECRET-LABEL-' + process.pid) < 0 && buf.indexOf('SECRET-INVITE-' + process.pid) < 0;
}, test.limit.quick);

// ── close and reopen ───────────────────────────────────────────────
test.run('a closed store answers no more, and open then answers a new store', 0.4, function () {
  if (!W.store) return false;
  const old = W.store;
  old.close();
  if (!threw(function () { old.members.count(); })) return false;
  W.store = relayStore.open(W.home);
  return W.store !== old;
}, test.limit.quick);
test.run('closing a store twice does not throw', 0.4, function () {
  const s = relayStore.open(scratch());
  s.close();
  return !threw(function () { s.close(); });
}, test.limit.quick);
test.run('a reopened store reads what was written before the close', 0.8, function () {
  if (!W.store) return false;
  const a = W.store.members.get(KEY_A) || {};
  const b = W.store.members.get(KEY_B) || {};
  return W.store.members.count() === 3 && a.card === 'card-a-2' && a.email === 'proved@example.org' &&
    b.faceName === 'andy' && W.store.members.faceLogins(KEY_A).length === 2 && W.store.invites.get('tok-early') === null;
}, test.limit.quick);
test.run('closeAll closes every open store, and the data stands when opened again', 0.4, function () {
  if (!W.store) return false;
  const other = relayStore.open(scratch());
  other.members.put({ publicKey: KEY_A, publicLabel: 'other', claimedAt: '' });
  const old = W.store;
  relayStore.closeAll();
  if (!threw(function () { old.members.count(); }) || !threw(function () { other.members.count(); })) return false;
  W.store = relayStore.open(W.home);
  return W.store !== old && W.store.members.count() === 3;
}, test.limit.quick);

// ── read only ──────────────────────────────────────────────────────
test.run('openReadOnly reads the roll and the waiting room of an existing database', 0.4, function () {
  if (!W.store) return false;
  W.store.invites.add({ token: 'tok-ro', label: 'Reader', expiresAt: '2099-01-01T00:00:00.000Z' });
  W.ro = relayStore.openReadOnly(W.home);
  if (!W.ro) return false;
  return W.ro.members.count() === 3 && (W.ro.members.get(KEY_A) || {}).card === 'card-a-2' &&
    (W.ro.invites.get('tok-ro') || {}).label === 'Reader' && W.ro.path === dbFile(W.home);
}, test.limit.quick);
test.run('a write through a read-only store throws and changes nothing', 0.8, function () {
  if (!W.ro) return false;
  try { W.ro.members.put({ publicKey: 'ro-writer', publicLabel: 'x', claimedAt: '' }); return false; } catch (e) { W.roError = e; }
  return W.store.members.get('ro-writer') === null && W.store.members.count() === 3;
}, test.limit.quick);
test.run('a read-only store is not the cached one, and closing it leaves the cached store open', 0.4, function () {
  if (!W.ro || !W.store) return false;
  if (relayStore.open(W.home) !== W.store || W.ro === W.store) return false;
  W.ro.close();
  return relayStore.open(W.home) === W.store && W.store.members.count() === 3;
}, test.limit.quick);

// ── disc failure ───────────────────────────────────────────────────
test.run('isDiscFailure reads the full, read-only, I/O and cannot-open codes as the disc', 0.4, function () {
  return [13, 8, 10, 14].every(function (c) { return relayStore.isDiscFailure({ errcode: c, message: 'x' }) === true; });
}, test.limit.quick);
test.run('isDiscFailure reads an extended code by its low byte, a read-only directory as read-only', 0.4, function () {
  return relayStore.isDiscFailure({ errcode: 1544, message: 'x' }) === true && relayStore.isDiscFailure({ errcode: 2067, message: 'x' }) === false;
}, test.limit.quick);
test.run('isDiscFailure without a code reads the disc from the message', 0.4, function () {
  return relayStore.isDiscFailure(new Error('database or disk is full')) === true &&
    relayStore.isDiscFailure(new Error('write ENOSPC')) === true && relayStore.isDiscFailure('EROFS: read-only file system') === true;
}, test.limit.quick);
test.run('isDiscFailure reads a constraint, a plain error, nothing and null as no disc failure', 0.4, function () {
  return relayStore.isDiscFailure({ errcode: 19, message: 'UNIQUE constraint failed' }) === false &&
    relayStore.isDiscFailure(new Error('boom')) === false && relayStore.isDiscFailure(null) === false &&
    relayStore.isDiscFailure(undefined) === false;
}, test.limit.quick);
test.run('the real error of a write to a read-only store is a disc failure', 0.4, function () {
  return !!W.roError && relayStore.isDiscFailure(W.roError) === true;
}, test.limit.quick);
test.run('the real error of a token added twice is no disc failure', 0.4, function () {
  return !!W.uniqueError && relayStore.isDiscFailure(W.uniqueError) === false;
}, test.limit.quick);

// ── compact ────────────────────────────────────────────────────────
test.run('a roll filled and emptied leaves relay.db its full size', 0.2, function () {
  W.small = scratch();
  const s = relayStore.open(W.small);
  const pad = new Array(400).join('x');
  s.transaction(function () {
    for (let i = 0; i < 2000; i++) s.members.put({ publicKey: 'fill-' + i, publicLabel: pad + i, claimedAt: '' });
  });
  W.full = s.bytes();
  s.transaction(function () { for (let i = 0; i < 2000; i++) s.members.remove('fill-' + i); });
  return s.members.count() === 0 && W.full > 500000 && s.bytes() === W.full;
}, test.limit.slow);
test.run('compact refuses when less than twice the file is free, and says so', 0.4, function () {
  if (!W.small) return false;
  const out = relayStore.compact(W.small, 0);
  return out.ok === false && out.before === W.full && typeof out.why === 'string' && out.why.indexOf('twice') >= 0 &&
    fs.statSync(dbFile(W.small)).size === W.full;
}, test.limit.quick);
test.run('compact shrinks the file of an emptied roll and answers before, after and its time', 0.4, function () {
  if (!W.small) return false;
  const out = relayStore.compact(W.small, 1e9);
  return out.ok === true && out.before === W.full && out.after < W.full / 4 && out.after === fs.statSync(dbFile(W.small)).size &&
    typeof out.ms === 'number' && out.ms >= 0;
}, test.limit.slow);
test.run('compact with no free figure given runs, and closes every cached store first', 0.4, function () {
  if (!W.store) return false;
  const old = W.store;
  const out = relayStore.compact(W.home);
  if (out.ok !== true || !threw(function () { old.members.count(); })) return false;
  W.store = relayStore.open(W.home);
  return W.store !== old && W.store.members.count() === 3 && (W.store.members.get(KEY_A) || {}).card === 'card-a-2';
}, test.limit.quick);

test.after(function () {
  try { relayStore.closeAll(); } catch (e) { /* scratch */ }
  W.roots.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* scratch */ } });
});
