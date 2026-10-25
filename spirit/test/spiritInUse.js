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
  const still = GONE.filter(function (f) { return fs.existsSync(path.join(RUN, f)); });
  if (!still.length) test.check('removeAgent, localReview and localResearch are gone');
  else test.fail('still there: ' + short(still));

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
    const labels = (got && got.labels) || [];
    const servers2 = labels.filter(function (l) { return /server|Verifier|deskClient/i.test(l); });
    const down = labels.filter(function (l) { return /failed|exited|stopped/i.test(l); });
    if (servers2.length && !down.length) test.check('the node\'s own server processes run on the one instance: ' + short(servers2));
    else test.fail('server processes on the scratch node: ' + short(labels) + ' | ' + said.split('\n').slice(-6).join(' | '));
  } finally { node.kill(); }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the suite threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
