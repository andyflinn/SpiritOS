'use strict';
const SPIRIT = require('../../../../../script.js');

// spirit/run/spirit/testicle/general/any/branchRules/test/script.js
// THE BRANCH RULES MODULE ON A TREE OF ITS OWN (goal/G49.27, step 2a; spec: ./script.md). The box: "Each module has its own
// test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red." Two app
// branches are planted in a scratch run made a git tree (the module reads the tree from git), one whose manifest keeps the
// rule and one whose manifest names a kind; ../script.js judges each, its tests kept here and not reported, and the verdict
// of the rule's title is read. Neither branch has an api.js, so no test of it asks a node.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const test = SPIRIT.requireScript('spirit/testicle/testReport/script.js');
const RULE = SPIRIT.requireScript('spirit/testicle/general/any/branchRules/script.js');
// ITS TEMP FOLDER FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"), removed when the suite ends.
const tempFolder = SPIRIT.requireScript('spirit/tempFolder/script.js').tempFolder;
const ROUTE = 'spirit/testicle/general/branchRules/test/script';
const PLANT = path.join(tempFolder(ROUTE), 'spirit', 'run');
test.after(function () { try { fs.rmSync(tempFolder.path(ROUTE), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
function plant(rel, text) { const at = path.join(PLANT, rel); fs.mkdirSync(path.dirname(at), { recursive: true }); fs.writeFileSync(at, text); return at; }

const KEEPS = 'spirit/app/zzkeeps';
const BREAKS = 'spirit/app/zzbreaks';
plant(KEEPS + '/zzkeeps.json', JSON.stringify({ identity: { icon: 'k', label: 'Keeps' } }));
plant(BREAKS + '/zzbreaks.json', JSON.stringify({ identity: { icon: 'b', label: 'Breaks' }, kind: 'server' }));
const GIT = { made: false };
try { execFileSync('git', ['init', '-q'], { cwd: PLANT, stdio: 'ignore' }); GIT.made = true; } catch (e) { GIT.made = false; }

// What checks says for one path, kept and not reported; the verdict of one title, true, false, or null when it was not said.
const RULE_TITLE = 'its manifest has no kind or operated: the node operates the server';
async function verdict(scriptPath, title) {
  const kept = [];
  const T = { limit: test.limit, run: function (t, severity, body) { kept.push({ title: t, body: body }); }, after: function () {}, forScript: function (s, fn) { fn(); }, hold: function () {}, release: function () {}, comment: function () {} };
  RULE.checks(scriptPath, { test: T, run: PLANT, spirit: SPIRIT, node: { node: null } });
  const one = kept.filter(function (t) { return t.title === title; })[0];
  if (!one) return null;
  try { return (await one.body()) === true; } catch (e) { return null; }
}

test.run('it hands out appliesTo, its resource node, own false, its forbids and checks', 0.4, function () {
  return (typeof RULE.appliesTo === 'function' && RULE.resource === 'node' && RULE.own === false && Array.isArray(RULE.forbids) && typeof RULE.checks === 'function') || false;
}, test.limit.quick);
test.run('the planted run is a git tree', 0.2, function () {
  return GIT.made || false;
}, test.limit.quick);
test.run('a planted app branch whose manifest has no kind or operated keeps the rule', 0.4, async function () {
  return (await verdict(KEEPS, RULE_TITLE)) === true;
}, test.limit.quick);
test.run('a planted app branch whose manifest names a kind is red', 0.4, async function () {
  return (await verdict(BREAKS, RULE_TITLE)) === false;
}, test.limit.quick);

// THE BRANCH PART USES THE NODE ITS RUN IS HANDED (goal/G47.1; Andy: "are the tests not ordered in the general test so that all
// tests requiring a scratch node can use the same one?", then "fix it, with red and code"): handed a list, the runner ran every
// part once a script, and its branch part booted a node of its own for each. Folded here from
// spirit/test/test/spirit-sibling-general.js (goal/G49.27: one test file per module; it runs spirit/testicle/run/node/script.js,
// its runner, on this module alone, SPIRIT_RULE_MODULES). Here the runner is handed a node, as testicle hands one
// (SPIRIT_MOUNT_BASE, SPIRIT_MOUNT_RUN), at an address in front of a real scratch node that counts what reaches it, and two
// scripts in two branches: their node worlds come up, and the calls they make reach the handed node.
{
  const http = require('http');
  const LABH = SPIRIT.requireScript('spirit/testicle/headLessChrome/script.js');
  const RUNNER = path.join(RUN, 'spirit', 'testicle', 'run', 'node', 'script.js');
  const SCRIPTS = ['spirit/app/backup/api.js', 'spirit/app/chat/api.js'];
  const H = { node: null, proxy: null, base: '', reached: 0, out: '', bodies: '' };
  test.after(async function () {
    try { if (H.proxy) H.proxy.close(); } catch (e) { /* closed */ }
    try { if (H.node && H.node.child) H.node.child.kill(); } catch (e) { /* gone */ }
    try { if (H.node && typeof H.node.release === 'function') await H.node.release(); } catch (e) { /* freed as this process ends */ }
  });
  test.run('a scratch node comes up with an address in front of it that counts what reaches it', 0.2, async function () {
    H.node = await LABH.scratchNode();
    if (!H.node.up) return false;
    H.proxy = http.createServer(function (req, res) {
      H.reached += 1;
      const chunks = [];
      req.on('data', function (c) { chunks.push(c); });
      req.on('end', function () {
        const body = Buffer.concat(chunks);
        H.bodies += req.url + ' ' + body.toString('utf8') + '\n';
        fetch(H.node.base + req.url, { method: req.method, headers: { 'content-type': req.headers['content-type'] || 'application/json' }, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body })
          .then(function (r) { return r.arrayBuffer().then(function (b) { res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/json' }); res.end(Buffer.from(b)); }); })
          .catch(function () { res.writeHead(502); res.end(); });
      });
    });
    await new Promise(function (r) { H.proxy.listen(0, '127.0.0.1', r); });
    H.base = 'http://127.0.0.1:' + H.proxy.address().port;
    return true;
  }, test.limit.slow);
  test.run('the rule is run on two scripts in two branches, handed that node as testicle hands one', 0.2, async function () {
    if (!H.base) return false;
    const env = Object.assign({}, process.env, { SPIRIT_MOUNT_BASE: H.base, SPIRIT_MOUNT_RUN: H.node.run, SPIRIT_RULE_MODULES: 'spirit/testicle/general/any/branchRules' });
    H.out = await new Promise(function (resolve) {
      const kid = require('child_process').spawn(process.execPath, [RUNNER].concat(SCRIPTS), { cwd: RUN, env: env, stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      kid.stdout.on('data', function (d) { out += d; });
      kid.stderr.on('data', function (d) { out += d; });
      const timer = setTimeout(function () { try { kid.kill(); } catch (e) { /* gone */ } }, 280000);
      kid.on('exit', function () { clearTimeout(timer); resolve(out); });
    });
    return /Test completed/.test(H.out) || false;
  }, test.limit.long);
  test.run('the scratch node of each script\'s run comes up', 0.4, function () {
    const up = H.out.split('\n').filter(function (l) { return /a scratch node comes up for this suite ✅\s*$/.test(l); }).length;
    return up === SCRIPTS.length || false;
  }, test.limit.quick);
  // Each script's own: a run where the first used the handed node and the second booted its own would still have reached it
  // (cw's review), so each branch must be named in what reached it, backup's calls and chat's. Each named by its id, its
  // folder in dots, spirit.app.backup (goal/G49.19).
  test.run('each script uses the node it is handed, so calls naming spirit.app.backup and calls naming spirit.app.chat both reach it', 0.8, function () {
    const named = ['spirit.app.backup', 'spirit.app.chat'].filter(function (b) { return new RegExp('"' + b.split('.').join('\\.') + '[".]').test(H.bodies); });
    return named.length === 2 || false;
  }, test.limit.quick);
}
