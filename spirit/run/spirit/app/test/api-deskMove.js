'use strict';

// spirit/run/spirit/app/test/api-deskMove.js
// DESK MOVES TO spirit/app/desk/ (goal/G43.27, requirements 11-21; spec: ./api-deskMove.md). Andy: "if desk can become
// spirit/api/desk/ in the same item, leaving deskVerify and deskClient where they are, with minor modifications, then i'll
// give it a go.", "yes, i meant: spirit/app/desk/", "desk is NOT intrinsic.". The tree read as it is, comments stripped where
// code is judged; desk run on a scratch node (headLessChrome.scratchNode), never a live one.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const H = require(path.join(RUN, 'test', 'headLessChrome.js'));
// The tree before the move: the commit the red was written on, which holds process/js/desk/.
const BASE = '8baa09c3';
const OLD = 'spirit/run/process/js/desk/';
const NEW = 'spirit/run/spirit/app/desk/';
const SELF = /spirit\/app\/test\/api-deskMove\.(js|md)$/;

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
function code(text) { return String(text).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); }
// Line ends aside: a Windows checkout (autocrlf) holds CRLF where git holds LF.
function read(rel) { const f = path.join(REPO, rel); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : ''; }

test.startTest('api-deskMove.js: desk in spirit/app/desk/, its family at its top, an app that is not intrinsic (goal/G43.27)');

