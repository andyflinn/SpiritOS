'use strict';

// spirit/run/spirit/app/chat/test/data.js
// The tests of spirit/app/chat/data.js, and of no other module (spec: ./data.md; goal/G43.31). The box: "The branch name
// is the folder's: chat (Q1, Andy: "The BRANCH name (FUCK THE TERM "Family"!!!!!!!!!!!!) is motherfucking <name> in
// spirit/app/<name>...."). chatClerver goes everywhere: the cache is spirit.data.chat". Written from reading data.js. The
// translator runs as it does: in a window of its own beside the real spirit.data (spirit/data.js), which it writes into;
// the server's lines are handed in as the node's stream hands them, jobs of module spirit.app.chat.
// One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'data.js');
const SPIRIT_DATA = path.join(RUN, 'spirit', 'data.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// A peer's public key, base64 with a + and a / in it, as a node's key is.
const PEER = 'Ab+c/DeF0123456789abcdefghijklmnopqrstuvwxy=';
const OTHER = 'Zz+y/XwV9876543210zyxwvutsrqponmlkjihgfedcb=';
// This page's home node: the jobs its stream hands come from it, and spirit.data keeps them as its own.
const HOME = 'Hh+o/MeN0de0123456789abcdefghijklmnopqrstu=';

function world() {
  const win = { JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Map: Map, Math: Math, unescape: unescape, encodeURIComponent: encodeURIComponent };
  win.window = win;
  win.spirit = {};
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(SPIRIT_DATA, 'utf8'), win, { filename: SPIRIT_DATA });
  // The page's one data set, its node known, as spirit.start leaves it before any app runs.
  win.spirit.data.homeNode(HOME);
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  const D = win.spirit.data;
  let n = 0;
  return { D: D, C: ((D || {}).chat || {}).data,
    // A line the server published, as the stream hands it: a job of module spirit.app.chat whose app holds the line.
    job: function (line, module) { D.takeJob({ id: 'j' + (++n), module: module || 'spirit.app.chat', data: {}, app: { line: line } }, HOME); } };
}
const line = function (peer, sent, seq, at, text) { return { peer: peer, sent: sent, seq: seq, at: at, text: text, receivedAt: '', re: { writer: '', seq: 0 }, refused: '' }; };

// What the tests make, for the tests after them.
const X = { w: null, told: [], off: null };
const NO_CACHE = 'no spirit.data.chat: it was not made';

// ── the branch is chat: spirit.data.chat ──
test.run('it makes spirit.data.chat, its reads on .data', 0.2, function () {
  X.w = world();
  const w = X.w;
  return !!w.C && typeof w.C.lines === 'function' ? true : 'spirit.data.chat.data is ' + short(w.C && Object.keys(w.C));
}, test.limit.quick);
test.run('and no spirit.data.chatClerver', 0.2, function () {
  if (!X.w) return 'no window: it was not made';
  return !(X.w.D && X.w.D.chatClerver) ? true : 'spirit.data.chatClerver is still made';
}, test.limit.quick);

// ── a line the server publishes is kept, as the stream hands it ──
test.run('both lines are kept under the peer, oldest first', 0.2, function () {
  const w = X.w;
  if (!w || !w.C) return NO_CACHE;
  X.off = w.C.published(function (peer, l, fresh) { X.told.push({ peer: peer, seq: l.seq, fresh: fresh }); });
  w.job(line(PEER, 1, 1, '2026-11-09T10:00:00.000Z', 'zz one'));
  w.job(line(PEER, 0, 1, '2026-11-09T10:01:00.000Z', 'zz an answer'));
  const kept = w.C.lines(PEER);
  return kept.length === 2 && kept[0].text === 'zz one' && kept[1].text === 'zz an answer' ? true : 'lines(PEER): ' + short(kept);
}, test.limit.quick);
test.run('line(peer, sent, seq) finds one', 0.2, function () {
  const w = X.w;
  if (!w || !w.C) return NO_CACHE;
  return !!w.C.line(PEER, 0, 1) && w.C.line(PEER, 0, 1).text === 'zz an answer' ? true : 'line(PEER, 0, 1): ' + short(w.C.line(PEER, 0, 1));
}, test.limit.quick);
test.run('its readers are told, after it is kept, and told it is fresh', 0.2, function () {
  if (!X.w || !X.w.C) return NO_CACHE;
  return X.told.length === 2 && X.told[0].fresh === true ? true : 'told: ' + short(X.told);
}, test.limit.quick);
test.run('the same line again is told, not fresh, and kept once', 0.2, function () {
  const w = X.w;
  if (!w || !w.C) return NO_CACHE;
  w.job(line(PEER, 1, 1, '2026-11-09T10:00:00.000Z', 'zz one'));
  return X.told.length === 3 && X.told[2].fresh === false && w.C.lines(PEER).length === 2 ? true : 'told: ' + short(X.told) + ', lines ' + w.C.lines(PEER).length;
}, test.limit.quick);
test.run('a reader that went is told nothing more', 0.2, function () {
  const w = X.w;
  if (!w || !w.C || !X.off) return NO_CACHE;
  X.off();
  w.job(line(PEER, 1, 2, '2026-11-09T10:02:00.000Z', 'zz two'));
  return X.told.length === 3 ? true : 'told after off: ' + short(X.told);
}, test.limit.quick);

