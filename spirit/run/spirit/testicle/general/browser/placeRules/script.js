'use strict';
// spirit/run/spirit/testicle/general/browser/placeRules/script.js
// A RULE MODULE OF THE -browser GENERAL TEST (goal/G49.27, step 2b; box v5, Andy's Go: "spirit/testicle/ is the faceless test
// system", the general rules become modules, one rule set one module). Its checks are the part "GIVEN NO FILE: THE TREE'S
// RULES, THEN EVERY PAGE MODULE" of the old -browser runner of spirit/test/ (every()), moved here unchanged in what they check
// and in their titles; its runner now, which loads this module and calls it, is spirit/testicle/run/browser/script.js, and the one this module runs again on each
// page script, a run of its own each (tools.runner). Its own test: ./test/script.js. A rule module hands out { appliesTo,
// resource, own, forbids, checks } (spirit/testicle/general/any/typeRules/script.js says each).
const SPIRIT = require('../../../../script.js');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
// The face's tag-run scripts, spirit.js's FACE list as spirit.js writes it.
const FACE_SCRIPTS = (function () {
  const m = /var FACE = \[([^\]]*)\]/.exec(fs.readFileSync(path.join(RUN, 'spirit', 'script.js'), 'utf8'));
  return m ? (m[1].match(/'[^']+'/g) || []).map(function (q) { return q.slice(1, -1); }) : [];
}());
const VENDORED_FOLDERS = SPIRIT.requireScript('spirit/fs/fileSystem/script.js').VENDORED_FOLDERS;

