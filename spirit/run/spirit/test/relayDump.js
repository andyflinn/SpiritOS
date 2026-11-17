'use strict';

// spirit/run/spirit/test/relayDump.js
// The tests of spirit/relayDump.js, and of no other module (spec: ./relayDump.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
//
// What a relay holds, asked over SSH, read-only: run(rootDir, args, out) answers an exit code and says its lines through
// `out`. A relay.db is made on a scratch root under the temp folder with this tree's relayStore.js, owner.json beside it.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
// ITS TEMP FOLDERS FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"): one of its own for each
// it asks, under its suite's path, the whole of it removed when the suite ends.
const tempFolder = require('../tempFolder.js');
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/test/relayDump/' + name + tempAsked); }
test.after(function () { try { fs.rmSync(tempFolder.path('spirit/test/relayDump'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
const relayStore = require(path.join(RUN, 'spirit', 'relayStore.js'));
const D = require(path.join(RUN, 'spirit', 'relayDump.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function said(root, args) { const lines = []; const code = D.run(root, args, function (l) { lines.push(String(l)); }); return { code: code, lines: lines }; }
function key(n) { return 'MCowBQYDK2VwAyEA' + (String(n) + 'A'.repeat(43)).slice(0, 43) + '='; }
const OWNER = key('owner');
const W = { root: null, empty: null };

test.run('a relay.db holds 12 members with the label "crowd", one "solo" and the owner, and two invites', 0.2, function () {
  if (!relayStore.available()) return false;
  W.root = ownTemp('relayDump-');
  W.empty = ownTemp('relayDump-empty-');
  const s = relayStore.open(W.root);
  for (let i = 0; i < 12; i += 1) s.members.put({ publicKey: key('m' + i), publicLabel: 'crowd', claimedAt: '2026-11-0' + (i % 9 + 1) + 'T00:00:00.000Z' });
  s.members.put({ publicKey: key('solo'), publicLabel: 'solo', claimedAt: '2026-11-10T00:00:00.000Z' });
  s.members.put({ publicKey: OWNER, publicLabel: 'andy', claimedAt: '2026-11-10T00:00:00.000Z' });
  s.members.put({ publicKey: key('m-andy'), publicLabel: 'andy', claimedAt: '2026-11-11T00:00:00.000Z' });
  s.invites.add({ token: 'secret-token-1', label: 'ann', expiresAt: '2099-01-01T00:00:00.000Z', invitedBy: '' });
  s.invites.add({ token: 'secret-token-2', label: 'ben', expiresAt: '2099-01-01T00:00:00.000Z', invitedBy: '' });
  s.close();
  fs.writeFileSync(path.join(W.root, 'spirit', 'state', 'owner.json'), JSON.stringify({ owner: OWNER }));
  return fs.existsSync(path.join(W.root, 'spirit', 'state', 'relay.db')) || false;
}, test.limit.quick);

test.run('with no verb it says only the counts of members and invites', 0.2, function () {
  if (!W.root) return false;
  const r = said(W.root, []);
  return (r.code === 0 && short(r.lines) === short(['members   15', 'invites   2'])) || false;
}, test.limit.quick);
test.run('the key verb prints one member, as JSON', 0.2, function () {
  if (!W.root) return false;
  const r = said(W.root, ['key', key('solo')]);
  let m = null; try { m = JSON.parse(r.lines.join('\n')); } catch (e) { m = null; }
  return (r.code === 0 && m && m.publicKey === key('solo') && m.publicLabel === 'solo') || false;
}, test.limit.quick);
test.run('the key verb says so for an unknown key, and exits 1', 0.2, function () {
  if (!W.root) return false;
  const r = said(W.root, ['key', key('nobody')]);
  return (r.code === 1 && short(r.lines) === short(['no member with that key'])) || false;
}, test.limit.quick);
test.run('the label verb never prints the whole roll: it prints at most 10 holders and says the first 10 were shown', 0.2, function () {
  if (!W.root) return false;
  const r = said(W.root, ['label', 'crowd']);
  const rows = r.lines.filter(function (l) { return /^member /.test(l); });
  return (r.code === 0 && rows.length === 10 && r.lines[r.lines.length - 1] === '(first 10 shown)') || false;
}, test.limit.quick);
test.run('for the label verb the owner is owner.json\'s one key, not a mark on a row', 0.2, function () {
  if (!W.root) return false;
  const r = said(W.root, ['label', 'andy']);
  const own = r.lines.filter(function (l) { return l.indexOf('owner  andy  ' + OWNER) === 0; });
  const mem = r.lines.filter(function (l) { return l.indexOf('member andy  ' + key('m-andy')) === 0; });
  return (r.code === 0 && own.length === 1 && mem.length === 1 && r.lines.length === 2) || false;
}, test.limit.quick);
test.run('the label verb says so when nobody holds the label, and exits 1', 0.2, function () {
  if (!W.root) return false;
  const r = said(W.root, ['label', 'zed']);
  return (r.code === 1 && short(r.lines) === short(['nobody holds that label'])) || false;
}, test.limit.quick);
test.run('no invite token is ever printed', 0.2, function () {
  if (!W.root) return false;
  const all = [said(W.root, []), said(W.root, ['label', 'ann']), said(W.root, ['key', 'secret-token-1'])].map(function (r) { return r.lines.join('\n'); }).join('\n');
  return all.indexOf('secret-token') === -1 || false;
}, test.limit.quick);
test.run('an unknown verb, or a verb without its argument, says the usage and exits 1', 0.2, function () {
  if (!W.root) return false;
  const got = [said(W.root, ['roll']), said(W.root, ['key']), said(W.root, ['label'])];
  return got.every(function (r) { return r.code === 1 && r.lines.length === 1 && /^usage: /.test(r.lines[0]); }) || false;
}, test.limit.quick);
test.run('with no relay.db under the root it says so, exits 1 and makes none, being read-only', 0.2, function () {
  if (!W.empty) return false;
  const r = said(W.empty, []);
  return (r.code === 1 && /^no relay\.db under /.test(r.lines[0]) && !fs.existsSync(path.join(W.empty, 'spirit', 'state', 'relay.db'))) || false;
}, test.limit.quick);
test.run('the dump writes nothing: the relay.db is byte for byte as before', 0.2, function () {
  if (!W.root) return false;
  const f = path.join(W.root, 'spirit', 'state', 'relay.db');
  const before = fs.readFileSync(f);
  said(W.root, []); said(W.root, ['label', 'crowd']); said(W.root, ['key', OWNER]);
  return Buffer.compare(before, fs.readFileSync(f)) === 0 || false;
}, test.limit.quick);
test.run('the scratch roots are removed at the end', 0.2, function () {
  try { relayStore.closeAll(); } catch (e) { /* none open */ }
  [W.root, W.empty].forEach(function (d) { if (d) fs.rmSync(d, { recursive: true, force: true }); });
  return !(W.root && fs.existsSync(W.root)) || false;
}, test.limit.quick);
