'use strict';

// spirit/run/spirit/test/appClient.js
// The tests of spirit/appClient.js, the node's client of its app servers, and of no other module (spec: ./appClient.md).
// It runs a scratch node and asks it as the owner, on loopback, as a page on that machine does (POST /api/spirit). The
// family asked is the fileServer's, a server the scratch node runs; its FS group reads and writes its family folder.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../..');
const familyPath = require(path.join(RUN, 'spirit', 'spirit.js')).familyPath;
const test = require(path.join(RUN, 'test', 'testReport.js'));
const H = require(path.join(RUN, 'test', 'headLessChrome.js'));
const limits = require(path.join(RUN, 'spirit', 'limits.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('appClient.js: the node asks its app servers');

(async function () {
  test.subHeading('goal/G41.28: the owner\'s answer on loopback comes back whole');
  // The ruling cw built to: on loopback the owner's call is marked, and appClient and appServer let that one answer
  // past ANSWER_MAX; every other answer stays bounded. A manager bigger than one answer then loads whole.
  const node = await H.scratchNode();
  // A file of its own in the fileServer's family folder, written and read through the owner's FS verbs, and deleted.
  const name = 'wsl-appClient-probe-' + process.pid + '.txt';
  const size = limits.ANSWER_MAX + 4000;
  const text = Array.from({ length: size }, function (x, i) { return String.fromCharCode(97 + (i % 26)); }).join('');
  const post = function (call, args) {
    return fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args }) })
      .then(function (r) { return r.text().then(function (t) { let body = null; try { body = JSON.parse(t); } catch (e) { /* judged as text */ } return { status: r.status, body: body, text: t }; }); },
        function (e) { return { status: 0, body: null, text: String(e && e.message) }; });
  };
  try {
    if (!node.up) { test.fail('the scratch node did not come up'); return; }
    ok(size < limits.BODY_MAX, 'the probe, ' + size + ' bytes, is past ANSWER_MAX (' + limits.ANSWER_MAX + ') and fits what a request may send', 'the probe does not fit a request: ' + size + ' bytes');
    const saved = await post('fileServer.FS.saveFile', { path: name, content: text });
    ok(saved.status === 200 && saved.body && saved.body.saved === true, 'the owner saves the probe through fileServer.FS.saveFile', 'save: ' + saved.status + ' ' + short(saved.text));
    const got = await post('fileServer.FS.loadFile', { path: name });
    const back = got.body && got.body.text;
    ok(got.status === 200 && back === text, 'the owner\'s fileServer.FS.loadFile of ' + size + ' bytes, on loopback, comes back whole',
      'the owner\'s load of ' + size + ' bytes answered ' + got.status + ': ' + (typeof back === 'string' ? back.length + ' bytes' : short(got.text)));
  } finally {
    try { await post('fileServer.FS.deleteFile', { path: name }); } catch (e) { /* judged below */ }
    try { fs.rmSync(path.join(RUN, path.dirname(familyPath('fileServer')), name), { force: true }); } catch (e) { /* gone */ }
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    await H.sleep(300);
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
