'use strict';

// spirit/test/grantFace.js
// cleanup/G1.9: grantFace grants DNS name slots to IDs, protects them, deletes
// them by ID or by name; appFaceApp asks it instead of reading grants.json.
//
// The contract this suite fixes (the builder follows it):
//   process/js/grantFace/grantFace.js, an appServer started with --pipe and --state
//   grant  {name, id}  -> {name, id}; a name held by another id is refused (409)
//   delete {name, id}  -> {removed: n}; one of the two is '', the other chooses
//   get    {name}      -> {name, id}; id is '' when nobody holds it
//   its database lives in its --state folder; node.db is never touched
//   appFaceApp answers route? by api.toLocalApp('grantFace', POST {get: {name}})

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const REPO = path.join(__dirname, '..', '..');
const RUN = path.join(REPO, 'spirit', 'run');
const SCRIPT = path.join(RUN, 'process', 'js', 'grantFace', 'grantFace.js');
const OWED = 'OWED by cleanup/G1.9: ';
const ID_A = 'MCowBQYDK2VwAyEAidaidaidaidaidaidaidaidaidaidaidaidaidai=';
const ID_B = 'MCowBQYDK2VwAyEAidbidbidbidbidbidbidbidbidbidbidbidbidbi=';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function code(file) {
  return fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1');
}

