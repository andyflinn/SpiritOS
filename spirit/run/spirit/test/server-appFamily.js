'use strict';

// spirit/run/spirit/test/server-appFamily.js
// THE NODE FINDS AN APP'S FAMILY AT THE APP'S TOP (goal/G43.27, requirement 2; spec: ./server-appFamily.md): server.js's
// familyDir looks for spirit/app/<name>/api.js, and appServer.js withAgents takes the app folder itself as the family
// folder. Andy: "spirit/app/<name>/ folders are now ALMOST the same shape as spirit/jobs/ and other system api-branches,
// EXCEPT, api.js sits in a folder ./api.js", "i think the shape needs alignment.". A scratch node
// (headLessChrome.scratchNode) with the agent app switched on, never a live one.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
// Line ends aside: a Windows checkout (autocrlf) holds CRLF where git holds LF.
function read(rel) { const f = path.join(RUN, rel); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : ''; }

test.startTest('server-appFamily.js: the node finds an app\'s family at the app\'s top (goal/G43.27)');

(async function () {
  test.subHeading('2. the node finds it there');
  // A scratch node, the agent app switched on (the owner's app.active), so the node starts its server and serves its family.
  const node = await H.scratchNode();
  ok(!!node.up, 'the world: a scratch node is up', 'the scratch node did not come up: nothing judged');
  const ask = function (call, args) {
    return fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) })
      .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }, function () { return { status: r.status, body: null }; }); }, function (e) { return { status: 0, body: String(e) }; });
  };
  const on = node.up ? await ask('app.active', { key: 'agent', active: true }) : { status: 0 };
  ok(on.status === 200, 'the world: the agent app is switched on', 'app.active agent answered ' + short(on));
  let fam = { status: 0 };
  await H.until(function () { return ask('api', { family: 'agent' }).then(function (a) { fam = a; return a.status === 200; }); }, 30000);
  const iface = fam.body && typeof fam.body.interface === 'string' ? fam.body.interface.replace(/\r\n/g, '\n') : '';
  ok(fam.status === 200 && iface.length > 0, 'the world: the node serves the agent\'s interface', 'api {family: agent} answered ' + short(fam));
  ok(iface && iface === read('spirit/app/agent/api.js'), 'the interface the node serves is spirit/app/agent/api.js', 'the interface served is not spirit/app/agent/api.js (' + (read('spirit/app/agent/api.js') ? 'it differs' : 'there is no such file') + ')');
  // Its folder is the app folder, and no FS set rides on its branch (goal/G43.20): its files are spirit.fs's, by that path.
  const tree = await ask('api', {});
  ok(tree.status === 200 && tree.body && tree.body.agent && !Object.keys(tree.body.agent).some(function (v) { return /^FS\./.test(v); }), 'the agent branch carries no FS set', 'api: ' + short(tree.body && tree.body.agent));
  if (node.child) node.child.kill();

  test.reportSuccessFailureCount();
  process.exit(0);
})();
