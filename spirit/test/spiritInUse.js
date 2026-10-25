'use strict';

// spirit/test/spiritInUse.js
// THROW-AWAY (goal/G40.6): spirit.js works wherever it is put to use. Andy: "we test spirit.js and then we make sure it
// works wherever we put it. you can make one throw-away test for that, where all the other hundred junk tests are."
// spirit.js itself is tested by spirit/run/test/spirit.js; this one only checks the places that now use it.
//
//   1. Every file that made a spirit object of its own now loads spirit.js first and makes none: no forNode, forPeer,
//      createSpirit, assemble or spirit.call anywhere in the run tree's code; no server touches spirit.core; the deleted
//      servers are gone.
//   2. A real node, booted from a scratch home by node spirit/server.js, writes its port to that home's
//      relay-state/environment.json (serveCommon.writeEnvironment); its own server processes run; and a node.js process
//      in that home requires spirit.js and reaches that node: its api tree, and a node family bound and called.

const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const test = require('./testSupport.js');
const { setupRelayFakes } = require('./setupRelayFakes');

const RUN = path.join(__dirname, '..', 'run');
const USERS = ['process/js/chatClerver/chatClerver.js', 'process/js/desk/desk.js', 'process/js/desk/commitCheck.js', 'process/js/desk/deskAgentEar.js',
  'process/js/deskAgent/deskAgent.js', 'process/js/deskClient/deskClient.js', 'process/js/deskClient/publishData.js', 'process/js/fileServer/fileServer.js',
  'process/js/relayLimits/relayLimits.js', 'spirit/appServer.js'];
const GONE = ['process/js/desk/removeAgent.js', 'process/js/localReview/localReview.js', 'process/js/localResearch/localResearch.js'];
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function freePort() {
  return new Promise(function (resolve, reject) {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', function () { const p = probe.address().port; probe.close(function () { resolve(p); }); });
  });
}
// A process in home: requires its spirit.js, asks its node, prints what it got.
const PROBE = [
  "const s = require(process.argv[1] + '/spirit.js');",
  "Promise.all([s.tree(), s.require('spirit/jobs/api.js').then(function (jobs) { return jobs.search({ q: '*' }); })])",
  "  .then(function (r) {",
  "    process.stdout.write(JSON.stringify({ families: Object.keys(r[0] || {}).length, jobs: !!(r[1] && Array.isArray(r[1].items)), bound: !!s.jobs,",
  "      labels: ((r[1] && r[1].items) || []).map(function (i) { return i.label; }) }));",
  "  }, function (e) { process.stdout.write(JSON.stringify({ refused: e && (e.code || e.message) })); });",
].join('\n');

test.startTest('goal/G40.6 (throw-away): spirit.js works wherever it is put to use');

