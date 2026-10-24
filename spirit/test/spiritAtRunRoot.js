'use strict';

// spirit/test/spiritAtRunRoot.js
// goal/G40.1: spirit.js moves to spirit/run/, the one spirit object every script installs first. Written first, red on
// today's code, by wsl-claude, who does not build it. The box (v17), Andy's words among it: "fill the box with everything
// this encompasses"; "make sure spirit.js has the basic, static support functions, AND the dynamic loading of
// components, implemented for both face- and node-environments"; "the loaders name should be spirit.require()"; "can the
// key not simply be a second argument in spirit.require(), by default it's null (owner node) otherwise it's a peer ID?";
// "kernel can keep its MIME table, that will go when kernel goes."; "we don't show the fucking tail anywhere anymore."
//
// WHAT IS ASSERTED
//   1. The move: spirit/run/spirit.js is there, spirit/run/face/spirit.js is gone, no tracked file in run/ or test/ names
//      the old path, and the new file is core (coreFiles.isCore).
//   2. Its loaders: serveCommon.inlineSpirit inlines the run root's spirit.js; face.html's mark comes before any other
//      script; index.html loads /spirit.js. On a node of its own (rule/11): /spirit.js is 200, /face/spirit.js 404.
//   3. In node, requiring spirit.js installs the global spirit, with the helpers, the families' loaders and, under the
//      kernel's names, the job calls, the node's constants and version, the MIME types and peerPost; spirit.require
//      loads a component by its run-root path.
//   4. On a face (a spirit made on a transport): spirit.require loads a component through the link and binds an
//      interface by its path as spirit.<name>; with a key, it asks that peer over the home node's peer.post.
//   5. Every script on the box's list installs spirit in its first statement, from the run root, and holds no local
//      spiritObject; none of the app-server scripts the box names requires kernel.js or takes appServer.spirit.
//   6. Removed: imageStats/ and wordpressScanner/, and every keyTail in run/ and test/; hub's contact rows carry no tail.
//   Owed with its reason (AWAITING): how node's global spirit finds its own node for an interface or a peer, which the
//   box does not name.

const fs = require('fs');
const os = require('os');
const net = require('net');
const http = require('http');
const path = require('path');
const { spawn, spawnSync, execSync } = require('child_process');
const test = require('./testSupport.js');
const { setupRelayFakes } = require('./setupRelayFakes');

