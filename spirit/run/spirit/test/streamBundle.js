'use strict';

// spirit/run/spirit/test/streamBundle.js
// The tests of spirit/streamBundle.js (spec: ./streamBundle.md; goal/G48.7). Andy: "spirit/server/app.js and console would
// need to share the module that unpacks the collated stream packages, i would NOT want that to be done in two places", and
// Q1, where it lives: "the module is spirit/streamBundle.js". The box: both halves of a bundle and nothing else, pack and
// unpack; the app server packs and unpacks with it, and parses no delivery's json itself.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const limits = require(path.join(RUN, 'spirit', 'limits.js'));

// The module, or null while it does not stand (every check below is then red, never a crash).
let B = null;
try { B = require(path.join(RUN, 'spirit', 'streamBundle.js')); } catch (e) { B = null; }
const has = function (name) { return !!B && typeof B[name] === 'function'; };

// One delivery, as the publisher sends it: the bundle's JSON as the json string of a listener request. Its room is the
// app server's own, half a sealed packet less 512 bytes for its envelope (spirit/server/app.js, BUNDLE_ROOM).
const ROOM = Math.floor(limits.SEALED_MAX / 2) - 512;
const deliveryBytes = function (bundle) { return Buffer.byteLength(JSON.stringify({ json: JSON.stringify(bundle) }), 'utf8'); };
const entry = function (n, size) { return { run: 'r1', n: n, row: { item: { id: 'a' + n, title: 'x'.repeat(size || 40) } } }; };
const many = function (count, size) { const out = []; for (let i = 1; i <= count; i++) out.push(entry(i, size)); return out; };
const ids = function (list) { return Array.isArray(list) ? list.map(function (e) { return e && e.row && e.row.item ? e.row.item.id : ''; }) : []; };

// ── pack ──
test.run('pack keeps the entries in order: what it packs is the first of them, as they came', 0.2, function () {
  if (!has('pack')) return false;
  const all = many(5);
  const got = B.pack(all);
  const want = ids(all).slice(0, ids(got).length);
  return (Array.isArray(got) && got.length >= 1 && JSON.stringify(ids(got)) === JSON.stringify(want)) || false;
}, test.limit.quick);
test.run('pack fits one delivery: more entries than one holds are cut, and what is packed fits it', 0.2, function () {
  if (!has('pack')) return false;
  const all = many(400, 200);
  if (deliveryBytes(all) <= ROOM) return false;
  const got = B.pack(all);
  return (Array.isArray(got) && got.length >= 1 && got.length < all.length && deliveryBytes(got) <= ROOM) || false;
}, test.limit.quick);
test.run('pack takes every entry when they all fit one delivery', 0.2, function () {
  if (!has('pack')) return false;
  const all = many(3);
  const got = B.pack(all);
  return JSON.stringify(ids(got)) === JSON.stringify(ids(all)) || false;
}, test.limit.quick);
test.run('a single entry too big for one delivery still goes, alone', 0.2, function () {
  if (!has('pack')) return false;
  const huge = entry(1, ROOM + 1000);
  const got = B.pack([huge, entry(2)]);
  return (Array.isArray(got) && got.length === 1 && ids(got)[0] === 'a1') || false;
}, test.limit.quick);

// ── unpack ──
test.run('unpack returns the entries of a bundle, each a plain object, in order', 0.2, function () {
  if (!has('unpack')) return false;
  const all = many(4);
  const got = B.unpack(JSON.stringify(all));
  return (Array.isArray(got) && got.every(function (e) { return e && typeof e === 'object' && !Array.isArray(e); }) && JSON.stringify(got) === JSON.stringify(all)) || false;
}, test.limit.quick);
test.run('unpack gives null for a delivery that is no JSON', 0.2, function () {
  if (!has('unpack')) return false;
  return B.unpack('[{"run": "r1", "n": ') === null || false;
}, test.limit.quick);
test.run('unpack gives null for JSON that is no array', 0.2, function () {
  if (!has('unpack')) return false;
  return (B.unpack(JSON.stringify({ run: 'r1', n: 1 })) === null && B.unpack('"text"') === null) || false;
}, test.limit.quick);
test.run('what pack packs, unpack gives back the same', 0.2, function () {
  if (!has('pack') || !has('unpack')) return false;
  const packed = B.pack(many(3));
  return JSON.stringify(B.unpack(JSON.stringify(packed))) === JSON.stringify(packed) || false;
}, test.limit.quick);

// ── its users: the app server, in one place ──
const APP = path.join(RUN, 'spirit', 'server', 'app.js');
const appText = function () { try { return fs.readFileSync(APP, 'utf8'); } catch (e) { return ''; } };
test.run('spirit/server/app.js requires spirit/streamBundle.js', 0.2, function () {
  return /require\(\s*['"]spirit\/streamBundle\.js['"]\s*\)/.test(appText()) || false;
}, test.limit.quick);
test.run('spirit/server/app.js parses no delivery\'s json itself', 0.2, function () {
  const t = appText();
  return (t !== '' && !/JSON\.parse\(\s*(String\()?\s*a\.json\b/.test(t)) || false;
}, test.limit.quick);
test.run('spirit/server/app.js packs with the module and keeps no bundleOf of its own', 0.2, function () {
  const t = appText();
  return (t !== '' && /\.pack\(/.test(t) && !/function bundleOf\(/.test(t)) || false;
}, test.limit.quick);
