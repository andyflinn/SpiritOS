'use strict';

// spirit/run/shell/js/test/bundleEditor.js
// The tests of shell/js/bundleEditor.js, and of no other module (spec: ./bundleEditor.md; goal/G41.14). The browser file
// runs in node on a BARE window (rule/26): nothing is on the page until the editor requires it. The field input is put
// there real; the bundle selector is a stand-in that keeps what it was handed (it is tested in its own file). The node's
// auth family is the spirit object's, each call recorded.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'bundleEditor.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

function node(tag) {
  const heard = {};
  const n = { tag: tag, kids: [], style: {}, hidden: false, className: '', value: '', textContent: '', attrs: {},
    appendChild: function (c) { n.kids.push(c); return c; },
    setAttribute: function (k, v) { n.attrs[k] = String(v); }, getAttribute: function (k) { return k in n.attrs ? n.attrs[k] : null; },
    addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
    removeEventListener: function () {}, heard: heard,
    dispatchEvent: function (e) { (heard[e.type] || []).slice().forEach(function (fn) { fn(e); }); return true; } };
  let html = '';
  Object.defineProperty(n, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); n.kids.length = 0; } });
  return n;
}
function all(root) { const out = []; (function walk(x) { (x.kids || []).forEach(function (k) { out.push(k); walk(k); }); }(root)); return out; }
function text(root) { return all(root).map(function (k) { return String(k.textContent || ''); }).join(' '); }
function holds(root, cls) { return all(root).some(function (k) { return new RegExp('\\b' + cls + '\\b').test(k.className || ''); }); }

