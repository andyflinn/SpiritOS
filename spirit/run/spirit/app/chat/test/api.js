'use strict';

// spirit/run/spirit/app/chat/test/api.js
// The tests of spirit/app/chat/api.js, and of no other module (spec: ./api.md; goal/G43.31). The box: "nodeChat.js ...
// its verbs as api.js lists them", and "The branch name is the folder's: chat ... the verbs are chat.<verb>". Read from
// the disc; then on a scratch node of its own with the app switched on, the node's own answer for the branch and every
// verb it lists asked as the owner asks it.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const FILE = path.join(__dirname, '..', 'api.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('api.js: the interface of the branch chat (goal/G43.31)');

(async function () {
  test.subHeading('the interface: verbs and their rules, and no code');
  let verbs = null;
  try { verbs = require(FILE).verbs; } catch (e) { verbs = null; }
  ok(!!verbs && typeof verbs === 'object' && Object.keys(verbs).length > 0, 'it lists its verbs', 'api.js lists no verbs');
  if (!verbs) return;
  ok(!/require\s*\(/.test(fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '')), 'it requires no code: it is an interface only', 'api.js requires code');
  ok(!!verbs['line.write'], 'it lists line.write, which the server serves', 'api.js lists no line.write');
  ok(!!verbs['line.receive'], 'it lists line.receive, which the server serves', 'api.js lists no line.receive');
  ok(!!verbs['chat.read'], 'it lists chat.read, which the server serves', 'api.js lists no chat.read');
  ok(!!verbs['chat.search'], 'it lists chat.search, which the server serves', 'api.js lists no chat.search');
  ok(!!verbs['chats.search'], 'it lists chats.search, which the server serves', 'api.js lists no chats.search');

  const node = await H.scratchNode();
  try {
    if (!node.up) { test.fail('no scratch node: nothing judged'); return; }
    const call = async function (name, args) {
      const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: name, args: args || {} }) });
      const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch (e) { b = null; }
      return { status: r.status, body: b, text: t };
    };
    await call('app.active', { key: 'chat', active: true });
    const up = await H.until(function () { return call('chat.chats.search', {}).then(function (r) { return r.status === 200; }); }, 40000);
    ok(up, 'the world: switched on, the server answers', 'chat.chats.search never answered 200: ' + short((await call('chat.chats.search', {})).text));

    test.subHeading('the node finds it as the branch chat, the folder\'s name');
    const fam = await call('api', { family: 'chat' });
    ok(fam.status === 200 && !!fam.body && fam.body.interface === fs.readFileSync(FILE, 'utf8'), 'api {family: chat} answers spirit/app/chat/api.js, word for word', 'api {family: chat}: ' + fam.status + ' ' + short(fam.text));
    const old = await call('api', { family: 'chatClerver' });
    ok(!(old.status === 200 && old.body && old.body.interface), 'and api {family: chatClerver} answers none', 'api {family: chatClerver} still answers: ' + short(old.text));

    test.subHeading('every verb it lists is served as chat.<verb>');
    for (const v of Object.keys(verbs)) {
      const r = await call('chat.' + v, {});
      ok(r.status !== 404 && !/no.such.verb/i.test(r.text), 'chat.' + v + ' is a verb of the node (answered ' + r.status + ')', 'chat.' + v + ' answered no-such-verb: ' + short(r.text));
    }

    test.subHeading('the attacker: arguments its rules refuse, before the server hears them');
    const noPeer = await call('chat.chat.read', { before: '', after: '' });
    ok(noPeer.status === 400, 'chat.read without the peer it requires is refused 400', 'chat.read with no peer: ' + noPeer.status + ' ' + short(noPeer.body));
    const noTo = await call('chat.line.write', { text: 'zz to nobody' });
    ok(noTo.status === 400, 'line.write without the to it requires is refused 400', 'line.write with no to: ' + noTo.status + ' ' + short(noTo.body));
    const stray = await call('chat.chats.search', { zz: 1 });
    ok(stray.status === 400, 'an argument it does not list is refused 400', 'chats.search {zz: 1}: ' + stray.status + ' ' + short(stray.body));
  } finally {
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
