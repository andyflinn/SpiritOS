'use strict';

// spirit/run/shell/js/bundleSelector/test/rowElement.js
// The tests of shell/js/bundleSelector/rowElement.js, and of no other module (spec: ./rowElement.md; goal/G41.14). The
// browser file runs in node on a BARE window (rule/26): nothing is on the page until the row requires it. What it
// requires is put there then: the shared row element and the field input real, the arming button and the branch editor
// stand-ins that record what they were handed. The node's auth family is the spirit object's, each call recorded.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const JS = path.join(RUN, 'shell', 'js');
const FILE = path.join(JS, 'bundleSelector', 'rowElement.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

function node(tag) {
  const heard = {};
  const n = { tag: tag, kids: [], style: {}, className: '', innerHTML: '', value: '', attrs: {},
    appendChild: function (c) { n.kids.push(c); return c; },
    setAttribute: function (k, v) { n.attrs[k] = String(v); }, getAttribute: function (k) { return k in n.attrs ? n.attrs[k] : null; },
    addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
    removeEventListener: function () {},
    dispatchEvent: function (e) { (heard[e.type] || []).slice().forEach(function (fn) { fn(e); }); return true; },
    heard: heard,
    querySelector: function (sel) {
      const all = []; (function walk(x) { x.kids.forEach(function (k) { all.push(k); walk(k); }); }(n));
      const m = /^\[data-action="([^"]+)"\]$/.exec(sel);
      if (m) return all.filter(function (k) { return k.attrs['data-action'] === m[1]; })[0] || null;
      if (sel === 'input') return all.filter(function (k) { return k.tag === 'input'; })[0] || null;
      return null;
    },
  };
  return n;
}
// A cell as the list hands one to mount: its html set by the paint, its controls made from it as a page parses it.
function cell() {
  const c = node('td');
  let html = '';
  Object.defineProperty(c, 'innerHTML', { get: function () { return html; }, set: function (v) {
    html = String(v); c.kids.length = 0;
    const b = /<button[^>]*data-action="([^"]+)"[^>]*>([^<]*)</.exec(html);
    if (b) { const k = node('button'); k.attrs['data-action'] = b[1]; k.textContent = b[2]; c.kids.push(k); }
  } });
  return c;
}

