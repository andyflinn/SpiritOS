'use strict';

// spirit/run/spirit/word/test/script.js
// The tests of spirit/word/script.js (spec: ./script.md; goal/G43.4). Andy, the box: "i will track nameSpace claims." word.js runs
// from a copy of the run tree, with word.json files planted there, so nothing here writes into this checkout. Then the
// word system is held against this checkout's own tree: "the test for word will go red if the word system and the tree
// contradict", and "the red generated from this will point us toward the next steps in restructuring the namespace. live
// with it." So this suite is red on purpose while a reserved word has no home.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
// ITS TEMP FOLDERS FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"): one of its own for each
// it asks, under its suite's path, the whole of it removed when the suite ends.
const tempFolder = require('../../tempFolder/script.js').tempFolder;
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/word/test/script/' + name + tempAsked); }
test.after(function () { try { fs.rmSync(tempFolder.path('spirit/word/test/script'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
const H = LOADER.requireScript('spirit/test/headLessChrome.js');
const VENDORED_FOLDERS = LOADER.requireScript('spirit/fs/fileSystem/script.js').VENDORED_FOLDERS;

// THE HARD-CODED WORDS, READ FROM word.js ITSELF, NEVER A COPY HERE (Andy, 2026-11-17, of a copy twelve days behind it:
// "WHY WOULD A TEST HARD-CODE reserved words?", "IT's like hardcoded apps! IDIOTIC!"). The box: "word.js will have hardcoded
// intitialized set of keys", "(this may change)": the list that fills its HARD, as it stands in the file, so a word Andy adds
// or takes out is judged the day he does.
const HARD = (function () {
  // A file not there yet is no crash at load: HARD is empty, and the checks that need it are red (goal/G49.4, the move).
  let src = '';
  try { src = fs.readFileSync(path.join(RUN, 'spirit', 'word', 'script.js'), 'utf8'); } catch (e) { src = ''; }
  const m = /\[([^\]]*)\]\s*\.forEach\(\s*function\s*\(\s*w\s*\)\s*\{\s*HARD\[w\]\s*=\s*true;?\s*\}\s*\)/.exec(src);
  return m ? (m[1].match(/'([a-z]+)'/g) || []).map(function (s) { return s.slice(1, -1); }) : [];
}());
// A hard-coded word below the root, for the cases that ask one from any path; and one in mixed case.
const A_HARD = HARD.filter(function (w) { return w !== 'spirit'; })[0] || '';
function mixed(w) { return w.split('').map(function (c, i) { return i % 2 ? c : c.toUpperCase(); }).join(''); }


// What word.js answers in a tree: each ask run in one child, whose word.js finds its word.json files by its own place.
function asks(run, list) {
  const code = 'const w = require(' + JSON.stringify(path.join(run, 'spirit', 'word', 'script.js')) + ');' +
    'Promise.all(' + JSON.stringify(list) + '.map(function (a) { return Promise.resolve(w.check(a[0], a[1])); }))' +
    '.then(function (r) { console.log("ANSWER" + JSON.stringify({ answers: r })); process.exit(0); },' +
    ' function () { console.log("ANSWER" + JSON.stringify({ threw: true })); process.exit(0); });';
  return answerOf(run, code);
}
function answerOf(run, code) {
  const r = spawnSync(process.execPath, ['-e', code], { cwd: run, encoding: 'utf8', timeout: 30000 });
  const line = String(r.stdout || '').split('\n').filter(function (l) { return l.indexOf('ANSWER') === 0; })[0];
  try { return JSON.parse(line.slice('ANSWER'.length)); } catch (e) { return { threw: true }; }
}
// What add answers, each in turn in one child and unwrapped: the box's add "returns boolean", so a promise is no answer.
function adds(run, list) {
  const code = 'const w = require(' + JSON.stringify(path.join(run, 'spirit', 'word', 'script.js')) + ');' +
    'try { console.log("ANSWER" + JSON.stringify({ answers: ' + JSON.stringify(list) + '.map(function (a) { return w.add(a[0], a[1]); }) })); }' +
    ' catch (e) { console.log("ANSWER" + JSON.stringify({ threw: true })); }' +
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
// The box's own example, "check('spirit.app.table.add', 'Item') will check all these files".
const cases = [
  ['the box\'s example: the file at the path itself', 'spirit.app.table.add', 'Item', 'item'],
  ['one level up', 'spirit.app.table.add', 'THING', 'thing'],
  ['two levels up', 'spirit.app.table.add', 'aCtIvAtE', 'activate'],
  ['a level with no word.json of its own still looks up', 'spirit.app.table.none', 'thing', 'thing'],
  ['a hard-coded word, from any path, lower-cased', 'spirit.app.table.add', mixed(A_HARD), A_HARD],
  ['a hard-coded word, at the root', 'spirit', A_HARD.toUpperCase(), A_HARD],
  ['a word lower down is not seen from above', 'spirit.app', 'thing', null],
  ['a word in another branch is not seen', 'spirit.app.table.add', 'sibling', null],
  ['a word no level holds', 'spirit.app.table.add', 'nothing', null],
  ['not a word: a digit', 'spirit.app', 'app1', null],
  ['not a word: empty', 'spirit.app', '', null],
  // cw, on the object's own keys: "constructor" is a to z.
  ['a word an object inherits is no reserved word', 'spirit.app', 'constructor', null],
].concat(HARD.map(function (w) { return ['hard-coded: ' + w, 'spirit', w, w]; }));

// Read, not copied: nothing found in word.js would judge no word and pass, so it is red.
test.run('the hard-coded words are read from word.js itself, spirit among them', 0.2, function () {
  return (HARD.indexOf('spirit') !== -1 && !!A_HARD) || false;
}, test.limit.quick);
test.run('word.js runs from a scratch copy of the run tree with word.json files planted, and answers the checks', 0.2, function () {
  W.scratch = ownTemp('spirit-word-');
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
  return Array.isArray(W.got.answers) || false;
}, test.limit.quick);

// check: case-insensitive, up its own path and over the hard-coded words, the lower-case word or null
// Each case written out, so that each check has a plain title of its own.
function checked(i) {
  if (!W.got || !Array.isArray(W.got.answers)) return false;
  const c = cases[i]; const a = W.got.answers[i];
  return a === c[3] || false;
}
test.run('checking Item at spirit.app.table.add answers item, from the word.json at the path itself', 0.2, function () { return checked(0); }, test.limit.quick);
test.run('checking THING at spirit.app.table.add answers thing, from one level up', 0.2, function () { return checked(1); }, test.limit.quick);
test.run('checking aCtIvAtE at spirit.app.table.add answers activate, from two levels up', 0.2, function () { return checked(2); }, test.limit.quick);
test.run('checking thing at spirit.app.table.none answers thing, as a level with no word.json of its own still looks up', 0.2, function () { return checked(3); }, test.limit.quick);
test.run('checking a hard-coded word in mixed case at spirit.app.table.add answers it lower-cased, from any path', 0.2, function () { return checked(4); }, test.limit.quick);
test.run('checking a hard-coded word in upper case at spirit answers it lower-cased, at the root', 0.2, function () { return checked(5); }, test.limit.quick);
test.run('checking thing at spirit.app answers null, as a word lower down is not seen from above', 0.2, function () { return checked(6); }, test.limit.quick);
test.run('checking sibling at spirit.app.table.add answers null, as a word in another branch is not seen', 0.2, function () { return checked(7); }, test.limit.quick);
test.run('checking nothing at spirit.app.table.add answers null, as no level holds that word', 0.2, function () { return checked(8); }, test.limit.quick);
test.run('checking app1 at spirit.app answers null, as a digit makes it no word', 0.2, function () { return checked(9); }, test.limit.quick);
test.run('checking an empty word at spirit.app answers null, as empty is no word', 0.2, function () { return checked(10); }, test.limit.quick);
test.run('checking constructor at spirit.app answers null, as a word an object inherits is no reserved word', 0.2, function () { return checked(11); }, test.limit.quick);
// Each hard-coded word word.js holds, in one check (a title is one plain string, nothing built into it).
test.run('checking each hard-coded word word.js holds at spirit answers that word', 0.2, function () {
  return (HARD.length > 0 && HARD.every(function (w, k) { return checked(12 + k); })) || false;
}, test.limit.quick);

// a change to a word.json is seen by the next check
test.run('a word written to the file answers', 0.2, function () {
  if (!W.run) return false;
  plant('app', ['activate', 'later']);
  const after = asks(W.run, [['spirit.app', 'later']]);
  return (Array.isArray(after.answers) && after.answers[0] === 'later') || false;
}, test.limit.quick);

// ── ADD, Andy: "all, implement add()" ──────────────────────────────────────────
function wordsIn(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(W.run, 'spirit', dir, 'word.json'), 'utf8')); } catch (e) { return null; }
}
// Each group of adds: the level, the word, run in one child by the first test of its group, which also judges its first.
const A = {};
function addGroup(key, list) {
  if (!W.run) return false;
  const r = adds(W.run, list);
  if (!Array.isArray(r.answers)) return false;
  A[key] = r.answers;
  return true;
}
function added(key, i, want) {
  if (!A[key]) return false;
  return A[key][i] === want || false;
}
function firstOf(key, list, want) { const g = addGroup(key, list); return g === true ? added(key, 0, want) : g; }

// add: the box's example, "add('spirit.app', 'activate') would add the 'activate' to run://spirit/app/word.json"
test.run('adding the new word activate at spirit.app answers true', 0.2, function () {
  if (!W.run) return false;
  plant('app', ['later']);
  return firstOf('example', [['spirit.app', 'activate'], ['spirit.app', 'activate']], true);
}, test.limit.quick);
test.run('adding activate at spirit.app again answers false, as the word already exists', 0.2, function () {
  return added('example', 1, false);
}, test.limit.quick);
test.run('the word stands in spirit/app/word.json with the value true', 0.2, function () {
  if (!W.run) return false;
  const app = wordsIn('app') || {};
  return app.activate === true || false;
}, test.limit.quick);
test.run('the words already in that file stay', 0.2, function () {
  if (!W.run) return false;
  const app = wordsIn('app') || {};
  return app.later === true || false;
}, test.limit.quick);
let seen = null;
test.run('check finds the added word at its level', 0.2, function () {
  if (!W.run) return false;
  seen = asks(W.run, [['spirit.app', 'activate'], ['spirit.app.table.add', 'activate'], ['spirit.contact', 'activate']]);
  return (Array.isArray(seen.answers) && seen.answers[0] === 'activate') || false;
}, test.limit.quick);
test.run('check finds the added word below its level too', 0.2, function () {
  return (!!seen && Array.isArray(seen.answers) && seen.answers[1] === 'activate') || false;
}, test.limit.quick);
test.run('check does not find the added word in another branch', 0.2, function () {
  return (!!seen && Array.isArray(seen.answers) && seen.answers[2] === null) || false;
}, test.limit.quick);

let before = null;
// add refuses what is no word: "'word' is a string containing only characters from 'a' to 'z'"
test.run('adding app1, which holds a digit, at spirit.app answers false', 0.2, function () {
  if (!W.run) return false;
  before = JSON.stringify([wordsIn('app'), wordsIn('app/table'), wordsIn('app/table/add')]);
  return firstOf('noWord', [['spirit.app', 'app1'], ['spirit.app', ''], ['spirit.app', 'a b'], ['spirit.app', 'new-word']], false);
}, test.limit.quick);
test.run('adding an empty word at spirit.app answers false', 0.2, function () { return added('noWord', 1, false); }, test.limit.quick);
test.run('adding "a b", which holds a space, at spirit.app answers false', 0.2, function () { return added('noWord', 2, false); }, test.limit.quick);
test.run('adding new-word, which holds a dash, at spirit.app answers false', 0.2, function () { return added('noWord', 3, false); }, test.limit.quick);
// add refuses what check finds: "no words can be added that already exists toward the root of the tree"
test.run('adding a hard-coded word in mixed case at spirit.app.table answers false', 0.2, function () {
  return firstOf('rootward', [['spirit.app.table', mixed(A_HARD)], ['spirit.app.table.add', 'THING'], ['spirit.app.table.add', 'later']], false);
}, test.limit.quick);
test.run('adding THING at spirit.app.table.add answers false, as the word stands one level toward the root', 0.2, function () { return added('rootward', 1, false); }, test.limit.quick);
test.run('adding later at spirit.app.table.add answers false, as the word stands two levels toward the root', 0.2, function () { return added('rootward', 2, false); }, test.limit.quick);
// Andy's yes to cw's Q4, "If a level below already holds the word, should add refuse it, rather than let the word test go red?"
// add refuses a word a level below holds (Q4)
test.run('adding thing at spirit.app answers false, as the word stands one level below', 0.2, function () {
  return firstOf('below', [['spirit.app', 'thing'], ['spirit.app', 'item']], false);
}, test.limit.quick);
test.run('adding item at spirit.app answers false, as the word stands two levels below', 0.2, function () { return added('below', 1, false); }, test.limit.quick);
test.run('a refused add writes nothing', 0.2, function () {
  if (!W.run || before === null) return false;
  const now = JSON.stringify([wordsIn('app'), wordsIn('app/table'), wordsIn('app/table/add')]);
  return now === before || false;
}, test.limit.quick);

// add writes what no level on its path holds
test.run('adding sibling at spirit.app answers true, as a word in another branch does not stop it', 0.2, function () {
  // cw, on the object's own keys: "constructor" is a to z.
  return firstOf('writes', [['spirit.app', 'sibling'], ['spirit.app', 'constructor'], ['spirit.fs', 'fresh']], true);
}, test.limit.quick);
test.run('adding constructor at spirit.app answers true, as a word an object inherits is a word like any other', 0.2, function () { return added('writes', 1, true); }, test.limit.quick);
test.run('adding fresh at spirit.fs answers true, and the level with no word.json yet gets one', 0.2, function () { return added('writes', 2, true); }, test.limit.quick);
// Andy, on Q8: "wince fucking when does add() add a MOTHERFUCKING FOLDER?" With no folder there is no level to write to.
// add makes no folder
test.run('adding made at spirit.nosuch.level, a level with no folder, answers false', 0.2, function () {
  return firstOf('noFolder', [['spirit.nosuch.level', 'made']], false);
}, test.limit.quick);
test.run('spirit/nosuch stays absent after that add', 0.2, function () {
  if (!W.run) return false;
  return !fs.existsSync(path.join(W.run, 'spirit', 'nosuch')) || false;
}, test.limit.quick);
// 'path.in.words', and "'word' is a string containing only characters from 'a' to 'z'": a capital is no level.
// add takes no capitals in its path
test.run('adding word at spirit.Capital, a path with a capital, answers false', 0.2, function () {
  return firstOf('capital', [['spirit.Capital', 'word']], false);
}, test.limit.quick);
test.run('adding at spirit.Capital makes no folder of it', 0.2, function () {
  if (!W.run) return false;
  return !fs.existsSync(path.join(W.run, 'spirit', 'Capital')) || false;
}, test.limit.quick);
test.run('both words stand in spirit/app/word.json', 0.2, function () {
  if (!W.run) return false;
  const app = wordsIn('app') || {};
  return (app.sibling === true && Object.prototype.hasOwnProperty.call(app, 'constructor') && app.constructor === true) || false;
}, test.limit.quick);
test.run('the new spirit/fs/word.json holds that word and nothing else', 0.2, function () {
  if (!W.run) return false;
  return JSON.stringify(wordsIn('fs')) === '{"fresh":true}' || false;
}, test.limit.quick);
// Q5, "Should add work from a page too, the way check does?", Andy: "no." word.js's page half, run on a bare window.
test.run('on a page spirit.required.spirit.word.script has check and no add', 0.2, function () {
  const bare = { window: { spirit: {} } };
  require('vm').runInNewContext(fs.readFileSync(path.join(RUN, 'spirit', 'word', 'script.js'), 'utf8'), bare);
  const onPage = bare.window.spirit.required.spirit.word.script || {};
  return (typeof onPage.check === 'function' && onPage.add === undefined) || false;
}, test.limit.quick);
// Whether add takes a word in capitals is the box's "addedWoRD": what lands in the file is a to z either way.
test.run('add of a word in capitals answers a boolean', 0.2, function () {
  if (!W.run) return false;
  const mixed = adds(W.run, [['spirit.contact', 'MiXeD']]);
  return (Array.isArray(mixed.answers) && typeof mixed.answers[0] === 'boolean') || false;
}, test.limit.quick);
test.run('no key but a to z lands in the word file', 0.2, function () {
  if (!W.run) return false;
  return Object.keys(wordsIn('contact') || {}).every(function (k) { return /^[a-z]+$/.test(k); }) || false;
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
    try { o = JSON.parse(fs.readFileSync(path.join(SPIRIT, e.rel), 'utf8')); } catch (err) { T.notJson.push(e.rel); }
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
    Object.keys(here).forEach(function (w) { if (here[w].length > 1) twice.push(w); });
  });
  return (!T.notJson.length && !twice.length) || false;
}, test.limit.quick);
// the tree: "node-side a word 'abc' reservers any 'abc.js' or 'abc/' or 'abc.anything'": nothing below may take a word reserved above it
// Q11, Andy: "the word is defined ONCE, at the "largest" scope", and "spirit/app/data.js is "plugin" of spirit/data/script.js": a file
// below that borrows from the word is no second definition. Only data has a way to show it: the file calls the one helper.
const BORROWS = { data: /\.makeFamily\(/ };
function borrows(e) { const re = BORROWS[stem(e.name)]; return !!re && !e.dir && re.test(fs.readFileSync(path.join(SPIRIT, e.rel), 'utf8')); }
test.run('no folder or file below takes a word reserved above it', 0.2, function () {
  const taken = [];
  tree().forEach(function (e) {
    const where = path.dirname(e.rel);
    if (where === '.' || e.name === 'word.json' || borrows(e)) return;
    above(where).forEach(function (l) {
      // A NAME THAT IS A HARD-CODED WORD IS THAT WORD'S RESERVED USE (goal/G48.5, Q1: "Is a folder or file named by a hard-coded
      // word, as an app's server/, api.js or element.js, that word's reserved use, so word's test lets it stand?" Andy: "yes.").
      if (l.at === 'hard-coded') return;
      if (l.words.indexOf(stem(e.name)) !== -1 && path.dirname(l.at) !== where) taken.push(e.rel);
    });
  });
  return !taken.length || false;
}, test.limit.quick);

// NO HOME ASKED OF A RESERVED WORD (Andy, Q34, "Must every reserved word in word.js have a folder spirit/<word> and a place
// spirit.<word>?": "no. the word system is more about what <word>.js and <word>/ are reserved specifically in app and branch
// folders"). The page the asks below use.
test.run('a browser opens the page of a scratch node, for the asks below', 0.2, async function () {
  const chrome = H.findChrome();
  W.node = await H.scratchNode();
  W.page = chrome && W.node.up ? await H.chromePage(chrome) : null;
  if (!W.page || W.page.error) return false;
  const page = W.page;
  await page.send('Page.navigate', { url: W.node.base + '/' });
  await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.readyPromise)').then(Boolean); }, H.WAIT);
  await page.evaluate('window.spirit.readyPromise.then(function () { return true; })').catch(function () { return false; });
  await H.sleep(2500);
  return true;
}, test.limit.slow);

