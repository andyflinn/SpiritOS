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
    "var items = [{ key: 'https://spirit.example', label: JSON.stringify({ relayKey: 'KEY-A' }) }, { key: 'https://noderoutes.example', label: JSON.stringify({ relayKey: 'KEY-B' }) }];",
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

  // THE RELAYS ON THE STREAM (box v21): one permanent job, relay-rows, the relays this node lists with seat, email and
  // face, published only when they change; the forms, Info and the relay details redraw from it.
  test.subHeading('1l. the relays on the stream: relay-rows, published when they change, heard by every screen');
  const rowsHome = setupRelayFakes('spiritInUseRows').andy;
  fs.rmSync(path.join(rowsHome, 'relay-state'), { recursive: true, force: true });
  const rowsRun = spawnSync(process.execPath, ['-e', [
    "var J = null; try { J = require('./spirit/relayRowsJob'); } catch (e) { process.stdout.write('missing'); process.exit(0); }",
    "var k = require('./spirit/relayKeys'); var b = require('./spirit/ownerBadge'); var url = 'https://rows.example';",
    "var key = 'MCowBQYDK2VwAyEA+4mt2XtbJHPmiyCri6HRaA/PyH4EPGYE/ez+YpE72Ls='; k.accept(process.cwd(), url, key); b.addRelay(process.cwd(), url, 'rows', key);",
    "var sent = []; var jobs = { createJob: function (kind, type, data) { return { id: 'j1', type: type, data: data }; }, updateJob: function (id, p) { sent.push(p.data); } };",
    "var r = J.create(process.cwd(), jobs);",
    "var same = r.refresh('nothing');",
    "k.seat(process.cwd(), url, 'me'); k.keepEmail(process.cwd(), url, 'me@example.org', true);",
    "var changed = r.refresh('seated');",
    "var row = (sent[0] && sent[0].rows || []).filter(function (x) { return x.url === url; })[0] || null;",
    "process.stdout.write(JSON.stringify({ type: r.job.type, same: same, changed: changed, row: row }));"].join('\n')], { cwd: rowsHome, encoding: 'utf8' });
  let rows = null;
  try { rows = JSON.parse(rowsRun.stdout); } catch (e) { rows = { said: rowsRun.stdout + rowsRun.stderr }; }
  if (rows && rows.type === 'relay-rows' && rows.same === false && rows.changed === true && rows.row && rows.row.claimed === true && rows.row.emailVerified === true && rows.row.email === 'me@example.org')
    test.check('relay-rows, driven: published only when a row changed; a seat and a verified email show on the row');
  else test.fail('relay-rows, driven: ' + short(rows));
  const serverCode = code('spirit/server.js');
  if (/relayRowsJob/.test(serverCode) && /relayRowsJob\.refresh\(/.test(serverCode) && /kind === 'status'[\s\S]{0,200}relayRowsJob\.refresh|relayRowsJob\.refresh[\s\S]{0,200}kind === 'status'/.test(serverCode)) test.check('the node refreshes relay-rows after a relay verb and on a relay\'s report');
  else test.fail('the node does not refresh relay-rows after relay verbs and reports');
  // On a relay face too (Andy: "onBoards face https://master.noderoutes.net/ did not update its relay dropdowns in the
  // info page"): the face stream carries relay-rows, as it changes and once as a face opens.
  const faceHomeCode = code('spirit/faceHome.js');
  const priorityFn = (faceHomeCode.match(/function priorityOf\(job\) \{[\s\S]*?\n  \}/) || [''])[0];
  const openFn = (faceHomeCode.match(/function open\(url, k\) \{[\s\S]*?\n  \}/) || [''])[0];
  if (/relay-rows/.test(priorityFn) && /relay-rows/.test(openFn)) test.check('a relay face hears relay-rows: on the face stream as it changes, and once when the face opens');
  else test.fail('a relay face never hears relay-rows' + (/relay-rows/.test(priorityFn) ? ' when it opens' : ''));
  // LEAVING A RELAY (Andy: "add the leave verb to node. and publish the \"leaving\"", go): relay.leave {key} posts the
  // removal of this node's own key to that relay and, on its yes, clears the seat, email and face on that relay's row;
  // the row stays for a later join. A relay verb, so relay-rows publishes it. Never for a relay this node owns.
  const relayApiNow = code('spirit/relay/api.js');
  if (/leave\s*:\s*\{\s*key\s*:/.test(relayApiNow)) test.check('the relay family declares leave {key}');
  else test.fail('the relay family has no leave verb');
  const leaveRun = spawnSync(process.execPath, ['-e', [
    "var k = require('./spirit/relayKeys'); var b = require('./spirit/ownerBadge'); var url = 'https://leave.example';",
    "var key = 'MCowBQYDK2VwAyEA+4mt2XtbJHPmiyCri6HRaA/PyH4EPGYE/ez+YpE72Ls='; k.accept(process.cwd(), url, key); b.addRelay(process.cwd(), url, 'leave', key);",
    "k.seat(process.cwd(), url, 'me'); k.keepEmail(process.cwd(), url, 'me@example.org', true); k.keepFace(process.cwd(), url, 'me', 'me@example.org', 'reply');",
    "var did = typeof k.leaveSeat === 'function' ? k.leaveSeat(process.cwd(), url) : 'missing';",
    "process.stdout.write(JSON.stringify({ did: did, seated: k.seatedUrls(process.cwd()).indexOf(url) !== -1, mail: k.emailOf(process.cwd(), url), face: k.faceOf(process.cwd(), url), listed: b.loadRelays(process.cwd()).some(function (r) { return r.url === url; }) }));"].join('\n')], { cwd: rowsHome, encoding: 'utf8' });
  let left = null;
  try { left = JSON.parse(leaveRun.stdout); } catch (e) { left = { said: leaveRun.stdout + leaveRun.stderr }; }
  if (left && left.did === true && left.seated === false && left.mail && left.mail.email === '' && !left.mail.verified && left.face === null && left.listed === true)
    test.check('leaving, driven: the seat, the email and the face on that relay\'s row are cleared; the relay stays listed');
  else test.fail('leaving, driven: ' + short(left));
  const hubCode = code('spirit/hub.js');
  const leaveFn = (hubCode.match(/function relayLeave\(body, deps\) \{[\s\S]*?\n  \}/) || [''])[0];
  if (/removePeer/.test(leaveFn) && /leaveSeat\(/.test(leaveFn) && /owned|reports\[/.test(leaveFn) && /'leave'\s*:/.test(code('spirit/server.js')))
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
  const hearers = ['shell/js/contacts/listElement.js', 'shell/js/joinForm.js', 'shell/js/faceForm.js', 'shell/info/info.js', 'shell/js/natterDetails/natterDetails.js'].filter(function (f) { return !/'relay-rows'/.test(code(f)); });
  if (!hearers.length) test.check('the two forms, Info and the relay details hear relay-rows and redraw');
  else test.fail('not hearing relay-rows: ' + short(hearers));

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
  // seat"). The relay seats him at boot (goal/G30.7); his node notes that seat, under what the relay calls him, when the
  // relay reports to its owner, so Info shows the name and a rename's answer is written.
  test.subHeading('1h. the owner\'s seat on his node: an owned relay\'s report notes the seat under the relay\'s name for him');
  const ownerHome = setupRelayFakes('spiritInUseOwner').andy;
  // A fresh home each run: the scratch copy keeps its relay-state between runs.
  fs.rmSync(path.join(ownerHome, 'relay-state'), { recursive: true, force: true });
  const seatRun = spawnSync(process.execPath, ['-e', [
    "const k = require('./spirit/relayKeys'); const b = require('./spirit/ownerBadge'); const url = 'https://owned.example';",
    "b.addRelay(process.cwd(), url, 'owned', ''); k.accept(process.cwd(), url, 'MCowBQYDK2VwAyEA+4mt2XtbJHPmiyCri6HRaA/PyH4EPGYE/ez+YpE72Ls=');",
    "const before = k.seatLabel(process.cwd(), url);",
    "const noted = typeof k.ownerSeat === 'function' ? k.ownerSeat(process.cwd(), url, 'Andy Flinn Music') : 'missing';",
    "const again = typeof k.ownerSeat === 'function' ? k.ownerSeat(process.cwd(), url, 'Andy Flinn Music') : 'missing';",
    "process.stdout.write(JSON.stringify({ before: before, noted: noted, again: again, label: k.seatLabel(process.cwd(), url), seated: k.seatedUrls(process.cwd()).indexOf(url) !== -1 }));"].join('\n')], { cwd: ownerHome, encoding: 'utf8' });
  let seat = null;
  try { seat = JSON.parse(seatRun.stdout); } catch (e) { seat = { said: seatRun.stdout + seatRun.stderr }; }
  if (seat && seat.before === '' && seat.noted === true && seat.again === false && seat.label === 'Andy Flinn Music' && seat.seated)
    test.check('an owned relay\'s seat, driven: noted once under the relay\'s name for its owner, seated, and not written again while unchanged');
  else test.fail('the owner\'s seat, driven: ' + short(seat));
  const presenceCode = code('spirit/presenceNode.js');
  if (/relay-status[\s\S]{0,600}ownerSeat\(/.test(presenceCode)) test.check('the node notes the owner\'s seat when a relay it owns reports to it');
  else test.fail('the node does not note the owner\'s seat on a relay\'s report');

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
