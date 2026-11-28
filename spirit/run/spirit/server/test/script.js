'use strict';

// spirit/run/spirit/server/test/script.js
// The tests of spirit/server/script.js, the launcher, in this one file (spec: ./script.md; goal/G48.5). The node's own tests, once
// here, are spirit/server/node/test/script.js (the box: "spirit/server/test/script.js becomes the launcher's test; the node's goes to
// spirit/server/node/test/script.js, so the two histories are not mixed").

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const S = require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/test/testReport.js');
const H = S.requireScript('spirit/test/headLessChrome.js');

// ── THE LAUNCHER (goal/G48.5, the box, "completeness, asserted": "spirit/server/script.js starts a node with no mode and with
// --node, a relay with --relay, a server process with --app <script>; an unknown mode is refused; every argument after the
// mode reaches the module unchanged; a refused relay exits 78", "no tracked file names an old path", "no file stands at an
// old path"). Each start in a lab tree of its own (spirit/test/headLessChrome.js scratchTree), stopped and let go after.
const { spawn: spawnL, execFileSync: execL } = require('child_process');
const L = { trees: [], kids: [] };
function labTree() {
  const t = H.scratchTree();
  L.trees.push(t);
  // The node's home inside the tree, as spirit/test/headLessChrome.js's startNode makes it.
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
}, test.limit.long);
test.run('the launcher, spirit/server/script.js, with --node and --port, starts a node on that port', 0.4, async function () {
  return (await nodeComesUp(['--node'])) || false;
}, test.limit.long);
test.run('the launcher refuses a mode it does not know: it exits, with a code that is not 0, and serves nothing', 0.8, async function () {
  const t = labTree();
  const port = await H.freePort();
  const r = launch(t.run, ['--zzNoSuchMode', '--port', String(port)]);
  await H.until(function () { return Promise.resolve(r.code !== null); }, 15000);
  const served = await answers(port);
  await done(t, r);
  return (r.code !== null && r.code !== 0 && !served) || false;
}, test.limit.slow);
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
}, test.limit.slow);
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
}, test.limit.slow);
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
}, test.limit.slow);
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
}, test.limit.slow);
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
}, test.limit.long);
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
}, test.limit.slow);
test.run('no owner-verb list: no product script names OWNER_VERBS; the signature says who the owner is, the grants what each may call', 0.4, function () {
  return productHits(['-w', 'OWNER_VERBS']).length === 0 || false;
}, test.limit.slow);
// Box v20: "its five face routes (allowed, call, file, stream, api): no route of its own stays, its files aside"; "the face
// allowed question stays a plain address, GET /face/allowed?domain=<name>, since Caddy can ask nothing else".
test.run('one door for the faces too: no product script serves or calls /face/call, /face/file, /face/stream or /face/api', 0.4, function () {
  return productHits(['-E', "['\"`]/face/(call|file|stream|api)\\b"]).length === 0 || false;
}, test.limit.slow);
test.run('the server still answers Caddy at GET /face/allowed', 0.4, function () {
  return serverCode().indexOf("'/face/allowed'") !== -1 || false;
}, test.limit.quick);
// "The member verbs (card, face, removePeer, rename, search, and post, reply, stream, face answer, face stream) sit in one bundle";
// "the relay's member verbs and owner verbs lists, and the gate that reads them" go.
// Its verbs, by name (box v24, Q13, Andy: "yes"): "for members post, reply and stream; the home node's uploads, named in a header,
// faceAnswer and faceFeed; a face's browser faceCall, faceFile, faceEvents (its live stream), faceState, faceLogin and faceLogout;
// and its own, as today's signed packet, card, claim, face, search, rename, removePeer, invite, revoke, config, debug, monitor,
// relayLabel and api." The names are his decision, so they are written here; the branch hands out these and no other.
const RELAY_VERBS = ['post', 'reply', 'stream', 'faceAnswer', 'faceFeed', 'faceCall', 'faceEvents', 'faceState', 'faceLogin', 'faceLogout',
  'card', 'claim', 'face', 'search', 'rename', 'removePeer', 'invite', 'revoke', 'config', 'debug', 'monitor', 'relayLabel', 'api'];
test.run('the relay branch hands out exactly the 23 verbs of the box (Q13; faceFile gone, Andy: "if nothing uses it, faceFile goes."): post, reply, stream, faceAnswer, faceFeed, faceCall, faceEvents, faceState, faceLogin, faceLogout, card, claim, face, search, rename, removePeer, invite, revoke, config, debug, monitor, relayLabel and api', 0.4, function () {
  let b = null; try { b = require(path.join(RUN, 'spirit', 'relay', 'script.js')); } catch (e) { b = null; }
  const v = Object.keys((b && b.verbs) || {}).sort();
  return (v.length === RELAY_VERBS.length && RELAY_VERBS.slice().sort().every(function (n, i) { return v[i] === n; })) || false;
}, test.limit.quick);
test.run('no member-verb list: no product script names MEMBER_VERBS', 0.4, function () {
  return productHits(['-w', 'MEMBER_VERBS']).length === 0 || false;
}, test.limit.slow);
// THE PRESENCE MOVES (Andy, G49.25: "move ... spirit.presenceNode to spirit.contact.nodePresence"; "so presence belongs in
// relay.presence ?", answered yes; "cw, box it like that."): each stands at its new path, nothing at its old one, and no product
// script requires the old path.
[['spirit/presence/script.js', 'spirit/relay/presence/script.js'], ['spirit/presenceNode/script.js', 'spirit/contact/nodePresence/script.js']].forEach(function (m) {
  test.run(m[0] + ' moved to ' + m[1] + ', and nothing requires the old path', 0.4, function () {
    return (fs.existsSync(path.join(RUN, m[1])) && !fs.existsSync(path.join(RUN, m[0])) && productHits(['-F', "'" + m[0] + "'"]).length === 0) || false;
  }, test.limit.slow);
});
