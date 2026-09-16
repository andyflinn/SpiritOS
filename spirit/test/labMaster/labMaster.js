'use strict';

// Local lab control plane. Always http://127.0.0.1:65420
// Not copied into fake nodes (lives under spirit/test/).
//
// What it is, why each guard is here, the HTTP surface, and how
// labPopulate builds a whole world from a scenario in one command:
//   design/cleanup/2026-09-11-labmaster.md
//
// 127.0.0.1 only, no auth, deliberately. It spawns processes and deletes
// directories on this machine; it has no business listening anywhere else.

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');

const MASTER_PORT = 65420;
const WORK_PORT = 65432;
const WORK_ID = 'work';
const LAB_PORT_MIN = 65400;
const LAB_PORT_MAX = 65429;

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const WORK_HOME = path.join(REPO_ROOT, 'spirit', 'run');

// ── WHERE A LAB NODE LIVES, AND WHY IT IS NOT %TEMP% ─────────────────
//
//   Andy: "in fact i want new ones all in repo/lab" — "repo/lab/name".
//
// Beside the checkout rather than inside it: `repo/SpiritOS` is the work
// node, `repo/lab/<name>` is everybody else. A lab node is a person's
// node that happens to run on this machine — it holds a key, a seat on a
// public relay and a conversation — and %TEMP% is where a machine puts
// things it is willing to lose.
//
// ── THE TEST HARNESS DID NOT COME WITH IT ────────────────────────────
//
// setupRelayFakes.js, labWorld.js, labPersistence.js and liveRelay.js all
// still build under `os.tmpdir()/spiritos-relay-fakes`, and that is the
// right place for them: a suite wants a throwaway tree it can wipe
// between runs, and it must test the WORKING TREE rather than what is
// published. These two roots answer different questions and sharing one
// was what made a hand-kept node as disposable as a fixture.
const LAB_ROOT = path.join(REPO_ROOT, '..', 'lab');
const STATE_DIR = path.join(os.tmpdir(), 'spiritos-lab-master');
const STATE_FILE = path.join(STATE_DIR, 'nodes.json');
const PANEL_FILE = path.join(__dirname, 'labMastPanel.html');

const children = Object.create(null);

function slugName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function workRow() {
  return {
    id: WORK_ID,
    name: 'work',
    type: 'avatar',
    port: WORK_PORT,
    permanent: true,
    home: WORK_HOME.replace(/\\/g, '/'),
    pid: null,
    running: false,
    lastError: '',
    startedAt: null,
  };
}

function loadDesired() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch (e) { /* first run */ }
  return [workRow()];
}

// Noted on the row and persisted, so a restart of labMaster does not
// forget what each node is running.
function noteCommit(node) {
  const root = homeRootFor(node.id);
  node.commit = root ? commitOf(root) : '';
  return node.commit;
}

function saveDesired(nodes) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const desired = nodes.map(function (n) {
    return {
      id: n.id,
      name: n.name,
      type: n.type,
      port: n.port,
      permanent: !!n.permanent,
      home: n.home,
      // Kept across a restart of labMaster: which commit a node was last
      // put on is a fact about the node, and re-deriving it would mean
      // shelling out to git for every row at boot.
      commit: n.commit || '',
    };
  });
  if (!desired.some(function (n) { return n.id === WORK_ID; })) {
    desired.unshift(workRow());
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(desired, null, 2));
}

let nodes = loadDesired().map(function (n) {
  if (n.id === WORK_ID) {
    return Object.assign(workRow(), { name: n.name || 'work' });
  }
  return {
    id: n.id,
    name: n.name,
    type: n.type === 'relay' ? 'relay' : 'avatar',
    port: n.port,
    permanent: false,
    home: n.home || path.join(LAB_ROOT, n.id, 'spirit', 'run').replace(/\\/g, '/'),
    pid: null,
    running: false,
    lastError: '',
    startedAt: null,
  };
});
saveDesired(nodes);

function findNode(id) {
  return nodes.find(function (n) { return n.id === id; });
}

function pidsOnPort(port) {
  const pids = {};
  try {
    if (process.platform === 'win32') {
      const out = execSync('netstat -ano', { encoding: 'utf8' });
      // ONE column between the port and the state, not two. Windows
      // netstat prints `TCP  <local>  <foreign>  LISTENING  <pid>`, so
      // after the port there is exactly one non-space token before
      // LISTENING. With two, this matched nothing at all — so `running`
      // said no for every node labMaster had not started itself, and the
      // panel quietly reported a healthy network as dead.
      const re = new RegExp('[:.]' + port + '\\s+\\S+\\s+LISTENING\\s+(\\d+)', 'gi');
      let m;
      while ((m = re.exec(out))) pids[m[1]] = true;
    } else {
      const out = execSync('ss -tlnp', { encoding: 'utf8' });
      const re = new RegExp(':' + port + '\\b.*pid=(\\d+)', 'gi');
      let m;
      while ((m = re.exec(out))) pids[m[1]] = true;
    }
  } catch (e) { /* tools missing */ }
  return Object.keys(pids).map(Number).filter(function (pid) {
    return pid > 0 && pid !== process.pid;
  });
}

function portHasListener(port) {
  return pidsOnPort(port).length > 0;
}

function killPids(pids) {
  pids.forEach(function (pid) {
    try {
      if (process.platform === 'win32') {
        execSync('taskkill /F /PID ' + pid, { stdio: 'ignore' });
      } else {
        process.kill(pid, 'SIGTERM');
      }
    } catch (e) { /* already gone */ }
  });
}

