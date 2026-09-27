'use strict';

// spirit/test/serverJobs.js
// THE SERVER PROCESS TYPE, HELD TO ANDY'S RULINGS — public-app-server/G19,
// step one (built 1e3703a by claude-windows; its own suite is
// processServer.js). This one holds what that suite does not:
//
//   (a) CANCELLED MEANS GONE. The jobs app may cancel a server job (it
//       offered Cancel only for kind 'process' until 1e3703a), and a
//       cancelled server is never started again, however its child exits.
//   (b) THE MONITOR LINE. Andy, 2026-09-28: "server apps must send incoming
//       requests to the monitor", "...their replies to the monitor", "the
//       payload need to be only in the monitor in debug mode", "and the error
//       text should be in the monitor if the reply is an error", and debug
//       "prolly shouldn't be node-wide". So: one line per exchange and never
//       the body; an error reply adds its text; SPIRIT_DEBUG=1, set for one
//       server alone, adds the payload.

const fs = require('fs');
const os = require('os');
const path = require('path');
const EventEmitter = require('events');
const test = require('./testSupport.js');
const relayRequest = require('../run/js/relayRequest.js');
const appServers = require('../run/js/appServers.js');

const RUN = path.join(__dirname, '..', 'run');
const KERNEL = path.join(RUN, 'js', 'kernel.js');

test.startTest('Server jobs: cancelled means gone, and the monitor line keeps bodies out');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// A child that behaves like a spawned server: it exits when killed or asked
// to shut down, and can be made to die on its own.
function fakeSpawn(calls) {
  return function () {
    const child = new EventEmitter();
    child.pid = 40000 + calls.length;
    child.stdout = new EventEmitter(); child.stdout.setEncoding = function () {};
    child.stderr = new EventEmitter(); child.stderr.setEncoding = function () {};
    child.connected = true;
    child.send = function () { setTimeout(function () { child.emit('exit', 0); }, 5); return true; };
    child.kill = function () { setTimeout(function () { child.emit('exit', null); }, 5); return true; };
    child.disconnect = function () { child.connected = false; };
    calls.push(child);
    return child;
  };
}

async function cancelledMeansGone() {
  test.subHeading('A cancelled server job is never started again');
  const spirit = require(KERNEL);
  const jobs = require('../run/js/jobs.js')(spirit, 0);
  const calls = [];
  const job = jobs.startServerJob(process.execPath, ['x.js'], { cwd: os.tmpdir(), type: 'app-server:probe', spawn: fakeSpawn(calls) });

  // A crash is restarted: that is the job's promise.
  calls[0].emit('exit', 1);
  await sleep(1300);
  const restarted = calls.length === 2;

  jobs.cancelJob(job.id);
  await sleep(100);
  // Whatever the child does after a cancel, nothing starts it again.
  if (calls[1]) calls[1].emit('exit', 1);
  // LONGER THAN THE NEXT RESTART WAIT. It doubles after each crash (1 s, then
  // 2 s: jobs.js RESTART_MIN_MS), and a wait shorter than that would pass
  // whether or not the cancel held; that is how this check first passed
  // with the stop removed.
  await sleep(2600);
  const status = (jobs.getJob ? jobs.getJob(job.id) : job).status;
  if (restarted && calls.length === 2 && /^(cancelled|stopped)$/.test(status)) {
    test.check('a crashed server is started again, and once cancelled it stays down (' + status + '), however its child exits');
  } else {
    test.fail('restarted after a crash: ' + restarted + '; spawns after cancel: ' + calls.length + ' (want 2); status: ' + status);
  }
}

