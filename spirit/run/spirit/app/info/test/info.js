'use strict';

// spirit/run/shell/info/test/info.js
// The tests of shell/info/info.js, and of no other module (spec: ./info.md; goal/G41.6). The browser file runs in node on
// a window of its own: its two field elements, the two forms, the relay family and the node are stubs that keep what the
// app asked of them.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'info.js');
const SRC = fs.readFileSync(FILE, 'utf8');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

// A node whose markup makes a child per tag; found by [attr="value"].
function node(tag) {
  const heard = {}; let html = '';
  const n = { tag: tag || '', nodes: [], kids: [], value: '', className: '', textContent: '', hidden: false, style: {}, isConnected: true,
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v); n.nodes = [];
      const re = /<([a-z]+)\b([^>]*)>/gi; let m;
      while ((m = re.exec(html))) n.nodes.push(node(m[0]));
    },
    getAttribute: function (k) { const m = new RegExp('\\s' + k + '="([^"]*)"').exec(n.tag); return m ? m[1] : null; },
    querySelector: function (sel) {
      const a = /^\[([\w-]+)="([^"]*)"\]$/.exec(sel);
      return a ? n.nodes.concat(n.kids).filter(function (c) { return c.getAttribute(a[1]) === a[2]; })[0] || null : null;
    },
    appendChild: function (c) { n.kids.push(c); c.parentNode = n; return c; },
    addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
    fire: function (t, e) { (heard[t] || []).slice().forEach(function (fn) { fn(e || {}); }); },
  };
  return n;
}

const ROWS = [
  { url: 'https://a.example', label: 'A', claimed: true, claimedLabel: 'Old', roll: { relayKey: 'RA' } },
  { url: 'https://b.example', label: 'B', claimed: false },
];

function world() {
  const w = { required: [], made: {}, sets: [], forms: [], calls: [], posts: [], dialogs: [], def: null, subs: [], rowForms: [] };
  function field(kind) {
    return { create: function (host, opts) { const el = { host: host, opts: opts, set: function (v) { w.sets.push({ kind: kind, value: v }); }, destroy: function () {} };
      w.made[kind] = el; return el; } };
  }
  const E = {
    changeMyLabel: field('label'),
    changeMyDescription: field('description'),
    joinForm: { mount: function (host, o) { w.forms.push({ form: 'join', host: host, o: o }); } },
    faceForm: { mount: function (host, o) { w.forms.push({ form: 'face', host: host, o: o }); } },
    // The one-row form (goal/G41.27), tested in its own folder: a stand-in answering { root, span, button } as the real
    // one does, its root appended to the container it is given, its button saying the words it was handed.
    rowForm: { create: function (c, o) {
      const f = { container: c, opts: o || {}, root: node('<div>'), span: node('<span>'), button: node('<button>') };
      f.button.textContent = String((o && o.button) || ''); f.root.appendChild(f.span); f.root.appendChild(f.button);
      if (c && typeof c.appendChild === 'function') c.appendChild(f.root);
      w.rowForms.push(f); return f;
    } },
  };
  const api = {
    escapeHtml: function (s) { return String(s); },
    verb: function (name, args) { w.calls.push({ name: name, args: args });
      if (name === 'node.card') return Promise.resolve({ status: 200, body: { ok: true, name: 'Andy', description: 'a node' } });
      return Promise.resolve({ status: 200, body: { ok: true } }); },
    peerPost: function (app, key, body) { w.posts.push({ app: app, key: key, body: body }); return Promise.resolve({ ok: true, body: { ok: true } }); },
    callDialog: function (id, p) { w.dialogs.push(id); },
  };
  const win = {
    spirit: { get element() { return this.elements; }, elements: E,
      require: function (p) { w.required.push(String(p)); return Promise.resolve(true); },
      relay: { status: function () { w.statuses = (w.statuses || 0) + 1; return Promise.resolve({ body: { rows: ROWS } }); } },
      // A family's cache (goal/G41.28): the family's own manager, run on this window over the real data set.
      cacheManager: function (name) {
        w.managers = (w.managers || []).concat(name);
        vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', String(name), 'data.js'), 'utf8'), win, { filename: name + '/data.js' });
        return Promise.resolve(true);
      },
      shell: { activateApp: function (d) { w.def = d; } } },
    document: { getElementById: function () { return null; }, createElement: function (t) { return node('<' + t + '>'); } },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String,
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  vm.createContext(win);
  // The page's one data set, its node known (goal/G41.28, Q10), as spirit.start leaves it before any app runs.
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), win, { filename: 'data.js' });
  win.spirit.node = { key: 'KEY+INFO/NODE==' };
  win.spirit.data.homeNode(win.spirit.node.key);
  vm.runInContext(SRC, win, { filename: FILE });
  w.api = api; api.win = win;
  return w;
}

test.startTest('info.js: the Info app');

