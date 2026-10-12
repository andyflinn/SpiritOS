'use strict';

// spirit/test/faceNoIdentity.js
// goal/G19.10: NO identity.json IN appFaceApp; THE NODE'S FACTS COME WITH THE SPIRIT OBJECT.
// Written first, red on today's code.
//
//   Andy, 2026-10-12: "i assume your talking about an appServer (be precise!). The appServer
//   have a definite need/use for all 3: the node/puppets key, the owners public key, and the
//   nodes port: if they are not allowed to read the files, they should have that stuff passted
//   with the spirit object that comes with the appServers passed interface."
//   And: "there shall be no test helpers inside node." / "error messages and rule related
//   cleanup belong to every update/new-code."
//
// WHAT IS ASSERTED
//   T1  jobs.startNodeServers hands every server --node {name, publicKey, ownerKey}: the owner's
//       public key when another key owns the node, '' when it owns itself or has none, and for
//       a nameless node too. Nothing private in any argument.
//   T2  appServer puts the three facts on the spirit object it hands a server, beside
//       SPIRIT_PORT: spirit.core.node.const.NODE_NAME, NODE_KEY, OWNER_KEY; '' without --node.
//   T3  appFaceApp opens neither identity.json nor owner.json: no loadIdentity, no loadOwner,
//       no relayAuth; its owner is OWNER_KEY. (Its behaviour with a decoy owner.json is
//       appFaceProcess.js T3.)
//   T4  faceRoute.js holds no test helper: answerRoute, routeIsSigned and routeSignatureHolds
//       are not exported, and the first two are not in the file.
//   T5  the cleanup that rides along: appFaceApp's app-not-running carries its sentence, and
//       jobs.js has no options.module (only appClient.startAll ever passed it).
// rule/11: through testSupport only; its own folders; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth.js');

