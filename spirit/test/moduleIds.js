'use strict';

// spirit/test/moduleIds.js
// THE NODE OWNS EVERY MODULE ID, BY PATH; A JOB IS AN INSTANCE OF ONE ID —
// slim/G1.5, written FIRST, red on today's code (wsl-claude tests,
// claude-windows builds).
//
//   Andy, 2026-09-29: "it would be the node, who owns shell-element AND
//   process ID's, what we see in jobs monitor are ID-instances, because some
//   processes can run multiple instances concurrentliy, like ImageStats of
//   two different folders", and on the Jobs monitor: "Yes: each Jobs monitor
//   row, names the id it is an instance of".
//
// THE CONTRACT:
//   T1 a job started from process/js/<name>/ carries module 'process/js/<name>',
//      the same string the include list holds (includeList.paths)
//   T2 two starts of one process are two jobs, two instances of one module
//   T3 the node's own boot does the same: a node-operated server's job carries
//      its module (a face is such a server since goal/G13.2)
//   T4 the Jobs monitor's row names the module a job is an instance of
//   T5 a job that is no module's (the node's own fs-watcher, stats, presence)
//      carries none, rather than a made-up one
// The module is job.module, beside job.type and job.kind.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by slim/G1.5: ';
const RUN = path.join(__dirname, '..', 'run');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

const jobs = require('../run/js/jobs.js')(kernel, 65433);
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-moduleids-'));
const started = [];
const includeList = require('../run/js/includeList.js');

// A node's run folder with one one-shot process and one node-operated server.
function plantNode() {
  const run = path.join(scratch, 'spirit', 'run');
  const one = path.join(run, 'process', 'js', 'counter');
  fs.mkdirSync(one, { recursive: true });
  fs.writeFileSync(path.join(one, 'counter.json'), JSON.stringify({ label: 'counter', args: [{ name: 'folder', default: '' }] }));
  fs.writeFileSync(path.join(one, 'counter.js'), 'setTimeout(function () {}, 3000);\n');
  const srv = path.join(run, 'process', 'js', 'keeper');
  fs.mkdirSync(srv, { recursive: true });
  fs.writeFileSync(path.join(srv, 'keeper.json'), JSON.stringify({ label: 'keeper', kind: 'server', operated: 'node', args: [] }));
  fs.writeFileSync(path.join(srv, 'keeper.js'), 'setInterval(function () {}, 1000);\n');
  fs.mkdirSync(path.join(run, 'relay-state'), { recursive: true });
  // Listed: this suite is about ids, not about the list (slim/G1.3 T6).
  includeList.add(run, 'process/js/counter');
  includeList.add(run, 'process/js/keeper');
  return run;
}

test.startTest('slim/G1.5: the node owns every module id, by path; a job is an instance of one id');

(async function () {
  const run = plantNode();
  const script = path.join(run, 'process', 'js', 'counter', 'counter.js');

  test.subHeading('T1: a job started from process/js/<name>/ carries module process/js/<name>');
  let a = null;
  try { a = jobs.startJob('node', [script, JSON.stringify({ folder: 'photos-a' })], { type: 'counter' }); } catch (e) { a = { error: e.message }; }
  if (a && a.id) started.push(a);
  const listed = includeList.paths(run);
  if (a && a.module === 'process/js/counter' && listed.indexOf(a.module) !== -1) test.check('job.module is process/js/counter, the same string the include list holds');
  else test.fail(OWED + 'the job reads ' + JSON.stringify(a && { id: a.id, module: a.module, type: a.type, error: a.error }));

  test.subHeading('T2: two starts of one process are two instances of one module');
  let b = null;
  try { b = jobs.startJob('node', [script, JSON.stringify({ folder: 'photos-b' })], { type: 'counter' }); } catch (e) { b = { error: e.message }; }
  if (b && b.id) started.push(b);
  const both = jobs.listJobs().filter(function (j) { return j.module === 'process/js/counter'; });
  if (a && b && a.id && b.id && a.id !== b.id && both.length === 2) test.check('two jobs, two ids, both instances of process/js/counter, and Jobs lists both');
  else test.fail(OWED + 'ids ' + JSON.stringify([a && a.id, b && b.id]) + ', jobs listing process/js/counter: ' + both.length);

  test.subHeading('T3: the boot does the same, for a node-operated server');
  const booted = jobs.startNodeServers(run) || [];
  booted.forEach(function (j) { started.push(j); });
  const keeper = booted.filter(function (j) { return j && j.type === 'keeper'; })[0];
  if (keeper && keeper.module === 'process/js/keeper') {
    test.check('the booted keeper job is process/js/keeper');
  } else test.fail(OWED + 'keeper job module ' + JSON.stringify(keeper && keeper.module));

  test.subHeading('T4: the Jobs monitor\'s row names the module a job is an instance of');
  let row = '';
  try {
    const src = fs.readFileSync(path.join(RUN, 'shell', 'jobs', 'jobs.js'), 'utf8');
    const renderJobRow = new Function('spirit', 'document', 'window', src + '\nreturn renderJobRow;')(
      { shell: { activateApp: function () {} }, core: kernel.core }, { getElementById: function () { return null; } }, {});
    row = renderJobRow({ id: 'job_9', kind: 'process', type: 'imageStats', module: 'process/js/imageStats', status: 'running', data: {}, log: [] });
  } catch (e) { row = 'threw ' + e.message; }
  if (/process\/js\/imageStats/.test(row)) test.check('a row for an imageStats job names process/js/imageStats');
  else test.fail(OWED + 'the row reads ' + JSON.stringify(String(row).replace(/\s+/g, ' ').slice(0, 200)));

  test.subHeading('T5: a job that is no module\'s carries none');
  const own = jobs.listJobs().filter(function (j) { return j.type === 'fs-watcher' || j.type === 'stats' || j.type === 'relay-presence'; });
  let mine = null;
  try { mine = jobs.createJob('permanent', 'probe-own', {}); } catch (e) { mine = null; }
  const loose = own.concat(mine ? [mine] : []);
  if (loose.length && loose.every(function (j) { return !j.module; })) test.check('the node\'s own jobs carry no module (' + loose.map(function (j) { return j.type; }).join(', ') + ')');
  else test.fail(OWED + 'own jobs: ' + JSON.stringify(loose.map(function (j) { return { type: j.type, module: j.module }; })));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(async function () {
  started.forEach(function (j) { try { jobs.cancelJob(j.id); } catch (e) { /* gone */ } });
  await sleep(300);
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
