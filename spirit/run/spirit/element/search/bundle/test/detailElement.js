'use strict';

// spirit/run/spirit/element/search/bundle/test/detailElement.js
// The tests of spirit/element/search/bundle/detailElement.js, the branch editor (spirit/element/branchEditor.js until
// goal/G43.32), and of no other module (spec: ./detailElement.md; goal/G41.14). The browser file
// runs in node on a BARE window (rule/26): nothing is on the page until the editor requires it, but the shell's own
// navigation, a recorder of the pages pushed. The family and branch selectors are stand-ins that keep what they
// were handed; each is tested in its own file. The node's auth family is the spirit object's, each call recorded.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'detailElement.js');

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

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let asked, required, pages, families, branchSels, forms, armed, bundleWatches, E, box, bs, fam, add, rf, dr, del;
let closed = 0;
let answer = function (a) { return Promise.resolve({ id: 11 }); };
const D = function () { return (E && E.search && E.search.bundle && E.search.bundle.detailElement) || null; };
const NO_E = 'the editor never ran: the world failed';
const NO_D = 'no bundle detail element registered';
const NO_BS = 'the editor drew no branch list';
const NO_ADD = 'no add form with a family selector and an Add';
const NO_DR = 'no Delete row';
const hasD = function () { return !!(D() && typeof D().create === 'function'); };

test.run('the world: the editor runs on a bare window, its parts stand-ins', 0.2, async function () {
  if (!fs.existsSync(FILE)) return 'spirit/element/search/bundle/detailElement.js is not there';
  asked = [];
  required = [];
  pages = [];
  families = [];
  branchSels = [];
  forms = [];
  const auth = { branch: function (a) { asked.push(a); return answer(a); }, bundle: function (a) { asked.push(a); return Promise.resolve({ id: a.id }); } };
  armed = [];
  bundleWatches = [];
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
    element: { navigation: { push: function (page) { const p = { page: page, box: node('box'), nav: { close: function () {}, setTitle: function () {} } }; pages.push(p); return p.nav; } } } } };
  global.spirit = global.window.spirit;
  // goal/G43.32: spirit.element is a plain place, no getter: the branch editor, now strict, sets spirit.element itself.
  // goal/G43.32: the element places itself by installSpiritElement, as it runs (spirit/test/headLessChrome.js pageSpirit).
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(global.window.spirit);
  ((global.window.spirit.data = global.window.spirit.data || {}).auth = {}).data = { bundles: { watch: function (fn) { bundleWatches.push(fn); return function () {}; } }, branches: { watch: function () { return function () {}; } } };
  global.window.spirit.cacheManager = function () { return Promise.resolve(); };
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](((global.window.spirit.element.spirit = global.window.spirit.element.spirit || {}).element = global.window.spirit.element.spirit.element || {})); } return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  E = ((global.window.spirit.element || {}).spirit || {}).element || {};
  return true;
}, 1000);

// it loads what it uses itself (rule/26)
test.run('it requires the family selector and the branch selector through spirit.require', 0.2, function () {
  if (!required) return NO_E;
  return ['spirit/element/search/api.js', 'spirit/element/search/branch.js'].every(function (p) { return required.indexOf(p) !== -1; }) ? true : 'required: ' + short(required);
}, 1000);
test.run('it registers spirit.element.spirit.element.search.bundle.detailElement.create, and no page of its own (goal/G41.32)', 0.2, function () {
  if (!E) return NO_E;
  return hasD() && D().open === undefined ? true : 'elements: ' + short(Object.keys(D() || {}));
}, 1000);

// always on one bundle
// Andy, box: "the branchEditor page is always configured with a bundle key".
test.run('its list is branchSelector.create(the page, a pane on that bundle, columns family, verb, delete)', 0.2, async function () {
  if (!hasD()) return NO_D;
  box = node('box');
  D().create(box, { bundle: 7, label: 'Reader', gone: function () { closed += 1; } });
  await settle();
  bs = branchSels[0];
  return !!bs && bs.container === box && bs.o.bundle === 7 && bs.o.face === 'pane' && JSON.stringify(bs.o.columns) === '["family","verb","delete"]' && all(box).indexOf(bs) !== -1 ? true : 'branch selector: ' + short(bs && bs.o) + ', in the page ' + !!(bs && bs.container === box);
}, 1000);

