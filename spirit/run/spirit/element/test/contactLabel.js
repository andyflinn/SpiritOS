'use strict';

// spirit/run/spirit/element/test/contactLabel.js
// The tests of spirit/element/contactLabel.js, and of no other module: a contact's name by key, in both modes (spec:
// ./contactLabel.md). The browser file runs in node on a window and a document of its own, the document a small stub
// of the few DOM calls the label makes, and the node behind spirit.ready a recorder.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require(path.join(path.resolve(__dirname, '../../..'), 'spirit', 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'contactLabel.js');

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
require(path.join(__dirname, '..', '..', 'test', 'headLessChrome.js')).pageSpirit(window.spirit);
global.spirit = window.spirit;
window.spirit.ready = Promise.resolve({ contact: {
  get: function (b) { asked.push({ verb: 'contact.get', key: b.key });
    return b.key === 'KX' ? Promise.reject(new Error('no')) : Promise.resolve({ person: captions[b.key] !== undefined ? { caption: captions[b.key] } : null }); },
  label: function (b) { asked.push({ verb: 'contact.label', body: b });
    return labelRefuse ? Promise.reject(new Error(labelRefuse)) : Promise.resolve(labelAnswer); },
} });
window.spirit.fieldRules = { problem: function (t) { return t.length > 8 ? 'too long' : ''; } };
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
test.run('it registers spirit.element.spirit.element.contactLabel with a create, and createContactLabel no more', 0.2, function () {
  // the element
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  made = window.spirit.element.spirit.element.contactLabel;
  return (made && typeof made.create === 'function' && !('createContactLabel' in window.spirit.element)) ? true : 'elements: ' + JSON.stringify(Object.keys(window.spirit.element));
}, test.limit.quick);
test.run('create(container, options) appends the label to its container and answers it', 0.2, function () {
  box = node('div');
  boxed = made.create(box, { key: 'KA', caption: 'Anna' });
  return (box.children.length === 1 && box.children[0] === boxed && boxed.parentNode === box) ? true : 'container holds ' + box.children.length + (box.children[0] === boxed ? ', the label' : ', not the label');
}, test.limit.quick);
test.run('a span, contact-label, -editable in mode 2, the caller\'s class added', 0.2, function () {
  plain = make({ key: 'KA', caption: 'Anna', className: 'x' });
  edit = make({ key: 'KA', caption: 'Anna', editable: true });
  return (plain.tagName === 'span' && plain.className === 'contact-label x' && edit.className === 'contact-label contact-label-editable') ? true : 'classes: ' + plain.className + ' / ' + edit.className;
}, test.limit.quick);
test.run('a text span showing the caption given, and an error span', 0.2, function () {
  return (plain.children[0].className === 'contact-label-text' && plain.children[1].className === 'contact-label-error' && textOf(plain) === 'Anna') ? true : 'children: ' + JSON.stringify(plain.children.map(function (c) { return c.className; }));
}, test.limit.quick);
test.run('blank while unanswered, never the key', 0.2, function () {
  // given no caption it asks the book, once per key, blank until it answers
  b1 = make({ key: 'KB' });
  b2 = make({ key: 'KB' });
  return (textOf(b1) === '' && textOf(b2) === '') ? true : 'before the answer: ' + textOf(b1);
}, test.limit.quick);
test.run('the book\'s caption, contact.get asked once for two labels', 0.2, async function () {
  await tick();
  return (textOf(b1) === 'Bert' && textOf(b2) === 'Bert' && gets('KB') === 1) ? true : 'after the answer: ' + JSON.stringify({ text: textOf(b1), gets: gets('KB') });
}, test.limit.quick);
test.run('a name already known draws at once, asking nothing', 0.2, function () {
  b3 = make({ key: 'KB' });
  return (textOf(b3) === 'Bert' && gets('KB') === 1) ? true : 'a third label: ' + JSON.stringify({ text: textOf(b3), gets: gets('KB') });
}, test.limit.quick);
test.run('a caption given once is known to every later label of that key', 0.2, function () {
  a2 = make({ key: 'KA' });
  return (textOf(a2) === 'Anna' && gets('KA') === 0) ? true : 'KA after a given caption: ' + textOf(a2);
}, test.limit.quick);
test.run('when the book has no name, or the ask fails, the key shows', 0.2, async function () {
  unknown = make({ key: 'KU' });
  failed = make({ key: 'KX' });
  await tick();
  return (textOf(unknown) === 'KU' && textOf(failed) === 'KX') ? true : 'no name: ' + JSON.stringify([textOf(unknown), textOf(failed)]);
}, test.limit.quick);
test.run('a key the book could not name is asked again by the next label', 0.2, async function () {
  make({ key: 'KU' });
  await tick();
  return (gets('KU') === 2) ? true : 'KU asked ' + gets('KU') + ' times';
}, test.limit.quick);
test.run('a rename of its key redraws it; other keys stand', 0.2, function () {
  // both modes hear a rename
  rename({ key: 'KB', caption: 'Bertie' });
  return (textOf(b1) === 'Bertie' && textOf(b3) === 'Bertie' && textOf(plain) === 'Anna') ? true : 'after a rename: ' + JSON.stringify([textOf(b1), textOf(plain)]);
}, test.limit.quick);
test.run('a rename is known to labels made after it', 0.2, function () {
  return (textOf(make({ key: 'KB' })) === 'Bertie') ? true : 'a label after the rename';
}, test.limit.quick);
test.run('a rename without a text caption is ignored', 0.2, function () {
  rename({ key: 'KB', caption: 7 });
  rename(null);
  return (textOf(b1) === 'Bertie') ? true : 'a bad rename drew ' + textOf(b1);
}, test.limit.quick);
test.run('a label that left the page stops listening; one never placed keeps listening', 0.2, function () {
  placed = make({ key: 'KP', caption: 'P' });
  waiting = make({ key: 'KP', caption: 'P' });
  placed.isConnected = true;
  rename({ key: 'KP', caption: 'P2' });
  placed.isConnected = false;
  waiting.isConnected = false;
  rename({ key: 'KP', caption: 'P3' });
  return (textOf(placed) === 'P2' && textOf(waiting) === 'P3') ? true : 'after leaving: ' + JSON.stringify([textOf(placed), textOf(waiting)]);
}, test.limit.quick);
test.run('the left label\'s listener is off document', 0.2, function () {
  listening = (doc.listeners['contact.rename'] || []).length;
  rename({ key: 'KP', caption: 'P4' });
  return ((doc.listeners['contact.rename'] || []).length === listening && textOf(placed) === 'P2') ? true : 'listeners: ' + listening;
}, test.limit.quick);
test.run('a display label has no click', 0.2, function () {
  // mode 1 cannot be edited; mode 2 opens an input on click
  return (!(plain.listeners.click || []).length) ? true : 'a display label listens to clicks';
}, test.limit.quick);
test.run('a click opens an input holding the caption, before the error span, the text hidden', 0.2, function () {
  edit.fire('click');
  input = inputOf(edit);
  return (input && input.className === 'contact-label-input' && input.value === 'Anna' && edit.children[0].hidden === true && edit.children.indexOf(input) === 1) ? true : 'after a click: ' + JSON.stringify(edit.children.map(function (c) { return c.tagName; }));
}, test.limit.quick);
test.run('a second click opens no second input', 0.2, function () {
  edit.fire('click');
  return (edit.children.filter(function (c) { return c.tagName === 'input'; }).length === 1) ? true : 'two inputs';
}, test.limit.quick);
test.run('Escape closes it, the text back', 0.2, function () {
  input.fire('keydown', { key: 'Escape' });
  return (!inputOf(edit) && edit.children[0].hidden === false) ? true : 'after Escape';
}, test.limit.quick);
test.run('an empty name asks nothing, and the input stays', 0.2, async function () {
  // mode 2 saves on Enter: checked, asked, drawn
  edit.fire('click');
  n = asked.length;
  inputOf(edit).value = '   ';
  inputOf(edit).fire('keydown', { key: 'Enter' });
  await tick();
  return (asked.length === n && inputOf(edit)) ? true : 'an empty name asked';
}, test.limit.quick);
test.run('a name the rule refuses is said, and not asked', 0.2, async function () {
  inputOf(edit).value = 'far too long';
  inputOf(edit).fire('keydown', { key: 'Enter' });
  await tick();
  return (asked.length === n && whyOf(edit) === 'too long') ? true : 'a refused name: ' + whyOf(edit);
}, test.limit.quick);
test.run('a refusal from the node is said, the name kept', 0.2, async function () {
  labelRefuse = 'node says no';
  inputOf(edit).value = 'Ann';
  inputOf(edit).fire('keydown', { key: 'Enter' });
  await tick();
  return (whyOf(edit) === 'node says no' && inputOf(edit) && textOf(edit) === 'Anna') ? true : 'a node refusal: ' + JSON.stringify([whyOf(edit), textOf(edit)]);
}, test.limit.quick);
test.run('a good name is trimmed and asked of contact.label by the key', 0.2, async function () {
  labelRefuse = null;
  labelAnswer = { caption: 'Annie' };
  inputOf(edit).value = '  Ann  ';
  inputOf(edit).fire('keydown', { key: 'Enter' });
  await tick();
  lab = asked[asked.length - 1];
  return (lab.verb === 'contact.label' && lab.body.publicKey === 'KA' && lab.body.myLabel === 'Ann') ? true : 'contact.label asked ' + JSON.stringify(lab);
}, test.limit.quick);
test.run('the caption the node answers is drawn and known, the input closed, the error cleared', 0.2, function () {
  return (textOf(edit) === 'Annie' && !inputOf(edit) && whyOf(edit) === '' && textOf(make({ key: 'KA' })) === 'Annie') ? true : 'after the save: ' + JSON.stringify([textOf(edit), whyOf(edit)]);
}, test.limit.quick);
test.run('an answer with no caption draws the name typed', 0.2, async function () {
  labelAnswer = {};
  edit.fire('click');
  inputOf(edit).value = 'Anja';
  inputOf(edit).fire('keydown', { key: 'Enter' });
  await tick();
  return (textOf(edit) === 'Anja') ? true : 'no caption in the answer: ' + textOf(edit);
}, test.limit.quick);
