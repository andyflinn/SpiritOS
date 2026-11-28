'use strict';

// spirit/run/spirit/fs/dataset/test/script.js
// The tests of spirit/fs/dataset/script.js (spec: ./script.md; goal/G49.1, step 1, "migration scaffolding only"). The box: "spirit/fs/dataset/script.js is
// the one entry for a node process that wants the fs dataset: it wraps spirit/fs/client/script.js and, in a child process, adds the
// followStream call opaquely. A caller never knows how the dataset is created or updated"; "on the node's main process,
// chokidar writes straight into spirit.required.spirit.data.fs; job.js's own tree (fsTree) goes"; "spirit.js knows nothing about fs
// streaming"; and of the rows: "api folders are marked with a boolean api:true, if they contain api.js and data.js, api:false
// for all files and folders without data.js or api.js", "both flags are set by the one writer of the dataset ... on the
// folder's row, whenever api.js, data.js or a manifest in it comes or goes".
// On a scratch node of lab's; a child process of that node asks for the dataset as a caller would, by spirit/fs/dataset/script.js alone.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/testicle/testReport/script.js');
const H = LOADER.requireScript('spirit/testicle/headLessChrome/script.js');

// The code of a file, comments left out.
function code(rel) { let t = ''; try { t = fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ''; } return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); }

const W = {};
test.after(async function () {
  try { if (W.kid) W.kid.kill(); } catch (e) { /* gone */ }
  try { if (W.node) await W.node.release(); } catch (e) { /* gone */ }
  try { if (W.node) H.freeTree(W.node); } catch (e) { /* left */ }
});