async function serverPart() {
  test.subHeading('grantFace is an app server of its own, outside the core');
  const manifest = path.join(RUN, 'process', 'js', 'grantFace', 'grantFace.json');
  let m = null;
  try { m = JSON.parse(fs.readFileSync(manifest, 'utf8')); } catch (e) { m = null; }
  if (m && m.kind === 'server') test.check('process/js/grantFace/grantFace.json names a server');
  else test.fail(OWED + 'no server manifest at process/js/grantFace/grantFace.json');
  if (!fs.existsSync(SCRIPT)) {
    test.fail(OWED + 'process/js/grantFace/grantFace.js does not exist, so nothing below can run');
    return;
  }

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-grantface-'));
  const run = path.join(scratch, 'spirit', 'run');
  const state = path.join(run, 'relay-state', 'process', 'grantFace');
  fs.mkdirSync(state, { recursive: true });
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(run, 'grantFace', 'win32', 'process') : path.join(state, 'door.sock');
  const client = appClient.createAppClient({ rootDir: run });
  client.register('grantFace', pipe);
  const call = function (verb, args) { const b = {}; b[verb] = args; return client.ask({ grantFace: b }); };
  async function start() {
    const kid = spawn(process.execPath, [SCRIPT, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    for (let i = 0; i < 40; i++) {
      await sleep(150);
      try { const r = await client.ask('api'); if (r.body && r.body.grantFace && r.body.grantFace.ok !== false) return kid; } catch (e) { /* not yet */ }
    }
    return kid;
  }
  function stop(kid) { return new Promise(function (r) { if (kid.exitCode !== null) return r(); kid.once('exit', r); kid.kill(); }); }
  const idOf = async function (name) { const r = await call('get', { name: name }); return r.body && typeof r.body.id === 'string' ? r.body.id : '?'; };

  let kid = await start();
  try {
    test.subHeading('grant: a name slot goes to an ID');
    const g = await call('grant', { name: 'join', id: ID_A });
    if (g.status === 200 && g.body && g.body.name === 'join' && g.body.id === ID_A && (await idOf('join')) === ID_A) test.check('join is granted to ID_A, and get says so');
    else test.fail(OWED + 'grant join to ID_A: ' + JSON.stringify(g).slice(0, 160));

    test.subHeading('protect: a slot held by one ID is refused to any other');
    const other = await call('grant', { name: 'join', id: ID_B });
    if (other.status === 409 && other.body && other.body.ok === false && (await idOf('join')) === ID_A) test.check('join for ID_B is refused (409), ID_A keeps it');
    else test.fail(OWED + 'join for ID_B: ' + JSON.stringify(other).slice(0, 160) + ', held by ' + (await idOf('join')).slice(0, 24));
    const again = await call('grant', { name: 'join', id: ID_A });
    if (again.status === 200 && again.body && again.body.id === ID_A) test.check('granting it to its own holder again is fine');
    else test.fail(OWED + 'join for ID_A again: ' + JSON.stringify(again).slice(0, 160));

    test.subHeading('a name is a DNS label, nothing else');
    const bad = await call('grant', { name: 'Not A-Label', id: ID_A });
    if (bad.status >= 400 && (await idOf('Not A-Label')) === '') test.check('a name that is not a-z, 0-9 and - is refused');
    else test.fail(OWED + 'a bad name was answered ' + JSON.stringify(bad).slice(0, 120));

    test.subHeading('delete by name, and by ID');
    await call('grant', { name: 'hello', id: ID_A });
    await call('grant', { name: 'bella', id: ID_B });
    const byName = await call('delete', { name: 'join', id: '' });
    if (byName.status === 200 && (await idOf('join')) === '' && (await idOf('hello')) === ID_A) test.check('delete by name frees join only');
    else test.fail(OWED + 'delete join by name: ' + JSON.stringify(byName).slice(0, 120) + ', join ' + (await idOf('join')).slice(0, 16));
    await call('grant', { name: 'join', id: ID_A });
    test.subHeading('an ID may hold several slots; only names are unique');
    if ((await idOf('join')) === ID_A && (await idOf('hello')) === ID_A) test.check('ID_A holds join and hello at once');
    else test.fail(OWED + 'ID_A should hold join and hello: ' + (await idOf('join')).slice(0, 16) + ' ' + (await idOf('hello')).slice(0, 16));
    const byId = await call('delete', { name: '', id: ID_A });
    const left = [await idOf('join'), await idOf('hello'), await idOf('bella')];
    if (byId.body && byId.body.removed === 2) test.check('delete by ID_A says it removed 2');
    else test.fail(OWED + 'delete by ID_A answered ' + JSON.stringify(byId.body).slice(0, 120));
    if (byId.status === 200 && left[0] === '' && left[1] === '' && left[2] === ID_B) test.check('delete by ID_A frees join and hello; bella (ID_B) stays');
    else test.fail(OWED + 'delete by ID_A: ' + JSON.stringify(byId).slice(0, 120) + ', left ' + left.map(function (s) { return s.slice(0, 16); }).join(' '));

    test.subHeading('it keeps its slots in its own database');
    await stop(kid);
    kid = await start();
    if ((await idOf('bella')) === ID_B) test.check('after a restart bella is still ID_B\'s');
    else test.fail(OWED + 'after a restart bella is held by ' + (await idOf('bella')));
    const dbs = fs.readdirSync(state).filter(function (n) { return /\.db$/.test(n); });
    if (dbs.length === 1) test.check('one database in its state folder: ' + dbs[0]);
    else test.fail(OWED + 'its state folder holds ' + JSON.stringify(fs.readdirSync(state)));
    if (!fs.existsSync(path.join(run, 'relay-state', 'node.db'))) test.check('node.db was never opened');
    else test.fail(OWED + 'grantFace created relay-state/node.db');
  } finally {
    await stop(kid);
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

// appFaceApp on the owner's node answers route? from grantFace, not from a file.
// A copied tree, never a link; grantFace is a stand-in answering get.
async function facePart() {
  test.subHeading('appFaceApp asks grantFace for a route');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-grantface-face-'));
  fs.cpSync(path.join(RUN, 'js'), path.join(root, 'js'), { recursive: true });
  const dir = path.join(root, 'shell', 'appFaceApp');
  fs.cpSync(path.join(RUN, 'shell', 'appFaceApp'), dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'face-domain.json'), JSON.stringify({ faceDomain: 'face.example' }) + '\n');
  // A grants.json saying otherwise: if it is still read, the answer is ID_B.
  fs.writeFileSync(path.join(dir, 'grants.json'), JSON.stringify({ names: { join: { to: ID_B, app: 'faceProof' } } }) + '\n');
  const asked = [];
  const posts = [];
  const witnesses = [];
  const packet = require(path.join(root, 'js', 'client', 'packet.js'));
  require(path.join(root, 'js', 'nodeApps.js')).mountAll({
    rootDir: root,
    arrivals: { witness: function (fn) { witnesses.push(fn); return function () {}; } },
    post: function (a, to, text) { posts.push({ to: to, text: text }); return Promise.resolve({ ok: true }); },
    log: function () {},
    servers: {
      toLocalApp: function (app, req) {
        asked.push({ app: app, req: req });
        let body = {};
        try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch (e) { body = {}; }
        if (app === 'grantFace' && body && body.get) {
          return Promise.resolve({ status: 200, type: 'application/json', body: JSON.stringify({ name: body.get.name, id: body.get.name === 'join' ? ID_A : '' }) });
        }
        return Promise.resolve({ status: 404, body: '{}' });
      },
    },
  });
  const m = { fromKey: ID_A, hash: 'H-route', sentAt: new Date().toISOString(), text: packet.encode('appFaceApp', { verb: 'route?', host: 'join.face.example' }).text };
  witnesses.forEach(function (fn) { fn(m); });
  await sleep(300);
  const answers = posts.map(function (p) { const d = packet.decode(p.text); return d && d.body; }).filter(Boolean);
  const route = answers.filter(function (b) { return b.verb === 'route'; })[0];
  if (!witnesses.length) test.fail(OWED + 'appFaceApp did not mount; the checks below would pass vacuously');
  if (asked.some(function (a) { return a.app === 'grantFace'; })) test.check('route? for join was asked of grantFace');
  else test.fail(OWED + 'appFaceApp never asked grantFace: ' + JSON.stringify(asked).slice(0, 120));
  if (route && route.route === 'owner' && route.to === ID_A) test.check('and answered with grantFace\'s holder, not grants.json\'s');
  else test.fail(OWED + 'route? answered ' + JSON.stringify(route || answers).slice(0, 160));
  fs.rmSync(root, { recursive: true, force: true });
}

function retiredPart() {
  test.subHeading('the stop-gaps grantFace replaces are gone');
  if (!fs.existsSync(path.join(REPO, 'bash', 'face-owner.js'))) test.check('bash/face-owner.js is gone');
  else test.fail(OWED + 'bash/face-owner.js is still there');
  if (!/grants\.json|readGrants/.test(code(path.join(RUN, 'shell', 'appFaceApp', 'appFaceApp.js')))) test.check('appFaceApp.js reads no grants.json');
  else test.fail(OWED + 'appFaceApp.js still reads grants.json');
  if (!/grants\.json/.test(fs.readFileSync(path.join(REPO, '.gitignore'), 'utf8'))) test.check('.gitignore names no grants.json');
  else test.fail(OWED + '.gitignore still names grants.json');
}

test.startTest('cleanup/G1.9: grantFace grants, protects and deletes DNS name slots');
(async function () {
  await serverPart();
  await facePart();
  retiredPart();
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
