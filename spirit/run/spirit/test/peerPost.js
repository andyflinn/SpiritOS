'use strict';

// spirit/run/spirit/test/peerPost.js
// PEERPOST.JS MARKS NO ADMITTED (goal/G43.23, item 6, after goal/G43.17; spec: ./peerPost.md). Andy, G43.17: "Didn't i say remove ALL
// code referencing "admit" and "hold". it was a hair-brained scheme, and it HAS TO GO."
// Moved here from spirit/test/nodeStore-noAdmitHold.js (goal/G43.28; Andy: "you WILL FUCKING PLACE TESTS WHERE THEY FUCKING
// BELONG"): beside the file whose code it reads. Each file's code is read with its comments left out. No node, no port.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

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

// the traffic log's admitted mark: peerPost
const f = path.join(RUN, 'spirit', 'peerPost.js');
// The world: the file is there and its code, comments left out, still holds a line that is surely code.
test.run('the world: the file is read, and its code, comments left out, still holds a line of code', 0.2, function () {
  const c = code(f);
  return (c !== null && /module\.exports/.test(c)) ||
    (c === null ? path.relative(RUN, f) + ' is not there: nothing judged' : path.relative(RUN, f) + '\'s code holds no /module\\.exports/: the comment stripper ate it, nothing judged');
}, test.limit.quick);
test.run('peerPost.js\'s code names no admitted mark', 0.2, function () {
  const h = hits(f, /admit/i);
  if (h === null) return 'peerPost.js is not there: nothing judged';
  return !h.length || 'peerPost.js\'s code still marks or reads admitted: ' + short(h);
}, test.limit.quick);