// The tree's rules: judged given no file, never for one file handed (the page rules judge that one, ../pageRules/script.js).
function appliesTo(scriptPath) {
  return !scriptPath;
}
// A PAGE SCRIPT IT JUDGES (goal/G47.1, box v121: "it judges the scripts scriptClassify says load in a page"; testicle hands it
// only those): known by its path alone, no code read; whether it installs an element the bare page says (session).
function pageScript(file) {
  const f = String(file || '');
  // A script the node never serves to a page (spirit/DEBUG/, spirit/server/, an app's server/) is no page script (goal/G49.23:
  // the system's own rule, fileServable, is asked; its pages were judged red on a 404).
  return /^spirit\/.+\.js$/.test(f) && !/(^|\/)test\//.test(f) && SERVABLE.fileServable(f);
}
const SERVABLE = SPIRIT.requireScript('spirit/fs/fileSystem/script.js');
// A NODE-ONLY SCRIPT, AS THE CLASSIFIER TELLS ONE (spirit/testicle/scriptClassify/script.js LACKS_NODE, goal/G47.1 box v94): its page load
// failed for want of node's own names or modules.
const LACKS_NODE = /answered 404|\b(require|process|module|exports|__dirname|__filename|Buffer|global) is not defined\b|Cannot find module|\bfs\b.*not defined/;
const WAIT = 20000;
// THE SERVERS ITS PAGES STAND ON, TURNED ON (goal/G41.28): the agent tables' pages draw the agent family's cache, which
// is there only while the agent server runs. Its owner turns it on; so does the scratch node, so its pages are judged
// as they are used, not refused: scratchNode turns it on by active in spirit/state/app/agent/node.json (spirit/job/engine/script.js).
const SERVERS = { servers: ['spirit.app.agent'] };
// The scratch node and headless Chrome, shared with any test that opens a page (spirit/testicle/headLessChrome/script.js).
const { until, findChrome, scratchNode, chromePage } = SPIRIT.requireScript('spirit/testicle/headLessChrome/script.js');
// Every product script of the run judged (tools.run, the tree; a test hands a planted one), vendored code left out.
function productScripts(run) {
  return require('child_process').execFileSync('git', ['ls-files'], { cwd: run, encoding: 'utf8' }).split('\n')
    .filter(function (f) { return /^spirit\/.+\.js$/.test(f) && !/(^|\/)test\//.test(f) && !VENDORED_FOLDERS.holds(f) && fs.existsSync(path.join(run, f)); });
}
// EVERY PRODUCT SCRIPT, PLACED WHERE IT IS REQUIRED (goal/G43.32, the box, testing point 3; Andy: "a general test for
// any scriptFile.js is to spirit.requireScript() it.", Q5: "doesn't spirit.requireScript() only load a script, store it at
// spirit.required.<path>  and run it once.", "element scripts themselves are who installs the element factory at
// spirit.required.<path-of-element-script>", and "I'm NOT demanding that all scripts load in all environments, I'm
// demanding that they're placed in the spirit object according to these rules IF they are required."). Each script is
// spirit.requireScript()d alone on the node and on a page; where it loads, it stands at its path on the spirit object (goal/G49.23), and on
// the node the answer came at once. Where it does not load (a page element on the node, a server on a page) nothing is
// judged. An element script (isElementScript below) has a factory with a create at its path once
// required on a page. The node side runs in the scratch copy beside the scratch node, each script in a
// process of its own; the page side on the scratch node's face page, a fresh page each. Never Andy's tree or node.
// A path's place on the spirit object itself (goal/G49.23, no spirit.required): its first key spirit the object, a folder's
// script.js at its folder's own name (goal/G49.9), spirit/fs/script.js at spirit.fs.
function placeKeys(rel) { const k = rel.replace(/\.js$/, '').split('/'); if (k.length > 1 && k[k.length - 1] === 'script') k.pop(); return k.slice(1); }
// AN ELEMENT SCRIPT, BY ITS PLACE AND ITS EXPORTS (goal/G49.23: the loader places a script's module.exports, goal/G49.9): a
// script under spirit/element/, or an app's element.js or under its element/, whose module.exports has a create: what
// spirit.requireScript answered for it on the page (r.answered below).
const ELEMENT_PLACE = /^spirit\/(?:element\/|app\/.+\/element(?:\/|\.js$))/;
function isElementScript(rel, r) { return ELEMENT_PLACE.test(String(rel || '')) && !!r && r.answered === true; }
// True when no rule broke.
function listed(bad) { return !bad.length; }

// ── GIVEN NO FILE: THE TREE'S RULES, THEN EVERY PAGE MODULE ─────────────────────────────────────────────────────────────
function every(tools) {
  const test = tools.test;
  const E = {};

  // The page modules in its reach, and the one scratch node they are judged on.
  test.run('testModule.js gives it files to judge', 0.2, function () {
    const reach = SPIRIT.requireScript('spirit/testicle/testModule/script.js').testsFor('').filter(function (t) { return t.test === 'spirit/testicle/run/browser/script.js' && t.file; }).map(function (t) { return t.file; });
    // Every page script in its reach, each judged by its own page (goal/G47.1, box v121: no code reading).
    E.files2 = reach.filter(pageScript);
    return E.files2.length > 0 || false;
  }, test.limit.quick);
  test.run('a scratch node comes up with its DEBUG on', 0.2, async function () {
    E.node = await scratchNode(Object.assign({ shared: true, before: tools.before }, SERVERS));
    return (E.node.up && E.node.debug) || false;
  }, test.limit.slow);
  const nodeUp = function () { return !!E.node && E.node.up && E.node.debug; };

  // every product script, placed on the spirit object where it is required
  test.run('there are product scripts to require, each alone, on the node and on a page', 0.2, function () {
    E.req = productScripts(tools.run).filter(function (f) { return f !== 'spirit/script.js'; });
    return E.req.length > 100 || false;
  }, test.limit.quick);
  test.run('some of the product scripts load on a page', 0.2, async function () {
    if (!nodeUp()) return false;
    const chrome = findChrome();
    if (!chrome) return false;
    const page = E.page = await chromePage(chrome);
    if (!page || page.error) return false;
    E.pageLoaded = []; E.pageBad = []; E.noFactory = []; E.nodeOnly = [];
    E.elements = [];
    for (const f of E.req) {
      await page.send('Page.navigate', { url: E.node.base + '/' });
      await until(function () { return page.evaluate('!!(window.spirit && window.spirit.readyPromise)').then(Boolean); }, WAIT);
      const keys = JSON.stringify(placeKeys(f));
      // goal/G49.23: what requireScript answered (its module.exports) told apart from what stands at its place.
      const got = await page.evaluate('window.spirit.readyPromise.then(function () { window.pageErrors = []; window.addEventListener("error", function (e) { window.pageErrors.push(String((e && e.message) || "error")); }); return spirit.requireScript(' + JSON.stringify(f) + '); })' +
        '.then(function (ans) { var k = ' + keys + '; var at = function (root) { return k.reduce(function (o, x) { return o == null ? undefined : o[x]; }, root); };' +
        ' var el = at(spirit); return JSON.stringify({ why: (window.pageErrors || []).join("; "), err: (window.pageErrors || []).length > 0, placed: at(spirit) !== undefined, factory: !!el && typeof el.create === "function", answered: !!ans && typeof ans.create === "function", same: el === ans }); },' +
        ' function (e) { return JSON.stringify({ why: String((e && e.message) || e), err: true, placed: false, factory: false, answered: false, same: false }); })');
      let r = null; try { r = JSON.parse(got); } catch (e) { r = { err: true, placed: false, factory: false, answered: false, same: false }; }
      if (r.err) { if (LACKS_NODE.test(String(r.why || ''))) E.nodeOnly.push(f); continue; }
      E.pageLoaded.push(f);
      // THE FACE'S OWN SCRIPTS, RUN BY A TAG (goal/G49.23; Andy: "boot.js MUST be an exception to the rules"): the ones spirit.js
      // injects itself as its FACE list are run by their tag, not required, so nothing asks them for anything and the loader
      // places none; the list is spirit.js's own, read from it, never named here.
      if (!r.placed && FACE_SCRIPTS.indexOf(f) === -1) E.pageBad.push(f);
      if (isElementScript(f, r)) { E.elements.push(f); if (!r.factory || !r.same) E.noFactory.push(f); }
    }
    try { if (page.kid) page.kid.kill(); } catch (e) { /* gone */ }
    try { if (page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    return E.pageLoaded.length > 0 || false;
  }, test.limit.long);
  test.run('every product script that loads on a page stands on the spirit object under its own path', 0.4, function () {
    if (!E.pageLoaded) return false;
    return (E.pageLoaded.length > 0 && !E.pageBad.length) || false;
  }, test.limit.quick);
  test.run('every element script\'s module.exports, a factory with a create, stands on the spirit object under its own path', 0.4, function () {
    if (!E.pageLoaded) return false;
    return (E.elements.length > 0 && !E.noFactory.length) || false;
  }, test.limit.quick);

  // Each page module in a run of its own, so each is recorded under its own module (spirit/testicle/testReport/script.js).
  test.run('its page is green', 0.4, async function () {
    if (!nodeUp()) return false;
    if (!E.files2 || !E.files2.length) return false;
    const red = [];
    // WHERE IT DOES NOT LOAD, NOTHING IS JUDGED (this file's rule, above; testicle hands it no node-only script): handed
    // nothing, its page is judged for every script but the node-only ones, a page load that failed for want of node's own
    // (LACKS_NODE, the classifier's rule).
    const onPage = (E.files2 || []).filter(function (f) { return (E.nodeOnly || []).indexOf(f) === -1; });
    if (!onPage.length) return false;
    for (const f of onPage) {
      const out = await new Promise(function (resolve) {
        const kid = spawn(process.execPath, [tools.runner, f], { cwd: RUN, env: Object.assign({}, process.env, { SPIRIT_MOUNT_BASE: E.node.base, SPIRIT_RULE_MODULES: 'spirit/testicle/general/browser/pageRules' }), stdio: ['ignore', 'pipe', 'pipe'] });
        let text = '';
        kid.stdout.on('data', function (d) { text += d; });
        kid.stderr.on('data', function (d) { text += d; });
        kid.on('close', function () { resolve(text); });
      });
      const greens = Number((/✅:(\d+)/.exec(out) || [])[1] || 0);
      const reds = Number((/❌:(\d+)/.exec(out) || [])[1] || 0);
      if (!(reds === 0 && greens > 0)) red.push(true);
    }
    return listed(red);
  }, test.limit.long);

  test.after(async function () {
    if (E.page) { try { if (E.page.kid) E.page.kid.kill(); } catch (e) { /* gone */ } }
    if (E.node) {
      // Its node stopped and its lab node freed, by the node's own release: it waits for the node to end, no fixed time.
      try { await E.node.release(); } catch (e) { /* freed when this process ends */ }
    }
  });
}

// checks(scriptPath, tools): tools { test, run, spirit, runner, before? }; given no file, the tree and every page module.
// tools.before(run), when handed, plants what a test needs in the scratch node's tree before it starts (scratchNode's o.before).
function checks(scriptPath, tools) {
  if (scriptPath) return;
  every(tools);
}

// The names its checks look for: none (goal/G49.27, Andy: "All, cw's way").
const FORBIDS_NAMES = [];
// Its node: the scratch node it asks (shared, the run's when one is handed), the agent server on (own false).
module.exports = { appliesTo: appliesTo, resource: 'browser', own: false, forbids: FORBIDS_NAMES, checks: checks };
