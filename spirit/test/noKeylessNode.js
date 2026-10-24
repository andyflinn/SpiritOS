'use strict';

// spirit/test/noKeylessNode.js
// The idea that a node may not know its own key before it listens is gone
// from the tree, and stays gone (goal/G22.5).
//
// Andy's ruling, 2026-10-13 (goal/G22.5 box): every piece of documentation
// that suggests a node may not know its own key before it listens on its
// local port is rewritten so the idea is gone for good, and it never comes
// back: this suite reads every comment and document in the tree for the
// phrases the idea was written in, and fails if one reappears.
//
// WHAT IS READ: every .js, .json and .md under spirit/run, spirit/test,
// design and agents, and the root *.md files, as git lists them (tracked
// plus new, minus ignored; Andy's vault spirit/run/brains/ is not this
// product). Comment markers are dropped and lines joined, so a phrase that
// a comment wraps across two lines is still found.
//
// WHAT IS EXCUSED:
//   - a dated record (a review, a cycle) that says the old thing with a
//     "Since goal/G22.5" line within the six lines after it: history is not
//     rewritten, it is answered;
//   - this file, which has to spell the phrases to find them.
// Relays are not covered: a relay's key is made by its own boot, and
// "this relay has no key yet" is a different sentence.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const test = require('./testSupport.js');

const REPO = path.join(__dirname, '..', '..');
const SELF = 'spirit/test/noKeylessNode.js';
const MARKER = "DEPRECATED: the node's ID exists before first node-listen.";
const ANSWERED = 'Since goal/G22.5';

// The phrases, lower case, whitespace collapsed. Built from the sweep of
// 2026-10-13: each is a sentence the tree actually carried about NODES.
const PHRASES = [
  'minted by its first claim',
  'minted by the first claim',
  'minted by this function, at the first claim',
  'fresh node is made nameless',
  'loadidentity answers null without a name',
  'a node with no identity yet is answered by the claim path',
  'boots empty',
  'booted without a key',
  'has no key at boot',
  'identity is made on its first claim',
  'a brand-new node has none',
  'before a fresh node has a key',
  'no key until its first claim',
  'node booting before it has a key',
  'gets one when it first joins',
  'makes its own on first claim',
  'identity lands via a first claim',
  'no key even after its claim',
  'nameless node',
  'a keyless node',
  'node has no key yet',
  'board: the node has no key:',
  'node has no identity',
  'no identity to sign with',
  'node with no key holds no presence',
  'nobody to be present as',
];

