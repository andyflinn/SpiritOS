'use strict';

// spirit/run/spirit/test/jobs-routes.js
// The tests of spirit/jobs.js by name: A JOB'S ID IS A ROUTE (goal/G43.20, its box; spec: ./jobs-routes.md). Andy: "they're
// supposed to identify a "route" in the spirit-tree, NOT some invented number.", "ALL job id's will be routes to either a
// node supplied api (spirit.fs, etc...) or an app supplied id (spirit.app.<name>)", "a job cannot start if it is already
// running", and "cw, box that only jobs in the app folder with node:run:true can be started with jobs.create". A real node on
// a scratch copy of the tracked files; throwaway apps are planted in that copy, nothing kept in the repo. Never a live node.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const H = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
const ROUTE = /^spirit(\.[A-Za-z][A-Za-z0-9]*)*$/;
// The node's own jobs, once each (Q1, Q2 and the box): the node's events, its files, its apps, its contacts, its auth.
const OWN = ['spirit', 'spirit.app', 'spirit.auth', 'spirit.contact', 'spirit.fs'];

// A throwaway app of spirit/app/<name>/: its script waits ms and ends; run true makes it a run app (node run true).
function plant(run, name, ms, nodeRun) {
  const dir = path.join(run, 'spirit', 'app', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify({ identity: { icon: '🧪', label: name, intrinsic: false }, node: nodeRun ? { mount: false, run: true } : { mount: false } }));
  fs.writeFileSync(path.join(dir, name + '.js'), 'setTimeout(function () {}, ' + ms + ');\n');
}

test.startTest('jobs-routes.js: every job id is a route in the spirit tree, one job per id, and jobs.create starts only a run app (goal/G43.20)');

(async function () {
  const node = await H.scratchNode();
  if (!node.up) { test.fail('the scratch node did not come up: nothing judged'); test.reportSuccessFailureCount(); process.exit(0); }
  const ask = function (call, args) {
    return fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) })
      .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }, function () { return { status: r.status, body: null }; }); }, function (e) { return { status: 0, body: String(e) }; });
  };
  const run = path.join(node.root, 'spirit', 'run');
  try {
    const on = await ask('app.active', { key: 'desk', active: true });
    ok(on.status === 200, 'the world: desk, an app server, is switched on', 'app.active desk: ' + short(on));
    await H.sleep(5000);
    const list = await ask('jobs.search', { q: '' });
    const ids = ((list.body && list.body.items) || []).map(function (i) { return String(i.key); });
    ok(ids.length >= 5, 'the world: the node lists ' + ids.length + ' jobs', 'jobs.search: ' + short(list));

    test.subHeading('"ALL job id\'s will be routes": spirit.fs, spirit.app.<name>, never an invented number');
    const minted = ids.filter(function (id) { return /^job_\d+$/.test(id); });
    ok(!minted.length, 'no job id is a minted number, job_<n>', minted.length + ' are: ' + short(minted));
    const notRoutes = ids.filter(function (id) { return !ROUTE.test(id); });
    ok(ids.length > 0 && !notRoutes.length, 'every job id is a route: spirit, then names, dot by dot', 'not a route: ' + short(notRoutes));
    ok(ids.indexOf('spirit.app.desk') !== -1, 'an app server\'s job is its route, spirit.app.desk', 'ids: ' + short(ids));

    test.subHeading('one job per family (Q1, Q2): the node\'s own jobs are spirit, spirit.fs, spirit.app, spirit.contact, spirit.auth');
    const own = [];
    for (const id of ids) {
      const g = await ask('jobs.get', { key: id });
      const job = (g.body && g.body.job) || {};
      // The node's own: its permanent jobs, never a server's or a process's run.
      if (job.kind === 'permanent') own.push({ id: id, job: job });
    }
    const ownIds = own.map(function (o) { return o.id; }).sort();
    ok(JSON.stringify(ownIds) === JSON.stringify(OWN), 'the node\'s own jobs are exactly ' + OWN.join(', ') + ': contacts, presence and peer search in one, the app list and app faces in one, stats and join steps under spirit',
      'the node\'s own jobs: ' + short(ownIds));
    ok(own.length > 0 && own.every(function (o) { return o.id.split('.').length <= 2; }), 'the node\'s own ids have at most two parts', 'own: ' + short(ownIds));
    const typed = own.filter(function (o) { return Object.prototype.hasOwnProperty.call(o.job, 'type'); });
    ok(own.length > 0 && !typed.length, 'a job has no type field any more: the id says what it is', typed.length + ' still carry a type: ' + short(typed.map(function (o) { return o.id + ':' + o.job.type; })));

    test.subHeading('"only jobs in the app folder with node:run:true can be started with jobs.create"');
    plant(run, 'zzRun', 4000, true);
    plant(run, 'zzMount', 4000, false);
    fs.mkdirSync(path.join(run, 'scratchScripts'), { recursive: true });
    fs.writeFileSync(path.join(run, 'scratchScripts', 'zzOther.js'), 'setTimeout(function () {}, 100);\n');
    const other = await ask('jobs.create', { command: process.execPath, args: [path.join(run, 'scratchScripts', 'zzOther.js')] });
    ok(other.status >= 400, 'another script, in no app folder, is refused', 'jobs.create answered ' + short(other));
    const mount = await ask('jobs.create', { command: process.execPath, args: [path.join(run, 'spirit', 'app', 'zzMount', 'zzMount.js')] });
    ok(mount.status >= 400, 'an app\'s script whose json has no node run is refused', 'jobs.create answered ' + short(mount));
    const command = await ask('jobs.create', { command: 'git', args: ['status'] });
    ok(command.status >= 400, 'another command is refused', 'jobs.create answered ' + short(command));
    const runApp = path.join(run, 'spirit', 'app', 'zzRun', 'zzRun.js');
    const first = await ask('jobs.create', { command: process.execPath, args: [runApp] });
    const firstId = first.body && (first.body.id || first.body.key);
    ok(first.status >= 200 && first.status < 300 && firstId === 'spirit.app.zzRun', 'a run app\'s own script starts, under its route spirit.app.zzRun', 'jobs.create answered ' + short(first));

    test.subHeading('"a job cannot start if it is already running" (Q3), pending counting as running');
    const second = await ask('jobs.create', { command: process.execPath, args: [runApp] });
    ok(second.status >= 400 && /already running/.test(JSON.stringify(second.body || '')), 'a second start while it runs is refused, "already running"', 'jobs.create answered ' + short(second));
    await H.sleep(5000);
    const both = await Promise.all([ask('jobs.create', { command: process.execPath, args: [runApp] }), ask('jobs.create', { command: process.execPath, args: [runApp] })]);
    const taken = both.filter(function (r) { return r.status >= 200 && r.status < 300; });
    ok(taken.length === 1, 'two starts at once: one gets in, the other is refused (the pending one counts as running)', 'answers: ' + short(both.map(function (r) { return r.status; })));

    test.subHeading('"a new run takes the id over and runs on"');
    const again = taken[0] ? (taken[0].body && (taken[0].body.id || taken[0].body.key)) : '';
    const g = await ask('jobs.get', { key: 'spirit.app.zzRun' });
    ok(again === 'spirit.app.zzRun' && ((g.body && g.body.job) || {}).status === 'running', 'after its run ended, a new run is the same id, spirit.app.zzRun, running again', 'id ' + short(again) + ', job ' + short(g.body));
  } catch (e) {
    test.fail('the suite threw ' + (e && e.stack || e));
  } finally {
    if (node.child) node.child.kill();
  }
  test.reportSuccessFailureCount();
  process.exit(0);
}());