function publicNode(n) {
  const child = children[n.id];
  const mine = !!(child && child.exitCode == null);
  return {
    id: n.id,
    name: n.name,
    type: n.type,
    port: n.port,
    permanent: !!n.permanent,
    home: n.home,
    pid: mine ? child.pid : (pidsOnPort(n.port)[0] || null),
    running: mine || portHasListener(n.port),
    lastError: n.lastError || '',
    startedAt: n.startedAt,
    // WHICH COMMIT THIS NODE IS ON, recorded when it was last cloned or
    // updated rather than asked here. The panel polls every three
    // seconds; a `git rev-parse` per node per poll is a subprocess
    // storm for a string that only changes when a button is pressed.
    //
    // It is the answer to the question this whole change created: a lab
    // node runs published code now, so "is it behind?" is a real
    // question and used not to be.
    commit: n.commit || '',
  };
}

// The one destructive operation in this file, so it is written to be
// hard to misuse rather than short.
//
// Three guards, none of them theatre: the id must be a slug (so it can
// carry no separators and no ..), the resolved path must sit strictly
// INSIDE the lab root, and it must not be the work home. A tool that
// deletes directories on a developer's machine earns all three — and the
// work node is a real checkout, not a copy.
//
// THEY MATTER MORE THAN THEY DID. This used to delete inside %TEMP%;
// LAB_ROOT is `repo/lab`, a folder beside somebody's actual checkout and
// inside their synced drive. The guards did not change because they were
// already written for the worse case.
function homeRootFor(id) {
  const slug = slugName(id);
  if (!slug) return null;
  const target = path.resolve(LAB_ROOT, slug);
  const inside = path.resolve(LAB_ROOT) + path.sep;
  if (!target.startsWith(inside)) return null;
  if (target === path.resolve(WORK_HOME)) return null;
  return target;
}

// A NODE THAT IS RECREATED MUST BE CLEAN, and nothing else may call
// this. The old copy path wrote tracked files over whatever was already
// there, and relay-state, device.json, session.json and minted.json are
// none of them tracked — so a "new" lab relay could boot owned by a
// previous run's key and be unclaimable by the suite that asked for it.
//
// That cost an afternoon of debugging a relay that remembered something
// it should not have, and it is why Recycle wipes. It is also why Recycle
// is not the bulk button: the same thoroughness that makes a new node
// clean is what took Andy's bindings away.
function wipeHome(id) {
  const target = homeRootFor(id);
  if (!target) return false;
  try { fs.rmSync(target, { recursive: true, force: true }); }
  catch (err) { return false; }
  return true;
}

// ── A LAB NODE IS A CLONE, NOT A COPY ────────────────────────────────
//
//   Andy: "i want all my nodes on labMaster page to only be updated via
//   github, jazz's binding to spirit-3 keeps getting trashed."
//
// copyTrackedSpirit STOOD HERE. It ran `git ls-files` in the checkout and
// copied each path into the node's home — and, unless asked to keep
// state, `wipeHome` first. That is the whole of the complaint:
//
//   relay-state/ and session.json are GITIGNORED, so they were never in
//   the copy and never came back. Recycle destroyed a node's key and its
//   binding, and `Recycle all` was the only bulk button on the panel. A
//   node bound to spirit-3 came back a stranger to itself.
//
// Both halves are answered by the same change, and it is a change to
// something SIMPLER rather than something cleverer: a lab node is a git
// clone, and it is updated the way the public relay updates itself
// (install/kamerata/update.sh, running on a real box today):
//
//   git fetch origin
//   git reset --hard origin/master
//
// `reset --hard` reverts tracked files and LEAVES UNTRACKED AND IGNORED
// FILES ALONE. Every piece of a node's own state — relay-state/,
// session.json, view.json, prefs.json, minted.json, the peerfiles — is
// ignored, so an update cannot reach any of it. The binding problem stops
// being a thing that is fixed and becomes a thing that cannot happen.
//
// relays.json was the one exception and is no longer tracked either; see
// .gitignore, which says why at length.
//
// ── AND IT IS GITHUB, NOT THIS WORKING TREE ──────────────────────────
//
// Which is the other half of what was asked, and it is a real change in
// what the lab TESTS. A copy of `git ls-files` carried Andy's uncommitted
// edits into every node; a clone carries what is on origin/master. So a
// lab node now runs published code, and code that only exists in the
// checkout reaches the work node and nowhere else.
//
// That is the point — but it has a consequence worth saying out loud
// rather than discovering: **an unpushed commit does not reach the lab.**
// `git log origin/master..HEAD` is the list of things the lab cannot see.
const ORIGIN_FALLBACK = 'https://github.com/andyflinn/SpiritOS';

function originUrl() {
  try {
    const url = execSync('git config --get remote.origin.url', {
      cwd: REPO_ROOT, encoding: 'utf8',
    }).trim();
    return url || ORIGIN_FALLBACK;
  } catch (err) {
    return ORIGIN_FALLBACK;
  }
}

