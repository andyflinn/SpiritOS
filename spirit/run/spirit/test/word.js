'use strict';

// spirit/run/spirit/test/word.js
// The tests of spirit/word.js (spec: ./word.md; goal/G43.4). Andy, the box: "i will track nameSpace claims." word.js runs
// from a copy of the run tree, with word.json files planted there, so nothing here writes into this checkout. Then the
// word system is held against this checkout's own tree: "the test for word will go red if the word system and the tree
// contradict", and "the red generated from this will point us toward the next steps in restructuring the namespace. live
// with it." So this suite is red on purpose while a reserved word has no home.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;

// The box: "word.js will have hardcoded intitialized set of keys", "(this may change)". When it does, so does this line.
// DISCREPANCY WITH ANDY's RULES: it has changed and this line has not: word.js hard-codes spirit, api, app, contact, data, element, job, node, state,
// search, stream and test (Andy's commit 85fb4db6 added stream); identity is no longer among them.
const HARD = ['spirit', 'app', 'element', 'identity', 'job', 'data', 'search'];

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// What word.js answers in a tree: each ask run in one child, whose word.js finds its word.json files by its own place.
function asks(run, list) {
  const code = 'const w = require(' + JSON.stringify(path.join(run, 'spirit', 'word.js')) + ');' +
    'Promise.all(' + JSON.stringify(list) + '.map(function (a) { return Promise.resolve(w.check(a[0], a[1])); }))' +
    '.then(function (r) { console.log("ANSWER" + JSON.stringify({ answers: r })); process.exit(0); },' +
    ' function (e) { console.log("ANSWER" + JSON.stringify({ threw: String(e) })); process.exit(0); });';
  return answerOf(run, code);
}
function answerOf(run, code) {
  const r = spawnSync(process.execPath, ['-e', code], { cwd: run, encoding: 'utf8', timeout: 30000 });
  const line = String(r.stdout || '').split('\n').filter(function (l) { return l.indexOf('ANSWER') === 0; })[0];
  try { return JSON.parse(line.slice('ANSWER'.length)); } catch (e) { return { threw: String(r.stderr || r.stdout || 'no answer').slice(0, 300) }; }
}
// What add answers, each in turn in one child and unwrapped: the box's add "returns boolean", so a promise is no answer.
function adds(run, list) {
  const code = 'const w = require(' + JSON.stringify(path.join(run, 'spirit', 'word.js')) + ');' +
    'try { console.log("ANSWER" + JSON.stringify({ answers: ' + JSON.stringify(list) + '.map(function (a) { return w.add(a[0], a[1]); }) })); }' +
    ' catch (e) { console.log("ANSWER" + JSON.stringify({ threw: String(e) })); }' +
    ' process.exit(0);';
  return answerOf(run, code);
}

// What the tests share: the scratch copy of the run tree, made by the first "the world:" test, and the browser's.
const W = { scratch: null, run: null, got: null, node: null, page: null, held: null };
function plant(dir, words) {
  const at = path.join(W.run, 'spirit', dir);
  fs.mkdirSync(at, { recursive: true });
  const o = {};
  words.forEach(function (w) { o[w] = true; });
  fs.writeFileSync(path.join(at, 'word.json'), JSON.stringify(o));
}
const NO_TREE = 'no scratch copy of the run tree: the world failed';
// The box's own example, "check('spirit.app.table.add', 'Item') will check all these files".
const cases = [
  ['the box\'s example: the file at the path itself', 'spirit.app.table.add', 'Item', 'item'],
  ['one level up', 'spirit.app.table.add', 'THING', 'thing'],
  ['two levels up', 'spirit.app.table.add', 'aCtIvAtE', 'activate'],
  ['a level with no word.json of its own still looks up', 'spirit.app.table.none', 'thing', 'thing'],
  ['a hard-coded word, from any path, lower-cased', 'spirit.app.table.add', 'Identity', 'identity'],
  ['a hard-coded word, at the root', 'spirit', 'JOB', 'job'],
  ['a word lower down is not seen from above', 'spirit.app', 'thing', null],
  ['a word in another branch is not seen', 'spirit.app.table.add', 'sibling', null],
  ['a word no level holds', 'spirit.app.table.add', 'nothing', null],
  ['not a word: a digit', 'spirit.app', 'app1', null],
  ['not a word: empty', 'spirit.app', '', null],
  // cw, on the object's own keys: "constructor" is a to z.
  ['a word an object inherits is no reserved word', 'spirit.app', 'constructor', null],
].concat(HARD.map(function (w) { return ['hard-coded: ' + w, 'spirit', w, w]; }));

