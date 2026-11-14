'use strict';

// spirit/run/spirit/test/test/headLessChrome.js
// The test of spirit/test/headLessChrome.js, and of no other module (spec: ./headLessChrome.md): its scratch nodes and
// relays as goal/G47.3 redraws them, lab nodes in repo://lab/node/ (box: "the move: headLessChrome.js scratchNode hands out
// a reset lab node instead of a fresh copy"). Each hand-out is asked from a child process of its own, as a test asks it,
// and what it hands out is judged from outside: its tree, its state, its lock, its repo.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const LAB_NODES = path.join(REPO, 'lab', 'node');
const HELPER = path.join(RUN, 'spirit', 'test', 'headLessChrome.js');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
const under = function (p, dir) { const rel = path.relative(dir, String(p || '')); return !!p && !!rel && rel.indexOf('..') !== 0 && !path.isAbsolute(rel); };
const tempCopies = function () { try { return fs.readdirSync(os.tmpdir()).filter(function (n) { return /^spirit-(shell-child|relay-child|relay-face)-/.test(n); }).length; } catch (e) { return -1; } };

// A CHILD THAT ASKS FOR ONE (a test, as testicle runs it): it prints what it was handed, holds it for holdMs, and ends.
// what: 'node' (scratchNode) or 'relay' (scratchRelay). plant: a file it leaves in the handed node's spirit/state/.
function ask(what, holdMs, plant, from) {
  // from: the run root of another tree to ask from (its own headLessChrome.js, run inside it); the checkout's by default.
  const fromRun = from || RUN;
  const code = 'const H = require(' + JSON.stringify(path.join(fromRun, 'spirit', 'test', 'headLessChrome.js')) + ');' +
    '(async function () { const n = await H.' + (what === 'relay' ? 'scratchRelay({ debug: true })' : 'scratchNode()') + ';' +
    ' const run = n.run || (n.root ? require("path").join(n.root, "spirit", "run") : "");' +
    (plant ? ' try { require("fs").mkdirSync(require("path").join(run, "spirit", "state"), { recursive: true }); require("fs").writeFileSync(require("path").join(run, "spirit", "state", ' + JSON.stringify(plant) + '), "left by a test"); } catch (e) {}' : '') +
    ' process.stdout.write("\\n@@" + JSON.stringify({ root: n.root || "", run: run, base: n.base || "", up: !!n.up, debug: !!n.debug }) + "\\n");' +
    ' setTimeout(function () { process.exit(0); }, ' + Number(holdMs || 0) + '); }()).catch(function (e) { process.stdout.write("\\n@@" + JSON.stringify({ error: String(e && e.message || e) }) + "\\n"); process.exit(1); });';
  const kid = spawn(process.execPath, ['-e', code], { cwd: fromRun, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  const got = new Promise(function (resolve) {
    kid.stdout.on('data', function (d) { out += d; const m = /\n@@(.*)\n/.exec(out); if (m) { try { resolve(JSON.parse(m[1])); } catch (e) { resolve({ error: m[1] }); } } });
    kid.on('close', function () { resolve(null); });
  });
  const ended = new Promise(function (r) { kid.on('close', r); });
  return { got: got, ended: ended, kid: kid };
}
const within = function (p, ms) { return Promise.race([p, sleep(ms).then(function () { return 'waiting'; })]); };

// The checkout's branch and HEAD as the test found them, before any hand-out.
const W = { first: null, probe: '', head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim(), branch: execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim() };
test.after(function () { try { if (W.probe) fs.rmSync(W.probe, { force: true }); } catch (e) { /* gone */ } });

// "headLessChrome.js scratchNode hands out a reset lab node instead of a fresh copy"
test.run('scratchNode hands out a lab node: its tree lies under repo://lab/node/', 0.4, async function () {
  const before = tempCopies();
  // An uncommitted file of the checkout, for the check after: "the checkout's commit and its uncommitted edits".
  W.probe = path.join(RUN, 'spirit', 'zzLabProbe.js');
  fs.writeFileSync(W.probe, "'use strict';\n// an uncommitted file of the checkout, for the lab test\n");
  const a = ask('node', 1000);
  W.first = await within(a.got, 120000);
  W.copies = tempCopies() - before;
  await a.ended;
  if (!W.first || W.first === 'waiting' || W.first.error) return 'scratchNode handed out nothing: ' + short(W.first);
  return under(W.first.root, LAB_NODES) || 'its tree is ' + short(W.first.root) + ', not under ' + LAB_NODES;
}, test.limit.long);
test.run('and no copy of the tree is made for it in the temp folder', 0.4, function () {
  if (!W.first || W.first.error) return 'nothing handed out: the first check failed';
  return W.copies === 0 || W.copies + ' new scratch copies in ' + os.tmpdir();
}, test.limit.quick);
// "lab nodes run with DEBUG on, as scratch nodes do today"
test.run('it is up, with DEBUG on', 0.4, function () {
  if (!W.first || W.first.error) return 'nothing handed out: the first check failed';
  return (W.first.up && W.first.debug) || 'up ' + W.first.up + ', debug ' + W.first.debug;
}, test.limit.quick);
// "before a run, a lab node takes the files under test: the checkout's commit and its uncommitted edits"
test.run('it holds the files under test: a file the checkout has not committed is in it', 0.4, function () {
  if (!W.first || W.first.error) return 'nothing handed out: the first check failed';
  return fs.existsSync(path.join(W.first.run, 'spirit', 'zzLabProbe.js')) || 'no spirit/zzLabProbe.js in ' + W.first.run;
}, test.limit.quick);
// "lab has its own local repo ... no github remote", "the checkout's own history is untouched"
test.run('its repo has no github remote, and the checkout\'s branch and HEAD are untouched', 0.4, function () {
  if (!W.first || W.first.error) return 'nothing handed out: the first check failed';
  let remotes = '';
  try { remotes = execFileSync('git', ['remote', '-v'], { cwd: W.first.root, encoding: 'utf8' }); } catch (e) { return 'its tree is no git repo: ' + short(e.message); }
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();
  const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();
  const bad = [];
  if (/github\.com/i.test(remotes)) bad.push('a github remote: ' + short(remotes));
  if (W.head && (head !== W.head || branch !== W.branch)) bad.push('the checkout moved from ' + W.branch + ' ' + W.head + ' to ' + branch + ' ' + head);
  return !bad.length || bad.join('; ');
}, test.limit.quick);
// "clean state: lab resets its node before each test (spirit/state/ wiped, node restarted), never the tests"
test.run('lab resets a node before each test: a file a test left in its spirit/state/ is gone when the node is handed out again', 0.4, async function () {
  const left = ask('node', 500, 'zzLeftByATest.txt');
  const l = await within(left.got, 120000);
  await left.ended;
  if (!l || l === 'waiting' || l.error) return 'the leaving test was handed nothing: ' + short(l);
  for (let i = 0; i < 6; i++) {
    const next = ask('node', 500);
    const n = await within(next.got, 120000);
    await next.ended;
    if (!n || n === 'waiting' || n.error) return 'the next test was handed nothing: ' + short(n);
    if (n.root === l.root) return !fs.existsSync(path.join(n.run, 'spirit', 'state', 'zzLeftByATest.txt')) || 'the file the last test left is still in ' + n.run;
  }
  return 'the node ' + l.root + ' was not handed out again in six asks';
}, test.limit.long);
// goal/G47.1, Q6, Andy: "Shall lab hold 6 personal nodes instead of 3, since testicle.js starves on 3 while my testicle
// classifies?" "YES."
const PERSONAL = ['personal1', 'personal2', 'personal3', 'personal4', 'personal5', 'personal6'];
test.run('lab holds six personal nodes, personal1 to personal6, and its two relays', 0.4, function () {
  let P = null; try { P = require(path.join(REPO, 'lab', 'labNodes.js')).POOLS; } catch (e) { return 'lab/labNodes.js does not load: ' + (e && e.message); }
  return (!!P && JSON.stringify(P.node) === JSON.stringify(PERSONAL) && JSON.stringify(P.relay) === JSON.stringify(['relay1', 'relay2'])) || 'its pools: ' + short(P);
}, test.limit.quick);
// "a lock file per lab node, one test on it at a time; a test that finds every lab node taken waits"
test.run('one test per lab node at a time: with the six personal nodes held, a seventh ask waits, and is handed one when a holder ends', 0.4, async function () {
  const holders = PERSONAL.map(function () { return ask('node', 25000); });
  const held = await Promise.all(holders.map(function (h) { return within(h.got, 120000); }));
  if (held.some(function (h) { return !h || h === 'waiting' || h.error; })) return 'six were not handed out: ' + short(held);
  const roots = held.map(function (h) { return h.root; });
  if (new Set(roots).size !== PERSONAL.length) return 'six holders share a node: ' + short(roots);
  const fourth = ask('node', 500);
  const early = await within(fourth.got, 5000);
  if (early !== 'waiting') { holders.forEach(function (h) { h.kid.kill(); }); return 'the seventh was answered while all six were held: ' + short(early); }
  const late = await within(fourth.got, 60000);
  await Promise.all(holders.map(function (h) { return h.ended; }));
  return (!!late && late !== 'waiting' && !late.error && roots.indexOf(late.root) !== -1) || 'after a holder ended the seventh got ' + short(late);
}, test.limit.long);
// THE HELPERS A TEST'S OWN WORLD USES (goal/G47.3, the build; ./headLessChrome.md): scratchTree takes one lab node and
// no more, startNodeOn starts a node only on a tree lab handed out, freeTree frees a node and deletes nothing.
function inChild(code, ms) {
  const kid = spawn(process.execPath, ['-e', 'const H = require(' + JSON.stringify(HELPER) + ');' + code], { cwd: RUN, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  kid.stdout.on('data', function (d) { out += d; });
  return within(new Promise(function (r) { kid.on('close', function () { const m = /@@(.*)/.exec(out); try { r(m ? JSON.parse(m[1]) : { error: out.slice(-300) }); } catch (e) { r({ error: out.slice(-300) }); } }); }), ms);
}
const LOCKS = function () { try { return fs.readdirSync(LAB_NODES).filter(function (n) { return /^personal\d+\.lock$/.test(n); }); } catch (e) { return []; } };
test.run('scratchTree takes one lab node and no more, and a node asked after it is another one', 0.4, async function () {
  // The locks this process holds (its pid in them): a lock file a dead holder left is not this process's.
  const r = await inChild('const fs = require("fs"); const t = H.scratchTree(); const locks = fs.readdirSync(' + JSON.stringify(LAB_NODES) + ').filter(function (n) { if (!/^personal\\d+\\.lock$/.test(n)) return false; try { return fs.readFileSync(require("path").join(' + JSON.stringify(LAB_NODES) + ', n), "utf8").trim() === String(process.pid); } catch (e) { return false; } }); H.scratchNode({ start: false }).then(function (n) { console.log("@@" + JSON.stringify({ tree: t.root, locks: locks.length, node: n.root })); process.exit(0); });', 120000);
  if (!r || r === 'waiting' || r.error) return 'nothing handed out: ' + short(r);
  return (r.locks === 1 && under(r.tree, LAB_NODES) && under(r.node, LAB_NODES) && r.tree !== r.node) || 'locks taken by one scratchTree: ' + r.locks + ', tree ' + r.tree + ', node ' + r.node;
}, test.limit.long);
test.run('startNodeOn starts a node on a tree lab handed out, and refuses a run it did not hand out', 0.4, async function () {
  const r = await inChild('const t = H.scratchTree(); let refused = ""; try { H.startNodeOn(' + JSON.stringify(RUN) + ', 1); } catch (e) { refused = e.message; }' +
    ' H.freePort().then(function (port) { const c = H.startNodeOn(t.run, port); return H.until(function () { return fetch("http://127.0.0.1:" + port + "/api/spirit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ call: "api", args: {} }) }).then(function (x) { return x.status === 200; }); }, 60000).then(function (up) { c.kill(); console.log("@@" + JSON.stringify({ up: up, refused: refused })); process.exit(0); }); });', 120000);
  if (!r || r === 'waiting' || r.error) return 'nothing judged: ' + short(r);
  return (r.up === true && /no lab node/.test(r.refused)) || 'up ' + r.up + ', the checkout\'s own run refused: ' + short(r.refused);
}, test.limit.long);
test.run('freeTree frees the lab node and deletes nothing: its tree is still there, its lock gone', 0.4, async function () {
  const r = await inChild('const t = H.scratchTree(); const lock = require("path").join(' + JSON.stringify(LAB_NODES) + ', t.name + ".lock"); const held = require("fs").existsSync(lock); H.freeTree({ root: t.root, run: t.run });' +
    ' console.log("@@" + JSON.stringify({ held: held, lock: require("fs").existsSync(lock), tree: require("fs").existsSync(require("path").join(t.run, "spirit", "server.js")) })); setTimeout(function () { process.exit(0); }, 200);', 120000);
  if (!r || r === 'waiting' || r.error) return 'nothing judged: ' + short(r);
  return (r.held === true && r.lock === false && r.tree === true) || 'held ' + r.held + ', lock after free ' + r.lock + ', tree still there ' + r.tree;
}, test.limit.long);
test.run('no lab node is left locked once its holders ended', 0.2, async function () {
  await sleep(500);
  const left = LOCKS().filter(function (n) { let pid = ''; try { pid = fs.readFileSync(path.join(LAB_NODES, n), 'utf8').trim(); process.kill(Number(pid), 0); return true; } catch (e) { return false; } });
  return !left.length || 'still locked by a live process: ' + left.join(', ');
}, test.limit.quick);
// "the tests that start relays (scratchRelay, scratchFaceRelay) use lab's two relays, reset like the nodes"
// ASKED FROM INSIDE A LAB NODE (cw, on G47.1: "run from inside a lab node, headLessChrome now brings the node it hands out
// into line with the tree it runs in (what differs copied, what that tree lacks removed)"; the classifier asks from testicle's
// own scratch tree, whose planted scripts are in no commit): a node asked from a lab node's tree holds that tree's files.
test.run('asked from inside a lab node\'s tree, scratchNode hands out another node in line with that tree: its new file there, its removed file gone', 0.4, async function () {
  const host = ask('node', 90000);
  const h = await within(host.got, 120000);
  if (!h || h === 'waiting' || h.error) { host.kid.kill(); return 'no lab node to ask from: ' + short(h); }
  const planted = path.join(h.run, 'spirit', 'zzFromLabTree.js');
  const gone = path.join(h.run, 'spirit', 'word.js');
  try { fs.writeFileSync(planted, "'use strict';\n// planted in a lab node's tree\n"); fs.rmSync(gone, { force: true }); } catch (e) { host.kid.kill(); return 'could not change the host tree: ' + short(e.message); }
  const inner = ask('node', 500, '', h.run);
  const n = await within(inner.got, 120000);
  await inner.ended;
  host.kid.kill();
  await host.ended;
  if (!n || n === 'waiting' || n.error) return 'nothing handed out from inside: ' + short(n);
  const bad = [];
  if (n.root === h.root) bad.push('it handed out the very node it runs in');
  if (!fs.existsSync(path.join(n.run, 'spirit', 'zzFromLabTree.js'))) bad.push('the file planted in that tree is not in it');
  if (fs.existsSync(path.join(n.run, 'spirit', 'word.js'))) bad.push('the file removed from that tree is still in it');
  return !bad.length || bad.join('; ') + ' (' + n.root + ')';
}, test.limit.long);
test.run('scratchRelay hands out one of lab\'s two relays, under repo://lab/node/; two asked at once are two different relays', 0.4, async function () {
  const a = ask('relay', 3000), b = ask('relay', 3000);
  const ra = await within(a.got, 120000), rb = await within(b.got, 120000);
  await Promise.all([a.ended, b.ended]);
  if ([ra, rb].some(function (r) { return !r || r === 'waiting' || r.error; })) return 'two relays were not handed out: ' + short([ra, rb]);
  return (under(ra.root, LAB_NODES) && under(rb.root, LAB_NODES) && ra.root !== rb.root) || 'relays handed out: ' + short([ra.root, rb.root]);
}, test.limit.long);