function git(args, cwd) {
  return execSync('git ' + args, { cwd: cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function isClone(targetRoot) {
  return fs.existsSync(path.join(targetRoot, '.git'));
}

// NEW NODE, NEW CLONE.
//
// `--reference` takes the objects off the checkout already on this disk,
// so this is a local copy rather than a download; `--dissociate` then
// copies what it borrowed and drops the link, so a later `git gc` in
// Andy's checkout cannot break a lab node. `origin` still points at
// GitHub, which is what every later update reads.
function cloneNode(id) {
  const targetRoot = homeRootFor(id);
  if (!targetRoot) throw new Error('refusing to build outside the lab root: ' + id);
  wipeHome(id);
  fs.mkdirSync(LAB_ROOT, { recursive: true });
  git('clone --reference "' + REPO_ROOT + '" --dissociate "' + originUrl() +
    '" "' + targetRoot + '"', LAB_ROOT);
  return path.join(targetRoot, 'spirit', 'run');
}

// NEW CODE, SAME NODE — and now that is all it can be.
//
// A home that is not a clone is one built by the old copy path. It is
// adopted rather than refused: clone beside it, move its state across,
// and it becomes an ordinary lab node. Doing that silently is right —
// the alternative is telling somebody their node cannot be updated and
// leaving them to move a directory by hand.
function updateNode(id) {
  const targetRoot = homeRootFor(id);
  if (!targetRoot) throw new Error('refusing to update outside the lab root: ' + id);
  if (!isClone(targetRoot)) return adoptIntoClone(id);
  git('fetch origin', targetRoot);
  git('reset --hard origin/master', targetRoot);
  return path.join(targetRoot, 'spirit', 'run');
}

// WHAT A NODE OWNS, and the list is the one .gitignore already keeps —
// stated as paths because this has to MOVE them rather than merely not
// overwrite them. Everything else in a home is code and comes from git.
const NODE_STATE = [
  path.join('spirit', 'run', 'relay-state'),
  path.join('spirit', 'run', 'app', 'natter', 'session.json'),
  path.join('spirit', 'run', 'app', 'natter', 'relays.json'),
  path.join('spirit', 'run', 'app', 'natter', 'minted.json'),
  path.join('spirit', 'run', 'app', 'relayChat'),
  path.join('spirit', 'run', 'app', 'contacts'),
  path.join('spirit', 'run', 'app', 'shared'),
];

function carryState(fromRoot, toRoot) {
  const carried = [];
  NODE_STATE.forEach(function (rel) {
    const from = path.join(fromRoot, rel);
    if (!fs.existsSync(from)) return;
    const to = path.join(toRoot, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    // Over the top: a clone brings the app FOLDERS (manifests, scripts),
    // so relayChat/ and contacts/ already exist and only the files a node
    // wrote into them are being added.
    fs.cpSync(from, to, { recursive: true, force: true });
    carried.push(rel);
  });
  return carried;
}

// An old copy-built home becomes a clone, keeping its key. This is what
// every existing lab node goes through once, and it is why the first
// update after this change takes a moment longer than the rest.
function adoptIntoClone(id) {
  const targetRoot = homeRootFor(id);
  if (!targetRoot) throw new Error('refusing to adopt outside the lab root: ' + id);
  const keep = targetRoot + '.state';
  try { fs.rmSync(keep, { recursive: true, force: true }); } catch (err) { /* nothing there */ }

  // The state is moved ASIDE first and the clone is taken second, so a
  // clone that fails leaves the state on disk under a name somebody can
  // find. Wiping first and cloning second would lose a key to a network
  // error.
  fs.mkdirSync(keep, { recursive: true });
  carryState(targetRoot, keep);

  const runDir = cloneNode(id);
  carryState(keep, targetRoot);
  try { fs.rmSync(keep, { recursive: true, force: true }); } catch (err) { /* left for a human */ }
  return runDir;
}

// WHICH COMMIT IS THIS NODE ON. A clone can answer for itself, so nothing
// is stamped into it any more — build.json was only ever there because a
// copied tree is not a repository and could not be asked.
function commitOf(targetRoot) {
  try { return git('rev-parse --short HEAD', targetRoot).trim(); }
  catch (err) { return ''; }
}

function portAllowedForLab(port) {
  if (typeof port !== 'number' || port !== (port | 0)) return false;
  if (port < LAB_PORT_MIN || port > LAB_PORT_MAX) return false;
  if (port === MASTER_PORT) return false;
  return true;
}

function portTaken(port, exceptId) {
  return nodes.some(function (n) {
    return n.port === port && n.id !== exceptId;
  });
}

function startNode(node) {
  if (children[node.id] && children[node.id].exitCode == null) {
    node.lastError = '';
    return { ok: true };
  }
  if (node.type !== 'relay' && node.type !== 'avatar') {
    return { ok: false, status: 400, error: 'type must be avatar or relay' };
  }
  const home = node.permanent ? WORK_HOME : node.home;
  const serverJs = path.join(home, 'js', 'server.js');
  if (!fs.existsSync(serverJs)) {
    return { ok: false, status: 400, error: 'no js/server.js under home' };
  }
  const args = [serverJs, '--port', String(node.port)];
  if (node.type === 'relay') args.push('--relay');

  const child = spawn(process.execPath, args, {
    cwd: home,
    stdio: 'inherit',
  });
  children[node.id] = child;
  node.pid = child.pid;
  node.running = true;
  node.startedAt = new Date().toISOString();
  node.lastError = '';
  child.on('exit', function (code, signal) {
    if (children[node.id] === child) delete children[node.id];
    node.running = false;
    node.pid = null;
    if (code && code !== 0) {
      node.lastError = 'exited ' + code + (signal ? ('/' + signal) : '');
    }
  });
  return { ok: true };
}

function stopNode(node) {
  const child = children[node.id];
  if (child && child.exitCode == null) {
    try { child.kill(); } catch (e) { /* already gone */ }
    delete children[node.id];
  }
  killPids(pidsOnPort(node.port));
  node.running = false;
  node.pid = null;
  return { ok: true };
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise(function (resolve, reject) {
    let body = '';
    req.on('data', function (chunk) { body += chunk; });
    req.on('end', function () {
      if (!body) { resolve({}); return; }
      try { resolve(JSON.parse(body)); }
      catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

function handleCreate(body) {
  const name = String(body && body.name || '').trim();
  const type = body && body.type === 'relay' ? 'relay' : 'avatar';
  const port = Number(body && body.port);
  const id = slugName(name);
  if (!id) return { status: 400, error: 'name required' };
  if (id === WORK_ID) return { status: 403, error: 'work row is reserved' };
  if (findNode(id)) return { status: 409, error: 'id already exists' };
  if (!portAllowedForLab(port)) {
    return { status: 400, error: 'lab port must be 65400-65429 except 65420' };
  }
  if (port === WORK_PORT) return { status: 403, error: '65432 is the work node' };
  if (portTaken(port)) return { status: 409, error: 'port in use in table' };

  let home;
  try { home = cloneNode(id); }
  catch (err) { return { status: 500, error: String(err.message || err) }; }


  const row = {
    id: id,
    name: name,
    type: type,
    port: port,
    permanent: false,
    home: home.replace(/\\/g, '/'),
    pid: null,
    running: false,
    lastError: '',
    startedAt: null,
    commit: '',
  };
  noteCommit(row);
  nodes.push(row);
  saveDesired(nodes);
  return { status: 201, node: publicNode(row) };
}

function handleRename(node, body) {
  const name = String(body && body.name || '').trim();
  if (!name) return { status: 400, error: 'name required' };
  node.name = name;
  saveDesired(nodes);
  return { status: 200, node: publicNode(node) };
}

function handleStart(node) {
  // A HOME THAT IS NOT THERE IS REBUILT, and nothing else is. Start has
  // never been an update and must not become one: pressing it on a node
  // bound to a relay should start that node, not fetch anything.
  if (!node.permanent && !fs.existsSync(path.join(node.home, 'js', 'server.js'))) {
    try { node.home = cloneNode(node.id).replace(/\\/g, '/'); }
    catch (err) { return { status: 500, error: String(err.message || err) }; }
    noteCommit(node);
    saveDesired(nodes);
  }
  const result = startNode(node);
  if (!result.ok) return { status: result.status || 400, error: result.error };
  return { status: 200, node: publicNode(node) };
}

function handleStop(node) {
  stopNode(node);
  return { status: 200, node: publicNode(node) };
}

// START AGAIN AS A STRANGER. The home goes and a fresh clone takes its
// place — new key, off every relay it was on, no conversation. It is the
// rare thing to want and it stays per-row, behind its warning: the BULK
// button is Update now, because a bulk gesture that destroys every
// identity in the lab is how this whole sitting started.
function handleRecycle(node) {
  if (node.permanent) return { status: 403, error: 'cannot recycle work node' };
  stopNode(node);
  try { node.home = cloneNode(node.id).replace(/\\/g, '/'); }
  catch (err) { return { status: 500, error: String(err.message || err) }; }
  noteCommit(node);
  saveDesired(nodes);
  const started = startNode(node);
  if (!started.ok) return { status: started.status || 500, error: started.error };
  return { status: 200, node: publicNode(node) };
}

// UPDATE FROM GITHUB. Stop, fetch, reset to origin/master, start.
//
// Its key, its relay rows, its device slot, its session and its
// conversations all survive — not because this is careful with them, but
// because git has never had them. That is the difference between the old
// refresh and this one: the old one was a copy that happened to miss the
// state, and one wrong flag away from not missing it.
//
// The work node is refused because it is Andy's checkout: a tool that
// fetched and hard-reset somebody's working tree would throw away the
// thing they are in the middle of writing.
function handleRefresh(node) {
  if (node.permanent) return { status: 403, error: 'the work node is your checkout' };
  stopNode(node);
  try { node.home = updateNode(node.id).replace(/\\/g, '/'); }
  catch (err) { return { status: 500, error: String(err.message || err) }; }
  noteCommit(node);
  saveDesired(nodes);
  const started = startNode(node);
  if (!started.ok) return { status: started.status || 500, error: started.error };
  return { status: 200, node: publicNode(node) };
}

function handleDelete(node) {
  if (node.permanent) return { status: 403, error: 'cannot delete work node' };
  stopNode(node);
  // The disk goes too. Dropping only the table row left the home behind,
  // so a node created again under the same name inherited the identity,
  // the mailbox and the device slot of the one that was deleted — which
  // is the opposite of what "delete" says.
  const wiped = wipeHome(node.id);
  nodes = nodes.filter(function (n) { return n.id !== node.id; });
  saveDesired(nodes);
  return { status: 200, ok: true, id: node.id, wiped: wiped };
}

// ── A WORKING WORLD ON THE LIVE RELAY ────────────────────────────────
//
//   Andy: "i need a button on labMaster page that allows me to create a
//   working environment with andy and jazz properly bound to spirit-3"
//
// AGENTS.md/CLAUDE.md say "do not run labMaster against spirit-3", and
// that rule is right: a control plane that spawns fake nodes must not
// scatter them across a live public relay on its own initiative. This is
// the sanctioned exception — a button somebody presses, that says in the
// panel exactly what it is about to do to a real box.
//
// WHAT IT DOES NOT TOUCH, because these are the ways this has gone wrong
// before:
//
//   - the work node's identity.json: READ ONLY, always. Its key is the
//     owner of spirit-3 and regenerating it would cost Andy his relay.
//   - the work node's device slot: never written. A device enrolment is
//     a person's phone, not a fixture.
//   - the work node's relays.json: only ever ADDED to, and only if
//     spirit-3 is missing from it.
//
// What it does do: make sure a peer node exists and runs, get it a row
// on spirit-3 through an owner-minted invite (the real join path, not a
// hand-written file), point it at spirit-3, and introduce the two nodes
// to each other through their own /api/hub/contact — the same route a
// person uses.
const LIVE_RELAY = 'https://spirit.andyflinn.com';
const LIVE_LABEL = 'spirit';

function liveWorldPaths() {
  const run = path.join(WORK_HOME);
  return {
    identity: path.join(run, 'relay-state', 'identity.json'),
    relays: path.join(run, 'app', 'natter', 'relays.json'),
    session: path.join(run, 'app', 'natter', 'session.json'),
  };
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return fallback; }
}

function livePost(url, body) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(function (res) {
    return res.text().then(function (text) {
      let parsed = null;
      try { parsed = JSON.parse(text); } catch (e) { parsed = null; }
      return { status: res.status, ok: res.ok, body: parsed, text: text };
    });
  }).catch(function (err) {
    return { status: 0, ok: false, body: null, text: String(err.message || err) };
  });
}

// ── ASKING A RELAY FOR SOMETHING, AS A LOOPBACK CLIENT ───────────────
//
//   Andy: "The browser itself is not crypte-capable but it's considered
//   a safe loop-back client, same for processes."
//
// labMaster is a process, so it is that kind of client: no key, no
// signing, one POST over loopback and the work node does the rest.
//
// It reached /api/hub/invite until 2026-09-15, one of four post-path
// doors that closed. Each of them built a single packet body and handed
// it to router.post, which is what a peerPost IS — so the door was a
// second way of saying what the protocol already said.
//
// ADDRESSED BY KEY, which the census publishes to anyone. The answer
// arrives inside the envelope the relay replied in, and the body is what
// a caller wants — the same shape api.peerPost hands a page.
async function postToRelayVia(nodeUrl, relayUrl, body) {
  let key = '';
  try {
    const res = await fetch(relayUrl + '/api/relay/who');
    const parsed = await res.json();
    key = (parsed && parsed.relayPublicKey) || '';
  } catch (e) { key = ''; }
  if (!key) return { ok: false, status: 0, body: null, text: 'relay did not say what its key is' };

  const sent = await livePost(nodeUrl + '/api/spirit', {
    verb: 'peer.post', to: key, app: 'relay', body: body,
  });
  let answer = null;
  try { answer = JSON.parse((sent.body && sent.body.text) || 'null'); }
  catch (e) { answer = null; }
  const said = (answer && answer.body) || null;
  return {
    // Both halves: the transport succeeding and the far end agreeing are
    // different facts — see spirit/test/clientLayer.js.
    ok: !!(sent.ok && said && said.ok !== false),
    status: sent.status,
    body: said,
    text: sent.text,
  };
}

function napFor(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// WAIT FOR THE NODE TO ACTUALLY ANSWER, rather than for a number of
// milliseconds to pass.
//
// This was a fixed sleep and it cost two runs of the button. stopNode
// kills by PID, which is asynchronous; a restart that slept 700ms
// sometimes had the old process still holding the port, so the new child
// died on EADDRINUSE and the next step failed with "fetch failed" — a
// message about the wrong thing entirely, two steps later.
//
// A sleep is a guess about somebody else's machine. This asks.
async function waitForNode(port, ms) {
  const until = Date.now() + (ms || 15000);
  while (Date.now() < until) {
    const ok = await fetch('http://127.0.0.1:' + port + '/api/version')
      .then(function (r) { return r.ok; })
      .catch(function () { return false; });
    if (ok) return true;
    await napFor(250);
  }
  return false;
}

// spirit/run's own identity, read and never written. This is the owner of
// spirit-3, which is what lets the mint below be signed at all.
// WHAT MAKES THE SHELL OPEN NORMALLY, and it is not the relay.
//
// firstRun() in shell.js is decided by exactly one thing — a label in
// app/natter/session.json — so a node with its identity, its contacts,
// its relays and its mail all intact still opens to Natter alone and
// behaves like a stranger to itself without it:
//
//   Andy: "it wont show the shell it bring me directly to natter,
//   indicating to me that Im not hooked up with my satellite."
//
// It is gitignored, so no commit restores it, and untracked, so anything
// that lays down a fresh tracked tree omits it — which is why a freshly
// created lab node has never had one. labPopulate deliberately does not
// WRITE this file, only back it up; that restraint is right for a tool
// that reshapes an existing world, and wrong for a button whose whole job
// is to produce a working one.
//
// A backup is preferred over an invention: the work node's own binding is
// the true one, and re-inventing a label would be this tool deciding
// somebody's name for them.
function writeSession(home, label, steps, who) {
  const dir = path.join(home, 'app', 'natter');
  const file = path.join(dir, 'session.json');
  const backup = path.join(dir, 'session.json.before-lab');
  try {
    if (fs.existsSync(file)) {
      const held = readJson(file, null);
      if (held && held.label) {
        steps.push(who + ' is bound in the shell as ' + held.label);
        return held.label;
      }
    }
    if (fs.existsSync(backup)) {
      const saved = readJson(backup, null);
      if (saved && saved.label) {
        fs.writeFileSync(file, JSON.stringify(saved, null, 2) + '\n');
        steps.push(who + ' session.json restored from its before-lab backup as ' + saved.label);
        return saved.label;
      }
    }
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify({
      label: label,
      boundAt: new Date().toISOString(),
    }, null, 2) + '\n');
    steps.push(who + ' session.json written as ' + label + ' — the shell will open its desktop now');
    return label;
  } catch (e) {
    steps.push(who + ' session.json could not be written: ' + String(e.message || e));
    return '';
  }
}

function workIdentity() {
  const id = readJson(liveWorldPaths().identity, null);
  if (!id || !id.publicKey || !id.privateKey || !id.name) return null;
  return id;
}

// Bound means three things, and the panel should be able to say which
// one is missing rather than just "not bound":
//   a row on the relay, a line in relays.json, and a stream actually open.
async function liveWorldReport(peerNode, peerName) {
  const me = workIdentity();
  const relays = readJson(liveWorldPaths().relays, []);
  const census = await fetch(LIVE_RELAY + '/api/relay/who')
    .then(function (r) { return r.json(); })
    .catch(function () { return null; });
  const rows = (census && census.peers) || [];
  return {
    relay: LIVE_RELAY,
    reachable: !!census,
    work: {
      name: me ? me.name : '',
      onRelay: !!(me && rows.some(function (r) { return r.publicKey === me.publicKey; })),
      inRelaysJson: relays.some(function (r) { return r && r.url === LIVE_RELAY; }),
      // Whether the SHELL thinks this node is bound, which is a different
      // question from whether the relay does — and the one a person sees.
      boundInShell: !!(readJson(liveWorldPaths().session, {}) || {}).label,
    },
    peer: {
      name: peerName,
      running: !!peerNode,
      onRelay: rows.some(function (r) { return r.name === peerName; }),
      boundInShell: !!(peerNode && (readJson(
        path.join(peerNode.home, 'app', 'natter', 'session.json'), {}) || {}).label),
    },
  };
}

async function buildLiveWorld(body) {
  const peerName = slugName((body && body.peer) || 'jazz') || 'jazz';
  const port = Number(body && body.port) || 65400;
  const steps = [];

  const me = workIdentity();
  if (!me) {
    return { status: 409, error: 'the work node has no identity yet — open it once and claim a name first' };
  }
  steps.push('work node is ' + me.name + ', and its identity was read and not touched');

  // 0. THE WORK NODE IS RUNNING. Assumed until now, and that assumption
  //    cost three runs of this button: killing labMaster takes its
  //    spawned children with it, so the node this world is built AROUND
  //    was simply absent, and the failure surfaced two steps later as
  //    "contacts: fetch failed" — a message about the wrong thing.
  //
  //    "Create a working environment" has to include the half you are
  //    standing on.
  const workNode = findNode(WORK_ID);
  if (workNode && !portHasListener(WORK_PORT)) {
    handleStart(workNode);
    const workUp = await waitForNode(WORK_PORT, 20000);
    if (!workUp) return { status: 502, error: 'the work node did not come up on ' + WORK_PORT };
    steps.push('work node was down — started it on ' + WORK_PORT);
  } else {
    steps.push('work node is up on ' + WORK_PORT);
  }

  // 1. The peer node exists and is running.
  let peer = findNode(slugName(peerName));
  if (!peer) {
    const made = handleCreate({ name: peerName, type: 'avatar', port: port });
    if (!made.node) return { status: made.status, error: 'could not create ' + peerName + ': ' + made.error };
    peer = findNode(slugName(peerName));
    steps.push('created ' + peerName + ' on port ' + port);
  } else {
    steps.push(peerName + ' already existed on port ' + peer.port);
  }
  if (!portHasListener(peer.port)) {
    handleStart(peer);
    const up = await waitForNode(peer.port, 20000);
    steps.push(up ? 'started ' + peerName
      : 'started ' + peerName + ' but it never answered on ' + peer.port);
    if (!up) return { status: 502, error: peerName + ' did not come up on ' + peer.port };
  }

  // 2. spirit-3 is in the WORK node's relays.json. Added, never replaced.
  const paths = liveWorldPaths();
  // SPIRIT-3 GOES FIRST, and that turns out to be the whole of "properly
  // bound".
  //
  // hub.loadRelayUrl takes relays[0] and nothing else, so claim, send,
  // invite and contact all dial whatever sits at the front. This node's
  // front entry was a lab relay on 65425 that was not running, so every
  // one of those verbs was being refused by a dead box on loopback while
  // the row on spirit-3 sat there unused.
  //
  // labPopulate does the exact opposite deliberately, and says so: the
  // lab relay goes first when a LAB world is being built. The two are a
  // pair, and pressing one undoes the other's ordering — which is right,
  // because they are asking for different worlds.
  //
  // Nothing is dropped. The lab relay keeps its row, just not the front.
  const relays = readJson(paths.relays, []).filter(function (r) { return r && r.url; });
  const others = relays.filter(function (r) { return r.url !== LIVE_RELAY; });
  const wasFirst = relays.length > 0 && relays[0].url === LIVE_RELAY;
  if (!wasFirst) {
    const ordered = [{ label: LIVE_LABEL, url: LIVE_RELAY }].concat(others);
    fs.writeFileSync(paths.relays, JSON.stringify(ordered, null, 2) + '\n');
    steps.push('spirit-3 moved to the FRONT of the work relays.json -- loadRelayUrl ' +
      'takes relays[0], so this is what every /api/hub verb now dials' +
      (others.length ? ' (' + others.length + ' other row(s) kept, just not first)' : ''));
  } else {
    steps.push('work node already dials spirit-3 first');
  }

  // 2b. And the shell's own idea of being bound. A row on a relay and a
  //     label in session.json are different facts, and only the second
  //     decides whether this node opens a desktop or opens Natter alone.
  const workBound = writeSession(WORK_HOME, me.name, steps, 'work node');

  // 3. The peer gets a row on spirit-3, the real way: the owner mints an
  //    invite, the peer consumes it. A hand-written allow entry would
  //    prove nothing about whether joining works.
  const peerIdFile = path.join(peer.home, 'relay-state', 'identity.json');
  let peerId = readJson(peerIdFile, null);
  if (!peerId || !peerId.publicKey) {
    // The node makes its own on first claim; poke it so it exists.
    await livePost('http://127.0.0.1:' + peer.port + '/api/spirit',
      { verb: 'relay.claim', name: peerName });
    await napFor(800);
    peerId = readJson(peerIdFile, null);
  }
  if (!peerId || !peerId.publicKey) {
    return { status: 502, error: peerName + ' has no identity yet — is it running?' };
  }

  const census = await fetch(LIVE_RELAY + '/api/relay/who')
    .then(function (r) { return r.json(); })
    .catch(function () { return null; });
  if (!census) return { status: 502, error: 'spirit-3 did not answer /api/relay/who' };

  const already = (census.peers || []).some(function (r) { return r.publicKey === peerId.publicKey; });
  if (already) {
    steps.push(peerName + ' already has a row on spirit-3');
  } else {
    const auth = require('../../run/js/relayAuth');
    // ASKED OF THE WORK NODE, not of spirit-3 directly.
    //
    // /api/relay/invite is gone (decision 0010): a mint is a post to the
    // relay, and the relay answers on the ASKER'S STREAM rather than in
    // the response. The work node is already holding that stream; minting
    // from here with Andy's key would mean opening a second one and
    // displacing the first, which would knock his running node off the
    // relay this button exists to bind things to.
    //
    // So the node mints, which is what Natter's own button does. One less
    // thing this file does by hand, which is the direction the GAPS list
    // has always pointed.
    const minted = await postToRelayVia(
      'http://127.0.0.1:' + WORK_PORT, LIVE_RELAY,
      { invite: { label: peerName, days: 7, token: '' } }
    );
    // `{invite:{…}}` NOW, not the invite itself. The door used to unwrap
    // the relay's answer and pass the inner object through; with the door
    // gone, what arrives is what the relay actually said.
    //
    // `name: me.name` went too, and never mattered: the relay reads the
    // owner's name out of allow.json, because the only sender who reaches
    // that line IS the owner.
    const token = minted.body && minted.body.invite && minted.body.invite.token;
    if (!minted.ok || !token) {
      return { status: 502, error: 'spirit-3 refused the invite: ' + minted.text };
    }
    const joined = await livePost(LIVE_RELAY + '/api/relay/claim', {
      name: peerName,
      publicKey: peerId.publicKey,
      sig: auth.sign(peerId.privateKey, auth.claimMessage(peerName)),
      invite: token,
    });
    if (!joined.ok && !(joined.body && joined.body.error === 'name taken')) {
      return { status: 502, error: 'spirit-3 refused the claim: ' + joined.text };
    }
    steps.push(peerName + ' claimed a row on spirit-3 with an owner-minted invite');
  }

  // 4. The peer's own node learns about spirit-3, so it holds a stream
  //    there — a row without a stream is a name, not a presence.
  // THE SAME ORDERING, ON THE PEER, and it is not optional either.
  //
  // A lab node's tree is copied from spirit/run, so it inherits the same
  // relays.json — lab relay first. That is why the contact step below kept
  // failing with ECONNREFUSED 65425 even after the work node was fixed:
  // it was the PEER dialling a dead box, not the work node.
  //
  // A row on spirit-3 and a stream to spirit-3 are different things, and
  // neither is "properly bound" on its own. This is the second.
  const theirRelays = path.join(peer.home, 'app', 'natter', 'relays.json');
  const theirRows = readJson(theirRelays, []).filter(function (r) { return r && r.url; });
  const theirOthers = theirRows.filter(function (r) { return r.url !== LIVE_RELAY; });
  const theirFirst = theirRows.length > 0 && theirRows[0].url === LIVE_RELAY;
  if (!theirFirst) {
    fs.writeFileSync(theirRelays, JSON.stringify(
      [{ label: LIVE_LABEL, url: LIVE_RELAY }].concat(theirOthers), null, 2) + '\n');
    handleStop(peer);
    const freePeer = Date.now() + 8000;
    while (portHasListener(peer.port) && Date.now() < freePeer) await napFor(200);
    handleStart(peer);
    const backUp = await waitForNode(peer.port, 20000);
    steps.push(backUp
      ? peerName + ' dials spirit-3 FIRST now, and was restarted to read it'
      : peerName + ' was restarted but never answered on ' + peer.port);
    if (!backUp) return { status: 502, error: peerName + ' did not come back up on ' + peer.port };
  } else {
    steps.push(peerName + ' already dials spirit-3 first');
  }

  // 4b. The work node is restarted if its order changed -- relays.json is
  //     read at boot, so a reordering nobody restarted for is a file that
  //     disagrees with the running process.
  if (!wasFirst) {
    const work = findNode(WORK_ID);
    if (work) {
      handleStop(work);
      // The port has to be FREE before the next one binds it, or the new
      // child dies on EADDRINUSE and every later step reports something
      // unrelated.
      const free = Date.now() + 8000;
      while (portHasListener(work.port) && Date.now() < free) await napFor(200);
      handleStart(work);
      const up = await waitForNode(work.port, 20000);
      steps.push(up ? 'work node restarted so it reads the new order'
        : 'work node was restarted but never answered on ' + work.port);
      if (!up) return { status: 502, error: 'the work node did not come back up on ' + work.port };
    }
  }

  // 4c. The same for the peer, which has NEVER had one: session.json is
  //     gitignored, so a clone cannot bring it, and a fresh lab
  //     node therefore always opens to Natter alone until somebody claims
  //     through the UI by hand.
  const peerBound = writeSession(peer.home, peerName, steps, peerName);
  if (peerBound) {
    handleStop(peer);
    const freeAgain = Date.now() + 8000;
    while (portHasListener(peer.port) && Date.now() < freeAgain) await napFor(200);
    handleStart(peer);
    const readable = await waitForNode(peer.port, 20000);
    if (!readable) return { status: 502, error: peerName + ' did not come back after its session was written' };
  }

  // 5. They know each other, through their own nodes — the route a
  //    person uses, so this exercises the real path.
  //
  //    A short wait first: both nodes answer HTTP before their relay
  //    streams are open, and a contact written while presence is still
  //    settling is correct but looks wrong in the panel a second later.
  await napFor(2000);
  const there = await livePost('http://127.0.0.1:' + peer.port + '/api/spirit', {
    verb: 'peer.acquire', publicKey: me.publicKey,
  });
  const back = await livePost('http://127.0.0.1:' + WORK_PORT + '/api/spirit', {
    verb: 'peer.acquire', publicKey: peerId.publicKey,
  });
  steps.push(there.ok && back.ok
    ? 'the two nodes have each other in their address books'
    : 'contacts: ' + (there.ok ? back.text : there.text));

  const report = await liveWorldReport(peer, peerName);
  return { status: 200, ok: true, steps: steps, report: report };
}

const server = http.createServer(function (req, res) {
  const url = new URL(req.url, 'http://127.0.0.1:' + MASTER_PORT);
  const pathname = decodeURIComponent(url.pathname);

  if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
    fs.readFile(PANEL_FILE, function (err, data) {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('labMastPanel.html missing');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/nodes') {
    sendJson(res, 200, { nodes: nodes.map(publicNode) });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/nodes') {
    readJsonBody(req).then(function (body) {
      const result = handleCreate(body);
      sendJson(res, result.status, result.node ? result : { error: result.error });
    }).catch(function () {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Invalid JSON body');
    });
    return;
  }

  // WHICH RELAYS IS EACH NODE ACTUALLY HOLDING OPEN.
  //
  // The table said id, name, type, port and running, and none of those
  // answers the question the panel is usually being asked: is my little
  // network actually talking to anything? Andy looked at it, saw no
  // column for it, and reasonably concluded nothing was connected — when
  // in fact every node was.
  //
  // Read from each node's own relay-presence job over loopback. A node
  // that is not running, or is running older code, simply reports
  // nothing; this is a convenience, never a source of truth about
  // anything but itself.
  if (req.method === 'GET' && pathname === '/api/links') {
    Promise.all(nodes.map(function (n) {
      // The same test publicNode uses for `running`: a child we spawned,
    // or a listener on the port. Asking only the second was how this
    // column came back empty for every node while every node was up.
    const child = children[n.id];
    const alive = !!(child && child.exitCode == null) || portHasListener(n.port);
    if (!alive) return Promise.resolve([n.id, null]);
      return fetch('http://127.0.0.1:' + n.port + '/api/spirit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verb: 'jobs.list' }),
      })
        .then(function (res) { return res.json(); })
        .then(function (jobs) {
          const job = (jobs || []).filter(function (j) { return j.type === 'relay-presence'; })[0];
          if (!job) return [n.id, null];
          // The log is the record of what happened; the last line about
          // each URL is its current state.
          const state = Object.create(null);
          (job.log || []).forEach(function (line) {
            const connected = /^connected to (.+)$/.exec(line.message || '');
            const lost = /^lost (.+?): /.exec(line.message || '');
            if (connected) state[connected[1]] = true;
            else if (lost) state[lost[1]] = false;
          });
          const presence = (job.data && job.data.presence) || {};
          return [n.id, {
            relays: Object.keys(state).map(function (url) {
              return { url: url, up: state[url] };
            }),
            reachable: Object.keys(presence).filter(function (k) { return presence[k]; }).length,
            known: Object.keys(presence).length,
          }];
        })
        .catch(function () { return [n.id, null]; });
    })).then(function (pairs) {
      const out = Object.create(null);
      pairs.forEach(function (pair) { out[pair[0]] = pair[1]; });
      sendJson(res, 200, { links: out });
    }).catch(function () {
      sendJson(res, 200, { links: {} });
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/live-world') {
    const peerName = slugName(url.searchParams.get('peer') || 'jazz') || 'jazz';
    liveWorldReport(findNode(peerName), peerName)
      .then(function (report) { sendJson(res, 200, report); })
      .catch(function (err) { sendJson(res, 500, { error: String(err.message || err) }); });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/live-world') {
    readJsonBody(req).then(function (body) {
      return buildLiveWorld(body);
    }).then(function (result) {
      sendJson(res, result.status, result.ok ? result : { error: result.error });
    }).catch(function (err) {
      sendJson(res, 500, { error: String(err.message || err) });
    });
    return;
  }

  const action = pathname.match(/^\/api\/nodes\/([^/]+)(?:\/(start|stop|recycle|refresh|delete))?$/);
  if (req.method === 'POST' && action) {
    const id = action[1];
    const verb = action[2] || 'rename';
    const node = findNode(id);
    if (!node) {
      sendJson(res, 404, { error: 'not found' });
      return;
    }
    readJsonBody(req).then(function (body) {
      let result;
      if (verb === 'rename') result = handleRename(node, body);
      else if (verb === 'start') result = handleStart(node);
      else if (verb === 'stop') result = handleStop(node);
      else if (verb === 'recycle') result = handleRecycle(node);
      else if (verb === 'refresh') result = handleRefresh(node);
      else if (verb === 'delete') result = handleDelete(node);
      else result = { status: 404, error: 'not found' };
      sendJson(res, result.status, result.node || result.ok ? result : { error: result.error });
    }).catch(function () {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Invalid JSON body');
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.on('error', function (err) {
  if (err.code === 'EADDRINUSE') {
    console.error('labMaster already running on 65420, or something else is.');
  } else {
    console.error(err.message);
  }
  process.exit(1);
});

server.listen(MASTER_PORT, '127.0.0.1', function () {
  console.log('labMaster http://localhost:' + MASTER_PORT);
});

process.on('exit', function () {
  Object.keys(children).forEach(function (id) {
    const node = findNode(id);
    if (node && node.permanent) return;
    try { children[id].kill(); } catch (e) { /* already gone */ }
  });
});
