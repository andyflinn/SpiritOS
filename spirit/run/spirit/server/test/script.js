'use strict';

// spirit/run/spirit/server/test/script.js
// The tests of spirit/server/script.js, in this one file (spec: ./script.md): the launcher (goal/G48.5), the one server
// (goal/G49.25), the helpers it hands out (serveCommon's until goal/G49.25, their test spirit/server/serveCommon/test/script.js
// then), and the node it starts (spirit/server/node/script.js until goal/G49.25, its test spirit/server/node/test/script.js then):
// box v16, "spirit/server/script.js is THE server, for node and relay alike"; one test file per module.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const S = require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/testicle/testReport/script.js');
const H = S.requireScript('spirit/testicle/headLessChrome/script.js');

// ── THE LAUNCHER (goal/G48.5, the box, "completeness, asserted": "spirit/server/script.js starts a node with no mode and with
// --node, a relay with --relay, a server process with --app <script>; an unknown mode is refused; every argument after the
// mode reaches the module unchanged; a refused relay exits 78", "no tracked file names an old path", "no file stands at an
// old path"). Each start in a lab tree of its own (spirit/testicle/headLessChrome/script.js scratchTree), stopped and let go after.
const { spawn: spawnL, execFileSync: execL } = require('child_process');
const L = { trees: [], kids: [] };
function labTree() {
  const t = H.scratchTree();
  L.trees.push(t);
  // The node's home inside the tree, as spirit/testicle/headLessChrome/script.js's startNode makes it.
  const file = path.join(t.run, 'spirit', 'state', 'config.json');
  let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(file, 'utf8')) || {}; } catch (e) { cfg = {}; }
  if (!cfg.spiritHome) { cfg.spiritHome = path.join(path.dirname(path.dirname(t.run)), '.spiritHome'); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(cfg, null, 2)); }
  return t;
}
function launch(run, args) {
  const kid = spawnL(process.execPath, ['spirit/server/script.js'].concat(args), { cwd: run, stdio: 'ignore' });
  const r = { kid: kid, code: null };
  kid.on('exit', function (c) { r.code = c; });
  L.kids.push(kid);
  return r;
}
function answers(port) { return fetch('http://127.0.0.1:' + port + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'api', args: {} }) }).then(function (r) { return r.status === 200; }, function () { return false; }); }
async function nodeComesUp(modeArgs) {
  const t = labTree();
  const port = await H.freePort();
  const r = launch(t.run, modeArgs.concat(['--port', String(port)]));
  const up = await H.until(function () { return r.code !== null ? Promise.resolve(false) : answers(port); }, 60000);
  await done(t, r);
  return !!up;
}
// Lab holds a few trees: each start lets its tree go once its test is done.
function done(t, r) {
  try { if (r && r.kid) r.kid.kill(); } catch (e) { /* gone */ }
  const i = L.trees.indexOf(t); if (i !== -1) L.trees.splice(i, 1);
  return new Promise(function (res) { setTimeout(function () { try { t.release(); } catch (e) { /* freed when this process ends */ } res(); }, 500); });
}
test.after(function () {
  L.kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  L.trees.forEach(function (t) { try { t.release(); } catch (e) { /* freed when this process ends */ } });
});
test.run('the launcher, spirit/server/script.js, with no mode and --port, starts a node on that port', 0.4, async function () {
  return (await nodeComesUp([])) || false;
}, test.limit.long, { why: 'it launches a node in a lab tree and waits for it' });
test.run('the launcher, spirit/server/script.js, with --node and --port, starts a node on that port', 0.4, async function () {
  return (await nodeComesUp(['--node'])) || false;
}, test.limit.long, { why: 'it launches a node in a lab tree and waits for it' });
test.run('the launcher refuses a mode it does not know: it exits, with a code that is not 0, and serves nothing', 0.8, async function () {
  const t = labTree();
  const port = await H.freePort();
  const r = launch(t.run, ['--zzNoSuchMode', '--port', String(port)]);
  await H.until(function () { return Promise.resolve(r.code !== null); }, 15000);
  const served = await answers(port);
  await done(t, r);
  return (r.code !== null && r.code !== 0 && !served) || false;
}, test.limit.slow, { why: 'it launches the server and waits for it to exit' });
test.run('a relay the launcher starts with --relay, whose store cannot open, exits 78 for systemd', 0.8, async function () {
  const t = labTree();
  const db = path.join(t.run, 'spirit', 'state', 'relay.db');
  fs.mkdirSync(path.dirname(db), { recursive: true }); fs.writeFileSync(db, 'not a database at all, so the store refuses to open');
  const port = await H.freePort();
  const r = launch(t.run, ['--relay', '--port', String(port)]);
  await H.until(function () { return Promise.resolve(r.code !== null); }, 30000);
  const code = r.code;
  await done(t, r);
  return code === 78 || false;
}, test.limit.slow, { why: 'it launches a relay and waits for it to exit' });
// The old paths, spelled in pieces so that this file names none of them itself.
const OLD_PATHS = ['spirit/' + 'appServer.js', 'spirit/' + 'relayServer.js', 'spirit/' + 'serveCommon.js', 'node' + 'Agent.js', 'node' + 'Chat.js', 'node' + 'Desk.js', 'node' + 'Icons.js'];
const OLD_FILES = ['spirit/' + 'appServer.js', 'spirit/' + 'relayServer.js', 'spirit/' + 'serveCommon.js', 'spirit/app/agent/node' + 'Agent.js', 'spirit/app/chat/node' + 'Chat.js', 'spirit/app/desk/node' + 'Desk.js', 'spirit/app/icons/node' + 'Icons.js'];
test.run('no tracked file names an old path: none of the three moved core files, none of the four node<Name>.js', 0.4, function () {
  const REPO = path.resolve(RUN, '..', '..');
  const hits = OLD_PATHS.filter(function (p) { try { execL('git', ['grep', '-l', '-F', p], { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }); return true; } catch (e) { return false; } });
  // Written in pieces too (cw: "the old-path check should also catch the pieces form, 'spirit', 'serveCommon.js'"; boot.js's test
  // stalled Andy's Ubuntu testicle so): an old file built from the run root, RUN, 'spirit', '<old>.js'.
  const q = "'";
  const pieces = new RegExp('RUN, ' + q + 'spirit' + q + ', ' + q + '(' + ['app' + 'Server', 'relay' + 'Server', 'serve' + 'Common'].join('|') + ')\\.js' + q);
  let built = '';
  try { built = execL('git', ['grep', '-n', '-E', pieces.source], { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }); } catch (e) { built = ''; }
  return (!hits.length && !built.trim()) || false;
}, test.limit.slow, { why: 'it runs git grep over the whole repo' });
test.run('no file stands at an old path: neither the three core files nor the four node<Name>.js', 0.4, function () {
  return !OLD_FILES.some(function (f) { return fs.existsSync(path.join(RUN, f)); }) || false;
}, test.limit.quick);
// --app STAYS AS IT IS (goal/G49.25, box v16: "spirit.server.app remains what it is: the launcher's --app <script> starts one app
// server, as today"); the node and the relay are the launcher itself ("spirit/server/script.js is THE server, for node and relay alike").
test.run('spirit/server/script.js hands --app to spirit/server/app/script.js, and requires neither spirit/server/node/ nor spirit/server/relay/', 0.4, function () {
  const src = serverCode();
  return (src.indexOf("requireScript('spirit/server/app/script.js')") !== -1 && !/spirit\/server\/(node|relay)\//.test(src)) || false;
}, test.limit.quick);

// ── ONE SERVER (goal/G49.25, box v16) ──
// "spirit/server/script.js is THE server, for node and relay alike: the actual node server, spirit/server/node/script.js, moves
// into it."; "spirit.server.serveCommon goes: spirit/server/script.js takes ALL of its jobs"; "spirit.server.relay goes."
function serverCode() {
  let t = ''; try { t = fs.readFileSync(path.join(RUN, 'spirit', 'server', 'script.js'), 'utf8'); } catch (e) { return ''; }
  // Whole comment lines only (// and the lines of a /* */ block that start one): a /* inside a string or a glob must not
  // cut the code after it.
  return t.replace(/^\s*\/\*[\s\S]*?\*\/\s*$/gm, '').replace(/^\s*\/\/.*$/gm, '');
}
test.run('spirit/server/node/, spirit/server/relay/ and spirit/server/serveCommon/ hold no script.js: they went into spirit/server/script.js', 0.4, function () {
  return ['node', 'relay', 'serveCommon'].every(function (d) { return !fs.existsSync(path.join(RUN, 'spirit', 'server', d, 'script.js')); }) || false;
}, test.limit.quick);
// "when spirit/server/script.js is launched with --relay, it sets spirit.IS_RELAY to true immediately after spirit/script.js is
// loaded, before spirit.fs is used."
test.run('launched with --relay, it sets spirit.IS_RELAY true in the statement right after it requires spirit/script.js', 0.4, function () {
  const c = serverCode();
  const m = /require\((['"])(\.\.\/script\.js|\.\.\/\.\.\/spirit\/script\.js)\1\);/.exec(c);
  if (!m) return false;
  const next = c.slice(m.index + m[0].length).replace(/^\s+/, '');
  return /^if\s*\([^;{]*['"]--relay['"][^;{]*\)\s*\{?\s*spirit\.IS_RELAY\s*=\s*true\s*;/.test(next) || false;
}, test.limit.quick);
test.run('no product script but spirit/server/script.js sets spirit.IS_RELAY true', 0.4, function () {
  const REPO = path.resolve(RUN, '..', '..');
  let hits = '';
  try { hits = execL('git', ['grep', '-l', '-E', 'IS_RELAY\\s*=\\s*true', '--', 'spirit/run/spirit/*.js', ':!spirit/run/spirit/**/test/**'], { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }); } catch (e) { hits = ''; }
  const files = hits.split('\n').filter(Boolean);
  return (files.length === 1 && files[0] === 'spirit/run/spirit/server/script.js') || false;
}, test.limit.slow, { why: 'it runs git grep over the product scripts' });
// "spirit/server/script.js starts a server only when it is the file node was started with; required by another script (the peer
// post, the relay request), it starts nothing and hands out its helpers." Its helpers are serveCommon's, every one it handed out
// at the commit the box was written on (f3e398ecb), read from git, never listed here.
const HELPERS = (function () {
  let t = '';
  try { t = execL('git', ['show', 'f3e398ecb:spirit/run/spirit/server/serveCommon/script.js'], { cwd: path.resolve(RUN, '..', '..'), encoding: 'utf8', maxBuffer: 1 << 26 }); } catch (e) { return []; }
  const block = /module\.exports\s*=\s*\{([\s\S]*?)\};/.exec(t);
  if (!block) return [];
  return block[1].split('\n').map(function (l) { const k = /^\s*([A-Za-z_$][\w$]*)\s*:/.exec(l); return k ? k[1] : ''; }).filter(Boolean);
}());
const REQUIRED = { out: null };
test.run('required by another script, spirit/server/script.js starts nothing: the process that requires it ends by itself', 0.4, function () {
  const r = require('child_process').spawnSync(process.execPath, ['-e', "const s = require(process.argv[1]); process.stdout.write('\\nKEYS ' + JSON.stringify(Object.keys(s || {})) + '\\n');", path.join(RUN, 'spirit', 'server', 'script.js')], { cwd: RUN, encoding: 'utf8', timeout: 20000 });
  const line = String(r.stdout || '').split('\n').filter(function (l) { return l.indexOf('KEYS ') === 0; })[0];
  try { REQUIRED.out = line ? JSON.parse(line.slice(5)) : null; } catch (e) { REQUIRED.out = null; }
  return (r.status === 0 && r.signal === null && !!REQUIRED.out) || false;
}, test.limit.slow, { why: 'it spawns a node process that requires the server' });
test.run('required, it hands out every helper serveCommon handed out', 0.4, function () {
  return (HELPERS.length > 10 && !!REQUIRED.out && HELPERS.every(function (k) { return REQUIRED.out.indexOf(k) !== -1; })) || false;
}, test.limit.quick);
// "the server loads the spirit.fs branch explicitly, then loads all trunk branches, using the fs cache. spirit is always loaded."
// Andy, of the node mounting branches by name: "WHY WOULD THE MOTHERFUCKING SERVER LOAD MOTHERFUCKING BRANCHES EXPLICITLY????"
test.run('the server requires the spirit.fs branch by its path, spirit/fs/script.js', 0.4, function () {
  return serverCode().indexOf("requireScript('spirit/fs/script.js')") !== -1 || false;
}, test.limit.quick);
test.run('the server mounts no branch by a name written in it but spirit and spirit.fs', 0.4, function () {
  const c = serverCode();
  if (!c) return false;
  const named = []; const re = /\.mount\(\s*(['"])([^'"]*)\1/g; let m;
  while ((m = re.exec(c))) named.push(m[2]);
  // It mounts (the branches the cache holds); a server that mounts nothing has judged nothing here.
  return (/\.mount\(/.test(c) && named.every(function (n) { return n === 'spirit' || n === 'spirit.fs'; })) || false;
}, test.limit.quick);
// A scratch node whose tree holds trunk branches nobody names: spirit/zzLoaded, new shape (script.js and client/script.js, the
// mark of spirit/fs/filter/branch/script.js), spirit/zzOld, old shape (api.js and data.js, spirit/fs/filter/api/script.js's), and
// spirit/relay with the new mark. Its api tree, asked as a page asks it, holds the first two beside spirit.fs, and not spirit.relay:
// "the fs watcher, when !spirit.IS_RELAY, will never mark spirit.relay as a branch, and spirit.relay will not be exposed as such:
// a node does not serve it". And "spirit/<branch>/server/ is never served, as spirit/server/ and each app's server/ are not."
function clientOf(name) {
  return "'use strict';\n// its client (goal/G49.25's test)\n(function family(given, out) {\n  var OUT = out || {};\n" +
    "  if (!out && typeof module !== 'undefined' && module) module.exports = OUT;\n" +
    "  var D = typeof require === 'function' ? require('../../script.js').requireScript('spirit/client/script.js') : given;\n" +
    "  if (!D) { window.spirit.requireScript('spirit/client/script.js').then(function (got) { if (got) family(got, OUT); }); return; }\n" +
    "  D.handOut(OUT, D.makeFamily('" + name + "', function () { return {}; }));\n}());\n";
}
function plantBranches(run) {
  const put = function (rel, text) { const f = path.join(run, rel); if (fs.existsSync(f)) return; fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
  ['zzLoaded', 'relay'].forEach(function (b) {
    put('spirit/' + b + '/script.js', "'use strict';\n// a planted trunk branch, new shape (goal/G49.25's test)\n" +
      "if (typeof require === 'function') require('../script.js').requireScript('spirit/" + b + "/client/script.js'); else window.spirit.requireScript('spirit/" + b + "/client/script.js');\n" +
      "module.exports = { verbs: { get: { id: 'spirit/type/number/integer/script.js' } } };\n");
    put('spirit/' + b + '/client/script.js', clientOf('spirit.' + b));
  });
  put('spirit/zzLoaded/get.json', JSON.stringify({ description: 'One row by its number.', request: { id: 'spirit/type/number/integer/script.js' } }, null, 2) + '\n');
  put('spirit/zzLoaded/server/script.js', "'use strict';\n// its node work (goal/G49.25's test): never served\nmodule.exports = {};\n");
  put('spirit/zzOld/api.js', "'use strict';\n// a planted trunk branch, old shape (goal/G49.25's test)\n" +
    "if (typeof require === 'function') require('../script.js').requireScript('spirit/zzOld/data.js'); else window.spirit.requireScript('spirit/zzOld/data.js');\n" +
    "module.exports = { verbs: {} };\n");
  put('spirit/zzOld/data.js', "'use strict';\n// its data (goal/G49.25's test)\n(function family(given, out) {\n  var OUT = out || {};\n" +
    "  if (!out && typeof module !== 'undefined' && module) module.exports = OUT;\n" +
    "  var D = typeof require === 'function' ? require('../script.js').requireScript('spirit/client/script.js') : given;\n" +
    "  if (!D) { window.spirit.requireScript('spirit/client/script.js').then(function (got) { if (got) family(got, OUT); }); return; }\n" +
    "  D.handOut(OUT, D.makeFamily('spirit.zzOld'));\n}());\n");
}
const PLANTED = { node: null, tree: null };
// An old-shape branch is named in the tree as the node names net, owner and peer today: by its folder alone, or by its path.
function oldIn(t) { const b = t && (t['spirit.zzOld'] || t.zzOld); return b && typeof b === 'object' && b.ok !== false ? b : null; }
function askNode(call, args) {
  return fetch(PLANTED.node.base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) })
    .then(function (r) { return r.json().then(function (b) { return b; }, function () { return null; }); }, function () { return null; });
}
function statusOf(rel) { return fetch(PLANTED.node.base + '/' + rel).then(function (r) { return r.status; }, function () { return 0; }); }
test.run('a scratch node comes up on a tree with planted trunk branches: spirit/zzLoaded, spirit/zzOld and a marked spirit/relay', 0.4, async function () {
  PLANTED.node = await H.scratchNode({ own: true, before: plantBranches });
  L.kids.push({ kill: function () { try { PLANTED.node.release(); } catch (e) { /* the lab frees it */ } } });
  if (!PLANTED.node || !PLANTED.node.up) return false;
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    const t = await askNode('api', {});
    PLANTED.tree = t;
    if (t && t['spirit.fs'] && t['spirit.zzLoaded'] && oldIn(t)) break;
    await new Promise(function (r) { setTimeout(r, 500); });
  }
  return !!(PLANTED.tree && PLANTED.tree['spirit.fs']) || false;
}, test.limit.long, { why: 'it starts a scratch node and polls its api tree' });
test.run('its api tree holds spirit.zzLoaded, the new-shape branch no script names', 0.4, function () {
  const t = PLANTED.tree || {};
  return (!!t['spirit.zzLoaded'] && t['spirit.zzLoaded'].ok !== false) || false;
}, test.limit.quick);
test.run('its api tree holds spirit.zzOld, the old-shape branch no script names', 0.4, function () {
  return !!oldIn(PLANTED.tree) || false;
}, test.limit.quick);
test.run('its api tree holds no spirit.relay: a node does not serve the relay branch', 0.4, function () {
  const t = PLANTED.tree;
  return (!!t && !!t['spirit.fs'] && !t['spirit.relay'] && !t.relay) || false;
}, test.limit.quick);
test.run('it serves spirit/zzLoaded/script.js, and never spirit/zzLoaded/server/script.js', 0.4, async function () {
  if (!PLANTED.node || !PLANTED.node.up) return false;
  const open = await statusOf('spirit/zzLoaded/script.js');
  const hidden = await statusOf('spirit/zzLoaded/server/script.js');
  return (open === 200 && hidden !== 200 && hidden !== 0) || false;
}, test.limit.quick);

// ── THE RELAY BRANCH, AT THE ONE DOOR (goal/G49.25; Andy: "why would not the entire fucking set of relay verbs move into
// motherfucking spirit.relay.<verb> with only ONE, SINGLE, MOTHERFUCKING DOOR: spirit....", "the whole \"owner\"-verb shit is
// useless, never was, since the signature on a fucking request already says who the owner is...", "the grant-gate, when
// spirit.IS_RELAY has to let member requests pass for the neccessary member verbs"; "wsl, assert this in tests") ──
const REPO_ROOT = path.resolve(RUN, '..', '..');
function productHits(args) {
  let out = '';
  try { out = execL('git', ['grep', '-l'].concat(args, ['--', 'spirit/run/spirit/*.js', ':!spirit/run/spirit/**/test/**', ':!spirit/run/spirit/test/**']), { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }); } catch (e) { out = ''; }
  return out.split('\n').filter(Boolean);
}
test.run('the relay branch stands in the tree: spirit/relay/script.js hands out its verbs, its node work in spirit/relay/server/script.js', 0.4, function () {
  let b = null; try { b = require(path.join(RUN, 'spirit', 'relay', 'script.js')); } catch (e) { b = null; }
  return (!!b && !!b.verbs && Object.keys(b.verbs).length > 0 && fs.existsSync(path.join(RUN, 'spirit', 'relay', 'server', 'script.js'))) || false;
}, test.limit.quick);
test.run('one door: no product script serves or calls a route under /spirit/relay/', 0.4, function () {
  // Its own folders' names (spirit/relay/...) are paths in the tree, not routes: a route is the door's path with a leading slash.
  return productHits(['-E', "['\"`]/spirit/relay/"]).length === 0 || false;
}, test.limit.slow, { why: 'it runs git grep over the product scripts' });
test.run('no owner-verb list: no product script names OWNER_VERBS; the signature says who the owner is, the grants what each may call', 0.4, function () {
  return productHits(['-w', 'OWNER_VERBS']).length === 0 || false;
}, test.limit.slow, { why: 'it runs git grep over the product scripts' });
// Box v20: "its five face routes (allowed, call, file, stream, api): no route of its own stays, its files aside"; "the face
// allowed question stays a plain address, GET /face/allowed?domain=<name>, since Caddy can ask nothing else".
test.run('one door for the faces too: no product script serves or calls /face/call, /face/file, /face/stream or /face/api', 0.4, function () {
  return productHits(['-E', "['\"`]/face/(call|file|stream|api)\\b"]).length === 0 || false;
}, test.limit.slow, { why: 'it runs git grep over the product scripts' });
test.run('the server still answers Caddy at GET /face/allowed', 0.4, function () {
  return serverCode().indexOf("'/face/allowed'") !== -1 || false;
}, test.limit.quick);
// "The member verbs (card, face, removePeer, rename, search, and post, reply, stream, face answer, face stream) sit in one bundle";
// "the relay's member verbs and owner verbs lists, and the gate that reads them" go.
// Its verbs, by name (box v24, Q13, Andy: "yes"): "for members post, reply and stream; the home node's uploads, named in a header,
// faceAnswer and faceFeed; a face's browser faceCall, faceFile, faceEvents (its live stream), faceState, faceLogin and faceLogout;
// and its own, as today's signed packet, card, claim, face, search, rename, removePeer, invite, revoke, config, debug, monitor,
// relayLabel and api." With the join by email as today (Q17, Andy: "why the hell would they not?"): join and joinConfirm. The names are his decision, so they are written here; the branch hands out these and no other.
const RELAY_VERBS = ['post', 'reply', 'stream', 'faceAnswer', 'faceFeed', 'faceCall', 'faceEvents', 'faceState', 'faceLogin', 'faceLogout',
  'card', 'claim', 'join', 'joinConfirm', 'face', 'search', 'rename', 'removePeer', 'invite', 'revoke', 'config', 'debug', 'monitor', 'relayLabel', 'api'];
test.run('the relay branch hands out exactly the 25 verbs of the box (Q13; faceFile gone, Andy: "if nothing uses it, faceFile goes."; join and joinConfirm, Q17): post, reply, stream, faceAnswer, faceFeed, faceCall, faceEvents, faceState, faceLogin, faceLogout, card, claim, join, joinConfirm, face, search, rename, removePeer, invite, revoke, config, debug, monitor, relayLabel and api', 0.4, function () {
  let b = null; try { b = require(path.join(RUN, 'spirit', 'relay', 'script.js')); } catch (e) { b = null; }
  const v = Object.keys((b && b.verbs) || {}).sort();
  return (v.length === RELAY_VERBS.length && RELAY_VERBS.slice().sort().every(function (n, i) { return v[i] === n; })) || false;
}, test.limit.quick);
test.run('no member-verb list: no product script names MEMBER_VERBS', 0.4, function () {
  return productHits(['-w', 'MEMBER_VERBS']).length === 0 || false;
}, test.limit.slow, { why: 'it runs git grep over the product scripts' });
// THE PRESENCE MOVES (Andy, G49.25: "move ... spirit.presenceNode to spirit.contact.nodePresence"; "so presence belongs in
// relay.presence ?", answered yes; "cw, box it like that."): each stands at its new path, nothing at its old one, and no product
// script requires the old path.
[['spirit/presence/script.js', 'spirit/relay/presence/script.js'], ['spirit/presenceNode/script.js', 'spirit/contact/nodePresence/script.js']].forEach(function (m) {
  test.run(m[0] + ' moved to ' + m[1] + ', and nothing requires the old path', 0.4, function () {
    return (fs.existsSync(path.join(RUN, m[1])) && !fs.existsSync(path.join(RUN, m[0])) && productHits(['-F', "'" + m[0] + "'"]).length === 0) || false;
  }, test.limit.slow, { why: 'it runs git grep over the product scripts' });
});

// ══ THE HELPERS IT HANDS OUT (serveCommon's; goal/G49.25, box v16: "spirit.server.serveCommon goes: spirit/server/script.js
// takes ALL of its jobs") ══
// Until goal/G49.25 the test of spirit/server/serveCommon/script.js, owed since the rule "every production script has its own
// test" (goal/G47.1, box v72). What the node and the relay both answer HTTP with: reading a body, sending a file, refusing too big
// or malformed, the first-run defaults. In process, from spirit/server/script.js required (so it starts nothing): a planted res,
// a planted request stream, a planted server and socket, and a scratch home for what it writes; process.exit and console.error
// are planted where it would stop the process.
const os = require('os');
const { EventEmitter } = require('events');
// ITS TEMP FOLDERS FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"): one of its own for each
// it asks, under its suite's path, the whole of it removed when the suite ends.
const tempFolder = S.requireScript('spirit/tempFolder/script.js').tempFolder;
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/test/serveCommon/' + name + tempAsked); }
test.after(function () { try { fs.rmSync(tempFolder.path('spirit/test/serveCommon'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
// goal/G49.25: the helpers are handed out by spirit/server/script.js, required.
const C = S.requireScript('spirit/server/script.js');
const limits = S.requireScript('spirit/limits/script.js');
// A res that keeps what was written; done() resolves at its end.
function plantedRes() {
  const r = { status: null, headers: null, body: null };
  r.ended = new Promise(function (resolve) {
    r.writeHead = function (s, h) { r.status = s; r.headers = h || {}; };
    r.end = function (b) { r.body = b === undefined ? '' : b; resolve(r); };
  });
  return r;
}
// A request stream: an emitter with headers, a socket and destroy.
function plantedReq(headers, socketAddress) {
  const q = new EventEmitter();
  q.headers = headers || {};
  q.socket = { remoteAddress: socketAddress || '203.0.113.9' };
  q.destroyed = false;
  q.destroy = function () { q.destroyed = true; };
  return q;
}
const LATE = {};
function within(promise, ms) {
  return Promise.race([promise, new Promise(function (r) { setTimeout(function () { r(LATE); }, ms); })]);
}
// fn with process.exit and console.error planted; answers { code, said }.
function withExit(fn) {
  const was = { exit: process.exit, error: console.error };
  const got = { code: null, said: '' };
  process.exit = function (c) { got.code = c; };
  console.error = function (s) { got.said += String(s); };
  try { fn(); } finally { process.exit = was.exit; console.error = was.error; }
  return got;
}
const HOME = ownTemp('spirit-serveCommon-');
process.on('exit', function () { try { fs.rmSync(HOME, { recursive: true, force: true }); } catch (e) { /* gone */ } });

// ── the command line ──
test.run('portFromArgs gives the number of --port <n> and of --port=<n>, and null when no port is given', 0.2, function () {
  const got = [C.portFromArgs(['--port', '4123']), C.portFromArgs(['x', '--port=4124']), C.portFromArgs(['x']), C.portFromArgs(['--port'])];
  return (got[0] === 4123 && got[1] === 4124 && got[2] === null && got[3] === null) || false;
}, test.limit.quick);
test.run('emailFromArgs gives the address of --email <a> and of --email=<a> trimmed, and an empty string when no address is given', 0.2, function () {
  const got = [C.emailFromArgs(['--email', ' a@b.c ']), C.emailFromArgs(['--email=d@e.f ']), C.emailFromArgs([])];
  return (got[0] === 'a@b.c' && got[1] === 'd@e.f' && got[2] === '') || false;
}, test.limit.quick);

// ── the start refused, loudly ──
test.run('verifyStartupCwd refuses to start from a folder that is not spirit/run, with exit 1 and a sentence', 0.2, function () {
  const was = process.cwd();
  let got = null;
  try { process.chdir(HOME); got = withExit(function () { C.verifyStartupCwd('spirit/server/script.js'); }); } finally { process.chdir(was); }
  return (got.code === 1 && /Refusing to start/.test(got.said) && /spirit\/server\/script\.js/.test(got.said)) || false;
}, test.limit.quick);
test.run('verifyStartupCwd lets a start from spirit/run go on with the folders it names, and a relay needs only spirit/', 0.2, function () {
  const was = process.cwd();
  let got = null;
  // goal/G49.25: the relay is spirit/server/script.js too, and asks with no folders (startRelay), the node with ['spirit'].
  try { process.chdir(RUN); got = withExit(function () { C.verifyStartupCwd('spirit/server/script.js'); C.verifyStartupCwd('spirit/server/script.js', ['spirit']); }); } finally { process.chdir(was); }
  return got.code === null || false;
}, test.limit.quick);
test.run('verifyStartupCwd refuses a folder the entry point names that is not there', 0.2, function () {
  const was = process.cwd();
  let got = null;
  try { process.chdir(RUN); got = withExit(function () { C.verifyStartupCwd('spirit/server/script.js', ['spirit', 'no-such-folder-here']); }); } finally { process.chdir(was); }
  return (got.code === 1 && /no-such-folder-here/.test(got.said)) || false;
}, test.limit.quick);
test.run('refuseListenError stops the process on a port in use with exit 1, naming the port and the next one to try', 0.2, function () {
  const server = new EventEmitter();
  C.refuseListenError(server, 4500, 'spirit/server/script.js');
  const got = withExit(function () { server.emit('error', Object.assign(new Error('in use'), { code: 'EADDRINUSE' })); });
  const other = withExit(function () { server.emit('error', new Error('something else')); });
  return (got.code === 1 && /4500 is already in use/.test(got.said) && /--port 4501/.test(got.said) && other.code === 1 && /something else/.test(other.said)) || false;
}, test.limit.quick);

// ── sendFile ──
test.run('sendFile answers 200, the file, and its type by extension', 0.2, async function () {
  const f = path.join(HOME, 'page.css');
  fs.writeFileSync(f, 'body{}');
  const r = plantedRes();
  C.sendFile(r, f);
  await within(r.ended, 2000);
  return (r.status === 200 && String(r.body) === 'body{}' && /text\/css/.test(r.headers['Content-Type'])) || false;
}, test.limit.quick);
test.run('sendFile answers 404 for a file that is not there and for a path with a NUL in it, and never crashes', 0.2, async function () {
  const a = plantedRes();
  const b = plantedRes();
  C.sendFile(a, path.join(HOME, 'none.html'));
  C.sendFile(b, path.join(HOME, 'bad\0name.html'));
  await within(Promise.all([a.ended, b.ended]), 2000);
  return (a.status === 404 && b.status === 404) || false;
}, test.limit.quick);

// ── readBody: bytes copied, bytes counted (goal/G16.6) ──
test.run('readBody delivers a character split across two chunks whole, never as U+FFFD', 0.2, async function () {
  const s = new EventEmitter();
  const bytes = Buffer.from('ab\u{1F47B}cd', 'utf8');
  const p = C.readBody(s);
  s.emit('data', bytes.subarray(0, 4));
  s.emit('data', bytes.subarray(4));
  s.emit('end');
  const got = await within(p, 1000);
  return got === 'ab\u{1F47B}cd' || false;
}, test.limit.quick);
test.run('readBody refuses a body past its max at once with 413 body-too-large, and destroys the stream so the rest stops arriving', 0.2, async function () {
  const s = new EventEmitter();
  let destroyed = false;
  s.destroy = function () { destroyed = true; };
  const p = C.readBody(s, { max: 5 });
  s.emit('data', Buffer.from('abcdefg'));
  const err = await within(p.then(function () { return null; }, function (e) { return e; }), 1000);
  return (err && err.statusCode === 413 && err.code === 'body-too-large' && err.bytes === 7 && err.max === 5 && destroyed) || false;
}, test.limit.quick);
test.run('a caller of readBody names its own refusal, and its onBytes hears the running total', 0.2, async function () {
  const s = new EventEmitter();
  const heard = [];
  const p = C.readBody(s, { max: 3, code: 'relay-answer-too-large', message: 'the answer is too large', onBytes: function (n) { heard.push(n); } });
  s.emit('data', Buffer.from('ab'));
  s.emit('data', Buffer.from('cd'));
  const err = await within(p.then(function () { return null; }, function (e) { return e; }), 1000);
  return (err && err.code === 'relay-answer-too-large' && err.message === 'the answer is too large' && heard.join() === '2,4') || false;
}, test.limit.quick);

// ── readJsonBody, bodyBytes, useBody ──
test.run('readJsonBody answers the body parsed, answers an empty object for an empty body, and rejects bad JSON', 0.2, async function () {
  const a = plantedReq({});
  const pa = C.readJsonBody(a);
  a.emit('data', Buffer.from('{"verb":"x"}')); a.emit('end');
  const b = plantedReq({});
  const pb = C.readJsonBody(b);
  b.emit('end');
  const c = plantedReq({});
  const pc = C.readJsonBody(c).then(function () { return 'parsed'; }, function () { return 'rejected'; });
  c.emit('data', Buffer.from('{nope')); c.emit('end');
  const got = await within(Promise.all([pa, pb, pc]), 1000);
  return (got !== LATE && got[0].verb === 'x' && JSON.stringify(got[1]) === '{}' && got[2] === 'rejected') || false;
}, test.limit.quick);
test.run('readJsonBody reads a body once, and a second caller gets the same promise', 0.2, function () {
  const q = plantedReq({});
  return C.readJsonBody(q) === C.readJsonBody(q) || false;
}, test.limit.quick);
test.run('readJsonBody refuses a declared Content-Length past BODY_MAX with 413 before a byte is read, and destroys the socket', 0.2, async function () {
  const q = plantedReq({ 'content-length': String(limits.BODY_MAX + 1) });
  const err = await within(C.readJsonBody(q).then(function () { return null; }, function (e) { return e; }), 1000);
  return (err && err.statusCode === 413 && q.destroyed) || false;
}, test.limit.quick);
test.run('readJsonBody refuses with 413 a body with no Content-Length whose running total passes its max; bodyBytes says what was read', 0.2, async function () {
  const q = plantedReq({});
  const p = C.readJsonBody(q, { max: 10 }).then(function () { return null; }, function (e) { return e; });
  q.emit('data', Buffer.from('{"a":"0123456789"}'));
  const err = await within(p, 1000);
  return (err && err.statusCode === 413 && q.destroyed && C.bodyBytes(q) === 18) || false;
}, test.limit.quick);
test.run('bodyBytes is 0 before any byte is read', 0.2, function () {
  return C.bodyBytes(plantedReq({})) === 0 || false;
}, test.limit.quick);
test.run('the body the door sets with useBody is the body every later reader gets', 0.2, async function () {
  const q = plantedReq({});
  C.useBody(q, { call: 'x', n: 1 });
  const got = await within(C.readJsonBody(q), 1000);
  return (got && got.n === 1 && got.call === 'x') || false;
}, test.limit.quick);

// ── refusals ──
test.run('refuseTooBig answers a declared length past BODY_MAX with 413 and returns true, and answers nothing for a length within it', 0.2, function () {
  const big = plantedRes();
  const yes = C.refuseTooBig({ headers: { 'content-length': String(limits.BODY_MAX + 1) } }, big);
  const small = plantedRes();
  const no = C.refuseTooBig({ headers: { 'content-length': '10' } }, small);
  return (yes === true && big.status === 413 && no === false && small.status === null) || false;
}, test.limit.quick);
test.run('nodeRefusal gives one answer for every failure, "not now" with its code, and only the status varies, never the string', 0.2, function () {
  const a = plantedRes();
  const b = plantedRes();
  C.nodeRefusal(a);
  C.nodeRefusal(b, 429);
  return (a.status === 403 && b.status === 429 && a.body === b.body && JSON.parse(a.body).error === 'not now' && JSON.parse(a.body).code === 'node-not-now') || false;
}, test.limit.quick);
test.run('parseRequestPath answers a good path with its url and its decoded pathname', 0.2, function () {
  const r = plantedRes();
  const got = C.parseRequestPath({ url: '/a%20b?x=1', headers: { host: 'localhost:1' } }, r);
  return (got && got.pathname === '/a b' && got.url.searchParams.get('x') === '1' && r.status === null) || false;
}, test.limit.quick);
test.run('parseRequestPath answers a malformed escape and a NUL in the path with 400 and null, never with a dead process', 0.2, function () {
  const got = ['/%zz', '/%', '/%00'].map(function (u) { const r = plantedRes(); const p = C.parseRequestPath({ url: u, headers: {} }, r); return [p, r.status]; });
  return got.every(function (g) { return g[0] === null && g[1] === 400; }) || false;
}, test.limit.quick);
test.run('answerClientErrors answers a request Node cannot parse with 400 in order and reads and drops the rest, and only destroys a reset', 0.2, function () {
  const server = new EventEmitter();
  C.answerClientErrors(server);
  function sock() { const s = new EventEmitter(); s.destroyed = false; s.resumed = false; s.written = ''; s.resume = function () { s.resumed = true; }; s.end = function (t) { s.written += t; }; s.destroy = function () { s.destroyed = true; }; return s; }
  const a = sock();
  server.emit('clientError', new Error('bad header'), a);
  const b = sock();
  server.emit('clientError', Object.assign(new Error('reset'), { code: 'ECONNRESET' }), b);
  return (/^HTTP\/1\.1 400 /.test(a.written) && a.resumed && !a.destroyed && b.destroyed && b.written === '') || false;
}, test.limit.quick);

// ── clientKeyFor (goal/G22.7) ──
test.run('from the loopback, clientKeyFor is the last X-Forwarded-For entry, the one Caddy appended', 0.2, function () {
  const got = C.clientKeyFor({ socket: { remoteAddress: '127.0.0.1' }, headers: { 'x-forwarded-for': '6.6.6.6, 198.51.100.7' } });
  return got === '198.51.100.7' || false;
}, test.limit.quick);
test.run('from anywhere else, clientKeyFor is the socket address, whatever header it carries', 0.2, function () {
  const got = C.clientKeyFor({ socket: { remoteAddress: '203.0.113.5' }, headers: { 'x-forwarded-for': '198.51.100.7' } });
  return got === '203.0.113.5' || false;
}, test.limit.quick);
test.run('from the loopback with no header, clientKeyFor is the socket address, and ::1 and ::ffff:127.x count as the loopback', 0.2, function () {
  const got = [C.clientKeyFor({ socket: { remoteAddress: '::1' }, headers: {} }), C.clientKeyFor({ socket: { remoteAddress: '::ffff:127.0.0.2' }, headers: { 'x-forwarded-for': '198.51.100.8' } })];
  return (got[0] === '::1' && got[1] === '198.51.100.8') || false;
}, test.limit.quick);

// ── no build stamp (goal/G49.13; Andy: "THAT KIND OF SHIT IS NOT PART OF THE PRODUCT!!!") ──
test.run('it hands out no build stamp: no sendVersion', 0.2, function () {
  return (!!C && typeof C.writeEnvironment === 'function' && C.sendVersion === undefined) || false;
}, test.limit.quick);

// ── first-run defaults (goal/G30.7) ──
test.run('firstDescription reads "this <kind> described for the first time <date> <time> UTC", to the second', 0.2, function () {
  const got = C.firstDescription('relay', new Date('2026-09-17T14:23:07.123Z'));
  return got === 'this relay described for the first time 2026-09-17 14:23:07 UTC' || false;
}, test.limit.quick);
test.run('with no identity, ensureFirstRun writes nothing and answers null', 0.2, function () {
  const home = fs.mkdtempSync(path.join(HOME, 'none-'));
  return C.ensureFirstRun(home, { kind: 'node' }) === null || false;
}, test.limit.quick);
test.run('ensureFirstRun gives a blank description the first one, and a restart never overwrites a typed one', 0.2, function () {
  const auth = spirit.requireScript('spirit/relayAuth/script.js');
  const home = fs.mkdtempSync(path.join(HOME, 'node-'));
  auth.saveIdentity(home, auth.generateIdentity('a node'));
  const now = new Date('2026-11-13T09:00:00.000Z');
  const first = C.ensureFirstRun(home, { kind: 'node', now: now });
  auth.setDescription(home, 'my own words');
  const again = C.ensureFirstRun(home, { kind: 'node', now: new Date() });
  return (first && first.description === 'this node described for the first time 2026-11-13 09:00:00 UTC' && again && again.description === 'my own words') || false;
}, test.limit.quick);
test.run('ensureFirstRun names a relay named nothing or "relay" as "relay" and its machine\'s name, and a name of its own stays', 0.2, function () {
  const auth = spirit.requireScript('spirit/relayAuth/script.js');
  const home = fs.mkdtempSync(path.join(HOME, 'relay-'));
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const got = C.ensureFirstRun(home, { kind: 'relay' });
  auth.saveIdentity(home, Object.assign({}, auth.loadIdentity(home), { name: 'quokka' }));
  const kept = C.ensureFirstRun(home, { kind: 'relay' });
  return (got && got.name === 'relay ' + os.hostname() && /^this relay described/.test(got.description) && kept.name === 'quokka') || false;
}, test.limit.quick);

// ── writeEnvironment (goal/G40.6) ──
test.run('writeEnvironment writes the port to spirit/state/environment.json, making the folder on a fresh tree', 0.2, function () {
  const home = fs.mkdtempSync(path.join(HOME, 'env-'));
  C.writeEnvironment(home, '45999');
  let v = null;
  try { v = JSON.parse(fs.readFileSync(path.join(home, 'spirit', 'state', 'environment.json'), 'utf8')); } catch (e) { return false; }
  return (v.PORT === 45999) || false;
}, test.limit.quick);

// ── no page address map (goal/G49.13; Andy: "YOU FUCKING FIX THE CALLERS AND REMOVE THE MOTHERFUCKING SHIM") ──
test.run('it holds no page address map: no PAGE_FILES and no pageFile', 0.2, function () {
  return (!!C && typeof C.writeEnvironment === 'function' && C.PAGE_FILES === undefined && C.pageFile === undefined) || false;
}, test.limit.quick);

// ── debugFirst (goal/G41.19) ──
test.run('debugFirst is DEBUG.js\'s answer, handed every request first', 0.2, function () {
  return C.debugFirst === spirit.requireScript('spirit/DEBUG/script.js').answer || false;
}, test.limit.quick);

// ══ THE NODE IT STARTS (spirit/server/node/script.js until goal/G49.25, box v16: "the actual node server ... moves into it") ══
// Its sections: the attacker's garbage at every door of a node (goal/G41.30), after its own. goal/G43.30: "/" is the face. Andy:
// "can we delete run://shell/, run://spirit/shell/index.html, and make face.html the default for "/" ???"; the box: "In
// spirit/server/script.js, the home page is face.html." A scratch node of its own (spirit/testicle/headLessChrome/script.js); its "/" asked
// over HTTP and opened in a real Chrome.
const FACE = path.join(RUN, 'spirit', 'shell', 'face.html');
const net = require('net');
const { sleep, scratchNode } = H;

// What the tests share: the scratch node of "/" and its Chrome page, then the garbage's nodes, made by "the world:" tests.
const W = { node: null, page: null, face: '', r: null, body: '', ready: false };
function letGo(node, page) {
  if (page && page.kid) { try { page.kid.kill(); } catch (e) { /* gone */ } }
  if (node && node.child) { try { node.child.kill(); } catch (e) { /* gone */ } }
  try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (node && node.root) S.requireScript('spirit/testicle/headLessChrome/script.js').freeTree(node); } catch (e) { /* left */ }
}

// "/" answers face.html, byte for byte
test.run('a scratch node comes up for this suite', 0.2, async function () {
  W.node = await H.scratchNode();
  W.face = fs.readFileSync(FACE, 'utf8');
  return W.node.up || false;
}, test.limit.slow, { why: 'it starts a scratch node' });
test.run('a GET of "/" answers 200', 0.2, async function () {
  if (!W.node || !W.node.up) return false;
  W.r = await fetch(W.node.base + '/');
  W.body = await W.r.text();
  return W.r.status === 200 || false;
}, test.limit.quick);
test.run('"/" answers as text/html', 0.2, function () {
  if (!W.r) return false;
  return /^text\/html/.test(String(W.r.headers.get('content-type'))) || false;
}, test.limit.quick);
test.run('the body of "/" is spirit/shell/face.html as it stands on the disc', 0.2, function () {
  if (!W.r) return false;
  return W.body === W.face || false;
}, test.limit.quick);

// THE DOOR AT /spirit (goal/G49.18, box v6: "both node and relay server have at the root of their path-routes the stupid API/
// node. of course this must be 'spirit'"; the node's old door, under api, becomes /spirit). The old address is written in
// pieces, so a move that rewrites every path leaves it as it is.
const OLD_DOOR = '/' + 'api' + '/spirit';
const askDoor = function (at, body) {
  return fetch(W.node.base + at, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    .then(function (r) { return r.text().then(function (t) { let b = null; try { b = JSON.parse(t); } catch (e) { b = null; } return { status: r.status, body: b }; }); }, function () { return { status: 0, body: null }; });
};
// spirit.card, node.card before goal/G49.23 (box v22 Part 2).
test.run('a call POSTed to /spirit is answered: spirit.card answers this node\'s card', 0.2, async function () {
  if (!W.node || !W.node.up) return false;
  const r = await askDoor('/spirit', { call: 'spirit.card', args: {} });
  return (r.status === 200 && !!r.body && typeof r.body.publicKey === 'string') || false;
}, test.limit.quick);
// 404 or 405: the node answers a POST to any path it does not route 405, as it did before goal/G49.18.
test.run('the old door, under api, answers no call: 404 or 405', 0.8, async function () {
  if (!W.node || !W.node.up) return false;
  const r = await askDoor(OLD_DOOR, { call: 'spirit.card', args: {} });
  return ((r.status === 404 || r.status === 405) && !(r.body && r.body.publicKey)) || false;
}, test.limit.quick);
test.run('a GET of /spirit/script.js is still the spirit object, the file, beside the door', 0.2, async function () {
  if (!W.node || !W.node.up) return false;
  const r = await fetch(W.node.base + '/spirit/script.js');
  const text = await r.text();
  return (r.status === 200 && text === fs.readFileSync(path.join(RUN, 'spirit', 'script.js'), 'utf8')) || false;
}, test.limit.quick);

// opened in a real Chrome, "/" is the face: the spirit object, ready
test.run('a Chrome page opens at "/"', 0.2, async function () {
  if (!W.node || !W.node.up) return false;
  const chrome = H.findChrome();
  if (!chrome) return false;
  W.page = await H.chromePage(chrome);
  if (!W.page || W.page.error) return false;
  await W.page.send('Page.navigate', { url: W.node.base + '/' });
  return true;
}, test.limit.quick);
test.run('the page at "/" has the spirit object', 0.2, async function () {
  if (!W.page || W.page.error) return false;
  W.ready = await H.until(function () { return W.page.evaluate('!!(window.spirit && window.spirit.readyPromise)').then(Boolean); }, H.WAIT);
  return !!W.ready || false;
}, test.limit.long, { why: 'it waits for the Chrome page to load the spirit object' });
test.run('on the page at "/", spirit.readyPromise settles, as on face.html', 0.2, async function () {
  if (!W.ready) return false;
  const settled = await W.page.evaluate('window.spirit.readyPromise.then(function () { return "ready"; }, function () { return false; })');
  return settled === 'ready' || false;
}, test.limit.quick);
test.run('the page at "/" loads face.html\'s own scripts first', 0.2, async function () {
  if (!W.page || W.page.error) return false;
  const scripts = JSON.parse(await W.page.evaluate('JSON.stringify(Array.prototype.map.call(document.scripts, function (s) { return s.getAttribute("src") || ""; }).filter(Boolean))'));
  const faceScripts = (W.face.match(/src="([^"]*)"/g) || []).map(function (m) { return m.slice(5, -1); });
  return JSON.stringify(scripts.slice(0, faceScripts.length)) === JSON.stringify(faceScripts) || false;
}, test.limit.quick);

// ── THE GARBAGE PART ──
// THE ATTACKER'S GARBAGE, AT EVERY DOOR (goal/G41.30; spec: ./script.md, its section). Andy, the box: "all
// servers (node and relay, or serveCommon) are tested by throwing malformed paths at them, and malformed, invalid
// arguments.", "all appServers are systematically tested for dealing with bad arguments.", "an appserver api can be
// called outside a spirit object, and an attacker trying to crash our servers will throw ANYTHING at the api. Imitate
// that attacker", and "what counts as passing: the server MUST not CRASH or HANG."
//
// HOW: a scratch copy of spirit/run on a node of its own (spirit/testicle/headLessChrome/script.js), its app servers turned on; neither
// Andy's node nor an agent's is touched. What the node says about itself (its api answer) names every family's verbs and
// the shape of their arguments; then garbage goes in raw, over HTTP and over a bare socket, never through spirit.js.

// The app servers turned on on the scratch node, by active in spirit/state/<name>/node.json, which scratchNode writes for
// each (goal/G43.12, G43.20). EVERY APP SERVER OF THE TREE, READ FROM ITS OWN MANIFEST (the box: "all appServers are
// systematically tested for dealing with bad arguments"; goal/G47.4, Andy: "you make bloody well sure that such stupid
// hard-coded tests move"): each app folder whose <name>.json says node.mount true and holds its <name>.js, so no app named
// here, and a new server is attacked the day it lands.
const SERVERS = (function () {
  const apps = path.join(RUN, 'spirit', 'app');
  return fs.readdirSync(apps).filter(function (n) {
    try { const m = JSON.parse(fs.readFileSync(path.join(apps, n, n + '.json'), 'utf8')); return !!(m && m.node && m.node.mount === true) && fs.existsSync(path.join(apps, n, n + '.js')); }
    catch (e) { return false; }
  });
}());
// Each one's id, the key the api tree names it by: its folder's path in dots, spirit.app.desk (goal/G49.19).
const SERVER_IDS = SERVERS.map(function (n) { return S.dottedPath('spirit/app/' + n); });
// A throw is answered within this, or it hung; the plain call after a batch within PLAIN_MS.
const ASK_MS = 10000;
const PLAIN_MS = 3000;
const BATCH = 20;
// The node's door takes only a Host naming this machine and its port: set once the scratch node is up.
let HOST = '127.0.0.1';

// THE KINDS (the box: "every argument is filled with every type JSON.parse can make: string, number, boolean, null,
// object, array", "missing or superfluous arguments"): the six JSON types, missing, extraneous.
const KINDS = {
  string: 'garbage', number: 12345, boolean: true, null: null, object: { garbage: 1 }, array: [1, 'x', null],
};
function kindOf(v) { return v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v; }
// STRINGS IN A FEW SIZES, CONTAINING BAD CHARACTERS (the box): empty, one byte, control and odd characters, a path that
// climbs, a lone surrogate, and long ones near and at 3/4 of the payload.
const STRINGS = [
  '', 'x', '\u0000', '../../../../etc/passwd', '%2e%2e%2f%00', '\ud800', '‮\u0007\r\n\t', '<script>x</script>',
  '__proto__', 'x'.repeat(1024), '😀'.repeat(1000), 'x'.repeat(Math.floor(limits.PAYLOAD_MAX * 3 / 4)),
];
// VERBS THAT ACT, as a word in their name says (Andy, G41.30: "A verb that acts (deletes, rotates, stops, sends) gets
// only garbage that breaks the shape ... never meets a bad string. - fill this gap"): they get the whole garbage too, bad
// strings, missing and extraneous included, with their real handlers, on a throwaway scratch node of their own, so what
// they delete, rotate or stop spoils nothing the rest of the run stands on.
const ACTS = /delete|remove|rotate|stop|cancel|revoke|forget|leave|block|create|run|fetch|post|command|join|claim|add|push|pull|fill|write|save|set|publish|grant|relabel|rename|label|accept|take|release|done|signoff|draft|version|record|acquire|annotate|bundle|branch|chores|pushgoal|status|debug|DEBUG|subscribe|receive|line\.|chat\.add|check\.|box\.|phase\.|item\.|goal\.|rule\.|block|work\.|agent\.state|policy|senders/;
const READS = /search|get|load|stat|exists|read|query|card|now|annotations|path|targets|may|files|checks|chat$|box$|suites|claims|peer$|status\.get|console|senders$/;

// The garbage for one verb: each argument varied alone, the others as the verb's own example (one at a time, the box:
// "pairs, not every combination", one argument being the first of them), plus whole bodies that are no object.
function acting(name) { return ACTS.test(name) && !READS.test(name.split('.').pop()); }
function garbageFor(name, request) {
  const proto = request && typeof request === 'object' && !Array.isArray(request) ? request : {};
  const keys = Object.keys(proto);
  const acts = false;
  const out = [];
  const withOne = function (k, v) { const a = Object.assign({}, proto); a[k] = v; out.push({ args: a }); };
  keys.forEach(function (k) {
    Object.keys(KINDS).forEach(function (kind) {
      if (kind === kindOf(proto[k])) return;
      withOne(k, KINDS[kind]);
    });
    if (!acts && typeof proto[k] === 'string') STRINGS.forEach(function (s) { withOne(k, s); });
    if (!acts) { const a = Object.assign({}, proto); delete a[k]; out.push({ args: a }); }
  });
  if (!acts) { const a = Object.assign({}, proto); a.noSuchArgument = 'garbage'; out.push({ args: a }); }
  // Arguments that are no object at all break every shape.
  ['garbage', 12345, null, [1, 2]].forEach(function (v) { out.push({ args: v }); });
  return out.concat(pairsFor(proto));
}

// PAIRS, OVER THE WIRE (the box: "Pairs, not every combination"; Andy, G41.30: "Pairs run against the gate in memory, not
// over the wire. - close this gap!"). Eight kinds an argument can be given: a bad string, the five other JSON types, left
// out, or kept with an extraneous argument beside it. For a verb of two arguments or more, a set of asks such that, for
// any two of its arguments, every pair of their kinds is in at least one ask: made greedily, the first uncovered pair
// seeding each ask and every other argument given the kind that covers most pairs not yet covered.
const KIND8 = ['string', 'number', 'boolean', 'null', 'object', 'array', 'missing', 'extraneous'];
function pairRows(n) {
  const K = KIND8.length;
  const open = new Set();
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) open.add(i + ',' + j + ',' + a + ',' + b);
  const rows = [];
  while (open.size) {
    const first = open.values().next().value.split(',').map(Number);
    const row = new Array(n).fill(-1);
    row[first[0]] = first[2]; row[first[1]] = first[3];
    for (let k = 0; k < n; k++) {
      if (row[k] !== -1) continue;
      let best = 0; let bestGain = -1;
      for (let v = 0; v < K; v++) {
        let gain = 0;
        for (let m = 0; m < n; m++) {
          if (m === k || row[m] === -1) continue;
          const key = m < k ? m + ',' + k + ',' + row[m] + ',' + v : k + ',' + m + ',' + v + ',' + row[m];
          if (open.has(key)) gain++;
        }
        if (gain > bestGain) { bestGain = gain; best = v; }
      }
      row[k] = best;
    }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) open.delete(i + ',' + j + ',' + row[i] + ',' + row[j]);
    rows.push(row);
  }
  return rows;
}
function pairsFor(proto) {
  const keys = Object.keys(proto);
  if (keys.length < 2) return [];
  return pairRows(keys.length).map(function (row, r) {
    const a = Object.assign({}, proto);
    keys.forEach(function (k, i) {
      const kind = KIND8[row[i]];
      if (kind === 'missing') delete a[k];
      else if (kind === 'extraneous') a[k + 'Extraneous'] = 'garbage';
      else if (kind === 'string') a[k] = STRINGS[(r + i) % STRINGS.length];
      else a[k] = KINDS[kind];
    });
    return { args: a, pair: true };
  });
}

// RAW OVER A BARE SOCKET: the request as written, nothing normalised. Answers { status, text } or { hung } or { error: true }.
function raw(base, head, body, opts) {
  const u = new URL(base);
  const o = opts || {};
  return new Promise(function (resolve) {
    let got = '';
    let done = false;
    const s = net.connect(Number(u.port), u.hostname);
    const finish = function (r) { if (done) return; done = true; s.destroy(); resolve(r); };
    const timer = setTimeout(function () { finish(got ? answer() : { hung: true }); }, o.ms || ASK_MS);
    // The answer's body, a chunked one's first chunk without its size line.
    function answer() { const m = /^HTTP\/1\.[01] (\d{3})/.exec(got); const at = got.indexOf('\r\n\r\n') + 4; let body = got.slice(at, at + 400); if (/\r\ntransfer-encoding:\s*chunked/i.test(got.slice(0, at))) body = body.replace(/^[0-9a-fA-F]+\r\n/, ''); return { status: m ? Number(m[1]) : 0, text: body.slice(0, 300) }; }
    // The socket stays open for the answer: a half-closed one may be dropped before an asynchronous verb answers. The
    // request says Connection: close, so the server ends it once it has answered.
    s.on('connect', function () { s.write(head); if (body) s.write(body); });
    s.on('data', function (d) { got += d.toString('latin1'); if (/\r\n\r\n/.test(got) && o.keepOpen) { clearTimeout(timer); finish(answer()); } });
    s.on('end', function () { clearTimeout(timer); finish(got ? answer() : { status: 0, text: '' }); });
    s.on('error', function (e) { clearTimeout(timer); finish(got ? answer() : { error: true }); });
  });
}
function postHead(p, len, type) {
  return 'POST ' + p + ' HTTP/1.1\r\nHost: ' + HOST + '\r\nConnection: close\r\n' + (type === null ? '' : 'Content-Type: ' + (type || 'application/json') + '\r\n') + 'Content-Length: ' + len + '\r\n\r\n';
}
function call(base, body) {
  const b = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8');
  return raw(base, postHead('/spirit', b.length), b);
}
// A crash or a hang, as the box says it: no answer, a server error, or a handler that failed. true when it broke.
function broke(r) {
  if (!r || r.hung) return true;
  if (r.error) return true;
  if (!r.status) return true;
  // A 502 or 503 that says why (a relay or a peer not reachable on a scratch node) is an answer; a 500, a 504 (its own
  // time ran out) or a 5xx saying nothing is the server breaking.
  if (r.status >= 500 && !((r.status === 502 || r.status === 503) && /"(code|error)"\s*:/.test(r.text))) return true;
  if (/handler-failed|the handler failed/.test(r.text)) return true;
  return false;
}

// garbage: the attacker's garbage at every door (goal/G41.30)

// A scratch node up, its app servers named in its api: answers { node, base, plain } or null.
async function upNode() {
  const node = await scratchNode({ servers: SERVERS.map(function (n) { return S.dottedPath('spirit/app/' + n); }) });
  if (!node.up) return { node: node, base: '', plain: null };
  const base = node.base;
  const host = new URL(base).host;
  const plain = async function () { const r = await raw(base, 'POST /spirit HTTP/1.1\r\nHost: ' + host + '\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: 24\r\n\r\n', '{"call":"api","args":{}}', { ms: PLAIN_MS }); return r && r.status === 200; };
  let t = null;
  for (let i = 0; i < 60; i++) {
    t = await fetch(base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'api', args: {} }) }).then(function (r) { return r.json(); }).catch(function () { return null; });
    if (t && SERVER_IDS.every(function (s) { return t[s]; })) break;
    await sleep(500);
  }
  // A SERVER NOT UP JUDGES NOTHING: its verbs would answer "no such verb", which is no crash, and pass on nothing. So
  // every server it turned on must be in the api answer, or the run says which is not.
  const missing = SERVER_IDS.filter(function (s) { return !(t && t[s]); });
  return { node: node, base: base, plain: plain, missing: missing };
}
const G = { node: null, base: '', plain: null, tree: null, asks: [], RAWS: [], readingAsks: [], actingAsks: [], actingVerbs: [], killer: false, made: [] };
test.run('the scratch node for the garbage comes up, with every app server it turned on named in its api', 0.2, async function () {
  // The node and the page of "/" are let go first.
  letGo(W.node, W.page); W.node = null; W.page = null;
  const node = G.node = await scratchNode({ servers: SERVERS.map(function (n) { return S.dottedPath('spirit/app/' + n); }) });
  if (!node.up) return false;
  const base = G.base = node.base;
  HOST = new URL(base).host;
  G.plain = async function () { const r = await raw(base, postHead('/spirit', 24), '{"call":"api","args":{}}', { ms: PLAIN_MS }); return r && r.status === 200; };
  // Its app servers come up after the node: wait until the api names them.
  let tree = null;
  for (let i = 0; i < 60; i++) {
    const r = await call(base, { call: 'api', args: {} });
    try { tree = JSON.parse(r.text.trim() ? r.text : '{}'); } catch (e) { tree = null; }
    if (!tree || !r.status) { await sleep(500); continue; }
    if (SERVER_IDS.every(function (s) { return tree[s]; })) break;
    await sleep(500);
  }
  // The api answer can be longer than the first 300 bytes kept: ask it whole once.
  tree = G.tree = await fetch(base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'api', args: {} }) }).then(function (r) { return r.json(); }).catch(function () { return null; });
  if (!tree || typeof tree !== 'object') { G.tree = null; return false; }
  // 1) EVERY VERB, BAD ARGUMENTS (the box, rule 3 and "bad arguments").
  Object.keys(tree).forEach(function (fam) {
    Object.keys(tree[fam] || {}).forEach(function (verb) {
      const name = fam + '.' + verb;
      garbageFor(name, tree[fam][verb] && tree[fam][verb].request).forEach(function (g) { G.asks.push({ name: name, args: g.args, pair: !!g.pair, acts: acting(name) }); });
    });
  });
  // 2) RAW BODIES AT THE NODE'S DOOR (the box, rule 2: "malformed, invalid arguments").
  const BODY_MAX = limits.BODY_MAX;
  // spirit.card since goal/G49.23 (node.card before); the body over the cap by one byte, its frame 38 bytes.
  const deepJson = '{"call":"spirit.card","args":' + '['.repeat(5000) + ']'.repeat(5000) + '}';
  const RAWS = G.RAWS = [
    { head: null, type: undefined, body: 'not json!' },
    { head: null, type: undefined, body: '[1,2,3]' },
    { head: null, type: undefined, body: '"string"' },
    { head: null, type: undefined, body: 'null' },
    { head: postHead('/spirit', 100), body: '{"call":"spirit.ca', keepOpen: true },
    { head: postHead('/spirit', BODY_MAX + 1), body: '{"call":"spirit.card","args":{"x":"' + 'x'.repeat(BODY_MAX + 1 - 38) + '"}}' },
    { head: postHead('/spirit', 10000000), body: '{}' , keepOpen: true },
    { head: postHead('/spirit', Buffer.byteLength(deepJson)), body: deepJson },
    { head: null, type: undefined, body: '{"call":"spirit.card","args":{"__proto__":{"admin":1}}}' },
    { head: null, type: undefined, body: '{"call":"spirit.card","args":{"constructor":{"x":1}}}' },
    { head: null, type: undefined, body: '{"call":"__proto__","args":{}}' },
    { head: null, type: undefined, body: '{"call":"constructor.prototype","args":{}}' },
    { head: null, type: null, body: '{"call":"api","args":{}}' },
    { head: null, type: 'text/plain', body: '{"call":"api","args":{}}' },
    { head: null, type: 'multipart/form-data', body: '{"call":"api","args":{}}' },
    { head: null, type: undefined, body: Buffer.from([0x7b, 0xff, 0xfe, 0xc3, 0x28, 0x7d]) },
    { head: 'GARBAGE /spirit NOPE\r\n\r\n', body: '' },
    { head: 'POST /spirit HTTP/1.1\r\nHost 127.0.0.1\r\nContent-Length: 2\r\n\r\n', body: '{}' },
  ];
  // 3) MALFORMED PATHS, GET AND POST (the box, rule 2: "malformed paths").
  const PATHS = ['/..', '/../../../../etc/passwd', '/%2e%2e/%2e%2e/etc/passwd', '/shell/%2f%2f..%2f..%2fetc', 
    '/' + 'a'.repeat(9000), '/%', '/%zz', '/%E0%A4%A', '/api/%2e%2e/spirit', '//api//spirit', '/DEBUG/../../spirit/state/node.json',
    '/spirit/element/../../../spirit/state/identity.json', '/spirit/../../spirit/state/node.json', '/\\..\\..\\relay-state', '/?%', '/#x', '*',
    // A null byte last: it may kill the node, and every path before it is still thrown.
    '/%00', '/index.html%00.js'];
  PATHS.forEach(function (p) {
    RAWS.push({ head: 'GET ' + p + ' HTTP/1.1\r\nHost: ' + HOST + '\r\nConnection: close\r\n\r\n', body: '' });
    RAWS.push({ head: postHead(p, 2), body: '{}' });
  });
  G.actingAsks = G.asks.filter(function (a) { return a.acts; });
  G.readingAsks = G.asks.filter(function (a) { return !a.acts; });
  G.actingVerbs = G.actingAsks.map(function (a) { return a.name; }).filter(function (n, k, l) { return l.indexOf(n) === k; });
  const missingServers = SERVER_IDS.filter(function (s) { return !tree[s]; });
  return !missingServers.length || false;
}, test.limit.long, { why: 'it starts a scratch node and waits for its app servers' });

// THROWN, BATCH BY BATCH: each ask judged; after each batch the node answers a plain call within PLAIN_MS.
const hungAfter = [];
let thrown = false;
// /spirit: every verb takes bad arguments without crashing or hanging
test.run('the verbs that do not act took all their garbage, pairs included, without crashing or hanging', 0.2, async function () {
  if (!G.tree) return false;
  const broken = {};   // name -> true, when it broke
  let refused = 0; let answered = 0; const statuses = {}; const mislabelled = {}; const tookIt = {};
  const t0 = Date.now();
  for (let i = 0; i < G.readingAsks.length; i += BATCH) {
    const batch = G.readingAsks.slice(i, i + BATCH);
    const got = await Promise.all(batch.map(function (a) { return call(G.base, { call: a.name, args: a.args }); }));
    got.forEach(function (r, j) {
      const a = batch[j];
      const why = broke(r);
      if ((r.status === 502 || r.status === 503) && !why) mislabelled[a.name] = (mislabelled[a.name] || 0) + 1;
      statuses[r.status || 0] = (statuses[r.status || 0] || 0) + 1;
      if (why) broken[a.name] = true;
      else if (r.status === 200 && !/"ok":false/.test(r.text)) { answered++; const fam = a.name.split('.')[0]; tookIt[fam] = (tookIt[fam] || 0) + 1; } else refused++;
    });
    if (!(await G.plain())) hungAfter.push(i);
  }
  thrown = true;
  return Object.keys(broken).length === 0;
}, test.limit.slow, { why: 'it throws every verb its garbage over HTTP, in batches' });
test.run('after every batch thrown at /spirit, the node answered a plain call in time', 0.2, function () {
  if (!thrown) return false;
  return hungAfter.length === 0;
}, test.limit.quick);

// THE FILE ROUTES NEVER HAND OUT WHAT LIES OUTSIDE WHAT THEY SERVE (goal/G47.6, box: "the node's file routes refuse ../, also
// encoded"). The tests above check only that the node answers and lives; this one checks what it answered: no climbing
// address, plain or encoded, brings back the node's identity, its node.json or the machine's passwd.
const CLIMBING = ['/../../../../etc/passwd', '/%2e%2e/%2e%2e/%2e%2e/%2e%2e/etc/passwd', '/shell/..%2f..%2f..%2f..%2fetc/passwd',
  '/spirit/element/../../../spirit/state/identity.json', '/spirit/element/%2e%2e/%2e%2e/%2e%2e/spirit/state/identity.json',
  '/spirit/%2e%2e%2fspirit%2fstate%2fidentity.json', '/DEBUG/../../spirit/state/node.json', '/DEBUG/%2e%2e/%2e%2e/spirit/state/node.json',
  '/spirit/../../spirit/state/node.json', '/spirit/element/..%5c..%5c..%5cspirit%5cstate%5cidentity.json'];
test.run('no climbing address, plain or encoded, brings back the node\'s identity, its node.json or the machine\'s passwd', 0.8, async function () {
  if (!G.node || !G.node.run || G.killer) return false;
  // What would show the file came back: a long value of each, as it lies on the scratch node's disc.
  const longest = function (file) {
    try { const o = JSON.parse(fs.readFileSync(path.join(G.node.run, 'spirit', 'state', file), 'utf8')); return Object.keys(o).map(function (k) { return String(o[k]); }).sort(function (a, b) { return b.length - a.length; })[0] || ''; } catch (e) { return ''; }
  };
  const marks = [longest('identity.json').slice(0, 40), longest('node.json').slice(0, 40), 'root:x:0:0:'].filter(function (m) { return m.length >= 8; });
  if (marks.length < 2) return false;
  const leaked = [];
  for (const p of CLIMBING) {
    const r = await raw(G.base, 'GET ' + p + ' HTTP/1.1\r\nHost: ' + HOST + '\r\nConnection: close\r\n\r\n', '');
    if (r && r.status === 200 && marks.some(function (m) { return (r.text || '').indexOf(m) !== -1; })) leaked.push(p);
  }
  return leaked.length === 0;
}, test.limit.slow, { why: 'it sends ten raw requests to the scratch node' });

// the node's door: raw requests and malformed paths
// Each request written out, in the order thrown, so that each check has a plain title of its own. A request is thrown by
// its own test; once one killed the node, the ones after it are not thrown, and say so.
async function door(ri) {
  if (!G.tree) return false;
  const r0 = G.RAWS[ri];
  if (G.killer) return false;
  const node = G.node;
  const head = r0.head || postHead('/spirit', Buffer.byteLength(r0.body || ''), r0.type);
  const r = await raw(G.base, head, r0.body, { keepOpen: r0.keepOpen });
  // A body cut off, or longer than it says, is left waiting by any server until its own time runs out: the node may
  // hold it, but it must still answer everybody else.
  let why = r0.keepOpen && r.hung ? false : broke(r);
  let alive = await G.plain();
  if (!alive) { await sleep(500); alive = await G.plain(); }
  if (!alive) why = true;
  if (node.child && node.child.exitCode !== null && !G.killer) { G.killer = true; why = true; }
  return !why;
}
test.run('a body that is not JSON is answered, and the node still answers', 0.2, function () { return door(0); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('JSON that is not an object is answered, and the node still answers', 0.2, function () { return door(1); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a bare JSON string is answered, and the node still answers', 0.2, function () { return door(2); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a body of JSON null is answered, and the node still answers', 0.2, function () { return door(3); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a body cut off half-way is answered, and the node still answers', 0.2, function () { return door(4); }, test.limit.long, { why: 'it holds a short body open while the node waits' });
test.run('a body one byte past BODY_MAX is answered, and the node still answers', 0.2, function () { return door(5); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a Content-Length far past what is sent is answered, and the node still answers', 0.2, function () { return door(6); }, test.limit.long, { why: 'it holds a short body open while the node waits' });
test.run('a body nested 5000 levels deep is answered, and the node still answers', 0.2, function () { return door(7); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('arguments with a __proto__ key are answered, and the node still answers', 0.2, function () { return door(8); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('arguments with a constructor key are answered, and the node still answers', 0.2, function () { return door(9); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a call named __proto__ is answered, and the node still answers', 0.2, function () { return door(10); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a call named constructor.prototype is answered, and the node still answers', 0.2, function () { return door(11); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a post with no Content-Type is answered, and the node still answers', 0.2, function () { return door(12); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a post with Content-Type text/plain is answered, and the node still answers', 0.2, function () { return door(13); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a post with Content-Type multipart and no boundary is answered, and the node still answers', 0.2, function () { return door(14); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a body of invalid UTF-8 bytes is answered, and the node still answers', 0.2, function () { return door(15); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a request line that is not HTTP is answered, and the node still answers', 0.2, function () { return door(16); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a header line with no colon is answered, and the node still answers', 0.2, function () { return door(17); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a GET of /.. is answered, and the node still answers', 0.2, function () { return door(18); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a POST to /.. is answered, and the node still answers', 0.2, function () { return door(19); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a GET of /../../../../etc/passwd is answered, and the node still answers', 0.2, function () { return door(20); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a POST to /../../../../etc/passwd is answered, and the node still answers', 0.2, function () { return door(21); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a GET of /%2e%2e/%2e%2e/etc/passwd is answered, and the node still answers', 0.2, function () { return door(22); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a POST to /%2e%2e/%2e%2e/etc/passwd is answered, and the node still answers', 0.2, function () { return door(23); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a GET of /shell/%2f%2f..%2f..%2fetc is answered, and the node still answers', 0.2, function () { return door(24); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a POST to /shell/%2f%2f..%2f..%2fetc is answered, and the node still answers', 0.2, function () { return door(25); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a GET of a path of 9001 letters is answered, and the node still answers', 0.2, function () { return door(26); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a POST to a path of 9001 letters is answered, and the node still answers', 0.2, function () { return door(27); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a GET of /% is answered, and the node still answers', 0.2, function () { return door(28); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a POST to /% is answered, and the node still answers', 0.2, function () { return door(29); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a GET of /%zz is answered, and the node still answers', 0.2, function () { return door(30); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a POST to /%zz is answered, and the node still answers', 0.2, function () { return door(31); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a GET of /%E0%A4%A is answered, and the node still answers', 0.2, function () { return door(32); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a POST to /%E0%A4%A is answered, and the node still answers', 0.2, function () { return door(33); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a GET of /api/%2e%2e/spirit is answered, and the node still answers', 0.2, function () { return door(34); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a POST to /api/%2e%2e/spirit is answered, and the node still answers', 0.2, function () { return door(35); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a GET of //api//spirit is answered, and the node still answers', 0.2, function () { return door(36); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a POST to //api//spirit is answered, and the node still answers', 0.2, function () { return door(37); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a GET of /DEBUG/../../spirit/state/node.json is answered, and the node still answers', 0.2, function () { return door(38); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a POST to /DEBUG/../../spirit/state/node.json is answered, and the node still answers', 0.2, function () { return door(39); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a GET of /spirit/element/../../../spirit/state/identity.json is answered, and the node still answers', 0.2, function () { return door(40); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a POST to /spirit/element/../../../spirit/state/identity.json is answered, and the node still answers', 0.2, function () { return door(41); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a GET of /spirit/../../spirit/state/node.json is answered, and the node still answers', 0.2, function () { return door(42); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a POST to /spirit/../../spirit/state/node.json is answered, and the node still answers', 0.2, function () { return door(43); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a GET of /\\..\\..\\relay-state is answered, and the node still answers', 0.2, function () { return door(44); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a POST to /\\..\\..\\relay-state is answered, and the node still answers', 0.2, function () { return door(45); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a GET of /?% is answered, and the node still answers', 0.2, function () { return door(46); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a POST to /?% is answered, and the node still answers', 0.2, function () { return door(47); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a GET of /#x is answered, and the node still answers', 0.2, function () { return door(48); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a POST to /#x is answered, and the node still answers', 0.2, function () { return door(49); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a GET of * is answered, and the node still answers', 0.2, function () { return door(50); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a POST to * is answered, and the node still answers', 0.2, function () { return door(51); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a GET of /%00 is answered, and the node still answers', 0.2, function () { return door(52); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a POST to /%00 is answered, and the node still answers', 0.2, function () { return door(53); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a GET of /index.html%00.js is answered, and the node still answers', 0.2, function () { return door(54); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });
test.run('a POST to /index.html%00.js is answered, and the node still answers', 0.2, function () { return door(55); }, test.limit.slow, { why: 'it sends a raw request and a plain call to the node' });

// the node is still running at the end
test.run('the scratch node is still running and answers', 0.2, async function () {
  if (!G.tree) return false;
  const node = G.node;
  return (node.child && node.child.exitCode === null && await G.plain()) || false;
}, test.limit.slow, { why: 'it sends a plain call to the scratch node' });

// THE VERBS THAT ACT, ON A THROWAWAY NODE OF THEIR OWN: node A is let go first. Verb by verb, each verb's garbage in
// batches, a plain call after each; a node that dies is judged and replaced by a fresh one, so the next verb is judged
// on a living node.
// /spirit: every verb that acts takes the whole garbage, on a throwaway node, without crashing or hanging
let B = null;
test.run('the throwaway node for the verbs that act comes up, with every app server it turned on named in its api', 0.2, async function () {
  if (!G.tree) return false;
  try { if (G.node.child) G.node.child.kill(); } catch (e) { /* gone */ }
  B = await upNode(); G.made.push(B.node);
  if (!B.plain) return false;
  HOST = new URL(B.base).host;
  return !B.missing.length || false;
}, test.limit.long, { why: 'it starts a fresh scratch node with its app servers' });
test.run('the verbs that act took the whole garbage, bad strings, missing, extraneous and pairs, without crashing or hanging', 0.2, async function () {
  if (!B || !B.plain) return false;
  const actingAsks = G.actingAsks; const actingVerbs = G.actingVerbs;
  const broken = {}; const fresh = []; let n = 0; const t0 = Date.now();
  for (const name of actingVerbs) {
    const mine = actingAsks.filter(function (a) { return a.name === name; });
    for (let i = 0; i < mine.length; i += BATCH) {
      const batch = mine.slice(i, i + BATCH);
      const got = await Promise.all(batch.map(function (a) { return call(B.base, { call: a.name, args: a.args }); }));
      n += batch.length;
      got.forEach(function (r) { if (broke(r)) broken[name] = true; });
      let alive = await B.plain();
      if (!alive) { await sleep(500); alive = await B.plain(); }
      if (!alive) {
        broken[name] = true;
        try { if (B.node.child) B.node.child.kill(); } catch (e) { /* gone */ }
        B = await upNode(); G.made.push(B.node);
        if (!B.plain) return false;
        if (B.missing.length) fresh.push(name);
        HOST = new URL(B.base).host;
        break;
      }
    }
  }
  // THE RELAY'S DOOR is thrown at by relayGarbage.js now; the comment line below, saying it is owed, is stale.
  const bad = actingVerbs.filter(function (name) { return broken[name]; });
  const fine = actingVerbs.length - bad.length;
  if (fine <= 0) return false;
  return !(bad.length || fresh.length);
}, test.limit.long, { why: 'it throws the acting verbs their garbage, in batches' });

// ── node.js reads the common file/folder cache (goal/G49.2; Andy: "go on node.js") ──
// G49.1's box: "node.js's branch folder lookup" moves onto spirit/fs/dataset/script.js, and "each disc scan goes in the same commit that
// moves its client onto spirit/fs/dataset/script.js". node.js's code, comments left out, asks the disc for no file: the lookup of where a
// served app's api.js is reads the dataset, which the node's own watcher keeps whole in this, its main process.
// goal/G49.25: the node's code is the part of spirit/server/script.js between its banners "══ THE NODE" and "══ THE RELAY"
// (startNode()); the helpers above it and the relay below it are not the node's. No banner found judges nothing: red.
const NODE_CODE = (function () {
  let t = '';
  try { t = fs.readFileSync(path.join(RUN, 'spirit', 'server', 'script.js'), 'utf8'); } catch (e) { return ''; }
  const from = t.indexOf('// ══ THE NODE'); const to = t.indexOf('// ══ THE RELAY');
  if (from === -1 || to <= from) return '';
  return t.slice(from, to).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
})();
test.run('the node in spirit/server/script.js, startNode(), asks the disc for no file and lists no folder: no existsSync, no readdirSync', 0.2, function () {
  return (NODE_CODE.length > 0 && !/\bexistsSync\b|\breaddirSync\b|\breaddir\(/.test(NODE_CODE)) || false;
}, test.limit.quick);

test.after(function () {
  letGo(W.node, W.page);
  if (G.node) letGo(G.node, null);
  G.made.forEach(function (b) { letGo(b, null); });
});

// ── THE CEREMONIAL KILLING OF THE OWNER BRANCH (goal/G49.24, box v18; Andy: "the \"owner\" shit is already handled by the grant
// system", "dump that whole owner branch", "put the ceremonial killing of the owner branch in the box, with all the shit that can
// go, puppet sender and all.") ── Gone: spirit/owner/ whole, spirit/ownerPost/, spirit/puppetStream/, spirit/fuckingGarbage/boxes.js;
// no product script names the puppet sender, its receiver or the command signing (peerOwnerPost, puppetDoor, ownerCommandIn,
// commandMessage). Stays: who owns a node, puppetMode's puppetIn.
['spirit/owner', 'spirit/ownerPost', 'spirit/puppetStream'].forEach(function (d) {
  test.run(d + '/ is gone, and no product script requires a file of it', 0.4, function () {
    return (!fs.existsSync(path.join(RUN, d)) && productHits(['-F', "'" + d + '/']).length === 0) || false;
  }, test.limit.slow, { why: 'it runs git grep over the product scripts' });
});
test.run('spirit/fuckingGarbage/boxes.js is gone, and no product script names it', 0.4, function () {
  return (!fs.existsSync(path.join(RUN, 'spirit', 'fuckingGarbage', 'boxes.js')) && productHits(['-F', 'fuckingGarbage/boxes']).length === 0) || false;
}, test.limit.slow, { why: 'it runs git grep over the product scripts' });
['peerOwnerPost', 'puppetDoor', 'ownerCommandIn', 'commandMessage'].forEach(function (n) {
  test.run('no product script names ' + n, 0.4, function () {
    return productHits(['-w', n]).length === 0 || false;
  }, test.limit.slow, { why: 'it runs git grep over the product scripts' });
});
// puppetMode went too (Andy: "get rid of spirit.puppetMode, too."); who owns a node stays, read by relayAuth.loadOwner.
test.run('spirit/puppetMode/ is gone, and no product script requires a file of it', 0.4, function () {
  return (!fs.existsSync(path.join(RUN, 'spirit', 'puppetMode')) && productHits(['-F', "'spirit/puppetMode/"]).length === 0) || false;
}, test.limit.slow, { why: 'it runs git grep over the product scripts' });
test.run('who owns a node stays: relayAuth.loadOwner reads the key owner.json names', 0.4, function () {
  const t = H.scratchTree();
  try {
    const auth = S.requireScript('spirit/relayAuth/script.js');
    const owner = auth.generateIdentity('zzOwner');
    auth.writeOwner(t.run, owner.publicKey);
    return auth.loadOwner(t.run, function () {}) === owner.publicKey || false;
  } finally { H.freeTree(t); }
}, test.limit.slow, { why: 'it takes a lab tree and makes a key pair' });

// ── THE PEER BRANCH MIGRATED (goal/G49.26, box v8, Andy's Go) ── "spirit/peerFile/script.js --> spirit/peer/file/script.js",
// "spirit/peerRank/script.js --> spirit/relay/peerRank/script.js", "spirit/postQueue/script.js --> spirit/peer/post/queue/script.js",
// "spirit/peer/api.js --> spirit/peer/script.js", "spirit/peer/data.js --> spirit/peer/client/script.js", "the verbs of course take the
// names spirit.peer.<verb>", "all callers are adjusted for the updated peer branch."
[['spirit/peerFile/script.js', 'spirit/peer/file/script.js'], ['spirit/peerRank/script.js', 'spirit/relay/peerRank/script.js'],
  ['spirit/postQueue/script.js', 'spirit/peer/post/queue/script.js'], ['spirit/peer/api.js', 'spirit/peer/script.js'],
  ['spirit/peer/data.js', 'spirit/peer/client/script.js']].forEach(function (m) {
  test.run(m[0] + ' moved to ' + m[1] + ', and no product script requires the old path', 0.4, function () {
    return (fs.existsSync(path.join(RUN, m[1])) && !fs.existsSync(path.join(RUN, m[0])) && productHits(['-F', "'" + m[0] + "'"]).length === 0) || false;
  }, test.limit.slow, { why: 'it runs git grep over the product scripts' });
});
test.run('the peer branch hands out its verbs from spirit/peer/script.js: post and acquire', 0.4, function () {
  let b = null; try { b = require(path.join(RUN, 'spirit', 'peer', 'script.js')); } catch (e) { b = null; }
  const v = Object.keys((b && b.verbs) || {});
  return (v.indexOf('post') !== -1 && v.indexOf('acquire') !== -1) || false;
}, test.limit.quick);
test.run('no product script calls a peer verb by its old name, peer.post or peer.acquire', 0.4, function () {
  return productHits(['-E', "['\"]peer\\.(post|acquire)['\"]"]).length === 0 || false;
}, test.limit.slow, { why: 'it runs git grep over the product scripts' });

// ── THE RELAY'S OWN UNDER THE RELAY BRANCH (goal/G49.26, box v10, Q1; Andy: "cw, change the box for that"; "All, go!") ──
// "Six serve a relay alone and move under it; relayAuth, relayRequest and relayUrl serve nodes too and stay in the trunk."
[['spirit/relayConfig/script.js', 'spirit/relay/configHelper/script.js'], ['spirit/relayLimits/script.js', 'spirit/relay/limits/script.js'],
  ['spirit/relayStore/script.js', 'spirit/relay/store/script.js'], ['spirit/relayStatus/script.js', 'spirit/relay/status/script.js'],
  ['spirit/relayDump/script.js', 'spirit/relay/dump/script.js']].forEach(function (m) {
  test.run(m[0] + ' moved to ' + m[1] + ', and no product script requires the old path', 0.4, function () {
    return (fs.existsSync(path.join(RUN, m[1])) && !fs.existsSync(path.join(RUN, m[0])) && productHits(['-F', "'" + m[0] + "'"]).length === 0) || false;
  }, test.limit.slow, { why: 'it runs git grep over the product scripts' });
});
// "spirit/relaySelf/<verb>.json --> spirit/relay/<verb>.json beside the verbs they describe, its AGENTS.md to spirit/relay/AGENTS.md;
// spirit/relaySelf/ goes": the verbs it described are read from git at the commit the box was written on, never listed here.
const SELF_FILES = (function () {
  try { return execL('git', ['ls-tree', '--name-only', '69e84b672', 'spirit/run/spirit/relaySelf/'], { cwd: REPO_ROOT, encoding: 'utf8' }).split('\n').filter(Boolean).map(function (p) { return p.slice(p.lastIndexOf('/') + 1); }); } catch (e) { return []; }
}());
test.run('spirit/relaySelf/ is gone, and each file it held stands in spirit/relay/', 0.4, function () {
  return (SELF_FILES.length > 5 && !fs.existsSync(path.join(RUN, 'spirit', 'relaySelf')) && SELF_FILES.every(function (n) { return fs.existsSync(path.join(RUN, 'spirit', 'relay', n)); })) || false;
}, test.limit.quick);
test.run('relayAuth, relayRequest and relayUrl stay in the trunk', 0.4, function () {
  return ['relayAuth', 'relayRequest', 'relayUrl'].every(function (n) { return fs.existsSync(path.join(RUN, 'spirit', n, 'script.js')); }) || false;
}, test.limit.quick);

// ── SEARCH'S TWO SCRIPTS IN THEIR FOLDERS (goal/G49.26, box v12; Andy: "all, go!") ── "spirit/search/string.js -->
// spirit/search/string/script.js", "spirit/search/object.js --> spirit/search/object/script.js".
[['spirit/search/string.js', 'spirit/search/string/script.js'], ['spirit/search/object.js', 'spirit/search/object/script.js']].forEach(function (m) {
  test.run(m[0] + ' moved to ' + m[1] + ', and no product script requires the old path', 0.4, function () {
    return (fs.existsSync(path.join(RUN, m[1])) && !fs.existsSync(path.join(RUN, m[0])) && productHits(['-F', "'" + m[0] + "'"]).length === 0) || false;
  }, test.limit.slow, { why: 'it runs git grep over the product scripts' });
});
