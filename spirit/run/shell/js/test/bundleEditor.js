'use strict';

// spirit/run/shell/js/test/bundleEditor.js
// The tests of shell/js/bundleEditor.js, and of no other module (spec: ./bundleEditor.md; goal/G41.13). The browser file
// runs in node on a window of its own: probabilitySearch and the api-branch selector are stubs that keep what they were
// handed, and the node's auth family is the spirit object's, answering auth.bundle as spirit/apiAuth.js does.
//
// Its parts are found by the end of their ids, as the agent tables' are (process/js/agent/table/test/tableElement.js):
// -add, -label, -description, -path (the picker's box), -addpath, -save, -delete and -note; a path shown carries its
// own remove button, data-path="<path>".

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

// ── the stubs ──────────────────────────────────────────────────────────────────────────────────────────────────────
// A box: its markup makes a part per id, and one per tag with data-path; a new markup makes new parts.
function box(name) {
  let html = '';
  const b = { name: name, className: '', parts: {}, byPath: {}, isConnected: true, children: [],
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v); b.parts = {}; b.byPath = {};
      const re = /<([a-z]+)\b[^>]*>/gi; let m;
      while ((m = re.exec(html))) {
        const id = /\bid="([^"]+)"/.exec(m[0]);
        const dp = /\bdata-path="([^"]+)"/.exec(m[0]);
        const p = part(m[0]);
        if (id) b.parts[id[1]] = p;
        if (dp) b.byPath[dp[1]] = p;
      }
    },
    get textContent() { return html.replace(/<[^>]*>/g, ''); },
    querySelector: function (sel) {
      if (sel.charAt(0) === '#') return b.parts[sel.slice(1)] || null;
      const dp = /^\[data-path="([^"]+)"\]$/.exec(sel); if (dp) return b.byPath[dp[1]] || null;
      return null;
    },
    querySelectorAll: function (sel) { return /data-path/.test(sel) ? Object.keys(b.byPath).map(function (k) { return b.byPath[k]; }) : []; },
    appendChild: function (c) { b.children.push(c); return c; },
    addEventListener: function (type, fn) { (b.heard[type] = b.heard[type] || []).push(fn); },
    heard: {},
  };
  return b;
}
function part(tag) {
  const heard = {};
  const value = /\svalue="([^"]*)"/.exec(tag);
  const n = { tag: tag, value: value ? value[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : '',
    textContent: '', isConnected: true, children: [], style: {}, className: '', dataset: {},
    getAttribute: function (k) { const m = new RegExp('\\s' + k + '="([^"]*)"').exec(tag); return m ? m[1] : null; },
    addEventListener: function (type, fn) { (heard[type] = heard[type] || []).push(fn); },
    appendChild: function (c) { n.children.push(c); return c; },
    click: function () { (heard.click || []).slice().forEach(function (fn) { fn({ target: n, currentTarget: n, preventDefault: function () {} }); }); } };
  const dp = /\bdata-path="([^"]+)"/.exec(tag); if (dp) n.dataset.path = dp[1];
  return n;
}
function the(b, end) { const k = Object.keys(b.parts).filter(function (id) { return id === end || id.slice(-end.length - 1) === '-' + end; })[0]; return k ? b.parts[k] : null; }
function type(b, end, text) { const p = the(b, end); if (p) p.value = text; return !!p; }

test.startTest('bundleEditor.js: the panel that makes and keeps bundles');

