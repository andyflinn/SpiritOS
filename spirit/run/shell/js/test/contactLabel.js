'use strict';

// spirit/run/shell/js/test/contactLabel.js
// The tests of shell/js/contactLabel.js, and of no other module: a contact's name by key, in both modes (spec:
// ./contactLabel.md). The browser file runs in node on a window and a document of its own, the document a small stub
// of the few DOM calls the label makes, and the node behind spirit.ready a recorder.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require(path.join(path.resolve(__dirname, '../../..'), 'test', 'testReport.js'));

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
global.spirit = window.spirit;
window.spirit.ready = Promise.resolve({ contact: {
  get: function (b) { asked.push({ verb: 'contact.get', key: b.key });
    return b.key === 'KX' ? Promise.reject(new Error('no')) : Promise.resolve({ person: captions[b.key] !== undefined ? { caption: captions[b.key] } : null }); },
  label: function (b) { asked.push({ verb: 'contact.label', body: b });
    return labelRefuse ? Promise.reject(new Error(labelRefuse)) : Promise.resolve(labelAnswer); },
} });
window.spirit.fieldRules = { problem: function (t) { return t.length > 8 ? 'too long' : ''; } };
vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
const made = window.spirit.elements.contactLabel;
// Box v23: "every element gets a container and appends itself": each label here is made into a container of its own.
const make = function (o) { return made.create(node('div'), o); };
const tick = function () { return new Promise(function (r) { setTimeout(r, 0); }); };
const textOf = function (root) { return root.children[0].textContent; };
const whyOf = function (root) { return root.children[root.children.length - 1].textContent; };
const inputOf = function (root) { return root.children.filter(function (c) { return c.tagName === 'input'; })[0] || null; };
const gets = function (key) { return asked.filter(function (a) { return a.verb === 'contact.get' && a.key === key; }).length; };
const rename = function (detail) { doc.fire('contact.rename', { detail: detail }); };

