'use strict';

// spirit/run/spirit/test/dataFamilies.js
// The tests of goal/G43.7 (spec: ./dataFamilies.md). Andy, the box: "we rename it spirit/data.js and it IS the the spirit.data
// object", "ALL "clientCacheManager.js" files will be converted to "data.js" files with the SAME pattern." Every check is per
// family, so the count of what is owed falls as each family moves.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const H = require(path.join(RUN, 'test', 'headLessChrome.js'));
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;

// Andy on Q2: "yes, of course all 19". Q1: each under the family's own name.
const NODE_FAMILIES = ['app', 'auth', 'config', 'contact', 'events', 'fs', 'jobs', 'net', 'node', 'owner', 'peer', 'relay'];
const SERVER_FAMILIES = ['agent', 'backup', 'chatClerver', 'desk', 'deskClient', 'deskVerify', 'fileServer'];
const FAMILIES = NODE_FAMILIES.concat(SERVER_FAMILIES);
// Andy: "process/js/<name>/family/data.js needs to move to process/js/<name>/data.js"
const folderOf = function (name) { return NODE_FAMILIES.indexOf(name) !== -1 ? path.join(RUN, 'spirit', name) : (fs.existsSync(path.join(RUN, 'spirit', 'app', name)) ? path.join(RUN, 'spirit', 'app', name) : path.join(RUN, 'process', 'js', name)); };
// A scratch node does not offer these three to a page, so a page cannot load them; all 19 are judged in node as well.
const NOT_ON_SCRATCH = ['agent', 'chatClerver', 'deskClient'];
// The old spirit.<name>Data: chatData was chatClerver's, verifyData deskVerify's.
const OLD_READER = /(?:\b|\.)(?:agent|app|auth|backup|chat|chatClerver|config|contact|desk|deskClient|deskVerify|events|fileServer|fs|jobs|net|node|owner|peer|relay|verify)Data\b/;
// A retired name's parts, so this file does not hold it whole.
const OLD_MANAGER = 'clientCache' + 'Manager';
const OLD_MODULE = 'spirit' + 'Data';

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// Code only: a comment may quote Andy, and his words are never rewritten.
function code(text) { return String(text).split(/\r?\n/).map(function (l) { return l.replace(/(^|\s)\/\/.*$/, ''); }).join('\n'); }

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    const at = path.join(dir, e.name);
    if (VENDORED_FOLDERS.holds(at) || e.name === 'brains' || e.name === 'relay-state' || e.name === 'app-state' || e.name === 'state' || e.name === 'media' || e.name === 'published') return;
    if (e.isDirectory()) walk(at, out); else out.push(at);
  });
  return out;
}

test.startTest('spirit.data: every family at spirit.data.<name>, through spirit/data.js (goal/G43.7)');

