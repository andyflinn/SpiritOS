'use strict';

// spirit/run/spirit/test/spirit-familyFinder.js
// HOW A FAMILY IS FOUND BY ITS NAME (goal/G43.27; spec: ./spirit-familyFinder.md). Andy: "make sure there's a test for the module
// searching for api's that makes sure those rules are followed - less path elements get priority, - the target needs an
// api.js - and duplicate <name>/api.js raise a red.", and "spirit/app/contact/ does NOT have an api.js". The tree read as
// it is; the finding judged on a real page (headless Chrome) of a scratch node, folders planted into its copy that break
// each rule. Never a live node.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }

// Every family interface under a run folder, by its name: <name>/api.js where a family lives (spirit/<name>/,
// spirit/app/<name>/, process/js/<name>/ and its family/ folder).
function interfaces(run, files) {
  const by = {};
  files.forEach(function (f) {
    const m = /^spirit\/(?:app\/)?([^/]+)\/api\.js$/.exec(f) || /^process\/js\/([^/]+)\/(?:family\/)?api\.js$/.exec(f);
    if (!m || m[1] === 'app' && f === 'spirit/app/api.js') { if (f === 'spirit/app/api.js') (by.app = by.app || []).push(f); return; }
    (by[m[1]] = by[m[1]] || []).push(f);
  });
  return by;
}
function walk(dir, base, out) {
  (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []).forEach(function (e) {
    if (e.name === 'node_modules' || e.name === 'state' || e.name === '.git' || e.name === 'test') return;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out); else out.push(path.relative(base, p).split(path.sep).join('/'));
  });
  return out;
}

test.startTest('spirit-familyFinder.js: a family found by its name: the fewest path elements, an api.js there, no name twice (goal/G43.27)');

