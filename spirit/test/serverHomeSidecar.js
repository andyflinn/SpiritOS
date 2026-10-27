'use strict';

// spirit/test/serverHomeSidecar.js
// A SERVER RUNS AT HOME BY ITS OWN SIDECAR (goal/G41.1, box v13), written FIRST, red on today's code.
//
//   Andy, Q6 and Q7: "that clash comes from unauthorized decisions from agents to move the FUCKING manifest shit to a
//   central list", "IMMEDIATELY, IN THIS ITEM.", "correct. go." The box: "a server's home switch is home: true in its own
//   sidecar, beside its .js (process/js/<name>/<name>.js.sidecar.json), the only place", "the Apps app shows a checkbox
//   for it on each server", "the node starts or stops the server when that sidecar changes", "the servers section of
//   relay-state/node.json goes, argument values included: deleted, and tested gone."
//
// THE CONTRACT:
//   H1 at boot a server runs when its sidecar's face part says home: true, and not otherwise; its manifest's runs counts
//      for nothing; an intrinsic server runs as before
//   H2 relay-state/node.json's servers section counts for nothing: neither its runs nor its argument values
//   H3 a server started by hand follows its sidecar too
//   H4 the node starts a server when its sidecar is written home: true, and stops it when written home: false
//   H5 the central list is gone: nodeSettings serves no server settings, jobs.js reads none, the G33.9 suite is gone
//   H6 the tree: no process/js manifest names runs; the servers that ran at home say so in their sidecars
//   H7 the Apps app shows a process's home switch as a checkbox and writes it into the face part; the text viewer's Start
//      reads it from there too

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/spirit/kernel.js');
const auth = require('../run/spirit/relayAuth.js');

const OWED = 'OWED by goal/G41.1: ';
const RUN = path.join(__dirname, '..', 'run');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function read(p) { try { return fs.readFileSync(path.join(RUN, p), 'utf8'); } catch (e) { return ''; } }
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } }
function eq(a, b, good, bad) { if (a === b) test.check(good); else test.fail(bad); }
const short = function (x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); };

const jobs = require('../run/spirit/jobs.js')(kernel, 65434);
// On the repo's own drive: the fs watcher measures every path against the run root, and one on another drive is not
// under it (Windows), so it would never be heard.
const scratch = fs.mkdtempSync(path.join(path.resolve(RUN, '..', '..', '..'), '.spirit-serverhome-'));

// A server that writes the values it was handed into its state folder, so the suite reads what the node gave it.
const TELLER = [
  "const fs = require('fs'); const path = require('path');",
  "const i = process.argv.indexOf('--state');",
  "try { fs.writeFileSync(path.join(process.argv[i + 1], 'values.json'), process.argv[2] || ''); } catch (e) {}",
  'setInterval(function () {}, 1000);',
].join('\n') + '\n';

// A node's run folder of its own, with three servers: 'quiet', whose manifest still says runs home but whose sidecar says
// nothing; 'teller', whose sidecar says home; 'core', intrinsic by its manifest.
let homes = 0;
function sidecar(run, name, home) {
  fs.writeFileSync(path.join(run, 'process', 'js', name, name + '.js.sidecar.json'), JSON.stringify({ face: { home: home } }));
}
function plantNode(settings) {
  const run = path.join(scratch, 'node' + (++homes), 'spirit', 'run');
  [['quiet', { runs: ['home'] }], ['teller', {}], ['core', { intrinsic: true }]].forEach(function (s) {
    const dir = path.join(run, 'process', 'js', s[0]);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, s[0] + '.json'), JSON.stringify(Object.assign({
      label: s[0], kind: 'server', operated: 'node',
      args: [{ name: 'chores', default: '' }, { name: 'pollMs', default: '60000' }],
    }, s[1])));
    fs.writeFileSync(path.join(dir, s[0] + '.js'), TELLER);
  });
  sidecar(run, 'teller', true);
  fs.mkdirSync(path.join(run, 'relay-state'), { recursive: true });
  auth.saveIdentity(run, auth.generateIdentity('serverhome' + homes));
  if (settings) fs.writeFileSync(path.join(run, 'relay-state', 'node.json'), JSON.stringify(settings));
  return run;
}
function boot(run) {
  const keep = { log: console.log, warn: console.warn, error: console.error };
  ['log', 'warn', 'error'].forEach(function (k) { console[k] = function () {}; });
  let booted = [];
  try { booted = jobs.startNodeServers(run) || []; } catch (e) { booted = []; }
  finally { console.log = keep.log; console.warn = keep.warn; console.error = keep.error; }
  return booted;
}
const typesOf = function (booted) { return booted.map(function (j) { return j.type; }).sort().join(','); };
async function valuesOf(run, name) {
  const file = path.join(run, 'relay-state', 'process', name, 'values.json');
  for (let i = 0; i < 40 && !fs.existsSync(file); i++) await sleep(100);
  return readJson(file);
}
const running = function (name) { return jobs.listJobs().filter(function (j) { return j.type === name && (j.status === 'running' || j.status === 'pending'); }); };
function stopAll() { jobs.listJobs().forEach(function (j) { if (j.kind === 'server' || j.type === 'fs-watcher') jobs.cancelJob(j.id); }); }

test.startTest('goal/G41.1: a server runs at home by its own sidecar');

