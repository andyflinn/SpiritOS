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

  // NAVIGATION (goal/G40.8, box v17): the stack holds pages only; the shell does all the wrapping.
  test.subHeading('1d. navigation: one wrapper, the shell wraps every app and every detail, no results handed back');
  const NAV = 'shell/js/navigationWrapper.js';
  const navCode = fs.existsSync(path.join(RUN, NAV)) ? code(NAV) : '';
  if (navCode && /navigation/.test(navCode) && /push/.test(navCode) && (parts || []).indexOf(NAV) !== -1) test.check('shell/js/navigationWrapper.js pushes a page: its title and back in the title bar, the whole app area its box; the face loads it');
  else test.fail('no navigationWrapper: ' + (navCode ? 'not on the face\'s parts' : NAV + ' is not there'));
  // The wrapper driven on a minimal page: the title bar follows the top page, back pops it (thrown away, its unmount
  // called, the one under it shown), a page can close itself, home pops them all and the frame is told it is empty.
  const navRun = spawnSync(process.execPath, ['-e', [
    "function el() { var e = { className: '', hidden: false, children: [], parentNode: null, textContent: '', appendChild: function (c) { e.children.push(c); c.parentNode = e; return c; }, removeChild: function (c) { e.children.splice(e.children.indexOf(c), 1); c.parentNode = null; } }; return e; }",
    "global.document = { createElement: el }; global.window = {};",
    "require(process.argv[1]);",
    "var N = window.spirit.elements.navigation; var title = el(); var content = el(); var said = [];",
    "N.attach({ title: title, content: content, shown: function () { said.push('shown'); }, empty: function () { said.push('empty'); }, apiFor: function (nav) { return { nav: nav }; } });",
    "var boxes = []; var a = N.push({ title: 'App', mount: function (box, nav) { boxes.push(box); }, unmount: function () { said.push('unmount App'); } });",
    "var d = N.push({ title: 'Detail', mount: function (box) { boxes.push(box); } });",
    "var out = { titles: [title.textContent], depth: N.depth(), fill: boxes[0].className, appHidden: boxes[0].hidden, api: !!(a.api && a.api.nav === a) };",
    "N.back(); out.titles.push(title.textContent); out.appShown = !boxes[0].hidden; out.detailGone = boxes[1].parentNode === null;",
    "var d2 = N.push({ title: 'Other', mount: function () {} }); d2.close(); out.titles.push(title.textContent);",
    "a.setTitle('App 2'); out.titles.push(title.textContent);",
    "N.home(); out.depth2 = N.depth(); out.said = said; process.stdout.write(JSON.stringify(out));"].join('\n'), path.join(RUN, NAV)], { encoding: 'utf8' });
  let nav = null;
  try { nav = JSON.parse(navRun.stdout); } catch (e) { nav = { said: navRun.stdout + navRun.stderr }; }
  if (nav && JSON.stringify(nav.titles) === '["Detail","App","App","App 2"]' && nav.depth === 2 && nav.fill === 'fill' && nav.appHidden === true && nav.api && nav.appShown && nav.detailGone && nav.depth2 === 0 && nav.said.indexOf('unmount App') !== -1 && nav.said[nav.said.length - 1] === 'empty')
    test.check('the wrapper, driven: the title bar follows the top page, back throws the top page away and shows the one under it, a page closes itself, home pops all and the frame is told');
  else test.fail('the wrapper, driven: ' + short(nav));
  if (/navigation\.push\(/.test(faceShell) && !/stack\.push\(/.test(faceShell)) test.check('the face shell opens every app by pushing its page through the wrapper, and keeps no app stack of its own');
  else test.fail('the face shell still keeps its own app stack' + (/navigation\.push\(/.test(faceShell) ? '' : ' and pushes nothing through the wrapper'));
  const DETAILS = ['shell/js/contactDetails/contactDetails.js', 'shell/js/natterDetails/natterDetails.js'];
  const detailsThere = DETAILS.filter(function (f) { return fs.existsSync(path.join(RUN, f)) && /navigation\.push\(/.test(code(f)); });
  const appsGone = !fs.existsSync(path.join(RUN, 'shell', 'contactsDetails')) && !fs.existsSync(path.join(RUN, 'shell', 'natterDetails'));
  if (detailsThere.length === 2 && appsGone && DETAILS.every(function (f) { return (parts || []).indexOf(f) !== -1; })) test.check('contactsDetails and natterDetails are no apps any more: two shell elements in shell/js/, each pushing its page through the wrapper, on the face\'s parts');
  else test.fail('the details: elements ' + short(detailsThere) + ', the old app folders ' + (appsGone ? 'gone' : 'still there'));
  // The face's detail pages and their face callers: no result handed back or read, nothing opening them as apps. The
  // Desk's own details run in the old shell only, which is not touched.
  const FACE_NAV = DETAILS.concat(['shell/js/contacts/rowElement.js', 'shell/js/contacts/listElement.js', 'shell/js/faceForm.js']);
  const handBacks = FACE_NAV.filter(function (f) { return fs.existsSync(path.join(RUN, f)) && /setDialogResult\(|closeDialog\(\s*\{\s*\w|callDialog\(/.test(code(f)); });
  if (!handBacks.length) test.check('the face\'s detail pages hand no result back, and their callers open them as pages, not by callDialog');
  else test.fail('results handed back, or the details opened as apps: ' + short(handBacks));
  if (!/data-icons="back"/.test(iconsApp) && /navigation\.push\(/.test(iconsApp)) test.check('Icons pushes its icon detail as a page; its own back row is gone');
  else test.fail('Icons: ' + (/data-icons="back"/.test(iconsApp) ? 'still draws its own back row' : 'pushes nothing through the wrapper'));

  // THE FACE ON LOOPBACK (goal/G40.10, box v2): its apps show, no login and no home step; it asks the node through
  // spirit.js and never the relay's door.
  test.subHeading('1e. the face on loopback: its apps, through spirit.js, no relay door, no home step');
  const askFn = (faceShell.match(/function ask\(verb, args\) \{[\s\S]*?\n  \}/) || [''])[0];
  if (/state && state\.home/.test(askFn) && /spirit\.outcome\(/.test(askFn)) test.check('at home the face shell asks the node through spirit.js (its families, spirit.outcome); the relay\'s /face/call is a relay\'s only');
  else test.fail('at home the face shell still asks everything through the relay\'s /face/call');
  // The node hands the file tree once, as a stream opens: at home the subscriptions made while the parts load are held,
  // and released onto spirit.events once the parts (the data cache's translators) are in.
  if (/held\.push\(h\)/.test(faceShell) && /waiting\.forEach\(function \(h\) \{ spirit\.events\.subscribe\(h\); \}\)/.test(faceShell)) test.check('at home the stream waits for the parts: subscriptions made while they load are held and released onto spirit.events after');
  else test.fail('at home the stream opens before the parts are in, and the file tree is lost');
  const drawFn = (faceShell.match(/function drawDesktop\(\) \{[\s\S]*?\n  \}/) || [''])[0];
  if (/state && state\.home/.test(drawFn)) test.check('at home the desktop draws no login and no home step, only the face\'s apps');
  else test.fail('at home the desktop still draws the login step\'s icon');

  // JOIN ON THE LOOPBACK FACE (goal/G40.10, box v4).
  test.subHeading('1f. Join on the loopback face: the face shell decides, the mailed link leads to the face only');
  // Read raw: the link holds http://, which the comment stripper would cut.
  const relayRaw = fs.readFileSync(path.join(RUN, 'spirit', 'relay.js'), 'utf8');
  // Since box v25 the relay mails the caller's link and builds no address of its own (checked in 1l).
  if (!/127\.0\.0\.1:' \+ p/.test(relayRaw)) test.check('the relay builds no loopback join link of its own');
  else test.fail('the relay still builds a loopback join link from the node\'s port');
  if (!/get\('join'\)/.test(code('spirit/client/shell.js'))) test.check('the old shell\'s join from the link is gone');
  else test.fail('the old shell still takes the join code from its address');
  if (/get\('join'\)/.test(faceShell) && /relay\.join/.test(faceShell)) test.check('the face shell reads the mailed link: the code to relay.join, then Join opens');
  else test.fail('the face shell does not read a join link');
  // THE MAILED LINK NAMES ITS RELAY (goal/G40.10, box v15; Andy: "this email does not specify the router-ID to which my
  // email confirmation is supposed to go"). The relay knows its own key, not its web address: the link carries the key,
  // and the face sends the code to the relay this node lists under that key, never to the first relay it lists.
  if (/'&relay=' \+ encodeURIComponent\(relayPublicKey\(\)/.test(relayRaw)) test.check('the relay\'s join mail names the relay: &relay=<its key> in the link');
  else test.fail('the relay\'s join mail does not name the relay that sent it');
  // Driven: two relays listed, the link's key picks the second; a key this node does not list picks none.
  const linkRun = spawnSync(process.execPath, ['-e', [
    "global.window = {}; require(process.argv[1]); var S = window.spirit.elements.joinSteps;",
    "var spec = require(process.argv[2]).verbs.join;",
    // contact.search's items since goal/G40.11: a relay keyed by its ID, its url on the label.
    "var items = [{ key: 'KEY-A', label: JSON.stringify({ relay: true, url: 'https://spirit.example' }) }, { key: 'KEY-B', label: JSON.stringify({ relay: true, url: 'https://noderoutes.example' }) }];",
    "var url = typeof S.linkRelay === 'function' ? S.linkRelay('KEY-B', items) : 'missing';",
    "var none = typeof S.linkRelay === 'function' ? S.linkRelay('KEY-C', items) : 'missing';",
    "process.stdout.write(JSON.stringify({ url: url, none: none, urlRule: String(spec.url), gone: typeof S.linkJoin }));"].join('\n'), path.join(RUN, 'shell', 'js', 'joinSteps.js'), path.join(RUN, 'spirit', 'relay', 'api.js')], { encoding: 'utf8' });
  let linkRelay = null;
  try { linkRelay = JSON.parse(linkRun.stdout); } catch (e) { linkRelay = { said: linkRun.stdout + linkRun.stderr }; }
  if (linkRelay && linkRelay.url === 'https://noderoutes.example' && linkRelay.none === '' && linkRelay.gone === 'undefined')
    test.check('the link\'s relay, driven: of two relays listed, the one under the link\'s key; none for a key not listed; linkJoin gone');
  else test.fail('the link\'s relay, driven: ' + short(linkRelay));
  if (/get\('relay'\)/.test(faceShell) && /linkRelay\(/.test(faceShell) && !/linkJoin|linkWaiting|url: ''/.test(faceShell)) test.check('the face shell reads the link\'s relay and sends the code to it, never to the first relay listed');
  else test.fail('the face shell does not send the link\'s code to the relay the link names');
  if (/'join-steps'/.test(faceShell) && /joinSteps/.test(faceShell) && /onSteps/.test(faceShell)) test.check('the face shell decides Join\'s open step from the node\'s join-steps job (joinSteps.js) and hands Join its steps');
  else test.fail('the face shell does not decide Join\'s steps');
  // NO JOIN ICON IN THE OLD SHELL (Andy: "who said i wanted a super-ugly icon saying EMAIL join????? on the shell, an
  // ICON THAT DOESN't DO SHIT? ... Get RID of it"): Join's manifest is hidden there; the face draws Join by its open step.
  let joinManifest = null;
  try { joinManifest = JSON.parse(fs.readFileSync(path.join(RUN, 'shell', 'join', 'join.json'), 'utf8')); } catch (e) { joinManifest = null; }
  if (joinManifest && joinManifest.hidden === true && /joinOpenStep\(\)/.test(faceShell)) test.check('Join draws no icon in the old shell; the face shows it by its open step');
  else test.fail('Join still has an icon in the old shell');
  const joinApp = code('shell/join/join.js');
  if (/relay-state\/shell\/join\//.test(joinApp) && !/setAppOverride/.test(joinApp)) test.check('Join keeps its own fact (face opened) in relay-state/shell/join/, not the old shell\'s preferences');
  else test.fail('Join still keeps its fact through the old shell\'s setAppOverride');

  // INFO ON THE FACE (goal/G40.10, box v5; Andy: "port the info app to face.").
  test.subHeading('1g. Info on the face: a face app, everything it calls the face gives it');
  let infoMark = null;
  try { infoMark = JSON.parse(fs.readFileSync(path.join(RUN, 'shell', 'info', 'info.js.sidecar.json'), 'utf8')).face; } catch (e) { infoMark = null; }
  if (infoMark && infoMark.app === true && infoMark.name === 'Info' && infoMark.icon && infoMark.description) test.check('Info is marked a face app in its sidecar, with its name, icon and description, as Files is');
  else test.fail('Info is no face app: its face mark is ' + short(infoMark));
  const infoCode = code('shell/info/info.js');
  const faceApi = (faceShell.match(/function apiFor\(page\) \{[\s\S]*?\n  \}/) || [''])[0];
  const infoCalls = (infoCode.match(/infoApi\.(\w+)/g) || []).map(function (s) { return s.slice(8); }).filter(function (v, i, a) { return a.indexOf(v) === i; });
  const missingApi = infoCalls.filter(function (n) { return !new RegExp('\\b' + n + ':').test(faceApi); });
  if (infoCalls.length && !missingApi.length && /spirit\.relay\.status\(/.test(infoCode) && (parts || []).indexOf('shell/js/faceForm.js') !== -1 && (parts || []).indexOf('spirit/fieldRules.js') !== -1)
    test.check('everything Info calls the face gives it: ' + infoCalls.join(', ') + ', spirit.relay.status, the face form and the field rules');
  else test.fail('Info calls what the face does not give it: ' + short(missingApi));
  // INFO'S FIXES (box v15): the foot gone, key and sentence; the email form in Info, above the face form, with its own
  // relay picker (joinForm's general form); no words sending anyone to Natter.
  if (!/info-foot|info-key|infoCard\.publicKey|caption it wears/.test(infoCode)) test.check('Info\'s foot is gone: no key and no sentence about it');
  else test.fail('Info still draws its foot with the key');
  const joinFormCode = code('shell/js/joinForm.js');
  const emailAt = infoCode.indexOf('info-email');
  const faceAt = infoCode.indexOf('info-face"');
  if (/function mount\(box, opts\)/.test(joinFormCode) && /<select/.test(joinFormCode) && /joinForm\.mount\(/.test(infoCode) && emailAt !== -1 && faceAt !== -1 && emailAt < faceAt)
    test.check('Info shows the email form above the face form: joinForm\'s general form, mount, with its own relay picker');
  else test.fail('Info has no email form above the face form' + (/function mount\(box, opts\)/.test(joinFormCode) ? '' : ', and joinForm has no general form with a picker'));
  if (!/Natter/.test(fs.readFileSync(path.join(RUN, 'shell', 'js', 'faceForm.js'), 'utf8').replace(/^\s*\/\/.*$/mg, ''))) test.check('the face form sends nobody to Natter');
  else test.fail('the face form still says to change the email in Natter');

  // ONE EMAIL FORM AND ONE FACE FORM, THE SAME EVERYWHERE (box v19; Andy: "the form is: [relay-dropdown]
  // [email-adress-input] [change-or-join] the SAME FUCKING FORM EVERYWHERE", "same with the face form", and "First fix the
  // form, then place the form everywhere with the correct options"). Driven on its own markup: one row, dropdown first,
  // then the field, then the button; the relay details fix the dropdown to their one relay; the face form lists only
  // relays with a verified email and draws nothing with none.
  test.subHeading('1j. one email form and one face form, each one row with its own dropdown, drawn everywhere');
  const formRun = spawnSync(process.execPath, ['-e', [
    "global.window = {}; require(process.argv[1]); require(process.argv[2]); var J = window.spirit.elements.joinForm, F = window.spirit.elements.faceForm;",
    "var relays = [{ url: 'https://a.example', label: 'a', claimed: true, email: 'x@y.z', emailVerified: true }, { url: 'https://b.example', label: 'b', claimed: false }];",
    "function shape(h) { if (typeof h !== 'string') return h; var row = (h.match(/<div class=\"start-job-form[^\"]*\"[\\s\\S]*?<\\/button>/) || [''])[0];",
    "  return { sel: row.indexOf('<select'), inp: row.indexOf('<input'), btn: row.indexOf('<button'), rows: (h.match(/start-job-form/g) || []).length, opts: (row.match(/<option/g) || []).length, fixed: /<select[^>]*disabled/.test(row) }; }",
    "var has = function (o, n) { return typeof o[n] === 'function'; };",
    "process.stdout.write(JSON.stringify({ join: has(J, 'row') ? shape(J.row(relays, {})) : null, joinFixed: has(J, 'row') ? shape(J.row(relays, { fixed: 'https://b.example' })) : null,",
    "  face: has(F, 'row') ? shape(F.row(relays, {})) : null, faceNone: has(F, 'row') ? F.row([relays[1]], {}) : 'missing', oldHtml: typeof J.html }));"].join('\n'),
    path.join(RUN, 'shell', 'js', 'joinForm.js'), path.join(RUN, 'shell', 'js', 'faceForm.js')], { encoding: 'utf8' });
  let forms = null;
  try { forms = JSON.parse(formRun.stdout); } catch (e) { forms = { said: formRun.stdout + formRun.stderr }; }
  const oneRow = function (s, opts) { return !!s && s.rows === 1 && s.sel >= 0 && s.sel < s.inp && s.inp < s.btn && s.opts === opts; };
  if (forms && oneRow(forms.join, 2) && !forms.join.fixed && oneRow(forms.joinFixed, 1) && forms.joinFixed.fixed && forms.oldHtml === 'undefined')
    test.check('the email form, driven: one row, [relay dropdown] [email] [Join or Change]; fixed to one relay where it is given one; the old dropdownless form gone');
  else test.fail('the email form, driven: ' + short(forms && { join: forms.join, joinFixed: forms.joinFixed, oldHtml: forms.oldHtml, said: forms.said }));
  if (forms && oneRow(forms.face, 1) && forms.faceNone === '') test.check('the face form, driven: one row, [relay dropdown] [face name] [Ask], only relays with a verified email, nothing with none');
  else test.fail('the face form, driven: ' + short(forms && { face: forms.face, faceNone: forms.faceNone }));
  const PLACES = { 'shell/join/join.js': false, 'shell/info/info.js': false, 'shell/js/natterDetails/natterDetails.js': true };
  const misplaced = Object.keys(PLACES).filter(function (f) {
    const c = code(f);
    return !/joinForm(\(\))?\.mount\(/.test(c) || !/[fF]aceForm(\(\))?\.mount\(/.test(c) || /joinForm(\(\))?\.html\(/.test(c) || (PLACES[f] && !/fixed:/.test(c));
  });
  if (!misplaced.length) test.check('Join, Info and the relay details draw both forms through mount, the relay details fixed to their relay');
  else test.fail('the forms are not drawn everywhere the same: ' + short(misplaced));

  // FIELDS THAT KEEP THEIR LIMIT (box v20): fieldRules has the email rule, at most 254 bytes, with its reason; a field
  // with a limit is clipped at it as it is typed, and counts only what is left.
  test.subHeading('1k. fields keep their limit, and the email rule');
  const rulesRun = spawnSync(process.execPath, ['-e', [
    "var R = require(process.argv[1]);",
    "var bad = ['ab', 'a b@c', '@b', 'a@', 'a@b@c', 'a'.repeat(250) + '@b.cd'];",
    "var said = typeof R.emailProblem === 'function' ? bad.map(R.emailProblem) : null;",
    "var ok = typeof R.emailProblem === 'function' ? R.emailProblem('andy@example.org') : 'missing';",
    "var clip = typeof R.clip === 'function' ? R.clip('ab\\u{1F600}cd', 5) : null;",
    "process.stdout.write(JSON.stringify({ said: said, ok: ok, max: R.EMAIL_MAX_BYTES, clip: clip, clipBytes: clip == null ? -1 : R.byteLength(clip) }));"].join('\n'), path.join(RUN, 'spirit', 'fieldRules.js')], { encoding: 'utf8' });
  let rules = null;
  try { rules = JSON.parse(rulesRun.stdout); } catch (e) { rules = { said: rulesRun.stdout + rulesRun.stderr }; }
  if (rules && rules.ok === '' && Array.isArray(rules.said) && rules.said.every(function (w) { return w && !/type your email/.test(w); }) && new Set(rules.said.slice(0, 5)).size >= 4 && rules.max === 254)
    test.check('fieldRules\' email rule, driven: a good address passes; each bad one is told what is wrong; at most 254 bytes');
  else test.fail('fieldRules\' email rule, driven: ' + short(rules));
  if (rules && rules.clip === 'ab' && rules.clipBytes <= 5) test.check('fieldRules.clip, driven: a text cut at its byte limit, never through a character');
  else test.fail('fieldRules.clip, driven: ' + short(rules && { clip: rules.clip, bytes: rules.clipBytes }));
  const relayCode = code('spirit/relay.js');
  if (/emailProblem\(/.test(relayCode)) test.check('the relay\'s join checks the email by the same rule');
  else test.fail('the relay checks the email by a rule of its own');
  const joinFormNow = code('shell/js/joinForm.js');
  if (/emailProblem\(/.test(joinFormNow) && /clip\(/.test(joinFormNow) && !/type your email address/.test(joinFormNow)) test.check('the email form clips at the limit and says what is wrong with an address');
  else test.fail('the email form neither clips nor says what is wrong');
  const infoNow = code('shell/info/info.js');
  if (/clip\(/.test(infoNow) && !/too many/.test(infoNow)) test.check('Info\'s name and description stop at their limit, and count only what is left');
  else test.fail('Info still counts past the limit');

  // THE ONE TABLE ON THE STREAM (goal/G40.11 replaced box v21's relay-rows; Andy: "yes." to "one job for the table, one
  // changed row per update"): the store hands each row it wrote differently to its listeners, and the node publishes
  // that row on the permanent job shadow; the forms, Info and the relay details hear it.
  test.subHeading('1l. the one table on the stream: each changed row, heard by every screen');
  const rowsHome = setupRelayFakes('spiritInUseRows').andy;
  fs.rmSync(path.join(rowsHome, 'relay-state'), { recursive: true, force: true });
  const rowsRun = spawnSync(process.execPath, ['-e', [
    "var k = require('./spirit/relayKeys'); var b = require('./spirit/ownerBadge'); var url = 'https://rows.example';",
    "var key = 'MCowBQYDK2VwAyEA+4mt2XtbJHPmiyCri6HRaA/PyH4EPGYE/ez+YpE72Ls='; k.accept(process.cwd(), url, key); b.addRelay(process.cwd(), url, 'rows', key);",
    "var S = require('./spirit/nodeStore').open(process.cwd()).seen; var sent = [];",
    "var stop = typeof S.onChange === 'function' ? S.onChange(function (row) { sent.push(row); }) : null;",
    "if (!stop) { process.stdout.write('missing'); process.exit(0); }",
    "var again = k.seat(process.cwd(), url); var none = sent.length; k.seat(process.cwd(), url); var twice = sent.length;",
    "process.stdout.write(JSON.stringify({ none: none, twice: twice, row: sent[0] || null, key: key }));"].join('\n')], { cwd: rowsHome, encoding: 'utf8' });
  let rows = null;
  try { rows = JSON.parse(rowsRun.stdout); } catch (e) { rows = { said: rowsRun.stdout + rowsRun.stderr }; }
  if (rows && rows.none === 1 && rows.twice === 1 && rows.row && rows.row.publicKey === rows.key && rows.row.seated === true && rows.row.relay === true)
    test.check('the one table on the stream, driven: a seat taken is one changed row, the relay\'s, seated; the same write again changes nothing and sends nothing');
  else test.fail('the one table on the stream, driven: ' + short(rows));
  const serverCode = code('spirit/server.js');
  if (/createJob\('permanent', 'shadow'/.test(serverCode) && /onChange\(/.test(serverCode)) test.check('the node publishes every changed row on the permanent job shadow');
  else test.fail('the node does not publish the table\'s changed rows');
  // On a relay face too (Andy: "onBoards face https://master.noderoutes.net/ did not update its relay dropdowns in the
  // info page"): the face stream carries the shadow job as it changes (goal/G40.11). It holds the one row changed last,
  // so a face opened reads its screens as it draws, and no snapshot of it is sent.
  const faceHomeCode = code('spirit/faceHome.js');
  const priorityFn = (faceHomeCode.match(/function priorityOf\(job\) \{[\s\S]*?\n  \}/) || [''])[0];
  const openFn = (faceHomeCode.match(/function open\(url, k\) \{[\s\S]*?\n  \}/) || [''])[0];
  if (/'shadow'/.test(priorityFn) && !/'shadow'/.test(openFn)) test.check('a relay face hears the shadow job on the face stream as it changes');
  else test.fail('a relay face never hears the shadow job' + (/'shadow'/.test(openFn) ? ', or replays its last row when it opens' : ''));
  // LEAVING A RELAY (Andy: "add the leave verb to node. and publish the \"leaving\"", go): relay.leave {key} posts the
  // removal of this node's own key to that relay and, on its yes, clears seated and the face name on that relay's row
  // (goal/G40.11: no email is kept; the face name is the node's own fact on the row, Andy: "keep it"); the row stays for
  // a later join, and the shadow stream publishes it. Never for a relay this node owns.
  const relayApiNow = code('spirit/relay/api.js');
  if (/leave\s*:\s*\{\s*key\s*:/.test(relayApiNow)) test.check('the relay family declares leave {key}');
  else test.fail('the relay family has no leave verb');
  const leaveRun = spawnSync(process.execPath, ['-e', [
    "var k = require('./spirit/relayKeys'); var b = require('./spirit/ownerBadge'); var url = 'https://leave.example';",
    "var key = 'MCowBQYDK2VwAyEA+4mt2XtbJHPmiyCri6HRaA/PyH4EPGYE/ez+YpE72Ls='; k.accept(process.cwd(), url, key); b.addRelay(process.cwd(), url, 'leave', key);",
    "k.seat(process.cwd(), url); k.keepFace(process.cwd(), url, 'me'); var face = k.faceOf(process.cwd(), url);",
    "var did = k.unseat(process.cwd(), url);",
    "process.stdout.write(JSON.stringify({ did: did, face: face, seated: k.seatedUrls(process.cwd()).indexOf(url) !== -1, kept: ['keepEmail', 'emailOf', 'leaveSeat'].filter(function (n) { return typeof k[n] === 'function'; }), listed: b.loadRelays(process.cwd()).some(function (r) { return r.url === url; }) }));"].join('\n')], { cwd: rowsHome, encoding: 'utf8' });
  let left = null;
  try { left = JSON.parse(leaveRun.stdout); } catch (e) { left = { said: leaveRun.stdout + leaveRun.stderr }; }
  if (left && left.did === true && left.face && left.face.name === 'me' && left.seated === false && Array.isArray(left.kept) && !left.kept.length && left.listed === true)
    test.check('leaving, driven: the face name kept on the relay\'s row, seated cleared, no email kept; the relay stays listed');
  else test.fail('leaving, driven: ' + short(left));
  const hubCode = code('spirit/hub.js');
  const leaveFn = (hubCode.match(/function relayLeave\(body, deps\) \{[\s\S]*?\n  \}/) || [''])[0];
  if (/removePeer/.test(leaveFn) && /unseat\(/.test(leaveFn) && /keepFace\(rootDir, row\.url, ''\)/.test(leaveFn) && /owned|reports\[/.test(leaveFn) && /'leave'\s*:/.test(code('spirit/server.js')))
    test.check('relay.leave on the node: the removal of its own key posted to the relay, the seat cleared on its yes, refused for a relay it owns');
  else test.fail('relay.leave is not on the node');
  const ndNow = code('shell/js/natterDetails/natterDetails.js');
  if (/relay\.leave/.test(ndNow) && /Press again to leave/.test(ndNow)) test.check('the relay details offer Leave this relay, in two presses');
  else test.fail('the relay details offer no Leave');
  // THE JOIN CARRIES THE CALLER'S LINK (box v25; Andy, line by line, then "WOW. proceed."): the first call is
  // {email, URL, card}, URL the link the shell wants opened; the relay adds join=<code> and, last, relay=<key>, and
  // mails it; it knows no loopback, no port, no page and no app name. The second call stays {code, card}.
  const relayJoinFn = (code('spirit/relay.js').match(/function join\(publicKey, [^)]*\) \{[\s\S]*?\n  \}/) || [''])[0];
  if (/function join\(publicKey, email, url, card\)/.test(relayJoinFn) && /join=' \+ code \+ '&relay=' \+/.test(relayJoinFn) && !/127\.0\.0\.1|face\.html|app=join/.test(relayJoinFn))
    test.check('the relay\'s join takes {email, URL, card} and mails <URL>&join=<code>&relay=<key>, knowing no loopback, port, page or app');
  else test.fail('the relay still builds the join link itself');
  const ppCode = code('spirit/peerPost.js');
  if (/join: \{ email: [^}]*url: /.test(ppCode) && !/join: \{ email: [^}]*port: /.test(ppCode) && /joinConfirm: \{ code: String\(code\), card: card \}/.test(ppCode)) test.check('the node\'s first call is {email, url, card}; the second stays {code, card}');
  else test.fail('the node\'s join calls are not {email, url, card} and {code, card}');
  if (/join\s*:\s*\{[^}]*link\s*:\s*'url\?'/.test(code('spirit/relay/api.js')) && /body && body\.link|body\.link/.test((code('spirit/hub.js').match(/function relayJoin\(body, deps\) \{[\s\S]*?\n  \}/) || [''])[0])) test.check('relay.join carries the caller\'s link, and the node passes it to the relay');
  else test.fail('relay.join does not carry the caller\'s link');
  const joinFormNow2 = code('shell/js/joinForm.js');
  if (/joinLink/.test(joinFormNow2) && /\.link = |link:/.test(joinFormNow2) && /joinLink\s*[:=]/.test(faceShell)) test.check('the email form sends the link the shell gives it (spirit.shell.joinLink)');
  else test.fail('the email form sends no link of the shell\'s');
  const startFn = (faceShell.match(/function start\(\) \{[\s\S]*?\n  \}/) || [''])[0];
  if (/joinFromLink\(\)/.test(startFn) && !/if \(home\) \{ startJoin\(\); joinFromLink\(\); \}/.test(startFn)) test.check('the face shell reads the join link on a relay face too, after its login');
  else test.fail('the face shell reads the join link at home only');
  // WHAT A FACE MAY NOT ASK (box v26; Andy: "we only protect the face and its connection, other than that the face uses
  // the same door as a puppeteer would use on the home node", and "fix it"): only a face-name change on the relay the
  // face is called through; relay.join and face names on other relays go through.
  const refuseRun = spawnSync(process.execPath, ['-e', [
    "var F = require('./spirit/faceHome'); var here = { url: 'https://here.example', key: 'KEY-HERE' };",
    "var face = function (body, to) { return JSON.stringify({ body: body, to: to }); };",
    "process.stdout.write(JSON.stringify({",
    "  join: F.faceRefuses({ verb: 'relay.join', url: 'https://here.example', email: 'a@b' }, here),",
    "  faceHere: F.faceRefuses({ verb: 'relay.face', url: 'https://here.example/', name: 'x' }, here),",
    "  faceThere: F.faceRefuses({ verb: 'relay.face', url: 'https://there.example', name: 'x' }, here),",
    "  postHere: F.faceRefuses({ verb: 'peer.post', to: 'KEY-HERE', text: JSON.stringify({ body: { face: { name: 'x' } } }) }, here),",
    "  postThere: F.faceRefuses({ verb: 'peer.post', to: 'KEY-THERE', text: JSON.stringify({ body: { face: { name: 'x' } } }) }, here) }));"].join('\n')], { cwd: RUN, encoding: 'utf8' });
  let refuse = null;
  try { refuse = JSON.parse(refuseRun.stdout); } catch (e) { refuse = { said: refuseRun.stdout + refuseRun.stderr }; }
  if (refuse && refuse.join === '' && refuse.faceHere && refuse.faceThere === '' && refuse.postHere && refuse.postThere === '' && /faceRefuses\(r, \{/.test(code('spirit/faceHome.js')))
    test.check('a face, driven: relay.join goes through, and a face name on another relay; only a face-name change on the relay it is called through is refused');
  else test.fail('a face, driven: ' + short(refuse));
  const hearers = ['shell/js/contacts/listElement.js', 'shell/js/joinForm.js', 'shell/js/faceForm.js', 'shell/info/info.js', 'shell/js/natterDetails/natterDetails.js'].filter(function (f) { return !/'shadow'/.test(code(f)); });
  if (!hearers.length) test.check('Contacts, the two forms, Info and the relay details hear the shadow job and redraw');
  else test.fail('not hearing the shadow job: ' + short(hearers));

  // ONE TABLE FOR ALL KNOWN IDS (goal/G40.11, box v24). Driven on a scratch node.db made in the old shape (the relays
  // and peers tables, seen with choice and kind) and a contacts.json, then opened by the new code: the move runs once,
  // the old stores are gone, and their rows are in seen.
  test.subHeading('1m. one table for all known IDs: seen holds everything, the old stores moved in and gone');
  const oneHome = setupRelayFakes('spiritInUseOne').andy;
  fs.rmSync(path.join(oneHome, 'relay-state'), { recursive: true, force: true });
  fs.mkdirSync(path.join(oneHome, 'relay-state'), { recursive: true });
  const REL = 'MCowBQYDK2VwAyEA+4mt2XtbJHPmiyCri6HRaA/PyH4EPGYE/ez+YpE72Ls=';
  const BERT = 'MCowBQYDK2VwAyEAZQ/IHHn57kdPt0aaaaaaaaaaaaaaaaaaaaaaaaaaaaa=';
  fs.writeFileSync(path.join(oneHome, 'relay-state', 'contacts.json'), JSON.stringify([{ publicKey: BERT, publicLabel: 'Bert', myLabel: 'bert', owned: true, relays: ['https://one.example'] }]), 'utf8');
  const oneRun = spawnSync(process.execPath, ['-e', [
    "const { DatabaseSync } = require('node:sqlite'); const path = require('path'); const file = path.join(process.cwd(), 'relay-state', 'node.db');",
    "const old = new DatabaseSync(file);",
    "old.exec(\"CREATE TABLE seen (publicKey TEXT PRIMARY KEY, label TEXT NOT NULL DEFAULT '', labelRank INTEGER NOT NULL DEFAULT 4, labelAt INTEGER NOT NULL DEFAULT 0, present INTEGER NOT NULL DEFAULT 0, seen INTEGER NOT NULL DEFAULT 0, choice TEXT NOT NULL DEFAULT '', blocked INTEGER NOT NULL DEFAULT 0, kind TEXT NOT NULL DEFAULT 'node')\");",
    "old.exec(\"CREATE TABLE relays (key TEXT PRIMARY KEY, url TEXT NOT NULL, label TEXT NOT NULL DEFAULT '', listed INTEGER NOT NULL DEFAULT 0, pos INTEGER NOT NULL DEFAULT 0, firstSeen TEXT NOT NULL DEFAULT '', acceptedAt TEXT NOT NULL DEFAULT '', replaced TEXT NOT NULL DEFAULT '', seatLabel TEXT NOT NULL DEFAULT '', seatClaimedAt TEXT NOT NULL DEFAULT '', refusal TEXT NOT NULL DEFAULT '', refusedAt TEXT NOT NULL DEFAULT '')\");",
    "old.exec(\"CREATE TABLE peers (peer_id TEXT PRIMARY KEY, label TEXT NOT NULL DEFAULT '')\");",
    "old.prepare('INSERT INTO relays (key, url, label, listed, pos, firstSeen, seatLabel, seatClaimedAt) VALUES (?, ?, ?, 1, 0, ?, ?, ?)').run(process.argv[1], 'https://one.example', 'one', '2026-10-01T00:00:00.000Z', 'me', '2026-10-01T00:00:00.000Z');",
    "old.prepare(\"INSERT INTO seen (publicKey, label, seen, choice, kind) VALUES (?, 'Stranger', 5, '', 'node')\").run('MCowStranger');",
    "old.close();",
    "const store = require('./spirit/nodeStore').open(process.cwd());",
    "const db = new DatabaseSync(file, { readOnly: true });",
    "const tables = db.prepare(\"SELECT name FROM sqlite_master WHERE type = 'table'\").all().map(function (r) { return r.name; });",
    "const cols = db.prepare('PRAGMA table_info(seen)').all().map(function (c) { return c.name; });",
    "const idx = db.prepare(\"SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'seen'\").all();",
    "const row = function (k) { try { return db.prepare('SELECT * FROM seen WHERE publicKey = ?').get(k) || null; } catch (e) { return null; } };",
    "const routes = function (k) { try { return db.prepare('SELECT via, url FROM seen_routes WHERE publicKey = ?').all(k); } catch (e) { return []; } };",
    "process.stdout.write(JSON.stringify({ tables: tables, cols: cols, idx: idx.map(function (i) { return String(i.sql || ''); }), relay: row(process.argv[1]), relayRoutes: routes(process.argv[1]), bert: row(process.argv[2]), stranger: row('MCowStranger'), contactsFile: require('fs').existsSync(path.join(process.cwd(), 'relay-state', 'contacts.json')) }));",
    "if (store && typeof store.close === 'function') store.close();"].join('\n'), REL, BERT], { cwd: oneHome, encoding: 'utf8' });
  let one = null;
  try { one = JSON.parse(oneRun.stdout); } catch (e) { one = { said: (oneRun.stdout + oneRun.stderr).slice(0, 600) }; }
  const WANT_COLS = ['publicKey', 'label', 'labelRank', 'labelAt', 'present', 'myLabel', 'card', 'firstSeen', 'lastSeen', 'keep', 'mine', 'relay', 'held', 'ignored', 'blocked', 'seated'];
  const GONE_COLS = ['choice', 'kind', 'seen'];
  const colsOk = one && Array.isArray(one.cols) && WANT_COLS.every(function (c) { return one.cols.indexOf(c) !== -1; }) && GONE_COLS.every(function (c) { return one.cols.indexOf(c) === -1; });
  if (colsOk) test.check('seen, driven: one row per ID with label, myLabel, card, present, firstSeen, lastSeen and the booleans keep, mine, relay, held, ignored, blocked, seated; choice, kind and seen gone');
  else test.fail('seen\'s columns, driven: ' + short(one && (one.cols || one.said)));
  if (one && Array.isArray(one.tables) && one.tables.indexOf('relays') === -1 && one.tables.indexOf('peers') === -1 && one.tables.indexOf('seen_routes') !== -1 && one.tables.indexOf('grants') !== -1 && one.contactsFile === false)
    test.check('the move, driven: the relays and peers tables and contacts.json are gone; seen_routes and grants stay');
  else test.fail('the old stores, driven: ' + short(one && { tables: one.tables, contactsFile: one.contactsFile, said: one.said }));
  const partial = function (flag) { return one && Array.isArray(one.idx) && one.idx.some(function (s) { return new RegExp('WHERE\\s+' + flag + '\\s*=\\s*1', 'i').test(s); }); };
  const shedIdx = one && Array.isArray(one.idx) && one.idx.some(function (s) { return /lastSeen/.test(s) && /keep\s*=\s*0/i.test(s) && /mine\s*=\s*0/i.test(s); });
  if (partial('keep') && partial('mine') && partial('relay') && shedIdx) test.check('seen\'s indexes, driven: a partial index for keep, mine and relay, and one for shedding over rows with neither keep nor mine, by lastSeen');
  else test.fail('seen\'s indexes, driven: ' + short(one && one.idx));
  const rel = one && one.relay;
  if (rel && rel.relay === 1 && rel.keep === 1 && rel.seated === 1 && one.relayRoutes.some(function (r) { return r.via === '' && r.url === 'https://one.example'; }))
    test.check('the move, driven: a listed, seated relay becomes a row with relay, keep and seated, its url a direct route');
  else test.fail('the relay\'s row after the move, driven: ' + short(one && { relay: one.relay, routes: one.relayRoutes }));
  const bert = one && one.bert;
  if (bert && bert.keep === 1 && bert.mine === 1 && bert.myLabel === 'bert' && one.stranger && one.stranger.keep === 0 && one.stranger.lastSeen === 5)
    test.check('the move, driven: a contact becomes a kept row (owned as mine, its own name kept); a shadow row keeps its last seen and no flag');
  else test.fail('the contact\'s row after the move, driven: ' + short(one && { bert: one.bert, stranger: one.stranger }));

  // THE ONE SEARCH AND THE ONE STREAM (box v24; Andy: "yes. those names."): contact.search covers the whole table, relays
  // too, with a yes-filter per boolean; relay.search goes. The stream job is shadow, one changed row per update;
  // relay-rows goes. Seated is cleared by a refusal as no member; what the network search finds is held.
  const contactApi = fs.readFileSync(path.join(RUN, 'spirit', 'contact', 'api.js'), 'utf8');
  const searchDecl = (contactApi.match(/search\s*:\s*\{[^}]*\}/) || [''])[0];
  const flagsOk = ['keep', 'mine', 'relay', 'seated', 'held', 'blocked'].every(function (f) { return new RegExp('\\b' + f + "\\s*:\\s*'flag\\?'").test(searchDecl); }) && !/owned/.test(searchDecl);
  if (flagsOk && !/\bsearch\s*:/.test((code('spirit/relay/api.js').match(/verbs\s*:\s*\{[\s\S]*?\n  \}/) || [''])[0])) test.check('one search: contact.search with yes-filters keep, mine, relay, seated, held, blocked; relay.search gone');
  else test.fail('the search: contact.search declares ' + short(searchDecl) + (flagsOk ? '' : '') + ', relay.search ' + (/\bsearch\s*:/.test(code('spirit/relay/api.js')) ? 'still there' : 'gone'));
  const stillRows = ['spirit/server.js', 'spirit/faceHome.js', 'shell/info/info.js', 'shell/js/contacts/listElement.js', 'shell/js/faceForm.js', 'shell/js/joinForm.js', 'shell/js/natterDetails/natterDetails.js'].filter(function (f) { return /relay-rows|relayRowsJob/.test(code(f)); });
  if (!fs.existsSync(path.join(RUN, 'spirit', 'relayRowsJob.js')) && !stillRows.length && /'shadow'/.test(code('spirit/server.js') + code('spirit/nodeStore.js') + code('spirit/seenPeers.js')))
    test.check('one stream: the shadow job; relay-rows and relayRowsJob gone from every file');
  else test.fail('the stream: relay-rows still in ' + short(stillRows) + (fs.existsSync(path.join(RUN, 'spirit', 'relayRowsJob.js')) ? ', relayRowsJob.js still there' : ''));
  const rejectedFn = (code('spirit/peerPost.js').match(/function rejectedBy\(relayUrl, status, said\) \{[\s\S]*?\n  \}/) || [''])[0];
  if (/seated/.test(rejectedFn)) test.check('a refusal as no member clears seated on that relay\'s row');
  else test.fail('a refusal does not clear seated');
  const netFn = (code('spirit/hub.js').match(/function networkSearch\(q, d\) \{[\s\S]*?\n  \}/) || [''])[0];
  if (/held:\s*true|held\s*=\s*1|'held'\)/.test(netFn)) test.check('what the network search finds lands held');
  else test.fail('the network search\'s finds are not held');

  // NO KEYS IN ANY FACE APP (box v15; Andy: "remove ANY indication of keys from all user interfaces"): no app the face
  // shows, and no element it loads, puts a key or a sentence about one on the screen.
  const faceApps = fs.readdirSync(path.join(RUN, 'shell')).filter(function (d) {
    try { return JSON.parse(fs.readFileSync(path.join(RUN, 'shell', d, d + '.js.sidecar.json'), 'utf8')).face.app === true; } catch (e) { return false; }
  }).map(function (d) { return 'shell/' + d + '/' + d + '.js'; });
  const onScreen = faceApps.concat((parts || []).filter(function (p) { return /^shell\/js\//.test(p); }));
  const keyWords = onScreen.filter(function (f) {
    if (!fs.existsSync(path.join(RUN, f))) return false;
    const strings = (code(f).match(/'[^'\n]*'/g) || []).join(' ');
    return /\bits key\b|what its key is|this node's key|\bkey ending\b|publicKey\s*\+|textContent = [a-zA-Z.]*publicKey/i.test(strings + ' ' + code(f).match(/textContent = [^;]*/g));
  });
  if (faceApps.length >= 6 && !keyWords.length) test.check('no key on any face screen: ' + faceApps.length + ' face apps and the elements the face loads draw none');
  else test.fail('keys on face screens: ' + short(keyWords));

  // NO NAMELESS ROWS IN CONTACTS (box v15): a key the relay reports present is no row until it has a name.
  const listRun = spawnSync(process.execPath, ['-e', [
    "global.window = { spirit: { elements: {} } }; global.document = { createElement: function () { return {}; } };",
    "require(process.argv[1]); var F = window.spirit.elements.contactList && window.spirit.elements.contactList.filters;",
    "if (!F) { process.stdout.write('no filters'); process.exit(0); }",
    "function shows(row) { return F.every(function (f) { return typeof f.test !== 'function' || Number(f.test(row, f.toggle ? false : 'all')) > 0; }); }",
    "process.stdout.write(JSON.stringify({ bare: shows({ present: true }), person: shows({ name: 'Bert', present: true }), relay: shows({ name: 'NodeRoutes', kind: 'relay', relay: true }) }));"].join('\n'), path.join(RUN, 'shell', 'js', 'contacts', 'listElement.js')], { encoding: 'utf8' });
  let named = null;
  try { named = JSON.parse(listRun.stdout); } catch (e) { named = { said: listRun.stdout + listRun.stderr }; }
  if (named && named.bare === false && named.person === true && named.relay === true) test.check('Contacts, driven: a key with only its presence is no row; a person and a relay are');
  else test.fail('Contacts shows nameless rows: ' + short(named));

  // THE OWNER'S SEAT, ON HIS NODE (goal/G40.10; Andy: "the relay on every boot has to fucking make sure the owner has a
  // seat"). The relay seats him at boot (goal/G30.7); his node notes that seat when the relay reports to its owner, and
  // the relay as his (goal/G40.11: mine, "owned, puppets and owned relays"). What the relay calls him is his node's own
  // name, which the node pushes; nothing of the seat is stored (box v24).
  test.subHeading('1h. the owner\'s seat on his node: an owned relay\'s report notes the seat, and the relay as his');
  const ownerHome = setupRelayFakes('spiritInUseOwner').andy;
  // A fresh home each run: the scratch copy keeps its relay-state between runs.
  fs.rmSync(path.join(ownerHome, 'relay-state'), { recursive: true, force: true });
  const seatRun = spawnSync(process.execPath, ['-e', [
    "const k = require('./spirit/relayKeys'); const b = require('./spirit/ownerBadge'); const url = 'https://owned.example';",
    "b.addRelay(process.cwd(), url, 'owned', ''); k.accept(process.cwd(), url, 'MCowBQYDK2VwAyEA+4mt2XtbJHPmiyCri6HRaA/PyH4EPGYE/ez+YpE72Ls=');",
    "const before = k.seatLabel(process.cwd(), url); const name = require('./spirit/relayAuth').loadIdentity(process.cwd()).name;",
    "const noted = typeof k.ownerSeat === 'function' ? k.ownerSeat(process.cwd(), url, 'Andy Flinn Music') : 'missing';",
    "const again = typeof k.ownerSeat === 'function' ? k.ownerSeat(process.cwd(), url, 'Andy Flinn Music') : 'missing';",
    "process.stdout.write(JSON.stringify({ before: before, noted: noted, again: again, label: k.seatLabel(process.cwd(), url), name: name, mine: (k.byUrl(process.cwd(), url) || {}).mine, seated: k.seatedUrls(process.cwd()).indexOf(url) !== -1 }));"].join('\n')], { cwd: ownerHome, encoding: 'utf8' });
  let seat = null;
  try { seat = JSON.parse(seatRun.stdout); } catch (e) { seat = { said: seatRun.stdout + seatRun.stderr }; }
  if (seat && seat.before === '' && seat.noted === true && seat.again === false && seat.label === seat.name && !!seat.name && seat.mine === true && seat.seated)
    test.check('an owned relay\'s seat, driven: noted once, seated and mine, called by the node\'s own name, and not written again while unchanged');
  else test.fail('the owner\'s seat, driven: ' + short(seat));
  const presenceCode = code('spirit/presenceNode.js');
  if (/relay-status[\s\S]{0,600}ownerSeat\(/.test(presenceCode)) test.check('the node notes the owner\'s seat when a relay it owns reports to it');
  else test.fail('the node does not note the owner\'s seat on a relay\'s report');

  // MORE DESK FIXES (goal/G40.12, box v7, first set). A desk on scratch state, driven through its verbs, his presses as
  // the owner and an agent's as claude-windows.
  test.subHeading('1n. more desk fixes: design at any time, no commit in design, one search, test rules that attach themselves');
  const deskRun = await (async function () {
    const os = require('os');
    const appClient = require('../run/spirit/appClient.js');
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-inuse-desk-'));
    const state = path.join(scratch, 'state');
    test.seedDesk(state, [{ goal: { id: 'goal/G100', title: 'Fixes' }, items: [{ id: 'goal/G100.1', title: 'One', blocks: ['goal/G100'] }] }]);
    const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
    const client = appClient.createAppClient({ rootDir: scratch });
    client.register('desk', pipe);
    const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAspiritInUseDeskOwnerAAAAAAAAAAAAAAAAA=', label: 'andy' };
    const CW = { key: 'MCowBQYDK2VwAyEAspiritInUseDeskCWAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
    const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function (e) { return { refused: e && (e.code || e.message) }; }); };
    const took = function (r) { return r && r.status === 200 && r.body && r.body.ok !== false; };
    const facts = async function (id) { const r = await call('item.get', { id: id }, ANDY); const f = r.body && r.body.item; try { return typeof f === 'string' ? JSON.parse(f) : (f || {}); } catch (e) { return {}; } };
    const kid = spawn(process.execPath, [path.join(RUN, 'process', 'js', 'desk', 'desk.js'), '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    const out = {};
    try {
      let up = false;
      for (let i = 0; i < 60 && !up; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.desk && r.body.desk.ok !== false); } catch (e) { /* not yet */ } }
      if (!up) return { up: false };
      out.up = true;
      await call('press', { id: 'goal/G100', what: 'end-design' }, ANDY);
      await call('press', { id: 'goal/G100.1', what: 'go' }, ANDY);
      // 1. Design on a running item, at any time.
      out.runningButtons = (await facts('goal/G100.1')).buttons || [];
      out.startOnRunning = took(await call('press', { id: 'goal/G100.1', what: 'start-design' }, ANDY));
      out.itemDesign = (await facts('goal/G100.1')).design;
      // 2. No commit while the item, or its goal, is in design.
      out.mayItemDesign = (await call('phase.may', { id: 'goal/G100.1' }, CW)).body;
      await call('press', { id: 'goal/G100.1', what: 'end-design' }, ANDY);
      out.mayOut = (await call('phase.may', { id: 'goal/G100.1' }, CW)).body;
      await call('press', { id: 'goal/G100', what: 'start-design' }, ANDY);
      out.mayGoalDesign = (await call('phase.may', { id: 'goal/G100.1' }, CW)).body;
      await call('press', { id: 'goal/G100', what: 'end-design' }, ANDY);
      // 6. One red Q per agent per item.
      out.q1 = took(await call('check.add', { id: 'goal/G100.1', kind: 'Q', words: 'Which of the two names is it?', test: '' }, CW));
      out.q2 = took(await call('check.add', { id: 'goal/G100.1', kind: 'Q', words: 'And which file does it live in?', test: '' }, CW));
      // 7. A reopened goal is in design again.
      await call('press', { id: 'goal/G100', what: 'close' }, ANDY);
      await call('press', { id: 'goal/G100', what: 'reopen' }, ANDY);
      out.reopenedGoalDesign = (await facts('goal/G100')).design;
      // 4. The test type, and a rule that attaches itself to every goal at its creation.
      const added = await call('rule.add', { type: 'test', label: 'The red is the check', text: 'A build and a verify run the item\'s red only.', autoAttach: true }, ANDY);
      out.ruleAdded = took(added) ? added.body.key : short(added.body || added);
      if (took(added)) {
        await call('rule.version', { key: added.body.key, text: 'A build and a verify run the item\'s red only.', status: 'active' }, ANDY);
        out.ruleRow = (await call('rule.get', { key: added.body.key }, ANDY)).body || {};
      }
      const g = await call('goal.add', { title: 'Next' }, ANDY);
      out.newGoal = took(g) ? g.body.id : '';
      out.newGoalRules = out.newGoal ? ((await facts(out.newGoal)).rules || []) : [];
      // SECOND SET. Each goal and item keeps a list of attached rules (item.rules.add / item.rules.remove {id, rule}); an
      // agent's work carries the goal's rules for its phase plus the item's, each once (facts.phaseRules): design rules
      // in design, test rules in red and verify, code rules in build.
      const rule = async function (type, label) {
        const r = await call('rule.add', { type: type, label: label, text: label + '.' }, ANDY);
        if (!took(r)) return '';
        await call('rule.version', { key: r.body.key, text: label + '.', status: 'active' }, ANDY);
        return r.body.key;
      };
      out.rd = await rule('design', 'Design one point at a time');
      out.rt = await rule('test', 'Assert his outcome on real data');
      out.rt2 = await rule('test', 'The red names its suites');
      out.rc = await rule('code', 'Delete what you replace');
      out.rdAuto = ((await call('rule.get', { key: out.rd }, ANDY)).body || {}).autoAttach;
      // Q1, Andy: "rule.version? carries the full rule." So autoAttach is turned on by a new version.
      if (out.rc) await call('rule.version', { key: out.rc, text: 'Delete what you replace.', status: 'active', autoAttach: true }, ANDY);
      out.rcAuto = out.rc ? ((await call('rule.get', { key: out.rc }, ANDY)).body || {}).autoAttach : undefined;
      const ts = await call('rules.search', { text: '', types: ['test'], statuses: [] }, ANDY);
      out.testFound = ((ts.body && ts.body.items) || []).map(function (i) { return i.key; }).sort();
      const g2 = out.newGoal || '';
      const it2 = g2 ? await call('item.add', { goal: g2, title: 'Two', blocks: g2 }, ANDY) : {};
      out.item2 = took(it2) ? it2.body.id : '';
      const attach = async function (id, key) { return took(await call('item.rules.add', { id: id, rule: key }, ANDY)); };
      if (g2) await call('press', { id: g2, what: 'make-current' }, ANDY);
      out.attached = out.item2 ? [await attach(g2, out.rd), await attach(g2, out.rt), await attach(g2, out.rc), await attach(out.item2, out.rt), await attach(out.item2, out.rt2), await attach(out.item2, out.rc)] : [];
      const keysOf = function (list) { return (list || []).map(function (r) { return r && (r.key || r); }).sort(); };
      if (out.item2) {
        out.goalRules = keysOf((await facts(g2)).rules);
        out.itemRules = keysOf((await facts(out.item2)).rules);
        out.removed = took(await call('item.rules.remove', { id: out.item2, rule: out.rc }, ANDY));
        out.itemRulesAfter = keysOf((await facts(out.item2)).rules);
        out.designRules = keysOf((await facts(out.item2)).phaseRules);
        await call('press', { id: g2, what: 'end-design' }, ANDY);
        if ((await facts(out.item2)).code !== true) await call('press', { id: out.item2, what: 'code' }, ANDY);
        await call('press', { id: out.item2, what: 'go' }, ANDY);
        out.redTake = took(await call('phase.take', { id: out.item2, phase: 'red' }, CW));
        out.redRules = keysOf((await facts(out.item2)).phaseRules);
        await call('item.suites.add', { id: out.item2, path: 'spirit/test/spiritInUse.js' }, CW);
        await call('claim', { id: out.item2, phase: 'red', commit: '0000000000000000000000000000000000000000' }, CW);
        await call('phase.done', { id: out.item2, phase: 'red' }, CW);
        out.buildTake = took(await call('phase.take', { id: out.item2, phase: 'build' }, CW));
        out.buildRules = keysOf((await facts(out.item2)).phaseRules);
      }
    } finally { kid.kill(); }
    return out;
  }());
  const dr = deskRun;
  if (!dr.up) test.fail('the scratch desk did not start');
  else {
    if (dr.runningButtons.indexOf('start-design') !== -1 && dr.startOnRunning && dr.itemDesign === true) test.check('an item after his Go offers Start design, and his press puts it in design: design on an item at any time');
    else test.fail('Start design on a running item: buttons ' + short(dr.runningButtons) + ', pressed ' + dr.startOnRunning + ', design ' + dr.itemDesign);
    if (dr.mayItemDesign && dr.mayItemDesign.allowed === false && dr.mayGoalDesign && dr.mayGoalDesign.allowed === false && dr.mayOut && dr.mayOut.allowed === true)
      test.check('no commit lands while the item, or its goal, is in design (phase.may refuses both, and allows out of design)');
    else test.fail('commits in design: item in design ' + short(dr.mayItemDesign) + ', goal in design ' + short(dr.mayGoalDesign) + ', out of design ' + short(dr.mayOut));
    if (dr.q1 && !dr.q2) test.check('an agent raises one red Q per item: its second open Q is refused');
    else test.fail('one red Q per agent: first ' + dr.q1 + ', second ' + dr.q2);
    if (dr.reopenedGoalDesign === true) test.check('reopening a goal puts it back into design');
    else test.fail('a reopened goal\'s design: ' + short(dr.reopenedGoalDesign));
    if (dr.ruleRow && dr.ruleRow.type === 'test' && dr.ruleRow.autoAttach === true) test.check('a rule takes the type test and the field autoAttach, and rule.get answers both');
    else test.fail('the test type and autoAttach: added ' + short(dr.ruleAdded) + ', row ' + short(dr.ruleRow));
    if (dr.newGoal && (dr.newGoalRules || []).some(function (r) { return r && (r.key || r) === dr.ruleAdded; })) test.check('a goal created after it carries the active autoAttach rule among its rules');
    else test.fail('auto-attach at goal creation: goal ' + short(dr.newGoal) + ', its rules ' + short(dr.newGoalRules));
    const same = function (a, b) { return JSON.stringify((a || []).slice().sort()) === JSON.stringify((b || []).slice().sort()); };
    if (dr.rd && dr.rdAuto === false) test.check('autoAttach is false unless it is set');
    else test.fail('autoAttach on a rule added without it: ' + short(dr.rdAuto));
    if (dr.rc && dr.rcAuto === true) test.check('rule.version carries the full rule, autoAttach with it: a new version turns it on');
    else test.fail('autoAttach through rule.version: ' + short(dr.rcAuto));
    if (dr.rt && dr.rt2 && dr.ruleAdded && same(dr.testFound, [dr.ruleAdded, dr.rt, dr.rt2])) test.check('the rules search filters by the test type');
    else test.fail('the rules search for test rules: ' + short(dr.testFound));
    if (dr.item2 && dr.attached.every(Boolean) && dr.goalRules.indexOf(dr.rd) !== -1 && dr.goalRules.indexOf(dr.rt) !== -1 && dr.goalRules.indexOf(dr.rc) !== -1 &&
      same(dr.itemRules, [dr.rt, dr.rt2, dr.rc]) && dr.removed && same(dr.itemRulesAfter, [dr.rt, dr.rt2]))
      test.check('a goal and an item each keep their attached rules: item.rules.add puts one on, item.rules.remove takes it off');
    else test.fail('attached rules: item ' + short(dr.item2) + ', added ' + short(dr.attached) + ', goal ' + short(dr.goalRules) + ', item ' + short(dr.itemRules) + ', removed ' + dr.removed + ', after ' + short(dr.itemRulesAfter));
    if (dr.item2 && same(dr.designRules, [dr.rd])) test.check('in design an item\'s work carries the design rules, its goal\'s and its own');
    else test.fail('the rules in design: ' + short(dr.designRules) + ', expected ' + short([dr.rd]));
    // The goal is the one made after the autoAttach test rule (ruleAdded), so that rule is among its test rules too.
    if (dr.redTake && same(dr.redRules, [dr.ruleAdded, dr.rt, dr.rt2])) test.check('the take of red carries the test rules of the goal and the item, each once');
    else test.fail('the rules of the red: taken ' + dr.redTake + ', ' + short(dr.redRules) + ', expected ' + short([dr.ruleAdded, dr.rt, dr.rt2]));
    if (dr.buildTake && same(dr.buildRules, [dr.rc])) test.check('the take of build carries the code rules of the goal and the item, each once');
    else test.fail('the rules of the build: taken ' + dr.buildTake + ', ' + short(dr.buildRules) + ', expected ' + short([dr.rc]));
  }
  const wakeCode = code('process/js/deskClient/deskClient.js');
  if (/fx\.phaseRules/.test(wakeCode) && !/fx\.rules\b/.test(wakeCode)) test.check('a wake names the rules of the phase the agent is in (facts.phaseRules), not those stamped at his Go');
  else test.fail('the wake still reads the rules stamped at his Go');
  if (!/function typesOf\(|function rulesForGo\(/.test(code('process/js/desk/desk.js'))) test.check('the rules stamped at his Go by the paths in the box are gone: no typesOf, no rulesForGo');
  else test.fail('typesOf or rulesForGo still stamps rules at his Go');
  const ddCode = code('shell/deskDetails/deskDetails.js');
  if (/key:\s*'rules'/.test(ddCode) && /probabilitySearch/.test(ddCode) && /rules\.search/.test(ddCode) && /item\.rules\.add/.test(ddCode) && /item\.rules\.remove/.test(ddCode))
    test.check('the details\' icon strip has a rules icon: its panel lists the attached rules, adds one through a probability search of the rules, and removes one by its row\'s delete');
  else test.fail('no rules panel in the details\' icon strip with its search and delete');
  // 3. Every search on the desk's pages is the probability search.
  const deskPages = [];
  (function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(js|html)$/.test(e.name)) deskPages.push(path.relative(RUN, p).replace(/\\/g, '/'));
    });
  }(path.join(RUN, 'shell', 'desk')));
  ['shell/deskDetails', 'shell/ruleDetails'].forEach(function (d) { fs.readdirSync(path.join(RUN, d)).filter(function (n) { return /\.(js|html)$/.test(n); }).forEach(function (n) { deskPages.push(d + '/' + n); }); });
  const oldSearch = deskPages.filter(function (f) { return /listSearch|shellCreateListSearch/.test(code(f)); });
  if (!oldSearch.length) test.check('every search on the desk\'s pages is the probability search: none of their ' + deskPages.length + ' files uses the old list search');
  else test.fail('the old list search on the desk\'s pages: ' + oldSearch.join(', '));
  // 5. The desk raises no question of its own.
  const deskCode = code('process/js/desk/desk.js').replace(/^\s*\/\/.*$/mg, '');
  if (!/kind:\s*'Q'[^}]*by:\s*'desk'|by:\s*'desk'[^}]*kind:\s*'Q'|stale:/.test(deskCode)) test.check('the desk raises no idle question: no Q written by the desk, no stale Q');
  else test.fail('the desk still writes a question of its own');

  // FIX THE CONTACTS UI, AND THE PRODUCT TEST SYSTEM (goal/G40.13, box v22).
  test.subHeading('1o. the contacts list gets a sized box; the product test system stands alone; the desk brings tests and ui rules by the file list');
  // The Contacts page hands its list a box of a stated size, as Apps and Icons do (shell.css .fill, rule/16).
  const contactsPage = code('shell/contacts/contacts.js');
  if (/id="contacts-book" class="[^"]*\bfill\b/.test(contactsPage) && /flex-direction:\s*column|class="fill"|classList\.add\('fill'\)/.test(contactsPage))
    test.check('the Contacts page hands its list a sized box: the list box takes fill, in a page that is a flex column');
  else test.fail('the Contacts list box has no stated size (no fill, or no flex column around it)');
  // 1. The product test system depends on nothing outside spirit/run/: nothing in a test/ folder of the run tree reaches
  // into spirit/test/, and its own reporter in spirit/run/test/ prints the lines the verifier reads.
  const productTests = [];
  (function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
      if (e.name === 'node_modules' || e.name === 'relay-state' || e.name === '.git') return;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.js$/.test(e.name) && /[\\/]test[\\/][^\\/]+$/.test(p)) productTests.push(path.relative(RUN, p).replace(/\\/g, '/'));
    });
  }(RUN));
  const reaching = productTests.filter(function (f) { return /testSupport|'\.\.',\s*'\.\.',\s*'test'|spirit\/test\//.test(code(f)); });
  if (productTests.length && !reaching.length) test.check('no product test reaches into spirit/test/ (' + productTests.length + ' files in the run tree\'s test folders read)');
  else test.fail('product tests that reach into spirit/test/: ' + reaching.join(', '));
  const REPORTER = path.join(RUN, 'test', 'testReport.js');
  const reporterCode = fs.existsSync(REPORTER) ? code('test/testReport.js') : '';
  const PROBE_TEST = [
    "const t = require(process.argv[1]);",
    "t.startTest('probe'); t.subHeading('one'); t.check('a pass'); t.fail('a fail'); t.reportSuccessFailureCount();",
  ].join('\n');
  const probed = reporterCode ? spawnSync(process.execPath, ['-e', PROBE_TEST, REPORTER], { encoding: 'utf8', timeout: 20000 }) : { stdout: '' };
  const lines = String(probed.stdout || '').split('\n').filter(function (l) { return /^\**\s*(SUCCESS|FAILURE) #/.test(l); });
  if (lines.length === 2 && /SUCCESS #/.test(lines[0]) && /FAILURE #/.test(lines[1]) && !/testSupport|spirit\/test\//.test(reporterCode))
    test.check('the product test system has its own reporter, spirit/run/test/testReport.js: it prints the SUCCESS and FAILURE lines the verifier reads, and needs nothing of spirit/test/');
  else test.fail('the product reporter spirit/run/test/testReport.js: ' + (reporterCode ? short(probed.stdout + probed.stderr) : 'not there'));
  if (reporterCode && /--verify-port/.test(reporterCode) && /deskVerify\.record/.test(reporterCode) && /spirit\.js/.test(reporterCode) && !/\bfetch\(/.test(reporterCode))
    test.check('when the verifier started the run, the reporter posts each result to the node\'s verifier through the spirit object (deskVerify.record), with no fetch of its own');
  else test.fail('the product reporter does not post its results to the verifier through the spirit object');
  // 3, 11. Test pairs beside the modules the Contacts face-app uses: ./test/<name>.js and ./test/<name>.md.
  const CONTACT_MODULES = ['shell/js/contacts/listElement.js', 'shell/js/contacts/rowElement.js', 'shell/js/contacts/data.js', 'shell/js/probabilitySearch.js',
    'shell/js/rowElement.js', 'shell/js/spiritData.js', 'shell/js/contactLabel.js'];
  const pairOf = function (m) { const d = path.posix.dirname(m); const n = path.posix.basename(m, '.js'); return { js: d + '/test/' + n + '.js', md: d + '/test/' + n + '.md' }; };
  const unpaired = CONTACT_MODULES.filter(function (m) { const p = pairOf(m); return !fs.existsSync(path.join(RUN, p.js)) || !fs.existsSync(path.join(RUN, p.md)); });
  if (!unpaired.length) test.check('each module the Contacts face-app uses has its pair beside it, ./test/<name>.js and ./test/<name>.md: ' + CONTACT_MODULES.length + ' modules');
  else test.fail('modules of the Contacts face-app without their test pair: ' + unpaired.join(', '));
  const tm = require(path.join(RUN, 'test', 'testModule.js'));
  const notNamed = CONTACT_MODULES.filter(function (m) { return !(tm.testsFor(m) || []).some(function (t) { return t.test === pairOf(m).js; }); });
  if (!unpaired.length && !notNamed.length) test.check('testModule.js names each of those tests for its module');
  else test.fail('testModule.js does not name the own test of: ' + (unpaired.length ? 'the missing pairs' : notNamed.join(', ')));
  // 4. A test exercises its module: it loads it and its run prints the result lines; none reads the module as text alone.
  const ran = unpaired.length ? [] : CONTACT_MODULES.map(function (m) {
    const t = pairOf(m).js;
    const r = spawnSync(process.execPath, [path.join(RUN, t)], { cwd: path.join(RUN, '..', '..'), encoding: 'utf8', timeout: 120000 });
    const own = String(r.stdout || '').split('\n').filter(function (l) { return /^\**\s*(SUCCESS|FAILURE) #/.test(l); });
    const loads = new RegExp(path.posix.basename(m).replace('.', '\\.')).test(code(t));
    return { t: t, lines: own.length, red: own.filter(function (l) { return /FAILURE #/.test(l); }).length, loads: loads };
  });
  const thin = ran.filter(function (x) { return !x.loads || !x.lines || x.red; });
  if (ran.length && !thin.length) test.check('each of those tests loads its module and runs green through the product reporter (' + ran.reduce(function (n, x) { return n + x.lines; }, 0) + ' results)');
  else test.fail('the contacts modules\' tests: ' + (ran.length ? short(thin) : 'not there'));
  // 6, 7. The desk, driven: a listed file with its own test brings that test; a shell file brings the auto-attach ui
  // rules, which then ride on every take and wake; at goal creation no auto-attach ui rule comes.
  const fileRun = await (async function () {
    const os = require('os');
    const appClient = require('../run/spirit/appClient.js');
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-inuse-files-'));
    const state = path.join(scratch, 'state');
    test.seedDesk(state, [{ goal: { id: 'goal/G100', title: 'Fixes' }, items: [{ id: 'goal/G100.1', title: 'One', blocks: ['goal/G100'] }, { id: 'goal/G100.2', title: 'Two', blocks: ['goal/G100'] }] }]);
    const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
    const client = appClient.createAppClient({ rootDir: scratch });
    client.register('desk', pipe);
    const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAspiritInUseFilesOwnerAAAAAAAAAAAAAAAAA=', label: 'andy' };
    const CW = { key: 'MCowBQYDK2VwAyEAspiritInUseFilesCWAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
    const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function (e) { return { refused: e && (e.code || e.message) }; }); };
    const took = function (r) { return r && r.status === 200 && r.body && r.body.ok !== false; };
    const facts = async function (id) { const r = await call('item.get', { id: id }, ANDY); const f = r.body && r.body.item; try { return typeof f === 'string' ? JSON.parse(f) : (f || {}); } catch (e) { return {}; } };
    const keysOf = function (list) { return (list || []).map(function (r) { return r && (r.key || r); }).sort(); };
    const suitesOf = async function (id) { const r = await call('item.suites.search', { id: id, text: '' }, ANDY); return ((r.body && r.body.items) || []).map(function (i) { return i.key; }).sort(); };
    const kid = spawn(process.execPath, [path.join(RUN, 'process', 'js', 'desk', 'desk.js'), '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    const out = {};
    try {
      let up = false;
      for (let i = 0; i < 60 && !up; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.desk && r.body.desk.ok !== false); } catch (e) { /* not yet */ } }
      if (!up) return { up: false };
      out.up = true;
      const rule = async function (type, label, auto) {
        const r = await call('rule.add', { type: type, label: label, text: label + '.', autoAttach: auto }, ANDY);
        if (!took(r)) return '';
        await call('rule.version', { key: r.body.key, text: label + '.', status: 'active', autoAttach: auto }, ANDY);
        return r.body.key;
      };
      out.ui = await rule('ui', 'A list gets a box of a stated size', true);
      out.desk = await rule('desk', 'Check for work before going idle', true);
      // 6. A file of the product tree with its own test (spirit.js beside test/spirit.js) brings that test; a file
      // without one brings nothing.
      out.before = await suitesOf('goal/G100.1');
      await call('item.files.add', { id: 'goal/G100.1', path: 'spirit/run/spirit.js' }, CW);
      out.withTest = await suitesOf('goal/G100.1');
      await call('item.files.add', { id: 'goal/G100.2', path: 'spirit/run/process/js/desk/desk.js' }, CW);
      out.noTest = await suitesOf('goal/G100.2');
      out.noShellRules = keysOf((await facts('goal/G100.2')).rules);
      // 7. A shell file brings the auto-attach ui rules onto the item, and they ride on every take and wake.
      await call('item.files.add', { id: 'goal/G100.2', path: 'spirit/run/shell/js/probabilitySearch.js' }, CW);
      out.shellRules = keysOf((await facts('goal/G100.2')).rules);
      out.designRules = keysOf((await facts('goal/G100.2')).phaseRules);
      await call('press', { id: 'goal/G100', what: 'end-design' }, ANDY);
      if ((await facts('goal/G100.2')).code !== true) await call('press', { id: 'goal/G100.2', what: 'code' }, ANDY);
      await call('press', { id: 'goal/G100.2', what: 'go' }, ANDY);
      out.redTake = took(await call('phase.take', { id: 'goal/G100.2', phase: 'red' }, CW));
      out.redRules = keysOf((await facts('goal/G100.2')).phaseRules);
      // At goal creation: the auto-attach desk rule comes, the auto-attach ui rule does not.
      const g = await call('goal.add', { title: 'Next' }, ANDY);
      out.newGoal = took(g) ? g.body.id : '';
      out.newGoalRules = out.newGoal ? keysOf((await facts(out.newGoal)).rules) : [];
    } finally { kid.kill(); }
    return out;
  }());
  const fr = fileRun;
  if (!fr.up) test.fail('the scratch desk for the file list did not start');
  else {
    if (fr.withTest.indexOf('spirit/run/test/spirit.js') !== -1 && fr.before.indexOf('spirit/run/test/spirit.js') === -1 && !fr.noTest.some(function (p) { return /^spirit\/run\//.test(p); }))
      test.check('a file of the product tree with its own test brings that test into the item\'s list by itself; a file without one brings nothing');
    else test.fail('tests by the file list: before ' + short(fr.before) + ', with spirit.js ' + short(fr.withTest) + ', with desk.js ' + short(fr.noTest));
    if (fr.ui && fr.noShellRules.indexOf(fr.ui) === -1 && fr.shellRules.indexOf(fr.ui) !== -1) test.check('a file in spirit/run/shell/ on the item attaches the auto-attach ui rules to it; a file elsewhere attaches none');
    else test.fail('ui rules by the file list: rule ' + short(fr.ui) + ', before the shell file ' + short(fr.noShellRules) + ', after ' + short(fr.shellRules));
    if (fr.ui && fr.designRules.indexOf(fr.ui) !== -1 && fr.redTake && fr.redRules.indexOf(fr.ui) !== -1) test.check('the ui rules attached to an item ride on every take and wake: in design and on the take of red alike');
    else test.fail('ui rules riding: in design ' + short(fr.designRules) + ', red taken ' + fr.redTake + ', in red ' + short(fr.redRules));
    if (fr.newGoal && fr.desk && fr.newGoalRules.indexOf(fr.desk) !== -1 && fr.newGoalRules.indexOf(fr.ui) === -1) test.check('at goal creation the auto-attach desk rule comes, the auto-attach ui rule never does');
    else test.fail('auto-attach at goal creation: goal ' + short(fr.newGoal) + ', its rules ' + short(fr.newGoalRules) + ', ui ' + short(fr.ui) + ', desk ' + short(fr.desk));
  }
  // 8. The verifier runs product tests: a path under spirit/run/ that testModule.js names is not refused.
  const verifyCode = fs.readFileSync(path.join(RUN, 'process', 'js', 'deskVerify', 'deskVerify.js'), 'utf8');
  const leavesSrc = (verifyCode.match(/function leavesTests\(rel\) \{[\s\S]*?\n\}/) || [''])[0];
  let leaves = null;
  try { leaves = leavesSrc ? new Function('path', leavesSrc + '\nreturn leavesTests;')(path) : null; } catch (e) { leaves = null; }
  if (leaves && leaves('spirit/run/test/spirit.js') === false && leaves('spirit/test/spiritInUse.js') === false && leaves('spirit/run/../../x.js') === true && leaves('spirit/run/spirit.js') === true)
    test.check('the verifier runs product tests: a test under spirit/run/ is taken beside those under spirit/test/; a module, or a path that leaves the tree, is not');
  else test.fail('the verifier still refuses product tests under spirit/run/' + (leaves ? '' : ' (no leavesTests to ask)'));
  // 9, 10. The verifier UI: a button that runs the full product test tree; the tab opens at any time, a run going or not.
  const deskPage = code('shell/desk/desk.js');
  if (/product/i.test((deskPage.match(/function deskDrawVerifier[\s\S]*?\n\}/) || [''])[0]) && /testsFor\(/.test(verifyCode))
    test.check('the Verifier tab has a button that runs the full product test tree, and the verifier takes its list from testModule.js');
  else test.fail('no button in the Verifier tab for the full product test tree, or the verifier does not ask testModule.js for it');
  const askVerifierFn = (deskPage.match(/function deskAskVerifier\(\) \{[\s\S]*?\n\}/) || [''])[0];
  if (askVerifierFn && !/if \(!deskVerifier\) return;/.test(askVerifierFn)) test.check('the Verifier tab opens at any time: a first ask that finds the verifier busy still draws the tab');
  else test.fail('the Verifier tab is drawn only if the verifier answers the first ask, so it does not open while a run keeps it busy');

  // DESK FIXES (goal/G41.2, box v2). The slow hop is found first, by measuring (Andy: "Q: yes."): it gets its check once
  // it is known. These are the fixes the box names.
  test.subHeading('1p. desk fixes: product tests as suites, no plugin goal on the List, an item read once is kept');
  const fixRun = await (async function () {
    const os = require('os');
    const appClient = require('../run/spirit/appClient.js');
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-inuse-deskfix-'));
    const state = path.join(scratch, 'state');
    test.seedDesk(state, [{ goal: { id: 'goal/G100', title: 'Fixes' }, items: [{ id: 'goal/G100.1', title: 'One', blocks: ['goal/G100'] }] }]);
    const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
    const client = appClient.createAppClient({ rootDir: scratch });
    client.register('desk', pipe);
    const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAspiritInUseFixOwnerAAAAAAAAAAAAAAAAAAA=', label: 'andy' };
    const CW = { key: 'MCowBQYDK2VwAyEAspiritInUseFixCWAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
    const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function (e) { return { refused: e && (e.code || e.message) }; }); };
    const took = function (r) { return r && r.status === 200 && r.body && r.body.ok !== false; };
    const kid = spawn(process.execPath, [path.join(RUN, 'process', 'js', 'desk', 'desk.js'), '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    const out = {};
    try {
      let up = false;
      for (let i = 0; i < 60 && !up; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.desk && r.body.desk.ok !== false); } catch (e) { /* not yet */ } }
      if (!up) return { up: false };
      out.up = true;
      // A product test is a suite: a .js in a test/ folder of the run tree; a module, or a path that leaves the tree, is not.
      out.product = await call('item.suites.add', { id: 'goal/G100.1', path: 'spirit/run/shell/js/test/rowElement.js' }, ANDY);
      out.module = await call('item.suites.add', { id: 'goal/G100.1', path: 'spirit/run/shell/js/rowElement.js' }, ANDY);
      out.leaves = await call('item.suites.add', { id: 'goal/G100.1', path: 'spirit/run/test/../../x.js' }, ANDY);
      out.old = await call('item.suites.add', { id: 'goal/G100.1', path: 'spirit/test/spiritInUse.js' }, ANDY);
      const s = await call('item.suites.search', { id: 'goal/G100.1', text: '' }, ANDY);
      out.suites = ((s.body && s.body.items) || []).map(function (i) { return i.key; }).sort();
      // The List: what it asks with Current Goal Only pressed off. Which goals are plugin goals, read one by one.
      const all = await call('items.search', { text: '', currentGoalOnly: false, goalsOnly: true, includeClosed: false }, ANDY);
      out.listed = ((all.body && all.body.items) || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return {}; } });
      out.plugins = [];
      for (let n = 1; n <= 130; n++) {
        const g = await call('item.get', { id: 'goal/G' + n }, ANDY);
        let f = null; try { f = JSON.parse(g.body && g.body.item); } catch (e) { f = null; }
        if (f && (f.plugin || f.special)) out.plugins.push(f.id);
      }
      out.took = took;
      // AN AGENT STAYS WITH ITS OPEN RED Q (Andy, goal/G41.2): while it is open nothing of the agent's lands on the item;
      // his clear lifts it.
      await call('press', { id: 'goal/G100', what: 'end-design' }, ANDY);
      out.mayBefore = (await call('phase.may', { id: 'goal/G100.1' }, CW)).body || {};
      await call('check.add', { id: 'goal/G100.1', kind: 'Q', words: 'Which port does it use?', test: '' }, CW);
      out.mayOpenQ = (await call('phase.may', { id: 'goal/G100.1' }, CW)).body || {};
      await call('chat.add', { id: 'goal/G100.1', text: 'Q1: clear' }, ANDY);
      out.mayCleared = (await call('phase.may', { id: 'goal/G100.1' }, CW)).body || {};
    } finally { kid.kill(); }
    return out;
  }());
  const fx = fixRun;
  if (!fx.up) test.fail('the scratch desk for the fixes did not start');
  else {
    const tookIt = function (r) { return r && r.status === 200 && r.body && r.body.ok !== false; };
    if (tookIt(fx.product) && !tookIt(fx.module) && !tookIt(fx.leaves) && tookIt(fx.old) && fx.suites.indexOf('spirit/run/shell/js/test/rowElement.js') !== -1)
      test.check('item.suites.add takes a product test, a .js in a test/ folder of the run tree, beside a spirit/test/ suite; a module or a path that leaves the tree is refused');
    else test.fail('product tests as suites: product ' + short(fx.product.body) + ', module ' + short(fx.module.body) + ', leaving ' + short(fx.leaves.body) + ', suites ' + short(fx.suites));
    const shown = fx.listed.filter(function (f) { return f.plugin || fx.plugins.indexOf(f.id) !== -1; }).map(function (f) { return f.id; });
    if (fx.plugins.length && !shown.length) test.check('no plugin or special goal is on the List, Current Goal Only pressed off or not (' + fx.plugins.length + ' of them in the desk)');
    else test.fail('plugin or special goals on the List: ' + short(shown) + ' (the desk holds ' + short(fx.plugins) + ')');
    if (fx.mayBefore.allowed === true && fx.mayOpenQ.allowed === false && /red Q/.test(String(fx.mayOpenQ.why)) && fx.mayCleared.allowed === true)
      test.check('an agent stays with its open red Q: nothing of its own lands on the item until the Q is resolved, and his clear lifts it');
    else test.fail('the open red Q does not hold the agent: before ' + short(fx.mayBefore) + ', open ' + short(fx.mayOpenQ) + ', cleared ' + short(fx.mayCleared));
  }
  // AN ITEM READ ONCE IS KEPT (the box: "the desk UI does NOT properly cache box content"). The details page on a window
  // of its own, with the page's own mirror (spiritData) and the desk's translator, fed the desk's rows as the page hears
  // them: a row whose change number jumps (the desk numbers every record, published or not) is no gap and costs no ask;
  // a box row keeps the box current; an item opened again is not read again.
  const keptRun = await (async function () {
    const vm = require('vm');
    const ctx = { console: console, setTimeout: setTimeout, clearTimeout: clearTimeout, setImmediate: setImmediate, Promise: Promise, JSON: JSON };
    const byId = {};
    function el(tag) {
      let html = '';
      const e = { tagName: String(tag || 'div').toUpperCase(), value: '', checked: false, textContent: '', className: '', style: {}, dataset: {}, children: [], listeners: {}, parentNode: null, hidden: false, attrs: {}, id: '',
        appendChild: function (c) { e.children.push(c); c.parentNode = e; return c; }, insertBefore: function (c) { return e.appendChild(c); },
        removeChild: function (c) { e.children = e.children.filter(function (x) { return x !== c; }); return c; }, replaceChildren: function () { e.children = []; }, remove: function () {},
        addEventListener: function (t, fn) { (e.listeners[t] = e.listeners[t] || []).push(fn); }, removeEventListener: function () {}, dispatchEvent: function () { return true; },
        setAttribute: function (k, v) { e.attrs[k] = String(v); }, getAttribute: function (k) { return e.attrs[k] === undefined ? null : e.attrs[k]; }, removeAttribute: function (k) { delete e.attrs[k]; },
        closest: function () { return null; }, contains: function () { return false; }, querySelectorAll: function () { return []; }, querySelector: function () { return null; },
        focus: function () {}, select: function () {}, blur: function () {}, scrollIntoView: function () {} };
      e.classList = { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } };
      Object.defineProperty(e, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
      return e;
    }
    ctx.document = { getElementById: function (id) { if (!byId[id]) { byId[id] = el('div'); byId[id].id = id; } return byId[id]; }, createElement: el,
      addEventListener: function () {}, removeEventListener: function () {}, body: el('body'), head: el('head') };
    ctx.window = ctx; ctx.window.spirit = {};
    ctx.spirit = ctx.window.spirit;
    vm.createContext(ctx);
    const out = { asks: [] };
    try {
      vm.runInContext(fs.readFileSync(path.join(RUN, 'shell', 'js', 'spiritData.js'), 'utf8'), ctx, { filename: 'spiritData.js' });
      vm.runInContext(fs.readFileSync(path.join(RUN, 'shell', 'js', 'desk', 'data.js'), 'utf8'), ctx, { filename: 'desk/data.js' });
      let dd = null; let hear = null;
      ctx.spirit.shell = { activateApp: function (x) { dd = x; } };
      vm.runInContext(fs.readFileSync(path.join(RUN, 'shell', 'deskDetails', 'deskDetails.js'), 'utf8'), ctx, { filename: 'deskDetails.js' });
      const fact = function (id, title) { return { id: id, title: title, goal: 'goal/G100', status: '', with: '', buttons: [], blocking: [], blocked: [], names: {}, files: [], rules: [], phaseRules: [] }; };
      const boxes = { 'goal/G100.1': 'box of one', 'goal/G100.2': 'box of two' };
      dd.mount(el('div'), {
        escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); },
        verb: function (name, args) {
          out.asks.push(name + ' ' + String((args && args.id) || ''));
          const v = String(name).replace(/^desk\./, ''); const id = String((args && args.id) || '');
          const answer = v === 'item.get' ? { item: JSON.stringify(fact(id, id)), version: 1, change: 1 }
            : v === 'item.box' ? { box: boxes[id] || '', version: 1 } : v === 'item.checks' ? { checks: [] } : v === 'item.chat' ? { chat: [], chatMore: false }
            : v === 'item.files' ? { files: [], filesMore: false } : {};
          if (ctx.spirit.deskData && typeof ctx.spirit.deskData.took === 'function') ctx.spirit.deskData.took(v, args, answer);
          return Promise.resolve({ status: 200, body: answer });
        },
        onPublished: function (fn, server) { if (server === 'desk') hear = fn; }, onPacket: function () {}, peerPost: function () { return Promise.resolve({ ok: true }); },
        fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
      });
      // What the page hears of the desk: each row to its mirror's translator and to the open dialog alike.
      const row = function (o) { if (ctx.spirit.deskData) ctx.spirit.deskData.published(o); if (hear) hear(o); };
      const settledHere = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };
      row({ change: 10, verb: 'goal.whole', item: fact('goal/G100', 'Fixes') });
      row({ change: 11, verb: 'goal.whole', item: fact('goal/G100.1', 'One') });
      row({ change: 12, verb: 'goal.whole', item: fact('goal/G100.2', 'Two') });
      await dd.open({ id: 'goal/G100.1' }); await settledHere();
      out.firstOpen = out.asks.length;
      out.firstBox = out.asks.filter(function (a) { return a === 'desk.item.box goal/G100.1'; }).length;
      out.firstShown = Object.keys(byId).some(function (k) { return byId[k].innerHTML.indexOf('box of one') !== -1; });
      // Rows whose change numbers jump, as the desk's do: another item's chat line, a List row, a check of another item.
      row({ change: 57, table: 'chat', id: 'goal/G100.2', row: { at: '2026-10-27T01:00:00Z', by: 'andy', key: '', text: 'a line elsewhere' } });
      row({ change: 83, item: fact('goal/G100.2', 'Two, renamed') });
      row({ change: 140, table: 'checks', id: 'goal/G100.2', row: { number: 'Q1', kind: 'Q', words: 'Which?', state: 'open' } });
      await settledHere();
      out.afterJumps = out.asks.length;
      // A box row of the open item: shown, no ask.
      row({ change: 171, table: 'box', id: 'goal/G100.1', row: { text: 'the box rewritten', version: 2 } });
      await settledHere();
      out.afterBoxRow = out.asks.length;
      out.boxShown = Object.keys(byId).some(function (k) { return byId[k].innerHTML.indexOf('the box rewritten') !== -1 || byId[k].value === 'the box rewritten'; });
      // Another item, then the first again: the first is not read again, and shows its newest box.
      await dd.open({ id: 'goal/G100.2' }); await settledHere();
      const before = out.asks.length;
      await dd.open({ id: 'goal/G100.1' }); await settledHere();
      out.reopenAsks = out.asks.slice(before).filter(function (a) { return /goal\/G100\.1$/.test(a) && !/item\.get/.test(a); });
      out.reopenShown = Object.keys(byId).some(function (k) { return byId[k].innerHTML.indexOf('the box rewritten') !== -1 || byId[k].value === 'the box rewritten'; });
    } catch (e) { out.threw = e && e.stack || String(e); }
    return out;
  }());
  const kr = keptRun;
  if (kr.threw) test.fail('the details page on its own window threw: ' + short(kr.threw));
  else if (!kr.firstShown) test.fail('the world: the details page on its own window did not draw the box it read');
  else {
    if (kr.firstBox === 1 && kr.afterJumps === kr.firstOpen) test.check('rows whose change numbers jump, as the desk numbers every record, cost the details no ask (' + kr.firstOpen + ' asks to open, none after)');
    else test.fail('rows with jumping change numbers made the details ask again: ' + kr.firstOpen + ' asks to open, ' + kr.afterJumps + ' after three rows');
    if (kr.afterBoxRow === kr.afterJumps && kr.boxShown) test.check('a box row of the open item shows its new box, with no ask');
    else test.fail('a box row: asks ' + kr.afterJumps + ' -> ' + kr.afterBoxRow + ', shown ' + kr.boxShown);
    if (!kr.reopenAsks.length && kr.reopenShown) test.check('an item opened again is not read again: its kept box, the newest, is shown');
    else test.fail('opening the item again read it again: ' + short(kr.reopenAsks) + ', the newest box shown ' + kr.reopenShown);
  }
  // WHAT REACHES AN AGENT. A real desk and a real deskClient, started from a scratch copy of the run tree whose
  // environment.json names a pretend node: every peer.post goes by its `to`, the desk's stream into deskClient as the
  // desk's call, deskClient's asks into the desk as the agent's own. (A desk or deskClient started from the checkout
  // would post through the live node its environment.json names.) What deskClient hands its agent is what next answers.
  const wakeRun = await (async function () {
    const os = require('os');
    const http = require('http');
    const out = { steps: {}, streamed: [] };
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-inuse-wakes-'));
    const tree = path.join(scratch, 'run');
    fs.mkdirSync(tree);
    const tar = spawnSync('tar', ['--exclude=./relay-state', '-cf', '-', '.'], { cwd: RUN, maxBuffer: 1 << 28 });
    spawnSync('tar', ['-xf', '-'], { cwd: tree, input: tar.stdout, maxBuffer: 1 << 28 });
    fs.mkdirSync(path.join(tree, 'relay-state'), { recursive: true });
    const appClient = require(path.join(tree, 'spirit', 'appClient.js'));
    const packet = require(path.join(tree, 'spirit', 'client', 'packet.js'));
    const CWK = 'MCowBQYDK2VwAyEAspiritInUseWakeCWAAAAAAAAAAAAAAAAAAAAA=';
    const WSLK = 'MCowBQYDK2VwAyEAspiritInUseWakeWSLAAAAAAAAAAAAAAAAAAAA=';
    const DESKK = 'MCowBQYDK2VwAyEAspiritInUseWakeDeskAAAAAAAAAAAAAAAAAAA=';
    const ANDY = { owner: true, key: DESKK, label: 'andy' };
    const CW_AT_DESK = { key: CWK, label: 'claude-windows' };
    const WSL_AT_DESK = { key: WSLK, label: 'wsl-claude' };
    const OWNER = { owner: true, key: CWK, label: 'claude-windows' };
    const client = appClient.createAppClient({ rootDir: scratch });
    const win = process.platform === 'win32';
    const deskPipe = win ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'desk.sock');
    const clientPipe = win ? appClient.pipePathFor(scratch, 'deskClient', 'win32', 'process') : path.join(scratch, 'dc.sock');
    client.register('desk', deskPipe);
    client.register('deskClient', clientPipe);
    const call = function (app, verb, args, caller) { const q = {}; q[verb] = args; const b = {}; b[app] = q; return client.ask(b, caller).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; }); };
    const streams = [];
    const node = http.createServer(function (req, res) {
      let raw = '';
      req.on('data', function (c) { raw += c; });
      req.on('end', function () {
        let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
        if (b.verb === 'events.subscribe') { res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.write(': open\n\n'); streams.push(res); return; }
        const na = test.nodeApi(b); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; }
        if (b.verb === 'contact.get') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, key: b.key, person: { publicKey: b.key, blocked: true } })); return; }
        if (b.verb !== 'peer.post') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return; }
        const hash = 'H' + Date.now() + Math.random();
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, hash: hash }));
        let ask = null; try { ask = packet.decode(b.text); } catch (e) { ask = null; }
        const to = String(b.to || '');
        const caller = to === CWK ? { key: DESKK, label: 'andy' } : to === DESKK ? CW_AT_DESK : null;
        // What the desk streams to this agent, by verb.
        try { const sl = ask && ask.body && ask.body.deskClient && ask.body.deskClient.streamListener; if (to === CWK && sl) out.streamed.push(JSON.parse(sl.json).verb || ''); } catch (e) { /* not a row */ }
        if (!caller) return;
        test.peerAnswer(client, (ask && ask.body) || {}, caller).then(function (r) {
          const made = packet.encode('api', r && r.body, { re: hash });
          streams.forEach(function (s) { try { s.write('event: packet\ndata: ' + JSON.stringify({ from: to, text: made.text }) + '\n\n'); } catch (e) { /* gone */ } });
        }, function () { /* the asker waits it out */ });
      });
    });
    await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
    fs.writeFileSync(path.join(tree, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.address().port }));
    const deskState = path.join(scratch, 'desk-state'); const clientState = path.join(scratch, 'client-state');
    fs.mkdirSync(clientState, { recursive: true });
    // The goal written last is current: goal/G102, its first item held by the other agent, its second nobody's.
    test.seedDesk(deskState, [{ goal: { id: 'goal/G101', title: 'Next goal' }, items: [{ id: 'goal/G101.1', title: 'X', blocks: ['goal/G101'] }] },
      { goal: { id: 'goal/G102', title: 'Wakes' }, items: [{ id: 'goal/G102.1', title: 'Held by wsl', blocks: ['goal/G102'] }, { id: 'goal/G102.2', title: 'Grant', blocks: ['goal/G102'] }, { id: 'goal/G102.3', title: 'Designed', blocks: ['goal/G102'] }] }]);
    const env = Object.assign({}, process.env, { SPIRIT_JOB_ID: 'wake-job' });
    const kids = [];
    const up = async function (app) { for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body[app] && r.body[app].ok !== false) return true; } catch (e) { /* not yet */ } } return false; };
    try {
      kids.push(spawn(process.execPath, [path.join(tree, 'process', 'js', 'desk', 'desk.js'), '{}', '--pipe', deskPipe, '--state', deskState], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: env }));
      if (!await up('desk')) return { up: 'desk' };
      const D = function (v, a, who) { return call('desk', v, a, who || ANDY).then(function (r) { return r.body || {}; }); };
      await D('profile.set', { agent: CWK, name: 'claude-windows', nick: 'cw' });
      await D('profile.set', { agent: WSLK, name: 'wsl-claude', nick: 'wsl' });
      kids.push(spawn(process.execPath, [path.join(tree, 'process', 'js', 'deskClient', 'deskClient.js'), JSON.stringify({ historyMax: 50 }), '--pipe', clientPipe, '--state', clientState,
        '--node', JSON.stringify({ name: 'claude-windows', publicKey: CWK })], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: env }));
      if (!await up('deskClient')) return { up: 'deskClient' };
      await call('deskClient', 'setDesk', { key: DESKK }, OWNER);
      const next = async function () { const r = await call('deskClient', 'next', {}, OWNER); return (r.body && r.body.lines) || []; };
      await next();
      // The control: his line on an item nobody holds wakes the agent today.
      await D('chat.add', { id: 'goal/G102.2', text: 'control: a line on an item nobody holds' });
      out.steps.control = await next();
      // The world: goal/G102.1 is a code item, gone, its red held by the other agent; goal/G102.3 in its own design.
      await D('press', { id: 'goal/G102.1', what: 'code' });
      await D('press', { id: 'goal/G102', what: 'end-design' });
      await D('press', { id: 'goal/G102.1', what: 'go' });
      out.wslTook = await D('phase.take', { id: 'goal/G102.1', phase: 'red' }, WSL_AT_DESK);
      await D('press', { id: 'goal/G102.3', what: 'start-design' });
      await next();
      // His plain line on the item the other agent holds is not this agent's (a guard).
      await D('chat.add', { id: 'goal/G102.1', text: 'a plain line for wsl' });
      out.steps.plain = await next();
      // His answer to the Q this agent placed there, Q<n>: first, is this agent's.
      out.qAdd = await D('check.add', { id: 'goal/G102.1', kind: 'Q', words: 'Which file holds it?', test: '' }, CW_AT_DESK);
      await next();
      await D('chat.add', { id: 'goal/G102.1', text: 'Q1: the desk does.' });
      out.steps.qAnswer = await next();
      // His grant of the core files this agent put on the list.
      await D('item.files.add', { id: 'goal/G102.2', path: 'spirit/run/spirit.js' }, CW_AT_DESK);
      const ck = await D('item.checks.search', { id: 'goal/G102.2', text: '' });
      const g = ((ck.items) || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return {}; } }).filter(function (c) { return c.kind === 'G'; })[0];
      out.grantCheck = g ? g.number : '';
      await next();
      if (g) await D('check.set', { id: 'goal/G102.2', check: g.number, state: 'granted' });
      out.steps.grant = await next();
      // His End design on an item, and his Go.
      await D('press', { id: 'goal/G102.3', what: 'end-design' });
      out.steps.endDesign = await next();
      await D('press', { id: 'goal/G102.2', what: 'go' });
      out.steps.go = await next();
      // His change of the current goal.
      await D('press', { id: 'goal/G101', what: 'make-current' });
      out.steps.current = await next();
      // A file's status, from the other agent's build: to his page alone, never streamed to an agent.
      await D('item.status', { id: 'goal/G102.1', word: 'spirit/run/spirit.js changed', tone: 'code' }, WSL_AT_DESK);
      await sleep(1500);
      out.statusStreamed = out.streamed.filter(function (v) { return v === 'item.status'; }).length;
      out.streamedAny = out.streamed.length;
      out.up = true;
    } finally {
      kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
      streams.forEach(function (s) { try { s.end(); } catch (e) { /* gone */ } });
      try { node.close(); } catch (e) { /* closed */ }
    }
    return out;
  }());
  const wr = wakeRun;
  const woke = function (lines, re) { return (lines || []).some(function (l) { return re.test(String(l)); }); };
  if (wr.up !== true) test.fail('the world: the ' + wr.up + ' of the wake rig did not start');
  else if (!woke(wr.steps.control, /control: a line on an item nobody holds/)) test.fail('the world: the control, his line on an item nobody holds, did not wake the agent: ' + short(wr.steps.control));
  else {
    if (!woke(wr.steps.plain, /a plain line for wsl/)) test.check('a guard: his plain line on an item another agent holds does not wake this agent');
    else test.fail('his plain line on the other agent\'s item woke this agent');
    if (woke(wr.steps.qAnswer, /Q1: the desk does\./)) test.check('his line starting Q1: reaches the agent that placed Q1, on an item another agent holds');
    else test.fail('his answer to my Q1 did not reach me: ' + short(wr.steps.qAnswer) + ' (Q placed: ' + short(wr.qAdd) + ')');
    if (wr.grantCheck && woke(wr.steps.grant, new RegExp(wr.grantCheck + '[\\s\\S]*granted|granted[\\s\\S]*' + wr.grantCheck))) test.check('his grant wakes the agent that put the core files on the list');
    else test.fail('his grant did not wake the agent that asked for it: ' + short(wr.steps.grant) + ' (check ' + short(wr.grantCheck) + ')');
    if (woke(wr.steps.endDesign, /end-design/)) test.check('his End design on an item wakes the agent');
    else test.fail('his End design did not wake the agent: ' + short(wr.steps.endDesign));
    if (woke(wr.steps.go, /"what":"go"|press go|\bgo\b.*goal\/G102\.2|goal\/G102\.2.*\bgo\b/)) test.check('his Go wakes the agent');
    else test.fail('his Go did not wake the agent: ' + short(wr.steps.go));
    if (woke(wr.steps.current, /goal\/G101\b/)) test.check('a change of the current goal reaches the agent at once, naming the new goal');
    else test.fail('the new current goal did not reach the agent: ' + short(wr.steps.current));
  }
  if (wr.up === true) {
    if (wr.streamedAny > 0 && wr.statusStreamed === 0) test.check('a file\'s status goes to his page alone: none is streamed to an agent (' + wr.streamedAny + ' rows streamed to it, none a status)');
    else test.fail('file statuses streamed to the agent: ' + wr.statusStreamed + ' of ' + wr.streamedAny + ' rows');
  }
  // STATUS ONLY FOR FILES OF THE PRODUCT TREE (Andy, Q1: "updates only for files in the product tree."): the file watch's
  // own rule, lifted out of deskClient and asked.
  const dcCode = fs.readFileSync(path.join(RUN, 'process', 'js', 'deskClient', 'deskClient.js'), 'utf8');
  const worthySrc = (dcCode.match(/function statusWorthy\(rel\) \{[\s\S]*?\n\}/) || [''])[0];
  let worthy = null;
  try { worthy = worthySrc ? new Function(worthySrc + '\nreturn statusWorthy;')() : null; } catch (e) { worthy = null; }
  const usesWorthy = /if \(!statusWorthy\(rel\)\) return;/.test(dcCode);
  const cases = { 'spirit/run/process/js/desk/desk.js': true, 'spirit/run/shell/js/test/workBench.md': true, 'spirit/test/spiritInUse.js': false, 'README.md': false,
    'spirit/run/process/js/desk/desk.js.tmp.29056.aa92e27501c2': false, 'spirit/run/shell/seduyyhVn': false, 'spirit/run/shell/x.js~': false, 'spirit/run/shell/.x.js.swp': false };
  const wrong = worthy ? Object.keys(cases).filter(function (p) { return worthy(p) !== cases[p]; }) : ['no statusWorthy'];
  if (usesWorthy && !wrong.length) test.check('the file watch sends a status only for files of the product tree, never for an editor\'s temporary copy');
  else test.fail('the file watch\'s status rule: ' + (usesWorthy ? '' : 'not used by the watch; ') + 'wrong for ' + short(wrong));

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
    // The face from the node itself (goal/G40.10): face.html with spirit.js filled in, no kernel.js on it, and the face
    // shell served beside it.
    const facePage = await fetch('http://127.0.0.1:' + port + '/face.html').then(function (r) { return r.text().then(function (t) { return { status: r.status, text: t }; }); }, function () { return { status: 0, text: '' }; });
    const faceJs = await fetch('http://127.0.0.1:' + port + '/face/shell.js').then(function (r) { return r.status; }, function () { return 0; });
    if (facePage.status === 200 && /THE ONE INSTANCE/.test(facePage.text) && !/<!-- spirit\.js -->/.test(facePage.text) && !/kernel\.js/.test(facePage.text.replace(/\/\/[^\n]*/g, '')) && faceJs === 200)
      test.check('the node serves its own face: /face.html with spirit.js filled in and no kernel.js, and the face shell beside it');
    else test.fail('the face from the node: ' + facePage.status + ', shell ' + faceJs + (/<!-- spirit\.js -->/.test(facePage.text) ? ', spirit.js not filled in' : ''));
    const labels = (got && got.labels) || [];
    const servers2 = labels.filter(function (l) { return /server|Verifier|deskClient/i.test(l); });
    const down = labels.filter(function (l) { return /failed|exited|stopped/i.test(l); });
    if (servers2.length && !down.length) test.check('the node\'s own server processes run on the one instance: ' + short(servers2));
    else test.fail('server processes on the scratch node: ' + short(labels) + ' | ' + said.split('\n').slice(-6).join(' | '));
  } finally { node.kill(); }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the suite threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