(async function () {
  test.subHeading('its file');
  if (!fs.existsSync(FILE)) { test.fail('shell/js/bundleEditor.js is not there'); return; }
  const w = { asked: [], searches: [], pickers: [], required: [], answer: null };
  const B1 = { id: 'KB1', label: 'Reader', description: 'reads files', paths: ['files.read', 'files.list'] };
  const auth = { bundle: function (a) {
    w.asked.push(a);
    const r = w.answer ? w.answer(a) : a.op === 'get' ? Object.assign({}, B1) : a.op === 'add' ? { id: 'KNEW' } : { id: a.id };
    return Promise.resolve(r);
  } };
  global.document = { createElement: function (t) { return box(t); }, addEventListener: function () {}, removeEventListener: function () {} };
  global.Event = function (t, o) { this.type = t; this.bubbles = !!(o && o.bubbles); };
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }, ready: Promise.resolve({ auth: auth }), auth: auth, elements: {
    probabilitySearch: { create: function (host, o) { const s = { host: host, o: o, refreshed: 0, destroyed: false, refresh: function () { s.refreshed += 1; }, destroy: function () { s.destroyed = true; } }; w.searches.push(s); return s; } },
    createApiBranchSelector: function (o) { const r = box('branch'); r.value = ''; r.o = o; w.pickers.push(r); return r; },
  } } };
  global.spirit = global.window.spirit;
  global.window.spirit.require = function (p) { w.required.push(String(p)); return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  const E = global.window.spirit.elements;
  ok(E.bundleEditor && typeof E.bundleEditor.create === 'function', 'it registers spirit.elements.bundleEditor { create }', 'elements: ' + short(Object.keys(E)));
  if (!E.bundleEditor) return;

  test.subHeading('it lists the node\'s bundles');
  const api = { stub: true };
  const host = box('host');
  const ed = E.bundleEditor.create(host, { api: api });
  await settle();
  const list = w.searches[0];
  ok(list && list.refreshed >= 1, 'its list is a probabilitySearch, the shell\'s standard search, searched as it is made', 'searches: ' + w.searches.length);
  if (!list) return;
  ok((list.o.verb === 'auth.bundle' || (list.o.server === 'auth' && list.o.verb === 'bundle')) && JSON.stringify(list.o.args('re')) === JSON.stringify({ op: 'search', text: 're' }),
    'it searches auth.bundle { op: search, text }', 'search: ' + short({ server: list.o.server, verb: list.o.verb, args: list.o.args && list.o.args('re') }));
  ok(the(host, 'add'), 'it has an Add button', 'parts: ' + short(Object.keys(host.parts)));

  test.subHeading('Add: a new bundle, its label, description and paths');
  w.asked.length = 0;
  the(host, 'add').click(); await settle();
  ok(the(host, 'label') && the(host, 'description') && the(host, 'save') && the(host, 'path') && the(host, 'addpath'), 'Add opens an empty editor: label, description, the path picker, Save',
    'parts: ' + short(Object.keys(host.parts)));
  ok(w.asked.length === 0, 'and asks the node nothing: nothing is written before Save', 'asked: ' + short(w.asked));
  // The picker shown now: an editor may make it again as it redraws.
  const pick = function () { return w.pickers[w.pickers.length - 1]; };
  const picker = pick();
  // Andy, box v7: "this shell element will use the standard family and verb pickers that already exist."
  ok(picker && the(host, 'path').children.indexOf(picker) !== -1, 'its paths are picked with the shell\'s api-branch selector, family then verb', 'pickers: ' + w.pickers.length);
  type(host, 'label', 'Reader');
  type(host, 'description', 'reads files');
  pick().value = 'files.read'; the(host, 'addpath').click(); await settle();
  pick().value = 'files'; the(host, 'addpath').click(); await settle();
  ok(host.byPath['files.read'] && host.byPath.files, 'each path added shows, with its own remove button: a family or a single verb', 'paths shown: ' + short(Object.keys(host.byPath)));
  pick().value = 'files'; the(host, 'addpath').click(); await settle();
  pick().value = ''; the(host, 'addpath').click(); await settle();
  ok(Object.keys(host.byPath).length === 2, 'a path already there, or none picked, adds nothing', 'paths shown: ' + short(Object.keys(host.byPath)));
  host.byPath.files.click(); await settle();
  ok(!host.byPath.files && host.byPath['files.read'], 'a path\'s remove button takes it off', 'paths shown: ' + short(Object.keys(host.byPath)));
  the(host, 'save').click(); await settle();
  ok(w.asked.length === 1 && JSON.stringify(w.asked[0]) === JSON.stringify({ op: 'add', label: 'Reader', description: 'reads files', paths: ['files.read'] }),
    'Save asks auth.bundle { op: add, label, description, paths } through the spirit object', 'asked: ' + short(w.asked));
  w.asked.length = 0;
  w.answer = function () { return { refusal: 'owner-only' }; };
  the(host, 'add').click(); await settle();
  type(host, 'label', 'Files');
  w.pickers[w.pickers.length - 1].value = 'fs.loadFile'; the(host, 'addpath').click(); await settle();
  the(host, 'save').click(); await settle();
  ok(/owner-only/.test(host.textContent), 'a refused Save says the node\'s refusal', 'editor: ' + short(host.textContent));
  w.answer = null;

  test.subHeading('a bundle picked: edit and delete');
  w.asked.length = 0;
  list.o.pick(Object.assign({ key: 'KB1' }, B1), 'KB1'); await settle();
  ok(the(host, 'label') && the(host, 'label').value === 'Reader' && the(host, 'description').value === 'reads files' && host.byPath['files.read'] && host.byPath['files.list'],
    'a bundle picked from the list opens with its label, description and paths', 'editor: ' + short({ label: the(host, 'label') && the(host, 'label').value, paths: Object.keys(host.byPath) }));
  type(host, 'label', 'Lister');
  host.byPath['files.read'].click(); await settle();
  the(host, 'save').click(); await settle();
  const set = w.asked.filter(function (a) { return a.op === 'set'; })[0];
  ok(set && set.id === 'KB1' && set.label === 'Lister' && JSON.stringify(set.paths) === '["files.list"]' && !('description' in set),
    'Save asks auth.bundle { op: set, id } with what changed: the label, and the whole new path list', 'asked: ' + short(w.asked));
  w.asked.length = 0;
  the(host, 'delete').click(); await settle();
  if (!w.asked.length) { the(host, 'delete').click(); await settle(); }
  ok(w.asked.length === 1 && JSON.stringify(w.asked[0]) === JSON.stringify({ op: 'delete', id: 'KB1' }), 'Delete asks auth.bundle { op: delete, id }', 'asked: ' + short(w.asked));
  ok(list.refreshed >= 2, 'and the list asks again after a change', 'refreshed: ' + list.refreshed);

  test.subHeading('destroy');
  ed.destroy();
  ok(list.destroyed && host.innerHTML === '', 'destroy destroys its list and empties its box', 'destroyed ' + list.destroyed + ', box ' + short(host.innerHTML));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
