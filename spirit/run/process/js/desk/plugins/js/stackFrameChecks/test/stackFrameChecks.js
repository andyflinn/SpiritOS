'use strict';

// spirit/run/process/js/desk/plugins/js/stackFrameChecks/test/stackFrameChecks.js
// The tests of process/js/desk/plugins/js/stackFrameChecks/stackFrameChecks.js, and of no other module (spec:
// ./stackFrameChecks.md; goal/G41.11). The plugin is mounted as the desk mounts it (desk.js, MOUNTING THE PLUGINS), on
// a desk that keeps every write asked of it and applies item.add and item.delete to its state. Its list is a scratch
// list, named in the suite-only value stackFrameList, inside a scratch git repo of the test's own, so its commits are
// real and reach nothing: child_process.spawn stands in for pushOrigin (answering as the test says) and for the one-door
// suite (whose verdict the test writes when it lets the run end); git itself runs for real. Gates, endpoints and suites
// are checked against this checkout's tree, read only.

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const childProcess = require('child_process');
const RUN = path.resolve(__dirname, '../../../../../../..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'stackFrameChecks.js');
const TMP = path.join(RUN, 'test', '_tmp_stackFrameChecks');
const SCRATCH = path.join(TMP, 'repo');
const LIST = path.join(SCRATCH, 'list', 'stackFrameList.json');
const STATE = path.join(TMP, 'state');
const PUSH_ORIGIN = path.join(RUN, 'process', 'js', 'pushOrigin', 'pushOrigin.js');
const DOOR_TEST = path.join(REPO, 'spirit', 'test', 'oneDoorStacks.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function git(cwd, args) { const r = childProcess.spawnSync('git', args, { cwd: cwd, encoding: 'utf8', windowsHide: true }); return String(r.stdout || '').trim(); }
const list = function () { try { return JSON.parse(fs.readFileSync(LIST, 'utf8')); } catch (e) { return null; } };
const doorIn = function (id) { return (list() || []).filter(function (d) { return d && d.id === id; })[0]; };
async function refusal(fn) { try { await fn(); return ''; } catch (e) { return (e.refusal || '?') + ': ' + e.message; } }
async function until(cond, ms) { const t = Date.now(); while (!cond() && Date.now() - t < (ms || 20000)) await sleep(20); return cond(); }

const G = 'spirit/run/spirit/peerPost.js::createPeerPost';
const EP = function (name) { return 'spirit/run/spirit/' + name + '.js'; };
const CALLER = { owner: true, key: 'KEY-ANDY', label: 'andy' };

// ── THE CHILDREN, STOOD IN FOR ───────────────────────────────────────
// pushOrigin answers pushPlan; a door run waits until the test releases it with a verdict (or none) and a code.
const pushPlan = { code: 0, err: '' };
const pushes = [];
const doorRuns = [];
const realSpawn = childProcess.spawn;
childProcess.spawn = function (file, argv, opts) {
  if (argv && argv[0] === PUSH_ORIGIN) {
    pushes.push({ argv: argv, opts: opts });
    const k = new EventEmitter(); k.stdout = new EventEmitter(); k.stderr = new EventEmitter(); k.kill = function () {};
    setTimeout(function () { if (pushPlan.err) k.stderr.emit('data', Buffer.from(pushPlan.err)); k.emit('close', pushPlan.code); }, 1);
    return k;
  }
  if (argv && argv[0] === DOOR_TEST) {
    const k = new EventEmitter();
    const run = { argv: argv, opts: opts, env: opts.env, released: false,
      release: function (verdict, code) { if (verdict) fs.writeFileSync(opts.env.SPIRIT_STACKS_VERDICT, JSON.stringify(verdict)); run.released = true; k.emit('exit', code); } };
    doorRuns.push(run);
    return k;
  }
  return realSpawn.apply(this, arguments);
};

// ── THE DESK ─────────────────────────────────────────────────────────
const S = {
  goals: { 'goal/G7': { members: ['goal/G7.1', 'goal/G7.2', 'goal/G7.3', 'goal/G7.50'], design: false } },
  items: {
    'goal/G7.1': { title: 'door one\'s item', done: false, closed: false },
    'goal/G7.2': { title: 'Rerun the stack-frame test', done: false, closed: false },
    'goal/G7.3': { title: 'Rerun the stack-frame test', done: true, closed: false },
    'goal/G7.50': { title: 'Nobody but peerPost::createPeerPost reaches relayRequest', done: false, closed: false },
    'goal/G3.4': { title: 'another goal\'s', done: false, closed: false },
  },
};
let lastN = 50;
let change = 0;
const writes = [];
const published = [];
const verified = [];
let tooLong = false;
function apply(verb, a) {
  if (verb === 'item.add') { S.items[a.minted] = { title: a.title, done: false, closed: false }; S.goals['goal/G7'].members.push(a.minted); }
  if (verb === 'item.delete') { delete S.items[a.id]; S.goals['goal/G7'].members = S.goals['goal/G7'].members.filter(function (x) { return x !== a.id; }); }
}
const desk = {
  goal: 'goal/G7',
  stateDir: STATE,
  idOf: function (id) { const m = /^plugin\/stackFrameChecks\.(\d+)$/.exec(id); return m ? 'goal/G7.' + m[1] : id; },
  state: function () { return S; },
  inGoal: function (id) { return /^goal\/G7(\.|$)/.test(String(id)); },
  write: function (verb, a, check) { if (check) check(S); writes.push({ verb: verb, a: a, by: 'desk' }); apply(verb, a); return { change: ++change }; },
  writeAs: function (verb, a, caller, check) { if (check) check(S); writes.push({ verb: verb, a: a, by: caller.label }); apply(verb, a); return { change: ++change }; },
  fieldWhy: function (name, v) { return tooLong ? name + ' is too long' : ''; },
  nextItemId: function () { lastN += 1; return 'goal/G7.' + lastN; },
  refused: function (code, why) { return Object.assign(new Error(why), { refusal: code }); },
  publish: function (d) { published.push(d); },
  verify: function (verb, a) { verified.push({ verb: verb, a: a }); return Promise.resolve({ ok: true }); },
};
const writesOf = function (verb) { return writes.filter(function (w) { return w.verb === verb; }); };

function setup() {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(path.join(SCRATCH, 'list'), { recursive: true });
  git(SCRATCH, ['init', '-q', '-b', 'master']);
  git(SCRATCH, ['config', 'user.name', 'stackFrameChecks test']); git(SCRATCH, ['config', 'user.email', 'sfc@test.invalid']); git(SCRATCH, ['config', 'commit.gpgsign', 'false']);
  fs.writeFileSync(path.join(SCRATCH, 'README.md'), 'scratch\n');
  git(SCRATCH, ['add', 'README.md']);
  git(SCRATCH, ['commit', '-q', '-m', 'the first']);
  fs.writeFileSync(LIST, JSON.stringify([
    { id: 'd1', gate: G, endpoint: EP('presenceNode'), suites: [], item: 'plugin/stackFrameChecks.1' },
    { id: 'd2', gate: G, endpoint: EP('postQueue'), suites: [], item: 'goal/G7.1' },
    { gate: G, endpoint: 'node:http+https+fetch', paths: ['/api/'], suites: [], item: 'goal/G3.4' },
    { id: 'd9', gate: G, endpoint: EP('relayUrl'), suites: [], item: 'goal/G8.8' },
    'not a door', null,
  ], null, 2));
}

test.startTest('stackFrameChecks.js: the stack-frame checks plugin');

(async function () {
  setup();
  process.argv = [process.argv[0], path.join(RUN, 'process', 'js', 'desk', 'desk.js'), JSON.stringify({ stackFrameList: LIST })];
  const said = [];
  const realError = console.error;
  console.error = function () { said.push(Array.prototype.slice.call(arguments).join(' ')); };
  let made = null;
  try { made = require(FILE)(desk); } catch (e) { test.fail('the plugin threw as it mounted: ' + (e && e.stack || e)); }
  ok(made && typeof made.refuses === 'function' && made.verbs && typeof made.verbs['stackFrameChecks.make'].handler === 'function', 'it mounts: refuses, and its verbs', 'answered ' + short(made && Object.keys(made)));
  if (!made) { console.error = realError; return; }
  const V = function (name) { return function (a, c) { return made.verbs['stackFrameChecks.' + name].handler(a || {}, c); }; };
  const make = V('make'); const update = V('update'); const remove = V('remove'); const run = V('run'); const runState = V('runState');

  test.subHeading('at mount: the old rerun item goes, every door gets its own item');
  ok(writesOf('item.delete').length === 1 && writesOf('item.delete')[0].a.id === 'goal/G7.2', 'an open "Rerun the stack-frame test" item is deleted; a done one is left', 'deleted ' + short(writesOf('item.delete')));
  await until(function () { return git(SCRATCH, ['log', '-1', '--format=%s']).indexOf('every door its own item') !== -1; });
  const l0 = list();
  ok(Array.isArray(l0) && l0.length === 4 && l0.every(function (d) { return d && typeof d === 'object'; }), 'the list is written back with its doors only', 'list ' + short(l0));
  ok(doorIn('d1') && doorIn('d1').item === 'goal/G7.1', 'a door whose item is an open item of its goal keeps it (an old plugin/stackFrameChecks.<n> read by the desk\'s idOf)', 'd1 ' + short(doorIn('d1')));
  ok(doorIn('d2') && /^goal\/G7\.5\d$/.test(doorIn('d2').item) && doorIn('d2').item !== 'goal/G7.1', 'a door sharing an item with a door before it gets a fresh one', 'd2 ' + short(doorIn('d2')));
  ok(doorIn('d10') && doorIn('d10').endpoint === 'node:http+https+fetch' && /^goal\/G7\.5\d$/.test(doorIn('d10').item), 'a door with no id gets d<n> one past the highest (d10), and a door whose item is outside its goal a fresh one', 'list ' + short(l0));
  ok(doorIn('d9') && doorIn('d9').item === 'goal/G8.8', 'a door naming an item this desk never held is another desk\'s, left as it is', 'd9 ' + short(doorIn('d9')));
  const added = writesOf('item.add');
  ok(added.length === 2 && added.every(function (w) { return w.by === 'desk' && w.a.goal === 'goal/G7'; }), 'the items made at mount are the desk\'s, in its goal', 'item.add ' + short(added));
  ok(added.some(function (w) { return w.a.title === 'Nobody but peerPost::createPeerPost reaches postQueue'; }) && added.some(function (w) { return w.a.title === 'Nobody but peerPost::createPeerPost reaches http+https+fetch'; }), 'titled "Nobody but <gate> reaches <endpoint>", by the short names', 'titles ' + short(added.map(function (w) { return w.a.title; })));
  const d2item = doorIn('d2').item;
  ok(writes.some(function (w) { return w.verb === 'item.files.add' && w.a.id === d2item && /\/stackFrameTestItems\.js$/.test(String(w.a.path)); }), 'each new item gets the items test as its file', 'writes ' + short(writes.filter(function (w) { return w.a.id === d2item; })));
  const box = writes.filter(function (w) { return w.verb === 'box.write' && w.a.id === d2item; })[0];
  ok(box && box.a.version === 0 && /The door is d2 in the plugin's list/.test(box.a.text) && /which named goal\/G7\.1 before every door had its own/.test(box.a.text), 'and a box saying its door, and what it named before', 'box ' + short(box));
  ok(writes.some(function (w) { return w.verb === 'press' && w.a.id === d2item && w.a.what === 'code'; }), 'and is a code item (press code)', 'presses ' + short(writesOf('press')));
  await until(function () { return said.some(function (s) { return /^stackFrameChecks: committed [0-9a-f]+ and pushed it$/.test(s); }); }, 5000);
  ok(git(SCRATCH, ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD']) === 'list/stackFrameList.json' && pushes.length === 1, 'the list alone is committed in its own repo, and pushed through pushOrigin', 'committed ' + git(SCRATCH, ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD']) + ', pushes ' + pushes.length);
  ok(pushes[0] && JSON.parse(pushes[0].argv[1]).repo.replace(/\\/g, '/').toLowerCase() === SCRATCH.replace(/\\/g, '/').toLowerCase(), 'pushOrigin is run for the list\'s repo top', 'pushOrigin ' + short(pushes[0] && pushes[0].argv));
  ok(said.some(function (s) { return /^stackFrameChecks: committed [0-9a-f]+ and pushed it$/.test(s); }), 'and the mount says what became of it', 'said ' + short(said));

  test.subHeading('refuses: its goal always stays open, a door\'s item closes only with its door');
  const r = made.refuses;
  ok(r('press', { id: 'goal/G3.1', what: 'abandon' }, ['goal/G3.1']) === '', 'a call outside its goal passes', 'refused ' + short(r('press', { id: 'goal/G3.1', what: 'abandon' }, ['goal/G3.1'])));
  ok(/a session over its goal would close/.test(r('session.set', {}, ['goal/G7'])), 'a session over its goal is refused', short(r('session.set', {}, ['goal/G7'])));
  ok(/never abandoned/.test(r('press', { id: 'goal/G7.3', what: 'abandon' }, ['goal/G7.3'])), 'abandon on any of its items is refused', short(r('press', { id: 'goal/G7.3', what: 'abandon' }, ['goal/G7.3'])));
  ok(/always stays open, so close is refused/.test(r('press', { id: 'goal/G7', what: 'close' }, ['goal/G7'])) && /so done is refused/.test(r('press', { id: 'goal/G7', what: 'done' }, ['goal/G7'])), 'close and done on its goal are refused', short(r('press', { id: 'goal/G7', what: 'close' }, ['goal/G7'])));
  ok(/is the item of door d1: it closes only when the door is removed/.test(r('item.delete', { id: 'goal/G7.1' }, ['goal/G7.1'])) && /door d1/.test(r('press', { id: 'goal/G7.1', what: 'done' }, ['goal/G7.1'])) && /door d1/.test(r('press', { id: 'goal/G7.1', what: 'close' }, ['goal/G7.1'])),
    'a door\'s item takes no delete, done or close', short(r('item.delete', { id: 'goal/G7.1' }, ['goal/G7.1'])));
  ok(r('item.delete', { id: 'goal/G7.3' }, ['goal/G7.3']) === '' && r('press', { id: 'goal/G7.1', what: 'go' }, ['goal/G7.1']) === '' && r('box.write', { id: 'goal/G7.1' }, ['goal/G7.1']) === '', 'an item of no door may be deleted; a door\'s item takes every other press and write', short(r('item.delete', { id: 'goal/G7.3' }, ['goal/G7.3'])));

  test.subHeading('make: a door checked against the tree, refused with why');
  const before = JSON.stringify(list());
  const cases = [
    [{ endpoint: EP('limits') }, /a gate is needed/],
    [{ gate: G }, /an endpoint is needed/],
    [{ gate: 'spirit/run/spirit/peerPost.js', endpoint: EP('limits') }, /is a whole module: a whole module as the gate is cheating/],
    [{ gate: 'peerPost::createPeerPost', endpoint: EP('limits') }, /is not spirit\/run\/<file>.js::<function>/],
    [{ gate: 'spirit/run/spirit/noSuchFile.js::f', endpoint: EP('limits') }, /the gate's file spirit\/run\/spirit\/noSuchFile.js is not there/],
    [{ gate: 'spirit/run/spirit/peerPost.js::noSuchFunctionAnywhere', endpoint: EP('limits') }, /the gate's function noSuchFunctionAnywhere is not in/],
    [{ gate: 'spirit/run/' + 'a/'.repeat(130) + 'x.js::f', endpoint: EP('limits') }, /characters, the limit is 256/],
    [{ gate: G, endpoint: EP('limits') + '::ANSWER_MAX' }, /names a function: an endpoint is a whole module/],
    [{ gate: G, endpoint: 'node:http+ftp' }, /names ftp: Node's own are http, https, fetch/],
    [{ gate: G, endpoint: 'node:http+http' }, /names a kind twice/],
    [{ gate: G, endpoint: 'relay.js' }, /is not spirit\/run\/<file>.js or node:<kinds>/],
    [{ gate: G, endpoint: EP('noSuchEndpoint') }, /the endpoint's file .* is not there/],
    [{ gate: G, endpoint: EP('peerPost') }, /the gate is in the endpoint's own module/],
    [{ gate: G, endpoint: EP('presenceNode') }, /the list has this door already/],
    [{ gate: '  ' + G + '  ', endpoint: ' ' + EP('postQueue') + ' ' }, /the list has this door already/],
    [{ gate: G, endpoint: EP('relayRequest') }, /goal\/G7\.50 asks this already: Nobody but peerPost::createPeerPost reaches relayRequest/],
  ];
  for (const c of cases) {
    const why = await refusal(function () { return make(c[0], CALLER); });
    ok(/^bad-request: /.test(why) && c[1].test(why), 'refused: ' + c[1].source.replace(/\\/g, ''), 'make ' + short(c[0]) + ' answered ' + short(why));
  }
  tooLong = true;
  const tl = await refusal(function () { return make({ gate: G, endpoint: EP('relayAuth') }, CALLER); });
  tooLong = false;
  ok(/^bad-request: the item's title, "Nobody but peerPost::createPeerPost reaches relayAuth" is too long/.test(tl), 'a title the label rule refuses is refused', 'answered ' + short(tl));
  ok(JSON.stringify(list()) === before, 'and nothing refused touched the list', 'list changed');

  test.subHeading('make: the door added, its item made by the caller, the list committed');
  const writesBefore = writes.length;
  const m1 = await make({ gate: G, endpoint: EP('limits') }, CALLER);
  ok(m1 && m1.door === 'd11' && /^goal\/G7\.\d+$/.test(m1.id) && typeof m1.change === 'number', 'it answers the door d11, its item and the change', 'answered ' + short(m1));
  ok(doorIn('d11') && doorIn('d11').gate === G && doorIn('d11').endpoint === EP('limits') && doorIn('d11').item === m1.id && Array.isArray(doorIn('d11').suites) && !('paths' in doorIn('d11')), 'the list holds it: id, gate, endpoint, no suites yet, its item; a module door has no paths', 'd11 ' + short(doorIn('d11')));
  const mine = writes.slice(writesBefore);
  ok(mine[0] && mine[0].verb === 'item.add' && mine[0].by === 'andy', 'the item.add is the caller\'s', 'writes ' + short(mine));
  ok(/^committed [0-9a-f]+ and pushed it$/.test(m1.commit) && git(SCRATCH, ['log', '-1', '--format=%s']) === 'plugin/stackFrameChecks: door d11 added, ' + G + ' -> ' + EP('limits') + ', for ' + m1.id, 'the commit line says it was committed and pushed, under "plugin/stackFrameChecks: <what changed>"', 'commit ' + short(m1.commit) + ' / ' + git(SCRATCH, ['log', '-1', '--format=%s']));
  ok(published.some(function (p) { return p.what === 'list' && p.id === 'd11'; }), 'it says list on the desk\'s stream', 'published ' + short(published));
  let changed = null;
  try { changed = JSON.parse(fs.readFileSync(path.join(STATE, 'changed.json'), 'utf8')); } catch (e) { changed = null; }
  ok(changed && !isNaN(Date.parse(changed.d11)), 'when the door changed is kept in its state folder, changed.json', 'changed.json ' + short(changed));

  test.subHeading('its commit, alone or not at all');
  fs.writeFileSync(path.join(SCRATCH, 'README.md'), 'scratch, edited\n');
  git(SCRATCH, ['add', 'README.md']);
  const headBefore = git(SCRATCH, ['rev-parse', 'HEAD']);
  const m2 = await make({ gate: G, endpoint: EP('relayAuth') }, CALLER);
  ok(/^not committed: other changes are staged in the repo \(README.md\), and the list is committed only alone$/.test(m2.commit) && git(SCRATCH, ['rev-parse', 'HEAD']) === headBefore, 'with other changes staged it does not commit, and says so', 'commit ' + short(m2.commit));
  ok(git(SCRATCH, ['diff', '--cached', '--name-only']) === 'README.md' && doorIn(m2.door), 'their staging is left alone; the list is written all the same', 'staged ' + git(SCRATCH, ['diff', '--cached', '--name-only']));
  git(SCRATCH, ['reset', '-q', '--', 'README.md']);
  pushPlan.code = 1; pushPlan.err = 'pushOrigin: no origin to push to\nmore';
  const u1 = await V('suites.add')({ id: m2.door, path: 'everyVerb.js' });
  pushPlan.code = 0; pushPlan.err = '';
  ok(/^committed [0-9a-f]+ locally; the push failed, so it is not pushed: no origin to push to$/.test(u1.commit), 'a failed push leaves the commit local, saying pushOrigin\'s first line', 'commit ' + short(u1.commit));

  test.subHeading('paths and suites, one row a write');
  const pa = V('paths.add'); const pr = V('paths.remove'); const sa = V('suites.add'); const sr = V('suites.remove');
  const p1 = await pa({ id: 'd10', path: ' /api/relay/ ' });
  ok(p1.id === 'd10' && JSON.stringify(doorIn('d10').paths) === '["/api/","/api/relay/"]', 'a node: door gains a path, trimmed', 'd10 ' + short(doorIn('d10')));
  ok(/already/.test(await refusal(function () { return pa({ id: 'd10', path: '/api/' }); })), 'a path already there is refused', 'answered ' + short(await refusal(function () { return pa({ id: 'd10', path: '/api/' }); })));
  ok(/is no request path/.test(await refusal(function () { return pa({ id: 'd10', path: 'api relay' }); })), 'a path that is no request path is refused', '');
  ok(/paths belong to a node: endpoint/.test(await refusal(function () { return pa({ id: 'd1', path: '/x/' }); })), 'a module door takes no path', '');
  ok(/has no path \/nope\//.test(await refusal(function () { return pr({ id: 'd10', path: '/nope/' }); })), 'removing a path not there is refused', '');
  ok(/a path is needed/.test(await refusal(function () { return pa({ id: 'd10', path: '  ' }); })), 'an empty path is refused', '');
  await pr({ id: 'd10', path: '/api/' });
  await pr({ id: 'd10', path: '/api/relay/' });
  ok(doorIn('d10') && !('paths' in doorIn('d10')), 'its last path removed, the door holds no paths field', 'd10 ' + short(doorIn('d10')));
  await sa({ id: 'd1', path: 'everyVerb.js' });
  await sa({ id: 'd1', path: 'serverSurface.js' });
  ok(JSON.stringify(doorIn('d1').suites) === '["everyVerb.js","serverSurface.js"]', 'a suite of the old test folder is added', 'd1 ' + short(doorIn('d1')));
  ok(/is not there in spirit\/test/.test(await refusal(function () { return sa({ id: 'd1', path: 'noSuchSuiteAnywhere.js' }); })), 'a suite not there is refused', '');
  ok(/is not a file name of spirit\/test/.test(await refusal(function () { return sa({ id: 'd1', path: '../spirit/run/spirit.js' }); })), 'a suite with a folder in it is refused', '');
  ok(/already/.test(await refusal(function () { return sa({ id: 'd1', path: 'everyVerb.js' }); })), 'a suite named twice is refused', '');
  ok(/the list has no door "d99" to change/.test(await refusal(function () { return sa({ id: 'd99', path: 'everyVerb.js' }); })), 'a door not in the list is refused', '');
  const s1 = V('suites.search')({ id: 'd1', text: '' });
  ok(s1.items.length === 2 && s1.items[0].key === 'everyVerb.js' && JSON.parse(s1.items[0].label).pos === 0 && s1.more === false, 'suites.search with no text: the list\'s order, each with its place', 'answered ' + short(s1));
  const s2 = V('suites.search')({ id: 'd1', text: 'serverSurface' });
  ok(s2.items[0] && s2.items[0].key === 'serverSurface.js', 'with text: ranked by it', 'answered ' + short(s2));
  await sr({ id: 'd1', path: 'serverSurface.js' });
  ok(JSON.stringify(doorIn('d1').suites) === '["everyVerb.js"]', 'a suite is removed', 'd1 ' + short(doorIn('d1')));
  const ps = V('paths.search')({ id: 'd10', text: '' });
  ok(ps.items.length === 0 && ps.more === false, 'paths.search of a door with none: nothing', 'answered ' + short(ps));

  test.subHeading('update: a door changed in place under the add\'s rules');
  const item11 = doorIn('d11').item;
  const up = await update({ id: 'd11', gate: G, endpoint: EP('relayStatus') });
  ok(up.id === 'd11' && doorIn('d11').endpoint === EP('relayStatus') && doorIn('d11').item === item11, 'its endpoint changes; its id and its item stay', 'd11 ' + short(doorIn('d11')));
  ok(/no suites$/.test(git(SCRATCH, ['log', '-1', '--format=%s'])) && /door d11 changed/.test(git(SCRATCH, ['log', '-1', '--format=%s'])), 'and the change is committed, saying it', git(SCRATCH, ['log', '-1', '--format=%s']));
  ok(/the list has this door already/.test(await refusal(function () { return update({ id: 'd11', gate: G, endpoint: EP('presenceNode') }); })), 'into another door\'s values it is refused', '');
  ok((await update({ id: 'd11', gate: G, endpoint: EP('relayStatus') })).id === 'd11', 'into its own values it is not its own duplicate', '');
  ok(/the list has no door "d77" to change/.test(await refusal(function () { return update({ id: 'd77', gate: G, endpoint: EP('limits') }); })), 'a door not there is refused', '');

  test.subHeading('run: the plugin runs a door itself, at once, one run per door');
  const ran = run({ id: 'd1' });
  ok(ran.started === true && ran.already === false && /Door d1 is running now/.test(ran.said), 'run answers at once: started', 'answered ' + short(ran));
  const dr = doorRuns[0];
  ok(dr && dr.argv[0] === DOOR_TEST && dr.opts.cwd === REPO && dr.env.SPIRIT_STACKS_DOOR === 'd1' && dr.env.SPIRIT_STACKS_LIST === LIST && /d1\.\d+\.verdict\.json$/.test(dr.env.SPIRIT_STACKS_VERDICT), 'it starts the one-door suite in the repo, naming the door, the list and where the verdict goes', 'run ' + short(dr && { argv: dr.argv, cwd: dr.opts.cwd, door: dr.env.SPIRIT_STACKS_DOOR }));
  const again = run({ id: 'd1' });
  ok(again.started === false && again.already === true && doorRuns.length === 1, 'run again while it runs: already, nothing started', 'answered ' + short(again));
  const st0 = await runState({ id: 'd1' });
  ok(st0.running === true && st0.verdict.why === 'running' && st0.endedAt === '', 'runState: running', 'answered ' + short(st0));
  ok(/a run of door d1 is under way: let it end before you change it/.test(await refusal(function () { return update({ id: 'd1', gate: G, endpoint: EP('presenceNode') }); })), 'a change of a running door is refused', '');
  ok(/under way/.test(await refusal(function () { return sa({ id: 'd1', path: 'serverSurface.js' }); })) && /under way: let it end before you remove it/.test(await refusal(function () { return remove({ id: 'd1' }); })), 'so are its rows and its removal', '');
  ok(/the list has no door "d42" to run/.test(await refusal(function () { return run({ id: 'd42' }); })), 'a door not there is not run', '');
  const raw1 = 'GET /api/relay/key from spirit/run/spirit/hub.js:300:sealedClaim < spirit/run/spirit/hub.js:250:handleClaim';
  const raw2 = 'announce from spirit/run/spirit/presenceNode.js:10:announce < spirit/run/js/boot.js:7:main';
  dr.release({ green: false, around: 2, of: 5, paths: [raw1, raw2], why: 'two around the gate' }, 1);
  await until(function () { return verified.length === 1; }, 3000);
  let kept = null;
  try { kept = JSON.parse(fs.readFileSync(path.join(STATE, 'runs', 'd1.json'), 'utf8')); } catch (e) { kept = null; }
  ok(kept && kept.door === 'd1' && kept.ran === true && kept.green === false && kept.around === 2 && kept.of === 5 && kept.why === 'two around the gate' && kept.endedAt >= kept.startedAt, 'its verdict is kept in its state folder, runs/d1.json', 'kept ' + short(kept));
  ok(!fs.existsSync(dr.env.SPIRIT_STACKS_VERDICT), 'the suite\'s verdict file is removed', 'left ' + dr.env.SPIRIT_STACKS_VERDICT);
  ok(verified[0] && verified[0].verb === 'door.record' && verified[0].a.id === 'd1' && verified[0].a.verdict.around === 2, 'and goes to deskVerify as a record, door.record', 'verified ' + short(verified));
  ok(published.some(function (p) { return p.what === 'run' && p.id === 'd1'; }), 'run is said on the stream', 'published ' + short(published));
  const st1 = await runState({ id: 'd1' });
  ok(st1.running === false && st1.verdict.ran === true && st1.verdict.green === false && st1.verdict.around === 2 && st1.verdict.of === 5, 'runState: the verdict', 'answered ' + short(st1));
  ok(st1.verdict.paths.join('\n') === [raw1, raw2].join('\n') && st1.verdict.pathsLeft === 0, 'with its raw paths', 'paths ' + short(st1.verdict.paths));
  ok(st1.verdict.violators.indexOf('boot.js:7 main ---> presenceNode.js announce, bypassing createPeerPost') !== -1 && st1.verdict.violatorsLeft === 0, 'and its violator lines, for the door as it is now (violators.js)', 'violators ' + short(st1.verdict.violators));
  const one = await made.verbs['stackFrameChecks.door'].handler({ id: 'd1' });
  ok(one.id === 'd1' && one.gate === G && one.endpoint === EP('presenceNode') && one.suites.join() === 'everyVerb.js' && one.item === 'goal/G7.1' && one.last.ran === true && one.last.around === 2 && !('paths' in one), 'door: the one door as the list holds it, with its last run', 'answered ' + short(one));
  await sa({ id: 'd1', path: 'serverSurface.js' });
  const st2 = await runState({ id: 'd1' });
  ok(st2.verdict.ran === false && st2.verdict.why === 'the door changed after its last run' && st2.startedAt === '', 'a door changed after its run reads its verdict as cleared', 'answered ' + short(st2));
  run({ id: 'd10' });
  doorRuns[1].release(null, 3);
  await until(function () { return verified.length === 2; }, 3000);
  const st3 = await runState({ id: 'd10' });
  ok(st3.verdict.ran === false && st3.verdict.why === 'the suite exited 3 with no verdict', 'a suite that writes no verdict: ran false, saying how it exited', 'answered ' + short(st3));
  const never = await runState({ id: 'd2' });
  ok(never.running === false && never.verdict.why === 'never run', 'a door never run: never run', 'answered ' + short(never));
  run({ id: 'd2' });
  const many = [];
  for (let i = 0; i < 40; i++) many.push('GET /api/relay/' + 'x'.repeat(380) + i + ' from spirit/run/js/far' + i + '.js:1:f' + i);
  doorRuns[2].release({ green: false, around: 40, of: 40, paths: many }, 1);
  await until(function () { return verified.length === 3; }, 3000);
  const st4 = await runState({ id: 'd2' });
  const bytes = st4.verdict.paths.reduce(function (n, p) { return n + Buffer.byteLength(p, 'utf8'); }, 0);
  ok(st4.verdict.paths.length > 0 && st4.verdict.paths.every(function (p) { return Buffer.byteLength(p, 'utf8') <= 300; }) && bytes <= 3000, 'each raw path cut to 300 bytes, all of them to 3000', 'sent ' + st4.verdict.paths.length + ', ' + bytes + ' bytes');
  ok(st4.verdict.pathsLeft === 40 - st4.verdict.paths.length && st4.verdict.violatorsLeft === 40 - st4.verdict.violators.length && st4.verdict.violators.join('').length <= 2000 * 2, 'what is left out is counted, paths and violator lines', 'pathsLeft ' + st4.verdict.pathsLeft + ', violatorsLeft ' + st4.verdict.violatorsLeft);

  test.subHeading('doors.search: the list read back, bounded');
  const all = await made.verbs['stackFrameChecks.doors.search'].handler({ text: '' });
  const keys = all.items.map(function (i) { return i.key; }).sort();
  ok(JSON.stringify(keys) === JSON.stringify((list() || []).map(function (d) { return d.id; }).sort()) && all.more === false, 'with no text, every door, more false', 'keys ' + short(keys));
  const row = JSON.parse(all.items.filter(function (i) { return i.key === 'd1'; })[0].label);
  ok(row.id === 'd1' && row.item === 'goal/G7.1' && row.last && row.last.ran === false && 'running' in row.last, 'each row the door with its last run', 'row ' + short(row));
  const q = await made.verbs['stackFrameChecks.doors.search'].handler({ text: 'postQueue' });
  ok(q.items[0] && q.items[0].key === 'd2', 'with text, ranked by it', 'first ' + short(q.items[0]));

  test.subHeading('remove: the door struck, its item deleted with it');
  const item2 = doorIn('d2').item;
  const rm = await remove({ id: 'd2' });
  ok(rm.id === 'd2' && !doorIn('d2'), 'the door is out of the list', 'list ' + short(list()));
  ok(writes.some(function (w) { return w.verb === 'item.delete' && w.a.id === item2; }) && !S.items[item2], 'its item is deleted, by the desk', 'deletes ' + short(writesOf('item.delete')));
  ok(/door d2 removed, .*, its item .* deleted/.test(git(SCRATCH, ['log', '-1', '--format=%s'])), 'and the removal is committed, saying so', git(SCRATCH, ['log', '-1', '--format=%s']));
  ok(r('item.delete', { id: item2 }, [item2]) === '', 'its item is no door\'s now: a delete passes', '');
  ok(/the list has no door "d2" to remove/.test(await refusal(function () { return remove({ id: 'd2' }); })), 'removing it again is refused', '');

  test.subHeading('a list that cannot be read is an empty list');
  fs.writeFileSync(LIST, '{ not json');
  const none = await made.verbs['stackFrameChecks.doors.search'].handler({ text: '' });
  ok(none.items.length === 0 && none.more === false, 'doors.search answers no doors', 'answered ' + short(none));
  ok(r('item.delete', { id: 'goal/G7.1' }, ['goal/G7.1']) === '', 'and no item is held as a door\'s', '');

  console.error = realError;
  fs.rmSync(TMP, { recursive: true, force: true });
}()).then(function () { test.reportSuccessFailureCount(); process.exit(process.exitCode || 0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(1); });
