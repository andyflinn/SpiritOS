'use strict';

// spirit/run/spirit/element/test/bundleEditor.js
// The tests of spirit/element/bundleEditor.js, and of no other module (spec: ./bundleEditor.md; goal/G41.14). The browser file
// runs in node on a BARE window (rule/26): nothing is on the page until the editor requires it. The field input is put
// there real; the bundle selector is a stand-in that keeps what it was handed (it is tested in its own file). The node's
// auth family is the spirit object's, each call recorded. The page's data set and the auth family's cache manager are the
// real ones (goal/G41.28).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'bundleEditor.js');

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

// What the tests make, shared by the tests after them.
let SRC, asked, required, sels, forms, answer, auth, STANDS, managers, watches, arrive, E, box, made, input, add, rf,
  sel, r0, w0;
test.run('it names no api-branch selector and no description: a bundle is a label, its branches the branch editor\'s', 0.2, function () {
  SRC = fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '');
  return (!/apiBranchSelector|createApiBranchSelector|description/.test(SRC)) ? true : 'bundleEditor.js still names them';
}, 1000);
test.run('it requires the field input and the bundle selector through spirit.require', 0.2, async function () {
  asked = [];
  required = [];
  sels = [];
  forms = [];
  answer = function () { return Promise.resolve({ id: 9 }); };
  auth = { bundle: function (a) { asked.push(a); return answer(a); } };
  STANDS = {
    // The one-row form (goal/G41.27), tested in its own folder: a stand-in answering { root, span, button } as the real
    // one does, its root appended to the container it is given, its button saying the words it was handed.
    'spirit/element/rowForm.js': function (E) { E.rowForm = { create: function (c, o) {
      const f = { container: c, opts: o || {}, root: node('div'), span: node('span'), button: node('button') };
      f.button.textContent = String((o && o.button) || ''); f.root.appendChild(f.span); f.root.appendChild(f.button); c.appendChild(f.root); forms.push(f); return f;
    } }; },
    'spirit/element/fieldInput.js': function () { vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'element', 'fieldInput.js'), 'utf8'), { filename: 'fieldInput.js' }); },
    // The shell's element shape (goal/G41.19): create(container, options) appends the control and answers it.
    'spirit/element/search/bundle.js': function (E) { (E.search = E.search || {}).bundle = { create: function (c, o) { const s = node('bundles'); s.o = o || {}; s.container = c; s.refreshed = 0; s.destroyed = 0; s.refresh = function () { s.refreshed += 1; }; s.destroy = function () { s.destroyed += 1; }; sels.push(s); c.appendChild(s); return s; } }; },
  };
  global.Event = function (type, o) { this.type = type; this.bubbles = !!(o && o.bubbles); };
  global.document = { createElement: function (t) { return node(t); }, createTextNode: function (t) { const n = node('#text'); n.textContent = String(t); return n; } };
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); }, fieldRules: require(path.join(RUN, 'spirit', 'fieldRules.js')),
    ready: Promise.resolve({ auth: auth }), auth: auth, element: {} } };
  global.spirit = global.window.spirit;
  // goal/G43.32: the element places itself by installSpiritElement, and fieldInput, a helper, stands in spirit.required
  // (spirit/test/headLessChrome.js pageSpirit).
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(global.window.spirit);
  // The page's one data set, its node known (goal/G41.28, Q10), as spirit.start leaves it before any element runs.
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), { filename: 'data.js' });
  global.window.spirit.node = { key: 'KEY+BUNDLE/EDITOR==' };
  global.window.spirit.data.homeNode(global.window.spirit.node.key);
  // A family's cache: the family's own manager, run on this window; the watches on its bundles table counted, and their
  // releases.
  managers = [];
  watches = { made: 0, released: 0 };
  global.window.spirit.cacheManager = function (name) {
    managers.push(String(name));
    vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', String(name), 'data.js'), 'utf8'), { filename: name + '/data.js' });
    const T = ((global.window.spirit.data || {}).auth || {}).data && global.window.spirit.data.auth.data.bundles;
    if (T && !T.counted) {
      const own = T.watch; T.counted = true;
      T.watch = function (fn) { watches.made += 1; const stop = own(fn); return function () { watches.released += 1; return stop(); }; };
    }
    return Promise.resolve(true);
  };
  arrive = function (id, label) { global.window.spirit.data.takeJob({ id: 'bundles', type: 'bundles', data: { table: 'bundle', row: { id: id, label: label, owner: 'node' } } }); };
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](((global.window.spirit.element.spirit = global.window.spirit.element.spirit || {}).element = global.window.spirit.element.spirit.element || {})); } return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  E = ((global.window.spirit.element || {}).spirit || {}).element || {};
  // it loads what it uses itself (rule/26)
  return (['spirit/element/fieldInput.js', 'spirit/element/search/bundle.js'].every(function (p) { return required.indexOf(p) !== -1; })) ? true : 'required: ' + short(required);
}, 1000);
test.run('it loads the auth family\'s cache manager, whose bundles it adds to (goal/G41.28)', 0.2, function () {
  return (managers.indexOf('auth') !== -1) ? true : 'managers: ' + short(managers);
}, 1000);
test.run('it registers spirit.element.spirit.element.bundleEditor.create', 0.2, function () {
  return (E.bundleEditor && typeof E.bundleEditor.create === 'function') ? true : 'elements: ' + short(Object.keys(E));
}, 1000);
test.run('it draws a label input and an Add button', 0.2, async function () {
  // at the top: new [label] [Add]
  // Andy, box: "the [add-Button] refused an empty or invalid label"; the form itself is goal/G41.27's rowForm (below).
  box = node('box');
  made = E.bundleEditor.create(box, {});
  await settle();
  input = all(box).filter(function (k) { return k.tag === 'input'; })[0];
  add = all(box).filter(function (k) { return k.tag === 'button' && /^\s*Add\s*$/.test(k.textContent || ''); })[0];
  return (!!input && !!add) ? true : 'input ' + !!input + ', Add ' + !!add;
}, 1000);
test.run('it loads the rowForm itself (rule/26)', 0.2, function () {
  // Andy, on G41.27: "bundleEditor:\n[➕] [label] [Add]". The box: "spirit.element.spirit.element.rowForm.create(container, { icon, button }) -> { root, span, button }", "The mounter drops its form elements into span and wires the button itself".
  return (required.indexOf('spirit/element/rowForm.js') !== -1) ? true : 'required: ' + short(required);
}, 1000);
test.run('its add form is one rowForm in its box, its icon ➕ and its button Add', 0.2, function () {
  rf = forms[0];
  return (forms.length === 1 && rf.opts.icon === '➕' && rf.opts.button === 'Add' && all(box).indexOf(rf.root) !== -1) ? true : 'rowForms: ' + short(forms.map(function (f) { return f.opts; }));
}, 1000);
test.run('its span holds the label input, and nothing else', 0.2, function () {
  return (!!rf && rf.span.kids.length === 1 && rf.span.kids[0] === input) ? true : 'span holds ' + (rf ? rf.span.kids.length : 0) + (rf && rf.span.kids[0] === input ? ', the input' : '');
}, 1000);
test.run('its Add is the rowForm\'s button, the only Add', 0.2, function () {
  return (!!rf && add === rf.button && all(box).filter(function (k) { return k.tag === 'button' && /^\s*Add\s*$/.test(k.textContent || ''); }).length === 1) ? true : 'Add is the form\'s ' + (rf && add === rf.button);
}, 1000);
test.run('the word "new" at its start is gone, ➕ in its place', 0.2, function () {
  return (!/\bnew\b/.test(text(box))) ? true : 'text: ' + short(text(box));
}, 1000);
test.run('the input is a fieldInput, held to the label\'s rule', 0.2, function () {
  return (!!input.heard.beforeinput) ? true : 'listeners: ' + short(Object.keys(input.heard));
}, 1000);
test.run('drawn, it asks the node nothing', 0.2, function () {
  return (asked.length === 0) ? true : 'asked: ' + short(asked);
}, 1000);
test.run('Add refuses an empty label, or one the label\'s rule refuses: nothing asked', 0.2, async function () {
  add.dispatchEvent({ type: 'click' });
  input.value = '   ';
  add.dispatchEvent({ type: 'click' });
  input.value = 'x'.repeat(70);
  add.dispatchEvent({ type: 'click' });
  await settle();
  return (asked.length === 0) ? true : 'asked: ' + short(asked);
}, 1000);
test.run('bundleSelector.create(its box, a pane, columns label, owner), its labels shown only (goal/G41.26: "the Label should now just be an output")', 0.2, function () {
  // below it, filling the rest: the bundles, as a pane
  // Andy, goal/G41.32: "the bundleSelector:pane looses both the 'Edit' button and the 'Delete' Button." A row pressed
  // opens its branchEditor tab (the row element's, tested in its own folder).
  sel = sels[0];
  // goal/G41.25, box: "the bundleSelector's list will gain a new column \"owner\", displayed right after the bundles label."
  return (!!sel && sel.container === box && all(box).indexOf(sel) !== -1 && sel.o.face === 'pane' && JSON.stringify(sel.o.columns) === '["label","owner"]' && !sel.o.editable) ? true : 'selector: ' + short(sel && sel.o) + ', in its box ' + !!(sel && sel.container === box);
}, 1000);
test.run('in a box that fills the space left (shell.css fill)', 0.2, function () {
  return (!!sel && (/\bfill\b/.test(sel.className || '') || holds(box, 'fill'))) ? true : 'classes: ' + short(all(box).map(function (k) { return k.className; }));
}, 1000);
test.run('a valid label asks auth.bundle { op: add, label }, the label as the rule writes it (goal/G41.32: a user makes node-owned bundles alone)', 0.2, async function () {
  // Add
  input.value = '  Reader ';
  r0 = sel.refreshed;
  add.dispatchEvent({ type: 'click' });
  await settle();
  // Andy, goal/G41.32: "A user can only create, change and delete node-owned bundles and branches, and sees the others
  // read-only": the add names no owner.
  return (asked.length === 1 && asked[0].op === 'add' && asked[0].label === 'Reader' && Object.keys(asked[0]).length === 2) ? true : 'asked: ' + short(asked);
}, 1000);
test.run('answered, before the bundle is in the auth family\'s cache, the label stays and nothing is said added', 0.2, function () {
  // goal/G41.28 (Andy: "EVERY FUCKING ELEMENT is verified to make sure when it changes shit it listens to fucking update
  // via the spirit object"): what it adds, it listens for, in spirit.data.auth.data.bundles.
  return (input.value === '  Reader ' && !/\badded\b/.test(text(box))) ? true : 'input ' + short(input.value) + ', text: ' + short(text(box));
}, 1000);
test.run('another bundle arriving leaves the label as it is', 0.2, async function () {
  arrive(7, 'Somebody else');
  await settle();
  return (input.value === '  Reader ') ? true : 'input ' + short(input.value);
}, 1000);
test.run('once the bundle it asked for is in spirit.data.auth.data.bundles, the input is empty for the next and the add is said', 0.2, async function () {
  arrive(8, 'Reader');
  await settle();
  return (input.value === '' && /\badded\b/.test(text(box))) ? true : 'input ' + short(input.value) + ', text: ' + short(text(box));
}, 1000);
test.run('it asks its pane to search nothing again: the pane is a view of that branch', 0.2, function () {
  return (sel.refreshed === r0) ? true : 'refreshed ' + (sel.refreshed - r0);
}, 1000);
test.run('a refused add is said in the panel, in the node\'s words, and the label stays to be mended', 0.2, async function () {
  answer = function () { return Promise.reject(Object.assign(new Error('label refused'), { refusal: 'bad-request' })); };
  input.value = 'Writer';
  add.dispatchEvent({ type: 'click' });
  await settle();
  return (/label refused|bad-request/.test(text(box)) && input.value === 'Writer') ? true : 'text: ' + short(text(box)) + ', input ' + short(input.value);
}, 1000);
test.run('create answers { destroy }', 0.2, function () {
  // destroy
  return (made && typeof made.destroy === 'function') ? true : 'made: ' + short(made && Object.keys(made));
}, 1000);
test.run('destroy empties its box', 0.2, function () {
  w0 = watches.released;
  made.destroy();
  return (box.kids.length === 0) ? true : 'kids left: ' + box.kids.length;
}, 1000);
test.run('destroy lets its watch on spirit.data.auth.data.bundles go', 0.2, function () {
  return (watches.released === w0 + 1) ? true : 'released ' + (watches.released - w0) + ' of ' + watches.made + ' made';
}, 1000);
test.run('destroy lets its bundle pane go', 0.2, function () {
  return (sel.destroyed === 1) ? true : 'pane destroyed ' + sel.destroyed;
}, 1000);