(async function () {
  test.subHeading('1. the places that made an object of their own use the one instance');
  const rule = path.join(RUN, 'test', 'spirit-child-generalRules.js');
  const late = USERS.filter(function (f) {
    const r = spawnSync(process.execPath, [rule, f], { cwd: RUN, encoding: 'utf8' });
    return /does not require spirit\.js first/.test(r.stdout);
  });
  if (!late.length) test.check('each of the ' + USERS.length + ' files loads spirit.js first');
  else test.fail('not loading spirit.js first: ' + short(late));
  const code = function (f) { return fs.readFileSync(path.join(RUN, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''); };
  const all = spawnSync('git', ['ls-files', 'spirit/run'], { cwd: path.join(RUN, '..', '..'), encoding: 'utf8' }).stdout.split('\n')
    .filter(function (f) { return /\.js$/.test(f) && !/\/test\//.test(f) && !/node_modules/.test(f); }).map(function (f) { return f.replace(/^spirit\/run\//, ''); })
    .filter(function (f) { return fs.existsSync(path.join(RUN, f)); });
  const making = all.filter(function (f) { return /\.(forNode|forPeer|createSpirit|assemble)\(|\bspirit\.call\(/.test(code(f)); });
  if (!making.length) test.check('no file of the run tree calls forNode, forPeer, createSpirit, assemble or spirit.call (' + all.length + ' files read)');
  else test.fail('still making an object of its own: ' + short(making));
  const servers = all.filter(function (f) { return /^process\//.test(f) || f === 'spirit/appServer.js' || f === 'spirit/introSpector.js'; });
  const onKernel = servers.filter(function (f) { return /\.core\./.test(code(f)); });
  if (!onKernel.length) test.check('no server process, and nothing of appServer or introSpector, touches a .core. under any name (' + servers.length + ' files read)');
  else test.fail('still on spirit.core: ' + short(onKernel));
  const loads = spawnSync(process.execPath, ['-e', "require('./spirit.js'); require('./spirit/appServer.js'); require('./spirit/introSpector.js');" +
    " process.stdout.write(JSON.stringify(Object.keys(require.cache).filter(function (k) { return /(kernel|appClient|relayRequest)\\.js$/.test(k); })))"], { cwd: RUN, encoding: 'utf8' });
  const byRequire = servers.filter(function (f) { return /require\([^)]*(kernel|appClient|relayRequest)/.test(code(f)); });
  if (loads.stdout === '[]' && !byRequire.length) test.check('no server process loads kernel.js: spirit.js, appServer and introSpector load neither it nor appClient nor relayRequest, and no server requires them');
  else test.fail('a server still loads the kernel: ' + short(loads.stdout + loads.stderr) + ' ' + short(byRequire));
  const NODE_SIDE = ['spirit/server.js', 'spirit/relayServer.js', 'spirit/jobs.js', 'spirit/introSpector.js'];
  const kernelFs = NODE_SIDE.filter(function (f) { return /core\.fs\.|core\.node\.util\.|core\.node\.const\.ROOT_DIR/.test(code(f)) || !/require\('\.\/fileSystem'\)/.test(code(f)); });
  if (!kernelFs.length) test.check('the node server, the relay server, jobs and introSpector take the files and their rules from fileSystem.js, none from the kernel');
  else test.fail('still on the kernel\'s fs: ' + short(kernelFs));
  const FOUR = ['spirit/server.js', 'spirit/serveCommon.js', 'spirit/relayServer.js', 'spirit/relay.js', 'spirit/jobs.js', 'spirit/appServer.js'];
  const onKernelFour = FOUR.filter(function (f) { const c = code(f); return /core\.const\.(VERSION|MIME_TYPES)|core\.util\.debug|(DEFAULT_)?SPIRIT_PORT\b(?<!spirit\.DEFAULT_SPIRIT_PORT)|\blet DEBUG\b/.test(c.replace(/spirit\.DEFAULT_SPIRIT_PORT/g, '')); });
  const relayKernel = /require\('\.\/kernel'\)/.test(code('spirit/relayServer.js')) || /require\('\.\/kernel'\)/.test(code('spirit/relay.js'));
  if (!onKernelFour.length && !relayKernel) test.check('the node, the relay, the shared code, jobs and appServer take the version, the MIME table, the debug switch and the default port from spirit.js; the relay requires no kernel');
  else test.fail('still on the kernel\'s four: ' + short(onKernelFour) + (relayKernel ? ' and the relay requires the kernel' : ''));
  const readers = all.filter(function (f) { return f !== 'spirit/kernel.js' && /core\.readBody/.test(code(f)); });
  const onKernelBody = ['spirit/serveCommon.js', 'spirit/relayRequest.js'].filter(function (f) { return /require\('\.\/kernel(\.js)?'\)/.test(code(f)); });
  if (!readers.length && !onKernelBody.length && /function readBody\(stream, opts\)/.test(code('spirit/serveCommon.js'))) test.check('the body reader is serveCommon.readBody; nothing but the kernel\'s own name calls the kernel\'s, and serveCommon and relayRequest require no kernel');
  else test.fail('the body reader: ' + short({ readers: readers, onKernel: onKernelBody }));
  const nodeLoads = spawnSync(process.execPath, ['-e', "require('./spirit/fileSystem.js'); require('./spirit/serveCommon.js'); require('./spirit/relayRequest.js'); require('./spirit/jobs.js')(1);" +
    " process.stdout.write(JSON.stringify(Object.keys(require.cache).filter(function (k) { return /kernel\\.js$/.test(k); })))"], { cwd: RUN, encoding: 'utf8' });
  const kernelRequired = ['spirit/server.js', 'spirit/relayServer.js', 'spirit/jobs.js'].filter(function (f) { return /require\('\.\/kernel(\.js)?'\)|\.core\./.test(code(f)); });
  if (nodeLoads.stdout === '[]' && !kernelRequired.length) test.check('the node and the relay load no kernel.js: server.js, relayServer.js and jobs.js neither require it nor touch a .core., and jobs.js keeps its own state');
  else test.fail('the node or the relay still loads the kernel: ' + short(nodeLoads.stdout + nodeLoads.stderr) + ' ' + short(kernelRequired));
  const oldWire = all.filter(function (f) { return /['"]jobs\.update['"]|api\/events|jobs\.publish\(/.test(code(f)); });
  const PUBLISHERS = ['spirit/appServer.js', 'process/js/chatClerver/chatClerver.js', 'process/js/deskAgent/deskAgent.js', 'process/js/deskVerify/deskVerify.js', 'process/js/fileServer/fileServer.js'];
  const onePath = PUBLISHERS.filter(function (f) { return !/spirit\.events\.publish\(/.test(code(f)); });
  if (!oldWire.length && !onePath.length) test.check('the one path to publish: no jobs.update, no /api/events and no jobs.publish left in the run tree\'s code; appServer and the four servers publish through spirit.events.publish');
  else test.fail('the old wire: ' + short(oldWire) + ' not on spirit.events.publish: ' + short(onePath));
  const still = GONE.filter(function (f) { return fs.existsSync(path.join(RUN, f)); });
  if (!still.length) test.check('removeAgent, localReview and localResearch are gone');
  else test.fail('still there: ' + short(still));

  // THE FACE WITHOUT kernel.js (goal/G40.7; Andy: "i just want to get rid of kernel.js in all of the face right now").
  test.subHeading('1b. the face loads no kernel.js, reads no index.html, and puts nothing on window but spirit');
  const faceShell = code('face/shell.js');
  const listAt = /var FACE_PARTS = (\[[^\]]*\])/.exec(faceShell);
  let parts = null;
  try { parts = listAt ? JSON.parse(listAt[1].replace(/'/g, '"').replace(/,\s*\]/, ']')) : null; } catch (e) { parts = null; }
  if (parts && parts.length && parts.indexOf('spirit/kernel.js') === -1 && !/index\.html/.test(faceShell)) test.check('the face shell fetches its own list of ' + parts.length + ' parts from home (FACE_PARTS), kernel.js not among them, and reads no index.html');
  else test.fail('the face\'s parts: ' + (parts ? 'kernel.js on the list or index.html read' : 'no FACE_PARTS list in face/shell.js') + (/index\.html/.test(faceShell) ? ', still reads index.html' : ''));
  const missing = (parts || []).filter(function (p) { return !fs.existsSync(path.join(RUN, p)); });
  if (parts && !missing.length) test.check('every part on the face\'s list is there');
  else test.fail('parts not there: ' + short(missing));
  const FACE_APPS = ['shell/contacts/contacts.js', 'shell/files/files.js', 'shell/apps/apps.js', 'shell/icons/icons.js', 'shell/mediaViewer/mediaViewer.js'];
  const faceLoads = ['face/shell.js', 'face/seal.js', 'face/login/login.js'].concat(FACE_APPS, (parts || []).filter(function (p) { return /\.js$/.test(p); }));
  // The kernel's object, by any name: spirit.core, window.spirit.core, a core() helper over it (a file's own core flag,
  // v.core or cmd.core, is a field of the row, not the kernel).
  const onCore = faceLoads.filter(function (f) { return fs.existsSync(path.join(RUN, f)) && /spirit\.core\b|\bcore\(\)|spirit\s*&&\s*spirit\.core/.test(code(f)); });
  if (parts && !onCore.length) test.check('nothing the face loads touches the kernel\'s object: its shell, seal, login, apps and ' + parts.length + ' parts (' + faceLoads.length + ' files read)');
  else test.fail('still on the kernel, on a face: ' + short(onCore));
  const onWindow = all.filter(function (f) { return /\bfaceSeal\b|\bfaceShell\b/.test(code(f)); });
  if (!onWindow.length && /\.seal\s*=/.test(code('face/seal.js')) && /spirit\.shell\b/.test(code('face/login/login.js'))) test.check('no window.faceSeal and no window.faceShell: the seal is spirit.seal, and the login app hands itself to spirit.shell');
  else test.fail('the face\'s globals: ' + short(onWindow));

  // FACE BUGS (goal/G40.8): the box's requirements, each as it can be read off the code.
  test.subHeading('1c. face bugs: no kernel in any app, one list, the contained app, the icons\' state');
  const appScripts = fs.readdirSync(path.join(RUN, 'shell')).map(function (d) { return 'shell/' + d + '/' + d + '.js'; }).filter(function (f) { return fs.existsSync(path.join(RUN, f)); });
  const appsOnCore = appScripts.filter(function (f) { return /spirit\.core\b|\bcore\(\)\./.test(code(f)); });
  if (!appsOnCore.length) test.check('no app script touches the kernel\'s object, so the face can open any of them (' + appScripts.length + ' read)');
  else test.fail('app scripts still on the kernel: ' + short(appsOnCore));
  const banned = (parts || []).filter(function (p) { return /listSearch\.js$|contactSelector\.js$|appHeader\.js$/.test(p); });
  if (parts && !banned.length && !/shellCreateListSearch|listSearch/.test(code('shell/js/textView.js'))) test.check('listSearch, the contact selector and the header element are off the face\'s list of parts, and the text view builds on probabilitySearch, not listSearch');
  else test.fail('listSearch on the face: parts ' + short(banned) + (/shellCreateListSearch|listSearch/.test(code('shell/js/textView.js')) ? ', the text view still on listSearch' : ''));
  const ps = code('shell/js/probabilitySearch.js');
  if (/['"]PageUp['"]/.test(ps) && /['"]PageDown['"]/.test(ps) && /ownerDocument\.addEventListener\(\s*['"]keydown['"]|document\.addEventListener\(\s*['"]keydown['"]/.test(ps)) test.check('the one list search takes up, down, home, end, page up and page down on the whole list, heard on the page, whether its field has focus or not');
  else test.fail('the list keys: page up/down ' + (/['"]PageDown['"]/.test(ps) ? 'handled' : 'missing') + ', heard on the page ' + (/document\.addEventListener\(\s*['"]keydown['"]/.test(ps) ? 'yes' : 'no, only on the search\'s own container'));
  // ONE NAME, ONE FUNCTION: a second declaration silently replaces the first in the same scope (page up and down's
  // pageRows took the place of the page's own rows, and the face said "page.forEach is not a function").
  const declared = (ps.match(/function\s+([A-Za-z_$][\w$]*)\s*\(/g) || []).map(function (d) { return d.replace(/function\s+|\s*\($/g, ''); });
  const twice = declared.filter(function (n, i) { return declared.indexOf(n) !== i; });
  if (!twice.length) test.check('the list search declares no function name twice (' + declared.length + ' read)');
  else test.fail('declared twice in probabilitySearch.js: ' + short(twice));
  if (/id="'\s*\+\s*pre\s*\+\s*'list"[^>]*overflow:\s*auto/.test(ps) && !/dropdown \? ';max-height:20em;overflow:auto' : ''/.test(ps)) test.check('every list scrolls inside its own box, not only a dropdown\'s');
  else test.fail('a list in a pane has no scroll box of its own: only a dropdown\'s list gets overflow');
  // SPACE IS GRANTED TOP-DOWN (box v12): the list search sets no size on the box it is given; Files and Icons hand their
  // lists a box that takes what their pane leaves (shell.css .fill), as Contacts does.
  const shellCss = fs.readFileSync(path.join(RUN, 'shell.css'), 'utf8');
  const filled = /\.fill\s*\{[^}]*flex:\s*1/.test(shellCss) && /data-files="list" class="fill"/.test(code('shell/files/files.js')) &&
    /files-tree fill/.test(code('shell/js/files/listElement.js')) && /data-icons="pane" class="fill"/.test(code('shell/icons/icons.js')) &&
    /data-apps="list" class="fill"/.test(code('shell/apps/apps.js'));
  if (!/container\.style\./.test(ps) && filled) test.check('space is granted top-down: the list search sets no size on its box; Files and Icons size the boxes they hand it (shell.css .fill)');
  else test.fail('top-down space: the list search ' + (/container\.style\./.test(ps) ? 'still sizes its box' : 'sizes nothing') + ', Files and Icons ' + (filled ? 'size their boxes' : 'hand it unsized boxes'));
  const faceCss = fs.readFileSync(path.join(RUN, 'face', 'face.css'), 'utf8');
  if (/THE CONTAINED APP/.test(faceCss) && /overflow:\s*hidden/.test(faceCss) && /100vh|100dvh|height:\s*100%/.test(faceCss)) test.check('the face is a contained app: the window is the screen, nothing but a list or a viewer scrolls (face.css)');
  else test.fail('the face sets no contained layout in face.css');
  const relayApi = fs.readFileSync(path.join(RUN, 'spirit', 'relay', 'api.js'), 'utf8');
  if (/names\s*:/.test(relayApi) && /status\s*:/.test(relayApi)) test.check('the relays\' status is a name of the relay family\'s api.js (spirit.relay.status)');
  else test.fail('the relay family has no status name');
  const iconsApp = code('shell/icons/icons.js');
  if (/relay-state\/shell\/icons\/iconSet\.json/.test(iconsApp) && /shell\/json\/iconSet\.json/.test(code('shell/js/iconSelector.js')) && !/iconIndex\.ICON/.test(code('shell/js/iconSelector.js'))) test.check('the icons app keeps its set in relay-state/shell/icons/, and the icon picker offers shell/json/iconSet.json');
  else test.fail('the icons: the app on ' + short((iconsApp.match(/['"][^'"]*iconSet\.json['"]/) || [''])[0]) + ', the picker ' + (/shell\/json\/iconSet\.json/.test(code('shell/js/iconSelector.js')) ? 'on shell/json' : 'not on shell/json/iconSet.json'));
  const gate = spawnSync(process.execPath, ['-e', "const f = require('./spirit/fileSystem.js'); process.stdout.write(JSON.stringify([f.fileWritable('relay-state/shell/icons/iconSet.json'), f.fileServable('relay-state/shell/icons/iconSet.json'), f.fileWritable('relay-state/identity.json'), f.fileServable('relay-state/identity.json'), f.fileWritable('relay-state/shell/../identity.json'), f.fileServable('relay-state/shell/x/relay-state/identity.json')]))"], { cwd: RUN, encoding: 'utf8' });
  if (gate.stdout === '[true,true,false,false,false,false]') test.check('the node\'s file gate opens relay-state/shell/<app>/ to its app, and nothing else under relay-state');
  else test.fail('the file gate for relay-state/shell/: ' + short(gate.stdout + gate.stderr));
  const isCore = spawnSync(process.execPath, ['-e', "process.stdout.write(String(require('./spirit/coreFiles.js').isCore('spirit/run/shell/json/iconSet.json', require('path').resolve('..', '..'))))"], { cwd: RUN, encoding: 'utf8' });
  if (isCore.stdout === 'true') test.check('shell/json/ is core: shell/json/iconSet.json is a core file');
  else test.fail('shell/json/iconSet.json is not core: ' + short(isCore.stdout + isCore.stderr));

  test.subHeading('2. a real node writes its port, runs its servers, and a process in its home reaches it through spirit.js');
  const home = setupRelayFakes('spiritInUse').andy;
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(home, 'relay-state', 'relays.json'), JSON.stringify([{ label: 'nowhere', url: 'https://127.0.0.1:1' }]), 'utf8');
  try { fs.rmSync(path.join(home, 'relay-state', 'environment.json'), { force: true }); } catch (e) { /* none */ }
  const port = await freePort();
  let said = '';
  const node = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: home, stdio: ['ignore', 'pipe', 'pipe'] });
  node.stdout.on('data', function (c) { said = (said + c).slice(-8192); });
  node.stderr.on('data', function (c) { said = (said + c).slice(-8192); });
  try {
    let env = null;
    for (let i = 0; i < 80 && !env; i++) {
      await sleep(150);
      try { env = JSON.parse(fs.readFileSync(path.join(home, 'relay-state', 'environment.json'), 'utf8')); } catch (e) { env = null; }
    }
    if (env && Number(env.PORT) === port) test.check('the node wrote its port, ' + port + ', to its home\'s environment.json');
    else test.fail('environment.json in the scratch home: ' + short(env) + ' ' + said.split('\n').slice(-3).join(' | '));
    let up = false;
    for (let i = 0; i < 60 && !up; i++) { await sleep(150); up = await new Promise(function (r) { const s = net.connect(port, '127.0.0.1', function () { s.end(); r(true); }); s.on('error', function () { r(false); }); }); }
    await sleep(2500);
    const asked = spawnSync(process.execPath, ['-e', PROBE, home], { cwd: home, encoding: 'utf8', timeout: 20000 });
    let got = null;
    try { got = JSON.parse(asked.stdout); } catch (e) { got = { said: asked.stdout + asked.stderr }; }
    if (up && got && got.families > 0 && got.jobs && got.bound) test.check('a process in that home requires spirit.js and reaches its node: ' + got.families + ' families in its tree, spirit.jobs bound and called');
    else test.fail('reaching the scratch node: listening ' + up + ', ' + short(got));
    // The fs family through the node, on fileSystem.js: a page file read, fileSystem.js itself never served, a file
    // saved, annotated and its annotations read back; and introSpector's FS annotations of a folder.
    fs.mkdirSync(path.join(home, 'probeFolder'), { recursive: true });
    fs.writeFileSync(path.join(home, 'probeFolder', 'a.txt'), 'a', 'utf8');
    const FS_PROBE = [
      "const s = require(process.argv[1] + '/spirit.js');",
      "const intro = require(process.argv[1] + '/spirit/introSpector.js').family(process.argv[1] + '/probeFolder').verbs;",
      "s.require('spirit/fs/api.js').then(async function (f) {",
      "  const out = { face: typeof (await f.loadFile('face.html')), self: await f.loadFile('spirit/fileSystem.js'), kernel: await f.loadFile('spirit/kernel.js') };",
      "  out.saved = await f.saveFile('probeFolder/b.txt', 'bee'); out.back = await f.loadFile('probeFolder/b.txt');",
      "  out.annotated = await f.annotate({ path: 'probeFolder/b.txt', payload: { n: 2 } }); out.notes = await f.getAnnotations('probeFolder/b.txt');",
      "  out.introSaved = intro['FS.annotateFile'].handler({ path: 'a.txt', payload: { n: 1 } }); out.introNotes = intro['FS.getAnnotations'].handler({ path: 'a.txt' });",
      "  process.stdout.write(JSON.stringify(out));",
      "}).catch(function (e) { process.stdout.write(JSON.stringify({ refused: e && (e.code || e.message) })); });",
    ].join('\n');
    const fsAsked = spawnSync(process.execPath, ['-e', FS_PROBE, home], { cwd: home, encoding: 'utf8', timeout: 20000 });
    let fsGot = null;
    try { fsGot = JSON.parse(fsAsked.stdout); } catch (e) { fsGot = { said: fsAsked.stdout + fsAsked.stderr }; }
    const fsOk = fsGot && fsGot.face === 'string' && fsGot.self === null && fsGot.kernel === null && fsGot.saved && fsGot.saved.ok === true && fsGot.back === 'bee' &&
      fsGot.notes && fsGot.notes.client && fsGot.notes.client.n === 2;
    if (fsOk) test.check('the fs family on the node runs on fileSystem.js: face.html read, fileSystem.js and kernel.js never served, a file saved, read back, annotated and its notes read');
    else test.fail('the fs family on the scratch node: ' + short(fsGot));
    if (fsGot && fsGot.introSaved && fsGot.introSaved.saved === true && fsGot.introNotes && fsGot.introNotes.client && fsGot.introNotes.client.n === 1) test.check('introSpector annotates a file of a folder and reads its notes back, through fileSystem.js');
    else test.fail('introSpector\'s FS annotations: ' + short(fsGot && { introSaved: fsGot.introSaved, introNotes: fsGot.introNotes, said: fsGot.said }));
    // THE EVENTS FAMILY (goal/G40.6): the old door is gone; the family is in the tree and jobs has no update; one process
    // subscribes, another publishes on a running server's job through spirit.events.publish, and the subscriber hears it.
    const oldDoor = await fetch('http://127.0.0.1:' + port + '/api/events').then(function (r) { const s = r.status; r.body && r.body.cancel && r.body.cancel(); return s; }, function () { return 0; });
    const EV_PROBE = [
      "const s = require(process.argv[1] + '/spirit.js');",
      "Promise.all([s.tree(), s.require('spirit/jobs/api.js')]).then(function (r) {",
      "  const out = { events: !!(r[0] && r[0].events && r[0].events.subscribe && r[0].events.publish), jobsUpdate: !!(r[0] && r[0].jobs && r[0].jobs.update) };",
      "  const off = s.events.subscribe({",
      "    onSnapshot: function (jobs) { if (out.snapshot) return; out.snapshot = jobs.length; const t = jobs.filter(function (j) { return j.module && j.status === 'running'; })[0]; out.target = t && t.id; process.stdout.write(JSON.stringify({ target: out.target }) + '\\n'); },",
      "    onUpdate: function (job) { if (job && job.app && job.app.probe === 7) { out.heard = job.id; off(); process.stdout.write(JSON.stringify(out) + '\\n'); process.exit(0); } },",
      "  });",
      "  setTimeout(function () { process.stdout.write(JSON.stringify(out) + '\\n'); process.exit(0); }, 12000);",
      "});",
    ].join('\n');
    const listener = spawn(process.execPath, ['-e', EV_PROBE, home], { cwd: home, stdio: ['ignore', 'pipe', 'pipe'] });
    let heardText = '';
    listener.stdout.on('data', function (c) { heardText += c; });
    let target = '';
    for (let i = 0; i < 60 && !target; i++) { await sleep(100); try { target = JSON.parse(heardText.split('\n')[0]).target || ''; } catch (e) { target = ''; } }
    let published = null;
    if (target) {
      const pub = spawnSync(process.execPath, ['-e', "const s = require(process.argv[1] + '/spirit.js'); process.stdout.write(JSON.stringify(s.events.publish({ probe: 7 })));", home],
        { cwd: home, encoding: 'utf8', timeout: 10000, env: Object.assign({}, process.env, { SPIRIT_JOB_ID: target }) });
      published = pub.stdout;
    }
    await new Promise(function (r) { listener.on('exit', r); setTimeout(r, 13000); });
    let ev = null;
    try { ev = JSON.parse(heardText.trim().split('\n').pop()); } catch (e) { ev = { said: heardText }; }
    if (oldDoor !== 200 && ev && ev.events === true && ev.jobsUpdate === false) test.check('the old /api/events door answers ' + oldDoor + '; the events family is in the node\'s tree with subscribe and publish, and jobs has no update');
    else test.fail('the events family on the scratch node: door ' + oldDoor + ', ' + short(ev));
    if (ev && ev.snapshot > 0 && target && published === 'true' && ev.heard === target) test.check('one process subscribed (spirit.events.subscribe, ' + ev.snapshot + ' jobs in its snapshot); another published on the running job ' + target + ' through spirit.events.publish, and the subscriber heard it');
    else test.fail('subscribe and publish on the scratch node: target ' + target + ', published ' + short(published) + ', ' + short(ev));
    const labels = (got && got.labels) || [];
    const servers2 = labels.filter(function (l) { return /server|Verifier|deskClient/i.test(l); });
    const down = labels.filter(function (l) { return /failed|exited|stopped/i.test(l); });
    if (servers2.length && !down.length) test.check('the node\'s own server processes run on the one instance: ' + short(servers2));
    else test.fail('server processes on the scratch node: ' + short(labels) + ' | ' + said.split('\n').slice(-6).join(' | '));
  } finally { node.kill(); }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the suite threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
