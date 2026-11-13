'use strict';

// spirit/run/spirit/element/test/fieldInput.js
// The tests of spirit/element/fieldInput.js, and of no other module (spec: ./fieldInput.md). Its own test, owed since the
// rule "every production script has its own test" (goal/G47.1, box v72).
//
// An input stops at its limit (goal/G32.2). The browser file runs in node on a window of its own; the rules it holds to are
// the real spirit/fieldRules.js, run in that window when it asks for them. An input is a stand-in that keeps its value, its
// selection and its beforeinput listeners; a keystroke or a paste is a beforeinput event that records whether it was refused.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'element', 'fieldInput.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

let F = null, required = [], made = 0;
const NO_F = 'fieldInput placed nothing: the world failed';

function input(value) {
  const heard = {};
  const el = { value: value, selectionStart: value.length, selectionEnd: value.length,
    addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); } };
  // A keystroke, a paste or a deletion as the browser sends it before it lands: refused when a listener prevents it.
  el.type = function (inputType, data, dataTransfer) {
    let refused = false;
    const e = { inputType: inputType, data: data === undefined ? null : data, dataTransfer: dataTransfer || null, preventDefault: function () { refused = true; } };
    (heard.beforeinput || []).forEach(function (fn) { fn(e); });
    return refused;
  };
  el.heard = heard;
  return el;
}

test.run('the world: it runs on a window of its own', 0.2, function () {
  const win = { TextEncoder: TextEncoder, Array: Array, JSON: JSON, String: String, Infinity: Infinity,
    document: { createElement: function () { made += 1; return {}; } } };
  win.window = win;
  win.globalThis = win;
  win.spirit = { required: {}, require: function (p) {
    required.push(p);
    if (p === 'spirit/fieldRules.js') vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'fieldRules.js'), 'utf8'), win, { filename: p });
    return Promise.resolve();
  } };
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  F = ((win.spirit.required.spirit || {}).element || {}).fieldInput;
  return (!!F && typeof F.fits === 'function' && typeof F.attach === 'function') || 'placed: ' + short(F && Object.keys(F));
}, test.limit.quick);
// rule/26; goal/G41.27: "on a bare page, without the boot's list, it held nothing"
test.run('it loads the rules it holds to itself: spirit/fieldRules.js', 0.2, function () {
  if (!F) return NO_F;
  return required.indexOf('spirit/fieldRules.js') !== -1 || 'required: ' + short(required);
}, test.limit.quick);

// fits: "counted in bytes as the rule counts them, never characters"
test.run('fits counts bytes, never characters: a name of 64 bytes fits, 65 does not', 0.2, function () {
  if (!F) return NO_F;
  const got = [F.fits('a'.repeat(64), 'name'), F.fits('a'.repeat(65), 'name'), F.fits('é'.repeat(32), 'name'), F.fits('é'.repeat(33), 'name')];
  return JSON.stringify(got) === JSON.stringify([true, false, true, false]) || '64 a, 65 a, 32 é, 33 é: ' + short(got);
}, test.limit.quick);
test.run('fits holds each rule to its limit: description 128, paragraph 2048, line 1024 bytes', 0.2, function () {
  if (!F) return NO_F;
  const bad = [['description', 128], ['paragraph', 2048], ['line', 1024]].filter(function (p) {
    return !(F.fits('x'.repeat(p[1]), p[0]) && !F.fits('x'.repeat(p[1] + 1), p[0]));
  });
  return !bad.length || 'not held to its limit: ' + short(bad);
}, test.limit.quick);
test.run('fits takes one glyph of at most 8 bytes for the glyph rule, never two', 0.2, function () {
  if (!F) return NO_F;
  const got = [F.fits('🙂', 'glyph'), F.fits('👩‍👩‍👧‍👦', 'glyph'), F.fits('ab', 'glyph'), F.fits('🙂🙂', 'glyph')];
  return JSON.stringify(got) === JSON.stringify([true, false, false, false]) || 'one, a long one, two letters, two glyphs: ' + short(got);
}, test.limit.quick);

// attach: "refuses a keystroke or a paste that would take the text past it, before it lands; deleting always works"
let full = null;
test.run('attach answers the input it is given', 0.2, function () {
  if (!F) return NO_F;
  full = input('a'.repeat(64));
  return F.attach(full, 'name') === full || 'it answered another thing';
}, test.limit.quick);
test.run('a keystroke that would take the text past its limit is refused before it lands', 0.2, function () {
  if (!full) return 'no input attached';
  return full.type('insertText', 'b') === true || 'the 65th byte was taken';
}, test.limit.quick);
test.run('a keystroke within the limit is taken', 0.2, function () {
  if (!F) return NO_F;
  const i = F.attach(input('a'.repeat(63)), 'name');
  return i.type('insertText', 'b') === false || 'the 64th byte was refused';
}, test.limit.quick);
test.run('a keystroke of a character of two bytes is refused with one byte left', 0.2, function () {
  if (!F) return NO_F;
  const i = F.attach(input('a'.repeat(63)), 'name');
  return i.type('insertText', 'é') === true || 'two bytes were taken where one was left';
}, test.limit.quick);
test.run('a paste that would take the text past its limit is refused', 0.2, function () {
  if (!F) return NO_F;
  const i = F.attach(input('a'.repeat(60)), 'name');
  const paste = { getData: function (t) { return t === 'text/plain' ? 'pasted' : ''; } };
  const small = F.attach(input('a'.repeat(50)), 'name');
  return (i.type('insertFromPaste', null, paste) === true && small.type('insertFromPaste', null, paste) === false) || 'the paste past the limit was taken, or the one within it refused';
}, test.limit.quick);
test.run('a line break counts as the byte it adds', 0.2, function () {
  if (!F) return NO_F;
  const i = F.attach(input('x'.repeat(1024)), 'line');
  return i.type('insertLineBreak', null) === true || 'a line break past the limit was taken';
}, test.limit.quick);
test.run('typing over a selection counts what it replaces', 0.2, function () {
  if (!F) return NO_F;
  const i = F.attach(input('a'.repeat(64)), 'name');
  i.selectionStart = 10; i.selectionEnd = 12;
  return i.type('insertText', 'bb') === false || 'two bytes typed over two were refused';
}, test.limit.quick);
test.run('deleting always works, even past the limit', 0.2, function () {
  if (!F) return NO_F;
  const i = F.attach(input('a'.repeat(100)), 'name');
  return (i.type('deleteContentBackward') === false && i.type('deleteByCut') === false) || 'a deletion was refused';
}, test.limit.quick);
// "It never says how far past the limit the text went: it simply does not get there."
test.run('it never says how far past the limit: a refusal leaves the text as it was and draws nothing', 0.2, function () {
  if (!full) return 'no input attached';
  full.type('insertText', 'bbbb');
  const keys = Object.keys(full).sort();
  return (full.value === 'a'.repeat(64) && made === 0 && JSON.stringify(keys) === JSON.stringify(['addEventListener', 'heard', 'selectionEnd', 'selectionStart', 'type', 'value'])) || 'value ' + full.value.length + ' long, elements made ' + made + ', keys ' + short(keys);
}, test.limit.quick);
test.run('attach of no input answers it, untouched', 0.2, function () {
  if (!F) return NO_F;
  return (F.attach(null, 'name') === null && F.attach(undefined, 'name') === undefined) || 'it answered something';
}, test.limit.quick);
