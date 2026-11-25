'use strict';

// spirit/run/spirit/client/test/apiTreeIndex.js
// The tests of spirit/client/apiTreeIndex.js, and of no other module (spec: ./apiTreeIndex.md). Its own test, owed since
// the rule "every production script has its own test" (goal/G47.1, box v72).
//
// The owner's api tree, read for choosing (apiAuth/G1.8, G1.9, G1.6): which servers it holds, one server's verbs, and
// whether it serves a path today. Pure, dual target: driven in node, and once in a window of its own (vm) as a page
// loads it.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/client/apiTreeIndex.js';
const FILE = path.join(RUN, SUBJECT);
const T = LOADER.requireScript(SUBJECT);

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// A tree as the verb api answers it on /spirit (goal/G30.6): a branch per server, its verbs; a server that did not
// answer is { ok: false, ... }.
const TREE = {
  fs: { read: {}, write: {}, DEBUG: {} },
  desk: { search: {}, add: {} },
  broken: { ok: false, error: 'did not answer' },
  odd: 'not a branch',
  list: ['not', 'a', 'branch'],
  nothing: null,
};

// ── servers (apiAuth/G1.8) ──
test.run('servers answers the names of the servers in the tree, sorted', 0.2, function () {
  return short(T.servers(TREE)) === short(['desk', 'fs']) || false;
}, test.limit.quick);
test.run('to servers, a server that did not answer, its branch ok false, is not part of the tree', 0.2, function () {
  return T.servers(TREE).indexOf('broken') === -1 || false;
}, test.limit.quick);
test.run('to servers, a branch that is no object, such as a string, an array or null, is no server', 0.2, function () {
  const s = T.servers(TREE);
  return (s.indexOf('odd') === -1 && s.indexOf('list') === -1 && s.indexOf('nothing') === -1) || false;
}, test.limit.quick);
test.run('servers answers no servers for no tree, an array or a string', 0.2, function () {
  const got = [T.servers(null), T.servers(undefined), T.servers([{ a: 1 }]), T.servers('fs')];
  return got.every(function (x) { return Array.isArray(x) && x.length === 0; }) || false;
}, test.limit.quick);

// ── verbs (apiAuth/G1.9) ──
test.run('verbs answers one server\'s verbs, sorted', 0.2, function () {
  return short(T.verbs(TREE, 'desk')) === short(['add', 'search']) || false;
}, test.limit.quick);
test.run('verbs never offers DEBUG, which is the owner\'s', 0.2, function () {
  return short(T.verbs(TREE, 'fs')) === short(['read', 'write']) || false;
}, test.limit.quick);
test.run('to verbs, a server the tree does not hold, or whose branch is an error, has no verbs', 0.2, function () {
  const got = [T.verbs(TREE, 'nope'), T.verbs(TREE, 'broken'), T.verbs(null, 'fs')];
  return got.every(function (x) { return Array.isArray(x) && x.length === 0; }) || false;
}, test.limit.quick);

// ── serves (apiAuth/G1.6) ──
test.run('to serves, a server that answered is served, and so is a verb among its verbs', 0.2, function () {
  return (T.serves(TREE, 'fs') === true && T.serves(TREE, 'fs.read') === true) || false;
}, test.limit.quick);
test.run('to serves, a verb the server does not have, and a server gone or broken, are not served', 0.2, function () {
  const got = [T.serves(TREE, 'fs.delete'), T.serves(TREE, 'gone'), T.serves(TREE, 'gone.read'), T.serves(TREE, 'broken'), T.serves(TREE, 'broken.x')];
  return got.every(function (x) { return x === false; }) || false;
}, test.limit.quick);
test.run('to serves, DEBUG is nobody\'s grant', 0.2, function () {
  return T.serves(TREE, 'fs.DEBUG') === false || false;
}, test.limit.quick);
test.run('to serves, no path is not served', 0.2, function () {
  const got = [T.serves(TREE, ''), T.serves(TREE, null), T.serves(TREE, undefined)];
  return got.every(function (x) { return x === false; }) || false;
}, test.limit.quick);
test.run('serves only reports, so asking leaves the tree as it was and a deprecated grant is reported, never pruned', 0.2, function () {
  const t = JSON.parse(JSON.stringify(TREE));
  T.serves(t, 'fs.gone'); T.serves(t, 'gone'); T.verbs(t, 'fs'); T.servers(t);
  return short(t) === short(TREE) || false;
}, test.limit.quick);

// ── in a page ──
test.run('in a page it is window.spirit.required.spirit.client.apiTreeIndex, the same three, with no require', 0.2, function () {
  const win = { spirit: {} };
  const ctx = { window: win };
  try { vm.runInNewContext(fs.readFileSync(FILE, 'utf8'), ctx, { filename: FILE }); }
  catch (e) { return false; }
  const t = win.spirit.required.spirit.client.apiTreeIndex;
  if (!t) return false;
  return (short(t.servers(TREE)) === short(['desk', 'fs']) && short(t.verbs(TREE, 'fs')) === short(['read', 'write']) && t.serves(TREE, 'desk.add') === true) || false;
}, test.limit.quick);