(async function () {
  test.subHeading('the world');
  const tracked = execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); }).map(function (f) { return f.slice('spirit/run/'.length); });
  const by = interfaces(RUN, tracked);
  ok(Object.keys(by).length >= 10 && by.contact && by.relay, 'the world: ' + Object.keys(by).length + ' family names with an api.js in the tree, contact and relay among them', 'only ' + short(Object.keys(by)) + ': nothing judged');
  ok(fs.existsSync(path.join(RUN, 'spirit', 'app', 'contact')) && !fs.existsSync(path.join(RUN, 'spirit', 'app', 'contact', 'api.js')), 'the world: spirit/app/contact/ is an app folder with no api.js (Andy: "spirit/app/contact/ does NOT have an api.js")', 'spirit/app/contact/ is not as Andy said');

  // That no branch's name has a second api.js in the tree is judged on each branch folder, as are an app's family found
  // where its api.js is and a page getting each branch's own data.js (./spirit-sibling-branchRules.js, goal/G43.32). Here,
  // the finder itself, on folders planted to break each rule.

  // A scratch node, then folders planted into its copy that break each rule.
  const node = await H.scratchNode();
  ok(!!node.up && !!node.root, 'the world: a scratch node is up, on its own copy of the tree', 'the scratch node did not come up: nothing judged');
  const sRun = node.root ? path.join(node.root, 'spirit', 'run') : '';
  function plant(rel, text) { const f = path.join(sRun, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); }
  const MARK = function (where) { return '(window.__planted = window.__planted || []).push(' + JSON.stringify(where) + ');\n'; };
  if (sRun) {
    // Rule 2: a folder of the name without api.js is never the target (spirit/app/contact/ has a data.js, no api.js).
    plant('spirit/app/contact/data.js', MARK('spirit/app/contact'));
    // Rule 1: the same name with an api.js one level deeper loses to spirit/relay/ (and is a duplicate, rule 3).
    plant('spirit/app/relay/api.js', 'module.exports = { verbs: {} };\n');
    plant('spirit/app/relay/data.js', MARK('spirit/app/relay'));
  }

  test.subHeading('3. a duplicate is seen');
  const planted = interfaces(sRun, walk(sRun, sRun, []));
  ok(!!planted.relay && planted.relay.length === 2, 'the check sees the planted second relay/api.js (spirit/relay/ and spirit/app/relay/)', 'the check saw ' + short(planted.relay));

  test.subHeading('1, 2. a page finds each family where the rules say');
  const page = node.up ? await H.chromePage(H.findChrome()) : null;
  let got = null;
  if (page && !page.error) {
    await page.send('Page.navigate', { url: node.base + '/' });
    await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)'); }, 30000);
    got = await page.evaluate("Promise.resolve(window.spirit.ready).then(function () { return Promise.all(['contact', 'relay'].map(function (n) { return window.spirit.cacheManager(n).then(function () { return [n, 'ok']; }, function (e) { return [n, String((e && e.message) || e)]; }); })); }).then(function (r) { return { said: r, planted: window.__planted || [] }; })");
  }
  ok(!!got, 'the world: the page asked contact and relay', 'the page asked nothing: ' + short(page && page.error));
  const asked = page ? page.heard.filter(function (m) { return m.method === 'Network.responseReceived'; }).map(function (m) { return { url: m.params.response.url.replace(node.base, '').replace(/^\//, ''), status: m.params.response.status }; }) : [];
  const fetched = function (p) { return asked.some(function (a) { return a.url === p && a.status === 200; }); };
  const said = {}; ((got && got.said) || []).forEach(function (r) { said[r[0]] = r[1]; });
  const ran = (got && got.planted) || [];
  ok(said.contact === 'ok' && fetched('spirit/contact/data.js') && ran.indexOf('spirit/app/contact') === -1, '2. contact is spirit/contact/: spirit/app/contact/ has no api.js, and its data.js never runs', 'contact: ' + short(said.contact) + ', spirit/contact/data.js fetched ' + fetched('spirit/contact/data.js') + ', the planted spirit/app/contact/data.js ran ' + (ran.indexOf('spirit/app/contact') !== -1));
  ok(said.relay === 'ok' && fetched('spirit/relay/data.js') && ran.indexOf('spirit/app/relay') === -1, '1. relay is spirit/relay/, the fewer path elements, over spirit/app/relay/', 'relay: ' + short(said.relay) + ', spirit/relay/data.js fetched ' + fetched('spirit/relay/data.js') + ', spirit/app/relay/data.js ran ' + (ran.indexOf('spirit/app/relay') !== -1));
  const missed = asked.filter(function (a) { return /(^|\/)data\.js$/.test(a.url) && a.status === 404; });
  ok(!missed.length, 'no data.js was asked that is not there (no 404)', missed.length + ' asked and missed: ' + short(missed));
  if (page && page.kid) page.kid.kill();
  if (node.child) node.child.kill();

  // goal/G43.20, its box: "a family is found as spirit/<name>/api.js or spirit/app/<name>/api.js, a job is named by its
  // route, and nothing falls back to process/js/<name>". In a process: the path spirit.familyPath gives is the family's own
  // api.js, a system family's in spirit/<name>/, an app's in spirit/app/<name>/, and none names process/js.
  test.subHeading('goal/G43.20: in a process, a family\'s path is its own api.js, and nothing falls back to process/js');
  const paths = JSON.parse(require('child_process').spawnSync(process.execPath, ['-e',
    "require('./spirit/spirit.js'); console.log(JSON.stringify({ fs: spirit.familyPath('fs'), desk: spirit.familyPath('desk'), agent: spirit.familyPath('agent'), none: spirit.familyPath('zzNoSuchFamily') }));"],
    { cwd: RUN, encoding: 'utf8' }).stdout || '{}');
  ok(paths.fs === 'spirit/fs/api.js', 'a system family\'s path is spirit/<name>/api.js: fs is spirit/fs/api.js', 'fs: ' + short(paths.fs));
  ok(paths.desk === 'spirit/app/desk/api.js' && paths.agent === 'spirit/app/agent/api.js', 'an app\'s path is spirit/app/<name>/api.js: desk and agent', 'desk: ' + short(paths.desk) + ', agent: ' + short(paths.agent));
  ok(Object.keys(paths).length === 4 && !/process\/js/.test(JSON.stringify(paths)), 'no path names process/js, a name of no family\'s included', 'paths: ' + short(paths));

  test.reportSuccessFailureCount();
  process.exit(0);
})();
