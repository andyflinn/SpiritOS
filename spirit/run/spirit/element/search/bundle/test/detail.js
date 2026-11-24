'use strict';

// spirit/run/spirit/element/search/bundle/test/detail.js
// The tests of spirit/element/search/bundle/detail.js, the branch editor (spirit/element/branchEditor.js until
// goal/G43.32), and of no other module (spec: ./detail.md; goal/G41.14). The browser file
// runs in node on a BARE window (rule/26): nothing is on the page until the editor requires it, but the shell's own
// navigation, a recorder of the pages pushed. The family and branch selectors are stand-ins that keep what they
// were handed; each is tested in its own file. The node's auth family is the spirit object's, each call recorded.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../../..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'spirit.js')).requireScript('spirit/test/headLessChrome.js');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const FILE = path.join(__dirname, '..', 'detail.js');

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
const D = function () { return (E && E.search && E.search.bundle && E.search.bundle.detail) || null; };
const hasD = function () { return !!(D() && typeof D().create === 'function'); };

test.run('the editor runs on a bare window, with stand-ins for its parts', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  asked = [];
  required = [];
  pages = [];
  families = [];
  branchSels = [];
  forms = [];
  const auth = { branch: function (a) { asked.push(a); return answer(a); }, bundle: function (a) { asked.push(a); return Promise.resolve({ id: a.id }); } };
  armed = [];
  bundleWatches = [];
  // ITS STAND-INS ARE requireScript's ANSWERS (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers ...
  // never by writing them into spirit.required"; Andy: "spirit.requireScript must allways return either an object or a
  // function... or fail/throw"): each path answers what stands for it, made once; any other path is refused.
  const STANDS = {
    // The one-row form (goal/G41.27), tested in its own folder: a stand-in answering { root, span, button } as the real
    // one does, its root appended to the container it is given, its button saying the words it was handed.
    'spirit/element/rowForm.js': function () { return { create: function (c, o) {
      const f = { container: c, opts: o || {}, root: node('div'), span: node('span'), button: node('button') };
      f.button.textContent = String((o && o.button) || ''); f.root.appendChild(f.span); f.root.appendChild(f.button); c.appendChild(f.root); forms.push(f);
      // A press calls press, the mounter's request, and keeps what it answered, as the real one's busyButton waits on it.
      f.button.addEventListener('click', function () { if (typeof f.opts.press === 'function') f.pressed = f.opts.press(); });
      return f;
    } }; },
    'spirit/element/armingButton.js': function () { return { attach: function (b, o) { armed.push({ button: b, o: o }); return b; } }; },
    // The shell's element shape (goal/G41.19): create(container, options) appends the control and answers it.
    'spirit/element/search/api.js': function () { return { create: function (c, o) { const f = node('family'); f.o = o || {}; f.container = c; f.family = ''; f.verb = ''; f.value = ''; families.push(f); c.appendChild(f); return f; } }; },
    'spirit/auth/api.js': function () { return auth; },
    'spirit/element/search/branch.js': function () { return { create: function (c, o) { const b = node('branches'); b.o = o || {}; b.container = c; b.refreshed = 0; b.refresh = function () { b.refreshed += 1; }; branchSels.push(b); c.appendChild(b); return b; } }; },
  };
  global.Event = function (type, o) { this.type = type; this.bubbles = !!(o && o.bubbles); };
  global.document = { createElement: function (t) { return node(t); }, createTextNode: function (t) { const n = node('#text'); n.textContent = String(t); return n; } };
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); }, readyPromise: Promise.resolve({}),
    element: { navigation: { push: function (page) { const p = { page: page, box: node('box'), nav: { close: function () {}, setTitle: function () {} } }; pages.push(p); return p.nav; } } } } };
  global.spirit = global.window.spirit;
  // goal/G43.32: spirit.required is a plain place, no getter: the branch editor, now strict, sets spirit.required itself.
  // goal/G43.32: the element places itself by installSpiritElement, as it runs (spirit/test/headLessChrome.js pageSpirit).
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(global.window.spirit);
  ((global.window.spirit.required.spirit.data = global.window.spirit.required.spirit.data || {}).auth = {}).data = { bundles: { watch: function (fn) { bundleWatches.push(fn); return function () {}; } }, branches: { watch: function () { return function () {}; } } };
  // The auth branch is answered by its api.js path (goal/G49.6: never by a name).
  const made = {};
  // As the loader places what it loaded, at the path's place: the detail still reads its parts there (cw's half of the sweep).
  const placeAsLoader = function (p, v) {
    if (p.indexOf('spirit/element/') !== 0) return;
    const keys = p.replace(/\.js$/, '').split('/');
    let o = global.window.spirit.required;
    keys.slice(0, -1).forEach(function (k) { o = o[k] = o[k] || {}; });
    o[keys[keys.length - 1]] = Object.assign(v, o[keys[keys.length - 1]] || {});
  };
  global.window.spirit.requireScript = function (p) {
    required.push(String(p));
    if (!Object.prototype.hasOwnProperty.call(STANDS, p)) return Promise.reject(new Error('no stand-in for ' + p));
    if (!Object.prototype.hasOwnProperty.call(made, p)) { made[p] = STANDS[p](); placeAsLoader(p, made[p]); }
    return Promise.resolve(made[p]);
  };
  PAGE_LOAD.runAsPage(FILE);
  await settle();
  E = ((global.window.spirit.required || {}).spirit || {}).element || {};
  return true;
}, test.limit.quick);

