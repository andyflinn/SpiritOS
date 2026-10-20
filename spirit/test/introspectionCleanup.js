'use strict';

// spirit/test/introspectionCleanup.js
// goal/G30.4, "Clean up introSpector and its usage". Red on today's tree; claude-windows writes it and builds it.
// The item's box (v13), in short:
//   - introSpector is family(folder) alone. claim moves into verbTable ("a namespace container is not known by the
//     namespace"). A module declares its verbs bare and the mounter gives it its family name ("a module shouldn't
//     know who mounted it").
//   - One flat table of families, the node's own and its apps' side by side; jobs.api stays the way apps join it.
//     A loopback client's introspection answers that one table; the appClient branch is no longer separate.
//   - The grant system sees every family; a grant path is family or family.verb whichever family it names. A peer
//     call reaches a node family through the same handler as the loopback API, in-process, after the grant check
//     ("1 handler, grant-system covers all").
//   - Warnings are files: <verb>.warning.txt beside the verb's description file; AGENTS.<verb> carries the text, and
//     the grants app shows it before that grant. This item adds one: js/jobs/authGrant.warning.txt.
//   - An app server named like a node family is refused at mount, by name.
//   - The grants app's picker lists apiDoor's whole table.
// NAMED HERE where the box names none:
//   - introSpector exports family and AGENTS_FILE only.
//   - verbTable's table gains mount(family, dir, declarations, opts) (bare verb names in, family.verb on the table,
//     the folder's AGENTS family beside them), call(verb, args) (the in-process call puppetMode's shim made, now the
//     table's, answering { ok, status, body }), tree() ({family: {verb: {request, reply}}} of what it mounted) and
//     door(appClient) ({ ask(body, caller) }: 'api' answers the node's families and the apps' in one object; a call
//     to a node family runs through call, any other goes to the apps).
//   - puppetMode and apiDoor run node verbs through table.call; puppetMode keeps no shim of its own.
//   - createAppClient({ reserved }) refuses to register an app whose name reserved() lists.
// rule/11: through testSupport only; its own scratch folders.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G30.4: ';
const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
const code = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); } catch (e) { return ''; } };
function json(rs) { return { writeHead: function (c) { rs.status = c; return this; }, setHeader: function () {}, end: function (t) { rs.body = t; } }; }

test.startTest('goal/G30.4: introSpector is family alone; one flat table of families, one handler, grants over all of it');

