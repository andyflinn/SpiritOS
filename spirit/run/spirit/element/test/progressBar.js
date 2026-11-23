'use strict';

// spirit/run/spirit/element/test/progressBar.js
// The tests of spirit/element/progressBar.js, and of no other module (spec: ./progressBar.md). Its own test, owed since the
// rule "every production script has its own test" (goal/G47.1, box v72).
//
// The progress bar (goal/G29.14): one shared shell element, drawn from (done, total, text). The browser file runs in node
// on a window of its own, placing itself by the real installSpiritElement (spirit/test/headLessChrome.js pageSpirit); the
// markup it answers is read as text.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/element/progressBar.js';
const FILE = path.join(RUN, SUBJECT);

const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

let P = null;
const tagOf = function (html) { return (/<progress[^>]*>/.exec(html) || [''])[0]; };
const wordsOf = function (html) { return ((/<span class="job-manifest-note">([^<]*)<\/span>/.exec(html)) || [null, null])[1]; };

test.run('it runs on a window of its own and places itself at spirit.required.spirit.element.progressBar', 0.2, async function () {
  const win = { Math: Math, Number: Number, String: String, Promise: Promise };
  win.window = win;
  win.spirit = { element: {} };
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(win.spirit, null, { window: win, real: [SUBJECT] });
  win.spirit.requireScript(SUBJECT);
  await settle();
  P = ((win.spirit.required.spirit || {}).element || {}).progressBar;
  return typeof P === 'function' || false;
}, test.limit.quick);

// the box: "progressBar: one shared shell element drawn from (done, total, text)"
test.run('done of total draws a progress tag with max the total and value the done, the words done/total and the text', 0.2, function () {
  if (!P) return false;
  const h = P(3, 10, 'files');
  return (/max="10"/.test(tagOf(h)) && /value="3"/.test(tagOf(h)) && wordsOf(h) === '3/10 files' && /^<span class="progress-bar">/.test(h)) || false;
}, test.limit.quick);
test.run('with no text the words are done/total alone', 0.2, function () {
  if (!P) return false;
  return wordsOf(P(1, 2)) === '1/2' || false;
}, test.limit.quick);
// the box: "total 0 shows indeterminate"
test.run('total 0 shows indeterminate: a progress tag with no value, and the text alone', 0.2, function () {
  if (!P) return false;
  const h = P(5, 0, 'waiting');
  return (!/value=/.test(tagOf(h)) && !/max=/.test(tagOf(h)) && tagOf(h) !== '' && wordsOf(h) === 'waiting') || false;
}, test.limit.quick);
test.run('total 0 and no text shows the bar alone, with no words', 0.2, function () {
  if (!P) return false;
  const h = P(0, 0);
  return (tagOf(h) !== '' && wordsOf(h) === null) || false;
}, test.limit.quick);
test.run('the bar never runs past the total, nor below 0', 0.2, function () {
  if (!P) return false;
  const over = tagOf(P(12, 10)), under = tagOf(P(-4, 10));
  return (/value="10"/.test(over) && /value="0"/.test(under)) || false;
}, test.limit.quick);
test.run('the text is escaped, never markup', 0.2, function () {
  if (!P) return false;
  const h = P(1, 2, '<b>"x" & y</b>');
  return (h.indexOf('<b>') === -1 && h.indexOf('&lt;b&gt;&quot;x&quot; &amp; y&lt;/b&gt;') !== -1) || false;
}, test.limit.quick);
