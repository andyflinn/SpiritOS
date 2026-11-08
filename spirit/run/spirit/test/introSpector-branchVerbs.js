'use strict';

// spirit/run/spirit/test/introSpector-branchVerbs.js
// The tests of spirit/introSpector.js by name: AN API BRANCH SERVES EXACTLY ITS OWN VERBS (goal/G43.20; spec:
// ./introSpector-branchVerbs.md). introSpector.js gave every api branch the FS group (G41.28). Andy, on taking it away now
// that an api id is the path of its folder: "IN THIS ONE, OR WE'LL NEVER GET FUCKING DONE.", "WSL, NOTE AND ASSERT THIS IN
// YOUR TESTS, IN THE PROPER PLACE, DILIGENTLY WITHOUT FUCKING CHEATING.", and of its two annotation verbs, "ANNOTATIONS WILL
// BE NODE ONLY." A real node on a scratch copy of the tracked files, desk switched on; its api tree read as a page reads it.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const H = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }

test.startTest('introSpector-branchVerbs.js: every api branch serves exactly the verbs its own api.js declares (goal/G43.20)');

(async function () {
  const node = await H.scratchNode();
  if (!node.up) { test.fail('the scratch node did not come up: nothing judged'); test.reportSuccessFailureCount(); process.exit(0); }
  const ask = function (call, args) {
    return fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) })
      .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }, function () { return { status: r.status, body: null }; }); }, function (e) { return { status: 0, body: String(e) }; });
  };
  const run = path.join(node.root, 'spirit', 'run');
  try {
    await ask('app.active', { key: 'desk', active: true });
    // Desk's branch is in the tree once its server answers it: until then the tree holds desk's error.
    let tree = {};
    await H.until(function () { return ask('api', {}).then(function (r) { tree = r.body || {}; return !!(tree.desk && tree.desk['items.search']); }); }, 40000);
    const branches = Object.keys(tree).filter(function (b) { return tree[b] && typeof tree[b] === 'object'; }).sort();
    ok(branches.length >= 10 && branches.indexOf('desk') !== -1, 'the world: the api tree holds ' + branches.length + ' branches, desk among them', 'branches: ' + short(branches));

    test.subHeading('each branch serves the verbs its own api.js declares, and only those');
    branches.forEach(function (b) {
      const file = [path.join(run, 'spirit', b, 'api.js'), path.join(run, 'spirit', 'app', b, 'api.js')].filter(function (f) { return fs.existsSync(f); })[0];
      if (!file) { test.fail(b + ': no spirit/' + b + '/api.js nor spirit/app/' + b + '/api.js to compare with'); return; }
      let declared = [];
      try { declared = Object.keys((require(file) || {}).verbs || {}); } catch (e) { test.fail(b + ': its api.js does not load: ' + e.message); return; }
      const served = Object.keys(tree[b]);
      const extra = served.filter(function (v) { return declared.indexOf(v) === -1; });
      const missing = declared.filter(function (v) { return served.indexOf(v) === -1; });
      ok(!extra.length && !missing.length, b + ': serves exactly the ' + declared.length + ' verbs of its api.js', b + ': ' + (extra.length ? extra.length + ' served beyond its api.js (' + short(extra.slice(0, 6)) + ')' : '') + (missing.length ? ' ' + missing.length + ' declared and not served ' + short(missing.slice(0, 6)) : ''));
    });

  } catch (e) {
    test.fail('the suite threw ' + (e && e.stack || e));
  } finally {
    if (node.child) node.child.kill();
  }
  test.reportSuccessFailureCount();
  process.exit(0);
}());
