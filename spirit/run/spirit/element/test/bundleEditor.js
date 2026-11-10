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
  if (!fs.existsSync(FILE)) { test.fail('spirit/element/bundleEditor.js is not there'); return; }
  const SRC = fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '');
  ok(!/apiBranchSelector|createApiBranchSelector|description/.test(SRC), 'it names no api-branch selector and no description: a bundle is a label, its branches the branch editor\'s', 'bundleEditor.js still names them');
  const asked = [];
  const required = [];
  const sels = [];
  const forms = [];
  let answer = function () { return Promise.resolve({ id: 9 }); };
  const auth = { bundle: function (a) { asked.push(a); return answer(a); } };
  const STANDS = {
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
  // The page's one data set, its node known (goal/G41.28, Q10), as spirit.start leaves it before any element runs.
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), { filename: 'data.js' });
  global.window.spirit.node = { key: 'KEY+BUNDLE/EDITOR==' };
  global.window.spirit.data.homeNode(global.window.spirit.node.key);
  // A family's cache: the family's own manager, run on this window; the watches on its bundles table counted, and their
  // releases.
  const managers = [];
  const watches = { made: 0, released: 0 };
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
  function arrive(id, label) { global.window.spirit.data.takeJob({ id: 'bundles', type: 'bundles', data: { table: 'bundle', row: { id: id, label: label, owner: 'node' } } }); }
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](((global.window.spirit.element.spirit = global.window.spirit.element.spirit || {}).element = global.window.spirit.element.spirit.element || {})); } return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  const E = ((global.window.spirit.element || {}).spirit || {}).element || {};

  test.subHeading('it loads what it uses itself (rule/26)');
  ok(['spirit/element/fieldInput.js', 'spirit/element/search/bundle.js'].every(function (p) { return required.indexOf(p) !== -1; }), 'it requires the field input and the bundle selector through spirit.require', 'required: ' + short(required));
  ok(managers.indexOf('auth') !== -1, 'it loads the auth family\'s cache manager, whose bundles it adds to (goal/G41.28)', 'managers: ' + short(managers));
  ok(E.bundleEditor && typeof E.bundleEditor.create === 'function', 'it registers spirit.element.spirit.element.bundleEditor.create', 'elements: ' + short(Object.keys(E)));
  if (!E.bundleEditor || typeof E.bundleEditor.create !== 'function') return;

  test.subHeading('at the top: new [label] [Add]');
  // Andy, box: "the [add-Button] refused an empty or invalid label"; the form itself is goal/G41.27's rowForm (below).
  const box = node('box');
  const made = E.bundleEditor.create(box, {});
  await settle();
  const input = all(box).filter(function (k) { return k.tag === 'input'; })[0];
  const add = all(box).filter(function (k) { return k.tag === 'button' && /^\s*Add\s*$/.test(k.textContent || ''); })[0];
  ok(!!input && !!add, 'it draws a label input and an Add button', 'input ' + !!input + ', Add ' + !!add);
  if (!input || !add) return;
  // Andy, on G41.27: "bundleEditor:\n[➕] [label] [Add]". The box: "spirit.element.spirit.element.rowForm.create(container, { icon, button }) -> { root, span, button }", "The mounter drops its form elements into span and wires the button itself".
  ok(required.indexOf('spirit/element/rowForm.js') !== -1, 'it loads the rowForm itself (rule/26)', 'required: ' + short(required));
  const rf = forms[0];
  ok(forms.length === 1 && rf.opts.icon === '➕' && rf.opts.button === 'Add' && all(box).indexOf(rf.root) !== -1, 'its add form is one rowForm in its box, its icon ➕ and its button Add', 'rowForms: ' + short(forms.map(function (f) { return f.opts; })));
  ok(!!rf && rf.span.kids.length === 1 && rf.span.kids[0] === input, 'its span holds the label input, and nothing else', 'span holds ' + (rf ? rf.span.kids.length : 0) + (rf && rf.span.kids[0] === input ? ', the input' : ''));
  ok(!!rf && add === rf.button && all(box).filter(function (k) { return k.tag === 'button' && /^\s*Add\s*$/.test(k.textContent || ''); }).length === 1, 'its Add is the rowForm\'s button, the only Add', 'Add is the form\'s ' + (rf && add === rf.button));
  ok(!/\bnew\b/.test(text(box)), 'the word "new" at its start is gone, ➕ in its place', 'text: ' + short(text(box)));
  ok(!!input.heard.beforeinput, 'the input is a fieldInput, held to the label\'s rule', 'listeners: ' + short(Object.keys(input.heard)));
  ok(asked.length === 0, 'drawn, it asks the node nothing', 'asked: ' + short(asked));
  add.dispatchEvent({ type: 'click' });
  input.value = '   '; add.dispatchEvent({ type: 'click' });
  input.value = 'x'.repeat(70); add.dispatchEvent({ type: 'click' });
  await settle();
  ok(asked.length === 0, 'Add refuses an empty label, or one the label\'s rule refuses: nothing asked', 'asked: ' + short(asked));

  test.subHeading('below it, filling the rest: the bundles, as a pane');
  // Andy, goal/G41.32: "the bundleSelector:pane looses both the 'Edit' button and the 'Delete' Button." A row pressed
  // opens its branchEditor tab (the row element's, tested in its own folder).
  const sel = sels[0];
  // goal/G41.25, box: "the bundleSelector's list will gain a new column \"owner\", displayed right after the bundles label."
  ok(!!sel && sel.container === box && all(box).indexOf(sel) !== -1 && sel.o.face === 'pane' && JSON.stringify(sel.o.columns) === '["label","owner"]' && !sel.o.editable,
    'bundleSelector.create(its box, a pane, columns label, owner), its labels shown only (goal/G41.26: "the Label should now just be an output")', 'selector: ' + short(sel && sel.o) + ', in its box ' + !!(sel && sel.container === box));
  ok(!!sel && (/\bfill\b/.test(sel.className || '') || holds(box, 'fill')), 'in a box that fills the space left (shell.css fill)', 'classes: ' + short(all(box).map(function (k) { return k.className; })));
  if (!sel) return;

  test.subHeading('Add');
  input.value = '  Reader ';
  const r0 = sel.refreshed;
  add.dispatchEvent({ type: 'click' });
  await settle();
  // Andy, goal/G41.32: "A user can only create, change and delete node-owned bundles and branches, and sees the others
  // read-only": the add names no owner.
  ok(asked.length === 1 && asked[0].op === 'add' && asked[0].label === 'Reader' && Object.keys(asked[0]).length === 2, 'a valid label asks auth.bundle { op: add, label }, the label as the rule writes it (goal/G41.32: a user makes node-owned bundles alone)', 'asked: ' + short(asked));
  // goal/G41.28 (Andy: "EVERY FUCKING ELEMENT is verified to make sure when it changes shit it listens to fucking update
  // via the spirit object"): what it adds, it listens for, in spirit.data.auth.data.bundles.
  ok(input.value === '  Reader ' && !/\badded\b/.test(text(box)), 'answered, before the bundle is in the auth family\'s cache, the label stays and nothing is said added', 'input ' + short(input.value) + ', text: ' + short(text(box)));
  arrive(7, 'Somebody else');
  await settle();
  ok(input.value === '  Reader ', 'another bundle arriving leaves the label as it is', 'input ' + short(input.value));
  arrive(8, 'Reader');
  await settle();
  ok(input.value === '' && /\badded\b/.test(text(box)), 'once the bundle it asked for is in spirit.data.auth.data.bundles, the input is empty for the next and the add is said', 'input ' + short(input.value) + ', text: ' + short(text(box)));
  ok(sel.refreshed === r0, 'it asks its pane to search nothing again: the pane is a view of that branch', 'refreshed ' + (sel.refreshed - r0));
  answer = function () { return Promise.reject(Object.assign(new Error('label refused'), { refusal: 'bad-request' })); };
  input.value = 'Writer';
  add.dispatchEvent({ type: 'click' });
  await settle();
  ok(/label refused|bad-request/.test(text(box)) && input.value === 'Writer', 'a refused add is said in the panel, in the node\'s words, and the label stays to be mended', 'text: ' + short(text(box)) + ', input ' + short(input.value));

  test.subHeading('destroy');
  ok(made && typeof made.destroy === 'function', 'create answers { destroy }', 'made: ' + short(made && Object.keys(made)));
  if (made && typeof made.destroy === 'function') {
    const w0 = watches.released;
    made.destroy();
    ok(box.kids.length === 0, 'destroy empties its box', 'kids left: ' + box.kids.length);
    ok(watches.released === w0 + 1, 'destroy lets its watch on spirit.data.auth.data.bundles go', 'released ' + (watches.released - w0) + ' of ' + watches.made + ' made');
    ok(sel.destroyed === 1, 'destroy lets its bundle pane go', 'pane destroyed ' + sel.destroyed);
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