// ── the attacker: lines of another job, a line with no peer, another peer's lines ──
test.run('a line in another job\'s publish is never kept as a chat line', 0.2, function () {
  const w = X.w;
  if (!w || !w.C) return NO_CACHE;
  w.job(line(PEER, 1, 9, '2026-11-09T11:00:00.000Z', 'zz not chat'), 'spirit.app.desk');
  return !w.C.line(PEER, 1, 9) ? true : 'kept: ' + short(w.C.line(PEER, 1, 9));
}, test.limit.quick);
test.run('nor one under the old name spirit.app.chatClerver', 0.2, function () {
  const w = X.w;
  if (!w || !w.C) return NO_CACHE;
  w.job(line(PEER, 1, 9, '2026-11-09T11:00:00.000Z', 'zz old name'), 'spirit.app.chatClerver');
  return !w.C.line(PEER, 1, 9) ? true : 'kept: ' + short(w.C.line(PEER, 1, 9));
}, test.limit.quick);
test.run('a line with no peer is not kept', 0.2, function () {
  const w = X.w;
  if (!w || !w.C) return NO_CACHE;
  w.job(line('', 1, 5, '2026-11-09T11:00:00.000Z', 'zz nobody'));
  return w.C.lines('').length === 0 ? true : 'lines(""): ' + short(w.C.lines(''));
}, test.limit.quick);
test.run('each peer\'s lines are its own', 0.2, function () {
  const w = X.w;
  if (!w || !w.C) return NO_CACHE;
  w.job(line(OTHER, 1, 1, '2026-11-09T12:00:00.000Z', 'zz other'));
  return w.C.lines(OTHER).length === 1 && w.C.lines(PEER).every(function (l) { return l.text !== 'zz other'; }) ? true : 'lines: ' + short({ other: w.C.lines(OTHER), peer: w.C.lines(PEER) });
}, test.limit.quick);

// ── chats.search's answer, kept: one row per peer ──
test.run('the row of a chat is kept by its peer', 0.2, function () {
  const w = X.w;
  if (!w || !w.C) return NO_CACHE;
  w.C.keepChats({ items: [{ key: PEER, label: JSON.stringify({ peer: PEER, at: '2026-11-09T10:02:00.000Z', sent: 1, seq: 2, unanswered: 0 }) }, { key: OTHER, label: 'not json' }] });
  return !!w.C.chat(PEER) && w.C.chat(PEER).seq === 2 ? true : 'chat(PEER): ' + short(w.C.chat(PEER));
}, test.limit.quick);
test.run('a row whose label is no record is not kept', 0.2, function () {
  const w = X.w;
  if (!w || !w.C) return NO_CACHE;
  return w.C.chat(OTHER) === null ? true : 'chat(OTHER): ' + short(w.C.chat(OTHER));
}, test.limit.quick);
test.run('its lines live on a branch of chat, named so', 0.2, function () {
  const w = X.w;
  if (!w || !w.C) return NO_CACHE;
  return (/(^|\/)chat(\/|$)/).test(String(w.C.branch)) && !/chatClerver/.test(String(w.C.branch)) ? true : 'branch: ' + short(w.C.branch);
}, test.limit.quick);