const RUN = path.join(__dirname, '..', 'run');
const OWED = 'OWED by goal/G19.10: ';
const APPSERVER = path.join(RUN, 'js', 'appServer.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function src(rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ''; } }
// Code without its comments, so a comment naming a file is not a read of it.
function code(rel) { return src(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1'); }

test.startTest('goal/G19.10: appFaceApp opens no identity.json; the node hands its facts over');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-facenoid-'));
const kids = [];

// A node root with one probe server that writes its own argv; `owner`: a key for owner.json, or none.
function probeNode(label, idName, owner) {
  const run = path.join(scratch, label, 'spirit', 'run');
  fs.mkdirSync(path.join(run, 'process', 'js', 'probe'), { recursive: true });
  fs.mkdirSync(path.join(run, 'relay-state'), { recursive: true });
  const id = auth.generateIdentity(idName);
  auth.saveIdentity(run, id);
  if (owner === 'self') auth.writeOwner(run, id.publicKey);
  else if (owner) auth.writeOwner(run, owner);
  const out = path.join(scratch, label + '-argv.json');
  fs.writeFileSync(path.join(run, 'process', 'js', 'probe', 'probe.json'), JSON.stringify({ kind: 'server', operated: 'node', args: [] }));
  fs.writeFileSync(path.join(run, 'process', 'js', 'probe', 'probe.js'),
    'require("fs").writeFileSync(' + JSON.stringify(out) + ', JSON.stringify(process.argv.slice(2)));\n');
  require('../run/js/includeList.js').add(run, 'process/js/probe');
  return { run: run, id: id, out: out };
}
async function startedWith(jobs, p) {
  const started = jobs.startNodeServers(p.run) || [];
  let argv = null;
  for (let i = 0; i < 60 && !argv; i++) { await sleep(100); try { argv = JSON.parse(fs.readFileSync(p.out, 'utf8')); } catch (e) { argv = null; } }
  started.forEach(function (j) { try { jobs.cancelJob(j.id); } catch (e) { /* gone */ } });
  const at = argv ? argv.indexOf('--node') : -1;
  let node = null;
  try { node = at !== -1 ? JSON.parse(argv[at + 1]) : null; } catch (e) { node = null; }
  return { argv: argv, node: node, leaked: !!argv && JSON.stringify(argv).indexOf(p.id.privateKey) !== -1 };
}

// A script that loads appServer as a server does and writes what the spirit object holds.
function factsOf(args) {
  const out = path.join(scratch, 'facts-' + kids.length + '.json');
  const script = path.join(scratch, 'facts-' + kids.length + '.js');
  fs.writeFileSync(script, 'const c = require(' + JSON.stringify(APPSERVER) + ').spirit.core.node.const;\n' +
    'require("fs").writeFileSync(' + JSON.stringify(out) + ', JSON.stringify({ NODE_NAME: c.NODE_NAME, NODE_KEY: c.NODE_KEY, OWNER_KEY: c.OWNER_KEY, SPIRIT_PORT: c.SPIRIT_PORT }));\n');
  const kid = spawn(process.execPath, [script, '{}'].concat(args), { cwd: RUN, stdio: 'ignore' });
  kids.push(kid);
  return new Promise(function (resolve) {
    kid.on('exit', function () { try { resolve(JSON.parse(fs.readFileSync(out, 'utf8'))); } catch (e) { resolve(null); } });
  });
}

(async function () {
  const OWNER = auth.generateIdentity('owner').publicKey;

  test.subHeading('T1: the runner hands every server --node {name, publicKey, ownerKey}, nothing private');
  const jobs = require('../run/js/jobs.js')(require('../run/js/kernel.js'), 65432);
  const owned = await startedWith(jobs, probeNode('owned', 'puppet', OWNER));
  if (owned.node && owned.node.name === 'puppet' && owned.node.ownerKey === OWNER && !owned.leaked
      && Object.keys(owned.node).sort().join() === 'name,ownerKey,publicKey') {
    test.check('a node another key owns: --node names it, its public key, and the owner\'s public key, and nothing else');
  } else test.fail(OWED + 'an owned node handed ' + JSON.stringify(owned.node) + (owned.leaked ? ', AND ITS PRIVATE KEY' : ''));
  const self = await startedWith(jobs, probeNode('self', 'owner-node', 'self'));
  const none = await startedWith(jobs, probeNode('none', 'free', null));
  if (self.node && self.node.ownerKey === '' && none.node && none.node.ownerKey === '' && !self.leaked && !none.leaked) {
    test.check('a node owning itself, and a node nobody owns, hand ownerKey \'\': there is no owner to ask');
  } else test.fail(OWED + 'self-owned handed ' + JSON.stringify(self.node) + ', unowned ' + JSON.stringify(none.node));
  const bare = await startedWith(jobs, probeNode('bare', '', OWNER));
  if (bare.node && bare.node.ownerKey === OWNER && !bare.leaked) {
    test.check('a node not named yet hands --node too, its owner included');
  } else test.fail(OWED + 'a nameless owned node handed ' + JSON.stringify(bare.node));

  test.subHeading('T2: appServer puts the facts on the spirit object, beside SPIRIT_PORT');
  const handed = await factsOf(['--node', JSON.stringify({ name: 'puppet', publicKey: 'NODEKEY', ownerKey: OWNER })]);
  if (handed && handed.NODE_NAME === 'puppet' && handed.NODE_KEY === 'NODEKEY' && handed.OWNER_KEY === OWNER && typeof handed.SPIRIT_PORT === 'number') {
    test.check('spirit.core.node.const holds NODE_NAME, NODE_KEY and OWNER_KEY from --node, beside SPIRIT_PORT');
  } else test.fail(OWED + 'with --node the spirit object holds ' + JSON.stringify(handed));
  const absent = await factsOf([]);
  if (absent && absent.NODE_NAME === '' && absent.NODE_KEY === '' && absent.OWNER_KEY === '') {
    test.check('without --node the three are \'\'');
  } else test.fail(OWED + 'without --node the spirit object holds ' + JSON.stringify(absent));

  test.subHeading('T3: appFaceApp opens neither identity.json nor owner.json');
  const face = code('process/js/appFaceApp/appFaceApp.js');
  const reads = ['loadIdentity', 'loadOwner', 'relayAuth', 'identity.json', 'owner.json'].filter(function (n) { return face.indexOf(n) !== -1; });
  if (face && !reads.length && /OWNER_KEY/.test(face)) {
    test.check('appFaceApp\'s code names no loadIdentity, loadOwner, relayAuth, identity.json or owner.json, and reads OWNER_KEY');
  } else test.fail(OWED + 'appFaceApp\'s code still holds ' + reads.join(', ') + (/OWNER_KEY/.test(face) ? '' : ', and never reads OWNER_KEY'));

  test.subHeading('T4: faceRoute.js holds no test helper');
  const fr = require('../run/process/js/appFaceApp/faceRoute.js');
  const frCode = code('process/js/appFaceApp/faceRoute.js');
  const exported = ['answerRoute', 'routeIsSigned', 'routeSignatureHolds'].filter(function (n) { return n in fr; });
  const inFile = ['answerRoute', 'routeIsSigned'].filter(function (n) { return new RegExp('\\b' + n + '\\b').test(frCode); });
  if (!exported.length && !inFile.length && typeof fr.createRouteCache === 'function' && typeof fr.nameOf === 'function') {
    test.check('faceRoute exports nameOf and createRouteCache only of its functions; answerRoute and routeIsSigned live in the test');
  } else test.fail(OWED + 'faceRoute still exports ' + exported.join(', ') + '; still holds ' + inFile.join(', '));

  test.subHeading('T5: the cleanup that rides along');
  if (/code: 'app-not-running', error: /.test(face)) test.check('appFaceApp\'s app-not-running answer carries its sentence');
  else test.fail(OWED + 'appFaceApp answers app-not-running with no error');
  const jobsCode = code('js/jobs.js');
  if (jobsCode && !/options\.module/.test(jobsCode)) test.check('jobs.js has no options.module: no caller passes it since startAll left');
  else test.fail(OWED + 'jobs.js still reads options.module');
})().catch(function (e) { test.fail('the run broke: ' + ((e && e.stack) || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
