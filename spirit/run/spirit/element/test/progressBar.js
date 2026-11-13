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
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'element', 'progressBar.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

let P = null;
const NO_P = 'progressBar placed nothing: the world failed';
const tagOf = function (html) { return (/<progress[^>]*>/.exec(html) || [''])[0]; };
const wordsOf = function (html) { return ((/<span class="job-manifest-note">([^<]*)<\/span>/.exec(html)) || [null, null])[1]; };

test.run('the world: it runs on a window of its own and places itself at spirit.element.spirit.element.progressBar', 0.2, async function () {
  const win = { Math: Math, Number: Number, String: String, Promise: Promise };
  win.window = win;
  win.spirit = { element: {} };
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(win.spirit);
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  await settle();
  P = ((win.spirit.element.spirit || {}).element || {}).progressBar;
  return typeof P === 'function' || 'placed: ' + short(typeof P);
}, test.limit.quick);

// the box: "progressBar: one shared shell element drawn from (done, total, text)"
test.run('done of total: a progress tag with max the total and value the done, the words done/total and the text', 0.2, function () {
  if (!P) return NO_P;
  const h = P(3, 10, 'files');
  return (/max="10"/.test(tagOf(h)) && /value="3"/.test(tagOf(h)) && wordsOf(h) === '3/10 files' && /^<span class="progress-bar">/.test(h)) || 'drawn: ' + short(h);
}, test.limit.quick);
test.run('with no text the words are done/total alone', 0.2, function () {
  if (!P) return NO_P;
  return wordsOf(P(1, 2)) === '1/2' || 'drawn: ' + short(P(1, 2));
}, test.limit.quick);
// the box: "total 0 shows indeterminate"
test.run('total 0 shows indeterminate: a progress tag with no value, and the text alone', 0.2, function () {
  if (!P) return NO_P;
  const h = P(5, 0, 'waiting');
  return (!/value=/.test(tagOf(h)) && !/max=/.test(tagOf(h)) && tagOf(h) !== '' && wordsOf(h) === 'waiting') || 'drawn: ' + short(h);
}, test.limit.quick);
test.run('total 0 and no text: the bar alone, no words', 0.2, function () {
  if (!P) return NO_P;
  const h = P(0, 0);
  return (tagOf(h) !== '' && wordsOf(h) === null) || 'drawn: ' + short(h);
}, test.limit.quick);
test.run('the bar never runs past the total, nor below 0', 0.2, function () {
  if (!P) return NO_P;
  const over = tagOf(P(12, 10)), under = tagOf(P(-4, 10));
  return (/value="10"/.test(over) && /value="0"/.test(under)) || 'drawn: ' + short([over, under]);
}, test.limit.quick);
test.run('the text is escaped, never markup', 0.2, function () {
  if (!P) return NO_P;
  const h = P(1, 2, '<b>"x" & y</b>');
  return (h.indexOf('<b>') === -1 && h.indexOf('&lt;b&gt;&quot;x&quot; &amp; y&lt;/b&gt;') !== -1) || 'drawn: ' + short(h);
}, test.limit.quick);
