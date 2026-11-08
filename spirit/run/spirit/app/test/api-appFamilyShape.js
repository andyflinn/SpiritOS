'use strict';

// spirit/run/spirit/app/test/api-appFamilyShape.js
// AN APP'S FAMILY AT ITS TOP, AND WHAT STILL ASKED THE FAMILY FS (goal/G43.27, requirements 1-4 and 6-8; spec:
// ./api-appFamilyShape.md). Andy: "spirit/app/<name>/ folders are now ALMOST the same shape as spirit/jobs/ and other system
// api-branches, EXCEPT, api.js sits in a folder ./api.js", "i think the shape needs alignment.". The tree read as it is,
// comments stripped; the node's answers from a scratch node (headLessChrome.scratchNode), never a live one.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const H = require(path.join(RUN, 'test', 'headLessChrome.js'));
// The tree before the move: the commit the red was written on, which holds spirit/app/agent/api/api.js.
const BASE = '8baa09c3';
const SELF = /spirit\/app\/test\/api-appFamilyShape\.(js|md)$/;

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
function code(text) { return String(text).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); }
// Line ends aside: a Windows checkout (autocrlf) holds CRLF where git holds LF.
function read(rel) { const f = path.join(RUN, rel); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : ''; }

test.startTest('api-appFamilyShape.js: an app\'s family at its top, as spirit/<family>/ has it; the family FS no longer asked (goal/G43.27)');

