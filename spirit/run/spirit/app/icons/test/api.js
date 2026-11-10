'use strict';

// spirit/run/spirit/app/icons/test/api.js
// The tests of spirit/app/icons/api.js, and of no other module (spec: ./api.md; goal/G43.19, box v16). The box, 7: "api.js is
// the branch's interface, the verbs and arguments the node checks a call against and a page binds by, not the code that
// handles a call (Andy: "appClient does NOT route to api.js, that file has a different purpose")"; Q5: "api.js at the app's
// top with no api/ folder"; 5: "the api branch is icons, and icons.<verb> can be granted to a peer like any branch". A
// scratch node with Icons switched on, raw calls and a real Chrome on its face page; whether a call started a run is read
// from the job spirit.app.icons, which names the pid of its last run. Who checks a call is goal/G43.32's decided 9: the
// app's run, spirit/appServer.js in front of icons.js, not the node.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const FILE = path.join(__dirname, '..', 'api.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

test.startTest('api.js: the icons branch\'s interface, which the node checks a call against and a page binds by (goal/G43.19)');

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('spirit/app/icons/api.js is not there'); return; }
  let api = null;
  try { api = require(FILE); } catch (e) { api = null; }
  const verbs = Object.keys((api && api.verbs) || {});
  ok(verbs.length >= 1, 'it names its verbs: ' + verbs.join(', '), 'api.js names no verbs: ' + short(api));
  if (!verbs.length) return;
  verbs.forEach(function (v) {
    const rules = api.verbs[v] || {};
    const bad = Object.keys(rules).filter(function (a) { return typeof rules[a] !== 'string' || !/^[a-z]+\??$/i.test(rules[a]); });
    ok(!bad.length, v + ': each argument carries a rule, ' + short(rules), v + ': arguments without a rule: ' + short(bad));
  });
  ok(!/require\s*\(/.test(fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '')), 'it handles nothing: it requires no code (the box, 7)', 'api.js requires code, so it is more than an interface');

  const node = await scratchNode({ servers: ['icons'] });
  const chrome = await chromePage(findChrome());
  try {
    if (!node.up || !node.root || chrome.error) { test.fail('no scratch node of its own or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    const call = async function (name, args) {
      const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: name, args: args }) });
      const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch (e) { b = null; }
      return { status: r.status, body: b, text: t };
    };
    const lastRun = async function () { const j = await call('job.get', { key: 'spirit.app.icons' }); return j.body && j.body.job && j.body.job.data ? String(j.body.job.data.pid || '') : ''; };
    const v = verbs[0];

    test.subHeading('the node finds it at the app\'s top: api {family: icons} answers this file');
    const fam = await call('api', { family: 'icons' });
    ok(fam.status === 200 && fam.body && fam.body.interface === fs.readFileSync(FILE, 'utf8'), 'api {family: icons} answers spirit/app/icons/api.js, word for word', 'api {family: icons}: ' + fam.status + ' ' + short(fam.text));

    // goal/G43.32, decided 9, which replaces this box's 7 on who checks: the check runs in the app's process, its run started
    // as spirit/appServer.js in front of icons.js, never in the node. Andy: "isolation, we don't want the NODE to run the
    // validation", "for one-shot servers, appClient launches appServer with the argument "spirit/app/<name>/name.js"".
    test.subHeading('goal/G43.32, decided 9: a call that breaks it is refused by a run of the app, appServer.js in front of it, not by the node');
    const r0 = await call('icons.' + v, { op: 'search', text: '' });
    await sleep(300);
    const p1 = await lastRun();
    const r1 = await call('icons.' + v, { op: 'search', text: '' });
    await sleep(300);
    const p2 = await lastRun();
    ok(r0.status === 200 && r1.status === 200 && !!p1 && !!p2 && p1 !== p2, 'the world: a call it allows starts a run, and the job names a new pid each time (' + p1 + ', ' + p2 + ')', 'a good call: ' + r1.status + ' ' + short(r1.text) + '; pids ' + short([p1, p2]) + ', so a run cannot be told from none');
    const crooked = [
      ['icons.zzNoSuchVerb', {}, 'a verb it does not name'],
      ['icons.' + v, { op: 'search', zzExtra: 1 }, 'an argument it does not name'],
      ['icons.' + v, { op: 'add', glyph: 5 }, 'a glyph that is no text'],
      ['icons.' + v, { op: 'add', glyph: 'x', keywords: 'not a list' }, 'keywords that are no list'],
      ['icons.' + v, { op: { nested: true } }, 'an op that is no id'],
    ];
    for (const c of crooked) {
      const before = await lastRun();
      const r = await call(c[0], c[1]);
      await sleep(400);
      const after = await lastRun();
      ok(r.status >= 400 && r.status < 500, c[2] + ' is refused, ' + r.status + ' ' + String((r.body && r.body.code) || ''), c[2] + ' answered ' + r.status + ' ' + short(r.text));
      ok(!!after && after !== before, c[2] + ': refused by a run of the app, not by the node (pid ' + before + ' -> ' + after + ')', c[2] + ': no run was started, so the node refused it (pid ' + before + ' -> ' + after + ')');
    }

    test.subHeading('"a page binds by" it: spirit.icons.<verb> on a page');
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    const bound = await chrome.evaluate('window.spirit.ready.then(function (s) { return typeof (s.icons && s.icons[' + JSON.stringify(v) + ']); }, function (e) { return "refused: " + String(e && e.message || e); })');
    ok(bound === 'function', 'spirit.icons.' + v + ' is a function on a page', 'spirit.icons.' + v + ' is ' + short(bound));
    const answered = await chrome.evaluate('window.spirit.ready.then(function (s) { return s.icons[' + JSON.stringify(v) + ']({ op: "search", text: "" }); }).then(function (b) { return JSON.stringify({ items: Array.isArray(b && b.items) }); }, function (e) { return "refused: " + String(e && e.message || e); })');
    ok(answered === '{"items":true}', 'and it answers a search', 'spirit.icons.' + v + ' answered ' + short(answered));
    const pageBad = await chrome.evaluate('window.spirit.ready.then(function (s) { return s.icons[' + JSON.stringify(v) + ']({ op: "search", zzExtra: 1 }); }).then(function (b) { return "answered " + JSON.stringify(b); }, function (e) { return "refused"; })');
    ok(pageBad === 'refused', 'an argument it does not name is refused on the page too', 'the page sent it: ' + short(pageBad));
  } finally {
    try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
    try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