// it loads what it uses itself (rule/26)
test.run('it requires the branch selector and the branch selector through spirit.requireScript', 0.2, function () {
  if (!required) return false;
  return ['spirit/element/search/api.js', 'spirit/element/search/branch.js'].every(function (p) { return required.indexOf(p) !== -1; }) ? true : false;
}, test.limit.quick);
test.run('it registers spirit.required.spirit.element.search.bundle.detail.create, and no page of its own', 0.2, function () {
  if (!E) return false;
  return hasD() && D().open === undefined ? true : false;
}, test.limit.quick);

// always on one bundle
// Andy, box: "the branchEditor page is always configured with a bundle key".
test.run('its list is a branch selector made in the page as a pane on that bundle, with the columns branch, verb and delete', 0.2, async function () {
  if (!hasD()) return false;
  box = node('box');
  D().create(box, { bundle: 7, label: 'Reader', gone: function () { closed += 1; } });
  await settle();
  bs = branchSels[0];
  return !!bs && bs.container === box && bs.o.bundle === 7 && bs.o.face === 'pane' && JSON.stringify(bs.o.columns) === '["family","verb","delete"]' && all(box).indexOf(bs) !== -1 ? true : false;
}, test.limit.quick);

// the add form, a rowForm: ➕ [family, its verb] [Add] (goal/G41.27)
// Andy, on G41.27: "branchEditor:\n\n[➕] [choose a family… ▾] [Add]", then "careful, there's a hidden verb selector
// there that only displays when a family is selected... !\n[➕] [choose a family… ▾] [All Verbs ▾] [Add]". And
// "apiFamiliySelector.js will use apiVerbSelector as part of itself": the two dropdowns are its two halves, the verb's
// hiding until a family is chosen the family selector's own (its test).
test.run('it loads the rowForm itself', 0.2, function () {
  if (!box) return false;
  fam = families[0];
  add = all(box).filter(function (k) { return k.tag === 'button' && /^\s*Add\s*$/.test(k.textContent || ''); })[0];
  return required.indexOf('spirit/element/rowForm.js') !== -1 ? true : false;
}, test.limit.quick);
test.run('its add form is one rowForm in the page, its icon ➕ and its button Add', 0.2, function () {
  if (!box) return false;
  rf = forms[0];
  return forms.filter(function (f) { return f.opts.icon === '➕'; }).length === 1 && rf.opts.icon === '➕' && rf.opts.button === 'Add' && all(box).indexOf(rf.root) !== -1 ? true : false;
}, test.limit.quick);
test.run('its span holds only the one branch selector, which says choose a branch… and carries its verb half', 0.2, function () {
  if (!box) return false;
  const inSpan = !!rf && !!fam && rf.span.kids.length === 1 && (rf.span.kids[0] === fam || (rf.span.kids[0].kids || []).indexOf(fam) !== -1 && rf.span.kids[0].kids.length === 1);
  return families.length === 1 && inSpan && fam.o.all === 'choose a family…' ? true : false;
}, test.limit.quick);
test.run('its Add is the rowForm\'s button, and it is the only Add', 0.2, function () {
  if (!box) return false;
  return !!rf && !!add && add === rf.button && all(box).filter(function (k) { return k.tag === 'button' && /^\s*Add\s*$/.test(k.textContent || ''); }).length === 1 ? true : false;
}, test.limit.quick);
test.run('the word "new" at its start is gone, and ➕ stands in its place', 0.2, function () {
  if (!fam || !add) return false;
  return !/\bnew\b/.test(text(box)) ? true : false;
}, test.limit.quick);
test.run('Add with no BRANCH asks nothing', 0.2, async function () {
  if (!fam || !add) return false;
  add.dispatchEvent({ type: 'click' });
  await settle();
  return asked.length === 0 ? true : false;
}, test.limit.quick);
let r0;
test.run('Add with the verb left at All Verbs asks auth.branch to add the branch to the bundle with an empty verb', 0.2, async function () {
  if (!fam || !add) return false;
  fam.family = 'desk'; fam.value = 'desk'; fam.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
  r0 = bs.refreshed;
  add.dispatchEvent({ type: 'click' });
  await settle();
  return asked.length === 1 && asked[0].op === 'add' && asked[0].bundle === 7 && asked[0].family === 'desk' && asked[0].verb === '' ? true : false;
}, test.limit.quick);
test.run('an answered add makes the list search again', 0.2, function () {
  if (!fam || !add) return false;
  return bs.refreshed > r0 ? true : false;
}, test.limit.quick);
test.run('a verb chosen is sent as it is', 0.2, async function () {
  if (!fam || !add) return false;
  fam.verb = 'chat.add'; fam.value = 'desk.chat.add';
  answer = function () { return Promise.reject(Object.assign(new Error('already in this bundle'), { refusal: 'already-in-bundle' })); };
  add.dispatchEvent({ type: 'click' });
  const p = rf && rf.pressed;
  pressedSaid = null;
  if (p && typeof p.then === 'function') p.then(function () { pressedSaid = text(box); });
  await settle();
  return asked.length === 2 && asked[1].verb === 'chat.add' ? true : false;
}, test.limit.quick);
test.run('a refused add is said in the page, in the node\'s words', 0.2, function () {
  if (!fam || !add) return false;
  return /already-in-bundle|already in this bundle/.test(text(box)) ? true : false;
}, test.limit.quick);