test.run('the world: word.js runs from a scratch copy of the run tree, word.json files planted, and answers the checks', 0.2, function () {
  W.scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-word-'));
  W.run = path.join(W.scratch, 'run');
  const SKIP = ['relay-state', 'app-state', 'media', 'published', 'brains', 'test'];
  fs.cpSync(RUN, W.run, { recursive: true, filter: function (src) {
    const rel = path.relative(RUN, src).split(path.sep);
    return !(rel.length === 1 && SKIP.indexOf(rel[0]) !== -1) && !VENDORED_FOLDERS.holds(path.relative(RUN, src)) && rel.indexOf('state') === -1;
  } });
  plant('app/table/add', ['item']);
  plant('app/table', ['thing']);
  plant('app', ['activate']);
  plant('contact', ['sibling']);
  W.got = asks(W.run, cases.map(function (c) { return [c[1], c[2]]; }));
  return Array.isArray(W.got.answers) || 'word.js answered nothing: ' + short(W.got);
}, test.limit.quick);

// check: case-insensitive, up its own path and over the hard-coded words, the lower-case word or null
// Each case written out, so that each check has a plain title of its own.
function checked(i) {
  if (!W.got || !Array.isArray(W.got.answers)) return 'word.js answered nothing: the world failed';
  const c = cases[i]; const a = W.got.answers[i];
  return a === c[3] || c[0] + ': check(' + c[1] + ', ' + c[2] + ') answered ' + short(a);
}
test.run('the box\'s example: the file at the path itself: checking Item at spirit.app.table.add answers item', 0.2, function () { return checked(0); }, test.limit.quick);
test.run('one level up: checking THING at spirit.app.table.add answers thing', 0.2, function () { return checked(1); }, test.limit.quick);
test.run('two levels up: checking aCtIvAtE at spirit.app.table.add answers activate', 0.2, function () { return checked(2); }, test.limit.quick);
test.run('a level with no word.json of its own still looks up: checking thing at spirit.app.table.none answers thing', 0.2, function () { return checked(3); }, test.limit.quick);
test.run('a hard-coded word, from any path, lower-cased: checking Identity at spirit.app.table.add answers identity', 0.2, function () { return checked(4); }, test.limit.quick);
test.run('a hard-coded word, at the root: checking JOB at spirit answers job', 0.2, function () { return checked(5); }, test.limit.quick);
test.run('a word lower down is not seen from above: checking thing at spirit.app answers null', 0.2, function () { return checked(6); }, test.limit.quick);
test.run('a word in another branch is not seen: checking sibling at spirit.app.table.add answers null', 0.2, function () { return checked(7); }, test.limit.quick);
test.run('a word no level holds: checking nothing at spirit.app.table.add answers null', 0.2, function () { return checked(8); }, test.limit.quick);
test.run('not a word: a digit: checking app1 at spirit.app answers null', 0.2, function () { return checked(9); }, test.limit.quick);
test.run('not a word: empty: checking an empty word at spirit.app answers null', 0.2, function () { return checked(10); }, test.limit.quick);
test.run('a word an object inherits is no reserved word: checking constructor at spirit.app answers null', 0.2, function () { return checked(11); }, test.limit.quick);
test.run('hard-coded: spirit: checking spirit at spirit answers spirit', 0.2, function () { return checked(12); }, test.limit.quick);
test.run('hard-coded: app: checking app at spirit answers app', 0.2, function () { return checked(13); }, test.limit.quick);
test.run('hard-coded: element: checking element at spirit answers element', 0.2, function () { return checked(14); }, test.limit.quick);
test.run('hard-coded: identity: checking identity at spirit answers identity', 0.2, function () { return checked(15); }, test.limit.quick);
test.run('hard-coded: job: checking job at spirit answers job', 0.2, function () { return checked(16); }, test.limit.quick);
test.run('hard-coded: data: checking data at spirit answers data', 0.2, function () { return checked(17); }, test.limit.quick);
test.run('hard-coded: search: checking search at spirit answers search', 0.2, function () { return checked(18); }, test.limit.quick);

