'use strict';

// spirit/run/spirit/job/processJob/test/script.js
// THE TESTS OF spirit/job/processJob/script.js, and of no other script (goal/G49.19, box v13: "spirit.processJob() leaves
// spirit/script.js and becomes spirit/job/processJob/script.js"; "processJob is required by its path ... by every caller ...
// The spirit object keeps no copy and no member of it"). What it did as spirit.processJob it does by its path: a process the
// node started as a job reports on that job by event.publish with its own id (SPIRIT_JOB_ID), one post.
// A fake node on a free port takes the posts; a scratch run root names it in its environment.json, so no real node is asked.

require('../../../script.js');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
const test = SPIRIT.requireScript('spirit/test/testReport.js');
const tempFolder = SPIRIT.requireScript('spirit/tempFolder/script.js').tempFolder;
const SUBJECT = 'spirit/job/processJob/script.js';
const VERBS = ['report', 'log', 'complete', 'fail', 'publish', 'cycle', 'start', 'progress', 'end'];
const EVENT_API = fs.readFileSync(path.join(RUN, 'spirit', 'event', 'api.js'), 'utf8');
test.after(function () { try { fs.rmSync(tempFolder.path('spirit/job/processJob/test'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });

// The fake node: every post kept, event.publish answered ok.
function fakeNode() {
  const asked = [];
  const server = http.createServer(function (req, res) {
    let body = '';
    req.on('data', function (c) { body += c; });
    req.on('end', function () {
      let b = {};
      try { b = JSON.parse(body || '{}'); } catch (e) { b = {}; }
      asked.push(b);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      // The event branch's interface, asked before its first call, is this tree's own spirit/event/api.js, as a node answers it.
      if (b.call === 'api' && b.args && b.args.branch === 'event') { res.end(JSON.stringify({ interface: EVENT_API })); return; }
      res.end(JSON.stringify({ ok: true }));
    });
  });
  return new Promise(function (r) { server.listen(0, '127.0.0.1', function () { r({ server: server, port: server.address().port, asked: asked }); }); });
}
// A run root of its own: this tree's spirit/, no state of it, its environment.json naming the fake node.
function scratchRoot(port) {
  const root = tempFolder('spirit/job/processJob/test/root');
  fs.cpSync(path.join(RUN, 'spirit'), path.join(root, 'spirit'), { recursive: true, filter: function (src) { return src !== path.join(RUN, 'spirit', 'state'); } });
  fs.mkdirSync(path.join(root, 'spirit', 'state'), { recursive: true });
  fs.writeFileSync(path.join(root, 'spirit', 'state', 'environment.json'), JSON.stringify({ PORT: port }));
  return root;
}
// What a process of that root sees of processJob, as JSON; job is its SPIRIT_JOB_ID, '' for none.
const OBSERVE = `
const s = require(process.argv[2] + '/spirit/script.js');
async function code(p) { try { await p; return null; } catch (e) { return e && e.code; } }
(async function () {
  const out = {};
  const J = s.requireScript('${SUBJECT}');
  out.verbs = J && typeof J === 'object' ? Object.keys(J).filter(function (k) { return typeof J[k] === 'function'; }).sort() : null;
  if (process.argv[3] === 'none') { out.noJob = await code(J.report({ data: { x: 1 } })); }
  else {
    await J.start('j1');
    out.startAgain = await code(J.start('j2'));
    await J.progress(1, 2, 'half');
    await J.end({ done: true });
    await J.report({ data: { reported: true } });
  }
  process.stdout.write(JSON.stringify(out));
}()).catch(function (e) { process.stdout.write(JSON.stringify({ threw: String(e && e.stack || e) })); });
`;
function observe(root, job) {
  const file = path.join(root, 'observe.js');
  fs.writeFileSync(file, OBSERVE);
  const env = Object.assign({}, process.env);
  if (job) env.SPIRIT_JOB_ID = job; else delete env.SPIRIT_JOB_ID;
  return new Promise(function (resolve) {
    const kid = spawn(process.execPath, [file, root, job ? '' : 'none'], { cwd: root, env: env });
    let said = '';
    kid.stdout.on('data', function (c) { said += c; });
    kid.on('close', function () { try { resolve(JSON.parse(said)); } catch (e) { resolve({ threw: said }); } });
    setTimeout(function () { try { kid.kill(); } catch (e) { /* gone */ } }, 20000);
  });
}

const T = { node: null, root: '', o: null, none: null };
test.after(function () { if (T.node) T.node.server.close(); });
test.run('a process of a scratch run root naming a fake node runs processJob by its path', 0.2, async function () {
  T.node = await fakeNode();
  T.root = scratchRoot(T.node.port);
  T.o = await observe(T.root, 'spirit.app.zzjob');
  return (!!T.o && !T.o.threw) || false;
}, test.limit.slow);
test.run('spirit/job/processJob/script.js exposes an object holding report, log, complete, fail, publish, cycle, start, progress and end', 0.2, function () {
  return (!!T.o && JSON.stringify(T.o.verbs) === JSON.stringify(VERBS.slice().sort())) || false;
}, test.limit.quick);
const published = function () { return T.node ? T.node.asked.filter(function (b) { return b.call === 'event.publish'; }).map(function (b) { return b.args || {}; }) : []; };
test.run('start, progress and end publish by event.publish with the job\'s id, in that order', 0.2, function () {
  const states = published().map(function (u) { return u.app && u.app.job && u.app.job.state; }).filter(Boolean);
  return (published().length > 0 && published().every(function (u) { return u.id === 'spirit.app.zzjob'; }) && JSON.stringify(states) === JSON.stringify(['start', 'progress', 'end'])) || false;
}, test.limit.quick);
test.run('a second start while a job is open is refused job-open', 0.2, function () {
  return (!!T.o && T.o.startAgain === 'job-open') || false;
}, test.limit.quick);
test.run('report goes out by event.publish with the job\'s id and its patch', 0.2, function () {
  return published().some(function (u) { return u.id === 'spirit.app.zzjob' && u.data && u.data.reported === true; }) || false;
}, test.limit.quick);
test.run('it posts nothing but event.publish: no job.update', 0.2, function () {
  return (!!T.node && T.node.asked.length > 0 && !T.node.asked.some(function (b) { return b.call === 'job.update'; })) || false;
}, test.limit.quick);
test.run('in a process the node did not start as a job, report is refused no-job', 0.2, async function () {
  if (!T.root) return false;
  T.none = await observe(T.root, '');
  return (!!T.none && T.none.noJob === 'no-job') || false;
}, test.limit.slow);
