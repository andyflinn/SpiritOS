'use strict';

// spirit/run/spirit/test/introSpector-branchVerbs.js
// The tests of spirit/introSpector.js by name: AN API BRANCH SERVES ITS OWN VERBS AND NO FS GROUP (goal/G43.20; spec:
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

test.startTest('introSpector-branchVerbs.js: every api branch serves the verbs its api.js declares, and no FS group (goal/G43.20)');

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

    test.subHeading('no branch offers the FS group');
    const withFS = branches.filter(function (b) { return Object.keys(tree[b]).some(function (v) { return /^FS\./.test(v); }); });
    ok(branches.length > 0 && !withFS.length, 'no api branch serves an FS.* verb (FS.loadFile, FS.annotateFile, ...)', withFS.length + ' do: ' + short(withFS.map(function (b) { return b + ' ' + Object.keys(tree[b]).filter(function (v) { return /^FS\./.test(v); }).length; })));

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

    test.subHeading('"ANNOTATIONS WILL BE NODE ONLY": no annotation verb in any branch');
    const annot = branches.filter(function (b) { return Object.keys(tree[b]).some(function (v) { return /annotat/i.test(v); }); });
    ok(!annot.length, 'no branch serves annotate, annotations, FS.annotateFile or FS.getAnnotations', 'served in ' + short(annot));
    const call = await ask('fs.annotations', { path: 'README.md' });
    ok(call.status >= 400, 'a call of fs.annotations is refused at the door', 'fs.annotations answered ' + short(call));

    // THE ATTACKER (rule/27: "tests MUST be "the enemy, the attacker" an try everything conceivable to break the code"):
    // every gone verb asked raw at the door, past the spirit object, in every spelling that might reach a handler. Each must
    // be refused, and a write asked must leave nothing on the disc.
    test.subHeading('the attacker: the gone verbs asked raw at the door, every spelling');
    const probe = 'zzPwned-' + process.pid + '.txt';
    const tries = [];
    ['fs', 'desk', 'auth', 'node', 'app'].forEach(function (b) {
      ['FS.loadFile', 'FS.saveFile', 'FS.deleteFile', 'FS.statFile', 'FS.listFiles', 'FS.path', 'FS.annotateFile', 'FS.getAnnotations'].forEach(function (v) { tries.push(b + '.' + v); });
    });
    tries.push('FS.loadFile', 'FS.saveFile', 'fs.FS', 'fs.annotate', 'fs.annotations', 'fs.FS.loadFile.call', 'fs.__proto__', 'fs.constructor', 'fs.hasOwnProperty',
      'fs.__proto__.annotate', 'fs..annotate', 'Fs.annotate', 'FS.annotateFile', 'fs.fs.annotate', 'desk.FS', 'fs.FS.saveFile ', ' fs.FS.saveFile');
    const let_in = [];
    for (const verb of tries) {
      const r = await ask(verb, { path: probe, content: 'pwned', payload: { pwned: true }, text: 'pwned' });
      if (!(r.status >= 400)) let_in.push(verb + ' ' + r.status);
    }
    ok(!let_in.length, 'all ' + tries.length + ' spellings are refused at the door, a 4xx', let_in.length + ' got in: ' + short(let_in));
    const written = [];
    (function walk(dir, rel) {
      let names = [];
      try { names = fs.readdirSync(dir); } catch (e) { return; }
      names.forEach(function (n) {
        if (n === 'node_modules' || n === '.git') return;
        const p = path.join(dir, n);
        let st = null;
        try { st = fs.lstatSync(p); } catch (e) { return; }
        if (st.isDirectory()) walk(p, rel + n + '/');
        else if (n.indexOf('zzPwned-') === 0) written.push(rel + n);
      });
    }(node.root, ''));
    ok(!written.length, 'and no file was written anywhere in the scratch tree by them', 'written: ' + short(written));
    const sidecars = [];
    (function walk(dir) {
      let names = [];
      try { names = fs.readdirSync(dir); } catch (e) { return; }
      names.forEach(function (n) { const p = path.join(dir, n); try { if (fs.lstatSync(p).isDirectory()) walk(p); else if (/zzPwned.*\.sidecar\.json$/.test(n)) sidecars.push(p); } catch (e) { /* gone */ } });
    }(node.root));
    ok(!sidecars.length, 'nor any sidecar (an annotation\'s file) for the probe', 'sidecars: ' + short(sidecars));
  } catch (e) {
    test.fail('the suite threw ' + (e && e.stack || e));
  } finally {
    if (node.child) node.child.kill();
  }
  test.reportSuccessFailureCount();
  process.exit(0);
}());
