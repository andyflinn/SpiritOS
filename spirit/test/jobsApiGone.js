'use strict';

// spirit/test/jobsApiGone.js
// goal/G30.6, "Fix all modules in SpiritOS that still use jobs.api". Red on today's tree; claude-windows writes it and
// builds it (one agent).
// The item's box (v4), in short:
//   - jobs is for launching and tracking appServer processes and other local (transient) processes; it is NOT an api
//     hub. Every module that still calls jobs.api moves to the flat apiDoor on /api/spirit; then jobs.api is deleted.
//   - A call becomes the verb itself on /api/spirit ({verb: desk.item.get, id}); the tree becomes {verb: api}.
//   - The shell apps, the server processes, and what reaches through them (desk plugins, deskChat, the selectors,
//     listSearch) all move.
//   - The owner door (puppetDoor) moves to the flat door too: an owner command names the verb itself
//     (deskAgent.<verb>, api) and reaches the app that serves it.
//   - The jobs api verb goes from server.js, with every mention of it in the core files and the suites.
//   - Peers are untouched: they reach apiDoor by peerPost.
// NAMED HERE where the box names none:
//   - The door's in-process call is door(apps).call(verb, args) -> {ok, status, body}: a node family verb through the
//     table's call, 'api' the flat table, family.verb through ask; server.js hands puppetDoor nodeDoor.call.
//   - "Every mention": no .js or .json file under spirit/run (node_modules aside) or spirit/test names jobs.api, this
//     suite aside.
// rule/11: through testSupport only; its own scratch folders.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G30.6: ';
const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const code = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); } catch (e) { return ''; } };
function walk(dir, out) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  entries.forEach(function (e) {
    // Not code: the desk's shared record of the current goal (its box text) and the vault.
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'relay-state' || e.name === 'brains' || e.name === 'currentGoal.json') return;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|json)$/.test(e.name)) out.push(p);
  });
  return out;
}

(async function () {
  test.startTest('goal/G30.6: nothing calls jobs.api; jobs launches processes, the flat apiDoor answers api');

  test.subHeading('1. no module, core file or suite names jobs.api');
  const files = walk(RUN, []).concat(walk(__dirname, [])).filter(function (f) { return path.basename(f) !== 'jobsApiGone.js'; });
  const naming = files.filter(function (f) { try { return /jobs\.api\b/.test(fs.readFileSync(f, 'utf8')); } catch (e) { return false; } })
    .map(function (f) { return path.relative(path.join(__dirname, '..'), f).split(path.sep).join('/'); });
  if (!naming.length) test.check('no .js or .json file under spirit/run or spirit/test names jobs.api');
  else test.fail(OWED + naming.length + ' files still name jobs.api: ' + short(naming.slice(0, 12)));

  test.subHeading('2. jobs declares no api');
  const server = code('js/server.js');
  const jobsMount = (/loopbackVerbs\.mount\('jobs'[\s\S]*?\}, \{ wire: false, by: 'server\.js' \}\);/.exec(server) || [''])[0];
  if (jobsMount && !/'api':\s*\{/.test(jobsMount)) test.check('the jobs mount in server.js declares no api verb');
  else test.fail(OWED + (jobsMount ? 'the jobs mount still declares api' : 'the jobs mount was not found'));

  test.subHeading('3. the door calls in-process, for the owner door');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'g306-'));
  const table = require('../run/js/verbTable').createVerbTable();
  table.mount('xfs', dir, {
    stat: { request: { path: '' }, reply: { size: 0 }, handler: function (rq, rs) { rs.writeHead(200, { 'Content-Type': 'application/json' }); rs.end(JSON.stringify({ size: 7 })); } },
  }, { wire: false, by: 'test' });
  const asked = [];
  const door = table.door({
    apps: function () { return ['desk']; },
    ask: function (body) {
      asked.push(body);
      if (body === 'api') return Promise.resolve({ status: 200, body: { desk: { items: { request: {}, reply: {} } } } });
      return Promise.resolve({ status: 200, body: { from: 'apps', asked: body } });
    },
  });
  const has = typeof door.call === 'function';
  const viaNode = has ? await door.call('xfs.stat', { path: 'a' }) : null;
  const viaApi = has ? await door.call('api', {}) : null;
  const viaApp = has ? await door.call('desk.item.get', { id: 'g' }) : null;
  const viaNone = has ? await door.call('nope.x', {}) : null;
  if (viaNode && viaNode.ok && viaNode.body && viaNode.body.size === 7) test.check('door.call runs a node family verb (xfs.stat) through its handler');
  else test.fail(OWED + 'door.call(xfs.stat) answered ' + short(viaNode));
  if (viaApi && viaApi.ok && viaApi.body && viaApi.body.xfs && viaApi.body.desk) test.check('door.call(\'api\') answers the flat table');
  else test.fail(OWED + 'door.call(api) answered ' + short(viaApi));
  const sent = asked.filter(function (b) { return b && b.desk && b.desk['item.get']; })[0];
  if (viaApp && viaApp.ok && viaApp.body && viaApp.body.from === 'apps' && sent && sent.desk['item.get'].id === 'g') test.check('door.call(\'desk.item.get\') reaches the app that serves desk');
  else test.fail(OWED + 'door.call(desk.item.get) answered ' + short(viaApp));
  if (viaNone && viaNone.ok === false && viaNone.code === 'no-such-verb') test.check('a family nobody serves is no-such-verb');
  else test.fail(OWED + 'door.call(nope.x) answered ' + short(viaNone));
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* busy */ }
  if (/puppetDoor\(\{[\s\S]{0,300}?call: function \(verb, args\) \{ return nodeDoor\.call\(verb, args\); \}/.test(server)) test.check('server.js hands the owner door nodeDoor.call, so an owner command reaches app verbs');
  else test.fail(OWED + 'the owner door still calls the node verb table alone');

  test.subHeading('4. the shell asks the flat door');
  if (/spirit\.core\.ask\('api'/.test(code('shell/js/appServerSelector.js'))) test.check('appServerSelector reads the tree with the verb api');
  else test.fail(OWED + 'appServerSelector does not ask api');
  const deskApp = code('shell/desk/desk.js');
  if (deskApp && /\.verb\(\s*'desk\.'\s*\+|verb\('desk\.'/.test(deskApp)) test.check('the desk app calls desk verbs by name (desk.<verb>)');
  else test.fail(OWED + 'the desk app does not call desk.<verb>');

  test.reportSuccessFailureCount();
  process.exit(0);
}()).catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