(async function () {
  test.subHeading('"What each relay calls you" is dropped, its code with it (Andy, 2026-10-27)');
  ok(!/What each relay calls you/.test(SRC), 'its words are gone', 'info.js still says "What each relay calls you"');
  ok(!/infoDrawRelays|infoPush|infoPushed|rename\s*:/.test(SRC), 'its table, its push of the name to every relay and its rename are deleted', 'info.js still holds the relay table or the rename');

  const w = world();
  ok(w.def && typeof w.def.mount === 'function', 'it mounts through spirit.shell.activateApp', 'no activateApp with mount');
  if (!w.def) return;

  test.subHeading('it loads what it uses itself (goal/G41.3)');
  ['spirit/element/changeMyLabel.js', 'spirit/element/changeMyDescription.js', 'spirit/element/joinForm.js', 'spirit/element/faceForm.js'].forEach(function (p) {
    ok(w.required.indexOf(p) !== -1, 'it requires ' + p, 'required: ' + short(w.required));
  });

  const box = node('container');
  await w.def.mount(box, w.api); await settle();
  ok(!/What each relay calls you/.test(box.innerHTML), 'its page draws no relay table', 'markup: ' + short(box.innerHTML));

  test.subHeading('its two blocks are the two shell elements; the node\'s card is kept in the node family\'s cache (goal/G41.28)');
  ok(!!w.made.label && w.made.label.opts.api === w.api, 'the name block is changeMyLabel, handed the app\'s api', 'made: ' + short(Object.keys(w.made)));
  ok(!!w.made.description && w.made.description.opts.api === w.api, 'the description block is changeMyDescription', 'made: ' + short(Object.keys(w.made)));
  ok(w.calls.some(function (c) { return c.name === 'node.card'; }), 'it reads node.card', 'calls: ' + short(w.calls.map(function (c) { return c.name; })));
  const N = ((w.api.win.spirit.data || {}).node || {}).data;
  ok((w.managers || []).indexOf('node') !== -1 && !!N && !!N.card.get() && N.card.get().name === 'Andy' && N.card.get().description === 'a node',
    'it loads the node manager, and node.card\'s answer is kept in ((spirit.data || {}).node || {}).data\'s card, which each element draws itself from', 'managers: ' + short(w.managers) + ', card ' + short(N && N.card.get()));
  ok(w.sets.length === 0, 'it sets neither field itself', 'sets: ' + short(w.sets));
  ok(w.posts.length === 0, 'no name is posted to any relay', 'posts: ' + short(w.posts));

  test.subHeading('it reads the relays from the contact family\'s cache (goal/G41.28)');
  // goal/G41.32: a relay's row changing is its two forms' to follow, in the contact family's cache; Info reads nothing.
  const before = w.statuses;
  w.api.win.spirit.data.takeJob({ id: 'job_shadow', type: 'shadow', data: { row: { publicKey: 'RA', relay: true, keep: true, seated: false } } });
  await settle();
  ok(w.statuses === before, 'Info asks relay.status no more on its own', 'relay.status asked ' + before + ', then ' + w.statuses);

  test.subHeading('the two forms and the key rotation stay');
  const join = w.forms.filter(function (f) { return f.form === 'join'; }).pop();
  const face = w.forms.filter(function (f) { return f.form === 'face'; }).pop();
  ok(!!join && !!face, 'the email form and the face form are drawn', 'forms: ' + short(w.forms.map(function (f) { return f.form; })));
  ok(join && join.o.relays.length === 1 && join.o.relays[0].url === 'https://a.example', 'over the relays this node holds a seat on', 'relays: ' + short(join && join.o.relays));

  test.subHeading('the key rotation, a rowForm: 🆘 [Rotate this node\'s cipher key] (goal/G41.27)');
  // Andy, on G41.27: "Info App\n\n[🆘] [Rotate this node's cipher key]". The box: "the first element is always an icon
  // shell-element", "the last element is always a button", "between the icon and the button is a span".
  ok(w.required.indexOf('spirit/element/rowForm.js') !== -1, 'it loads the rowForm itself (rule/26)', 'required: ' + short(w.required));
  const rot = w.rowForms.filter(function (f) { return /Rotate/.test(f.opts.button || ''); });
  const rf = rot[0];
  ok(rot.length === 1 && rf.opts.icon === '🆘' && rf.opts.button === 'Rotate this node\'s cipher key', 'the key rotation is one rowForm, its icon 🆘 and its button Rotate this node\'s cipher key', 'rowForms: ' + short(w.rowForms.map(function (f) { return f.opts; })));
  ok(!!rf && rf.span.kids.length === 0 && rf.span.nodes.length === 0 && !String(rf.span.innerHTML || '').replace(/<[^>]*>/g, '').trim(), 'its span holds nothing', 'span: ' + short(rf && rf.span.innerHTML));
  ok(!!rf && !/<button[^>]*>\s*Rotate/.test(box.innerHTML), 'it draws no Rotate button of its own', 'markup: ' + short(box.innerHTML));
  if (rf) { rf.button.fire('click'); ok(w.dialogs[0] === 'shell/rotateKey', 'its button opens the Rotate key page', 'dialogs: ' + short(w.dialogs)); }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
