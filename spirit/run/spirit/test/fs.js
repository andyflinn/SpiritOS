'use strict';

// spirit/run/spirit/test/fs.js
// The tests of spirit/fs.js (spec: ./fs.md; goal/G49.1, step 1, "migration scaffolding only"). The box: "spirit/fs.js is
// the one entry for a node process that wants the fs dataset: it wraps spirit/fs/data.js and, in a child process, adds the
// followStream call opaquely. A caller never knows how the dataset is created or updated"; "on the node's main process,
// chokidar writes straight into spirit.data.fs; job.js's own tree (fsTree) goes"; "spirit.js knows nothing about fs
// streaming"; and of the rows: "api folders are marked with a boolean api:true, if they contain api.js and data.js, api:false
// for all files and folders without data.js or api.js", "both flags are set by the one writer of the dataset ... on the
// folder's row, whenever api.js, data.js or a manifest in it comes or goes".
// On a scratch node of lab's; a child process of that node asks for the dataset as a caller would, by spirit/fs.js alone.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

// The code of a file, comments left out.
function code(rel) { let t = ''; try { t = fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ''; } return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); }

const W = {};
test.after(async function () {
  try { if (W.kid) W.kid.kill(); } catch (e) { /* gone */ }
  try { if (W.node) await W.node.release(); } catch (e) { /* gone */ }
  try { if (W.node) H.freeTree(W.node); } catch (e) { /* left */ }
});

// A caller in a child process of the scratch node: it requires spirit/fs.js and nothing else, and prints, every half second,
// the rows asked about (null while there is none) and whether the tree is whole.
const ASKED = ['spirit/app/desk', 'spirit/app/job', 'spirit/fs', 'spirit/app/desk/desk.js', 'spirit/zzfsflag'];
function caller() {
  const script = [
    "require('./spirit/spirit.js');",
    "const asked = " + JSON.stringify(ASKED) + ";",
    "Promise.resolve(spirit.require('spirit/fs.js')).then(function () {",
    "  setInterval(function () {",
    "    let rows = null, ready = false;",
    "    try { const V = spirit.data.viewAt(null, 'fs'); const b = V.branch('files') || {}; ready = V.ready('files') === true; rows = {}; asked.forEach(function (p) { rows[p] = b[p] || null; }); rows.count = Object.keys(b).length; } catch (e) { rows = null; }",
    "    process.stdout.write(JSON.stringify({ ready: ready, rows: rows }) + '\\n');",
    "  }, 500);",
    "});",
  ].join('\n');
  const kid = spawn(process.execPath, ['-e', script], { cwd: W.node.run, stdio: ['ignore', 'pipe', 'ignore'] });
  W.last = null;
  let buf = '';
  kid.stdout.on('data', function (d) {
    buf += String(d);
    const lines = buf.split('\n'); buf = lines.pop();
    lines.forEach(function (l) { try { W.last = JSON.parse(l); } catch (e) { /* half a line */ } });
  });
  return kid;
}
const row = function (p) { return W.last && W.last.rows ? W.last.rows[p] : null; };
const until = async function (fn, ms) { for (let i = 0; i < ms / 200; i++) { if (fn()) return true; await H.sleep(200); } return !!fn(); };

test.run('spirit/fs.js exists', 0.2, function () {
  return fs.existsSync(path.join(RUN, 'spirit', 'fs.js')) || false;
}, test.limit.quick);
test.run('a scratch node comes up', 0.2, async function () {
  W.node = await H.scratchNode({});
  return (!!W.node && W.node.up) || false;
}, test.limit.slow);
const up = function () { return !!W.node && W.node.up; };

// ── one entry, the dataset behind it ──
test.run('a child process that requires spirit/fs.js alone holds the whole tree in spirit.data.fs, marked complete', 0.4, async function () {
  if (!up()) return false;
  W.kid = caller();
  const whole = await until(function () { return !!W.last && W.last.ready && W.last.rows && W.last.rows.count > 100; }, 30000);
  return whole || false;
}, test.limit.slow);

// ── the two flags on every row ──
test.run('spirit/app/desk, holding api.js and data.js, is a row with api true', 0.4, function () {
  const r = row('spirit/app/desk');
  return (!!r && r.api === true) || false;
}, test.limit.quick);
test.run('spirit/app/desk, holding desk.json and desk.js, is a row with app true', 0.4, function () {
  const r = row('spirit/app/desk');
  return (!!r && r.app === true) || false;
}, test.limit.quick);
test.run('spirit/fs, holding api.js and data.js and no manifest, is a row with api true and app false', 0.4, function () {
  const r = row('spirit/fs');
  return (!!r && r.api === true && r.app === false) || false;
}, test.limit.quick);
// Q1 (Andy: "yes. testicle already checks validity of an app.json"): a folder is app:true by its <name>.json alone; job has
// job.json and no job.js.
test.run('spirit/app/job, holding job.json and no job.js, is a row with app true', 0.4, function () {
  const r = row('spirit/app/job');
  return (!!r && r.app === true) || false;
}, test.limit.quick);
test.run('a file, spirit/app/desk/desk.js, is a row with api false and app false', 0.4, function () {
  const r = row('spirit/app/desk/desk.js');
  return (!!r && r.api === false && r.app === false) || false;
}, test.limit.quick);
// "whenever api.js, data.js or a manifest in it comes or goes": a folder planted while the caller follows.
test.run('a folder that gains api.js and data.js turns api true in the caller\'s dataset', 0.4, async function () {
  if (!up() || !W.kid) return false;
  const dir = path.join(W.node.run, 'spirit', 'zzfsflag');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'api.js'), "'use strict';\nmodule.exports = { verbs: {} };\n");
  fs.writeFileSync(path.join(dir, 'data.js'), "'use strict';\nmodule.exports = {};\n");
  W.dir = dir;
  const on = await until(function () { const r = row('spirit/zzfsflag'); return !!r && r.api === true; }, 15000);
  return on || false;
}, test.limit.slow);
test.run('the same folder losing its data.js turns api false again', 0.4, async function () {
  if (!W.dir) return false;
  fs.rmSync(path.join(W.dir, 'data.js'), { force: true });
  const off = await until(function () { const r = row('spirit/zzfsflag'); return !!r && r.api === false; }, 15000);
  return off || false;
}, test.limit.slow);

// ── the node's own side, and what stays out of spirit.js ──
test.run('job.js keeps no tree of its own: no fsTree in its code', 0.4, function () {
  const c = code('spirit/job.js');
  return (c !== '' && !/\bfsTree\b/.test(c)) || false;
}, test.limit.quick);
test.run('spirit.js knows nothing of fs streaming: it names neither followStream, spirit/fs/data.js nor spirit/fs.js', 0.4, function () {
  const c = code('spirit/spirit.js');
  return (c !== '' && !/followStream|spirit\/fs\/data\.js|spirit\/fs\.js/.test(c)) || false;
}, test.limit.quick);
