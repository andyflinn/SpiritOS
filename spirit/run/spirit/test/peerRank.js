'use strict';

// spirit/run/spirit/test/peerRank.js
// The tests of spirit/peerRank.js, and of no other module (spec: ./peerRank.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
//
// The peer search's one ranker, on the probability modules (goal/G29.17): rank(rows, q, slots), and ranker(q, slots)
// fed in slices (goal/G41.30). Pure: rows in, rows out, in process.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const P = require(path.join(RUN, 'spirit', 'peerRank.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function labels(r) { return ((r && r.rows) || []).map(function (x) { return x.publicLabel; }); }
const ROWS = [{ publicLabel: 'zebra' }, { publicLabel: 'andy flinn' }, { publicLabel: 'bob', city: 'andytown' }, { publicLabel: 'andy' }];
function many(n) { const out = []; for (let i = 0; i < n; i += 1) out.push({ publicLabel: 'peer ' + i }); return out; }

// ── anyone ──
test.run('no words, or *, is anyone: every row, in the order given', 0.2, function () {
  const a = labels(P.rank(ROWS, '')), b = labels(P.rank(ROWS, '*'));
  const want = ['zebra', 'andy flinn', 'bob', 'andy'];
  return (short(a) === short(want) && short(b) === short(want)) || 'anyone: ' + short([a, b]);
}, test.limit.quick);
test.run('one relay answers 32 rows at most (SLOTS), and says more when one was turned away', 0.2, function () {
  const r = P.rank(many(40), '');
  return (P.SLOTS === 32 && r.rows.length === 32 && r.more === true && r.rows[0].publicLabel === 'peer 0') || 'SLOTS ' + P.SLOTS + ', rows ' + r.rows.length + ', more ' + r.more;
}, test.limit.quick);
test.run('slots given caps the list; a list that fits says no more', 0.2, function () {
  const r = P.rank(ROWS, '*', 2), all = P.rank(ROWS, '*', 4);
  return (short(labels(r)) === short(['zebra', 'andy flinn']) && r.more === true && all.rows.length === 4 && all.more === false) || 'capped: ' + short([r, all]);
}, test.limit.quick);

// ── words ──
test.run('with words, a row that does not match is left out', 0.2, function () {
  const got = labels(P.rank(ROWS, 'andy'));
  return (got.length > 0 && got.indexOf('zebra') === -1) || 'andy: ' + short(got);
}, test.limit.quick);
test.run('the best match comes first: the row that is the words, before one that holds them', 0.2, function () {
  const got = labels(P.rank(ROWS, 'andy'));
  return (got[0] === 'andy' && got.indexOf('andy flinn') > 0) || 'andy: ' + short(got);
}, test.limit.quick);
test.run('the whole row as it is served is matched, not its label alone (goal/G41.28)', 0.2, function () {
  const got = labels(P.rank(ROWS, 'andytown'));
  return got.indexOf('bob') !== -1 || 'andytown: ' + short(got);
}, test.limit.quick);
test.run('equal matches keep the order the rows came in', 0.2, function () {
  const rows = [{ publicLabel: 'twin', n: 'a' }, { publicLabel: 'twin', n: 'b' }, { publicLabel: 'twin', n: 'c' }];
  const got = P.rank(rows, 'twin').rows.map(function (r) { return r.n; });
  return short(got) === short(['a', 'b', 'c']) || 'twins: ' + short(got);
}, test.limit.quick);
test.run('the rows come back untouched: the very rows offered', 0.2, function () {
  const r = P.rank(ROWS, 'andy');
  return (r.rows.length > 0 && r.rows.every(function (x) { return ROWS.indexOf(x) !== -1; }) && !('score' in r.rows[0])) || 'rows: ' + short(r.rows);
}, test.limit.quick);
test.run('no rows, or an empty row among them, is no failure', 0.2, function () {
  const a = P.rank(null, 'andy'), b = P.rank([null, { publicLabel: 'andy' }], '*');
  return (a.rows.length === 0 && a.more === false && b.rows.length === 1) || 'answers: ' + short([a, b]);
}, test.limit.quick);

// ── fed in slices (goal/G41.30) ──
test.run('a ranker fed a page at a time answers what rank answers fed once', 0.2, function () {
  const rows = many(50).concat(ROWS);
  const r = P.ranker('andy', 3);
  for (let i = 0; i < rows.length; i += 7) r.add(rows.slice(i, i + 7));
  const sliced = r.result(), once = P.rank(rows, 'andy', 3);
  return (sliced.rows.length > 0 && short(sliced) === short(once)) || 'sliced ' + short(sliced) + ' once ' + short(once);
}, test.limit.quick);
test.run('fed in slices, anyone keeps the order across the slices', 0.2, function () {
  const r = P.ranker('', 5);
  r.add(many(3)); r.add(ROWS);
  const got = labels(r.result());
  return short(got) === short(['peer 0', 'peer 1', 'peer 2', 'zebra', 'andy flinn']) || 'order: ' + short(got);
}, test.limit.quick);
