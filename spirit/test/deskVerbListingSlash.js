'use strict';

// spirit/test/deskVerbListingSlash.js
// goal/G24.5. The item's box:
//   "The desk's verb listing keeps every verb that has a description file."
//   "Test: a verb file whose description holds a "/" is listed by AGENTS.introspect, and item.get is offered to Levant."
// The AGENTS verbs are gone (goal/G30.4): a family folder is listed by its FS.search {q: ''} (spirit/run/spirit/
// introSpector.js family()), which names its files, a verb file as <verb>.json.
//
// WHAT IS ASSERTED
//   1. a scratch folder: AGENTS.md and three verb files, two of whose descriptions hold a "/": FS.search lists all
//      three, and `more` is false.
//   4. the census: in every family folder that has an AGENTS.md (
//      spirit/run/spirit/<namespace>/), every verb file is listed by its FS.search.
// rule/11: through testSupport only; reads files and a scratch folder, starts nothing.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G24.5: ';
const RUN = path.join(__dirname, '..', 'run');
const introSpector = require('../run/spirit/introSpector.js');

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

  test.subHeading('4. the census: every verb file of every family is listed');
  const folders = [];
  fs.readdirSync(path.join(RUN, 'spirit')).forEach(function (n) {
    const dir = path.join(RUN, 'spirit', n);
    if (fs.statSync(dir).isDirectory() && fs.existsSync(path.join(dir, 'AGENTS.md'))) folders.push({ name: 'spirit/' + n, dir: dir, manifest: '', prefix: n + '.' });
  });
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