function files() {
  const out = execSync('git ls-files --cached --others --exclude-standard -- spirit/run spirit/test design agents',
    { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
  fs.readdirSync(REPO).forEach(function (f) { if (/\.md$/i.test(f)) out.push(f); });
  return out.map(function (f) { return f.split('\\').join('/'); }).filter(function (f) {
    if (f === SELF) return false;
    if (f.indexOf('spirit/run/brains/') === 0) return false;
    // THE DESK'S OWN SNAPSHOT OF THE CURRENT GOAL (goal/G22.5): currentGoal.json is written by the desk from the
    // goal's chat and boxes, so it quotes these phrases while the goal discusses removing them. It is data, not
    // documentation or code; named here alone, so nothing else is excused.
    if (f === 'spirit/run/process/js/desk/currentGoal.json') return false;
    if (f.indexOf('/node_modules/') !== -1) return false;
    if (!/\.(js|json|md)$/i.test(f)) return false;
    return fs.existsSync(path.join(REPO, f));
  });
}

// Each line stripped of its comment markers; the text is the lines joined
// by one space, with a map from character offset back to line number.
function scan(rel) {
  const lines = fs.readFileSync(path.join(REPO, rel), 'utf8').split(/\r?\n/);
  let text = '';
  const starts = [];
  lines.forEach(function (raw) {
    const bare = raw.replace(/^\s*(\/\/+|\/\*+|\*+\/?|#+|>)\s?/, '').replace(/\s+/g, ' ').toLowerCase();
    starts.push(text.length);
    text += bare + ' ';
  });
  function lineAt(offset) {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= offset) lo = mid; else hi = mid - 1; }
    return lo;
  }
  const hits = [];
  PHRASES.forEach(function (p) {
    let at = text.indexOf(p);
    while (at !== -1) {
      const first = lineAt(at), last = lineAt(at + p.length - 1);
      let excused = false;
      for (let i = last; i <= Math.min(lines.length - 1, last + 6); i++) if (lines[i].indexOf(ANSWERED) !== -1) excused = true;
      if (!excused) hits.push(rel + ':' + (first + 1) + ' "' + p + '"');
      at = text.indexOf(p, at + 1);
    }
  });
  return hits;
}

test.startTest('goal/G22.5: no comment or document says a node may lack its key before it listens');

const list = files();
if (list.length > 100) test.check('the tree was read', list.length + ' files');
else test.fail('too few files read to mean anything', list.length + ' files');

const hits = [];
list.forEach(function (rel) { hits.push.apply(hits, scan(rel)); });
if (!hits.length) {
  test.check('no line carries a phrase of the keyless-node idea, unless it is answered by a dated line');
} else {
  test.fail(hits.length + ' lines still say a node may lack its key before it listens', hits.slice(0, 40).join('; ') + (hits.length > 40 ? '; …' : ''));
  hits.forEach(function (h) { test.comment(h); });
}

// THE MARKED BRANCHES ARE GONE (Andy, 2026-10-13, goal/G22.5 box): "We still
// need to eliminate all the dead code-branches, that handle 'node has no
// identity yet'." The marker "DEPRECATED: the node's ID exists before first
// node-listen." named them for removal; since goal/G22.5 they are removed, so
// no file in spirit/run, bash or the desk tools carries the marker (or a
// paraphrase of it) or a "DEPRECATED error:" text, whatever its extension,
// and the catalogue holds none of their codes. The desk's currentGoal.json
// snapshot quotes the goal's chat and is excused as above.
function codeFiles() {
  return execSync('git ls-files --cached --others --exclude-standard -- spirit/run bash',
    { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean).map(function (f) {
    return f.split('\\').join('/');
  }).filter(function (f) {
    if (f.indexOf('spirit/run/brains/') === 0) return false;
    if (f === 'spirit/run/process/js/desk/currentGoal.json') return false;
    if (f.indexOf('/node_modules/') !== -1) return false;
    if (/\.(db|png|jpg|jpeg|gif|ico|webp|woff2?|ttf|gguf|bin|zip|gz)$/i.test(f)) return false;
    return fs.existsSync(path.join(REPO, f));
  });
}
const branches = [];
const seen = {};
codeFiles().concat(list).forEach(function (rel) {
  if (seen[rel]) return;
  seen[rel] = true;
  fs.readFileSync(path.join(REPO, rel), 'utf8').split(/\r?\n/).forEach(function (line, i) {
    if (line.indexOf(MARKER) !== -1 || /DEPRECATED: the node/.test(line) || line.indexOf('DEPRECATED error:') !== -1) branches.push(rel + ':' + (i + 1));
  });
});
if (!branches.length) test.check('no DEPRECATED no-identity branch and no "DEPRECATED error:" text is left in spirit/run, bash or the desk tools');
else {
  test.fail(branches.length + ' lines still carry a no-identity branch', branches.slice(0, 40).join(', '));
}

const errors = require('../run/spirit/spiritErrors.js');
['node-no-key', 'node-no-identity', 'no-identity'].forEach(function (code) {
  if (!errors.byCode(code)) test.check('spiritErrors defines no ' + code);
  else test.fail('spiritErrors still defines ' + code, JSON.stringify(errors.byCode(code).texts));
});

test.reportSuccessFailureCount();