// a change to a word.json is seen by the next check
test.run('a word written to the file answers', 0.2, function () {
  if (!W.run) return NO_TREE;
  plant('app', ['activate', 'later']);
  const after = asks(W.run, [['spirit.app', 'later']]);
  return (Array.isArray(after.answers) && after.answers[0] === 'later') || 'after the write: ' + short(after);
}, test.limit.quick);

// ── ADD, Andy: "all, implement add()" ──────────────────────────────────────────
function wordsIn(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(W.run, 'spirit', dir, 'word.json'), 'utf8')); } catch (e) { return null; }
}
// Each group of adds: the level, the word, run in one child by the first test of its group, which also judges its first.
const A = {};
function addGroup(key, list) {
  if (!W.run) return NO_TREE;
  const r = adds(W.run, list);
  if (!Array.isArray(r.answers)) return 'add answered nothing: ' + short(r);
  A[key] = r.answers;
  return true;
}
function added(key, i, want, why) {
  if (!A[key]) return 'add answered nothing: the world failed';
  return A[key][i] === want || why + ' answered ' + short(A[key][i]);
}
function firstOf(key, list, want, why) { const g = addGroup(key, list); return g === true ? added(key, 0, want, why) : g; }

// add: the box's example, "add('spirit.app', 'activate') would add the 'activate' to run://spirit/app/word.json"
test.run('a new word: adding activate at spirit.app answers true', 0.2, function () {
  if (!W.run) return NO_TREE;
  plant('app', ['later']);
  return firstOf('example', [['spirit.app', 'activate'], ['spirit.app', 'activate']], true, 'a new word: add(spirit.app, activate)');
}, test.limit.quick);
test.run('"a boolean \'false\' if the word already exists": adding activate at spirit.app answers false', 0.2, function () {
  return added('example', 1, false, '"a boolean \'false\' if the word already exists": add(spirit.app, activate)');
}, test.limit.quick);
test.run('the word stands in spirit/app/word.json with the value true', 0.2, function () {
  if (!W.run) return NO_TREE;
  const app = wordsIn('app') || {};
  return app.activate === true || 'spirit/app/word.json after add: ' + short(app);
}, test.limit.quick);
test.run('the words already in that file stay', 0.2, function () {
  if (!W.run) return NO_TREE;
  const app = wordsIn('app') || {};
  return app.later === true || 'spirit/app/word.json lost a word: ' + short(app);
}, test.limit.quick);
let seen = null;
test.run('check finds the added word at its level', 0.2, function () {
  if (!W.run) return NO_TREE;
  seen = asks(W.run, [['spirit.app', 'activate'], ['spirit.app.table.add', 'activate'], ['spirit.contact', 'activate']]);
  return (Array.isArray(seen.answers) && seen.answers[0] === 'activate') || 'check at its level: ' + short(seen);
}, test.limit.quick);
test.run('and below it (the box: "for that level and below")', 0.2, function () {
  return (!!seen && Array.isArray(seen.answers) && seen.answers[1] === 'activate') || 'check below it: ' + short(seen);
}, test.limit.quick);
test.run('and not in another branch', 0.2, function () {
  return (!!seen && Array.isArray(seen.answers) && seen.answers[2] === null) || 'check in another branch: ' + short(seen);
}, test.limit.quick);

