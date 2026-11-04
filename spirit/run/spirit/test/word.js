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
const test = require(path.join(RUN, 'test', 'testReport.js'));
const H = require(path.join(RUN, 'test', 'headLessChrome.js'));

// The box: "word.js will have hardcoded intitialized set of keys", "(this may change)". When it does, so does this line.
const HARD = ['spirit', 'app', 'element', 'contact', 'job'];

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// What word.js answers in a tree: each ask run in one child, whose word.js finds its word.json files by its own place.
function asks(run, list) {
  const code = 'const w = require(' + JSON.stringify(path.join(run, 'spirit', 'word.js')) + ');' +
    'Promise.all(' + JSON.stringify(list) + '.map(function (a) { return Promise.resolve(w.check(a[0], a[1])); }))' +
    '.then(function (r) { console.log("ANSWER" + JSON.stringify({ answers: r, add: typeof w.add })); process.exit(0); },' +
    ' function (e) { console.log("ANSWER" + JSON.stringify({ threw: String(e) })); process.exit(0); });';
  const r = spawnSync(process.execPath, ['-e', code], { cwd: run, encoding: 'utf8', timeout: 30000 });
  const line = String(r.stdout || '').split('\n').filter(function (l) { return l.indexOf('ANSWER') === 0; })[0];
  try { return JSON.parse(line.slice('ANSWER'.length)); } catch (e) { return { threw: String(r.stderr || r.stdout || 'no answer').slice(0, 300) }; }
}

test.startTest('word.js: the reserved words, and the tree held against them (goal/G43.4)');