let pressedSaid = null;
// goal/G47.1, Q20, Andy: "mark the button busy from press until the mounter's answer comes": Add is the rowForm's press, and
// what it hands the rowForm settles only once the node has answered, so the button is busy until then.
test.run('its Add is handed to the rowForm as press, and the press settles only once the node has answered', 0.2, function () {
  return (!!rf && typeof rf.opts.press === 'function' && /already-in-bundle|already in this bundle/.test(String(pressedSaid))) ? true : false;
}, test.limit.quick);

// goal/G41.32: its Delete row at the bottom, and hearing its deletion
// Andy: "i need the branchEditor to have a rowForm at the bottom: [❌] \"Delete <bundle-name> bundle and branches \" [Delete (armingButton)]."
test.run('a second rowForm below the list holds ❌, the words Delete Reader bundle and branches, and a Delete button', 0.2, function () {
  if (!box) return false;
  dr = forms[1];
  return !!dr && dr.opts.icon === '❌' && dr.opts.button === 'Delete' && dr.span.textContent === 'Delete Reader bundle and branches' && box.kids.indexOf(dr.root) > box.kids.indexOf(bs) ? true : false;
}, test.limit.quick);
test.run('its Delete is an armingButton', 0.2, function () {
  if (!box) return false;
  del = armed.filter(function (a) { return dr && a.button === dr.button; })[0];
  return !!del && typeof del.o.run === 'function' ? true : false;
}, test.limit.quick);
test.run('the second press on Delete asks auth.bundle to delete the bundle by its id', 0.2, async function () {
  if (!box) return false;
  if (del) { await del.o.run(); await settle(); }
  return asked.filter(function (a) { return a.op === 'delete' && a.id === 7; }).length === 1 ? true : false;
}, test.limit.quick);
test.run('the editor waits to hear the deletion, so the delete\'s answer closes nothing', 0.2, function () {
  if (!box) return false;
  return closed === 0 ? true : false;
}, test.limit.quick);
test.run('another bundle being deleted changes nothing', 0.2, function () {
  if (!box) return false;
  bundleWatches.forEach(function (fn) { fn('8', undefined); });
  return closed === 0 ? true : false;
}, test.limit.quick);
test.run('a change to its own bundle\'s row is not taken as its deletion', 0.2, function () {
  if (!box) return false;
  bundleWatches.forEach(function (fn) { fn('8', { id: 8, label: 'x' }); fn('7', { id: 7, label: 'Reader' }); });
  return closed === 0 ? true : false;
}, test.limit.quick);
test.run('once it hears its bundle deleted, it says gone for the tab to close', 0.2, function () {
  if (!box) return false;
  bundleWatches.forEach(function (fn) { fn('7', undefined); });
  return closed === 1 ? true : false;
}, test.limit.quick);

// goal/G41.32: a bundle not the node's is shown only
test.run('a bundle that is not the node\'s gets no form, and its branches are listed with no Delete', 0.2, async function () {
  if (!hasD()) return false;
  const ro = node('box');
  const formsBefore = forms.length;
  D().create(ro, { bundle: 8, label: 'Theirs', owner: 'agent' });
  await settle();
  const rs = branchSels[branchSels.length - 1];
  return forms.length === formsBefore && !!rs && rs.container === ro && JSON.stringify(rs.o.columns) === '["family","verb"]' ? true : false;
}, test.limit.quick);

// the shell's element shape: create(container, options) (goal/G41.19)
// Box v23: "every element gets a container and appends itself".
let made;
test.run('create, given a container and a bundle, draws the editor into that container', 0.2, async function () {
  if (!hasD()) return false;
  const host = node('host');
  made = D().create(host, { bundle: 9 });
  await settle();
  const last = branchSels[branchSels.length - 1];
  return !!last && last.o.bundle === 9 && all(host).indexOf(last) !== -1 && all(host).indexOf(families[families.length - 1]) !== -1 ? true : false;
}, test.limit.quick);
test.run('create answers a handle with a destroy', 0.2, function () {
  return !!made && typeof made.destroy === 'function' ? true : false;
}, test.limit.quick);
