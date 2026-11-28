'use strict';

// spirit/run/spirit/fuckingGarbage/factRow/test/script.js
// The tests of spirit/fuckingGarbage/factRow/script.js, and of no other module. The old shell's fact row, moved off the
// hand-made spirit.shell (goal/G49.23, box v21: "factRow to spirit/fuckingGarbage/factRow/script.js, the contact detail
// requiring it by that path"; Andy: "that sounds like spirit/fuckingGarbage/ to me....").

const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/testicle/testReport/script.js');
const SUBJECT = 'spirit/fuckingGarbage/factRow/script.js';
const H = LOADER.requireScript('spirit/testicle/headLessChrome/script.js');

// Run as a page's loader runs it, in a world of its own: what it puts out.
let out = null;
try {
  const w = { escape: null };
  w.window = w;
  w.spirit = { escapeHtml: LOADER.escapeHtml, required: {}, requireScript: function () { return new Promise(function () {}); } };
  vm.createContext(w);
  out = H.runAsPage(SUBJECT, w);
} catch (e) { out = null; }

test.run('it puts out an object holding factRow, a function (a function stands inside an object)', 0.2, function () {
  return (!!out && typeof out === 'object' && typeof out.factRow === 'function') || false;
}, test.limit.quick);
test.run('factRow draws a fact row of label and value pairs, as the shell\'s boot drew it', 0.2, function () {
  if (!out || typeof out.factRow !== 'function') return false;
  return out.factRow([['Name', 'carl'], ['Key', 'k1']]) === '<div class="fact-row"><div class="fact"><span class="fact-label">Name</span><span class="fact-value">carl</span></div><div class="fact"><span class="fact-label">Key</span><span class="fact-value">k1</span></div></div>' || false;
}, test.limit.quick);
test.run('factRow escapes what it shows', 0.2, function () {
  if (!out || typeof out.factRow !== 'function') return false;
  return out.factRow([['<b>', 'a&b']]).indexOf('&lt;b&gt;') !== -1 && out.factRow([['<b>', 'a&b']]).indexOf('a&amp;b') !== -1 || false;
}, test.limit.quick);
test.run('it puts nothing on spirit.shell', 0.2, function () {
  return !/spirit\.shell\b/.test(require('fs').readFileSync(path.join(RUN, SUBJECT), 'utf8')) || false;
}, test.limit.quick);