(async function () {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-word-'));
  const run = path.join(scratch, 'run');
  try {
    const SKIP = ['relay-state', 'node_modules', 'app-state', 'media', 'published', 'brains', 'test'];
    fs.cpSync(RUN, run, { recursive: true, filter: function (src) {
      const rel = path.relative(RUN, src).split(path.sep);
      return !(rel.length === 1 && SKIP.indexOf(rel[0]) !== -1) && rel.indexOf('node_modules') === -1 && rel.indexOf('state') === -1;
    } });
    const plant = function (dir, words) {
      const at = path.join(run, 'spirit', dir);
      fs.mkdirSync(at, { recursive: true });
      const o = {};
      words.forEach(function (w) { o[w] = true; });
      fs.writeFileSync(path.join(at, 'word.json'), JSON.stringify(o));
    };
    plant('app/table/add', ['item']);
    plant('app/table', ['thing']);
    plant('app', ['activate']);
    plant('contact', ['sibling']);
    // The box's own example, "check('spirit.app.table.add', 'Item') will check all these files".
    const cases = [
      ['the box\'s example: the file at the path itself', 'spirit.app.table.add', 'Item', 'item'],
      ['one level up', 'spirit.app.table.add', 'THING', 'thing'],
      ['two levels up', 'spirit.app.table.add', 'aCtIvAtE', 'activate'],
      ['a level with no word.json of its own still looks up', 'spirit.app.table.none', 'thing', 'thing'],
      ['a hard-coded word, from any path, lower-cased', 'spirit.app.table.add', 'Contact', 'contact'],
      ['a hard-coded word, at the root', 'spirit', 'JOB', 'job'],
      ['a word lower down is not seen from above', 'spirit.app', 'thing', null],
      ['a word in another branch is not seen', 'spirit.app.table.add', 'sibling', null],
      ['a word no level holds', 'spirit.app.table.add', 'nothing', null],
      ['not a word: a digit', 'spirit.app', 'app1', null],
      ['not a word: empty', 'spirit.app', '', null],
      // cw, on the object's own keys: "constructor" is a to z.
      ['a word an object inherits is no reserved word', 'spirit.app', 'constructor', null],
    ].concat(HARD.map(function (w) { return ['hard-coded: ' + w, 'spirit', w, w]; }));
    test.subHeading('check: case-insensitive, up its own path and over the hard-coded words, the lower-case word or null');
    const got = asks(run, cases.map(function (c) { return [c[1], c[2]]; }));
    if (!Array.isArray(got.answers)) test.fail('word.js answered nothing: ' + short(got));
    else cases.forEach(function (c, i) {
      ok(got.answers[i] === c[3], c[0] + ': check(' + c[1] + ', ' + c[2] + ') answers ' + JSON.stringify(c[3]), c[0] + ': check(' + c[1] + ', ' + c[2] + ') answered ' + short(got.answers[i]));
    });
    test.subHeading('add: "add() is conceptual AND WILL NOT BE IMPLEMENTED IN THIS ITEM."');
    ok(got.add === 'undefined', 'word.js has no add', 'word.js has an add: ' + short(got.add));
    test.subHeading('a change to a word.json is seen by the next check');
    plant('app', ['activate', 'later']);
    const after = asks(run, [['spirit.app', 'later']]);
    ok(Array.isArray(after.answers) && after.answers[0] === 'later', 'a word written to the file answers', 'after the write: ' + short(after));

    // ── THE TREE, THIS CHECKOUT'S ─────────────────────────────────────────────────────────────────
    const SPIRIT = path.join(RUN, 'spirit');
    const walk = function (dir, rel, out) {
      fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
        // A test folder holds a module's tests, named after it; state is the node's.
        if (e.name === 'node_modules' || e.name === 'test' || (rel === '' && e.name === 'state')) return;
        const r = rel ? rel + '/' + e.name : e.name;
        out.push({ rel: r, dir: e.isDirectory(), name: e.name });
        if (e.isDirectory()) walk(path.join(dir, e.name), r, out);
      });
      return out;
    };
    const tree = walk(SPIRIT, '', []);
    const stem = function (name) { return name.split('.')[0]; };
    const wordsAt = {};
    const fileWords = tree.filter(function (e) { return e.name === 'word.json'; });
    fileWords.forEach(function (e) {
      let o = {};
      try { o = JSON.parse(fs.readFileSync(path.join(SPIRIT, e.rel), 'utf8')); } catch (err) { test.fail(e.rel + ' is no JSON'); }
      wordsAt[path.dirname(e.rel)] = Object.keys(o);
    });
    // The words reserved above a place: the hard-coded ones and those of each word.json on its way up, 'spirit' exempt
    // (the box: "in tests it is exempt from discrepancy rules").
    const above = function (dirRel) {
      const parts = dirRel === '.' || dirRel === '' ? [] : dirRel.split('/');
      const out = [{ at: 'hard-coded', words: HARD.filter(function (w) { return w !== 'spirit'; }) }];
      for (let i = 0; i <= parts.length; i++) {
        const d = i === 0 ? '.' : parts.slice(0, i).join('/');
        if (wordsAt[d]) out.push({ at: d + '/word.json', words: wordsAt[d] });
      }
      return out;
    };
    test.subHeading('the tree: "if word.check() returns !null for the same word defined twice along any specified path, then the test MUST go red."');
    const twice = [];
    Object.keys(wordsAt).forEach(function (d) {
      const lists = above(d);
      const here = {};
      lists.forEach(function (l) { l.words.forEach(function (w) { (here[w] = here[w] || []).push(l.at); }); });
      Object.keys(here).forEach(function (w) { if (here[w].length > 1) twice.push(w + ' in ' + here[w].join(' and ')); });
    });
    ok(!twice.length, 'no word stands twice along a path', 'a word stands twice along a path: ' + twice.join('; '));
    test.subHeading('the tree: "node-side a word \'abc\' reservers any \'abc.js\' or \'abc/\' or \'abc.anything\'": nothing below may take a word reserved above it');
    const taken = [];
    tree.forEach(function (e) {
      const where = path.dirname(e.rel);
      if (where === '.' || e.name === 'word.json') return;
      above(where).forEach(function (l) {
        if (l.words.indexOf(stem(e.name)) !== -1 && !(l.at !== 'hard-coded' && path.dirname(l.at) === where)) taken.push('spirit/' + e.rel + ' (reserved in ' + l.at + ')');
      });
    });
    ok(!taken.length, 'no folder or file below takes a word reserved above it', 'these take a word reserved above them: ' + taken.join('; '));
    // Each reserved word as a home: a folder or a file at its place, and the browser's spirit object holding it.
    test.subHeading('the tree: each hard-coded word has its folder or file, and the browser\'s spirit object has it, both or neither is no answer');
    const chrome = H.findChrome();
    const node = await H.scratchNode();
    let page = null;
    try {
      page = chrome && node.up ? await H.chromePage(chrome) : null;
      if (!page || page.error) test.fail('no browser to ask: ' + short(page ? page.error : 'no Chrome, or the scratch node did not come up'));
      else {
        await page.send('Page.navigate', { url: node.base + '/index.html' });
        await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)').then(Boolean); }, H.WAIT);
        await page.evaluate('window.spirit.ready.then(function () { return true; })').catch(function () { return false; });
        await H.sleep(2500);
        let held = {};
        try { held = JSON.parse(await page.evaluate('JSON.stringify(' + JSON.stringify(HARD) + '.reduce(function (o, k) { o[k] = typeof window.spirit[k]; return o; }, {}))')); } catch (e) { held = {}; }
        HARD.filter(function (w) { return w !== 'spirit'; }).forEach(function (w) {
          const onDisk = tree.some(function (e) { return path.dirname(e.rel) === '.' && stem(e.name) === w; });
          const inObject = held[w] === 'object' || held[w] === 'function';
          ok(onDisk && inObject, w + ': spirit/' + w + ' and spirit.' + w + ' both stand', w + ': on disk ' + onDisk + ', spirit.' + w + ' is ' + short(held[w]) + ': the word and the tree contradict');
        });
      }
    } finally {
      if (page && page.kid) page.kid.kill();
      if (node.child) node.child.kill();
      try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
      try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(process.exitCode || 0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(1); });
