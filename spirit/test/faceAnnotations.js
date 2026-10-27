'use strict';

// spirit/test/faceAnnotations.js
// THE FACE PART IS THE ONE PART, AND IT IS STREAMED (goal/G41.1, box v15), written FIRST, red on today's code.
//
//   Andy, Q10 and Q11: "the loopback door MUST NOT be compatible with the old shell.", "backward compatibility before
//   alpha is a productivity killer."; and "it's the buttons that have to listen, too". The box: "the node's door writes a
//   sidecar's face part for every caller, as the face link does; the old shell's client part is dropped with it", "the
//   node streams an app's face part whenever its sidecar changes, and every app installer button listens to it".
//
// THE CONTRACT:
//   A1 the client part is gone: fileSystem has no annotateFile, and every writer (the door, the kernel's process
//      surface, introSpector) writes the face part; the file viewer shows the face part
//   A2 an app's sidecar written, the fs watcher publishes its face part as an app-face job { path, face }, for a shell
//      app and an appServer alike; any other sidecar is no app-face
//   A3 faceHome sends app-face jobs to the face

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/spirit/kernel.js');

const OWED = 'OWED by goal/G41.1: ';
const RUN = path.join(__dirname, '..', 'run');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function read(p) { try { return fs.readFileSync(path.join(RUN, p), 'utf8'); } catch (e) { return ''; } }
function eq(a, b, good, bad) { if (a === b) test.check(good); else test.fail(bad); }
const short = function (x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); };

const jobs = require('../run/spirit/jobs.js')(kernel, 65435);
// On the repo's own drive, so the fs watcher, which measures paths against the run root, hears it (Windows).
const scratch = fs.mkdtempSync(path.join(path.resolve(RUN, '..', '..', '..'), '.spirit-faceannotations-'));

test.startTest('goal/G41.1: the face part is the one part, and it is streamed');