(async function () {
  test.subHeading('the world');
  const before = execSync('git ls-tree -r --name-only ' + BASE + ' -- ' + OLD, { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
  const verbFiles = before.filter(function (f) { return /\/family\/[a-z][\w.]*\.json$/.test(f); });
  ok(before.indexOf(OLD + 'desk.js') !== -1 && verbFiles.length > 25, 'the world: at ' + BASE + ' process/js/desk/ holds desk.js and ' + verbFiles.length + ' verb files', BASE + ' holds ' + before.length + ' files there: nothing to compare with');
  const tracked = execSync('git ls-files', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean).filter(function (f) { return fs.existsSync(path.join(REPO, f)); });
  ok(tracked.length > 100, 'the world: ' + tracked.length + ' tracked files on disk are read', 'only ' + tracked.length + ' tracked files read: nothing judged');
  const has = function (f) { return tracked.indexOf(f) !== -1; };

  test.subHeading('11. the server in spirit/app/desk/, its family at its top');
  ['desk.js', 'desk.json', 'api.js', 'data.js', 'cacheRules.js'].forEach(function (n) {
    ok(has(NEW + n), NEW.replace('spirit/run/', '') + n + ' is there, in git', NEW.replace('spirit/run/', '') + n + ' is not');
  });
  const lostVerbs = verbFiles.map(function (f) { return f.replace(/^.*\/family\//, ''); }).filter(function (n) { return !has(NEW + n); });
  ok(!lostVerbs.length, 'all ' + verbFiles.length + ' verb files sit beside desk.js', lostVerbs.length + ' are not in spirit/app/desk/: ' + short(lostVerbs));
  ok(!fs.existsSync(path.join(RUN, 'process', 'js', 'desk')) && !tracked.some(function (f) { return f.indexOf(OLD) === 0; }), 'process/js/desk/ is gone, its family/ with it', 'process/js/desk/ is still there');
  const deskDir = path.join(RUN, 'spirit', 'app', 'desk');
  ok(fs.existsSync(deskDir) && !fs.existsSync(path.join(deskDir, 'family')), 'spirit/app/desk/ has no family/ folder', fs.existsSync(deskDir) ? 'spirit/app/desk/family/ is there' : 'no spirit/app/desk/ to judge');

  test.subHeading('12. the tools and the product tests move with it');
  ['deskAgentEar.js', 'deskLoop.js', 'goalShare.js', 'currentGoal.json', 'deskBundles.json', 'rules.md', 'deskLoopManual.md'].forEach(function (n) {
    ok(has(NEW + n), 'spirit/app/desk/' + n + ' is there, in git', 'spirit/app/desk/' + n + ' is not');
  });
  const tests = before.filter(function (f) { return f.indexOf(OLD + 'test/') === 0; });
  // commitCheck and commitHooks went with the git hooks (Andy, goal/G43.27: "all, just get rid of the fucking git hooks.").
  const GONE = /^test\/(commitCheck|commitHooks)\.(js|md)$/;
  // Two went by name with their module (goal/G43.27; Andy: "every test must be directly (by name) or indirectly (by general
  // rule) be associated with a production file").
  const RENAMED = { 'test/deskLoopReadTake': 'test/deskLoop-readTake', 'test/noPlugins': 'test/desk-noPlugins' };
  const named = function (n) { const m = n.match(/^(.+)\.(js|md)$/); return m && RENAMED[m[1]] ? RENAMED[m[1]] + '.' + m[2] : n; };
  const lostTests = tests.map(function (f) { return f.slice(OLD.length); }).filter(function (n) { return !GONE.test(n) && !has(NEW + named(n)); });
  ok(tests.length > 10 && !lostTests.length, 'its ' + tests.length + ' product tests sit in spirit/app/desk/test/', lostTests.length + ' of its ' + tests.length + ' tests are not there: ' + short(lostTests));

  test.subHeading('18, 19. desk.json in the spirit/app form, not intrinsic');
  let dj = null;
  try { dj = JSON.parse(read(NEW + 'desk.json')); } catch (e) { dj = null; }
  ok(!!dj && !!dj.identity && dj.identity.intrinsic === false, 'desk.json says intrinsic false', 'desk.json: ' + (dj ? 'identity ' + short(dj.identity) : 'not there, or no json'));
  ok(!!dj && !!dj.node && dj.node.mount === true, 'desk.json says node.mount true', 'desk.json node: ' + short(dj && dj.node));
  const args = dj ? JSON.stringify(dj).match(/goalRepo|goalPath/g) || [] : [];
  ok(args.indexOf('goalRepo') !== -1 && args.indexOf('goalPath') !== -1, 'its two args, goalRepo and goalPath, are carried over', 'desk.json names ' + short(args));
  ok(!!dj && JSON.stringify(dj).indexOf('spirit/run/spirit/app/desk/currentGoal.json') !== -1, 'goalPath\'s default is spirit/run/spirit/app/desk/currentGoal.json', 'desk.json has no such default');
  ok(!!dj && JSON.stringify(dj).indexOf('spirit/state/desk/data/') !== -1 && JSON.stringify(dj).indexOf('relay-state/process/desk') === -1, 'desk.json says desk keeps its state in spirit/state/desk/data/', 'desk.json does not say so');
  const fsm = require(path.join(RUN, 'spirit', 'fileSystem.js'));
  ok(has(NEW + 'desk.js') && fsm.fileWritable('spirit/app/desk/desk.js') === true, 'not core: spirit/app/desk/desk.js is written without a grant', has(NEW + 'desk.js') ? 'spirit/app/desk/desk.js is core (fileWritable false)' : 'no spirit/app/desk/desk.js to judge');

  test.subHeading('14. deskClient finds desk by its new place');
  const dc = code(read('spirit/run/process/js/deskClient/deskClient.js'));
  ok(dc.length > 1000, 'the world: deskClient.js is read', 'no deskClient.js: nothing judged');
  ok(!/familyPath\(\s*['"]desk['"]\s*\)/.test(dc) && /spirit\/app\/desk\/api\.js/.test(dc), 'deskClient requires spirit/app/desk/api.js, not familyPath("desk")', 'deskClient: familyPath("desk") ' + /familyPath\(\s*['"]desk['"]\s*\)/.test(dc) + ', names spirit/app/desk/api.js ' + /spirit\/app\/desk\/api\.js/.test(dc));
  const streamAt = (dc.match(/stream:\s*\{\s*module:\s*['"]([^'"]+)['"]/) || [])[1] || '';
  ok(!!streamAt && streamAt !== 'process/js/desk', 'deskClient subscribes to desk\'s stream under a new module name (' + streamAt + ')', 'deskClient subscribes under ' + short(streamAt || 'nothing found'));

  test.subHeading('21. Desk works: the node starts it from spirit/app/desk/');
  const node = await H.scratchNode();
  ok(!!node.up, 'the world: a scratch node is up', 'the scratch node did not come up: nothing judged');
  const ask = function (call, a) {
    return fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: a || {} }) })
      .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }, function () { return { status: r.status, body: null }; }); }, function (e) { return { status: 0, body: String(e) }; });
  };
  const on = node.up ? await ask('app.active', { key: 'desk', active: true }) : { status: 0 };
  ok(on.status === 200, 'desk is an app the owner switches on (app.active desk)', 'app.active desk answered ' + short(on));
  let items = { status: 0 };
  await H.until(function () { return ask('desk.items.search', { text: '', currentGoalOnly: false, goalsOnly: false, includeClosed: false }).then(function (a) { items = a; return a.status === 200; }); }, on.status === 200 ? 40000 : 1000);
  ok(items.status === 200 && items.body && Array.isArray(items.body.items), 'desk answers on the node: desk.items.search lists items', 'desk.items.search answered ' + short(items));
  let where = { status: 0 };
  if (items.status === 200) where = await ask('desk.FS.path', { path: 'api.js' });
  ok(where.status === 200 && where.body && where.body.path === 'spirit/app/desk/api.js', 'its family is the app folder: spirit/app/desk/api.js', 'desk.FS.path answered ' + short(where));
  // The module the node files desk's job under is the name deskClient subscribes to.
  const found = items.status === 200 ? await ask('jobs.search', { q: 'desk' }) : { body: {} };
  const keys = ((found.body || {}).items || []).map(function (i) { return i.key; });
  let mod = '';
  for (const k of keys) { const j = await ask('jobs.get', { key: k }); const job = (j.body || {}).job || {}; if (/desk/.test(String(job.module || job.app || '')) && !/deskVerify|deskClient/.test(String(job.module || ''))) { mod = String(job.module || ''); break; } }
  ok(!!mod && mod === streamAt, 'the node files desk\'s job under ' + mod + ', the name deskClient subscribes to', 'desk\'s job module ' + short(mod || 'not found') + ', deskClient subscribes to ' + short(streamAt));
  ok(node.root && fs.existsSync(path.join(node.root, 'spirit', 'run', 'spirit', 'state', 'desk', 'data', 'desk.db')), '13. its state is where it was: spirit/state/desk/data/desk.db', 'no spirit/state/desk/data/desk.db on the scratch node');
  if (node.child) node.child.kill();

  test.subHeading('16, 17. no file names process/js/desk any more');
  const naming = tracked.filter(function (f) { return !SELF.test(f) && !/(^|\/)currentGoal\.json$/.test(f) && !/\.(png|jpe?g|gif|ico|db)$/.test(f) && f.indexOf('spirit/run/brains/') !== 0; })
    .filter(function (f) { return /process\/js\/desk\b(?!Client|Verify)|'js', 'desk'/.test(fs.readFileSync(path.join(REPO, f), 'utf8')); });
  ok(!naming.length, 'no tracked file names process/js/desk (the listener\'s path, the Desk page\'s own)', naming.length + ' still do: ' + short(naming));
  ok(!has(NEW + 'commitCheck.js'), 'no commitCheck.js: the git hooks are gone', 'spirit/app/desk/commitCheck.js is still there');

  // 22 (box v10; Andy: "just throw desk elements into spirit/app/desk/element/"): shell/desk and shell/deskDetails, as they are.
  test.subHeading('22. the desk faces in spirit/app/desk/element/');
  const faces = execSync('git ls-tree -r --name-only ' + BASE + ' -- spirit/run/shell/desk spirit/run/shell/deskDetails', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter(function (f) { return !/\/test\//.test(f); });
  ok(faces.indexOf('spirit/run/shell/desk/desk.js') !== -1 && faces.indexOf('spirit/run/shell/deskDetails/deskDetails.js') !== -1, 'the world: at ' + BASE + ' shell/desk/ and shell/deskDetails/ hold ' + faces.length + ' files', 'shell/desk and shell/deskDetails at ' + BASE + ': ' + short(faces));
  const inEl = tracked.filter(function (f) { return f.indexOf(NEW + 'element/') === 0; });
  faces.forEach(function (f) {
    const name = f.split('/').pop();
    ok(inEl.some(function (e) { return e.split('/').pop() === name; }), name + ' is in spirit/app/desk/element/', name + ' is not in spirit/app/desk/element/');
  });
  ok(!fs.existsSync(path.join(RUN, 'shell', 'desk')) && !fs.existsSync(path.join(RUN, 'shell', 'deskDetails')), 'shell/desk/ and shell/deskDetails/ are gone', 'shell/desk ' + fs.existsSync(path.join(RUN, 'shell', 'desk')) + ', shell/deskDetails ' + fs.existsSync(path.join(RUN, 'shell', 'deskDetails')));

  test.reportSuccessFailureCount();
  process.exit(0);
})();
