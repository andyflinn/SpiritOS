'use strict';

// spirit/test/deskVerbListingSlash.js
// goal/G24.5. Red on today's code; claude-windows wrote it and builds it (one agent). The item's box is the record:
//   "The desk's verb listing keeps every verb that has a description file."
//   "introSpector.js lists the family with the search query "*", and a single "*" never spans a "/", so a verb whose
//   description holds a "/" is left out silently; item.get ("goal/G14.7, rule/3") has never been listed, and Levant
//   never had desk_item_get."
//   "The fix is in introSpector.js, common code: the query that spans everything, "**", as log.search already uses."
//   "Test: a verb file whose description holds a "/" is listed by AGENTS.introspect, and item.get is offered to Levant."
//
// WHERE, READ AT 1712394c: AGENTS.introspect builds its bucket with `query: '*'` (spirit/run/js/introSpector.js, the
// handler of prefix + 'AGENTS.introspect'), and offers each verb file's description as the label; a label holding a
// "/" never matches a single "*", so the bucket drops it and says nothing (more stays false).
//
// WHAT IS ASSERTED
//   1. a scratch folder: AGENTS.md and three verb files, two of whose descriptions hold a "/": AGENTS.introspect lists
//      all three, and `more` is false.
//   2. the real desk folder, as the desk serves it: AGENTS.introspect lists item.get.
//   3. deskAgent's tools.js, describing the desk through a route answered by that family (as deskAgentVerbFiles.js
//      does), offers desk_item_get.
//   4. the census: every folder that has an AGENTS.md (process/js/<server>/, served by appServer's withAgents, and
//      js/<namespace>/, claimed on the node), every verb file in it is listed by its AGENTS.introspect.
// SINCE goal/G30.4 the AGENTS verbs are gone: a family folder is listed by its FS.search {q: ''} (file names, a verb
// file as <verb>.json), the desk's folder is process/js/desk/desk.family, and tools.js reads each verb file through
// FS.loadJsonValue. Each point above asks the same of the FS listing.
// rule/11: through testSupport only; reads files and a scratch folder, starts nothing.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G24.5: ';
const RUN = path.join(__dirname, '..', 'run');
const DESK_DIR = path.join(RUN, 'process', 'js', 'desk', 'desk.family'); // <module>.family since goal/G30.4
const TOOLS = path.join(RUN, 'process', 'js', 'deskAgent', 'tools.js');
const introSpector = require('../run/js/introSpector.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// The verb files of a folder as introSpector takes them: a .json other than the manifest, a verb-name stem, an object
// with a string description.
function verbFiles(dir, manifest) {
  let names = [];
  try { names = fs.readdirSync(dir); } catch (e) { return []; }
  return names.filter(function (n) {
    if (!/\.json$/.test(n) || n === manifest) return false;
    if (!/^[a-z_][A-Za-z0-9_.-]{0,63}$/.test(n.slice(0, -5))) return false;
    try { const p = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8')); return p && typeof p === 'object' && !Array.isArray(p) && typeof p.description === 'string'; } catch (e) { return false; }
  }).map(function (n) { return n.slice(0, -5); }).sort();
}
// The folder's listing (FS.search with no words), as the verb stems its .json file names give.
async function introspect(made, prefix) {
  const h = made.verbs[prefix + 'FS.search'];
  if (!h) return null;
  const r = await h.handler({ q: '' });
  const files = ((r && r.items) || []).map(function (i) { return String(i.key); });
  return { keys: files.filter(function (k) { return /\.json$/.test(k); }).map(function (k) { return k.slice(0, -5); }), more: !!(r && r.more) };
}
function slashed(dir, stem) {
  try { return /\//.test(JSON.parse(fs.readFileSync(path.join(dir, stem + '.json'), 'utf8')).description); } catch (e) { return false; }
}

test.startTest('goal/G24.5: the desk\'s verb listing keeps every verb that has a description file');

async function suite() {
  test.subHeading('1. a verb file whose description holds a "/" is listed');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-verbslash-'));
  try {
    fs.writeFileSync(path.join(scratch, 'AGENTS.md'), '# scratch\n');
    fs.writeFileSync(path.join(scratch, 'plain.get.json'), JSON.stringify({ description: 'A description with no slash.', request: {} }));
    fs.writeFileSync(path.join(scratch, 'item.get.json'), JSON.stringify({ description: 'One item by id (goal/G14.7, rule/3).', request: { id: '' } }));
    fs.writeFileSync(path.join(scratch, 'path.read.json'), JSON.stringify({ description: 'Reads spirit/run/x.json', request: { path: '' } }));
    const made = introSpector.family(scratch, { declared: ['plain.get', 'item.get', 'path.read'], manifest: 'scratch.json' });
    const got = await introspect(made, '');
    if (got && got.keys.indexOf('plain.get') !== -1) test.check('the world: the scratch family lists plain.get, whose description has no "/"');
    else test.fail('the world: the scratch family listed ' + short(got));
    ['item.get', 'path.read'].forEach(function (v) {
      if (got && got.keys.indexOf(v) !== -1) test.check(v + ', whose description holds a "/", is listed');
      else test.fail(OWED + v + ', whose description holds a "/", is not listed by FS.search; it lists ' + short(got && got.keys) + ' (introSpector.js queries the bucket with "*")');
    });
    if (got && got.keys.length === 3) test.check('all three are listed');
    else test.fail(OWED + 'FS.search listed ' + (got ? got.keys.length : 0) + ' of 3, with more ' + (got && got.more) + ': the drop is silent');
  } finally {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }

  test.subHeading('2. the desk\'s own folder lists item.get');
  const deskStems = verbFiles(DESK_DIR, '');
  if (deskStems.indexOf('item.get') !== -1 && slashed(DESK_DIR, 'item.get')) test.check('the world: desk.family/item.get.json is a verb file, and its description holds a "/"');
  else test.fail('the world: desk.family/item.get.json ' + (deskStems.indexOf('item.get') === -1 ? 'is no verb file' : 'holds no "/"'));
  const desk = introSpector.family(DESK_DIR, { declared: deskStems });
  const deskList = await introspect(desk, '');
  if (deskList && deskList.keys.indexOf('item.get') !== -1) test.check('the desk\'s FS.search lists item.get.json');
  else test.fail(OWED + 'the desk\'s FS.search does not list item.get.json');

  test.subHeading('3. item.get is offered to Levant');
  const deskRoute = {
    ask: function (verb, args) {
      const h = desk.verbs[verb];
      let body = null;
      try { body = h ? h.handler(args || {}) : { ok: false, code: 'no-such-verb' }; } catch (e) { body = { ok: false, code: 'refused' }; }
      return Promise.resolve(body).then(function (b) { return { status: b && b.ok === false ? 404 : 200, body: b, text: JSON.stringify(b) }; });
    },
    verb: function (stem) { return stem; },
    fs: function (name) { return 'FS.' + name; },
  };
  const tools = require(TOOLS).createTools({ routes: { desk: deskRoute }, room: 4000 });
  const described = await tools.describe('desk');
  const names = (described || []).map(function (t) { return t.function && t.function.name; });
  if (names.indexOf('desk_item_get') !== -1) test.check('describe(desk) offers desk_item_get');
  else test.fail(OWED + 'describe(desk) does not offer desk_item_get; it offers ' + names.length + ' desk tools');

  test.subHeading('4. the census: every verb file of every family is listed');
  const folders = [];
  fs.readdirSync(path.join(RUN, 'process', 'js')).forEach(function (n) {
    // <module>.family beside <module>.js since goal/G30.4: the family folder holds no code and no manifest.
    const dir = path.join(RUN, 'process', 'js', n, n + '.family');
    if (fs.existsSync(path.join(dir, 'AGENTS.md'))) folders.push({ name: 'process/js/' + n + '/' + n + '.family', dir: dir, manifest: '', prefix: '' });
  });
  fs.readdirSync(path.join(RUN, 'js')).forEach(function (n) {
    const dir = path.join(RUN, 'js', n);
    if (fs.statSync(dir).isDirectory() && fs.existsSync(path.join(dir, 'AGENTS.md'))) folders.push({ name: 'js/' + n, dir: dir, manifest: '', prefix: n + '.' });
  });
  if (folders.some(function (f) { return f.name === 'process/js/desk/desk.family'; }) && folders.length > 3) test.check('the world: ' + folders.length + ' families found: ' + folders.map(function (f) { return f.name; }).join(', '));
  else test.fail('the world: the families found are ' + short(folders.map(function (f) { return f.name; })));
  for (const f of folders) {
    const stems = verbFiles(f.dir, f.manifest);
    if (!stems.length) continue;
    const made = introSpector.family(f.dir, { declared: stems, manifest: f.manifest, prefix: f.prefix });
    const got = await introspect(made, f.prefix);
    // FS.search names the files, never prefixed: the verb file stem.json, on the node as on a process server.
    const missing = stems.filter(function (s) { return !got || got.keys.indexOf(s) === -1; });
    if (!missing.length) test.check(f.name + ': all ' + stems.length + ' verb files listed');
    else if (got && got.more) test.fail(f.name + ': ' + missing.length + ' of ' + stems.length + ' unlisted with more true (past one answer, not the "/"): ' + missing.join(', '));
    else test.fail(OWED + f.name + ': ' + missing.length + ' of ' + stems.length + ' verb files unlisted, silently: ' + missing.map(function (s) { return s + (slashed(f.dir, s) ? ' ("/")' : ''); }).join(', '));
  }
}

suite().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
