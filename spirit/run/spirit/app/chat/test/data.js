'use strict';

// spirit/run/spirit/app/chat/test/data.js
// The tests of spirit/app/chat/data.js, and of no other module (spec: ./data.md; goal/G43.31). The box: "The branch name
// is the folder's: chat (Q1, Andy: "The BRANCH name (FUCK THE TERM "Family"!!!!!!!!!!!!) is motherfucking <name> in
// spirit/app/<name>...."). chatClerver goes everywhere: the cache is spirit.data.chat". Written from reading data.js. The
// translator runs as it does: in a window of its own beside the real spirit.data (spirit/data.js), which it writes into;
// the server's lines are handed in as the node's stream hands them, jobs of module spirit.app.chat.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'data.js');
const SPIRIT_DATA = path.join(RUN, 'spirit', 'data.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
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

test.startTest('data.js: what a page knows of its chats, the branch chat, following the job spirit.app.chat (goal/G43.31)');

(function () {
  test.subHeading('the branch is chat: spirit.data.chat');
  const w = world();
  ok(!!w.C && typeof w.C.lines === 'function', 'it makes spirit.data.chat, its reads on .data', 'spirit.data.chat.data is ' + short(w.C && Object.keys(w.C)));
  ok(!(w.D && w.D.chatClerver), 'and no spirit.data.chatClerver', 'spirit.data.chatClerver is still made');
  if (!w.C) return;

  test.subHeading('a line the server publishes is kept, as the stream hands it');
  let told = [];
  const off = w.C.published(function (peer, l, fresh) { told.push({ peer: peer, seq: l.seq, fresh: fresh }); });
  w.job(line(PEER, 1, 1, '2026-11-09T10:00:00.000Z', 'zz one'));
  w.job(line(PEER, 0, 1, '2026-11-09T10:01:00.000Z', 'zz an answer'));
  const kept = w.C.lines(PEER);
  ok(kept.length === 2 && kept[0].text === 'zz one' && kept[1].text === 'zz an answer', 'both lines are kept under the peer, oldest first', 'lines(PEER): ' + short(kept));
  ok(!!w.C.line(PEER, 0, 1) && w.C.line(PEER, 0, 1).text === 'zz an answer', 'line(peer, sent, seq) finds one', 'line(PEER, 0, 1): ' + short(w.C.line(PEER, 0, 1)));
  ok(told.length === 2 && told[0].fresh === true, 'its readers are told, after it is kept, and told it is fresh', 'told: ' + short(told));
  w.job(line(PEER, 1, 1, '2026-11-09T10:00:00.000Z', 'zz one'));
  ok(told.length === 3 && told[2].fresh === false && w.C.lines(PEER).length === 2, 'the same line again is told, not fresh, and kept once', 'told: ' + short(told) + ', lines ' + w.C.lines(PEER).length);
  off();
  w.job(line(PEER, 1, 2, '2026-11-09T10:02:00.000Z', 'zz two'));
  ok(told.length === 3, 'a reader that went is told nothing more', 'told after off: ' + short(told));

  test.subHeading('the attacker: lines of another job, a line with no peer, another peer\'s lines');
  w.job(line(PEER, 1, 9, '2026-11-09T11:00:00.000Z', 'zz not chat'), 'spirit.app.desk');
  ok(!w.C.line(PEER, 1, 9), 'a line in another job\'s publish is never kept as a chat line', 'kept: ' + short(w.C.line(PEER, 1, 9)));
  w.job(line(PEER, 1, 9, '2026-11-09T11:00:00.000Z', 'zz old name'), 'spirit.app.chatClerver');
  ok(!w.C.line(PEER, 1, 9), 'nor one under the old name spirit.app.chatClerver', 'kept: ' + short(w.C.line(PEER, 1, 9)));
  w.job(line('', 1, 5, '2026-11-09T11:00:00.000Z', 'zz nobody'));
  ok(w.C.lines('').length === 0, 'a line with no peer is not kept', 'lines(""): ' + short(w.C.lines('')));
  w.job(line(OTHER, 1, 1, '2026-11-09T12:00:00.000Z', 'zz other'));
  ok(w.C.lines(OTHER).length === 1 && w.C.lines(PEER).every(function (l) { return l.text !== 'zz other'; }), 'each peer\'s lines are its own', 'lines: ' + short({ other: w.C.lines(OTHER), peer: w.C.lines(PEER) }));

  test.subHeading('chats.search\'s answer, kept: one row per peer');
  w.C.keepChats({ items: [{ key: PEER, label: JSON.stringify({ peer: PEER, at: '2026-11-09T10:02:00.000Z', sent: 1, seq: 2, unanswered: 0 }) }, { key: OTHER, label: 'not json' }] });
  ok(!!w.C.chat(PEER) && w.C.chat(PEER).seq === 2, 'the row of a chat is kept by its peer', 'chat(PEER): ' + short(w.C.chat(PEER)));
  ok(w.C.chat(OTHER) === null, 'a row whose label is no record is not kept', 'chat(OTHER): ' + short(w.C.chat(OTHER)));
  ok(/(^|\/)chat(\/|$)/.test(String(w.C.branch)) && !/chatClerver/.test(String(w.C.branch)), 'its lines live on a branch of chat, named so', 'branch: ' + short(w.C.branch));
}());
test.reportSuccessFailureCount();
