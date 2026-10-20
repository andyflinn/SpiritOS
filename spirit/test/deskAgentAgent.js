'use strict';

// spirit/test/deskAgentAgent.js
// goal/G10.8: Levant acts as a normal agent on the desk, like claude. Red on today's code (b8c0de5c); claude-windows
// wrote it and builds it (one agent). The item's box, decided by Andy, 2026-10-12:
//   - Levant reads every desk change and acts on it as claude does, and is just as constrained by the desk.
//   - Its desk tools grow by box.write, press (claim-done, design-complete), check.set, item.files.add, verify.again.
//   - It works in its own clone; code goes through deskAgent's own file tools, rooted at that clone: deskAgent
//     verbs, one description file each, so introspection lists them and tools.js makes them tools generically; they
//     write only files on the item Levant has taken, for every caller.
//   - It commits and pushes, through two deskAgent verbs, so its work is verified like everyone's.
//
// WHAT IS ASSERTED
//   1. the desk has a verb file for box.write, press, check.set, item.files.add and verify.again, each with a
//      description and the request keys desk.js declares.
//   2. deskAgent lists file.load, file.save, commit and push in its own family folder (FS.search, goal/G30.4).
//   3. every change: a desk change that is not addressed to Levant still reaches the model, the change in the call;
//      its own change does not; an empty answer posts nothing. The call's tools include the new desk verbs and
//      deskAgent's file.save.
//   4. the fence: file.save writes a file on the list of an item taken by this node, and refuses one on another
//      agent's item, a path out of the root and anything under .git; file.load reads inside the root.
//   5. commit {message, paths} commits fenced paths and refuses others; push sends the branch to its remote.
// The root is the manifest value `root` (default: the checkout deskAgent runs from); here a temp git repository.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G10.8: ';
const ROOT = path.join(__dirname, '..', '..');
const DESK_DIR = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'desk', 'desk.family'); // <module>.family since goal/G30.4
const AGENT = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'deskAgent', 'deskAgent.js');
const NODE_NAME = 'ollama agent node';
const CONFIGURATION = { persona: 'Levant', preamble: 'you are Levant', model: 'fake/Levant-GGUF', answerTokens: 100, bytesPerToken: 4 };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (fn()) return true; await sleep(50); } return fn(); }
function git(cwd, args) { return spawnSync('git', args, { cwd: cwd, encoding: 'utf8' }); }

test.startTest('goal/G10.8: Levant acts as a normal agent on the desk');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskunslothagent-'));

// ── THE DESK'S VERB FILES, READ FROM DISC AS introSpector READS THEM ───
function deskVerbFiles() {
  const out = {};
  fs.readdirSync(DESK_DIR).filter(function (f) { return /\.json$/.test(f) && f !== 'desk.json' && f !== 'currentGoal.json'; }).forEach(function (f) {
    try { const j = JSON.parse(fs.readFileSync(path.join(DESK_DIR, f), 'utf8')); if (j && typeof j.description === 'string') out[f.replace(/\.json$/, '')] = j; } catch (e) { /* not a verb file */ }
  });
  return out;
}

// ── THE FAKE STUDIO: the model's answers scripted ──────────────────────
const calls = [];
let answerText = '';
const studio = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (req.method === 'POST' && /chat\/completions/.test(req.url)) {
      calls.push(b);
      return res.end(JSON.stringify({ choices: [{ index: 0, message: { role: 'assistant', content: answerText }, finish_reason: 'stop' }] }));
    }
    res.end(JSON.stringify({ object: 'list', data: [] }));
  });
});

