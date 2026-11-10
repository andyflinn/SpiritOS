'use strict';

// spirit/run/spirit/test/introSpector-coreWrite.js
// A family's folder is not written through the family (spec: ./introSpector-coreWrite.md). goal/G43.23, item 1, closed the
// hole of a family's FS.saveFile overwriting a core file; goal/G43.20 took the FS set off every branch altogether (Andy:
// "those owner only FS verbs are no longer needed, because not the api ID spirit.fs or spirit.api.desk ARE the path to all
// those files"). A real node on a scratch copy of the tracked files, asked as the owner at its own loopback door.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, sleep } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('introSpector-coreWrite.js: no family writes its folder, a core file least of all (goal/G43.23, goal/G43.20)');

// A node family's api.js, and an app's own <name>.json, core whatever it says (goal/G43.14). The desk app is turned on.
const CORE = [
  { family: 'contact', path: 'api.js', run: 'spirit/contact/api.js' },
  { family: 'app', path: 'api.js', run: 'spirit/app/api.js' },
  { family: 'desk', path: 'desk.json', run: 'spirit/app/desk/desk.json' },
];

(async function () {
  const N = await scratchNode({ servers: ['desk'] });
  const post = function (call, args) {
    return fetch(N.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args }) })
      .then(function (r) { return r.text().then(function (t) { let body = null; try { body = JSON.parse(t); } catch (e) { /* judged as text */ } return { status: r.status, body: body, text: t }; }); },
        function (e) { return { status: 0, body: null, text: String(e && e.message) }; });
  };
  try {
    ok(N.up && !!N.root, 'the world: a scratch node comes up on a copy of its own', 'the scratch node did not come up: nothing judged');
    if (!N.up || !N.root) return;
    const run = path.join(N.root, 'spirit', 'run');

    test.subHeading('goal/G43.20: no branch carries an FS set');
    const tree = (await post('api', {})).body || {};
    const withFs = Object.keys(tree).filter(function (fam) { return tree[fam] && Object.keys(tree[fam]).some(function (v) { return /^FS\./.test(v); }); });
    ok(Object.keys(tree).length > 0 && withFs.length === 0, 'no branch of the node\'s tree holds an FS. verb', 'branches with FS verbs: ' + short(withFs));

    test.subHeading('the box of goal/G43.23: "a family\'s FS.saveFile / deleteFile ... can overwrite any api.js or app code"');
    for (const c of CORE) {
      const disk = path.join(run, c.run);
      const before = fs.existsSync(disk) ? fs.readFileSync(disk, 'utf8') : null;
      ok(before !== null, 'the world: ' + c.run + ' is there', c.run + ' is missing: nothing judged');
      if (before === null) continue;
      const saved = await post(c.family + '.FS.saveFile', { path: c.path, content: '// overwritten by introSpector-coreWrite.js\n' });
      const deleted = await post(c.family + '.FS.deleteFile', { path: c.path });
      const after = fs.existsSync(disk) ? fs.readFileSync(disk, 'utf8') : null;
      ok(saved.status >= 400 && deleted.status >= 400 && after === before, c.family + '.FS.saveFile and FS.deleteFile on ' + c.run + ' are refused (' + saved.status + ', ' + deleted.status + '), the file unchanged',
        c.family + '.FS on ' + c.run + ': save ' + saved.status + ' ' + short(saved.text) + ', delete ' + deleted.status + ', the file ' + (after === before ? 'unchanged' : 'CHANGED'));
      if (after !== before) { try { fs.writeFileSync(disk, before); } catch (e) { /* scratch */ } }
    }
  } finally {
    try { if (N.child) N.child.kill(); } catch (e) { /* gone */ }
    await sleep(300);
    try { if (N.root) fs.rmSync(N.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
