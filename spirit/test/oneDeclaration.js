'use strict';

// spirit/test/oneDeclaration.js
// NO NAME IS DECLARED TWICE IN ONE SCOPE.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────
//
// On 2026-09-13, two edits to relay.js each went wrong in a way nothing
// could see:
//
//   a span cut bounded by "the next thing I expect to find" deleted
//     handleRelayClaim, handleSseConnection, four job handlers and
//     handleFsSave along with its target
//   a repair for that pasted a block back and DUPLICATED five functions —
//     deviceOffer, post, settleHere, deviceAnswerFrom and forgetPeer —
//     294 lines of stale copy
//
// Neither is a syntax error. `node --check` passes, every suite passes,
// and the process runs: in JavaScript the LAST declaration wins, so a
// duplicate is invisible until somebody edits the copy that loses.
//
// The same day and the same file also grew a second `isOwner` — mine,
// beside one that was already there with different argument semantics
// (`party.peer.publicKey` vs `who.publicKey`). The old one had no
// callers, so nothing broke. Had it had one, it would have silently
// started answering false.
//
// ── WHAT IT CHECKS, AND WHY IT IS SCOPE-AWARE ────────────────────────
//
// Two functions may share a name legitimately when they live in
// different closures — arrivals.js has `note` in both createArrivals and
// createFanOut, and that is correct. So a flat per-file count would cry
// wolf and be switched off.
//
// This tracks the enclosing function path by brace depth, so
// `createArrivals > note` and `createFanOut > note` are different, while
// `createRelay > isOwner` twice is a collision.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const RUN = path.join(__dirname, '..', 'run');

test.startTest('One declaration per name per scope, under spirit/run/');

function jsFilesUnder(dir, out) {
  out = out || [];
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (e) { return out; }
  entries.forEach(function (e) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      // Somebody else's code, and not ours to be tidy about.
      if (e.name === 'node_modules') return;
      jsFilesUnder(full, out);
    } else if (e.name.endsWith('.js')) {
      out.push(full);
    }
  });
  return out;
}

// Deliberately crude: strings and comments can carry braces, and a
// counter that believes them drifts. What saves it is that a drifted
// depth still names the SAME scope for two declarations sitting next to
// each other, which is the case this is for — and that it never reports
// a name unless it saw it declared twice under one path.
function declarations(src) {
  const found = [];
  const stack = [];
  let depth = 0;

  src.split('\n').forEach(function (line, n) {
    const m = /^(\s*)function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(line);
    if (m) {
      while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
      found.push({
        name: m[2],
        line: n + 1,
        scope: stack.map(function (f) { return f.name; }).join(' > ') || '(file)',
      });
      stack.push({ name: m[2], depth: depth });
    }
    for (let i = 0; i < line.length; i += 1) {
      if (line[i] === '{') depth += 1;
      else if (line[i] === '}') depth -= 1;
    }
  });
  return found;
}

const files = jsFilesUnder(RUN);
test.subHeading('Scanned ' + files.length + ' file(s)');

const collisions = [];
files.forEach(function (file) {
  const seen = Object.create(null);
  declarations(fs.readFileSync(file, 'utf8')).forEach(function (d) {
    const key = d.scope + ' > ' + d.name;
    if (seen[key]) {
      collisions.push(path.relative(RUN, file) + '  ' + key +
        '  lines ' + seen[key] + ' and ' + d.line);
    } else {
      seen[key] = d.line;
    }
  });
});

if (!collisions.length) {
  test.check('no function is declared twice in the same scope');
} else {
  test.fail(collisions.join('; ') + ' — the LAST declaration wins in ' +
    'JavaScript, so a duplicate runs fine and hides until somebody edits ' +
    'the copy that loses. Usually a bad paste or an over-wide cut.');
}

// AND THE SCANNER IS NOT ASLEEP. Both halves: it must catch a real
// collision, and it must NOT flag two closures that legitimately share a
// name — which is the false positive that would get it switched off.
(function itCanFail() {
  const collides = declarations([
    'function outer() {',
    '  function twice() {}',
    '  function twice() {}',
    '}',
  ].join('\n'));
  const caught = collides.filter(function (d) { return d.name === 'twice'; });
  const sameScope = caught.length === 2 && caught[0].scope === caught[1].scope;

  const apart = declarations([
    'function first() {',
    '  function note() {}',
    '}',
    'function second() {',
    '  function note() {}',
    '}',
  ].join('\n'));
  const notes = apart.filter(function (d) { return d.name === 'note'; });
  const differentScopes = notes.length === 2 && notes[0].scope !== notes[1].scope;

  if (sameScope && differentScopes) {
    test.check('and it tells a real collision from two closures that share a name');
  } else {
    test.fail('the scanner proves nothing: sameScope=' + sameScope +
      ' differentScopes=' + differentScopes);
  }
})();

test.reportSuccessFailureCount();