(async function () {
  const files = walk(RUN, []);
  const rel = function (f) { return path.relative(RUN, f); };

  test.subHeading('the box: "we rename it spirit/data.js"');
  ok(fs.existsSync(path.join(RUN, 'spirit', 'data.js')), 'spirit/data.js stands', 'spirit/data.js is missing');
  ok(!fs.existsSync(path.join(RUN, 'spirit', OLD_MODULE + '.js')), 'the old module is gone', 'spirit/' + OLD_MODULE + '.js still stands');

  test.subHeading('the box: "ALL ... files will be converted to "data.js" files"');
  const pattern = {};
  FAMILIES.forEach(function (name) {
    const folder = folderOf(name);
    const file = path.join(folder, 'data.js');
    ok(fs.existsSync(file), name + ': has its data.js', name + ': no ' + rel(file));
    ok(!fs.existsSync(path.join(folder, OLD_MANAGER + '.js')), name + ': the old file is gone', name + ': ' + rel(path.join(folder, OLD_MANAGER + '.js')) + ' still stands');
    if (!fs.existsSync(file)) return;
    const text = code(fs.readFileSync(file, 'utf8'));
    // "using the module spirit/data.js": the guard, the attach and the write on spirit are its, not a family's.
    ok(!/Symbol\.for|function attach|\.spirit\s*=|spirit\.[A-Za-z]+Data\s*=/.test(text), name + ': rolls none of it by hand', name + ': data.js still rolls its own guard, attach or spirit write');
    const called = new RegExp('\\.([A-Za-z]+)\\(\\s*[\'"]' + name + '[\'"]').exec(text);
    if (called) pattern[name] = called[1];
  });
  test.subHeading('the box: "with the SAME pattern": one helper of spirit.data, called with the family\'s own name');
  const helpers = Object.keys(pattern).map(function (n) { return pattern[n]; }).filter(function (h, i, all) { return all.indexOf(h) === i; });
  ok(Object.keys(pattern).length === FAMILIES.length, 'all 19 call a helper with their own name', 'these do not: ' + FAMILIES.filter(function (n) { return !pattern[n]; }).join(', '));
  ok(helpers.length === 1, 'and it is the one helper: ' + helpers.join(), 'not one helper: ' + short(helpers));

  test.subHeading('the box: "instead of spirit.<name>Data": nothing in the tree\'s code says the old names');
  const offenders = { reader: [], manager: [], module: [] };
  files.filter(function (f) { return /\.(js|html)$/.test(f) && f !== __filename; }).forEach(function (f) {
    const text = code(fs.readFileSync(f, 'utf8'));
    if (OLD_READER.test(text)) offenders.reader.push(rel(f));
    if (text.indexOf(OLD_MANAGER) !== -1) offenders.manager.push(rel(f));
    if (text.indexOf(OLD_MODULE) !== -1) offenders.module.push(rel(f));
  });
  const say = function (l) { return l.length + ': ' + l.slice(0, 6).join(', ') + (l.length > 6 ? ', ...' : ''); };
  ok(!offenders.reader.length, 'no code reads a spirit.<name>Data', 'code that reads a spirit.<name>Data, ' + say(offenders.reader));
  ok(!offenders.manager.length, 'no code names ' + OLD_MANAGER, 'code that names ' + OLD_MANAGER + ', ' + say(offenders.manager));
  ok(!offenders.module.length, 'no code names ' + OLD_MODULE, 'code that names ' + OLD_MODULE + ', ' + say(offenders.module));

  test.subHeading('in node: each family\'s data.js stands at spirit.data.<name>, with data and cache');
  const inNode = require('child_process').spawnSync(process.execPath, ['-e', 'const D = require(' + JSON.stringify(path.join(RUN, 'spirit', 'data.js')) + '); const out = {};' +
    JSON.stringify(FAMILIES.map(function (n) { return [n, path.join(folderOf(n), 'data.js')]; })) + '.forEach(function (p) { try { require(p[1]); const f = D[p[0]]; out[p[0]] = { data: f && typeof f.data, cache: f && typeof f.cache }; } catch (e) { out[p[0]] = { threw: String(e).slice(0, 200) }; } });' +
    'console.log("ANSWER" + JSON.stringify(out)); process.exit(0);'], { cwd: RUN, encoding: 'utf8', timeout: 30000 });
  let nodeView = {};
  try { nodeView = JSON.parse(String(inNode.stdout).split('\n').filter(function (l) { return l.indexOf('ANSWER') === 0; })[0].slice('ANSWER'.length)); } catch (e) { test.fail('node answered nothing: ' + short(inNode.stderr || inNode.stdout)); }
  FAMILIES.forEach(function (n) {
    const f = nodeView[n] || {};
    ok(f.data === 'object' && f.cache === 'object', n + ': in node, data and cache', n + ': in node: ' + short(f));
  });

  // ── ON A PAGE ───────────────────────────────────────────────────────────────────
  const chrome = H.findChrome();
  const node = await H.scratchNode();
  let page = null;
  try {
    page = chrome && node.up ? await H.chromePage(chrome) : null;
    if (!page || page.error) { test.fail('no browser to ask: ' + short(page ? page.error : 'no Chrome, or the scratch node did not come up')); return; }
    await page.send('Page.navigate', { url: node.base + '/index.html' });
    await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)').then(Boolean); }, H.WAIT);
    await page.evaluate('window.spirit.ready.then(function () { return true; })').catch(function () { return false; });
    await H.sleep(2500);
    const ask = async function (js) { try { return JSON.parse(await page.evaluate(js)); } catch (e) { return { threw: String(e) }; } };
    const got = await ask('(function () { var S = window.spirit; var names = ' + JSON.stringify(FAMILIES) + ';' +
      ' return Promise.all(names.map(function (n) { return Promise.resolve(S.cacheManager(n)).then(null, function () { return null; }); })).then(function () {' +
      ' var D = S.data || {}; var out = { first: Object.keys(S), keys: {}, families: {} };' +
      ' Object.keys(D).forEach(function (k) { out.keys[k] = typeof D[k]; });' +
      ' names.forEach(function (n) { var f = D[n]; out.families[n] = { data: f && typeof f.data, cache: f && typeof f.cache }; });' +
      ' return JSON.stringify(out); }); })()');
    if (got.threw) { test.fail('the page answered nothing: ' + short(got)); return; }

    test.subHeading('the box: "de-clutter": the first level of spirit holds no <name>Data');
    const left = got.first.filter(function (k) { return /Data$/.test(k); });
    ok(!left.length, 'none is left', 'still on spirit: ' + left.join(', '));

    test.subHeading('the box: "spirit.data.<name>.data" and "spirit.data.<name>.cache"');
    FAMILIES.filter(function (n) { return NOT_ON_SCRATCH.indexOf(n) === -1; }).forEach(function (n) {
      const f = got.families[n] || {};
      ok(f.data === 'object' && f.cache === 'object', 'spirit.data.' + n + ' has data and cache', 'spirit.data.' + n + ': ' + short(f));
    });

    test.subHeading('the box: "this object has only helper functions and object <name> for every application"');
    const stray = Object.keys(got.keys).filter(function (k) { return got.keys[k] !== 'function' && FAMILIES.indexOf(k) === -1; });
    ok(Object.keys(got.keys).some(function (k) { return got.keys[k] === 'function'; }), 'spirit.data has its helper functions', 'spirit.data has no function: ' + short(got.keys));
    ok(!stray.length, 'and nothing else but the families', 'on spirit.data besides helpers and families: ' + stray.join(', '));
    // Andy: "all the helperFunctions in objects like spirit.data should potential "words" the should have a capital in it like
    // spirit.data.helper**F**unction()", and on Q10: "it belongs to "Fix 'data'", THIS item." A word is a to z, so no family can land on one.
    const asWords = Object.keys(got.keys).filter(function (k) { return got.keys[k] === 'function' && !/[A-Z]/.test(k); });
    ok(!asWords.length, 'every helper has a capital, so none is a word', 'helpers that are valid words, ' + asWords.length + ': ' + asWords.join(', '));

    // Andy: "the helpes must not be words there either, this goes for all spirit.app contained objects."
    test.subHeading('spirit.app: no helper is a word, on it or on an app it holds');
    const onApp = await ask('(function () { var S = window.spirit; return Promise.all(["spirit/app/monitor/monitor.js"].map(function (p) { return Promise.resolve(S.require(p)).then(null, function () { return null; }); })).then(function () {' +
      ' var out = { keys: Object.keys(S.app || {}), words: [] };' +
      ' out.keys.forEach(function (k) { var v = S.app[k]; if (typeof v === "function" && !/[A-Z]/.test(k)) out.words.push(k);' +
      ' else if (k !== "FS" && v && typeof v === "object") Object.keys(v).forEach(function (h) { if (typeof v[h] === "function" && !/[A-Z]/.test(h)) out.words.push(k + "." + h); }); });' +
      ' out.apps = out.keys.filter(function (k) { return S.app[k] && typeof S.app[k].createApp === "function"; });' +
      ' return JSON.stringify(out); }); })()');
    ok(Array.isArray(onApp.apps) && onApp.apps.indexOf('monitor') !== -1, 'monitor stand there, each with createApp', 'on spirit.app: ' + short(onApp));
    ok(Array.isArray(onApp.words) && !onApp.words.length, 'and no helper there is a word', 'helpers on spirit.app that are words: ' + short(onApp.words || onApp));

    // Q5, "Does spirit.data.<name>.cache hold a level per node, as the tree does today?", Andy: "yes."
    test.subHeading('Q5: .cache holds a level per node');
    await H.until(function () { return page.evaluate('(function () { var a = (window.spirit.data || {}).app; var c = a && a.cache && a.cache[window.spirit.data.homeNode()]; return !!(c && c.apps && Object.keys(c.apps).length); })()').then(Boolean); }, 8000).catch(function () { return false; });
    const cached = await ask('(function () { var D = window.spirit.data || {}; var a = D.app || {}; var c = a.cache || {}; var home = typeof D.homeNode === "function" ? D.homeNode() : ""; var r = { home: !!home, apps: Object.keys((c[home] || {}).apps || {}).length };' +
      ' try { D.viewAt("othernode", "app").set("apps/onlythere", { key: "onlythere" }); } catch (e) { r.threw = String(e); }' +
      ' r.there = !!(((c.othernode || {}).apps || {}).onlythere); r.notHome = !((c[home] || {}).apps || {}).onlythere;' +
      ' return JSON.stringify(r); })()');
    ok(cached.home && cached.apps > 0, 'the app rows stand under this page\'s node', 'spirit.data.app.cache[home].apps: ' + short(cached));
    ok(cached.there === true, 'a row of another node stands under that node', 'a row of another node: ' + short(cached));
    ok(cached.notHome === true, 'and not under this page\'s', 'a row of another node under the home node: ' + short(cached));

    test.subHeading('the reads moved with it: spirit.data.<name>.data answers what spirit.<name>Data did');
    const reads = await ask('(function () { var D = window.spirit.data || {}; var a = (D.app || {}).data || {}; var f = (D.fs || {}).data || {}; return JSON.stringify({ rows: typeof a.rows, watch: typeof a.watch, count: typeof a.rows === "function" ? Object.keys(a.rows()).length : 0, fsWatch: typeof f.watch }); })()');
    ok(reads.rows === 'function' && reads.watch === 'function' && reads.count > 0, 'spirit.data.app.data reads the app rows', 'spirit.data.app.data: ' + short(reads));
    ok(reads.fsWatch === 'function', 'spirit.data.fs.data.watch stands, which word.js follows', 'spirit.data.fs.data: ' + short(reads));
  } finally {
    if (page && page.kid) page.kid.kill();
    if (node.child) node.child.kill();
    try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(process.exitCode || 0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(1); });