(async function () {
  test.subHeading('H1. at boot, the sidecar decides');
  const n1 = plantNode(null);
  const b1 = boot(n1);
  eq(typesOf(b1), 'core,teller', 'the sidecar\'s home true starts teller, the intrinsic core starts, and quiet, home only in its manifest, does not',
    OWED + 'booted ' + typesOf(b1));
  stopAll();

  test.subHeading('H2. node.json\'s servers section counts for nothing');
  const n2 = plantNode({ servers: { quiet: { runs: ['home'] }, teller: { runs: [], chores: 'from node.json' } } });
  const b2 = boot(n2);
  eq(typesOf(b2), 'core,teller', 'neither its runs on nor its runs off moves a server', OWED + 'booted ' + typesOf(b2));
  const v2 = await valuesOf(n2, 'teller');
  eq(v2 && v2.chores, '', 'nor does its argument value: teller is handed its manifest\'s default', OWED + 'teller was handed ' + short(v2));
  stopAll();

  test.subHeading('H3. a server started by hand follows its sidecar');
  const n3 = plantNode(null);
  const byHand = function (name) {
    try { const j = jobs.startJob('node', [path.join(n3, 'process', 'js', name, name + '.js'), '{}'], { cwd: n3 }); jobs.cancelJob(j.id); return 'started'; } catch (e) { return e.refusal || e.message; }
  };
  eq(byHand('quiet') + ',' + byHand('teller'), 'process-not-included,started', 'quiet is refused, teller starts', OWED + 'by hand: ' + byHand('quiet') + ',' + byHand('teller'));
  stopAll();

  test.subHeading('H4. a sidecar written starts or stops its server at once');
  const n4 = plantNode(null);
  const watcher = jobs.startFsWatcherJob(n4);
  boot(n4);
  await sleep(1500);
  // From where the sidecars stand: quiet stopped, teller running; else the writes below would prove nothing.
  eq(running('quiet').length === 0 && running('teller').length > 0, true, 'before the writes, by their sidecars: quiet stopped, teller running',
    OWED + 'before the writes: quiet ' + running('quiet').length + ', teller ' + running('teller').length);
  sidecar(n4, 'quiet', true);
  let on = 0; for (let i = 0; i < 60 && !(on = running('quiet').length); i++) await sleep(100);
  eq(on > 0, true, 'quiet\'s sidecar written home: true starts quiet', OWED + 'quiet is not running after its sidecar said home');
  sidecar(n4, 'teller', false);
  let off = 1; for (let i = 0; i < 60 && (off = running('teller').length); i++) await sleep(100);
  eq(off, 0, 'teller\'s sidecar written home: false stops teller', OWED + 'teller still running after its sidecar said not home');
  jobs.cancelJob(watcher.id);
  stopAll();

  test.subHeading('H5. the central list is gone');
  const settings = require('../run/spirit/nodeSettings.js');
  eq(typeof settings.serverSettings, 'undefined', 'nodeSettings serves no server settings', OWED + 'nodeSettings still exports serverSettings');
  const jobsCode = read('spirit/jobs.js') + read('spirit/nodeSettings.js');
  eq(/serverSettings|\.servers\b/.test(jobsCode), false, 'jobs.js and nodeSettings.js read no servers section', OWED + 'a servers section is still read');
  eq(fs.existsSync(path.join(__dirname, 'nodeServerSettings.js')), false, 'the suite of the central list (goal/G33.9) is gone', OWED + 'spirit/test/nodeServerSettings.js is still there');

  test.subHeading('H6. the tree: each server says it in its own sidecar');
  const base = path.join(RUN, 'process', 'js');
  const named = fs.readdirSync(base).filter(function (n) { const m = readJson(path.join(base, n, n + '.json')); return m && Object.prototype.hasOwnProperty.call(m, 'runs'); });
  eq(named.join(','), '', 'no process/js manifest names runs', OWED + 'manifests naming runs: ' + named.join(', '));
  const HOME = ['agent', 'backup', 'chatClerver', 'desk', 'deskVerify', 'fileServer'];
  const said = HOME.filter(function (n) { const s = readJson(path.join(base, n, n + '.js.sidecar.json')); return s && s.face && s.face.home === true; });
  eq(said.join(','), HOME.join(','), 'the servers that ran at home say home: true in their sidecars', OWED + 'saying home: ' + said.join(', '));

  test.subHeading('H7. the Apps app writes it, the text viewer reads it');
  const apps = read('shell/apps/apps.js');
  // A shell app still says where it runs in its manifest (goal/G30.20); only a server's switch moved.
  eq(/data-face="home"/.test(apps) && /home\s*[:=]\s*!!v\('home'\)/.test(apps) && /face\.home === true/.test(apps), true,
    'the Apps app shows a process\'s home switch as a checkbox, reads it from the face part and writes it there', OWED + 'apps.js has no home checkbox in the face part');
  const viewer = read('shell/js/textViewer.js');
  eq(!/manifest\.runs/.test(viewer) && /\.home === true/.test(viewer), true, 'the text viewer\'s Start reads the sidecar\'s home, not the manifest\'s runs',
    OWED + 'textViewer.js still reads manifest.runs');
}()).then(function () {
  stopAll();
  test.reportSuccessFailureCount();
  setTimeout(function () { try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ } process.exit(0); }, 500);
}, function (e) { test.fail('the suite threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