// ── THE FAKE NODE: deskClient (next, desk) and jobs.api for deskAgent itself ─
let nextQueue = [];
const posted = [];
let client = null;
const ITEMS = [
  { id: 'ag/G1', title: 'Agent', goal: '', status: '', with: '', go: false, files: [] },
  { id: 'ag/G1.1', title: 'Mine', goal: 'ag/G1', status: 'building', with: NODE_NAME, go: true, files: [{ path: 'spirit/test/zzMine.js', by: NODE_NAME, core: false }] },
  { id: 'ag/G1.2', title: 'Theirs', goal: 'ag/G1', status: 'building', with: 'claude-windows', go: true, files: [{ path: 'spirit/test/zzTheirs.js', by: 'claude-windows', core: false }] },
];
function deskAnswer(verb, a) {
  const verbs = deskVerbFiles();
  // The desk's family folder through its FS (goal/G30.4): AGENTS.md, the listing, and each verb file.
  if (verb === 'FS.loadFile' && a.path === 'AGENTS.md') return { text: 'Rules for agents.' };
  if (verb === 'FS.search') return { items: Object.keys(verbs).map(function (v) { return { key: v + '.json', label: v + '.json' }; }), more: false };
  if (verb === 'FS.loadJsonValue') return { value: verbs[String(a.path || '').replace(/\.json$/, '')] || null };
  if (verb === 'items.search') return { items: ITEMS.map(function (i) { return { key: i.id, label: JSON.stringify(i) }; }), more: false };
  const it = ITEMS.filter(function (i) { return i.id === a.id; })[0];
  if (verb === 'item.get') return it ? { item: JSON.stringify(it), version: 1, change: 1 } : { ok: false, code: 'no-such-item' };
  if (verb === 'item.box') return { box: 'the box of ' + a.id, version: 1 };
  if (verb === 'item.chat') return { chat: [], chatMore: false };
  if (verb === 'chat.add') { posted.push(a); return { change: 1 }; }
  return { change: 1 };
}
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    function answer(status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
    if (b.verb === 'jobs.update') return answer(200, { ok: true });
    const ask = b.verb === 'jobs.api' && b.ask;
    if (ask && ask.deskClient && ask.deskClient.next) {
      if (nextQueue.length) return answer(200, { lines: nextQueue.shift() });
      return setTimeout(function () { answer(200, { lines: [] }); }, 100);
    }
    if (ask && ask.deskClient && ask.deskClient.desk) {
      let a = {}; try { a = JSON.parse(ask.deskClient.desk.json || '{}'); } catch (e) { a = {}; }
      return answer(200, deskAnswer(String(ask.deskClient.desk.verb), a));
    }
    // deskAgent's own verbs through its node, as tools.js asks them: handed to its pipe.
    if (ask && ask.deskAgent && client) {
      return client.ask({ deskAgent: ask.deskAgent }).then(function (r) { answer(r.status || 200, r.body || {}); }, function (e) { answer(500, { ok: false, error: String(e) }); });
    }
    answer(404, { ok: false, code: 'no-such-verb' });
  });
});

const state = path.join(scratch, 'relay-state', 'process', 'deskAgent');
const repo = path.join(scratch, 'clone');
const remote = path.join(scratch, 'remote.git');
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'deskAgent', 'win32', 'process') : path.join(scratch, 'door.sock');
let kid = null;
const out = { stdout: '', stderr: '', code: null };