test.startTest('bundleSelector/rowElement.js: one bundle, as a row');
// An element that counts on what it did not load throws inside a promise: that is a failure said, not a silent exit.
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('shell/js/bundleSelector/rowElement.js is not there'); return; }
  const asked = [];
  const required = [];
  const armed = [];
  const opened = [];
  let answer = function () { return Promise.resolve({ id: 7 }); };
  const auth = { bundle: function (a) { asked.push(a); return answer(a); } };
  const load = function (p) { vm.runInThisContext(fs.readFileSync(path.join(RUN, p), 'utf8'), { filename: p }); };
  const STANDS = {
    'shell/js/rowElement.js': function () { load('shell/js/rowElement.js'); },
    'shell/js/fieldInput.js': function () { load('shell/js/fieldInput.js'); },
    'shell/js/armingButton.js': function (E) { E.armingButton = { attach: function (b, o) { armed.push({ button: b, o: o }); return b; } }; },
    'shell/js/branchEditor.js': function (E) { E.branchEditor = { open: function (o) { opened.push(o); return {}; } }; },
  };
  global.Event = function (type, o) { this.type = type; this.bubbles = !!(o && o.bubbles); };
  global.document = { createElement: function (t) { return node(t); }, addEventListener: function () {}, removeEventListener: function () {} };
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); },
    fieldRules: require(path.join(RUN, 'spirit', 'fieldRules.js')), ready: Promise.resolve({ auth: auth }), auth: auth, elements: {} } };
  global.spirit = global.window.spirit;
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](global.window.spirit.elements); } return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  const E = global.window.spirit.elements;

  test.subHeading('it loads what it uses itself (rule/26)');
  ok(['shell/js/rowElement.js', 'shell/js/fieldInput.js', 'shell/js/armingButton.js'].every(function (p) { return required.indexOf(p) !== -1; }),
    'it requires the shared row element, the field input and the arming button through spirit.require', 'required: ' + short(required));
  ok(E.bundleElement && typeof E.bundleElement.create === 'function', 'it registers spirit.elements.bundleElement.create', 'elements: ' + short(Object.keys(E)));
  if (!E.bundleElement || typeof E.bundleElement.create !== 'function') return;

  test.subHeading('a bundle row: its label, Edit and Delete');
  const el = E.bundleElement.create({ id: 7, label: 'Read <files>' });
  ok(el.kind === 'bundle' && el.key === '7' && el.row.label === 'Read <files>', 'it is a row element of kind bundle, keyed by the bundle\'s id', 'el: ' + short({ kind: el.kind, key: el.key, row: el.row }));
  const cells = {}; (el.cells() || []).forEach(function (c) { cells[c.name] = c.html; });
  ok(JSON.stringify(Object.keys(cells)) === '["label","edit","delete"]', 'its fields are label, edit and delete, in that order', 'fields: ' + short(Object.keys(cells)));
  ok(/Read &lt;files>/.test(cells.label || '') && !/<files>/.test(cells.label || ''), 'the label is drawn escaped', 'label: ' + short(cells.label));
  ok(/data-action="edit"/.test(cells.edit || '') && /data-action="delete"/.test(cells.delete || ''), 'edit and delete are buttons naming their action', 'cells: ' + short(cells));

  test.subHeading('the label is edited in place');
  // Andy, box: "[fieldInput:fieldRule:Label], displays and updates the bundle's label. Empty or invalid is refused. when
  // pressing the Enter key, or leaving the field, the bundle-label is updated is the label is valid (as in \"add\"), and
  // if invalid, reverts to the value contained in the db-table."
  const ed = E.bundleElement.create({ id: 7, label: 'Reader' }, { editable: true });
  const hosts = { label: cell(), edit: cell(), delete: cell() };
  ed.mount(hosts);
  const input = hosts.label.querySelector('input');
  ok(!!input && input.value === 'Reader', 'editable, its label cell holds an input showing the label', 'label cell: ' + short(hosts.label.kids.map(function (k) { return k.tag; })));
  if (!input) return;
  ok(!!input.heard.beforeinput, 'the input is a fieldInput, held to the label\'s rule', 'listeners: ' + short(Object.keys(input.heard)));
  input.value = 'Lister';
  input.dispatchEvent({ type: 'keydown', key: 'Enter', preventDefault: function () {} });
  await settle();
  ok(asked.length === 1 && asked[0].op === 'set' && asked[0].id === 7 && asked[0].label === 'Lister', 'Enter with a valid label asks auth.bundle { op: set, id, label }', 'asked: ' + short(asked));
  input.value = 'Mover';
  input.dispatchEvent({ type: 'blur' });
  await settle();
  ok(asked.length === 2 && asked[1].label === 'Mover', 'and so does leaving the field', 'asked: ' + short(asked));
  // Nothing streams a bundle back (the two selectors never share a page), so an answered set is the row's new label.
  ok(ed.row.label === 'Mover', 'an answered set is the row\'s label from then on', 'row: ' + short(ed.row));
  input.value = '   ';
  input.dispatchEvent({ type: 'blur' });
  await settle();
  ok(asked.length === 2 && input.value === 'Mover', 'an empty label is refused: nothing asked, and the input shows the label the table holds', 'asked ' + asked.length + ', input ' + short(input.value));
  input.value = 'x'.repeat(70);
  input.dispatchEvent({ type: 'keydown', key: 'Enter', preventDefault: function () {} });
  await settle();
  ok(asked.length === 2 && input.value === 'Mover', 'so is one the label\'s rule refuses', 'asked ' + asked.length + ', input ' + short(input.value));
  answer = function () { return Promise.reject(Object.assign(new Error('refused'), { refusal: 'bad-request' })); };
  input.value = 'Taken';
  input.dispatchEvent({ type: 'blur' });
  await settle();
  ok(asked.length === 3 && input.value === 'Mover', 'and one the node refuses reverts to the table\'s label as well', 'input ' + short(input.value));
  answer = function () { return Promise.resolve({ id: 7 }); };

  test.subHeading('Delete asks are-you-sure; Edit opens the branch editor');
  const del = armed.filter(function (a) { return a.button && a.button.attrs['data-action'] === 'delete'; })[0];
  ok(!!del && typeof del.o.run === 'function', 'mounted, its Delete is an armingButton', 'armed: ' + short(armed.map(function (a) { return a.button && a.button.attrs; })));
  if (del) { await del.o.run(); await settle(); }
  ok(asked.length === 4 && asked[3].op === 'delete' && asked[3].id === 7, 'its second press asks auth.bundle { op: delete, id }', 'asked: ' + short(asked));
  await ed.act('edit', {});
  await settle();
  ok(required.indexOf('shell/js/branchEditor.js') !== -1 && opened.length === 1 && opened[0].bundle === 7 && opened[0].label === 'Mover',
    'Edit requires the branch editor, then opens it on this bundle: { bundle: id, label }', 'opened: ' + short(opened) + ', required ' + short(required));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
