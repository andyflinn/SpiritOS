'use strict';
// spirit/run/spirit/testicle/run/browser/script.js [<script> ...]
// THE RUNNER OF THE RESOURCE browser (goal/G49.27, step 3; the box, Andy's Go: "one runner per resource starts it once and runs
// every module needing it, each pulled in by spirit.requireScript"; "all browser modules run in one runner: one Chrome, one
// scratch node, a fresh page and a fresh spirit object per module, never a Chrome per file"). Its contract: ./test/script.md.
//
// The rule modules are found as the none runner finds them (../none/script.js found: every folder of spirit/testicle/general/
// holding script.js, no central list); this one runs those whose resource is 'browser'. ONE NODE AND ONE CHROME FOR THE WHOLE
// RUN (goal/G47.1, box v144): booted side by side, before any module runs, as a step of their own (the box: "setup is its own
// timed step with its own limit: a node or Chrome that does not come up is red as that, by name"), with every app server the
// scripts handed need on (the agent's, and the app of each script whose manifest mounts one), and named to every module and
// every process they start (SPIRIT_MOUNT_BASE, SPIRIT_MOUNT_RUN, SPIRIT_CHROME_PORT): a module asking for a shared node
// (scratchNode({ shared: true })) and every page (chromePage) take them; each page module draws in a fresh page of that
// Chrome, with the page's own spirit object. What testicle hands its run is taken in place of booting either. A module with
// own: true (it turns servers on and apps active) starts a node of its own. Handed nothing, the tree's rules and every page
// script (placeRules, each page script then run through this file alone) and every app script; handed one script, its page
// drawn alone; handed several, each drawn in turn and judged the moment its page is done (tools.batch). Each module goes over
// every script before the next module starts: a module that draws pages draws them one after the other.
const SPIRIT = require('../../../script.js');
const fs = require('fs');
const path = require('path');
const NONE = SPIRIT.requireScript('spirit/testicle/run/none/script.js');
const H = SPIRIT.requireScript('spirit/testicle/headLessChrome/script.js');
const REPORTER = SPIRIT.requireScript('spirit/testicle/testReport/script.js');
const RUN = NONE.RUN;

// The servers the scripts handed stand on, by their ids, an app's folder in dots (goal/G49.19): the agent's, and each app's
// whose manifest mounts a server.
function serversFor(given) {
  const mounted = function (name) {
    try { const m = JSON.parse(fs.readFileSync(path.join(RUN, 'spirit', 'app', name, name + '.json'), 'utf8')); return !!(m && m.node && m.node.mount === true) && fs.existsSync(path.join(RUN, 'spirit', 'app', name, name + '.js')); } catch (e) { return false; }
  };
  const servers = ['spirit.app.agent'];
  given.forEach(function (one) {
    const own = (/^spirit\/app\/([^/]+)\//.exec(one) || [])[1];
    const id = own ? SPIRIT.dottedPath('spirit/app/' + own) : '';
    if (own && mounted(own) && servers.indexOf(id) === -1) servers.push(id);
  });
  return servers;
}
// The run's one node, its servers each answering its interface before any page is drawn: true when it came up.
async function bootNode(W, servers, scratch) {
  W.node = await (scratch || H.scratchNode)({ shared: true, servers: servers });
  if (!(W.node && W.node.up && W.node.debug)) return false;
  const answers = await Promise.all(servers.map(function (name) {
    return H.until(function () {
      return fetch(W.node.base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'api', args: { branch: name } }) })
        .then(function (r) { return r.json(); }).then(function (b) { return !!(b && b.interface); }, function () { return false; });
    }, 30000);
  }));
  return answers.every(Boolean);
}
// The run's one Chrome: the one handed, or one started here; true when it answers.
async function bootChrome(W, find, share) {
  if (process.env.SPIRIT_CHROME_PORT) return true;
  const found = (find || H.findChrome)();
  if (!found) return false;
  W.chrome = await (share || H.sharedChrome)(found);
  return !!W.chrome && !W.chrome.error;
}

// main(argv, opts): the run. opts, for its own test: { list, the modules as found() gives them; test, the reporter; scratch,
// what starts the node; find and share, what finds and starts the Chrome }; by default the modules found, testReport,
// scratchNode, findChrome and sharedChrome.
async function main(argv, opts) {
  const o = opts || {};
  const test = o.test || REPORTER;
  const list = o.list || NONE.found();
  const given = NONE.givenOf(argv);
  const W = { node: null, chrome: null };
  // What every module is handed: the reporter, the run root, its spirit object, the run's one node, every module's forbids,
  // this file (placeRules runs a page script alone through it) and whether the scripts are drawn in a batch.
  const tools = { test: test, run: RUN, spirit: SPIRIT, node: W, forbids: NONE.forbidsOf(list), runner: __filename, batch: given.length > 1 };
  test.hold();
  // The node only when a module that shares it applies (a module with own: true starts its own); the Chrome when any does.
  const wantNode = NONE.needed('browser', list, given, false);
  if (NONE.needed('browser', list, given)) {
    const up = await Promise.all([
      wantNode ? NONE.timed(function () { return bootNode(W, serversFor(given), o.scratch); }, test.limit.slow) : Promise.resolve(null),
      NONE.timed(function () { return bootChrome(W, o.find, o.share); }, test.limit.slow),
    ]);
    if (up[0]) { process.env.SPIRIT_MOUNT_BASE = W.node.base; process.env.SPIRIT_MOUNT_RUN = W.node.run; }
    if (up[1] && W.chrome) process.env.SPIRIT_CHROME_PORT = String(W.chrome.port);
    if (wantNode) test.run('the shared scratch node comes up', 0.2, function () { return up[0] || false; }, test.limit.quick);
    test.run('the shared Chrome comes up', 0.2, function () { return up[1] || false; }, test.limit.quick);
  }
  await NONE.runModules('browser', list, given, tools, 'module');
  // After every module's own cleanup (registered as their checks ran): its Chrome closed, its node let go.
  test.after(async function () {
    try { if (W.chrome && W.chrome.close) W.chrome.close(); } catch (e) { /* gone */ }
    const n = W.node;
    if (n && !n.letGo && typeof n.release === 'function') { n.letGo = true; try { await n.release(); } catch (e) { /* freed when this process ends */ } }
  });
  test.release();
}

module.exports = { main: main, serversFor: serversFor, bootNode: bootNode, bootChrome: bootChrome };

if (require.main === module) main(process.argv.slice(2));