let before = null;
// add refuses what is no word: "'word' is a string containing only characters from 'a' to 'z'"
test.run('a digit: adding app1 at spirit.app answers false', 0.2, function () {
  if (!W.run) return NO_TREE;
  before = JSON.stringify([wordsIn('app'), wordsIn('app/table'), wordsIn('app/table/add')]);
  return firstOf('noWord', [['spirit.app', 'app1'], ['spirit.app', ''], ['spirit.app', 'a b'], ['spirit.app', 'new-word']], false, 'a digit: add(spirit.app, app1)');
}, test.limit.quick);
test.run('empty: adding an empty word at spirit.app answers false', 0.2, function () { return added('noWord', 1, false, 'empty: add(spirit.app, )'); }, test.limit.quick);
test.run('a space: adding a b at spirit.app answers false', 0.2, function () { return added('noWord', 2, false, 'a space: add(spirit.app, a b)'); }, test.limit.quick);
test.run('a dash: adding new-word at spirit.app answers false', 0.2, function () { return added('noWord', 3, false, 'a dash: add(spirit.app, new-word)'); }, test.limit.quick);
// add refuses what check finds: "no words can be added that already exists toward the root of the tree"
test.run('a hard-coded word, in any case: adding IdEnTiTy at spirit.app.table answers false', 0.2, function () {
  return firstOf('rootward', [['spirit.app.table', 'IdEnTiTy'], ['spirit.app.table.add', 'THING'], ['spirit.app.table.add', 'later']], false, 'a hard-coded word, in any case: add(spirit.app.table, IdEnTiTy)');
}, test.limit.quick);
test.run('a word one level toward the root: adding THING at spirit.app.table.add answers false', 0.2, function () { return added('rootward', 1, false, 'a word one level toward the root: add(spirit.app.table.add, THING)'); }, test.limit.quick);
test.run('a word two levels toward the root: adding later at spirit.app.table.add answers false', 0.2, function () { return added('rootward', 2, false, 'a word two levels toward the root: add(spirit.app.table.add, later)'); }, test.limit.quick);
// Andy's yes to cw's Q4, "If a level below already holds the word, should add refuse it, rather than let the word test go red?"
// add refuses a word a level below holds (Q4)
test.run('one level below: adding thing at spirit.app answers false', 0.2, function () {
  return firstOf('below', [['spirit.app', 'thing'], ['spirit.app', 'item']], false, 'one level below: add(spirit.app, thing)');
}, test.limit.quick);
test.run('two levels below: adding item at spirit.app answers false', 0.2, function () { return added('below', 1, false, 'two levels below: add(spirit.app, item)'); }, test.limit.quick);
test.run('a refused add writes nothing', 0.2, function () {
  if (!W.run || before === null) return NO_TREE;
  const now = JSON.stringify([wordsIn('app'), wordsIn('app/table'), wordsIn('app/table/add')]);
  return now === before || 'a refused add changed a word.json: ' + now;
}, test.limit.quick);