(async function () {
  test.startTest('contactLabel.js: a contact\'s name by key');

  test.subHeading('the element');
  if (made && typeof made.create === 'function' && !('createContactLabel' in window.spirit.elements))
    test.check('it registers spirit.elements.contactLabel with a create, and createContactLabel no more');
  else { test.fail('elements: ' + JSON.stringify(Object.keys(window.spirit.elements))); test.reportSuccessFailureCount(); return; }
  const box = node('div');
  const boxed = made.create(box, { key: 'KA', caption: 'Anna' });
  if (box.children.length === 1 && box.children[0] === boxed && boxed.parentNode === box) test.check('create(container, options) appends the label to its container and answers it');
  else test.fail('container holds ' + box.children.length + (box.children[0] === boxed ? ', the label' : ', not the label'));
  const plain = make({ key: 'KA', caption: 'Anna', className: 'x' });
  const edit = make({ key: 'KA', caption: 'Anna', editable: true });
  if (plain.tagName === 'span' && plain.className === 'contact-label x' && edit.className === 'contact-label contact-label-editable')
    test.check('a span, contact-label, -editable in mode 2, the caller\'s class added');
  else test.fail('classes: ' + plain.className + ' / ' + edit.className);
  if (plain.children[0].className === 'contact-label-text' && plain.children[1].className === 'contact-label-error' && textOf(plain) === 'Anna')
    test.check('a text span showing the caption given, and an error span');
  else test.fail('children: ' + JSON.stringify(plain.children.map(function (c) { return c.className; })));

  test.subHeading('given no caption it asks the book, once per key, blank until it answers');
  const b1 = make({ key: 'KB' }); const b2 = make({ key: 'KB' });
  if (textOf(b1) === '' && textOf(b2) === '') test.check('blank while unanswered, never the key');
  else test.fail('before the answer: ' + textOf(b1));
  await tick();
  if (textOf(b1) === 'Bert' && textOf(b2) === 'Bert' && gets('KB') === 1) test.check('the book\'s caption, contact.get asked once for two labels');
  else test.fail('after the answer: ' + JSON.stringify({ text: textOf(b1), gets: gets('KB') }));
  const b3 = make({ key: 'KB' });
  if (textOf(b3) === 'Bert' && gets('KB') === 1) test.check('a name already known draws at once, asking nothing');
  else test.fail('a third label: ' + JSON.stringify({ text: textOf(b3), gets: gets('KB') }));
  const a2 = make({ key: 'KA' });
  if (textOf(a2) === 'Anna' && gets('KA') === 0) test.check('a caption given once is known to every later label of that key');
  else test.fail('KA after a given caption: ' + textOf(a2));
  const unknown = make({ key: 'KU' }); const failed = make({ key: 'KX' });
  await tick();
  if (textOf(unknown) === 'KU' && textOf(failed) === 'KX') test.check('when the book has no name, or the ask fails, the key shows');
  else test.fail('no name: ' + JSON.stringify([textOf(unknown), textOf(failed)]));
  make({ key: 'KU' }); await tick();
  if (gets('KU') === 2) test.check('a key the book could not name is asked again by the next label');
  else test.fail('KU asked ' + gets('KU') + ' times');

  test.subHeading('both modes hear a rename');
  rename({ key: 'KB', caption: 'Bertie' });
  if (textOf(b1) === 'Bertie' && textOf(b3) === 'Bertie' && textOf(plain) === 'Anna') test.check('a rename of its key redraws it; other keys stand');
  else test.fail('after a rename: ' + JSON.stringify([textOf(b1), textOf(plain)]));
  if (textOf(make({ key: 'KB' })) === 'Bertie') test.check('a rename is known to labels made after it');
  else test.fail('a label after the rename');
  rename({ key: 'KB', caption: 7 }); rename(null);
  if (textOf(b1) === 'Bertie') test.check('a rename without a text caption is ignored');
  else test.fail('a bad rename drew ' + textOf(b1));
  const placed = make({ key: 'KP', caption: 'P' });
  const waiting = make({ key: 'KP', caption: 'P' });
  placed.isConnected = true; rename({ key: 'KP', caption: 'P2' });
  placed.isConnected = false; waiting.isConnected = false; rename({ key: 'KP', caption: 'P3' });
  if (textOf(placed) === 'P2' && textOf(waiting) === 'P3') test.check('a label that left the page stops listening; one never placed keeps listening');
  else test.fail('after leaving: ' + JSON.stringify([textOf(placed), textOf(waiting)]));
  const listening = (doc.listeners['contact.rename'] || []).length;
  rename({ key: 'KP', caption: 'P4' });
  if ((doc.listeners['contact.rename'] || []).length === listening && textOf(placed) === 'P2') test.check('the left label\'s listener is off document');
  else test.fail('listeners: ' + listening);

  test.subHeading('mode 1 cannot be edited; mode 2 opens an input on click');
  if (!(plain.listeners.click || []).length) test.check('a display label has no click');
  else test.fail('a display label listens to clicks');
  edit.fire('click');
  const input = inputOf(edit);
  if (input && input.className === 'contact-label-input' && input.value === 'Anna' && edit.children[0].hidden === true && edit.children.indexOf(input) === 1)
    test.check('a click opens an input holding the caption, before the error span, the text hidden');
  else test.fail('after a click: ' + JSON.stringify(edit.children.map(function (c) { return c.tagName; })));
  edit.fire('click');
  if (edit.children.filter(function (c) { return c.tagName === 'input'; }).length === 1) test.check('a second click opens no second input');
  else test.fail('two inputs');
  input.fire('keydown', { key: 'Escape' });
  if (!inputOf(edit) && edit.children[0].hidden === false) test.check('Escape closes it, the text back');
  else test.fail('after Escape');

  test.subHeading('mode 2 saves on Enter: checked, asked, drawn');
  edit.fire('click');
  let n = asked.length;
  inputOf(edit).value = '   '; inputOf(edit).fire('keydown', { key: 'Enter' }); await tick();
  if (asked.length === n && inputOf(edit)) test.check('an empty name asks nothing, and the input stays');
  else test.fail('an empty name asked');
  inputOf(edit).value = 'far too long'; inputOf(edit).fire('keydown', { key: 'Enter' }); await tick();
  if (asked.length === n && whyOf(edit) === 'too long') test.check('a name the rule refuses is said, and not asked');
  else test.fail('a refused name: ' + whyOf(edit));
  labelRefuse = 'node says no';
  inputOf(edit).value = 'Ann'; inputOf(edit).fire('keydown', { key: 'Enter' }); await tick();
  if (whyOf(edit) === 'node says no' && inputOf(edit) && textOf(edit) === 'Anna') test.check('a refusal from the node is said, the name kept');
  else test.fail('a node refusal: ' + JSON.stringify([whyOf(edit), textOf(edit)]));
  labelRefuse = null; labelAnswer = { caption: 'Annie' };
  inputOf(edit).value = '  Ann  '; inputOf(edit).fire('keydown', { key: 'Enter' }); await tick();
  const lab = asked[asked.length - 1];
  if (lab.verb === 'contact.label' && lab.body.publicKey === 'KA' && lab.body.myLabel === 'Ann') test.check('a good name is trimmed and asked of contact.label by the key');
  else test.fail('contact.label asked ' + JSON.stringify(lab));
  if (textOf(edit) === 'Annie' && !inputOf(edit) && whyOf(edit) === '' && textOf(make({ key: 'KA' })) === 'Annie') test.check('the caption the node answers is drawn and known, the input closed, the error cleared');
  else test.fail('after the save: ' + JSON.stringify([textOf(edit), whyOf(edit)]));
  labelAnswer = {};
  edit.fire('click'); inputOf(edit).value = 'Anja'; inputOf(edit).fire('keydown', { key: 'Enter' }); await tick();
  if (textOf(edit) === 'Anja') test.check('an answer with no caption draws the name typed');
  else test.fail('no caption in the answer: ' + textOf(edit));

  test.reportSuccessFailureCount();
}());