const OWED = 'OWED by goal/G40.1: ';
const REPO = path.join(__dirname, '..', '..');
const RUN = path.join(__dirname, '..', 'run');
const NEW = path.join(RUN, 'spirit.js');
// Spelled in two parts, so this suite does not name the old path itself.
const OLD_REL = 'face/' + 'spirit.js';
const TAIL = 'key' + 'Tail';
// Not code: this suite itself, and the desk's shared copy of the current goal, which quotes the box as written.
const RECORDS = ['spirit/test/spiritAtRunRoot.js', 'spirit/run/process/js/desk/currentGoal.json'];
const PEER = 'MCowBQYDK2VwAyEAspiritAtRunRootPeerKeyXXXXXXXXXXXXXXXXXXXX/+=';
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 220); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function src(rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return null; } }
function tracked(dir) { return execSync('git ls-files -- ' + dir, { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean); }

// The scripts the box lists as loading spirit.js, and those of them that leave the kernel (box v17).
const LOADERS = ['js/appServer.js', 'process/js/chatClerver/chatClerver.js', 'process/js/desk/desk.js', 'process/js/desk/commitCheck.js',
  'process/js/desk/deskAgentEar.js', 'process/js/desk/removeAgent.js', 'process/js/deskAgent/deskAgent.js', 'process/js/deskClient/deskClient.js',
  'process/js/deskClient/publishData.js', 'process/js/fileServer/fileServer.js', 'process/js/relayLimits/relayLimits.js'];
const OFF_KERNEL = ['js/appServer.js', 'js/introSpector.js', 'process/js/chatClerver/chatClerver.js', 'process/js/desk/desk.js',
  'process/js/deskAgent/deskAgent.js', 'process/js/deskClient/deskClient.js', 'process/js/deskVerify/deskVerify.js', 'process/js/fileServer/fileServer.js'];

// A script's first statement, past 'use strict', comments and blank lines.
function firstStatement(text) {
  const body = String(text).replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(function (l) { return l.replace(/^\s*\/\/.*$/, '').trim(); }).filter(Boolean);
  const rest = body[0] === "'use strict';" || body[0] === '"use strict";' ? body.slice(1) : body;
  return rest[0] || '';
}
// Run a few lines in a node of their own (the global spirit must not leak into this suite); the answer is its last line.
function inNode(code) {
  const r = spawnSync(process.execPath, ['-e', code], { cwd: RUN, encoding: 'utf8', timeout: 20000 });
  const line = String(r.stdout || '').trim().split('\n').pop() || '';
  try { return JSON.parse(line); } catch (e) { return { failed: (String(r.stderr || '').trim().split('\n').slice(-2).join(' | ') || line).slice(0, 300) }; }
}
function freePort() {
  return new Promise(function (resolve, reject) {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', function () { const p = probe.address().port; probe.close(function () { resolve(p); }); });
  });
}
function get(port, p) {
  return new Promise(function (resolve) {
    http.get({ hostname: '127.0.0.1', port: port, path: p }, function (res) { res.resume(); resolve(res.statusCode); })
      .on('error', function () { resolve(0); });
  });
}

test.startTest('goal/G40.1: spirit.js at the run root, the one spirit object every script installs first');

(async function () {
  // ── 1. THE MOVE ──────────────────────────────────────────────────────
  test.subHeading('1. spirit.js at the run root, the old path gone, and core');
  const there = fs.existsSync(NEW);
  const gone = !fs.existsSync(path.join(RUN, 'face', 'spirit.js'));
  if (there && gone) test.check('spirit/run/spirit.js is there, spirit/run/face/spirit.js is gone');
  else test.fail(OWED + 'spirit/run/spirit.js ' + (there ? 'is there' : 'is missing') + ', the old file ' + (gone ? 'is gone' : 'is still there'));
  const naming = tracked('spirit/run spirit/test').filter(function (rel) {
    if (RECORDS.indexOf(rel) !== -1 || /\.(png|jpg|ico|svg|db|woff2?)$/.test(rel)) return false;
    let text = '';
    try { text = fs.readFileSync(path.join(REPO, rel), 'utf8'); } catch (e) { return false; }
    return text.indexOf(OLD_REL) !== -1;
  });
  if (!naming.length) test.check('no tracked file in run/ or test/ names the old path');
  else test.fail(OWED + naming.length + ' tracked files still name the old path: ' + short(naming.slice(0, 8)));
  let core = null;
  try { core = require('../run/js/coreFiles.js').isCore('spirit/run/spirit.js', REPO); } catch (e) { core = 'threw ' + e.message; }
  if (core === true) test.check('spirit/run/spirit.js is core');
  else test.fail(OWED + 'coreFiles.isCore(spirit/run/spirit.js) answered ' + short(core));

  // ── 2. ITS LOADERS ───────────────────────────────────────────────────
  test.subHeading('2. face.html carries it inline first; index.html and the static route follow it');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-atrunroot-'));
  try {
    fs.writeFileSync(path.join(scratch, 'spirit.js'), '/* the run root spirit */');
    const out = require('../run/js/serveCommon.js').inlineSpirit('<head><!-- spirit.js --></head>', scratch);
    if (/the run root spirit/.test(out)) test.check('serveCommon.inlineSpirit inlines the run root\'s spirit.js');
    else test.fail(OWED + 'inlineSpirit with a spirit.js at the run root gave ' + short(out));
  } catch (e) { test.fail(OWED + 'inlineSpirit threw ' + e.message); }
  finally { try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ } }
  const face = src('face.html') || '';
  const mark = face.indexOf('<!-- spirit.js -->');
  const script = face.search(/<script\b/i);
  if (mark !== -1 && (script === -1 || mark < script)) test.check('face.html marks spirit.js before any other script');
  else test.fail(OWED + 'face.html: the spirit.js mark at ' + mark + ', the first script at ' + script);
  const index = src('index.html') || '';
  if (/<script[^>]*src="\/spirit\.js"/.test(index) && index.indexOf(OLD_REL) === -1) test.check('index.html loads /spirit.js');
  else test.fail(OWED + 'index.html loads ' + short((index.match(/<script[^>]*spirit\.js[^>]*>/g) || []).join(' ')));

  const home = setupRelayFakes('spiritAtRunRoot').andy;
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(home, 'relay-state', 'relays.json'), JSON.stringify([{ label: 'nowhere', url: 'https://127.0.0.1:1' }]), 'utf8');
  // The fakes keep files from earlier runs; a file the move took away must not be served from an old copy.
  if (!fs.existsSync(NEW)) { try { fs.rmSync(path.join(home, 'spirit.js'), { force: true }); } catch (e) { /* none */ } }
  if (fs.existsSync(NEW)) { try { fs.rmSync(path.join(home, 'face', 'spirit.js'), { force: true }); } catch (e) { /* none */ } }
  const port = await freePort();
  let said = '';
  const child = spawn(process.execPath, ['js/server.js', '--port', String(port)], { cwd: home, stdio: ['ignore', 'ignore', 'pipe'] });
  child.stderr.on('data', function (c) { said = (said + c).slice(-4096); });
  try {
    let up = 0;
    for (let i = 0; i < 70 && up !== 200; i++) { await sleep(150); up = await get(port, '/'); }
    if (up !== 200) throw new Error('the node did not boot on ' + port);
    const at = await get(port, '/spirit.js');
    const old = await get(port, '/' + OLD_REL);
    if (at === 200 && old === 404) test.check('the node serves /spirit.js (200), and the old path answers 404');
    else test.fail(OWED + '/spirit.js answered ' + at + ', the old path ' + old);
  } catch (e) {
    test.fail(e.message + ': ' + said.trim().split('\n').slice(-6).join(' | '));
  } finally { child.kill(); }

  // ── 3. IN NODE ───────────────────────────────────────────────────────
  test.subHeading('3. in node, requiring spirit.js installs the global spirit');
  const g = inNode("require('./spirit.js'); const s = global.spirit; const k = require('./js/kernel.js');" +
    "console.log(JSON.stringify({ type: typeof s," +
    " helpers: !!s && ['error', 'formatBytes', 'escapeHtml', 'check'].every(function (n) { return typeof s[n] === 'function'; })," +
    " loaders: !!s && typeof s.createSpirit === 'function' && typeof s.forNode === 'function' && typeof s.forPeer === 'function'," +
    " jobs: !!s && !!s.core && !!s.core.jobs && ['publish', 'start', 'progress', 'end'].filter(function (n) { return typeof s.core.jobs[n] !== 'function'; })," +
    " consts: !!s && !!s.core && !!s.core.node && !!s.core.node.const && s.core.node.const.SPIRIT_PORT === k.core.node.const.SPIRIT_PORT," +
    " version: !!s && !!s.core && !!s.core.const && s.core.const.VERSION === k.core.const.VERSION," +
    " mime: !!s && !!s.core && !!s.core.const && !!s.core.const.MIME_TYPES && s.core.const.MIME_TYPES['.js'] === k.core.const.MIME_TYPES['.js']," +
    " peerPost: !!s && typeof s.peerPost === 'function', require: !!s && typeof s.require === 'function' }));");
  if (g.type === 'object') test.check('the global spirit is there after require(\'./spirit.js\')');
  else test.fail(OWED + 'after require(\'./spirit.js\') the global spirit is ' + short(g.failed || g.type));
  if (g.helpers && g.loaders) test.check('it carries the static helpers and the families\' loaders (createSpirit, forNode, forPeer)');
  else test.fail(OWED + 'helpers ' + g.helpers + ', loaders ' + g.loaders);
  if (Array.isArray(g.jobs) && !g.jobs.length && g.consts && g.version && g.mime && g.peerPost)
    test.check('under the kernel\'s names: core.jobs publish/start/progress/end, core.node.const, core.const.VERSION and MIME_TYPES, peerPost');
  else test.fail(OWED + 'the kernel\'s members on spirit: jobs missing ' + short(g.jobs) + ', node.const ' + g.consts + ', VERSION ' + g.version + ', MIME_TYPES ' + g.mime + ', peerPost ' + g.peerPost);
  const comp = inNode("require('./spirit.js'); Promise.resolve(global.spirit && typeof global.spirit.require === 'function' ? global.spirit.require('js/limits.js') : null)" +
    ".then(function (m) { console.log(JSON.stringify({ ok: !!m && m.BODY_MAX === require('./js/limits.js').BODY_MAX })); }," +
    " function (e) { console.log(JSON.stringify({ failed: String(e && e.message || e) })); });");
  if (comp.ok === true) test.check('spirit.require(\'js/limits.js\') loads the component by its run-root path');
  else test.fail(OWED + 'spirit.require(\'js/limits.js\') in node gave ' + short(comp));

  // ── 4. ON A FACE ─────────────────────────────────────────────────────
  test.subHeading('4. on a face, spirit.require loads a component, an interface by its path, and a peer\'s family');
  let S = null;
  try { S = require(fs.existsSync(NEW) ? NEW : path.join(RUN, 'face', 'spirit.js')); } catch (e) { S = null; }
  const asked = [];
  const deskApi = src('process/js/desk/desk.family/api.js') || 'module.exports = { verbs: {} };';
  const transport = {
    ask: function (verb, args) {
      asked.push({ verb: verb, args: args });
      if (verb === 'api' && args && args.family === 'desk') return Promise.resolve({ status: 200, body: { family: 'desk', interface: deskApi } });
      if (verb === 'api') return Promise.resolve({ status: 200, body: {} });
      if (verb === 'peer.post') return Promise.resolve({ status: 200, body: { family: 'desk', interface: deskApi } });
      return Promise.resolve({ status: 404, body: null });
    },
    file: function (p) {
      const text = p === 'shell/js/sample.js' ? 'module.exports = { answer: 42 };' : '';
      return Promise.resolve({ status: text ? 200 : 404, type: 'application/javascript', bytes: new Uint8Array(Buffer.from(text, 'utf8')) });
    },
  };
  let s = null;
  try { s = S && typeof S.createSpirit === 'function' ? await S.createSpirit(transport) : null; } catch (e) { s = null; }
  if (!s || typeof s.require !== 'function') {
    test.fail(OWED + 'a spirit made on a transport has no require (' + (s ? typeof s.require : 'no spirit') + ')');
  } else {
    const c = await Promise.resolve(s.require('shell/js/sample.js')).then(function (m) { return m; }, function (e) { return { threw: e.message }; });
    if (c && c.answer === 42) test.check('a component comes through the link and runs: spirit.require(\'shell/js/sample.js\').answer is 42');
    else test.fail(OWED + 'spirit.require of a component on a face gave ' + short(c));
    await Promise.resolve(s.require('process/js/desk/desk.family/api.js')).catch(function () {});
    if (s.desk && typeof s.desk['item.get'] === 'function') test.check('spirit.require(\'process/js/desk/desk.family/api.js\') binds spirit.desk');
    else test.fail(OWED + 'after spirit.require of the desk interface, spirit.desk is ' + short(s.desk ? Object.keys(s.desk).slice(0, 6) : s.desk));
    asked.length = 0;
    const p = await Promise.resolve(s.require('process/js/desk/desk.family/api.js', PEER)).then(function (m) { return m; }, function (e) { return { threw: e.message }; });
    const viaPeer = asked.some(function (a) { return a.verb === 'peer.post' && JSON.stringify(a.args || {}).indexOf(PEER) !== -1; });
    const bound = !!p && (typeof p['item.get'] === 'function' || (p.desk && typeof p.desk['item.get'] === 'function'));
    if (viaPeer && bound) test.check('with a key, the family is asked of that peer over the home node\'s peer.post, and bound');
    else test.fail(OWED + 'spirit.require with a key: peer.post asked ' + viaPeer + ', bound ' + bound + ' (' + short(p && (p.threw || Object.keys(p).slice(0, 6))) + ')');
  }

  // ── 5. EVERY SCRIPT THAT DEPENDS ON IT ───────────────────────────────
  test.subHeading('5. each script installs spirit first, from the run root, and keeps no local copy or kernel');
  const notFirst = [];
  const local = [];
  LOADERS.forEach(function (rel) {
    const text = src(rel);
    if (text === null) { notFirst.push(rel + ' (missing)'); return; }
    const first = firstStatement(text);
    const m = /^require\(\s*['"]([^'"]+)['"]\s*\)\s*;?$/.exec(first);
    const resolved = m ? path.resolve(path.dirname(path.join(RUN, rel)), m[1]) : '';
    if (resolved !== NEW) notFirst.push(rel + ': ' + first.slice(0, 70));
    if (/\bspiritObject\b/.test(text)) local.push(rel);
  });
  if (!notFirst.length) test.check('all ' + LOADERS.length + ' scripts make require of the run root\'s spirit.js their first statement');
  else test.fail(OWED + notFirst.length + ' of ' + LOADERS.length + ' do not: ' + short(notFirst.slice(0, 4)));
  if (!local.length) test.check('none holds a local spiritObject');
  else test.fail(OWED + local.length + ' still hold a local spiritObject: ' + short(local));
  const kernelled = OFF_KERNEL.filter(function (rel) {
    const text = src(rel) || '';
    return /require\(\s*['"][^'"]*kernel(\.js)?['"]\s*\)/.test(text) || /appServer\.spirit\b/.test(text);
  });
  if (!kernelled.length) test.check('none of the ' + OFF_KERNEL.length + ' app-server scripts requires kernel.js or takes appServer.spirit');
  else test.fail(OWED + kernelled.length + ' still reach the kernel: ' + short(kernelled));

  // ── 6. REMOVED ───────────────────────────────────────────────────────
  test.subHeading('6. the two scripts and every key tail are gone');
  const left = ['process/js/imageStats', 'process/js/wordpressScanner'].filter(function (d) { return fs.existsSync(path.join(RUN, d)); });
  if (!left.length) test.check('process/js/imageStats/ and process/js/wordpressScanner/ are gone');
  else test.fail(OWED + 'still in the tree: ' + short(left));
  const tails = tracked('spirit/run spirit/test').filter(function (rel) {
    if (RECORDS.indexOf(rel) !== -1 || /\.(png|jpg|ico|svg|db|woff2?)$/.test(rel)) return false;
    let text = '';
    try { text = fs.readFileSync(path.join(REPO, rel), 'utf8'); } catch (e) { return false; }
    return text.indexOf(TAIL) !== -1;
  });
  if (!tails.length) test.check('no tracked file in run/ or test/ names ' + TAIL);
  else test.fail(OWED + tails.length + ' tracked files still name ' + TAIL + ': ' + short(tails.slice(0, 8)));
  if (!/\btail:\s/.test(src('js/hub.js') || '')) test.check('hub\'s contact rows carry no tail field');
  else test.fail(OWED + 'js/hub.js still sends a tail field');

  // ── OWED, WITH ITS REASON ────────────────────────────────────────────
  test.awaiting('goal/G40.1', 'node\'s global spirit binds an interface and a peer\'s family', false,
    'the box asks spirit.require of an interface and of a peer by key in node too, but does not say how node\'s global spirit finds its own node (forNode with a url, or the port its node hands it); the builder names it under the item, and the assertion is written then');
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the suite threw ' + e.message); test.reportSuccessFailureCount(); process.exit(0); });
