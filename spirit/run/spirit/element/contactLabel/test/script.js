'use strict';

// spirit/run/spirit/element/contactLabel/test/script.js
// The tests of spirit/element/contactLabel/script.js, and of no other module: a contact's name by key, in both modes (spec:
// ./script.md). The browser file runs in node on a window and a document of its own, the document a small stub
// of the few DOM calls the label makes, and the node behind spirit.readyPromise a recorder.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'spirit.js')).requireScript('spirit/test/headLessChrome.js');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');

const FILE = path.join(__dirname, '..', 'script.js');

// The DOM the label touches: elements with children and listeners, and document's events.
function node(tag) {
  const n = { tagName: tag, className: '', textContent: '', hidden: false, value: '', type: '', children: [], parentNode: null,
    isConnected: undefined, listeners: {} };
  n.appendChild = function (c) { c.parentNode = n; n.children.push(c); return c; };
  n.insertBefore = function (c, before) { c.parentNode = n; const i = n.children.indexOf(before); n.children.splice(i < 0 ? n.children.length : i, 0, c); return c; };
  n.removeChild = function (c) { n.children.splice(n.children.indexOf(c), 1); c.parentNode = null; return c; };
  n.addEventListener = function (t, fn) { (n.listeners[t] = n.listeners[t] || []).push(fn); };
  n.fire = function (t, ev) { (n.listeners[t] || []).slice().forEach(function (fn) { fn(ev || {}); }); };
  n.focus = function () {}; n.select = function () {};
  return n;
}
const doc = node('#document');
doc.createElement = node;
doc.removeEventListener = function (t, fn) { doc.listeners[t] = (doc.listeners[t] || []).filter(function (x) { return x !== fn; }); };
global.document = doc;

const asked = [];
const captions = { KB: 'Bert' };
let labelAnswer = null; let labelRefuse = null;
global.window = { spirit: {} };
// goal/G43.32: the element places itself by installSpiritElement, as it runs (spirit/test/headLessChrome.js pageSpirit).
LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(window.spirit);
global.spirit = window.spirit;
// What readyPromise answers holds no branch (goal/G49.6); the contact branch is answered by its api.js path.
window.spirit.readyPromise = Promise.resolve({});
const contactBranch = {
  get: function (b) { asked.push({ verb: 'contact.get', key: b.key });
    return b.key === 'KX' ? Promise.reject(new Error('no')) : Promise.resolve({ person: captions[b.key] !== undefined ? { caption: captions[b.key] } : null }); },
  label: function (b) { asked.push({ verb: 'contact.label', body: b });
    return labelRefuse ? Promise.reject(new Error(labelRefuse)) : Promise.resolve(labelAnswer); },
};
// ITS STAND-INS ARE requireScript's ANSWERS (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers";
// Andy: "spirit.requireScript must allways return either an object or a function... or fail/throw"): the contact branch, and
// the label type (goal/G48.4), a stand-in that refuses past 8. Any other path fails, as a script that is not there does:
// fieldInput is not loaded here, so the label's input is drawn without it.
const labelType = { isValid: function (t) { if (t.length > 8) throw new Error('too long'); return true; } };
const STANDS = { 'spirit/contact/api.js': contactBranch, 'spirit/type/string/label.js': labelType };
const pageRequire = window.spirit.requireScript;
window.spirit.requireScript = function (p) {
  if (Object.prototype.hasOwnProperty.call(STANDS, String(p))) return Promise.resolve(STANDS[String(p)]);
  if (/installSpiritElement\.js$/.test(String(p))) return pageRequire.apply(this, arguments);
  return Promise.reject(new Error('no stand-in for ' + p));
};
// contactLabel.js still reads the label type at its spirit.required place (its save, not yet swept): the stand-in stands there too.
window.spirit.required = window.spirit.required || {};
window.spirit.required.spirit = window.spirit.required.spirit || {};
window.spirit.required.spirit.type = { string: { label: labelType } };
// The element, once the first test has run its file.
let made = null;
// Box v23: "every element gets a container and appends itself": each label here is made into a container of its own.
const make = function (o) { return made.create(node('div'), o); };
const tick = function () { return new Promise(function (r) { setTimeout(r, 0); }); };
const textOf = function (root) { return root.children[0].textContent; };
const whyOf = function (root) { return root.children[root.children.length - 1].textContent; };
const inputOf = function (root) { return root.children.filter(function (c) { return c.tagName === 'input'; })[0] || null; };
const gets = function (key) { return asked.filter(function (a) { return a.verb === 'contact.get' && a.key === key; }).length; };
const rename = function (detail) { doc.fire('contact.rename', { detail: detail }); };

