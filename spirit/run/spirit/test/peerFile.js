'use strict';

// spirit/run/spirit/test/peerFile.js
// The tests of spirit/peerFile.js, and of no other module (spec: ./peerFile.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
//
// One peer, one file, named by the peer's WHOLE public key: injective, reversible and Windows-safe (lowercase hex of
// the key's bytes), with the prefix peerfile- that one .gitignore line keeps out of git. Pure, in process.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const P = require(path.join(RUN, 'spirit', 'peerFile.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// Two Ed25519 keys in base64 SPKI share their whole first 16 characters, and these two differ only in case.
const K1 = 'MCowBQYDK2VwAyEA+4mt2XtbJHPmiyCri6HRaA/PyH4EPGYE/ez+YpE72Ls=';
const K2 = 'MCowBQYDK2VwAyEA+4mt2XtbJHPmiyCri6HRaA/PyH4EPGYE/ez+YpE72LS=';

// ── the name ──
test.run('a key\'s name is its bytes in lowercase hex: letters a-f and digits only', 0.2, function () {
  const n = P.nameFromKey(K1);
  return (n === Buffer.from(K1, 'utf8').toString('hex') && /^[0-9a-f]+$/.test(n)) || 'name: ' + short(n);
}, test.limit.quick);
test.run('injective: two keys sharing a prefix, or differing only in case, name two files, case folded (NTFS)', 0.2, function () {
  const a = P.nameFromKey(K1).toLowerCase(), b = P.nameFromKey(K2).toLowerCase();
  return (a !== b && P.fileName(K1).toLowerCase() !== P.fileName(K2).toLowerCase()) || 'one name for both: ' + a;
}, test.limit.quick);
test.run('the whole key is in the name: no tail, prefix or hash (a 44-char key, an 88-char name)', 0.2, function () {
  const k = 'MCowBQYDK2VwAyEAabcdefghijklmnopqrstuvwxyz012=';
  return P.nameFromKey(k).length === 2 * k.length || 'length ' + P.nameFromKey(k).length + ' for ' + k.length;
}, test.limit.quick);
test.run('reversible: the key comes back from its name, and from the name upper-cased', 0.2, function () {
  const n = P.nameFromKey(K1);
  return (P.keyFromName(n) === K1 && P.keyFromName(n.toUpperCase()) === K1) || 'back: ' + short([P.keyFromName(n), P.keyFromName(n.toUpperCase())]);
}, test.limit.quick);
test.run('a char above one byte still round-trips, never truncated', 0.2, function () {
  const k = 'a€b';
  return P.keyFromName(P.nameFromKey(k)) === k || 'back: ' + short(P.keyFromName(P.nameFromKey(k)));
}, test.limit.quick);
// The module's own words: "a caller passing something else must still round-trip rather than silently truncate". The
// char 0xff's byte, ff, is what the way back reads as the mark of a char above one byte, so 0xff takes the long form.
test.run('the char 0xff round-trips too: its byte is not taken for the mark of a wider char', 0.2, function () {
  const k = 'aÿb';
  return P.keyFromName(P.nameFromKey(k)) === k || 'name ' + P.nameFromKey(k) + ' comes back as ' + short(P.keyFromName(P.nameFromKey(k)));
}, test.limit.quick);
test.run('no key names nothing', 0.2, function () {
  const got = [P.nameFromKey(''), P.nameFromKey(null), P.fileName(''), P.fileName(undefined)];
  return got.every(function (x) { return x === ''; }) || 'named: ' + short(got);
}, test.limit.quick);
test.run('a name this module did not write is no key: not hex, an odd length, a cut multi-byte char, empty', 0.2, function () {
  const got = [P.keyFromName('xyz1'), P.keyFromName('abc'), P.keyFromName('ff20'), P.keyFromName(''), P.keyFromName('../61')];
  return got.every(function (x) { return x === ''; }) || 'decoded: ' + short(got);
}, test.limit.quick);

// ── the file name ──
test.run('the file name is peerfile-<name>.json, the prefix the one .gitignore line names', 0.2, function () {
  const f = P.fileName(K1);
  return (P.PREFIX === 'peerfile-' && f === 'peerfile-' + P.nameFromKey(K1) + '.json') || 'file: ' + short(f);
}, test.limit.quick);
test.run('one path segment: no separator, no dot but the extension\'s', 0.2, function () {
  const f = P.fileName('../../etc/passwd');
  return (f.indexOf('/') === -1 && f.indexOf('\\') === -1 && f.split('.').length === 2) || 'file: ' + f;
}, test.limit.quick);
test.run('another extension, or none, is honoured', 0.2, function () {
  const got = [P.fileName(K1, '.log'), P.fileName(K1, '')];
  return (got[0] === 'peerfile-' + P.nameFromKey(K1) + '.log' && got[1] === 'peerfile-' + P.nameFromKey(K1)) || 'files: ' + short(got);
}, test.limit.quick);
test.run('the key comes back from its file name, its extension\'s case ignored', 0.2, function () {
  const got = [P.keyFromFileName(P.fileName(K1)), P.keyFromFileName(P.fileName(K1).replace('.json', '.JSON')), P.keyFromFileName(P.fileName(K1, '.log'), '.log')];
  return got.every(function (x) { return x === K1; }) || 'back: ' + short(got);
}, test.limit.quick);
test.run('the prefix is optional on the way back: a name written before it still decodes', 0.2, function () {
  return P.keyFromFileName(P.nameFromKey(K1) + '.json') === K1 || 'back: ' + short(P.keyFromFileName(P.nameFromKey(K1) + '.json'));
}, test.limit.quick);
test.run('a file name that is not one of these is no key', 0.2, function () {
  const got = [P.keyFromFileName('notes.json'), P.keyFromFileName('peerfile-zz.json'), P.keyFromFileName(null)];
  return got.every(function (x) { return x === ''; }) || 'decoded: ' + short(got);
}, test.limit.quick);