// add writes what no level on its path holds
test.run('a word in another branch does not stop it: adding sibling at spirit.app answers true', 0.2, function () {
  // cw, on the object's own keys: "constructor" is a to z.
  return firstOf('writes', [['spirit.app', 'sibling'], ['spirit.app', 'constructor'], ['spirit.fs', 'fresh']], true, 'a word in another branch does not stop it: add(spirit.app, sibling)');
}, test.limit.quick);
test.run('a word an object inherits is a word like any other: adding constructor at spirit.app answers true', 0.2, function () { return added('writes', 1, true, 'a word an object inherits is a word like any other: add(spirit.app, constructor)'); }, test.limit.quick);
test.run('a level with no word.json yet gets one: adding fresh at spirit.fs answers true', 0.2, function () { return added('writes', 2, true, 'a level with no word.json yet gets one: add(spirit.fs, fresh)'); }, test.limit.quick);
// Andy, on Q8: "wince fucking when does add() add a MOTHERFUCKING FOLDER?" With no folder there is no level to write to.
// add makes no folder
test.run('a level with no folder: adding made at spirit.nosuch.level answers false', 0.2, function () {
  return firstOf('noFolder', [['spirit.nosuch.level', 'made']], false, 'a level with no folder: add(spirit.nosuch.level, made)');
}, test.limit.quick);
test.run('and spirit/nosuch stays absent', 0.2, function () {
  if (!W.run) return NO_TREE;
  return !fs.existsSync(path.join(W.run, 'spirit', 'nosuch')) || 'add made spirit/nosuch';
}, test.limit.quick);
// 'path.in.words', and "'word' is a string containing only characters from 'a' to 'z'": a capital is no level.
// add takes no capitals in its path
test.run('a capital in the path: adding word at spirit.Capital answers false', 0.2, function () {
  return firstOf('capital', [['spirit.Capital', 'word']], false, 'a capital in the path: add(spirit.Capital, word)');
}, test.limit.quick);
test.run('and makes no folder of it', 0.2, function () {
  if (!W.run) return NO_TREE;
  return !fs.existsSync(path.join(W.run, 'spirit', 'Capital')) || 'add made spirit/Capital';
}, test.limit.quick);
test.run('both words stand in spirit/app/word.json', 0.2, function () {
  if (!W.run) return NO_TREE;
  const app = wordsIn('app') || {};
  return (app.sibling === true && Object.prototype.hasOwnProperty.call(app, 'constructor') && app.constructor === true) || 'spirit/app/word.json: ' + short(app);
}, test.limit.quick);
test.run('the new spirit/fs/word.json holds that word and nothing else', 0.2, function () {
  if (!W.run) return NO_TREE;
  return JSON.stringify(wordsIn('fs')) === '{"fresh":true}' || 'spirit/fs/word.json: ' + short(wordsIn('fs'));
}, test.limit.quick);
// Q5, "Should add work from a page too, the way check does?", Andy: "no." word.js's page half, run on a bare window.
test.run('on a page spirit.word has check and no add (Q5)', 0.2, function () {
  const bare = { window: { spirit: {} } };
  require('vm').runInNewContext(fs.readFileSync(path.join(RUN, 'spirit', 'word.js'), 'utf8'), bare);
  const onPage = bare.window.spirit.word || {};
  return (typeof onPage.check === 'function' && onPage.add === undefined) || 'on a page spirit.word has check ' + typeof onPage.check + ', add ' + typeof onPage.add;
}, test.limit.quick);
// Whether add takes a word in capitals is the box's "addedWoRD": what lands in the file is a to z either way.
test.run('add of a word in capitals answers a boolean', 0.2, function () {
  if (!W.run) return NO_TREE;
  const mixed = adds(W.run, [['spirit.contact', 'MiXeD']]);
  return (Array.isArray(mixed.answers) && typeof mixed.answers[0] === 'boolean') || 'add of a word in capitals: ' + short(mixed);
}, test.limit.quick);
test.run('and no key but a to z lands in the file', 0.2, function () {
  if (!W.run) return NO_TREE;
  return Object.keys(wordsIn('contact') || {}).every(function (k) { return /^[a-z]+$/.test(k); }) || 'spirit/contact/word.json: ' + short(wordsIn('contact'));
}, test.limit.quick);