test.startTest('bundleEditor.js: the bundles, made and kept');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('shell/js/bundleEditor.js is not there'); return; }
  const SRC = fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '');
  ok(!/apiBranchSelector|createApiBranchSelector|description/.test(SRC), 'it names no api-branch selector and no description: a bundle is a label, its branches the branch editor\'s', 'bundleEditor.js still names them');
  const asked = [];
  const required = [];
  const sels = [];
  let answer = function () { return Promise.resolve({ id: 9 }); };
  const auth = { bundle: function (a) { asked.push(a); return answer(a); } };
  const STANDS = {
    'shell/js/fieldInput.js': function () { vm.runInThisContext(fs.readFileSync(path.join(RUN, 'shell', 'js', 'fieldInput.js'), 'utf8'), { filename: 'fieldInput.js' }); },
    // The shell's element shape (goal/G41.19): create(container, options) appends the control and answers it.
    'shell/js/bundleSelector.js': function (E) { E.bundleSelector = { create: function (c, o) { const s = node('bundles'); s.o = o || {}; s.container = c; s.refreshed = 0; s.refresh = function () { s.refreshed += 1; }; sels.push(s); c.appendChild(s); return s; } }; },
  };
  global.Event = function (type, o) { this.type = type; this.bubbles = !!(o && o.bubbles); };
  global.document = { createElement: function (t) { return node(t); }, createTextNode: function (t) { const n = node('#text'); n.textContent = String(t); return n; } };
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); }, fieldRules: require(path.join(RUN, 'spirit', 'fieldRules.js')),
    ready: Promise.resolve({ auth: auth }), auth: auth, elements: {} } };
  global.spirit = global.window.spirit;
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](global.window.spirit.elements); } return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  const E = global.window.spirit.elements;

  test.subHeading('it loads what it uses itself (rule/26)');
  ok(['shell/js/fieldInput.js', 'shell/js/bundleSelector.js'].every(function (p) { return required.indexOf(p) !== -1; }), 'it requires the field input and the bundle selector through spirit.require', 'required: ' + short(required));
  ok(E.bundleEditor && typeof E.bundleEditor.create === 'function', 'it registers spirit.elements.bundleEditor.create', 'elements: ' + short(Object.keys(E)));
  if (!E.bundleEditor || typeof E.bundleEditor.create !== 'function') return;

  test.subHeading('at the top: new [label] [Add]');
  // Andy, box: "top: a one-row add form: \"new\" [fieldInput.js/fieldRules:Label input field] [Add-Button]", and "the
  // [add-Button] refused an empty or invalid label".
  const box = node('box');
  const made = E.bundleEditor.create(box, {});
  await settle();
  const input = all(box).filter(function (k) { return k.tag === 'input'; })[0];
  const add = all(box).filter(function (k) { return k.tag === 'button' && /^\s*Add\s*$/.test(k.textContent || ''); })[0];
  ok(!!input && !!add, 'it draws a label input and an Add button', 'input ' + !!input + ', Add ' + !!add);
  if (!input || !add) return;
  ok(/\bnew\b/.test(text(box)), 'the row reads new', 'text: ' + short(text(box)));
  ok(!!input.heard.beforeinput, 'the input is a fieldInput, held to the label\'s rule', 'listeners: ' + short(Object.keys(input.heard)));
  ok(asked.length === 0, 'drawn, it asks the node nothing', 'asked: ' + short(asked));
  add.dispatchEvent({ type: 'click' });
  input.value = '   '; add.dispatchEvent({ type: 'click' });
  input.value = 'x'.repeat(70); add.dispatchEvent({ type: 'click' });
  await settle();
  ok(asked.length === 0, 'Add refuses an empty label, or one the label\'s rule refuses: nothing asked', 'asked: ' + short(asked));

  test.subHeading('below it, filling the rest: the bundles, as a pane');
  // Andy, box: "the bundleSelector in pane-mode, with the following columns 1. [fieldInput:fieldRule:Label] ... 2. an
  // edit button, leading to the branchEditor.js ... 3. a delete armingButton.js".
  const sel = sels[0];
  // goal/G41.25, box: "the bundleSelector's list will gain a new column \"owner\", displayed right after the bundles label."
  ok(!!sel && sel.container === box && all(box).indexOf(sel) !== -1 && sel.o.face === 'pane' && JSON.stringify(sel.o.columns) === '["label","owner","edit","delete"]' && !sel.o.editable,
    'bundleSelector.create(its box, a pane, columns label, owner, edit, delete), its labels shown only (goal/G41.26: "the Label should now just be an output")', 'selector: ' + short(sel && sel.o) + ', in its box ' + !!(sel && sel.container === box));
  ok(!!sel && (/\bfill\b/.test(sel.className || '') || holds(box, 'fill')), 'in a box that fills the space left (shell.css fill)', 'classes: ' + short(all(box).map(function (k) { return k.className; })));
  if (!sel) return;

  test.subHeading('Add');
  input.value = '  Reader ';
  const r0 = sel.refreshed;
  add.dispatchEvent({ type: 'click' });
  await settle();
  // goal/G41.25, box: "when a bundle is added the \"owner\" field will ALWAYS be set to \"node\", unless the bundleEditor
  // was mounted for an appServer".
  ok(asked.length === 1 && asked[0].op === 'add' && asked[0].label === 'Reader' && asked[0].owner === 'node' && Object.keys(asked[0]).length === 3, 'a valid label asks auth.bundle { op: add, label, owner: node }, the label as the rule writes it, mounted for no app server', 'asked: ' + short(asked));
  ok(sel.refreshed > r0 && input.value === '', 'answered, the list searches again and the input is empty for the next', 'refreshed ' + (sel.refreshed - r0) + ', input ' + short(input.value));
  answer = function () { return Promise.reject(Object.assign(new Error('label refused'), { refusal: 'bad-request' })); };
  input.value = 'Writer';
  add.dispatchEvent({ type: 'click' });
  await settle();
  ok(/label refused|bad-request/.test(text(box)) && input.value === 'Writer', 'a refused add is said in the panel, in the node\'s words, and the label stays to be mended', 'text: ' + short(text(box)) + ', input ' + short(input.value));

  test.subHeading('goal/G41.25: mounted for an app server, its adds are that server\'s');
  // Andy, box: "the bundle-editor can be optionally configured with an <AppServerName> (family) at mount-time", and
  // "then the owner field sill be set to <AppServerName>".
  answer = function () { return Promise.resolve({ id: 10 }); };
  const box2 = node('box');
  E.bundleEditor.create(box2, { family: 'agent' });
  await settle();
  const input2 = all(box2).filter(function (k) { return k.tag === 'input'; })[0];
  const add2 = all(box2).filter(function (k) { return k.tag === 'button' && /^\s*Add\s*$/.test(k.textContent || ''); })[0];
  const n0 = asked.length;
  if (input2 && add2) { input2.value = 'Agent tools'; add2.dispatchEvent({ type: 'click' }); await settle(); }
  const a2 = asked[n0];
  ok(!!a2 && a2.op === 'add' && a2.label === 'Agent tools' && a2.owner === 'agent' && asked.length === n0 + 1, 'create(box, { family }) adds each bundle with that app server as its owner: auth.bundle { op: add, label, owner: family }', 'asked: ' + short(asked.slice(n0)));

  test.subHeading('destroy');
  ok(made && typeof made.destroy === 'function', 'create answers { destroy }', 'made: ' + short(made && Object.keys(made)));
  if (made && typeof made.destroy === 'function') { made.destroy(); ok(box.kids.length === 0, 'destroy empties its box', 'kids left: ' + box.kids.length); }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