// the add form, a rowForm: ➕ [family, its verb] [Add] (goal/G41.27)
// Andy, on G41.27: "branchEditor:\n\n[➕] [choose a family… ▾] [Add]", then "careful, there's a hidden verb selector
// there that only displays when a family is selected... !\n[➕] [choose a family… ▾] [All Verbs ▾] [Add]". And
// "apiFamiliySelector.js will use apiVerbSelector as part of itself": the two dropdowns are its two halves, the verb's
// hiding until a family is chosen the family selector's own (its test).
test.run('it loads the rowForm itself (rule/26)', 0.2, function () {
  if (!box) return NO_BS;
  fam = families[0];
  add = all(box).filter(function (k) { return k.tag === 'button' && /^\s*Add\s*$/.test(k.textContent || ''); })[0];
  return required.indexOf('spirit/element/rowForm.js') !== -1 ? true : 'required: ' + short(required);
}, 1000);
test.run('its add form is one rowForm in the page, its icon ➕ and its button Add', 0.2, function () {
  if (!box) return NO_BS;
  rf = forms[0];
  return forms.filter(function (f) { return f.opts.icon === '➕'; }).length === 1 && rf.opts.icon === '➕' && rf.opts.button === 'Add' && all(box).indexOf(rf.root) !== -1 ? true : 'rowForms: ' + short(forms.map(function (f) { return f.opts; }));
}, 1000);
test.run('its span holds the one family selector, choose a family…, its verb half with it, and nothing else', 0.2, function () {
  if (!box) return NO_BS;
  const inSpan = !!rf && !!fam && rf.span.kids.length === 1 && (rf.span.kids[0] === fam || (rf.span.kids[0].kids || []).indexOf(fam) !== -1 && rf.span.kids[0].kids.length === 1);
  return families.length === 1 && inSpan && fam.o.all === 'choose a family…' ? true : 'family ' + families.length + ', in the span ' + inSpan + ', all ' + short(fam && fam.o.all);
}, 1000);
test.run('its Add is the rowForm\'s button, the only Add', 0.2, function () {
  if (!box) return NO_BS;
  return !!rf && !!add && add === rf.button && all(box).filter(function (k) { return k.tag === 'button' && /^\s*Add\s*$/.test(k.textContent || ''); }).length === 1 ? true : 'Add is the form\'s ' + !!(rf && add === rf.button);
}, 1000);
test.run('the word "new" at its start is gone, ➕ in its place', 0.2, function () {
  if (!fam || !add) return NO_ADD;
  return !/\bnew\b/.test(text(box)) ? true : 'text: ' + short(text(box));
}, 1000);
test.run('Add with no family asks nothing', 0.2, async function () {
  if (!fam || !add) return NO_ADD;
  add.dispatchEvent({ type: 'click' });
  await settle();
  return asked.length === 0 ? true : 'asked: ' + short(asked);
}, 1000);
let r0;
test.run('Add with the verb left at All Verbs asks auth.branch { op: add, bundle, family, verb: \'\' }', 0.2, async function () {
  if (!fam || !add) return NO_ADD;
  fam.family = 'desk'; fam.value = 'desk'; fam.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
  r0 = bs.refreshed;
  add.dispatchEvent({ type: 'click' });
  await settle();
  return asked.length === 1 && asked[0].op === 'add' && asked[0].bundle === 7 && asked[0].family === 'desk' && asked[0].verb === '' ? true : 'asked: ' + short(asked);
}, 1000);
test.run('an answered add makes the list search again', 0.2, function () {
  if (!fam || !add) return NO_ADD;
  return bs.refreshed > r0 ? true : 'refreshed: ' + (bs.refreshed - r0);
}, 1000);
test.run('a verb chosen is sent as it is', 0.2, async function () {
  if (!fam || !add) return NO_ADD;
  fam.verb = 'chat.add'; fam.value = 'desk.chat.add';
  answer = function () { return Promise.reject(Object.assign(new Error('already in this bundle'), { refusal: 'already-in-bundle' })); };
  add.dispatchEvent({ type: 'click' });
  await settle();
  return asked.length === 2 && asked[1].verb === 'chat.add' ? true : 'asked: ' + short(asked);
}, 1000);
test.run('a refused add is said in the page, in the node\'s words', 0.2, function () {
  if (!fam || !add) return NO_ADD;
  return /already-in-bundle|already in this bundle/.test(text(box)) ? true : 'text: ' + short(text(box));
}, 1000);