// A real face server on a pipe, its stdout collected: what the monitor sees.
async function monitorLines(debug) {
  const childProcess = require('child_process');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-monitor-'));
  ['faceProof', 'shared'].forEach(function (d) {
    fs.cpSync(path.join(RUN, 'app', d), path.join(root, 'app', d), { recursive: true });
  });
  fs.mkdirSync(path.join(root, 'process'), { recursive: true });
  fs.symlinkSync(path.join(RUN, 'js'), path.join(root, 'js'), 'junction');
  const pipe = appServers.pipePathFor(root, 'faceProof');
  if (process.platform !== 'win32') fs.mkdirSync(path.dirname(pipe), { recursive: true });
  const env = Object.assign({}, process.env);
  delete env.SPIRIT_DEBUG;
  if (debug) env.SPIRIT_DEBUG = '1';
  let out = '';
  const child = childProcess.spawn(process.execPath, [path.join('js', 'server.js'), '--app', 'faceProof', '--pipe', pipe],
    { cwd: root, env: env, stdio: ['ignore', 'pipe', 'ignore', 'ipc'] });
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', function (t) { out += t; });
  let page = null;
  for (let n = 0; n < 40; n++) {
    page = await relayRequest.pipeRequest(pipe, 'GET', '/', '', { timeoutMs: 2000 });
    if (page && page.status === 200) break;
    await sleep(250);
  }
  // The readiness probes' own lines arrive a moment later; let them land
  // before counting, so only this exchange's lines are read.
  await sleep(300);
  const before = out.length;
  const ok = await relayRequest.pipeRequest(pipe, 'GET', '/', '', { timeoutMs: 2000 });
  const missing = await relayRequest.pipeRequest(pipe, 'GET', '/no-such-file.txt', '', { timeoutMs: 2000 });
  await sleep(300);
  child.kill();
  // On Windows a process's working folder is locked until it has exited, and
  // kill() returns before that: removing the folder at once was EPERM. Wait
  // for the exit, and never fail the suite on cleanup (runAll reclaims temp
  // homes).
  await new Promise(function (resolve) { if (child.exitCode !== null) resolve(); else child.once('exit', resolve); setTimeout(resolve, 2000); });
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* reclaimed later */ }
  return { lines: out.slice(before).split(/\r?\n/).filter(Boolean), ok: ok, missing: missing };
}

(async function () {
  await cancelledMeansGone();

  test.subHeading('The monitor line: one per exchange, the body never, the error text always');
  const plain = await monitorLines(false);
  const pageLine = plain.lines.filter(function (l) { return /^GET \/ -> 200 text\/html (\d+B )?\d+ms$/.test(l); });
  const payloads = plain.lines.filter(function (l) { return /^\s+payload:/.test(l); });
  const pageText = (plain.ok && plain.ok.text) || '';
  const leaked = pageText && plain.lines.some(function (l) { return l.indexOf(pageText.replace(/\s+/g, ' ').slice(0, 40)) !== -1; });
  if (plain.ok && plain.ok.status === 200 && pageLine.length === 1 && payloads.length === 0 && !leaked) {
    // The size is optional here ON PURPOSE, and owed: faceServer takes it from
    // Content-Length, which a streamed page does not set, so a page's line
    // carries no size (reported to claude-windows 2026-09-28). Tightened to
    // require it once the size is counted from the bytes written.
    test.check('a served page is ONE line (method, path, status, type, time), and its body is not in the monitor');
  } else {
    test.fail('monitor lines for GET /: ' + JSON.stringify(plain.lines));
  }
  const missIdx = plain.lines.findIndex(function (l) { return /^GET \/no-such-file\.txt -> 4\d\d\b/.test(l); });
  const errLine = missIdx === -1 ? '' : (plain.lines[missIdx + 1] || '');
  if (plain.missing && plain.missing.status >= 400 && missIdx !== -1 && /^\s+error: \S/.test(errLine)) {
    test.check('an error reply adds its text on the next line, without debug mode (' + plain.missing.status + ')');
  } else {
    test.fail('monitor lines for a missing file: ' + JSON.stringify(plain.lines));
  }

  test.subHeading('Debug mode is one server\'s, and only then does the payload show');
  const verbose = await monitorLines(true);
  if (verbose.lines.some(function (l) { return /^\s+payload: \S/.test(l); })) {
    test.check('with SPIRIT_DEBUG=1 set for this server alone, the reply\'s payload follows its line');
  } else {
    test.fail('debug monitor lines: ' + JSON.stringify(verbose.lines));
  }

  test.reportSuccessFailureCount();
  process.exit(0);
}()).catch(function (e) {
  test.fail('the suite itself failed: ' + (e && e.stack || e));
  test.reportSuccessFailureCount();
  process.exit(0);
});