(async function () {
  test.subHeading('the world');
  const was = execSync('git show ' + BASE + ':spirit/run/spirit/app/agent/api/api.js', { cwd: REPO, encoding: 'utf8' });
  const VERBS = ['provider', 'model', 'persona', 'job'];
  ok(VERBS.every(function (v) { return new RegExp('\\n\\s+' + v + ':').test(was); }), 'the world: at ' + BASE + ' spirit/app/agent/api/api.js declares provider, model, persona and job', 'the agent\'s api.js at ' + BASE + ' is not as read: nothing to compare with');
  const tracked = execSync('git ls-files', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean).filter(function (f) { return fs.existsSync(path.join(REPO, f)); });
  ok(tracked.length > 100, 'the world: ' + tracked.length + ' tracked files on disk are read', 'only ' + tracked.length + ' tracked files read: nothing judged');

  test.subHeading('1. the agent\'s family at the app\'s top');
  const top = path.join(RUN, 'spirit', 'app', 'agent', 'api.js');
  let verbs = [];
  try { delete require.cache[top]; verbs = Object.keys(require(top).verbs || {}); } catch (e) { verbs = []; }
  ok(tracked.indexOf('spirit/run/spirit/app/agent/api.js') !== -1 && JSON.stringify(verbs) === JSON.stringify(VERBS), 'spirit/app/agent/api.js is there, in git, with provider, model, persona and job', 'spirit/app/agent/api.js: in git ' + (tracked.indexOf('spirit/run/spirit/app/agent/api.js') !== -1) + ', verbs ' + short(verbs));
  ok(!fs.existsSync(path.join(RUN, 'spirit', 'app', 'agent', 'api')), 'spirit/app/agent/api/ is gone', 'spirit/app/agent/api/ is still there');
  const sub = tracked.filter(function (f) { return /^spirit\/run\/spirit\/app\/[^/]+\/api\//.test(f); });
  ok(!sub.length, 'no app keeps an ./api/ folder', sub.length + ' files still sit in one: ' + short(sub));

  test.subHeading('3. one <verb>.json for each of the agent\'s verbs, as spirit/jobs/ has');
  ok(fs.existsSync(path.join(RUN, 'spirit', 'jobs', 'get.json')), 'the world: spirit/jobs/get.json is the shape', 'no spirit/jobs/get.json to compare with');
  VERBS.forEach(function (v) {
    let d = null;
    try { d = JSON.parse(read('spirit/app/agent/' + v + '.json')); } catch (e) { d = null; }
    ok(!!d && typeof d.description === 'string' && d.description.trim().length > 0, 'spirit/app/agent/' + v + '.json describes ' + v, 'spirit/app/agent/' + v + '.json: ' + (d ? 'no description' : 'not there, or no json'));
  });

  test.subHeading('2. the node finds it there');
  // A scratch node, the agent app switched on (the owner's app.active), so the node starts its server and serves its family.
  const node = await H.scratchNode();
  ok(!!node.up, 'the world: a scratch node is up', 'the scratch node did not come up: nothing judged');
  const ask = function (call, args) {
    return fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) })
      .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }, function () { return { status: r.status, body: null }; }); }, function (e) { return { status: 0, body: String(e) }; });
  };
  const on = node.up ? await ask('app.active', { key: 'agent', active: true }) : { status: 0 };
  ok(on.status === 200, 'the world: the agent app is switched on', 'app.active agent answered ' + short(on));
  let fam = { status: 0 };
  await H.until(function () { return ask('api', { family: 'agent' }).then(function (a) { fam = a; return a.status === 200; }); }, 30000);
  const iface = fam.body && typeof fam.body.interface === 'string' ? fam.body.interface.replace(/\r\n/g, '\n') : '';
  ok(fam.status === 200 && iface.length > 0, 'the world: the node serves the agent\'s interface', 'api {family: agent} answered ' + short(fam));
  ok(iface && iface === read('spirit/app/agent/api.js'), 'the interface the node serves is spirit/app/agent/api.js', 'the interface served is not spirit/app/agent/api.js (' + (read('spirit/app/agent/api.js') ? 'it differs' : 'there is no such file') + ')');
  // Its server answers once it has started.
  let where = { status: 0 };
  await H.until(function () { return ask('agent.FS.path', { path: 'api.js' }).then(function (a) { where = a; return a.status !== 503; }); }, 30000);
  ok(where.status === 200 && where.body && where.body.path === 'spirit/app/agent/api.js', 'the agent family\'s folder is the app folder: FS.path names spirit/app/agent/api.js', 'agent.FS.path answered ' + short(where));
  // ON A REAL PAGE (requirement 6): every family the node names whose data.js is in the tree is loaded by
  // spirit.cacheManager, an app's and a system family's alike, also where an app has a system family's name (contact).
  const chrome = H.findChrome();
  const page = chrome && node.up ? await H.chromePage(chrome) : null;
  let loaded = null;
  if (page && !page.error) {
    await page.send('Page.navigate', { url: node.base + '/' });
    await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)'); }, 30000);
    loaded = await page.evaluate("Promise.resolve(window.spirit.ready).then(function (s) { return s.tree(); }).then(function (t) { return Promise.all(Object.keys(t || {}).map(function (n) { return window.spirit.cacheManager(n).then(function () { return [n, 'ok']; }, function (e) { return [n, String((e && e.message) || e)]; }); })); })");
  }
  const withData = function (n) { return ['spirit/' + n + '/data.js', 'spirit/app/' + n + '/data.js', 'process/js/' + n + '/data.js'].some(function (p) { return fs.existsSync(path.join(RUN, p)); }); };
  const judged = (loaded || []).filter(function (r) { return withData(r[0]); });
  ok(judged.length >= 5 && judged.some(function (r) { return r[0] === 'contact'; }), 'the world: a page asks the cache of ' + judged.length + ' families with a data.js, contact among them', 'a page asked ' + short(loaded) + ': nothing judged');
  judged.forEach(function (r) { ok(r[1] === 'ok', 'on a page, spirit.cacheManager("' + r[0] + '") loads its data.js', 'on a page, spirit.cacheManager("' + r[0] + '"): ' + r[1]); });
  if (page && page.kid) page.kid.kill();
  if (node.child) node.child.kill();

  test.subHeading('4. no file names spirit/app/agent/api/');
  const naming = tracked.filter(function (f) { return !SELF.test(f) && f.indexOf('spirit/run/spirit/app/desk/currentGoal.json') !== 0 && /\.(js|md|json|html|txt)$/.test(f); })
    .filter(function (f) { return /spirit\/app\/agent\/api\/|app\/agent\/api\b(?!\.js)|'agent', 'api'/.test(fs.readFileSync(path.join(REPO, f), 'utf8')); });
  ok(!naming.length, 'no file names spirit/app/agent/api/', naming.length + ' still do: ' + short(naming));

  test.subHeading('6. a page finds a family\'s data.js by the folder shape, never by FS.path');
  const sj = code(read('spirit/spirit.js'));
  ok(sj.length > 1000 && /function cacheManager/.test(sj), 'the world: spirit.js and its cacheManager are read', 'no cacheManager in spirit.js: nothing judged');
  const cm = (sj.match(/function cacheManager[\s\S]*?\n  }\n/) || [''])[0];
  ok(cm && !/FS\.path|\.FS\b/.test(cm), 'cacheManager asks no FS.path, on a page or in node', 'cacheManager still asks the family\'s FS: ' + short((cm.match(/.*FS.*/) || [''])[0].trim()));
  ok(!/\.FS\.path\s*\(|FS\.path\b/.test(sj), 'spirit.js asks FS.path nowhere', 'spirit.js still asks FS.path');

  test.subHeading('7. no warning on a grant');
  ok(!fs.existsSync(path.join(RUN, 'spirit', 'auth', 'grant.warning.txt')), 'spirit/auth/grant.warning.txt is gone', 'spirit/auth/grant.warning.txt is still there');
  const gp = code(read('spirit/element/grantsPanel.js'));
  ok(gp.length > 1000, 'the world: grantsPanel.js is read', 'no grantsPanel.js: nothing judged');
  ok(!/warning\.txt|\.FS\.loadFile/.test(gp), 'grantsPanel reads no <verb>.warning.txt', 'grantsPanel still reads one');
  const warns = tracked.filter(function (f) { return /\.warning\.txt$/.test(f); });
  ok(!warns.length, 'no <verb>.warning.txt is left', warns.length + ' are: ' + short(warns));

  test.subHeading('8. the agent\'s AGENTS.md through spirit.fs.loadFile at its path');
  const as = read('spirit/appServer.js');
  const block = (as.match(/AGENTS: AN APP'S RULES FOR AGENTS[\s\S]*?\n\n/) || [''])[0];
  ok(block.length > 100, 'the world: appServer.js\'s AGENTS paragraph is read', 'no AGENTS paragraph in appServer.js: nothing judged');
  ok(/spirit\.fs\.loadFile/.test(block) && !/family's FS|FS\.loadFile \{path: "AGENTS\.md"\}/.test(block), 'it says AGENTS.md is read with spirit.fs.loadFile at its path', 'it still says: ' + short((block.match(/.*FS.*/g) || []).join(' / ')));

  test.reportSuccessFailureCount();
  process.exit(0);
})();