// A caller in a child process of the scratch node: it requires spirit/fs/dataset/script.js and nothing else, and prints, every half second,
// the rows asked about (null while there is none) and whether the tree is whole.
// goal/G49.23: the store hands no family out by name; the fs family is named by its branch's path, spirit.fs.
// AN OLD-SHAPE FOLDER, FOUND IN THE TREE (goal/G49.23: spirit/node, the old example, is gone, box v22 Part 2): the first folder
// under spirit/ that holds api.js and data.js, and neither script.js nor its own <name>.json; none found, its check is red.
function oldShapeFolder() {
  const walk = function (rel) {
    let names = [];
    try { names = fs.readdirSync(path.join(RUN, rel), { withFileTypes: true }); } catch (e) { return null; }
    const has = function (n) { return names.some(function (d) { return d.name === n; }); };
    const base = rel.slice(rel.lastIndexOf('/') + 1);
    if (has('api.js') && has('data.js') && !has('script.js') && !has(base + '.json')) return rel;
    for (const d of names) {
      if (!d.isDirectory() || d.name === 'test' || d.name === 'state' || d.name === 'node_modules' || d.name[0] === '.') continue;
      const got = walk(rel + '/' + d.name);
      if (got) return got;
    }
    return null;
  };
  return walk('spirit');
}
const OLD_SHAPE = oldShapeFolder();
const ASKED = ['spirit/app/desk', 'spirit/app/job', 'spirit/fs', OLD_SHAPE || 'spirit/zznoOldShape', 'spirit/app/desk/desk.js', 'spirit/zzfsflag', 'spirit/server/script.js', 'spirit/state'];
function caller() {
  const script = [
    "require('./spirit/script.js');",
    "const asked = " + JSON.stringify(ASKED) + ";",
    "Promise.resolve(spirit.requireScript('spirit/fs/dataset/script.js')).then(function () {",
    "  setInterval(function () {",
    "    let rows = null, ready = false;",
    "    try { const V = spirit.client.viewAt(null, 'spirit.fs'); const b = V.branch('files') || {}; ready = V.ready('files') === true; rows = {}; asked.forEach(function (p) { rows[p] = b[p] || null; }); rows.count = Object.keys(b).length; } catch (e) { rows = null; }",
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

test.run('spirit/fs/dataset/script.js exists', 0.2, function () {
  return fs.existsSync(path.join(RUN, 'spirit', 'fs', 'dataset', 'script.js')) || false;
}, test.limit.quick);
test.run('a scratch node comes up', 0.2, async function () {
  W.node = await H.scratchNode({});
  return (!!W.node && W.node.up) || false;
}, test.limit.slow);
const up = function () { return !!W.node && W.node.up; };

// ── one entry, the dataset behind it ──
test.run('a child process that requires spirit/fs/dataset/script.js alone holds the whole tree in the spirit.fs family of spirit.client, marked complete', 0.4, async function () {
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
// THE OLD SHAPE AND THE NEW SIDE BY SIDE (goal/G49.15; Andy: "does not the interim cache handle both old and new"): spirit/fs
// is a branch of the new shape since step 3; a folder of the old shape is found in the tree (oldShapeFolder, above).
test.run('spirit/fs, holding script.js and client/script.js and no manifest, is a row with branch true, api false and app false', 0.4, function () {
  const r = row('spirit/fs');
  return (!!r && r.branch === true && r.api === false && r.app === false) || false;
}, test.limit.quick);
test.run('a folder holding api.js and data.js, no script.js and no manifest, is a row with api true, branch false and app false', 0.4, function () {
  if (!OLD_SHAPE) return false;
  const r = row(OLD_SHAPE);
  return (!!r && r.api === true && r.branch === false && r.app === false) || false;
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
  const c = code('spirit/job/engine/script.js');
  return (c !== '' && !/\bfsTree\b/.test(c)) || false;
}, test.limit.quick);
test.run('spirit.js knows nothing of fs streaming: it names neither followStream, spirit/fs/client/script.js nor spirit/fs/dataset/script.js', 0.4, function () {
  const c = code('spirit/script.js');
  return (c !== '' && !/followStream|spirit\/fs\/client\/script\.js|spirit\/fs\/dataset\/script\.js/.test(c)) || false;
}, test.limit.quick);

// ── the dataset is whole; only a browser's stream is filtered (goal/G49.2) ──
// Andy: "the shared dataset needs to be complete, period.", "it is at publish-to-clients time that !fileServable be the
// filter.", "it would be weird to deny a node process like backup knowledge of all files", "the node knows if a browser is
// the loopback client, that's really the only place where fileServable() should be used to filter the publish stream",
// "only brosers can be efectively gated from file access", "go". A node process's spirit.fs family holds the server code and
// the node's own state folder; a page's holds neither, while it holds a file a page may be served, so it was judged.
// goal/G49.25: the node's server code is the one server, spirit/server/script.js; spirit/server/node/script.js is gone.
test.run('a node process\'s dataset holds spirit/server/script.js, which no page may be served', 0.2, async function () {
  if (!up() || !W.kid) return false;
  return (await until(function () { return !!row('spirit/server/script.js'); }, 10000)) || false;
}, test.limit.slow);
test.run('a node process\'s dataset holds the node\'s own state folder, spirit/state', 0.2, async function () {
  if (!up() || !W.kid) return false;
  return (await until(function () { return !!row('spirit/state'); }, 10000)) || false;
}, test.limit.slow);
const P = {};
test.after(function () { try { if (P.chrome && P.chrome.kid) P.chrome.kid.kill(); } catch (e) { /* gone */ } });
const PAGE_ROWS = "(function () { try { var V = window.spirit.client.viewAt(null, 'spirit.fs'); var b = V.branch('files') || {}; return JSON.stringify({ ready: V.ready('files') === true, count: Object.keys(b).length, desk: !!b['spirit/app/desk/desk.js'], server: !!b['spirit/server/script.js'], state: Object.keys(b).some(function (k) { return k === 'spirit/state' || k.indexOf('spirit/state/') === 0; }) }); } catch (e) { return 'null'; } })()";
async function pageRows() { try { return JSON.parse(await P.chrome.evaluate(PAGE_ROWS)); } catch (e) { return null; } }
test.run('a page on the node holds the whole servable tree in the spirit.fs family of its spirit.client', 0.4, async function () {
  if (!up()) return false;
  P.chrome = await H.chromePage(H.findChrome());
  if (!P.chrome || P.chrome.error) return false;
  await P.chrome.send('Page.navigate', { url: W.node.base + '/' });
  await until(function () { return false; }, 1000);
  await P.chrome.evaluate("window.spirit && window.spirit.readyPromise ? window.spirit.readyPromise.then(function () { return window.spirit.requireScript('spirit/fs/script.js'); }).then(function () { return true; }, function () { return true; }) : false");
  for (let i = 0; i < 100; i++) { P.rows = await pageRows(); if (P.rows && P.rows.ready && P.rows.desk) break; await H.sleep(300); }
  return (!!P.rows && P.rows.ready && P.rows.desk && P.rows.count > 100) || false;
}, test.limit.slow);
// goal/G49.25: the one server's code, as spirit/server/node/script.js was before.
test.run('a page\'s dataset holds no spirit/server/script.js', 0.2, function () {
  return (!!P.rows && P.rows.ready && P.rows.desk && P.rows.server === false) || false;
}, test.limit.quick);
test.run('a page\'s dataset holds nothing of spirit/state', 0.2, function () {
  return (!!P.rows && P.rows.ready && P.rows.desk && P.rows.state === false) || false;
}, test.limit.quick);
