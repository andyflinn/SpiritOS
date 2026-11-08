'use strict';

// spirit/run/spirit/test/appServer-mount.js
// The tests of the node starting a server from spirit/app/<name>/ (spec: ./appServer-mount.md; goal/G43.12). Andy: "JUST loading
// functional server and associating the <name> as "familiy" name, in the new namespace". A real node on a scratch copy of the
// tracked files gets throwaway apps planted in that copy (probe, quiet, always), nothing kept in the repo (Andy, Q10: "then write
// the test"); the tree's own server app (agent, node.mount true) is not what it judges. The old
// process/js servers are asked on the same node. Neither Andy's node nor an agent's is touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..');
const REPO = path.resolve(RUN, '..', '..');
// Up here, before the first result: under the verifier testReport.js loads spirit.js for its records with the global
// put aside, and a server module required after that finds no global spirit.
const { familyPath } = require(path.join(RUN, 'spirit', 'spirit.js'));
const { answer } = require(path.join(RUN, 'spirit', 'apiDoor.js'));
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { freePort, until, sleep, chromePage, findChrome } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
const POSIX = process.platform !== 'win32';

const NAME = 'probe';
const MODULE = 'spirit.app.' + NAME;
const NOTE = 'what the app folder holds';
const INTERFACE = '// the interface at the top of the app folder';
// The old folder's name, as the one family path function gives it: the decoy below, and no path of this file's own.
const OLD_FOLDER = path.basename(path.dirname(familyPath(NAME)));

// THE THROWAWAY APP, written as the box describes one: one file, a split for the page and the node, its family at its top (goal/G43.27), its data.js
// beside it, and a <name>.json without the old kind and operated. Its family/ is a decoy: only process/js has one.
function plantApp(run, name, mount, intrinsic) {
  const dir = path.join(run, 'spirit', 'app', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, OLD_FOLDER), { recursive: true });
  fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify({ identity: Object.assign({ icon: '🧪', label: name }, intrinsic === undefined ? {} : { intrinsic: intrinsic }), mount: { [name + '.js']: true }, shell: { true: false, mount: false, tile: false }, node: { mount: mount } }));
  fs.writeFileSync(path.join(dir, name + '.js'), [
    "'use strict';",
    "if (typeof window !== 'undefined') { window.__appOnPage = '" + name + "'; } else {",
    "  require('../../../spirit.js');",
    "  const fs = require('fs'), path = require('path');",
    "  const STATE = process.argv[process.argv.indexOf('--state') + 1];",
    "  fs.mkdirSync(STATE, { recursive: true });",
    "  fs.writeFileSync(path.join(STATE, 'started.txt'), String(process.pid));",
    "  require('../../appServer.js').serve({ ping: { request: {}, reply: {}, handler: function () { return { pid: process.pid, state: STATE }; } } }, {});",
    '}',
  ].join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'helper.js'), "require('fs').writeFileSync(process.argv[2], 'ran');\n");
  fs.writeFileSync(path.join(dir, 'api.js'), INTERFACE + '\nmodule.exports = { verbs: { ping: {} } };\n');
  fs.writeFileSync(path.join(dir, 'note.txt'), NOTE);
  fs.writeFileSync(path.join(dir, OLD_FOLDER, 'api.js'), '// the decoy\nmodule.exports = { verbs: { decoy: {} } };\n');
  fs.writeFileSync(path.join(dir, OLD_FOLDER, 'note.txt'), 'the decoy');
  fs.writeFileSync(path.join(dir, 'data.js'), [
    '(function () {',
    "  var D = typeof window !== 'undefined' ? window.spirit.data : require('../../data.js');",
    "  D.makeFamily('" + name + "');",
    "  (typeof window !== 'undefined' ? window : global).__appData = '" + name + "';",
    '}());',
  ].join('\n') + '\n');
}
function scratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-app-mount-'));
  execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); })
    .forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
  const run = path.join(root, 'spirit', 'run');
  plantApp(run, NAME, true);
  plantApp(run, 'quiet', false);
  // goal/G43.14: a server app the development team made intrinsic.
  plantApp(run, 'always', true, true);
  // A follower of a sender's stream, with its cache on: what it kept comes back at its start only if the sender's family has a
  // data.js on this node (appServer.js, familyApi), and its translator says so by a file. Named by its own script, as a server is.
  const follow = path.join(run, 'spirit', 'app', NAME);
  fs.writeFileSync(path.join(follow, 'followerRows.js'), [
    "const D = require('../../data.js');",
    "D.addTranslator({ onJob: function (job) { if (job && job.app) require('fs').writeFileSync(process.env.ROW_SEEN, JSON.stringify(job.app)); } });",
  ].join('\n') + '\n');
  fs.writeFileSync(path.join(follow, 'follower.js'), [
    "require('../../../spirit.js');",
    "const path = require('path');",
    "require('../../appServer.js').serve({}, { stream: { translator: path.join(__dirname, 'followerRows.js'), cache: true, module: 'a.test' } });",
  ].join('\n') + '\n');
  // The old way of a server that runs at home: its sidecar (Andy: "process/js servers start and run as they do now" is the box's).
  const old = path.join(run, 'relay-state', 'process', 'chatClerver');
  fs.mkdirSync(old, { recursive: true });
  fs.writeFileSync(path.join(old, 'chatClerver.js.sidecar.json'), JSON.stringify({ face: { home: true } }));
  return { root: root, run: run };
}
async function call(base, verb, args) {
  try {
    const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
    const text = await r.text();
    return { status: r.status, text: text, body: parsed(text) };
  } catch (e) { return { status: 0, text: String(e && e.message), body: null }; }
}
async function boot(run) {
  const port = await freePort();
  const child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: run, stdio: 'ignore' });
  const base = 'http://127.0.0.1:' + port;
  const up = await until(function () { return call(base, 'api').then(function (r) { return r.status === 200; }); }, 60000);
  return { child: child, base: base, up: !!up };
}
function stop(c) { return new Promise(function (r) { if (!c || c.exitCode !== null) return r(); c.once('exit', function () { r(); }); c.kill(); setTimeout(r, 6000); }); }
function alive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return false; } }
// Every job the node holds, as jobs.get answers it.
async function jobsOf(base) {
  const found = await call(base, 'jobs.search', { q: '' });
  const items = (found.body && found.body.items) || [];
  const rows = await Promise.all(items.map(function (i) { return call(base, 'jobs.get', { key: i.key }); }));
  return rows.map(function (r) { return r.body && r.body.job; }).filter(Boolean);
}
async function liveJob(base, module) {
  return (await jobsOf(base)).filter(function (j) { return j.kind === 'server' && j.module === module && (j.status === 'running' || j.status === 'pending'); })[0] || null;
}
async function rowOf(base, name) {
  const r = await call(base, 'app.search', { q: '' });
  const item = ((r.body && r.body.items) || []).filter(function (i) { return i.key === name; })[0];
  return item ? parsed(item.label) : null;
}
function pingOf(base, name) { return call(base, (name || NAME) + '.ping', {}); }
function answers(r) { return r.status === 200 && !!r.body && Number(r.body.pid) > 0; }
function upAgain(base) { return until(function () { return pingOf(base).then(answers); }, 30000); }

