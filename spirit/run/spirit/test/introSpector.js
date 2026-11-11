'use strict';

// spirit/run/spirit/test/introSpector.js
// A family's folder is not written through the family (spec: ./introSpector.md). goal/G43.23, item 1, closed the
// hole of a family's FS.saveFile overwriting a core file; goal/G43.20 took the FS set off every branch altogether (Andy:
// "those owner only FS verbs are no longer needed, because not the api ID spirit.fs or spirit.api.desk ARE the path to all
// those files"). A real node on a scratch copy of the tracked files, asked as the owner at its own loopback door.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, sleep } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// A node family's api.js, and an app's own <name>.json, core whatever it says (goal/G43.14). The desk app is turned on.
const CORE = [
  { family: 'contact', path: 'api.js', run: 'spirit/contact/api.js' },
  { family: 'app', path: 'api.js', run: 'spirit/app/api.js' },
  { family: 'desk', path: 'desk.json', run: 'spirit/app/desk/desk.json' },
];

// The scratch node, made by the world's test, asked by the later ones.
const W = {};
const post = function (call, args) {
  return fetch(W.N.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args }) })
    .then(function (r) { return r.text().then(function (t) { let body = null; try { body = JSON.parse(t); } catch (e) { /* judged as text */ } return { status: r.status, body: body, text: t }; }); },
      function (e) { return { status: 0, body: null, text: String(e && e.message) }; });
};
function noNode() { return W.N && W.N.up && W.N.root ? null : 'no scratch node: the world failed'; }

test.run('the world: a scratch node comes up on a copy of its own', 0.2, async function () {
  W.N = await scratchNode({ servers: ['desk'] });
  if (!(W.N.up && !!W.N.root)) return 'the scratch node did not come up: nothing judged';
  W.run = path.join(W.N.root, 'spirit', 'run');
  return true;
}, test.limit.slow);
test.after(async function () {
  const N = W.N || {};
  try { if (N.child) N.child.kill(); } catch (e) { /* gone */ }
  await sleep(300);
  try { if (N.root) fs.rmSync(N.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});

// goal/G43.20: no branch carries an FS set.
test.run('no branch of the node\'s tree holds an FS. verb', 0.2, async function () {
  if (noNode()) return noNode();
  const tree = (await post('api', {})).body || {};
  const withFs = Object.keys(tree).filter(function (fam) { return tree[fam] && Object.keys(tree[fam]).some(function (v) { return /^FS\./.test(v); }); });
  return (Object.keys(tree).length > 0 && withFs.length === 0) || 'branches with FS verbs: ' + short(withFs);
}, test.limit.quick);

// The box of goal/G43.23: "a family's FS.saveFile / deleteFile ... can overwrite any api.js or app code".
function before(c) { const disk = path.join(W.run, c.run); return fs.existsSync(disk) ? fs.readFileSync(disk, 'utf8') : null; }
function there(c) { if (noNode()) return noNode(); return before(c) !== null || c.run + ' is missing: nothing judged'; }
async function refused(c) {
  if (noNode()) return noNode();
  const disk = path.join(W.run, c.run);
  const was = before(c);
  if (was === null) return c.run + ' is missing: the world failed';
  const saved = await post(c.family + '.FS.saveFile', { path: c.path, content: '// overwritten by introSpector.js\n' });
  const deleted = await post(c.family + '.FS.deleteFile', { path: c.path });
  const after = fs.existsSync(disk) ? fs.readFileSync(disk, 'utf8') : null;
  const kept = saved.status >= 400 && deleted.status >= 400 && after === was;
  if (after !== was) { try { fs.writeFileSync(disk, was); } catch (e) { /* scratch */ } }
  return kept || c.family + '.FS on ' + c.run + ': save ' + saved.status + ' ' + short(saved.text) + ', delete ' + deleted.status + ', the file ' + (after === was ? 'unchanged' : 'CHANGED');
}
test.run('the world: the contact api file is there', 0.2, function () { return there(CORE[0]); }, test.limit.quick);
test.run('contact.FS.saveFile and FS.deleteFile on the contact api file are refused, the file unchanged', 0.8, function () { return refused(CORE[0]); }, test.limit.quick);
test.run('the world: the app api file is there', 0.2, function () { return there(CORE[1]); }, test.limit.quick);
test.run('app.FS.saveFile and FS.deleteFile on the app api file are refused, the file unchanged', 0.8, function () { return refused(CORE[1]); }, test.limit.quick);
test.run('the world: desk.json is there', 0.2, function () { return there(CORE[2]); }, test.limit.quick);
test.run('desk.FS.saveFile and FS.deleteFile on desk.json are refused, the file unchanged', 0.8, function () { return refused(CORE[2]); }, test.limit.quick);
