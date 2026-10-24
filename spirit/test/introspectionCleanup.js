'use strict';

// spirit/test/introspectionCleanup.js
// goal/G30.4, "Clean up introSpector and its usage". Red on today's tree; claude-windows writes it and builds it.
// The item's box (v13), in short:
//   - introSpector is family(folder) alone. claim moves into verbTable ("a namespace container is not known by the
//     namespace"). A module declares its verbs bare and the mounter gives it its family name ("a module shouldn't
//     know who mounted it").
//   - One flat table of families, the node's own and its apps' side by side (the jobs api verb, the way apps joined
//     it then, went with goal/G30.6: a call is the verb by name on the flat apiDoor).
//     A loopback client's introspection answers that one table; the appClient branch is no longer separate.
//   - The grant system sees every family; a grant path is family or family.verb whichever family it names. A peer
//     call reaches a node family through the same handler as the loopback API, in-process, after the grant check
//     ("1 handler, grant-system covers all").
//   - introSpector always supplies one owner verb per family, FS, multiplexed as AGENTS is (FS.<name>) with the
//     kernel's fs names (loadFile, saveFile, deleteFile, statFile, fileExists, loadJsonValue, saveJsonValue,
//     getAnnotations, annotateFile) and search {q} over the folder's file names, scoped to the family's folder,
//     nothing above it.
//   - A family folder never holds code: an app's is <module>.family beside <module>.js (process/js/desk/desk.family/
//     beside desk.js), where its AGENTS.md and verb files move; the node's stay js/<family>/.
//   - Warnings are files: <verb>.warning.txt in the family folder, read by the grants app through that family's FS
//     before a grant; nothing is opened to agents. This item adds one: js/auth/grant.warning.txt (in js/jobs/ until goal/G30.6).
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
  const intro = require('../run/spirit/introSpector');
  const keys = Object.keys(intro).sort().join(',');
  if (keys === 'AGENTS_FILE,family') test.check('introSpector exports family and AGENTS_FILE only (claim is gone)');
  else test.fail(OWED + 'introSpector exports ' + keys);

  // A module folder of its own, its verbs bare.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-cleanup-module-'));
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# a module\n');
  fs.writeFileSync(path.join(dir, 'stat.json'), JSON.stringify({ description: 'how big a file is' }));
  fs.writeFileSync(path.join(dir, 'stat.warning.txt'), 'stat reads your disc');
  const fam = intro.family(dir, { declared: ['stat'] });
  const FS_NAMES = ['loadFile', 'saveFile', 'deleteFile', 'statFile', 'fileExists', 'loadJsonValue', 'saveJsonValue', 'getAnnotations', 'annotateFile', 'search'];
  const fsMissing = FS_NAMES.filter(function (n) { return !fam.verbs['FS.' + n] || typeof fam.verbs['FS.' + n].handler !== 'function'; });
  if (!fsMissing.length) test.check('family(folder) supplies FS.' + FS_NAMES.join(', FS.'));
  else test.fail(OWED + 'family(folder) has no FS.' + fsMissing.join(', FS.'));
  const fsCall = function (name, args) {
    try { return fam.verbs['FS.' + name] ? fam.verbs['FS.' + name].handler(args) : { missing: true }; } catch (e) { return { refused: e.refusal || e.message }; }
  };
  const warned = fsCall('loadFile', { path: 'stat.warning.txt' });
  if (warned && warned.text === 'stat reads your disc') test.check('FS.loadFile reads stat.warning.txt from the family folder');
  else test.fail(OWED + 'FS.loadFile answered ' + short(warned));
  fsCall('saveFile', { path: 'stat.design.md', content: '# a remark' });
  const remark = fsCall('loadFile', { path: 'stat.design.md' });
  if (remark && remark.text === '# a remark' && fs.existsSync(path.join(dir, 'stat.design.md'))) test.check('FS.saveFile places a remark in the folder, and FS.loadFile reads it back');
  else test.fail(OWED + 'saving a remark answered ' + short(remark));
  const above = fsCall('loadFile', { path: '../outside.txt' });
  if (above && above.refused) test.check('a path above the folder is refused (' + above.refused + ')');
  else test.fail(OWED + 'FS.loadFile of ../outside.txt answered ' + short(above));
  const found = fsCall('search', { q: 'warning' });
  if (found && Array.isArray(found.items) && found.items.some(function (i) { return i.key === 'stat.warning.txt'; })) test.check('FS.search finds stat.warning.txt by name, bounded as every search is');
  else test.fail(OWED + 'FS.search answered ' + short(found));
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-cleanup-bare-'));
  const bareFam = intro.family(bare, { declared: [] });
  // THE AGENTS VERBS GO (Andy, 2026-10-20: "cannot the agent simply use FS to retrieve the AGENTS.md file of the
  // verb.json files?", then "fold it into this item and proceed."): family answers FS alone, AGENTS.md or not.
  const agentsKeys = Object.keys(fam.verbs).filter(function (k) { return /(^|\.)AGENTS(\.|$)/.test(k); });
  if (!agentsKeys.length) test.check('family(folder) answers no AGENTS verb even where the folder has AGENTS.md: FS reads it');
  else test.fail(OWED + 'family(folder) still answers ' + short(agentsKeys));
  if (bareFam.verbs['FS.loadFile'] && !bareFam.verbs['AGENTS']) test.check('FS is there even where the folder has no AGENTS.md');
  else test.fail(OWED + 'a folder without AGENTS.md answered ' + short(Object.keys(bareFam.verbs)));
  try { fs.rmSync(bare, { recursive: true, force: true }); } catch (e) { /* busy */ }

  test.subHeading('2. verbTable mounts a module under a name it gives');
  const table = require('../run/spirit/verbTable').createVerbTable();
  const handled = [];
  const decl = { stat: { request: { path: '' }, reply: { size: 0 }, handler: function (rq, rs) {
    let t = ''; rq.on('data', function (c) { t += c; }); rq.on('end', function () { handled.push(t); rs.writeHead(200); rs.end(JSON.stringify({ size: 7 })); });
  } } };
  let mounted = false;
  try { mounted = typeof table.mount === 'function' && table.mount('xfs', dir, decl, { wire: false }); } catch (e) { mounted = 'threw ' + e.message; }
  if (mounted === true && typeof table.handlerFor('xfs.stat') === 'function' && typeof table.handlerFor('xfs.FS.loadFile') === 'function' && !table.handlerFor('xfs.AGENTS.introspect'))
    test.check('mount(\'xfs\', folder, {stat}) puts xfs.stat and xfs.FS.* on the table, and no AGENTS verb: the module declared stat bare');
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
  const apiDoor = require('../run/spirit/apiDoor');
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
    const apps = require('../run/spirit/appClient').createAppClient({ rootDir: dir, reserved: function () { return ['fs', 'xfs']; } });
    refusedName = { xfs: apps.register('xfs', '\\\\.\\pipe\\x'), other: apps.register('otherapp', '\\\\.\\pipe\\y') };
  } catch (e) { refusedName = { threw: e.message }; }
  if (refusedName && refusedName.xfs === false && refusedName.other === true) test.check('an app named like a node family (xfs) is refused at register; another name mounts');
  else test.fail(OWED + 'register answered ' + short(refusedName));
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* busy */ }

  test.subHeading('6. the node uses it');
  const server = code('spirit/server.js');
  if (!/introSpector\.claim\(/.test(server) && !/'(net|jobs|config|fs|node|owner|relay|contact|peer)\.[a-zA-Z]+':\s*\{/.test(server) && /loopbackVerbs\.mount\(/.test(server))
    test.check('server.js mounts each node module with bare verbs; no introSpector.claim and no family.verb names in its declarations');
  else test.fail(OWED + 'server.js still claims through introSpector or names verbs with their family');
  if (/loopbackVerbs\.door\(/.test(server) && /createApiDoor\(\{[\s\S]{0,200}servers:\s*nodeDoor/.test(server)) test.check('apiDoor and /api/spirit go through the one door (nodeDoor)');
  else test.fail(OWED + 'server.js does not hand apiDoor the one door');
  const pm = code('spirit/puppetMode.js');
  if (!/function shim\(/.test(pm) && /\.call\(/.test(pm)) test.check('puppetMode runs node verbs through table.call and keeps no shim of its own');
  else test.fail(OWED + 'puppetMode still has its own shim');

  test.subHeading('7. the warning, and the grants app');
  let warn = '';
  try { warn = fs.readFileSync(path.join(RUN, 'spirit', 'auth', 'grant.warning.txt'), 'utf8').trim(); } catch (e) { warn = ''; }
  if (warn.length) test.check('spirit/auth/grant.warning.txt is there: ' + short(warn));
  else test.fail(OWED + 'spirit/auth/grant.warning.txt is missing');
  const grants = code('shell/grants/grants.js');
  if (/FS\.loadFile/.test(grants) && /\.warning\.txt/.test(grants) && !/'AGENTS\.' \+ verb/.test(grants)) test.check('the grants app reads <verb>.warning.txt through the family\'s FS and shows it before the grant');
  else test.fail(OWED + 'the grants app does not read warnings through FS');

  test.subHeading('7b. deskAgent reads the table, AGENTS.md and each verb file through FS; nothing asks AGENTS');
  const tools = code('process/js/deskAgent/tools.js');
  const agentJs = code('process/js/deskAgent/deskAgent.js');
  const apiDoorJs = code('spirit/apiDoor.js');
  const noAgents = ['spirit/apiDoor.js', 'spirit/appServer.js', 'spirit/verbTable.js', 'process/js/deskAgent/tools.js', 'process/js/deskAgent/deskAgent.js']
    .filter(function (f) { return /AGENTS\.introspect|'AGENTS\.'\s*\+|\.AGENTS\.|'AGENTS'/.test(code(f)); });
  // The route names the FS verb (fs('loadJsonValue') becomes ns.FS.loadJsonValue or FS.loadJsonValue).
  if (/fs\('loadJsonValue'\)/.test(tools) && /\.FS\.'/.test(tools) && /'api'/.test(tools) && /FS\.loadFile/.test(agentJs) && !noAgents.length)
    test.check('tools.js describes a family from the api table and FS.loadJsonValue of each verb file; deskAgent reads AGENTS.md by FS.loadFile; no product file asks an AGENTS verb');
  else test.fail(OWED + 'AGENTS verbs still asked in ' + short(noAgents) + (/fs\('loadJsonValue'\)/.test(tools) ? '' : '; tools.js reads no verb file by FS'));
  if (!/AGENTS\.introspect/.test(door)) test.check('apiDoor has no AGENTS special case');
  else test.fail(OWED + 'apiDoor still cuts AGENTS.introspect');

  test.subHeading('8. app family folders hold no code');
  const APPS = ['desk', 'deskAgent', 'deskVerify'];
  const wrong = APPS.filter(function (a) {
    const home = path.join(RUN, 'process', 'js', a);
    const famDir = path.join(home, a + '.family');
    return !fs.existsSync(path.join(famDir, 'AGENTS.md')) || fs.existsSync(path.join(home, 'AGENTS.md')) ||
      // The one script a family folder holds is its interface, api.js (goal/G32.3): the node reads it, the server never runs it.
      fs.readdirSync(famDir).some(function (f) { return /\.js$/.test(f) && f !== 'api.js'; });
  });
  if (!wrong.length) test.check('desk, deskAgent and deskVerify keep AGENTS.md, their verb files and their api.js in <module>.family beside <module>.js, with no other code in it');
  else test.fail(OWED + 'not moved to <module>.family: ' + short(wrong));
  const appServerJs = code('spirit/appServer.js');
  if (/'\.family'/.test(appServerJs)) test.check('appServer reads the AGENTS family (and FS) from <script>.family');
  else test.fail(OWED + 'appServer still reads the AGENTS family from the script\'s own folder');
  // The picker lists spirit.apiTreeIndex.servers of the verb api's answer, which is now the flat table.
  let listed = null;
  try {
    global.window = global.window || {};
    delete require.cache[require.resolve('../run/spirit/client/apiTreeIndex.js')];
    require('../run/spirit/client/apiTreeIndex.js');
    const idx = (global.window && global.window.spirit && global.window.spirit.apiTreeIndex) || require('../run/spirit/client/apiTreeIndex.js');
    listed = idx.servers({ fs: { stat: {} }, jobs: { authGrant: {} }, desk: { items: {} } });
  } catch (e) { listed = { threw: e.message }; }
  const picker = code('shell/js/appServerSelector.js');
  if (Array.isArray(listed) && listed.join(',') === 'desk,fs,jobs' && /\.tree\(\)/.test(picker))
    test.check('the picker lists every family of the flat table, the node\'s (fs, jobs) beside the apps\' (desk)');
  else test.fail(OWED + 'the picker lists ' + short(listed));
}

main().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  setTimeout(function () { test.reportSuccessFailureCount(); process.exit(0); }, 50);
});
