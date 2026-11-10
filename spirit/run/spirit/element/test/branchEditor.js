'use strict';

// spirit/run/spirit/element/test/branchEditor.js
// The tests of spirit/element/branchEditor.js, and of no other module (spec: ./branchEditor.md; goal/G41.14). The browser file
// runs in node on a BARE window (rule/26): nothing is on the page until the editor requires it, but the shell's own
// navigation, a recorder of the pages pushed. The family and branch selectors are stand-ins that keep what they
// were handed; each is tested in its own file. The node's auth family is the spirit object's, each call recorded.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'branchEditor.js');

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
    removeEventListener: function () {},
    dispatchEvent: function (e) { (heard[e.type] || []).slice().forEach(function (fn) { fn(e); }); return true; } };
  return n;
}
function all(root) { const out = []; (function walk(x) { (x.kids || []).forEach(function (k) { out.push(k); walk(k); }); }(root)); return out; }
function text(root) { return all(root).map(function (k) { return String(k.textContent || ''); }).join(' '); }

test.startTest('branchEditor.js: one bundle\'s branches, edited');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('spirit/element/branchEditor.js is not there'); return; }
  const asked = [];
  const required = [];
  const pages = [];
  const families = [];
  const branchSels = [];
  const forms = [];
  let answer = function (a) { return Promise.resolve({ id: 11 }); };
  const auth = { branch: function (a) { asked.push(a); return answer(a); }, bundle: function (a) { asked.push(a); return Promise.resolve({ id: a.id }); } };
  const armed = [];
  const bundleWatches = [];
  const STANDS = {
    // The one-row form (goal/G41.27), tested in its own folder: a stand-in answering { root, span, button } as the real
    // one does, its root appended to the container it is given, its button saying the words it was handed.
    'spirit/element/rowForm.js': function (E) { E.rowForm = { create: function (c, o) {
      const f = { container: c, opts: o || {}, root: node('div'), span: node('span'), button: node('button') };
      f.button.textContent = String((o && o.button) || ''); f.root.appendChild(f.span); f.root.appendChild(f.button); c.appendChild(f.root); forms.push(f); return f;
    } }; },
    'spirit/element/armingButton.js': function (E) { E.armingButton = { attach: function (b, o) { armed.push({ button: b, o: o }); return b; } }; },
    // The shell's element shape (goal/G41.19): create(container, options) appends the control and answers it.
    'spirit/element/search/api.js': function (E) { (E.search = E.search || {}).api = { create: function (c, o) { const f = node('family'); f.o = o || {}; f.container = c; f.family = ''; f.verb = ''; f.value = ''; families.push(f); c.appendChild(f); return f; } }; },
    'spirit/element/search/branch.js': function (E) { (E.search = E.search || {}).branch = { create: function (c, o) { const b = node('branches'); b.o = o || {}; b.container = c; b.refreshed = 0; b.refresh = function () { b.refreshed += 1; }; branchSels.push(b); c.appendChild(b); return b; } }; },
  };
  global.Event = function (type, o) { this.type = type; this.bubbles = !!(o && o.bubbles); };
  global.document = { createElement: function (t) { return node(t); }, createTextNode: function (t) { const n = node('#text'); n.textContent = String(t); return n; } };
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); }, ready: Promise.resolve({ auth: auth }), auth: auth,
    get element() { return this.elements; }, elements: { navigation: { push: function (page) { const p = { page: page, box: node('box'), nav: { close: function () {}, setTitle: function () {} } }; pages.push(p); return p.nav; } } } } };
  global.spirit = global.window.spirit;
  // goal/G43.32: the element places itself by installSpiritElement, as it runs (spirit/test/headLessChrome.js pageSpirit).
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(global.window.spirit);
  ((global.window.spirit.data = global.window.spirit.data || {}).auth = {}).data = { bundles: { watch: function (fn) { bundleWatches.push(fn); return function () {}; } }, branches: { watch: function () { return function () {}; } } };
  global.window.spirit.cacheManager = function () { return Promise.resolve(); };
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](((global.window.spirit.element.spirit = global.window.spirit.element.spirit || {}).element = global.window.spirit.element.spirit.element || {})); } return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  const E = ((global.window.spirit.element || {}).spirit || {}).element || {};

  test.subHeading('it loads what it uses itself (rule/26)');
  ok(['spirit/element/search/api.js', 'spirit/element/search/branch.js'].every(function (p) { return required.indexOf(p) !== -1; }),
    'it requires the family selector and the branch selector through spirit.require', 'required: ' + short(required));
  ok(E.branchEditor && typeof E.branchEditor.create === 'function' && E.branchEditor.open === undefined, 'it registers spirit.element.spirit.element.branchEditor.create, and no page of its own (goal/G41.32)', 'elements: ' + short(Object.keys(E.branchEditor || {})));
  if (!E.branchEditor || typeof E.branchEditor.create !== 'function') return;

  test.subHeading('always on one bundle');
  // Andy, box: "the branchEditor page is always configured with a bundle key".
  const box = node('box');
  let closed = 0;
  const tabbed = E.branchEditor.create(box, { bundle: 7, label: 'Reader', gone: function () { closed += 1; } });
  await settle();
  const bs = branchSels[0];
  ok(!!bs && bs.container === box && bs.o.bundle === 7 && bs.o.face === 'pane' && JSON.stringify(bs.o.columns) === '["family","verb","delete"]' && all(box).indexOf(bs) !== -1,
    'its list is branchSelector.create(the page, a pane on that bundle, columns family, verb, delete)', 'branch selector: ' + short(bs && bs.o) + ', in the page ' + !!(bs && bs.container === box));

  test.subHeading('the add form, a rowForm: ➕ [family, its verb] [Add] (goal/G41.27)');
  // Andy, on G41.27: "branchEditor:\n\n[➕] [choose a family… ▾] [Add]", then "careful, there's a hidden verb selector
  // there that only displays when a family is selected... !\n[➕] [choose a family… ▾] [All Verbs ▾] [Add]". And
  // "apiFamiliySelector.js will use apiVerbSelector as part of itself": the two dropdowns are its two halves, the verb's
  // hiding until a family is chosen the family selector's own (its test).
  const fam = families[0];
  const add = all(box).filter(function (k) { return k.tag === 'button' && /^\s*Add\s*$/.test(k.textContent || ''); })[0];
  ok(required.indexOf('spirit/element/rowForm.js') !== -1, 'it loads the rowForm itself (rule/26)', 'required: ' + short(required));
  const rf = forms[0];
  ok(forms.filter(function (f) { return f.opts.icon === '➕'; }).length === 1 && rf.opts.icon === '➕' && rf.opts.button === 'Add' && all(box).indexOf(rf.root) !== -1, 'its add form is one rowForm in the page, its icon ➕ and its button Add', 'rowForms: ' + short(forms.map(function (f) { return f.opts; })));
  const inSpan = !!rf && !!fam && rf.span.kids.length === 1 && (rf.span.kids[0] === fam || (rf.span.kids[0].kids || []).indexOf(fam) !== -1 && rf.span.kids[0].kids.length === 1);
  ok(families.length === 1 && inSpan && fam.o.all === 'choose a family…', 'its span holds the one family selector, choose a family…, its verb half with it, and nothing else', 'family ' + families.length + ', in the span ' + inSpan + ', all ' + short(fam && fam.o.all));
  ok(!!rf && !!add && add === rf.button && all(box).filter(function (k) { return k.tag === 'button' && /^\s*Add\s*$/.test(k.textContent || ''); }).length === 1, 'its Add is the rowForm\'s button, the only Add', 'Add is the form\'s ' + !!(rf && add === rf.button));
  if (!fam || !add) return;
  ok(!/\bnew\b/.test(text(box)), 'the word "new" at its start is gone, ➕ in its place', 'text: ' + short(text(box)));
  add.dispatchEvent({ type: 'click' });
  await settle();
  ok(asked.length === 0, 'Add with no family asks nothing', 'asked: ' + short(asked));
  fam.family = 'desk'; fam.value = 'desk'; fam.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
  const r0 = bs.refreshed;
  add.dispatchEvent({ type: 'click' });
  await settle();
  ok(asked.length === 1 && asked[0].op === 'add' && asked[0].bundle === 7 && asked[0].family === 'desk' && asked[0].verb === '', 'Add with the verb left at All Verbs asks auth.branch { op: add, bundle, family, verb: \'\' }', 'asked: ' + short(asked));
  ok(bs.refreshed > r0, 'an answered add makes the list search again', 'refreshed: ' + (bs.refreshed - r0));
  fam.verb = 'chat.add'; fam.value = 'desk.chat.add';
  answer = function () { return Promise.reject(Object.assign(new Error('already in this bundle'), { refusal: 'already-in-bundle' })); };
  add.dispatchEvent({ type: 'click' });
  await settle();
  ok(asked.length === 2 && asked[1].verb === 'chat.add', 'a verb chosen is sent as it is', 'asked: ' + short(asked));
  ok(/already-in-bundle|already in this bundle/.test(text(box)), 'a refused add is said in the page, in the node\'s words', 'text: ' + short(text(box)));

  test.subHeading('goal/G41.32: its Delete row at the bottom, and hearing its deletion');
  // Andy: "i need the branchEditor to have a rowForm at the bottom: [❌] \"Delete <bundle-name> bundle and branches \" [Delete (armingButton)]."
  const dr = forms[1];
  ok(!!dr && dr.opts.icon === '❌' && dr.opts.button === 'Delete' && dr.span.textContent === 'Delete Reader bundle and branches' && box.kids.indexOf(dr.root) > box.kids.indexOf(bs), 'a second rowForm below the list: ❌, the words, Delete', 'form: ' + short(dr && dr.opts) + ', says ' + short(dr && dr.span.textContent));
  const del = armed.filter(function (a) { return dr && a.button === dr.button; })[0];
  ok(!!del && typeof del.o.run === 'function', 'its Delete is an armingButton', 'armed: ' + armed.length);
  if (del) { await del.o.run(); await settle(); }
  ok(asked.filter(function (a) { return a.op === 'delete' && a.id === 7; }).length === 1, 'its second press asks auth.bundle { op: delete, id }', 'asked: ' + short(asked));
  ok(closed === 0, 'and it waits to hear it: the answer closes nothing', 'closed ' + closed);
  bundleWatches.forEach(function (fn) { fn('8', undefined); });
  ok(closed === 0, 'another bundle gone changes nothing', 'closed ' + closed);
  bundleWatches.forEach(function (fn) { fn('8', { id: 8, label: 'x' }); fn('7', { id: 7, label: 'Reader' }); });
  ok(closed === 0, 'its own row changed is not its deletion', 'closed ' + closed);
  bundleWatches.forEach(function (fn) { fn('7', undefined); });
  ok(closed === 1, 'its deletion heard, it says gone, for the tab to close', 'closed ' + closed);

  test.subHeading('goal/G41.32: a bundle not the node\'s is shown only');
  const ro = node('box');
  const formsBefore = forms.length;
  E.branchEditor.create(ro, { bundle: 8, label: 'Theirs', owner: 'agent' });
  await settle();
  const rs = branchSels[branchSels.length - 1];
  ok(forms.length === formsBefore && !!rs && rs.container === ro && JSON.stringify(rs.o.columns) === '["family","verb"]', 'no form, and its branches with no Delete', 'forms ' + (forms.length - formsBefore) + ', columns ' + short(rs && rs.o.columns));

  test.subHeading('the shell\'s element shape: create(container, options) (goal/G41.19)');
  // Box v23: "every element gets a container and appends itself".
  const host = node('host');
  const made = E.branchEditor.create(host, { bundle: 9 });
  await settle();
  const last = branchSels[branchSels.length - 1];
  ok(!!last && last.o.bundle === 9 && all(host).indexOf(last) !== -1 && all(host).indexOf(families[families.length - 1]) !== -1,
    'create(container, { bundle }) draws the editor into that container', 'branch selectors ' + branchSels.length + ', in host ' + !!(last && all(host).indexOf(last) !== -1));
  ok(!!made && typeof made.destroy === 'function', 'and answers a handle with destroy', 'made: ' + short(made && Object.keys(made)));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
