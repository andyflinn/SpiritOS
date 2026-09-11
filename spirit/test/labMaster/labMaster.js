'use strict';

// Local lab control plane. Always http://127.0.0.1:65420
// Not copied into fake nodes (lives under spirit/test/).

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');
const buildStamp = require('../../run/js/buildStamp');

const MASTER_PORT = 65420;
const WORK_PORT = 65432;
const WORK_ID = 'work';
const LAB_PORT_MIN = 65400;
const LAB_PORT_MAX = 65429;

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const WORK_HOME = path.join(REPO_ROOT, 'spirit', 'run');
const FAKES_ROOT = path.join(os.tmpdir(), 'spiritos-relay-fakes');
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
    home: n.home || path.join(FAKES_ROOT, n.id, 'spirit', 'run').replace(/\\/g, '/'),
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
  };
}

// The one destructive operation in this file, so it is written to be
// hard to misuse rather than short.
//
// Three guards, none of them theatre: the id must be a slug (so it can
// carry no separators and no ..), the resolved path must sit strictly
// INSIDE the fakes root, and it must not be the work home. A tool that
// deletes directories on a developer's machine earns all three — and the
// work node is a real checkout, not a copy.
function homeRootFor(id) {
  const slug = slugName(id);
  if (!slug) return null;
  const target = path.resolve(FAKES_ROOT, slug);
  const inside = path.resolve(FAKES_ROOT) + path.sep;
  if (!target.startsWith(inside)) return null;
  if (target === path.resolve(WORK_HOME)) return null;
  return target;
}

// A NODE THAT IS RECREATED OR RECYCLED MUST BE CLEAN. It was not:
// copyTrackedSpirit writes the git-tracked files over whatever is
// already there, and relay-state, device.json, session.json and
// minted.json are none of them tracked — so they survived. A "new" lab
// relay could boot owned by a previous run's key, and be unclaimable by
// the suite that had just asked for it.
//
// That cost an afternoon of debugging a relay that remembered something
// it should not have.
function wipeHome(id) {
  const target = homeRootFor(id);
  if (!target) return false;
  try { fs.rmSync(target, { recursive: true, force: true }); }
  catch (err) { return false; }
  return true;
}

function copyTrackedSpirit(id) {
  const relativePaths = execSync('git ls-files -- spirit ":!spirit/test"', {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  }).split('\n').filter(Boolean);

  // Cleared first, so what lands is exactly the tracked tree and nothing
  // a previous life left behind.
  wipeHome(id);
  const targetRoot = path.join(FAKES_ROOT, id);
  // A copy is a tree, not a repository, so it cannot answer "which
  // commit am I" by itself. Stamped here, with the commit it was taken
  // from — otherwise every fake node reports `unknown` and a suite
  // cannot tell a node running the code under test from one running
  // whatever was there last week.
  const stamp = buildStamp.fromGit(REPO_ROOT);

  // Said out loud, because the alternative is a fake node that runs
  // without a module you just wrote and fails somewhere unrelated. The
  // count rides along in the stamp too, so the node itself can admit it
  // may be incomplete (GET /api/version).
  const missing = buildStamp.missingFromCopy(REPO_ROOT);
  if (missing.length) {
    console.warn('labMaster: ' + missing.length + ' untracked file(s) under spirit/ will NOT ' +
      'reach ' + id + ' — `git add` them first:\n  ' + missing.join('\n  '));
  }
  // A TRACKED FILE THAT IS NOT ON DISK IS SKIPPED, not fatal.
  //
  // `git ls-files` reads the INDEX, and the index happily lists a file
  // that has since been deleted from the working tree — a `git rm` not
  // yet committed, a transient file somebody staged by reflex with
  // `git add -A`. One of those made every node creation fail with an
  // ENOENT about a path nobody recognised, which is a long way from
  // "a file in the index is missing".
  //
  // Counted and reported rather than silently ignored: a fake node built
  // without something it needs is the bug missingFromCopy already exists
  // to prevent from the other direction.
  const absent = [];
  relativePaths.forEach(function (relPath) {
    const source = path.join(REPO_ROOT, relPath);
    if (!fs.existsSync(source)) { absent.push(relPath); return; }
    const dest = path.join(targetRoot, relPath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(source, dest);
  });
  if (absent.length) {
    console.warn('labMaster: ' + absent.length + ' file(s) are in the index but not on disk, ' +
      'so ' + id + ' was built without them:\n  ' + absent.join('\n  '));
  }
  const runDir = path.join(targetRoot, 'spirit', 'run');
  if (stamp) {
    buildStamp.write(runDir, Object.assign({}, stamp, { untracked: missing.length }));
  }
  return runDir;
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
  try { home = copyTrackedSpirit(id); }
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
  };
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
  if (!node.permanent && !fs.existsSync(path.join(node.home, 'js', 'server.js'))) {
    try { node.home = copyTrackedSpirit(node.id).replace(/\\/g, '/'); }
    catch (err) { return { status: 500, error: String(err.message || err) }; }
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

function handleRecycle(node) {
  if (node.permanent) return { status: 403, error: 'cannot recycle work node' };
  stopNode(node);
  try { node.home = copyTrackedSpirit(node.id).replace(/\\/g, '/'); }
  catch (err) { return { status: 500, error: String(err.message || err) }; }
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
      return fetch('http://127.0.0.1:' + n.port + '/api/jobs')
        .then(function (res) { return res.json(); })
        .then(function (jobs) {
          const job = (jobs || []).filter(function (j) { return j.type === 'relay-presence'; })[0];
          if (!job) return [n.id, null];
          // The log is the record of what happened; the last line about
          // each URL is its current state.
          const state = Object.create(null);
          (job.log || []).forEach(function (line) {
            const connected = /^connected to (.+)$/.exec(line.message || '');
            const lost = /^lost (\S+?):/.exec(line.message || '');
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

  const action = pathname.match(/^\/api\/nodes\/([^/]+)(?:\/(start|stop|recycle|delete))?$/);
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