// ── THE TREE, THIS CHECKOUT'S ─────────────────────────────────────────────────────────────────
const SPIRIT = path.join(RUN, 'spirit');
function walk(dir, rel, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    // A test folder holds a module's tests, named after it; state is the node's.
    if (VENDORED_FOLDERS.holds(path.join(dir, e.name)) || e.name === 'test' || (rel === '' && e.name === 'state')) return;
    const r = rel ? rel + '/' + e.name : e.name;
    out.push({ rel: r, dir: e.isDirectory(), name: e.name });
    if (e.isDirectory()) walk(path.join(dir, e.name), r, out);
  });
  return out;
}
function stem(name) { return name.split('.')[0]; }
const T = { tree: null, wordsAt: null, notJson: [] };
function tree() {
  if (T.tree) return T.tree;
  T.tree = walk(SPIRIT, '', []);
  T.wordsAt = {};
  T.tree.filter(function (e) { return e.name === 'word.json'; }).forEach(function (e) {
    let o = {};
    try { o = JSON.parse(fs.readFileSync(path.join(SPIRIT, e.rel), 'utf8')); } catch (err) { T.notJson.push(e.rel + ' is no JSON'); }
    T.wordsAt[path.dirname(e.rel)] = Object.keys(o);
  });
  return T.tree;
}
// The words reserved above a place: the hard-coded ones and those of each word.json on its way up, 'spirit' exempt
// (the box: "in tests it is exempt from discrepancy rules").
function above(dirRel) {
  const parts = dirRel === '.' || dirRel === '' ? [] : dirRel.split('/');
  const out = [{ at: 'hard-coded', words: HARD.filter(function (w) { return w !== 'spirit'; }) }];
  for (let i = 0; i <= parts.length; i++) {
    const d = i === 0 ? '.' : parts.slice(0, i).join('/');
    if (T.wordsAt[d]) out.push({ at: d + '/word.json', words: T.wordsAt[d] });
  }
  return out;
}
// the tree: "if word.check() returns !null for the same word defined twice along any specified path, then the test MUST go red."
test.run('no word stands twice along a path', 0.2, function () {
  tree();
  const twice = [];
  Object.keys(T.wordsAt).forEach(function (d) {
    const here = {};
    above(d).forEach(function (l) { l.words.forEach(function (w) { (here[w] = here[w] || []).push(l.at); }); });
    Object.keys(here).forEach(function (w) { if (here[w].length > 1) twice.push(w + ' in ' + here[w].join(' and ')); });
  });
  const bad = T.notJson.concat(twice.length ? ['a word stands twice along a path: ' + twice.join('; ')] : []);
  return !bad.length || bad.join('; ');
}, test.limit.quick);
// the tree: "node-side a word 'abc' reservers any 'abc.js' or 'abc/' or 'abc.anything'": nothing below may take a word reserved above it
// Q11, Andy: "the word is defined ONCE, at the "largest" scope", and "spirit/app/data.js is "plugin" of spirit/data.js": a file
// below that borrows from the word is no second definition. Only data has a way to show it: the file calls the one helper.
const BORROWS = { data: /\.makeFamily\(/ };
function borrows(e) { const re = BORROWS[stem(e.name)]; return !!re && !e.dir && re.test(fs.readFileSync(path.join(SPIRIT, e.rel), 'utf8')); }
test.run('no folder or file below takes a word reserved above it', 0.2, function () {
  const taken = [];
  tree().forEach(function (e) {
    const where = path.dirname(e.rel);
    if (where === '.' || e.name === 'word.json' || borrows(e)) return;
    above(where).forEach(function (l) {
      if (l.words.indexOf(stem(e.name)) !== -1 && !(l.at !== 'hard-coded' && path.dirname(l.at) === where)) taken.push('spirit/' + e.rel + ' (reserved in ' + l.at + ')');
    });
  });
  return !taken.length || 'these take a word reserved above them: ' + taken.join('; ');
}, test.limit.quick);

// Each reserved word as a home: a folder or a file at its place, and the browser's spirit object holding it.
// the tree: each hard-coded word has its folder or file, and the browser's spirit object has it, both or neither is no answer
test.run('the world: a browser at a scratch node asks the spirit object what it holds', 0.2, async function () {
  const chrome = H.findChrome();
  W.node = await H.scratchNode();
  W.page = chrome && W.node.up ? await H.chromePage(chrome) : null;
  if (!W.page || W.page.error) return 'no browser to ask: ' + short(W.page ? W.page.error : 'no Chrome, or the scratch node did not come up');
  const page = W.page;
  await page.send('Page.navigate', { url: W.node.base + '/' });
  await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)').then(Boolean); }, H.WAIT);
  await page.evaluate('window.spirit.ready.then(function () { return true; })').catch(function () { return false; });
  await H.sleep(2500);
  try { W.held = JSON.parse(await page.evaluate('JSON.stringify(' + JSON.stringify(HARD) + '.reduce(function (o, k) { o[k] = typeof window.spirit[k]; return o; }, {}))')); } catch (e) { W.held = {}; }
  return true;
}, test.limit.slow);
// Each hard-coded word written out, so that each check has a plain title of its own.
function stands(w) {
  if (!W.held) return 'no browser asked: the world failed';
  const onDisk = tree().some(function (e) { return path.dirname(e.rel) === '.' && stem(e.name) === w; });
  const inObject = W.held[w] === 'object' || W.held[w] === 'function';
  return (onDisk && inObject) || w + ': on disk ' + onDisk + ', spirit.' + w + ' is ' + short(W.held[w]) + ': the word and the tree contradict';
}
test.run('app: spirit/app and spirit.app both stand', 0.2, function () { return stands('app'); }, test.limit.quick);
test.run('element: spirit/element and spirit.element both stand', 0.2, function () { return stands('element'); }, test.limit.quick);
test.run('identity: spirit/identity and spirit.identity both stand', 0.2, function () { return stands('identity'); }, test.limit.quick);
test.run('job: spirit/job and spirit.job both stand', 0.2, function () { return stands('job'); }, test.limit.quick);
test.run('data: spirit/data and spirit.data both stand', 0.2, function () { return stands('data'); }, test.limit.quick);
test.run('search: spirit/search and spirit.search both stand', 0.2, function () { return stands('search'); }, test.limit.quick);