// goal/G41.32: its Delete row at the bottom, and hearing its deletion
// Andy: "i need the branchEditor to have a rowForm at the bottom: [❌] \"Delete <bundle-name> bundle and branches \" [Delete (armingButton)]."
test.run('a second rowForm below the list: ❌, the words, Delete', 0.2, function () {
  if (!box) return NO_BS;
  dr = forms[1];
  return !!dr && dr.opts.icon === '❌' && dr.opts.button === 'Delete' && dr.span.textContent === 'Delete Reader bundle and branches' && box.kids.indexOf(dr.root) > box.kids.indexOf(bs) ? true : 'form: ' + short(dr && dr.opts) + ', says ' + short(dr && dr.span.textContent);
}, 1000);
test.run('its Delete is an armingButton', 0.2, function () {
  if (!box) return NO_BS;
  del = armed.filter(function (a) { return dr && a.button === dr.button; })[0];
  return !!del && typeof del.o.run === 'function' ? true : 'armed: ' + armed.length;
}, 1000);
test.run('its second press asks auth.bundle { op: delete, id }', 0.2, async function () {
  if (!box) return NO_BS;
  if (del) { await del.o.run(); await settle(); }
  return asked.filter(function (a) { return a.op === 'delete' && a.id === 7; }).length === 1 ? true : 'asked: ' + short(asked);
}, 1000);
test.run('and it waits to hear it: the answer closes nothing', 0.2, function () {
  if (!box) return NO_BS;
  return closed === 0 ? true : 'closed ' + closed;
}, 1000);
test.run('another bundle gone changes nothing', 0.2, function () {
  if (!box) return NO_BS;
  bundleWatches.forEach(function (fn) { fn('8', undefined); });
  return closed === 0 ? true : 'closed ' + closed;
}, 1000);
test.run('its own row changed is not its deletion', 0.2, function () {
  if (!box) return NO_BS;
  bundleWatches.forEach(function (fn) { fn('8', { id: 8, label: 'x' }); fn('7', { id: 7, label: 'Reader' }); });
  return closed === 0 ? true : 'closed ' + closed;
}, 1000);
test.run('its deletion heard, it says gone, for the tab to close', 0.2, function () {
  if (!box) return NO_BS;
  bundleWatches.forEach(function (fn) { fn('7', undefined); });
  return closed === 1 ? true : 'closed ' + closed;
}, 1000);

// goal/G41.32: a bundle not the node's is shown only
test.run('no form, and its branches with no Delete', 0.2, async function () {
  if (!hasD()) return NO_D;
  const ro = node('box');
  const formsBefore = forms.length;
  D().create(ro, { bundle: 8, label: 'Theirs', owner: 'agent' });
  await settle();
  const rs = branchSels[branchSels.length - 1];
  return forms.length === formsBefore && !!rs && rs.container === ro && JSON.stringify(rs.o.columns) === '["family","verb"]' ? true : 'forms ' + (forms.length - formsBefore) + ', columns ' + short(rs && rs.o.columns);
}, 1000);

// the shell's element shape: create(container, options) (goal/G41.19)
// Box v23: "every element gets a container and appends itself".
let made;
test.run('create(container, { bundle }) draws the editor into that container', 0.2, async function () {
  if (!hasD()) return NO_D;
  const host = node('host');
  made = D().create(host, { bundle: 9 });
  await settle();
  const last = branchSels[branchSels.length - 1];
  return !!last && last.o.bundle === 9 && all(host).indexOf(last) !== -1 && all(host).indexOf(families[families.length - 1]) !== -1 ? true : 'branch selectors ' + branchSels.length + ', in host ' + !!(last && all(host).indexOf(last) !== -1);
}, 1000);
test.run('and answers a handle with destroy', 0.2, function () {
  return !!made && typeof made.destroy === 'function' ? true : 'made: ' + short(made && Object.keys(made));
}, 1000);