// NO ASK FOR A word.json THE PAGE KNOWS IS NOT THERE (goal/G43.32). cw, measured on Andy's node: opening Files
// made 1821 requests, 1818 of them 404, all fs.load of a word.json (spirit/app/word.json alone 712 times). Andy:
// "wsl, add a test to test/word.js to make sure this won't happend again." The page holds the node's file list
// (spirit.required.spirit.data.fs), so word.js asks only for a word.json the list holds, and each of those once until the stream
// says it changed. One word.json is planted on the scratch node (spirit/app/word.json, the word zzword); then many
// checks along many paths, every call the page sends recorded as it leaves.
// on a page: no word.json asked that the file list does not hold, each one held asked once
let onPage = null;
test.run('the planted spirit/app/word.json is read, and its word is found at spirit.app and below', 0.2, async function () {
  if (!W.page || W.page.error) return false;
  const page = W.page;
  fs.writeFileSync(path.join(W.node.root, 'spirit', 'run', 'spirit', 'app', 'word.json'), JSON.stringify({ zzword: true }));
  await page.send('Page.navigate', { url: W.node.base + '/' });
  await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.readyPromise)').then(Boolean); }, H.WAIT);
  const asked = await page.evaluate('window.spirit.readyPromise.then(function () { return spirit.requireScript("spirit/fs/script.js"); }).then(function () {' +
    ' return new Promise(function (r) { setTimeout(r, 3000); }); }).then(function () {' +
    ' window.sentWord = []; var keep = function (b) { try { var s = String(b || ""); if (/word\\.json/.test(s)) window.sentWord.push(s); } catch (e) {} };' +
    ' var f = window.fetch; window.fetch = function (u, o) { keep(String(u) + " " + (o && o.body || "")); return f.apply(this, arguments); };' +
    ' var x = XMLHttpRequest.prototype.send; XMLHttpRequest.prototype.send = function (b) { keep(b); return x.apply(this, arguments); };' +
    ' return spirit.requireScript("spirit/word/script.js"); }).then(function () {' +
    ' var paths = ["spirit.app.zz", "spirit.app.table.zz", "spirit.app.table.rows.zz", "spirit.element.search.zz", "spirit.fs.zz", "spirit.contact.zz", "spirit.data.zz", "spirit.app.desk.element.zz"];' +
    ' var asks = []; for (var n = 0; n < 5; n++) paths.forEach(function (p) { asks.push(spirit.required.spirit.word.script.check(p, "zzword")); asks.push(spirit.required.spirit.word.script.check(p, "other")); });' +
    ' return Promise.all(asks); }).then(function (answers) { return new Promise(function (r) { setTimeout(function () { r(answers); }, 1500); }); })' +
    '.then(function (answers) { return JSON.stringify({ sent: window.sentWord, appSees: answers[0], under: answers[2] }); }, function () { return JSON.stringify({ threw: true }); })');
  let got = null;
  try { got = JSON.parse(asked); } catch (e) { got = { threw: true }; }
  onPage = got;
  return (!!got && !got.threw && got.appSees === 'zzword' && got.under === 'zzword') || false;
}, test.limit.slow);
function sentWord() { return (onPage && onPage.sent) || []; }
test.run('of 80 checks along 8 paths, none asks for a word.json the file list does not hold', 0.2, function () {
  const other = sentWord().filter(function (b) { return !/spirit\/app\/word\.json/.test(b); });
  return (!!onPage && !onPage.threw && !other.length) || false;
}, test.limit.quick);
test.run('the one word.json the file list holds, spirit/app/word.json, is asked once at most', 0.2, function () {
  const once = sentWord().filter(function (b) { return /spirit\/app\/word\.json/.test(b); });
  return (!!onPage && !onPage.threw && once.length <= 1) || false;
}, test.limit.quick);

test.after(function () {
  const page = W.page; const node = W.node;
  if (page && page.kid) page.kid.kill();
  if (node && node.child) node.child.kill();
  try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (node && node.root) LOADER.requireScript('spirit/test/headLessChrome.js').freeTree(node); } catch (e) { /* left */ }
  if (W.scratch) { try { fs.rmSync(W.scratch, { recursive: true, force: true }); } catch (e) { /* left */ } }
});