// NO ASK FOR A word.json THE PAGE KNOWS IS NOT THERE (goal/G43.32). cw, measured on Andy's node: opening Files
// made 1821 requests, 1818 of them 404, all fs.load of a word.json (spirit/app/word.json alone 712 times). Andy:
// "wsl, add a test to test/word.js to make sure this won't happend again." The page holds the node's file list
// (spirit.data.fs), so word.js asks only for a word.json the list holds, and each of those once until the stream
// says it changed. One word.json is planted on the scratch node (spirit/app/word.json, the word zzword); then many
// checks along many paths, every call the page sends recorded as it leaves.
// on a page: no word.json asked that the file list does not hold, each one held asked once
let onPage = null;
test.run('the world: the planted spirit/app/word.json is read, its word found at spirit.app and below', 0.2, async function () {
  if (!W.page || W.page.error) return 'no browser to ask: the world failed';
  const page = W.page;
  fs.writeFileSync(path.join(W.node.root, 'spirit', 'run', 'spirit', 'app', 'word.json'), JSON.stringify({ zzword: true }));
  await page.send('Page.navigate', { url: W.node.base + '/' });
  await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)').then(Boolean); }, H.WAIT);
  const asked = await page.evaluate('window.spirit.ready.then(function () { return spirit.cacheManager("fs"); }).then(function () {' +
    ' return new Promise(function (r) { setTimeout(r, 3000); }); }).then(function () {' +
    ' window.sentWord = []; var keep = function (b) { try { var s = String(b || ""); if (/word\\.json/.test(s)) window.sentWord.push(s); } catch (e) {} };' +
    ' var f = window.fetch; window.fetch = function (u, o) { keep(String(u) + " " + (o && o.body || "")); return f.apply(this, arguments); };' +
    ' var x = XMLHttpRequest.prototype.send; XMLHttpRequest.prototype.send = function (b) { keep(b); return x.apply(this, arguments); };' +
    ' return spirit.require("spirit/word.js"); }).then(function () {' +
    ' var paths = ["spirit.app.zz", "spirit.app.table.zz", "spirit.app.table.rows.zz", "spirit.element.search.zz", "spirit.fs.zz", "spirit.contact.zz", "spirit.data.zz", "spirit.app.desk.element.zz"];' +
    ' var asks = []; for (var n = 0; n < 5; n++) paths.forEach(function (p) { asks.push(spirit.word.check(p, "zzword")); asks.push(spirit.word.check(p, "other")); });' +
    ' return Promise.all(asks); }).then(function (answers) { return new Promise(function (r) { setTimeout(function () { r(answers); }, 1500); }); })' +
    '.then(function (answers) { return JSON.stringify({ sent: window.sentWord, appSees: answers[0], under: answers[2] }); }, function (e) { return JSON.stringify({ threw: String(e && e.message || e) }); })');
  let got = null;
  try { got = JSON.parse(asked); } catch (e) { got = { threw: short(asked) }; }
  onPage = got;
  return (!!got && !got.threw && got.appSees === 'zzword' && got.under === 'zzword') || 'the planted word.json was not read: ' + short(got);
}, test.limit.slow);
function sentWord() { return (onPage && onPage.sent) || []; }
test.run('of 80 checks along 8 paths, none asks for a word.json the file list does not hold', 0.2, function () {
  const other = sentWord().filter(function (b) { return !/spirit\/app\/word\.json/.test(b); });
  return (!!onPage && !onPage.threw && !other.length) || other.length + ' asks for a word.json that is not there: ' + short(other.slice(0, 4));
}, test.limit.quick);
test.run('and the one it holds, spirit/app/word.json, is asked once at most', 0.2, function () {
  const once = sentWord().filter(function (b) { return /spirit\/app\/word\.json/.test(b); });
  return (!!onPage && !onPage.threw && once.length <= 1) || 'spirit/app/word.json was asked ' + once.length + ' times';
}, test.limit.quick);

test.after(function () {
  const page = W.page; const node = W.node;
  if (page && page.kid) page.kid.kill();
  if (node && node.child) node.child.kill();
  try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (node && node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(node); } catch (e) { /* left */ }
  if (W.scratch) { try { fs.rmSync(W.scratch, { recursive: true, force: true }); } catch (e) { /* left */ } }
});
