'use strict';

// spirit/run/shell/js/test/branchEditor.js
// The tests of shell/js/branchEditor.js, and of no other module (spec: ./branchEditor.md; goal/G41.14). The browser file
// runs in node on a BARE window (rule/26): nothing is on the page until the editor requires it, but the shell's own
// navigation, a recorder of the pages pushed. The family and branch selectors are stand-ins that keep what they
// were handed; each is tested in its own file. The node's auth family is the spirit object's, each call recorded.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
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
  if (!fs.existsSync(FILE)) { test.fail('shell/js/branchEditor.js is not there'); return; }
  const asked = [];
  const required = [];
  const pages = [];
  const families = [];
  const branchSels = [];
  let answer = function (a) { return Promise.resolve({ id: 11 }); };
  const auth = { branch: function (a) { asked.push(a); return answer(a); } };
  const STANDS = {
    // The shell's element shape (goal/G41.19): create(container, options) appends the control and answers it.
    'shell/js/apiFamilySelector.js': function (E) { E.apiFamilySelector = { create: function (c, o) { const f = node('family'); f.o = o || {}; f.container = c; f.family = ''; f.verb = ''; f.value = ''; families.push(f); c.appendChild(f); return f; } }; },
    'shell/js/branchSelector.js': function (E) { E.branchSelector = { create: function (c, o) { const b = node('branches'); b.o = o || {}; b.container = c; b.refreshed = 0; b.refresh = function () { b.refreshed += 1; }; branchSels.push(b); c.appendChild(b); return b; } }; },
  };
  global.Event = function (type, o) { this.type = type; this.bubbles = !!(o && o.bubbles); };
  global.document = { createElement: function (t) { return node(t); }, createTextNode: function (t) { const n = node('#text'); n.textContent = String(t); return n; } };
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); }, ready: Promise.resolve({ auth: auth }), auth: auth,
    elements: { navigation: { push: function (page) { const p = { page: page, box: node('box'), nav: { close: function () {}, setTitle: function () {} } }; pages.push(p); return p.nav; } } } } };
  global.spirit = global.window.spirit;
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](global.window.spirit.elements); } return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  const E = global.window.spirit.elements;

  test.subHeading('it loads what it uses itself (rule/26)');
  ok(['shell/js/apiFamilySelector.js', 'shell/js/branchSelector.js'].every(function (p) { return required.indexOf(p) !== -1; }),
    'it requires the family selector and the branch selector through spirit.require', 'required: ' + short(required));
  ok(E.branchEditor && typeof E.branchEditor.open === 'function' && typeof E.branchEditor.create === 'function', 'it registers spirit.elements.branchEditor.open and .create', 'elements: ' + short(Object.keys(E)));
  if (!E.branchEditor || typeof E.branchEditor.open !== 'function') return;

  test.subHeading('a page of its own, always on one bundle');
  // Andy, box: "the branchEditor page is always configured with a bundle key", "first row: Title: \"Edit
  // <bundle-label-content>\"", and of the way back: "the shell provides a back-button from there".
  await E.branchEditor.open({ bundle: 7, label: 'Reader' });
  await settle();
  const p = pages[0];
  ok(!!p && p.page.title === 'Edit Reader' && typeof p.page.mount === 'function', 'open({ bundle, label }) pushes a page on the shell\'s navigation, titled Edit <label>', 'pages: ' + short(pages.map(function (x) { return x.page.title; })));
  if (!p) return;
  p.page.mount(p.box, p.nav);
  await settle();
  const box = p.box;
  const bs = branchSels[0];
  ok(!!bs && bs.container === box && bs.o.bundle === 7 && bs.o.face === 'pane' && JSON.stringify(bs.o.columns) === '["family","verb","delete"]' && all(box).indexOf(bs) !== -1,
    'its list is branchSelector.create(the page, a pane on that bundle, columns family, verb, delete)', 'branch selector: ' + short(bs && bs.o) + ', in the page ' + !!(bs && bs.container === box));

  test.subHeading('the add form: new [family, its verb] [Add]');
  // Andy: "apiFamiliySelector.js will use apiVerbSelector as part of itself": the box's two dropdowns are its two halves.
  const fam = families[0];
  const add = all(box).filter(function (k) { return k.tag === 'button' && /^\s*Add\s*$/.test(k.textContent || ''); })[0];
  ok(!!fam && !!add && families.length === 1 && all(box).indexOf(fam) !== -1 && fam.container.kids.indexOf(add) !== -1,
    'it draws one family selector, apiFamilySelector.create(the add row), and an Add button beside it', 'family ' + families.length + ', Add ' + !!add + ', same row ' + !!(fam && add && fam.container.kids.indexOf(add) !== -1));
  if (!fam || !add) return;
  ok(/\bnew\b/.test(text(box)), 'the row reads new', 'text: ' + short(text(box)));
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

  test.subHeading('the shell\'s element shape: create(container, options) (goal/G41.19)');
  // Box v23: "every element gets a container and appends itself".
  const host = node('host');
  const made = E.branchEditor.create(host, { bundle: 9 });
  await settle();
  ok(branchSels.length === 2 && branchSels[1].o.bundle === 9 && all(host).indexOf(branchSels[1]) !== -1 && all(host).indexOf(families[1]) !== -1,
    'create(container, { bundle }) draws the editor into that container', 'branch selectors ' + branchSels.length + ', in host ' + !!(branchSels[1] && all(host).indexOf(branchSels[1]) !== -1));
  ok(!!made && typeof made.destroy === 'function', 'and answers a handle with destroy', 'made: ' + short(made && Object.keys(made)));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