// What the tests make, shared by the tests after them.
let box, boxed, plain, edit, b1, b2, b3, a2, unknown, failed, placed, waiting, listening, input, n, lab;
test.run('it registers spirit.required.spirit.element.contactLabel with a create, and createContactLabel no more', 0.2, function () {
  // the element
  made = PAGE_LOAD.runAsPage(FILE);
  return (made && typeof made.create === 'function' && window.spirit.required.spirit.element.contactLabel === made && !('createContactLabel' in window.spirit.required)) ? true : false;
}, test.limit.quick);
test.run('create appends the label to the container it is given and answers it', 0.2, function () {
  box = node('div');
  boxed = made.create(box, { key: 'KA', caption: 'Anna' });
  return (box.children.length === 1 && box.children[0] === boxed && boxed.parentNode === box) ? true : false;
}, test.limit.quick);
test.run('the label is a span of class contact-label, with contact-label-editable when editable and the caller\'s class added', 0.2, function () {
  plain = make({ key: 'KA', caption: 'Anna', className: 'x' });
  edit = make({ key: 'KA', caption: 'Anna', editable: true });
  return (plain.tagName === 'span' && plain.className === 'contact-label x' && edit.className === 'contact-label contact-label-editable') ? true : false;
}, test.limit.quick);
test.run('the label holds a text span showing the caption given, and an error span', 0.2, function () {
  return (plain.children[0].className === 'contact-label-text' && plain.children[1].className === 'contact-label-error' && textOf(plain) === 'Anna') ? true : false;
}, test.limit.quick);
test.run('a label given no caption is blank while unanswered, never the key', 0.2, function () {
  // given no caption it asks the book, once per key, blank until it answers
  b1 = make({ key: 'KB' });
  b2 = make({ key: 'KB' });
  return (textOf(b1) === '' && textOf(b2) === '') ? true : false;
}, test.limit.quick);
test.run('both labels show the book\'s caption, with contact.get asked once for the two', 0.2, async function () {
  await tick();
  return (textOf(b1) === 'Bert' && textOf(b2) === 'Bert' && gets('KB') === 1) ? true : false;
}, test.limit.quick);
test.run('a name already known draws at once, asking nothing', 0.2, function () {
  b3 = make({ key: 'KB' });
  return (textOf(b3) === 'Bert' && gets('KB') === 1) ? true : false;
}, test.limit.quick);
test.run('a caption given once is known to every later label of that key', 0.2, function () {
  a2 = make({ key: 'KA' });
  return (textOf(a2) === 'Anna' && gets('KA') === 0) ? true : false;
}, test.limit.quick);
test.run('when the book has no name, or the ask fails, the key shows', 0.2, async function () {
  unknown = make({ key: 'KU' });
  failed = make({ key: 'KX' });
  await tick();
  return (textOf(unknown) === 'KU' && textOf(failed) === 'KX') ? true : false;
}, test.limit.quick);
test.run('a key the book could not name is asked again by the next label', 0.2, async function () {
  make({ key: 'KU' });
  await tick();
  return (gets('KU') === 2) ? true : false;
}, test.limit.quick);
test.run('a rename of its key redraws it; other keys stand', 0.2, function () {
  // both modes hear a rename
  rename({ key: 'KB', caption: 'Bertie' });
  return (textOf(b1) === 'Bertie' && textOf(b3) === 'Bertie' && textOf(plain) === 'Anna') ? true : false;
}, test.limit.quick);
test.run('a rename is known to labels made after it', 0.2, function () {
  return (textOf(make({ key: 'KB' })) === 'Bertie') ? true : false;
}, test.limit.quick);
test.run('a rename without a text caption is ignored', 0.2, function () {
  rename({ key: 'KB', caption: 7 });
  rename(null);
  return (textOf(b1) === 'Bertie') ? true : false;
}, test.limit.quick);
test.run('a label that left the page stops listening; one never placed keeps listening', 0.2, function () {
  placed = make({ key: 'KP', caption: 'P' });
  waiting = make({ key: 'KP', caption: 'P' });
  placed.isConnected = true;
  rename({ key: 'KP', caption: 'P2' });
  placed.isConnected = false;
  waiting.isConnected = false;
  rename({ key: 'KP', caption: 'P3' });
  return (textOf(placed) === 'P2' && textOf(waiting) === 'P3') ? true : false;
}, test.limit.quick);
test.run('the listener of the label that left the page is off the document', 0.2, function () {
  listening = (doc.listeners['contact.rename'] || []).length;
  rename({ key: 'KP', caption: 'P4' });
  return ((doc.listeners['contact.rename'] || []).length === listening && textOf(placed) === 'P2') ? true : false;
}, test.limit.quick);
test.run('a display label has no click', 0.2, function () {
  // mode 1 cannot be edited; mode 2 opens an input on click
  return (!(plain.listeners.click || []).length) ? true : false;
}, test.limit.quick);
test.run('a click opens an input holding the caption, before the error span, the text hidden', 0.2, function () {
  edit.fire('click');
  input = inputOf(edit);
  return (input && input.className === 'contact-label-input' && input.value === 'Anna' && edit.children[0].hidden === true && edit.children.indexOf(input) === 1) ? true : false;
}, test.limit.quick);
test.run('a second click opens no second input', 0.2, function () {
  edit.fire('click');
  return (edit.children.filter(function (c) { return c.tagName === 'input'; }).length === 1) ? true : false;
}, test.limit.quick);
test.run('Escape closes the input and the text comes back', 0.2, function () {
  input.fire('keydown', { key: 'Escape' });
  return (!inputOf(edit) && edit.children[0].hidden === false) ? true : false;
}, test.limit.quick);
test.run('an empty name asks nothing, and the input stays', 0.2, async function () {
  // mode 2 saves on Enter: checked, asked, drawn
  edit.fire('click');
  n = asked.length;
  inputOf(edit).value = '   ';
  inputOf(edit).fire('keydown', { key: 'Enter' });
  await tick();
  return (asked.length === n && inputOf(edit)) ? true : false;
}, test.limit.quick);
test.run('a name the rule refuses is said, and not asked', 0.2, async function () {
  inputOf(edit).value = 'far too long';
  inputOf(edit).fire('keydown', { key: 'Enter' });
  await tick();
  return (asked.length === n && whyOf(edit) === 'too long') ? true : false;
}, test.limit.quick);
test.run('a refusal from the node is said, the name kept', 0.2, async function () {
  labelRefuse = 'node says no';
  inputOf(edit).value = 'Ann';
  inputOf(edit).fire('keydown', { key: 'Enter' });
  await tick();
  return (whyOf(edit) === 'node says no' && inputOf(edit) && textOf(edit) === 'Anna') ? true : false;
}, test.limit.quick);
test.run('a good name is trimmed and asked of contact.label by the key', 0.2, async function () {
  labelRefuse = null;
  labelAnswer = { caption: 'Annie' };
  inputOf(edit).value = '  Ann  ';
  inputOf(edit).fire('keydown', { key: 'Enter' });
  await tick();
  lab = asked[asked.length - 1];
  return (lab.verb === 'contact.label' && lab.body.publicKey === 'KA' && lab.body.myLabel === 'Ann') ? true : false;
}, test.limit.quick);
test.run('the caption the node answers is drawn and known, the input is closed and the error is cleared', 0.2, function () {
  return (textOf(edit) === 'Annie' && !inputOf(edit) && whyOf(edit) === '' && textOf(make({ key: 'KA' })) === 'Annie') ? true : false;
}, test.limit.quick);
test.run('an answer with no caption draws the name typed', 0.2, async function () {
  labelAnswer = {};
  edit.fire('click');
  inputOf(edit).value = 'Anja';
  inputOf(edit).fire('keydown', { key: 'Enter' });
  await tick();
  return (textOf(edit) === 'Anja') ? true : false;
}, test.limit.quick);