test.startTest('appServerMount: the node starts a server from spirit/app/<name>/ (goal/G43.12)');

(async function () {
  const live = [];
  let chrome = null;
  const s = scratch();
  try {
    const state = function () { return path.join(s.run, 'spirit', 'state', NAME); };
    const nodeJson = function () { return readJson(path.join(state(), 'node.json')); };
    const started = path.join(state(), 'data', 'started.txt');
    let N = await boot(s.run); live.push(N.child);
    ok(N.up, 'the world: a scratch node comes up', 'the scratch node did not come up');
    if (!N.up) return;
    ok(!!(await rowOf(N.base, NAME)), 'the world: the throwaway app is a row of the app family', 'no row for the throwaway app');

    test.subHeading('the goal box: "An app server cannot be booted until a user activates it."');
    await sleep(1500);
    ok(!(await liveJob(N.base, MODULE)), 'not active: no server job', 'a server job ran before it was activated');
    ok(!fs.existsSync(started), 'not active: the script did not run', 'the script ran before it was activated');
    ok(!answers(await pingOf(N.base)), 'not active: its verb is not answered', 'its verb answered before it was activated');

    test.subHeading('goal/G43.14, the box: "intrinsic true: the app is always active. It runs at boot with no Activate, and app.active does not switch it off."');
    ok(await until(function () { return pingOf(N.base, 'always').then(answers); }, 30000), 'an intrinsic server runs from the boot, with nothing pressed', 'always.ping: ' + short((await pingOf(N.base, 'always')).text));
    ok(!readJson(path.join(s.run, 'spirit', 'state', 'always', 'node.json')), 'and nothing was written to its node.json', 'its node.json: ' + short(readJson(path.join(s.run, 'spirit', 'state', 'always', 'node.json'))));
    const alwaysPid = Number(((await pingOf(N.base, 'always')).body || {}).pid);
    await call(N.base, 'app.active', { key: 'always', active: false });
    await sleep(3000);
    ok(answers(await pingOf(N.base, 'always')) && alive(alwaysPid), 'app.active false does not stop it', 'after app.active false: ' + short((await pingOf(N.base, 'always')).text));

    test.subHeading('the box: "only scripts in this node\'s own process/js or spirit/app/<name>/ may start, and nothing else", "A spirit/app script starts only if it is active"');
    const ranHelper = path.join(s.root, 'helper-ran.txt');
    const startIt = function (script, arg) { return call(N.base, 'jobs.create', { command: 'node', args: [script].concat(arg ? [arg] : []), type: 'the red' }); };
    const refused = function (r) { return r.status >= 400 && !!r.body && r.body.ok === false; };
    const inactive = await startIt('spirit/app/' + NAME + '/helper.js', ranHelper);
    await sleep(1500);
    ok(refused(inactive) && !fs.existsSync(ranHelper), 'a helper of an app nobody activated is refused, and does not run', 'jobs.create on an inactive app: ' + short(inactive.text) + ', ran: ' + fs.existsSync(ranHelper));
    const inactiveMain = await startIt('spirit/app/' + NAME + '/' + NAME + '.js');
    await sleep(1500);
    ok(refused(inactiveMain) && !fs.existsSync(started), 'its server script is refused too, and does not run', 'jobs.create on an inactive server: ' + short(inactiveMain.text) + ', ran: ' + fs.existsSync(started));
    // Outside the two places: a script of the shell, a file at the top of spirit/app, the same path in another tree, and a way out by dots.
    const ranElsewhere = path.join(s.root, 'elsewhere-ran.txt');
    const elsewhere = path.join(s.root, 'other', 'spirit', 'app', NAME, NAME + '.js');
    fs.mkdirSync(path.dirname(elsewhere), { recursive: true });
    fs.writeFileSync(elsewhere, "require('fs').writeFileSync(" + JSON.stringify(ranElsewhere) + ", 'ran');\n");
    fs.writeFileSync(path.join(s.run, 'shell', 'planted.js'), "require('fs').writeFileSync(" + JSON.stringify(ranElsewhere) + ", 'ran');\n");
    fs.writeFileSync(path.join(s.run, 'spirit', 'app', 'planted.js'), "require('fs').writeFileSync(" + JSON.stringify(ranElsewhere) + ", 'ran');\n");
    const outside = {
      'a script of the shell': 'shell/planted.js',
      'a file at the top of spirit/app': 'spirit/app/planted.js',
      'the same path in another tree': elsewhere,
      'a way out of an app\'s folder': 'spirit/app/' + NAME + '/../../../shell/planted.js',
    };
    for (const what of Object.keys(outside)) {
      const r = await startIt(outside[what]);
      await sleep(1000);
      ok(refused(r) && !fs.existsSync(ranElsewhere), what + ' is refused, and does not run', what + ': ' + short(r.text) + ', ran: ' + fs.existsSync(ranElsewhere));
    }

    test.subHeading('the box: "It starts one only if its <name>.json says node.mount true and spirit/state/<name>/node.json says active true"');
    const quietOn = await call(N.base, 'app.active', { key: 'quiet', active: true });
    ok(quietOn.status === 200, 'the world: an app with node.mount false is activated', 'app.active on quiet: ' + short(quietOn.text));
    await sleep(3000);
    ok(!(await liveJob(N.base, 'spirit.app.quiet')), 'active with node.mount false: no server job', 'a server job for an app with node.mount false');
    ok(!answers(await pingOf(N.base, 'quiet')), 'and its verb is not answered', 'an app with node.mount false answered its verb');

    test.subHeading('the box: "process/js servers start and run as they do now."');
    const fileServer = await liveJob(N.base, 'process/js/fileServer');
    ok(!!fileServer, 'the intrinsic fileServer runs, under its old module id', 'no job for process/js/fileServer');
    const oldOne = await liveJob(N.base, 'process/js/chatClerver');
    ok(!!oldOne, 'a server with home true in its sidecar runs, under its old module id', 'no job for process/js/chatClerver: ' + short((await jobsOf(N.base)).filter(function (j) { return j.kind === 'server'; }).map(function (j) { return j.module; })));
    const chats = await call(N.base, 'chatClerver.chats.search', {});
    ok(chats.status === 200 && !!chats.body && chats.body.ok !== false, 'its verb answers', 'chatClerver.chats.search: ' + short(chats.text));
    const oldFace = (await call(N.base, 'api', { family: 'chatClerver' })).body || {};
    ok(String(oldFace.interface || '').indexOf('chat.read') !== -1, 'its interface is still the api.js in its family folder', 'api {family: chatClerver}: ' + short(oldFace));
    const oldAt = (await call(N.base, 'chatClerver.FS.path', { path: 'api.js' })).body || {};
    ok(oldAt.path === familyPath('chatClerver'), 'FS.path still names what the family path function names', 'FS.path: ' + short(oldAt));
    if (POSIX) ok(fs.existsSync(path.join(s.run, 'relay-state', 'process', 'chatClerver', 'door.sock')), 'its door stays in relay-state/process', 'no door in relay-state/process/chatClerver');
    ok(fs.existsSync(path.join(s.run, 'spirit', 'state', 'chatClerver', 'data', 'memory.db')), 'its state stays in its data/', 'no memory.db in spirit/state/chatClerver/data');
    const notHome = await call(N.base, 'jobs.create', { command: 'node', args: ['process/js/counterServer/counterServer.js'], type: 'the red' });
    ok(notHome.status >= 400 && !!notHome.body && notHome.body.code === 'process-not-included', 'a process without its home switch is refused as ever', 'jobs.create on counterServer: ' + short(notHome.text));
    const otherPlace = await call(N.base, 'jobs.create', { command: 'node', args: ['shell/planted.js'], type: 'the red' });
    ok(otherPlace.status >= 400 && !!otherPlace.body && otherPlace.body.code === 'not-a-process', 'a script outside the two places is refused by name', 'jobs.create on shell/planted.js: ' + short(otherPlace.text));
    const sidecarOff = await call(N.base, 'fs.annotate', { path: 'process/js/chatClerver/chatClerver.js', payload: { home: false } });
    ok(sidecarOff.status >= 200 && sidecarOff.status < 300, 'the world: its home switch is turned off', 'fs.annotate: ' + sidecarOff.status + ' ' + short(sidecarOff.text));
    ok(await until(function () { return liveJob(N.base, 'process/js/chatClerver').then(function (j) { return !j; }); }, 15000), 'its sidecar still stops it while the node runs', 'its sidecar did not stop it');

    test.subHeading('the box: "No gate changes for a caller: once a server is registered, the door and the grants go by its name."');
    const reached = [];
    const servers = { ask: function (a) { reached.push(a); return a === 'api' ? { status: 200, body: { [NAME]: { ping: {} } } } : { status: 200, body: { ok: true } }; } };
    const member = function (paths) { return { key: 'KEY-MEMBER', auth: { pathsOf: function () { return paths; } } }; };
    const stranger = await answer(servers, { [NAME]: { ping: {} } }, member([]));
    ok(!!stranger && !!stranger.body && stranger.body.ok === false && reached.length === 0, 'a member without a grant is refused, and no server is asked', 'a member without a grant: ' + short(stranger) + ', asked ' + reached.length);
    const granted = await answer(servers, { [NAME]: { ping: {} } }, member([NAME + '.ping']));
    ok(!!granted && granted.status === 200 && reached.length === 1, 'a member granted <name>.ping reaches it', 'a member granted: ' + short(granted) + ', asked ' + reached.length);

    test.subHeading('the box: "data.js sits beside <name>.js ... and the lookups follow it": a client\'s cache');
    // What a client kept of a sender comes back only when that sender's family has a data.js here.
    const SENDER = 'MCowBQYDK2VwAyEAgrEcBu0FkTzmGKs+oBS+OllzvZh+d/0Rr6fO/fXD+0c=';
    const kept = async function (family) {
      const folder = path.join(s.run, 'spirit', 'state', 'follower');
      fs.rmSync(folder, { recursive: true, force: true });
      fs.mkdirSync(folder, { recursive: true });
      const id = spawnSync(process.execPath, ['-e', "process.stdout.write(require('./spirit/data.js').nodeId(" + JSON.stringify(SENDER) + "))"], { cwd: s.run, encoding: 'utf8' }).stdout;
      fs.writeFileSync(path.join(folder, id + '.json'), JSON.stringify({ key: SENDER, family: family, run: 'r', n: 1, rows: [{ kept: family }] }));
      const seen = path.join(s.root, 'row-seen.json');
      fs.rmSync(seen, { force: true });
      const pipe = require(path.join(s.run, 'spirit', 'appClient.js')).pipePathFor(s.root, 'follower', process.platform, 'process');
      if (POSIX) fs.mkdirSync(path.dirname(pipe), { recursive: true });
      const kid = spawn(process.execPath, [path.join('spirit', 'app', NAME, 'follower.js'), '--pipe', pipe], { cwd: s.run, stdio: 'ignore', env: Object.assign({}, process.env, { ROW_SEEN: seen }) });
      live.push(kid);
      await until(function () { return Promise.resolve(fs.existsSync(seen)); }, 6000);
      await stop(kid);
      return readJson(seen);
    };
    const keptOld = await kept('chatClerver');
    ok(!!keptOld && keptOld.kept === 'chatClerver', 'the world: a client gets back what it kept of an old family', 'kept of chatClerver: ' + short(keptOld));
    const keptNone = await kept('noSuchFamily');
    ok(!keptNone, 'the world: and nothing of a family with no data.js here', 'kept of noSuchFamily: ' + short(keptNone));
    const keptNew = await kept(NAME);
    ok(!!keptNew && keptNew.kept === NAME, 'a client gets back what it kept of the new family', 'kept of ' + NAME + ': ' + short(keptNew));

    test.subHeading('the box: "active in node.json starts and stops it while the node runs"');
    const on = await call(N.base, 'app.active', { key: NAME, active: true });
    ok(on.status === 200, 'the world: the app is activated, by the verb its element presses', 'app.active: ' + short(on.text));
    ok(await upAgain(N.base), 'activated, the server starts and answers its verb, with no restart of the node', 'activated, its verb did not answer: ' + short((await pingOf(N.base)).text));
    const first = (await pingOf(N.base)).body || {};
    if (!first.pid) { test.fail('no server to judge further'); return; }
    ok(alive(Number(first.pid)), 'the world: the pid it gave is a live process', 'the pid it gave is not alive: ' + short(first));

    test.subHeading('the box: "<name> is its family name in the node\'s flat table", its family at the top of the app folder, as spirit/<family>/ has it (goal/G43.27)');
    const tree = (await call(N.base, 'api')).body || {};
    ok(!!tree[NAME] && !!tree[NAME].ping, 'the flat table holds ' + NAME + ' with its verb', 'the flat table: ' + short(Object.keys(tree)) + ', ' + NAME + ': ' + short(tree[NAME]));
    const iface = (await call(N.base, 'api', { family: NAME })).body || {};
    ok(String(iface.interface || '').indexOf(INTERFACE) !== -1, 'its interface is the api.js at the top of the app folder', 'api {family}: ' + short(iface));
    const note = (await call(N.base, NAME + '.FS.loadFile', { path: 'note.txt' })).body || {};
    ok(note.text === NOTE, 'the server\'s own look beside its script finds the app folder, not a family/ folder', 'FS.loadFile note.txt: ' + short(note));
    const at = (await call(N.base, NAME + '.FS.path', { path: 'api.js' })).body || {};
    ok(at.path === 'spirit/app/' + NAME + '/api.js', 'FS.path names the api.js at the top of the app folder', 'FS.path api.js: ' + short(at));

    test.subHeading('the box: "Its module id is spirit.app.<name>", "Jobs names it so."');
    const job = await liveJob(N.base, MODULE);
    ok(!!job, 'its server job has the module id ' + MODULE, 'no live server job with that id: ' + short((await jobsOf(N.base)).filter(function (j) { return j.kind === 'server'; }).map(function (j) { return j.module; })));

    test.subHeading('the box: "node.mount true means a server the node runs, with no arguments. The old kind and operated stay with process/js"');
    const own = readJson(path.join(s.run, 'spirit', 'app', NAME, NAME + '.json')) || {};
    ok(own.node && own.node.mount === true && !('kind' in own) && !('operated' in own), 'the world: its <name>.json has neither, and it runs', 'the fixture\'s json: ' + short(own));
    ok(!!job && job.data && job.data.operated === 'node', 'the node operates it', 'its job: ' + short(job && job.data));

    test.subHeading('the box: "Its door.sock lives in spirit/state/<name>/", and its state stays in data/');
    if (POSIX) {
      // Where the door lies is the requirement here, so its path is read and never connected to: a call goes through the node.
      const door = path.join(state(), 'door.sock');
      ok(fs.existsSync(door) && fs.statSync(door).isSocket(), 'its door is a socket in spirit/state/' + NAME + '/', 'no socket at spirit/state/' + NAME + '/door.sock');
      ok(!fs.existsSync(path.join(s.run, 'relay-state', 'process', NAME, 'door.sock')), 'and none in relay-state/process', 'a door in relay-state/process/' + NAME);
      ok(!fs.existsSync(path.join(state(), 'data', 'door.sock')), 'and none in its data/', 'a door in its data/');
    }
    ok(path.resolve(String(first.state)) === path.join(state(), 'data'), 'the node hands it spirit/state/' + NAME + '/data as --state', '--state: ' + short(first.state));
    ok(fs.existsSync(started), 'what it writes there is on disc', 'no started.txt in its data/');

    test.subHeading('the box: "active is the one switch, with no separate running field"');
    const j1 = nodeJson() || {};
    ok(j1.active === true && !('running' in j1), 'node.json says active true, and holds no running', 'node.json: ' + short(j1));
    process.kill(Number(first.pid), 'SIGKILL');
    await until(function () { return Promise.resolve(!alive(Number(first.pid))); }, 5000);
    ok(await until(function () { return pingOf(N.base).then(function (r) { return answers(r) && Number(r.body.pid) !== Number(first.pid); }); }, 30000), 'killed, the node starts it again', 'killed, it did not come back');
    const j2 = nodeJson() || {};
    ok(j2.active === true && !('running' in j2), 'and active stays true through that', 'node.json after the kill: ' + short(j2));

    test.subHeading('the box: a script of an active app may start');
    const activeHelper = await startIt('spirit/app/' + NAME + '/helper.js', ranHelper);
    ok(activeHelper.status === 201 && !!(await until(function () { return Promise.resolve(fs.existsSync(ranHelper)); }, 10000)), 'a helper of an active app runs', 'jobs.create on an active app: ' + short(activeHelper.text) + ', ran: ' + fs.existsSync(ranHelper));

    test.subHeading('a page and a process bind it by its name (the box: "A page changes nothing. It binds a family by its name, and the node finds the folder."; "data.js sits beside <name>.js ... and the lookups follow it")');
    const where = findChrome();
    if (!where) test.fail('no Chrome here, so the page side was not judged');
    else {
      chrome = await chromePage(where);
      if (chrome.error) test.fail('Chrome: ' + chrome.error);
      else {
        await chrome.send('Page.navigate', { url: N.base + '/' });
        ok(await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000), 'the world: the page has its spirit', 'the page has no spirit');
        const onPage = function (expr) { return chrome.evaluate('Promise.resolve().then(function () { return ' + expr + '; }).then(function (v) { return JSON.stringify({ v: v }); }, function (e) { return JSON.stringify({ e: String(e && (e.code || e.message) || e) }); })').then(parsed); };
        const control = await onPage("spirit.ready.then(function () { return spirit.require(spirit.familyPath('fileServer')); }).then(function (f) { return typeof f.FS; })");
        ok(!!control && control.v === 'object', 'the world: a page binds an old server\'s family', 'a page binding fileServer: ' + short(control));
        const pinged = await onPage("spirit.ready.then(function () { return spirit.require(spirit.familyPath('" + NAME + "')); }).then(function (f) { return f.ping({}); })");
        ok(!!pinged && !!pinged.v && Number(pinged.v.pid) > 0, 'a page binds the new family by its name, and its verb answers', 'a page binding ' + NAME + ': ' + short(pinged));
        const managed = await onPage("spirit.cacheManager('" + NAME + "').then(function () { return window.__appData; })");
        ok(!!managed && managed.v === NAME, 'a page finds its data.js beside <name>.js', 'cacheManager on a page: ' + short(managed));
        const same = await onPage("spirit.require('spirit/app/" + NAME + '/' + NAME + ".js').then(function () { return window.__appOnPage; })");
        ok(!!same && same.v === NAME, 'the one <name>.js also runs on a page (the box: "<name>.js is one file, on the page and as the server")', 'its script on a page: ' + short(same));
      }
    }
    const inNode = function (family) {
      const r = spawnSync(process.execPath, ['-e', "require('./spirit.js'); spirit.cacheManager(" + JSON.stringify(family) + ").then(function () { console.log('found ' + (global.__appData || '')); process.exit(0); }, function (e) { console.log('not found ' + (e && (e.code || e.message))); process.exit(0); });"], { cwd: s.run, encoding: 'utf8', timeout: 30000 });
      return String(r.stdout || '').trim();
    };
    ok(/^found/.test(inNode('deskClient')), 'the world: a process finds an old family\'s data.js', 'a process, deskClient: ' + short(inNode('deskClient')));
    ok(inNode(NAME) === 'found ' + NAME, 'a process finds the new family\'s data.js', 'a process, ' + NAME + ': ' + short(inNode(NAME)));

    test.subHeading('the box: "turning "active" will NOT take the row out of the list"; and off stops it');
    const before = Number(((await pingOf(N.base)).body || {}).pid);
    const off = await call(N.base, 'app.active', { key: NAME, active: false });
    ok(off.status === 200, 'the world: the app is deactivated', 'app.active false: ' + short(off.text));
    ok(await until(function () { return Promise.resolve(!alive(before)); }, 15000), 'deactivated, the server process stops', 'deactivated, pid ' + before + ' still runs');
    ok(await until(function () { return liveJob(N.base, MODULE).then(function (j) { return !j; }); }, 10000), 'and no server job stays live', 'a live server job stayed');
    ok(!answers(await pingOf(N.base)), 'and its verb is not answered', 'its verb answered after deactivating');
    await sleep(3000);
    ok(!answers(await pingOf(N.base)) && !alive(before), 'and it does not come back by itself', 'it came back after deactivating');
    const offRow = await rowOf(N.base, NAME);
    ok(!!offRow && offRow.active === false, 'its row stays in the list, active false', 'its row after deactivating: ' + short(offRow));
    ok((nodeJson() || {}).active === false, 'node.json says active false', 'node.json: ' + short(nodeJson()));
    await call(N.base, 'app.active', { key: NAME, active: true });
    ok(await upAgain(N.base), 'activated again, it starts again', 'activated again, its verb did not answer');

    test.subHeading('the box: "true means the node runs it now and starts it at every boot"; Andy: "that\'s how the node knows, at re-boot time, which servers it must autostart."');
    await stop(N.child);
    N = await boot(s.run); live.push(N.child);
    ok(N.up && await upAgain(N.base), 'a restarted node starts it', 'a restarted node did not start it');
    ok((nodeJson() || {}).active === true, 'and active stays true', 'node.json after a restart: ' + short(nodeJson()));
    ok(!!(await liveJob(N.base, MODULE)), 'and its job is there, under its module id', 'no job after a restart');
    // A power cut: nothing gets to clean up, the node and the server go at once.
    const cutPid = Number(((await pingOf(N.base)).body || {}).pid);
    N.child.kill('SIGKILL');
    try { process.kill(cutPid, 'SIGKILL'); } catch (e) { /* gone with the node */ }
    await until(function () { return Promise.resolve(N.child.exitCode !== null || N.child.signalCode !== null); }, 5000);
    N = await boot(s.run); live.push(N.child);
    ok(N.up && await until(function () { return pingOf(N.base).then(function (r) { return answers(r) && Number(r.body.pid) !== cutPid; }); }, 30000), 'after a power cut, its door left behind, the node starts it', 'after a power cut it did not start: ' + short((await pingOf(N.base)).text));
    await call(N.base, 'app.active', { key: NAME, active: false });
    await until(function () { return liveJob(N.base, MODULE).then(function (j) { return !j; }); }, 15000);
    await stop(N.child);
    fs.rmSync(started, { force: true });
    N = await boot(s.run); live.push(N.child);
    await sleep(3000);
    ok(N.up && !fs.existsSync(started) && !(await liveJob(N.base, MODULE)), 'deactivated, a restarted node does not start it', 'deactivated, a restarted node started it');

    await stop(N.child);
  } finally {
    live.forEach(function (c) { try { c.kill(); } catch (e) { /* gone */ } });
    if (chrome && chrome.kid) { try { chrome.kid.kill(); } catch (e) { /* gone */ } }
    await sleep(300);
    try { fs.rmSync(s.root, { recursive: true, force: true }); } catch (e) { /* a door still closing; the temp folder keeps it */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