async function main() {
  test.subHeading('1. introSpector is family alone');
  const intro = require('../run/js/introSpector');
  const keys = Object.keys(intro).sort().join(',');
  if (keys === 'AGENTS_FILE,family') test.check('introSpector exports family and AGENTS_FILE only (claim is gone)');
  else test.fail(OWED + 'introSpector exports ' + keys);

  // A module folder of its own, its verbs bare.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-cleanup-module-'));
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# a module\n');
  fs.writeFileSync(path.join(dir, 'stat.json'), JSON.stringify({ description: 'how big a file is' }));
  fs.writeFileSync(path.join(dir, 'stat.warning.txt'), 'stat reads your disc');
  const fam = intro.family(dir, { declared: ['stat'] });
  let statAnswer = null;
  try { statAnswer = fam.verbs['AGENTS.stat'] && fam.verbs['AGENTS.stat'].handler({}); } catch (e) { statAnswer = { threw: e.message }; }
  if (statAnswer && statAnswer.warning === 'stat reads your disc') test.check('AGENTS.<verb> carries the text of <verb>.warning.txt when the file is there');
  else test.fail(OWED + 'AGENTS.stat answered ' + short(statAnswer));

  test.subHeading('2. verbTable mounts a module under a name it gives');
  const table = require('../run/js/verbTable').createVerbTable();
  const handled = [];
  const decl = { stat: { request: { path: '' }, reply: { size: 0 }, handler: function (rq, rs) {
    let t = ''; rq.on('data', function (c) { t += c; }); rq.on('end', function () { handled.push(t); rs.writeHead(200); rs.end(JSON.stringify({ size: 7 })); });
  } } };
  let mounted = false;
  try { mounted = typeof table.mount === 'function' && table.mount('xfs', dir, decl, { wire: false }); } catch (e) { mounted = 'threw ' + e.message; }
  if (mounted === true && typeof table.handlerFor('xfs.stat') === 'function' && typeof table.handlerFor('xfs.AGENTS.introspect') === 'function')
    test.check('mount(\'xfs\', folder, {stat}) puts xfs.stat and xfs.AGENTS.introspect on the table: the module declared stat bare');
  else test.fail(OWED + 'mount answered ' + short(mounted));
  let called = null;
  try { called = typeof table.call === 'function' ? await table.call('xfs.stat', { path: 'a' }) : null; } catch (e) { called = { threw: e.message }; }
  if (called && called.ok === true && called.body && called.body.size === 7) test.check('table.call(\'xfs.stat\', args) runs the same handler in-process and answers {ok, status, body}');
  else test.fail(OWED + 'table.call answered ' + short(called));
  let tree = null;
  try { tree = typeof table.tree === 'function' ? table.tree() : null; } catch (e) { tree = { threw: e.message }; }
  if (tree && tree.xfs && tree.xfs.stat && tree.xfs.stat.request && typeof tree.xfs.stat.request.path === 'string') test.check('table.tree() answers {xfs: {stat: {request, reply}}}');
  else test.fail(OWED + 'table.tree() answered ' + short(tree));

  test.subHeading('3. one door, one flat table');
  const fakeApps = {
    ask: function (body) {
      if (body === 'api') return Promise.resolve({ status: 200, body: { desk: { items: { request: {}, reply: {} } } } });
      return Promise.resolve({ status: 200, body: { from: 'apps', asked: body } });
    },
  };
  let door = null;
  try { door = typeof table.door === 'function' ? table.door(fakeApps) : null; } catch (e) { door = null; }
  let flat = null;
  try { flat = door ? (await door.ask('api', { owner: true })).body : null; } catch (e) { flat = { threw: e.message }; }
  if (flat && flat.xfs && flat.desk && Object.keys(flat).indexOf('apps') === -1) test.check('the door\'s api answers one flat object: the node\'s families (xfs) beside the apps\' (desk)');
  else test.fail(OWED + 'the door\'s api answered ' + short(flat));
  let toNode = null;
  let toApp = null;
  try { toNode = door ? await door.ask({ xfs: { stat: { path: 'b' } } }, { owner: true }) : null; toApp = door ? await door.ask({ desk: { items: {} } }, { owner: true }) : null; } catch (e) { toNode = { threw: e.message }; }
  if (toNode && toNode.body && toNode.body.size === 7 && toApp && toApp.body && toApp.body.from === 'apps') test.check('a call to a node family runs through table.call; a call to an app goes to the apps');
  else test.fail(OWED + 'the door routed ' + short(toNode) + ' and ' + short(toApp));

  test.subHeading('4. the grant gate over every family');
  const apiDoor = require('../run/js/apiDoor');
  const granted = door ? await apiDoor.answer(door, { xfs: { stat: { path: 'c' } } }, { key: 'K1', auth: { pathsOf: function () { return ['xfs.stat']; } } }) : null;
  const refused = door ? await apiDoor.answer(door, { xfs: { stat: { path: 'd' } } }, { key: 'K2', auth: { pathsOf: function () { return ['desk']; } } }) : null;
  if (granted && granted.body && granted.body.size === 7 && refused && refused.body && refused.body.code === 'not-granted')
    test.check('a peer granted xfs.stat reaches the node family through the same handler; a peer without it is refused not-granted');
  else test.fail(OWED + 'granted answered ' + short(granted) + ', ungranted ' + short(refused));
  const peerTree = door ? await apiDoor.answer(door, 'api', { key: 'K1', auth: { pathsOf: function () { return ['xfs.stat']; } } }) : null;
  if (peerTree && peerTree.body && peerTree.body.xfs && peerTree.body.xfs.stat && !peerTree.body.desk) test.check('a peer\'s api shows only its granted part of the flat table');
  else test.fail(OWED + 'a peer\'s api answered ' + short(peerTree));

  test.subHeading('5. no app named like a node family');
  let refusedName = null;
  try {
    const apps = require('../run/js/appClient').createAppClient({ rootDir: dir, reserved: function () { return ['fs', 'xfs']; } });
    refusedName = { xfs: apps.register('xfs', '\\\\.\\pipe\\x'), other: apps.register('otherapp', '\\\\.\\pipe\\y') };
  } catch (e) { refusedName = { threw: e.message }; }
  if (refusedName && refusedName.xfs === false && refusedName.other === true) test.check('an app named like a node family (xfs) is refused at register; another name mounts');
  else test.fail(OWED + 'register answered ' + short(refusedName));
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* busy */ }

  test.subHeading('6. the node uses it');
  const server = code('js/server.js');
  if (!/introSpector\.claim\(/.test(server) && !/'(net|jobs|config|fs|node|owner|relay|contact|peer)\.[a-zA-Z]+':\s*\{/.test(server) && /loopbackVerbs\.mount\(/.test(server))
    test.check('server.js mounts each node module with bare verbs; no introSpector.claim and no family.verb names in its declarations');
  else test.fail(OWED + 'server.js still claims through introSpector or names verbs with their family');
  if (/loopbackVerbs\.door\(/.test(server) && /createApiDoor\(\{[\s\S]{0,200}servers:\s*nodeDoor/.test(server)) test.check('apiDoor and jobs.api go through the one door (nodeDoor)');
  else test.fail(OWED + 'server.js does not hand apiDoor the one door');
  const pm = code('js/puppetMode.js');
  if (!/function shim\(/.test(pm) && /\.call\(/.test(pm)) test.check('puppetMode runs node verbs through table.call and keeps no shim of its own');
  else test.fail(OWED + 'puppetMode still has its own shim');

  test.subHeading('7. the warning, and the grants app');
  let warn = '';
  try { warn = fs.readFileSync(path.join(RUN, 'js', 'jobs', 'authGrant.warning.txt'), 'utf8').trim(); } catch (e) { warn = ''; }
  if (warn.length) test.check('js/jobs/authGrant.warning.txt is there: ' + short(warn));
  else test.fail(OWED + 'js/jobs/authGrant.warning.txt is missing');
  const grants = code('shell/grants/grants.js');
  if (/warning/.test(grants) && /AGENTS\./.test(grants)) test.check('the grants app asks AGENTS.<verb> and shows its warning before the grant');
  else test.fail(OWED + 'the grants app shows no warning');
  const picker = code('shell/js/appServerSelector.js');
  if (!/jobs\.api/.test(picker) || /every family|whole table/.test(picker)) test.check('the picker reads the whole flat table');
  else test.fail(OWED + 'the picker still reads the apps\' branch only');
}

main().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  setTimeout(function () { test.reportSuccessFailureCount(); process.exit(0); }, 50);
});
