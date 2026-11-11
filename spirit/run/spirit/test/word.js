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
    else {
      // Each case written out, so that each check has a plain title of its own.
      const c = cases, a = got.answers;
      ok(a[0] === c[0][3], 'the box\'s example: the file at the path itself: checking Item at spirit.app.table.add answers item', c[0][0] + ': check(' + c[0][1] + ', ' + c[0][2] + ') answered ' + short(a[0]));
      ok(a[1] === c[1][3], 'one level up: checking THING at spirit.app.table.add answers thing', c[1][0] + ': check(' + c[1][1] + ', ' + c[1][2] + ') answered ' + short(a[1]));
      ok(a[2] === c[2][3], 'two levels up: checking aCtIvAtE at spirit.app.table.add answers activate', c[2][0] + ': check(' + c[2][1] + ', ' + c[2][2] + ') answered ' + short(a[2]));
      ok(a[3] === c[3][3], 'a level with no word.json of its own still looks up: checking thing at spirit.app.table.none answers thing', c[3][0] + ': check(' + c[3][1] + ', ' + c[3][2] + ') answered ' + short(a[3]));
      ok(a[4] === c[4][3], 'a hard-coded word, from any path, lower-cased: checking Identity at spirit.app.table.add answers identity', c[4][0] + ': check(' + c[4][1] + ', ' + c[4][2] + ') answered ' + short(a[4]));
      ok(a[5] === c[5][3], 'a hard-coded word, at the root: checking JOB at spirit answers job', c[5][0] + ': check(' + c[5][1] + ', ' + c[5][2] + ') answered ' + short(a[5]));
      ok(a[6] === c[6][3], 'a word lower down is not seen from above: checking thing at spirit.app answers null', c[6][0] + ': check(' + c[6][1] + ', ' + c[6][2] + ') answered ' + short(a[6]));
      ok(a[7] === c[7][3], 'a word in another branch is not seen: checking sibling at spirit.app.table.add answers null', c[7][0] + ': check(' + c[7][1] + ', ' + c[7][2] + ') answered ' + short(a[7]));
      ok(a[8] === c[8][3], 'a word no level holds: checking nothing at spirit.app.table.add answers null', c[8][0] + ': check(' + c[8][1] + ', ' + c[8][2] + ') answered ' + short(a[8]));
      ok(a[9] === c[9][3], 'not a word: a digit: checking app1 at spirit.app answers null', c[9][0] + ': check(' + c[9][1] + ', ' + c[9][2] + ') answered ' + short(a[9]));
      ok(a[10] === c[10][3], 'not a word: empty: checking an empty word at spirit.app answers null', c[10][0] + ': check(' + c[10][1] + ', ' + c[10][2] + ') answered ' + short(a[10]));
      ok(a[11] === c[11][3], 'a word an object inherits is no reserved word: checking constructor at spirit.app answers null', c[11][0] + ': check(' + c[11][1] + ', ' + c[11][2] + ') answered ' + short(a[11]));
      ok(a[12] === c[12][3], 'hard-coded: spirit: checking spirit at spirit answers spirit', c[12][0] + ': check(' + c[12][1] + ', ' + c[12][2] + ') answered ' + short(a[12]));
      ok(a[13] === c[13][3], 'hard-coded: app: checking app at spirit answers app', c[13][0] + ': check(' + c[13][1] + ', ' + c[13][2] + ') answered ' + short(a[13]));
      ok(a[14] === c[14][3], 'hard-coded: element: checking element at spirit answers element', c[14][0] + ': check(' + c[14][1] + ', ' + c[14][2] + ') answered ' + short(a[14]));
      ok(a[15] === c[15][3], 'hard-coded: identity: checking identity at spirit answers identity', c[15][0] + ': check(' + c[15][1] + ', ' + c[15][2] + ') answered ' + short(a[15]));
      ok(a[16] === c[16][3], 'hard-coded: job: checking job at spirit answers job', c[16][0] + ': check(' + c[16][1] + ', ' + c[16][2] + ') answered ' + short(a[16]));
      ok(a[17] === c[17][3], 'hard-coded: data: checking data at spirit answers data', c[17][0] + ': check(' + c[17][1] + ', ' + c[17][2] + ') answered ' + short(a[17]));
      ok(a[18] === c[18][3], 'hard-coded: search: checking search at spirit answers search', c[18][0] + ': check(' + c[18][1] + ', ' + c[18][2] + ') answered ' + short(a[18]));
    }
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
      if (!Array.isArray(r.answers)) { test.fail('add answered nothing: ' + short(r)); return null; }
      return r.answers;
    };
    plant('app', ['later']);
    let added;
    added = addCases('add: the box\'s example, "add(\'spirit.app\', \'activate\') would add the \'activate\' to run://spirit/app/word.json"', [
      ['a new word', 'spirit.app', 'activate', true],
      ['"a boolean \'false\' if the word already exists"', 'spirit.app', 'activate', false],
    ]);
    if (added) {
      ok(added[0] === true, 'a new word: adding activate at spirit.app answers true', 'a new word: add(spirit.app, activate) answered ' + short(added[0]));
      ok(added[1] === false, '"a boolean \'false\' if the word already exists": adding activate at spirit.app answers false', '"a boolean \'false\' if the word already exists": add(spirit.app, activate) answered ' + short(added[1]));
    }
    let app = wordsIn('app') || {};
    ok(app.activate === true, 'the word stands in spirit/app/word.json with the value true', 'spirit/app/word.json after add: ' + short(app));
    ok(app.later === true, 'the words already in that file stay', 'spirit/app/word.json lost a word: ' + short(app));
    const seen = asks(run, [['spirit.app', 'activate'], ['spirit.app.table.add', 'activate'], ['spirit.contact', 'activate']]);
    ok(Array.isArray(seen.answers) && seen.answers[0] === 'activate', 'check finds the added word at its level', 'check at its level: ' + short(seen));
    ok(Array.isArray(seen.answers) && seen.answers[1] === 'activate', 'and below it (the box: "for that level and below")', 'check below it: ' + short(seen));
    ok(Array.isArray(seen.answers) && seen.answers[2] === null, 'and not in another branch', 'check in another branch: ' + short(seen));

    const before = JSON.stringify([wordsIn('app'), wordsIn('app/table'), wordsIn('app/table/add')]);
    added = addCases('add refuses what is no word: "\'word\' is a string containing only characters from \'a\' to \'z\'"', [
      ['a digit', 'spirit.app', 'app1', false],
      ['empty', 'spirit.app', '', false],
      ['a space', 'spirit.app', 'a b', false],
      ['a dash', 'spirit.app', 'new-word', false],
    ]);
    if (added) {
      ok(added[0] === false, 'a digit: adding app1 at spirit.app answers false', 'a digit: add(spirit.app, app1) answered ' + short(added[0]));
      ok(added[1] === false, 'empty: adding an empty word at spirit.app answers false', 'empty: add(spirit.app, ) answered ' + short(added[1]));
      ok(added[2] === false, 'a space: adding a b at spirit.app answers false', 'a space: add(spirit.app, a b) answered ' + short(added[2]));
      ok(added[3] === false, 'a dash: adding new-word at spirit.app answers false', 'a dash: add(spirit.app, new-word) answered ' + short(added[3]));
    }
    added = addCases('add refuses what check finds: "no words can be added that already exists toward the root of the tree"', [
      ['a hard-coded word, in any case', 'spirit.app.table', 'IdEnTiTy', false],
      ['a word one level toward the root', 'spirit.app.table.add', 'THING', false],
      ['a word two levels toward the root', 'spirit.app.table.add', 'later', false],
    ]);
    if (added) {
      ok(added[0] === false, 'a hard-coded word, in any case: adding IdEnTiTy at spirit.app.table answers false', 'a hard-coded word, in any case: add(spirit.app.table, IdEnTiTy) answered ' + short(added[0]));
      ok(added[1] === false, 'a word one level toward the root: adding THING at spirit.app.table.add answers false', 'a word one level toward the root: add(spirit.app.table.add, THING) answered ' + short(added[1]));
      ok(added[2] === false, 'a word two levels toward the root: adding later at spirit.app.table.add answers false', 'a word two levels toward the root: add(spirit.app.table.add, later) answered ' + short(added[2]));
    }
    // Andy's yes to cw's Q4, "If a level below already holds the word, should add refuse it, rather than let the word test go red?"
    added = addCases('add refuses a word a level below holds (Q4)', [
      ['one level below', 'spirit.app', 'thing', false],
      ['two levels below', 'spirit.app', 'item', false],
    ]);
    if (added) {
      ok(added[0] === false, 'one level below: adding thing at spirit.app answers false', 'one level below: add(spirit.app, thing) answered ' + short(added[0]));
      ok(added[1] === false, 'two levels below: adding item at spirit.app answers false', 'two levels below: add(spirit.app, item) answered ' + short(added[1]));
    }
    ok(JSON.stringify([wordsIn('app'), wordsIn('app/table'), wordsIn('app/table/add')]) === before, 'a refused add writes nothing', 'a refused add changed a word.json: ' + JSON.stringify([wordsIn('app'), wordsIn('app/table'), wordsIn('app/table/add')]));

    added = addCases('add writes what no level on its path holds', [
      ['a word in another branch does not stop it', 'spirit.app', 'sibling', true],
      // cw, on the object's own keys: "constructor" is a to z.
      ['a word an object inherits is a word like any other', 'spirit.app', 'constructor', true],
      ['a level with no word.json yet gets one', 'spirit.fs', 'fresh', true],
    ]);
    if (added) {
      ok(added[0] === true, 'a word in another branch does not stop it: adding sibling at spirit.app answers true', 'a word in another branch does not stop it: add(spirit.app, sibling) answered ' + short(added[0]));
      ok(added[1] === true, 'a word an object inherits is a word like any other: adding constructor at spirit.app answers true', 'a word an object inherits is a word like any other: add(spirit.app, constructor) answered ' + short(added[1]));
      ok(added[2] === true, 'a level with no word.json yet gets one: adding fresh at spirit.fs answers true', 'a level with no word.json yet gets one: add(spirit.fs, fresh) answered ' + short(added[2]));
    }
    // Andy, on Q8: "wince fucking when does add() add a MOTHERFUCKING FOLDER?" With no folder there is no level to write to.
    added = addCases('add makes no folder', [['a level with no folder', 'spirit.nosuch.level', 'made', false]]);
    if (added) {
      ok(added[0] === false, 'a level with no folder: adding made at spirit.nosuch.level answers false', 'a level with no folder: add(spirit.nosuch.level, made) answered ' + short(added[0]));
    }
    ok(!fs.existsSync(path.join(run, 'spirit', 'nosuch')), 'and spirit/nosuch stays absent', 'add made spirit/nosuch');
    // 'path.in.words', and "'word' is a string containing only characters from 'a' to 'z'": a capital is no level.
    added = addCases('add takes no capitals in its path', [['a capital in the path', 'spirit.Capital', 'word', false]]);
    if (added) {
      ok(added[0] === false, 'a capital in the path: adding word at spirit.Capital answers false', 'a capital in the path: add(spirit.Capital, word) answered ' + short(added[0]));
    }
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
        // Each hard-coded word written out, so that each check has a plain title of its own.
        const stands = function (w) {
          const onDisk = tree.some(function (e) { return path.dirname(e.rel) === '.' && stem(e.name) === w; });
          const inObject = held[w] === 'object' || held[w] === 'function';
          return { fine: onDisk && inObject, why: w + ': on disk ' + onDisk + ', spirit.' + w + ' is ' + short(held[w]) + ': the word and the tree contradict' };
        };
        let s;
        s = stands('app'); ok(s.fine, 'app: spirit/app and spirit.app both stand', s.why);
        s = stands('element'); ok(s.fine, 'element: spirit/element and spirit.element both stand', s.why);
        s = stands('identity'); ok(s.fine, 'identity: spirit/identity and spirit.identity both stand', s.why);
        s = stands('job'); ok(s.fine, 'job: spirit/job and spirit.job both stand', s.why);
        s = stands('data'); ok(s.fine, 'data: spirit/data and spirit.data both stand', s.why);
        s = stands('search'); ok(s.fine, 'search: spirit/search and spirit.search both stand', s.why);

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