async function suite() {
  test.subHeading('1. the desk tells agents five more verbs');
  const verbs = deskVerbFiles();
  const want = { 'box.write': ['id', 'text', 'version'], press: ['id', 'what'], 'check.set': ['id', 'check', 'state'], 'item.files.add': ['id', 'paths'], 'verify.again': ['id'] };
  Object.keys(want).forEach(function (v) {
    const f = verbs[v];
    const keys = f && f.request ? Object.keys(f.request).sort() : [];
    if (f && f.description && JSON.stringify(keys) === JSON.stringify(want[v].slice().sort())) test.check('process/js/desk/' + v + '.json describes ' + v + ' with its request ' + want[v].join(', '));
    else test.fail(OWED + 'no verb file for ' + v + ' with request ' + want[v].join(', ') + ': ' + short(f));
  });

  test.subHeading('2. deskAgent: its own file and git verbs, listed by introspection');
  fs.mkdirSync(state, { recursive: true });
  fs.mkdirSync(path.join(repo, 'spirit', 'test'), { recursive: true });
  git(scratch, ['init', '-q', '--bare', remote]);
  git(repo, ['init', '-q']);
  git(repo, ['config', 'user.email', 'levant@test']);
  git(repo, ['config', 'user.name', 'Levant']);
  fs.writeFileSync(path.join(repo, 'README.md'), 'clone\n');
  git(repo, ['add', 'README.md']);
  git(repo, ['commit', '-q', '-m', 'first']);
  git(repo, ['remote', 'add', 'origin', remote]);
  git(repo, ['push', '-q', '-u', 'origin', 'HEAD']);
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  await new Promise(function (r) { studio.listen(0, '127.0.0.1', r); });
  fs.writeFileSync(path.join(scratch, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.address().port }));
  fs.writeFileSync(path.join(state, 'configuration.json'), JSON.stringify(CONFIGURATION, null, 1));
  // SINCE goal/G10.9 it starts connected only when the loaded model has the desk-recommended mark ("Connect should be
  // refused while the loaded model has no 🧵."), so the known list names the configured model as tested and passed.
  fs.writeFileSync(path.join(state, 'models.json'), JSON.stringify({ active: CONFIGURATION.model, activeQuant: '', models: [{ id: CONFIGURATION.model, quant: '', loaded: true, recommended: true, tested: '2026-10-12T00:00:00.000Z' }] }));
  fs.writeFileSync(path.join(state, 'connection.json'), JSON.stringify({ url: 'http://127.0.0.1:' + studio.address().port + '/v1', key: 'k' }));
  kid = spawn(process.execPath, [AGENT, JSON.stringify({ root: repo }), '--pipe', pipe, '--state', state, '--node', JSON.stringify({ name: NODE_NAME, publicKey: 'K' })],
    { cwd: scratch, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'test-deskAgent', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.address().port + '/api/spirit' }) });
  kid.stdout.on('data', function (c) { out.stdout += c; });
  kid.stderr.on('data', function (c) { out.stderr += c; });
  kid.on('exit', function (code) { out.code = code === null ? 'signal' : code; });
  client = appClient.createAppClient({ rootDir: scratch, log: function () {} });
  client.register('deskAgent', pipe);
  let up = false;
  for (let i = 0; i < 60 && !up && out.code === null; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.deskAgent && r.body.deskAgent.ok !== false); } catch (e) { /* not yet */ } }
  if (!up) { test.fail('the world: deskAgent did not start: ' + short(out.stderr)); return; }
  // Its family folder's listing, FS.search, names the verb files (goal/G30.4).
  const intro = (await client.ask({ deskAgent: { 'FS.search': { q: '' } } })).body || {};
  const listed = (intro.items || []).map(function (i) { return String(i.key); }).filter(function (k) { return /\.json$/.test(k); }).map(function (k) { return k.slice(0, -5); }).sort();
  if (['commit', 'file.load', 'file.save', 'push'].every(function (v) { return listed.indexOf(v) !== -1; })) test.check('FS.search lists the verb files of file.load, file.save, commit and push: ' + listed.join(', '));
  else test.fail(OWED + 'deskAgent introspection lists ' + short(listed));

  test.subHeading('3. every desk change reaches the model; its own does not; an empty answer posts nothing');
  await until(function () { return true; }, 10);
  await sleep(800); // past the backlog: the first empty next
  answerText = '';
  const press = 'DESK andy press ' + JSON.stringify({ id: 'ag/G1.2', what: 'go' });
  nextQueue.push([press]);
  await until(function () { return calls.length >= 1; }, 8000);
  const c1 = calls[0];
  const text = c1 ? JSON.stringify(c1.messages) : '';
  if (c1 && text.indexOf('press') !== -1 && text.indexOf('ag/G1.2') !== -1) test.check('a press nobody addressed to Levant reaches the model, the change in the call');
  else test.fail(OWED + 'after an unaddressed press the model was called ' + calls.length + ' time(s): ' + short(text));
  const toolNames = c1 && Array.isArray(c1.tools) ? c1.tools.map(function (t) { return t.function && t.function.name; }) : [];
  if (['desk_box_write', 'desk_press', 'desk_check_set', 'desk_item_files_add', 'desk_verify_again', 'deskAgent_file_save', 'deskAgent_commit'].every(function (n) { return toolNames.indexOf(n) !== -1; })) test.check('its tools include the five desk verbs and deskAgent\'s file and git verbs');
  else test.fail(OWED + 'the call\'s tools are ' + short(toolNames));
  await sleep(500);
  if (!posted.length) test.check('an empty answer posts nothing');
  else test.fail(OWED + 'an empty answer posted ' + short(posted));
  const before = calls.length;
  nextQueue.push(['DESK ' + NODE_NAME + ' chat.add ' + JSON.stringify({ id: 'ag/G1.1', text: 'Levant: my own line' })]);
  await sleep(1500);
  if (calls.length === before) test.check('its own change reaches no model call');
  else test.fail(OWED + 'its own line called the model');

  test.subHeading('4. the fence: only files on the item this node has taken');
  const save = function (p, c) { return client.ask({ deskAgent: { 'file.save': { path: p, content: c } } }).then(function (r) { return r; }); };
  const mine = await save('spirit/test/zzMine.js', 'mine\n');
  if (mine.status === 200 && mine.body && mine.body.ok !== false && fs.existsSync(path.join(repo, 'spirit', 'test', 'zzMine.js'))) test.check('file.save writes a file on the list of the item this node has taken, inside the root');
  else test.fail(OWED + 'file.save on its own item answered ' + mine.status + ' ' + short(mine.body));
  const theirs = await save('spirit/test/zzTheirs.js', 'x');
  if (theirs.body && theirs.body.ok === false && !fs.existsSync(path.join(repo, 'spirit', 'test', 'zzTheirs.js'))) test.check('and refuses a file on another agent\'s item');
  else test.fail(OWED + 'file.save on another agent\'s item answered ' + theirs.status + ' ' + short(theirs.body));
  const out1 = await save('../escape.js', 'x');
  const gitw = await save('.git/config', 'x');
  if (out1.body && out1.body.ok === false && gitw.body && gitw.body.ok === false && !fs.existsSync(path.join(scratch, 'escape.js'))) test.check('and refuses a path out of the root and anything under .git');
  else test.fail(OWED + 'out of root ' + short(out1.body) + '; .git ' + short(gitw.body));
  const load = (await client.ask({ deskAgent: { 'file.load': { path: 'README.md' } } })).body || {};
  if (load.text === 'clone\n') test.check('file.load reads a file inside the root');
  else test.fail(OWED + 'file.load answered ' + short(load));

  test.subHeading('5. commit and push');
  const refused = (await client.ask({ deskAgent: { commit: { message: 'not mine', paths: ['README.md'] } } })).body || {};
  if (refused.ok === false) test.check('commit refuses a path not on its item');
  else test.fail(OWED + 'commit of an unfenced path answered ' + short(refused));
  const done = (await client.ask({ deskAgent: { commit: { message: 'goal/G1.1: mine', paths: ['spirit/test/zzMine.js'] } } })).body || {};
  const log = git(repo, ['log', '-1', '--format=%s']).stdout.trim();
  if (done.commit && log === 'goal/G1.1: mine') test.check('commit {message, paths} commits the fenced paths: ' + done.commit);
  else test.fail(OWED + 'commit answered ' + short(done) + '; the log reads ' + short(log));
  const pushed = (await client.ask({ deskAgent: { push: {} } })).body || {};
  const there = git(remote, ['log', '-1', '--format=%s', 'HEAD']).stdout.trim() || git(remote, ['log', '-1', '--all', '--format=%s']).stdout.trim();
  if (pushed.ok !== false && there === 'goal/G1.1: mine') test.check('push sends the branch to its remote');
  else test.fail(OWED + 'push answered ' + short(pushed) + '; the remote has ' + short(there));

  // AGENT SCOPES ARE GONE (Q15 to Q19): Andy, 2026-10-12, "all agents in desk have "/" file scope", the setting
  // removed from desk and commitCheck ("b"), "all in this item". Read in the code, comments stripped, so a comment that
  // tells the history does not count as the mechanism.
  test.subHeading('6. agent scopes are gone');
  const code = function (rel) {
    let t = '';
    try { t = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { return ''; }
    return t.split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n');
  };
  const still = [
    ['spirit/run/process/js/desk/desk.js', /'scope\.(set|get)'\s*:|case 'scope\.set'|scopes:/],
    ['spirit/run/process/js/desk/commitCheck.js', /scope\.get|REFUSED \(scope\)/],
    ['spirit/run/process/js/desk/removeAgent.js', /scope\.set/],
    ['spirit/run/process/js/deskClient/publishData.js', /scope\.get/],
    ['spirit/run/shell/desk/desk.js', /scope\.(set|get)|data-scope-/],
  ].filter(function (p) { return p[1].test(code(p[0])); }).map(function (p) { return p[0]; });
  if (!still.length) test.check('no scope.set or scope.get in the desk, commitCheck, removeAgent, publishData or the Desk face');
  else test.fail(OWED + 'agent scopes are still in ' + still.join(', '));
  const retired = ['spirit/test/deskScopes.js', 'spirit/test/deskScopePane.js'].filter(function (f) { return fs.existsSync(path.join(ROOT, f)); });
  if (!retired.length) test.check('the scope suites are retired with the mechanism');
  else test.fail(OWED + 'still in the tree: ' + retired.join(', '));
}

suite().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  if (kid && out.code === null) await new Promise(function (r) { kid.once('exit', r); try { kid.kill(); } catch (e) { r(); } setTimeout(r, 3000); });
  try { node.close(); studio.close(); } catch (e) { /* closed */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
