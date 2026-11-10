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

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
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

test.startTest('word.js: the reserved words, and the tree held against them (goal/G43.4)');

(async function () {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-word-'));
  const run = path.join(scratch, 'run');
  try {
    const SKIP = ['relay-state', 'app-state', 'media', 'published', 'brains', 'test'];
    fs.cpSync(RUN, run, { recursive: true, filter: function (src) {
      const rel = path.relative(RUN, src).split(path.sep);
      return !(rel.length === 1 && SKIP.indexOf(rel[0]) !== -1) && !VENDORED_FOLDERS.holds(path.relative(RUN, src)) && rel.indexOf('state') === -1;
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
    test.subHeading('check: case-insensitive, up its own path and over the hard-coded words, the lower-case word or null');
    const got = asks(run, cases.map(function (c) { return [c[1], c[2]]; }));
    if (!Array.isArray(got.answers)) test.fail('word.js answered nothing: ' + short(got));
    else cases.forEach(function (c, i) {
      ok(got.answers[i] === c[3], c[0] + ': check(' + c[1] + ', ' + c[2] + ') answers ' + JSON.stringify(c[3]), c[0] + ': check(' + c[1] + ', ' + c[2] + ') answered ' + short(got.answers[i]));
    });
    test.subHeading('a change to a word.json is seen by the next check');
    plant('app', ['activate', 'later']);
    const after = asks(run, [['spirit.app', 'later']]);
    ok(Array.isArray(after.answers) && after.answers[0] === 'later', 'a word written to the file answers', 'after the write: ' + short(after));

    // ── ADD, Andy: "all, implement add()" ──────────────────────────────────────────
    const wordsIn = function (dir) {
      try { return JSON.parse(fs.readFileSync(path.join(run, 'spirit', dir, 'word.json'), 'utf8')); } catch (e) { return null; }
    };
    // Each case: why, the level, the word, what add answers, and what must then stand in that level's word.json.
    const addCases = function (heading, list) {
      test.subHeading(heading);
      const r = adds(run, list.map(function (c) { return [c[1], c[2]]; }));
      if (!Array.isArray(r.answers)) { test.fail('add answered nothing: ' + short(r)); return; }
      list.forEach(function (c, i) {
        ok(r.answers[i] === c[3], c[0] + ': add(' + c[1] + ', ' + c[2] + ') answers ' + c[3], c[0] + ': add(' + c[1] + ', ' + c[2] + ') answered ' + short(r.answers[i]));
      });
    };
    plant('app', ['later']);
    addCases('add: the box\'s example, "add(\'spirit.app\', \'activate\') would add the \'activate\' to run://spirit/app/word.json"', [
      ['a new word', 'spirit.app', 'activate', true],
      ['"a boolean \'false\' if the word already exists"', 'spirit.app', 'activate', false],
    ]);
    let app = wordsIn('app') || {};
    ok(app.activate === true, 'the word stands in spirit/app/word.json with the value true', 'spirit/app/word.json after add: ' + short(app));
    ok(app.later === true, 'the words already in that file stay', 'spirit/app/word.json lost a word: ' + short(app));
    const seen = asks(run, [['spirit.app', 'activate'], ['spirit.app.table.add', 'activate'], ['spirit.contact', 'activate']]);
    ok(Array.isArray(seen.answers) && seen.answers[0] === 'activate', 'check finds the added word at its level', 'check at its level: ' + short(seen));
    ok(Array.isArray(seen.answers) && seen.answers[1] === 'activate', 'and below it (the box: "for that level and below")', 'check below it: ' + short(seen));
    ok(Array.isArray(seen.answers) && seen.answers[2] === null, 'and not in another branch', 'check in another branch: ' + short(seen));

    const before = JSON.stringify([wordsIn('app'), wordsIn('app/table'), wordsIn('app/table/add')]);
    addCases('add refuses what is no word: "\'word\' is a string containing only characters from \'a\' to \'z\'"', [
      ['a digit', 'spirit.app', 'app1', false],
      ['empty', 'spirit.app', '', false],
      ['a space', 'spirit.app', 'a b', false],
      ['a dash', 'spirit.app', 'new-word', false],
    ]);
    addCases('add refuses what check finds: "no words can be added that already exists toward the root of the tree"', [
      ['a hard-coded word, in any case', 'spirit.app.table', 'IdEnTiTy', false],
      ['a word one level toward the root', 'spirit.app.table.add', 'THING', false],
      ['a word two levels toward the root', 'spirit.app.table.add', 'later', false],
    ]);
    // Andy's yes to cw's Q4, "If a level below already holds the word, should add refuse it, rather than let the word test go red?"
    addCases('add refuses a word a level below holds (Q4)', [
      ['one level below', 'spirit.app', 'thing', false],
      ['two levels below', 'spirit.app', 'item', false],
    ]);
    ok(JSON.stringify([wordsIn('app'), wordsIn('app/table'), wordsIn('app/table/add')]) === before, 'a refused add writes nothing', 'a refused add changed a word.json: ' + JSON.stringify([wordsIn('app'), wordsIn('app/table'), wordsIn('app/table/add')]));

    addCases('add writes what no level on its path holds', [
      ['a word in another branch does not stop it', 'spirit.app', 'sibling', true],
      // cw, on the object's own keys: "constructor" is a to z.
      ['a word an object inherits is a word like any other', 'spirit.app', 'constructor', true],
      ['a level with no word.json yet gets one', 'spirit.fs', 'fresh', true],
    ]);
    // Andy, on Q8: "wince fucking when does add() add a MOTHERFUCKING FOLDER?" With no folder there is no level to write to.
    addCases('add makes no folder', [['a level with no folder', 'spirit.nosuch.level', 'made', false]]);
    ok(!fs.existsSync(path.join(run, 'spirit', 'nosuch')), 'and spirit/nosuch stays absent', 'add made spirit/nosuch');
    // 'path.in.words', and "'word' is a string containing only characters from 'a' to 'z'": a capital is no level.
    addCases('add takes no capitals in its path', [['a capital in the path', 'spirit.Capital', 'word', false]]);
    ok(!fs.existsSync(path.join(run, 'spirit', 'Capital')), 'and makes no folder of it', 'add made spirit/Capital');
    app = wordsIn('app') || {};
    ok(app.sibling === true && Object.prototype.hasOwnProperty.call(app, 'constructor') && app.constructor === true, 'both words stand in spirit/app/word.json', 'spirit/app/word.json: ' + short(app));
    ok(JSON.stringify(wordsIn('fs')) === '{"fresh":true}', 'the new spirit/fs/word.json holds that word and nothing else', 'spirit/fs/word.json: ' + short(wordsIn('fs')));
    // Q5, "Should add work from a page too, the way check does?", Andy: "no." word.js's page half, run on a bare window.
    const bare = { window: { spirit: {} } };
    require('vm').runInNewContext(fs.readFileSync(path.join(RUN, 'spirit', 'word.js'), 'utf8'), bare);
    const onPage = bare.window.spirit.word || {};
    ok(typeof onPage.check === 'function' && onPage.add === undefined, 'on a page spirit.word has check and no add (Q5)', 'on a page spirit.word has check ' + typeof onPage.check + ', add ' + typeof onPage.add);
    // Whether add takes a word in capitals is the box's "addedWoRD": what lands in the file is a to z either way.
    const mixed = adds(run, [['spirit.contact', 'MiXeD']]);
    ok(Array.isArray(mixed.answers) && typeof mixed.answers[0] === 'boolean', 'add of a word in capitals answers a boolean', 'add of a word in capitals: ' + short(mixed));
    ok(Object.keys(wordsIn('contact') || {}).every(function (k) { return /^[a-z]+$/.test(k); }), 'and no key but a to z lands in the file', 'spirit/contact/word.json: ' + short(wordsIn('contact')));

    // ── THE TREE, THIS CHECKOUT'S ─────────────────────────────────────────────────────────────────
    const SPIRIT = path.join(RUN, 'spirit');
    const walk = function (dir, rel, out) {
      fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
        // A test folder holds a module's tests, named after it; state is the node's.
        if (VENDORED_FOLDERS.holds(path.join(dir, e.name)) || e.name === 'test' || (rel === '' && e.name === 'state')) return;
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
    // Q11, Andy: "the word is defined ONCE, at the "largest" scope", and "spirit/app/data.js is "plugin" of spirit/data.js": a file
    // below that borrows from the word is no second definition. Only data has a way to show it: the file calls the one helper.
    const BORROWS = { data: /\.makeFamily\(/ };
    const borrows = function (e) { const re = BORROWS[stem(e.name)]; return !!re && !e.dir && re.test(fs.readFileSync(path.join(SPIRIT, e.rel), 'utf8')); };
    const taken = [];
    tree.forEach(function (e) {
      const where = path.dirname(e.rel);
      if (where === '.' || e.name === 'word.json' || borrows(e)) return;
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
        await page.send('Page.navigate', { url: node.base + '/' });
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

        // NO ASK FOR A word.json THE PAGE KNOWS IS NOT THERE (goal/G43.32). cw, measured on Andy's node: opening Files
        // made 1821 requests, 1818 of them 404, all fs.load of a word.json (spirit/app/word.json alone 712 times). Andy:
        // "wsl, add a test to test/word.js to make sure this won't happend again." The page holds the node's file list
        // (spirit.data.fs), so word.js asks only for a word.json the list holds, and each of those once until the stream
        // says it changed. One word.json is planted on the scratch node (spirit/app/word.json, the word zzword); then many
        // checks along many paths, every call the page sends recorded as it leaves.
        test.subHeading('on a page: no word.json asked that the file list does not hold, each one held asked once');
        fs.writeFileSync(path.join(node.root, 'spirit', 'run', 'spirit', 'app', 'word.json'), JSON.stringify({ zzword: true }));
        await page.send('Page.navigate', { url: node.base + '/' });
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
        const sent = (got && got.sent) || [];
        const other = sent.filter(function (b) { return !/spirit\/app\/word\.json/.test(b); });
        const once = sent.filter(function (b) { return /spirit\/app\/word\.json/.test(b); });
        ok(!!got && !got.threw && got.appSees === 'zzword' && got.under === 'zzword', 'the world: the planted spirit/app/word.json is read, its word found at spirit.app and below', 'the planted word.json was not read: ' + short(got));
        ok(!!got && !got.threw && !other.length, 'of 80 checks along 8 paths, none asks for a word.json the file list does not hold', other.length + ' asks for a word.json that is not there: ' + short(other.slice(0, 4)));
        ok(!!got && !got.threw && once.length <= 1, 'and the one it holds, spirit/app/word.json, is asked once at most', 'spirit/app/word.json was asked ' + once.length + ' times');
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
