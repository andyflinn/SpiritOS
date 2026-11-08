'use strict';

// spirit/run/spirit/app/chat/test/chatClerver-noHeld.js
// CHATCLERVER HAS NO HELD PATH (goal/G43.23, item 6, after goal/G43.17; spec: ./chatClerver-noHeld.md). Andy, G43.17: "Didn't i say remove ALL
// code referencing "admit" and "hold". it was a hair-brained scheme, and it HAS TO GO."
// Moved here from spirit/test/nodeStore-noAdmitHold.js (goal/G43.28; Andy: "you WILL FUCKING PLACE TESTS WHERE THEY FUCKING
// BELONG"): beside the file whose code it reads. Each file's code is read with its comments left out. No node, no port.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// A file's code, comments blanked (line numbers kept); null when the file is not there.
function code(file) {
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, function (m) { return m.replace(/[^\n]/g, ' '); })
    .replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
}
// The lines of a file's code matching re, as "name:line text".
function hits(file, re) {
  const c = code(file);
  if (c === null) return null;
  const out = [];
  c.split('\n').forEach(function (l, i) { if (re.test(l)) out.push(path.basename(file) + ':' + (i + 1) + ' ' + l.trim().slice(0, 100)); });
  return out;
}
// The world: the file is there and its code, comments left out, still holds a line that is surely code.
function world(file, anchor) {
  const c = code(file);
  ok(c !== null && anchor.test(c), 'the world: ' + path.relative(RUN, file) + ' is read, its code holding ' + anchor,
    c === null ? path.relative(RUN, file) + ' is not there: nothing judged' : path.relative(RUN, file) + '\'s code holds no ' + anchor + ': the comment stripper ate it, nothing judged');
  return c !== null;
}

test.startTest('chatClerver-noHeld.js: chatClerver has no held path');

(async function () {
  test.subHeading('chatClerver has no held path: no person.held, no contact.accept for a held key');
  // chatClerver is an app of spirit/app/chat/ since goal/G43.27.
  const cc = path.join(RUN, 'spirit', 'app', 'chat', 'chatClerver.js');
  if (world(cc, /'line\.write'/)) {
    const h = hits(cc, /\bheld\b/);
    ok(!h.length, 'chatClerver\'s code asks nothing held', 'chatClerver still asks held: ' + short(h));
    const a = hits(cc, /contact\.accept\b/);
    ok(!a.length, 'and it calls no contact.accept (the node verb itself stays and is not judged here)', 'chatClerver still calls contact.accept: ' + short(a));
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