(async function () {
  test.subHeading('A1. the client part is gone');
  const fsys = require('../run/spirit/fileSystem.js');
  eq(typeof fsys.annotateFile, 'undefined', 'fileSystem has no annotateFile, the client part\'s writer', OWED + 'fileSystem still exports annotateFile');
  const server = read('spirit/server.js');
  const door = (/function handleFsAnnotate\(req, res\) \{[\s\S]*?fileSystem\.(\w+)\(/.exec(server) || [])[1] || '';
  eq(door, 'annotateFace', 'the door\'s fs.annotate writes the face part', OWED + 'the door writes with ' + (door || 'nothing found'));
  // introSpector's verb keeps its name (a verb renamed needs review and his yes); what it writes is the face part.
  eq(/'annotateFile'|fileSystem\.annotateFile/.test(read('spirit/kernel.js') + read('spirit/introSpector.js')), false, 'neither the kernel nor introSpector writes through annotateFile', OWED + 'annotateFile is still called');
  const viewer = read('shell/js/fileViewer.js');
  eq(/a && a\.client/.test(viewer), false, 'the file viewer reads no client part', OWED + 'fileViewer.js still reads the client part');

  test.subHeading('A2. an app\'s sidecar written, its face part is published');
  const run = path.join(scratch, 'spirit', 'run');
  [['shell', 'notes'], ['process/js', 'helper']].forEach(function (a) {
    const dir = path.join(run, a[0], a[1]);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, a[1] + '.js'), '// an app\n');
  });
  fs.writeFileSync(path.join(run, 'shell', 'notes', 'readme.txt'), 'not an app\n');
  const watcher = jobs.startFsWatcherJob(run);
  await sleep(1500);
  const faces = function () { return jobs.listJobs().filter(function (j) { return j.type === 'app-face'; }); };
  const lastFace = async function (p) {
    for (let i = 0; i < 50; i++) { const j = faces()[0]; if (j && j.data && j.data.path === p) return j.data; await sleep(100); }
    const j = faces()[0]; return j && j.data;
  };
  fs.writeFileSync(path.join(run, 'shell', 'notes', 'notes.js.sidecar.json'), JSON.stringify({ face: { app: true, name: 'Notes' } }));
  const d1 = await lastFace('shell/notes/notes.js');
  eq(!!d1 && d1.path === 'shell/notes/notes.js' && d1.face && d1.face.app === true && d1.face.name === 'Notes', true,
    'a shell app\'s sidecar written: an app-face job with its script\'s path and its face part', OWED + 'app-face: ' + short(d1));
  fs.writeFileSync(path.join(run, 'process', 'js', 'helper', 'helper.js.sidecar.json'), JSON.stringify({ face: { home: false } }));
  const d2 = await lastFace('process/js/helper/helper.js');
  eq(!!d2 && d2.path === 'process/js/helper/helper.js' && d2.face && d2.face.home === false, true, 'an appServer\'s too', OWED + 'app-face: ' + short(d2));
  fs.writeFileSync(path.join(run, 'shell', 'notes', 'readme.txt.sidecar.json'), JSON.stringify({ face: { app: true } }));
  await sleep(1500);
  const d3 = (faces()[0] || {}).data;
  eq(!d3 || d3.path !== 'shell/notes/readme.txt', true, 'a sidecar of a file that is no app script is no app-face', OWED + 'app-face for readme: ' + short(d3));
  jobs.cancelJob(watcher.id);

  test.subHeading('A2b. the node\'s own sidecar, at the mirror in its state, heard and merged');
  fs.mkdirSync(path.join(run, 'relay-state', 'shell', 'notes'), { recursive: true });
  fs.writeFileSync(path.join(run, 'relay-state', 'shell', 'notes', 'notes.js.sidecar.json'), JSON.stringify({ face: { app: false } }));
  const watcher2 = jobs.startFsWatcherJob(run);
  await sleep(1500);
  fs.writeFileSync(path.join(run, 'relay-state', 'shell', 'notes', 'notes.js.sidecar.json'), JSON.stringify({ face: { app: false, icon: '🗒' } }));
  let d4 = null;
  for (let i = 0; i < 50; i++) { const j = faces()[0]; if (j && j.data && j.data.face && j.data.face.icon) { d4 = j.data; break; } await sleep(100); }
  eq(!!d4 && d4.path === 'shell/notes/notes.js' && d4.face.app === false && d4.face.name === 'Notes' && d4.face.icon === '🗒', true,
    'the node\'s own sidecar written: its app\'s face part streamed, the node\'s fields over the tracked ones', OWED + 'app-face: ' + short(d4));
  jobs.cancelJob(watcher2.id);

  test.subHeading('A4. a write lands in the node\'s state; a read is the tracked part with the node\'s over it');
  const tag = 'zzMirror' + process.pid;
  const made = [path.join(RUN, 'shell', tag), path.join(RUN, 'process', 'js', tag), path.join(RUN, 'relay-state', 'shell', tag), path.join(RUN, 'relay-state', 'process', tag)];
  try {
    [['shell/' + tag, made[0]], ['process/js/' + tag, made[1]]].forEach(function (a) {
      fs.mkdirSync(a[1], { recursive: true });
      fs.writeFileSync(path.join(a[1], tag + '.js'), '// a throwaway app\n');
      fs.writeFileSync(path.join(a[1], tag + '.js.sidecar.json'), JSON.stringify({ face: { intrinsic: true, app: true, name: 'Shipped' } }));
    });
    const shellApp = 'shell/' + tag + '/' + tag + '.js';
    const tracked = fs.readFileSync(path.join(made[0], tag + '.js.sidecar.json'), 'utf8');
    const w = fsys.annotateFace(shellApp, { app: false, name: 'Mine', intrinsic: false });
    eq(!!w && w.ok === true && fs.readFileSync(path.join(made[0], tag + '.js.sidecar.json'), 'utf8') === tracked, true, 'a write leaves the tracked sidecar beside the code as it is',
      OWED + 'the write ' + short(w) + ', the tracked sidecar ' + (fs.readFileSync(path.join(made[0], tag + '.js.sidecar.json'), 'utf8') === tracked ? 'kept' : 'changed'));
    let mine = null; try { mine = JSON.parse(fs.readFileSync(path.join(made[2], tag + '.js.sidecar.json'), 'utf8')); } catch (e) { mine = null; }
    eq(!!mine && mine.face && mine.face.app === false && mine.face.name === 'Mine' && !('intrinsic' in mine.face), true,
      'it lands at the mirror in the node\'s state, relay-state/shell/<app>/<app>.js.sidecar.json, without intrinsic', OWED + 'the node\'s sidecar: ' + short(mine));
    const read1 = (fsys.getAnnotations(shellApp) || {}).face || {};
    eq(read1.app === false && read1.name === 'Mine' && read1.intrinsic === true, true, 'a read is the tracked face part with the node\'s over it, intrinsic the tracked one\'s', OWED + 'read ' + short(read1));
    const proc = 'process/js/' + tag + '/' + tag + '.js';
    fsys.annotateFace(proc, { home: false });
    let pmine = null; try { pmine = JSON.parse(fs.readFileSync(path.join(made[3], tag + '.js.sidecar.json'), 'utf8')); } catch (e) { pmine = null; }
    eq(!!pmine && pmine.face && pmine.face.home === false, true, 'a server\'s lands in its own state folder, relay-state/process/<name>/<name>.js.sidecar.json', OWED + 'the server\'s: ' + short(pmine));
  } finally { made.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* gone */ } }); }

  test.subHeading('A3. faceHome sends app-face jobs to the face');
  const fh = read('spirit/faceHome.js');
  const prio = (/function priorityOf\(job\) \{([\s\S]*?)\n  \}/.exec(fh) || [])[1] || '';
  eq(/'app-face'/.test(prio), true, 'faceHome\'s priorities send app-face jobs to the face', OWED + 'priorityOf names no app-face');
}()).then(function () {
  jobs.listJobs().forEach(function (j) { if (j.type === 'fs-watcher') jobs.cancelJob(j.id); });
  test.reportSuccessFailureCount();
  setTimeout(function () { try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ } process.exit(0); }, 500);
}, function (e) { test.fail('the suite threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
