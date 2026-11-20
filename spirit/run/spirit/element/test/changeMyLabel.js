'use strict';

// spirit/run/spirit/element/test/changeMyLabel.js
// The tests of spirit/element/changeMyLabel.js, and of no other module (spec: ./changeMyLabel.md; goal/G41.6). The browser
// file runs in node on a window of its own: the field rules are the real ones (spirit/fieldRules.js), fieldInput is a
// stub that keeps what was attached, and the node is a stub that answers node.setName.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'changeMyLabel.js');

const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

// A node whose markup makes a child per tag; found by [attr="value"].
function node(tag) {
  const heard = {}; let html = '';
  const n = { tag: tag || '', nodes: [], kids: [], value: '', className: '', textContent: '', hidden: false, style: {}, disabled: false,
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v); n.nodes = [];
      const re = /<([a-z]+)\b([^>]*)>/gi; let m;
      while ((m = re.exec(html))) n.nodes.push(node(m[0]));
    },
    attrs: {},
    getAttribute: function (k) { if (k in n.attrs) return n.attrs[k]; const m = new RegExp('\\s' + k + '="([^"]*)"').exec(n.tag); return m ? m[1] : null; },
    setAttribute: function (k, v) { n.attrs[k] = String(v); },
    // What its markup made and what was appended to it, all the way down (goal/G41.27: a rowForm's parts are appended).
    querySelector: function (sel) {
      const a = /^\[([\w-]+)="([^"]*)"\]$/.exec(sel);
      return a ? under(n).filter(function (c) { return c.getAttribute(a[1]) === a[2]; })[0] || null : null;
    },
    appendChild: function (c) { n.kids.push(c); c.parentNode = n; return c; },
    addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
    click: function () { n.fire('click'); },
    fire: function (t, e) { (heard[t] || []).slice().forEach(function (fn) { fn(e || {}); }); },
  };
  return n;
}
function under(n) { const out = []; (function walk(x) { x.nodes.concat(x.kids).forEach(function (c) { out.push(c); walk(c); }); }(n)); return out; }

function world(answer) {
  const w = { calls: [], attached: [], required: [], saved: [], forms: [] };
  const win = {
    // goal/G43.32: the rowForm stands where an element now finds it, spirit.element.spirit.element; fieldInput, a helper
    // with no create, at spirit.required.spirit.element (below).
    spirit: { element: { spirit: { element: {
      // The one-row form (goal/G41.27), tested in its own folder: a stand-in answering { root, span, button } as the
      // real one does, its root appended to the container it is given, its button saying the words it was handed.
      rowForm: { create: function (c, o) {
        const f = { container: c, opts: o || {}, root: node('<div>'), span: node('<span>'), button: node('<button>') };
        f.button.textContent = String((o && o.button) || ''); f.root.appendChild(f.span); f.root.appendChild(f.button);
        // A press calls press, the mounter's request, and keeps what it answered, as the real one's busyButton waits on it.
        f.button.addEventListener('click', function () { if (typeof f.opts.press === 'function') f.pressed = f.opts.press(); });
        if (c && typeof c.appendChild === 'function') c.appendChild(f.root);
        w.forms.push(f); return f;
      } } } } },
      // A family's cache (goal/G41.28): a branch's api.js brings its companion data.js, as the real api.js does
      // (goal/G47.1: "every api.js requires it's companion data.js"); the stand-in runs that data.js on this window over
      // the real data set. A data.js asked for directly is only recorded.
      require: function (p) {
        w.required.push(String(p));
        const b = (/^(spirit\/(?:app\/)?[^/]+)\/api\.js$/.exec(String(p)) || [])[1];
        const f = b ? path.join(RUN, b, 'data.js') : '';
        if (f && fs.existsSync(f)) vm.runInContext(fs.readFileSync(f, 'utf8'), win, { filename: f });
        return Promise.resolve(true);
      } },
    document: { createElement: function (t) { return node('<' + t + '>'); }, createTextNode: function (t) { const x = node('#text'); x.textContent = String(t); return x; } },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String,
    TextEncoder: TextEncoder, console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  // goal/G43.32: the element places itself by installSpiritElement; the recorder hands that helper to the page stand-in
  // (spirit/test/headLessChrome.js pageSpirit).
  const recorder = win.spirit.require;
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(win.spirit);
  const pageRequire = win.spirit.require;
  win.spirit.require = function (p) { return /installSpiritElement\.js$/.test(p) ? pageRequire(p) : recorder(p); };
  win.spirit.required.spirit.element.fieldInput = { attach: function (input, rule) { w.attached.push({ input: input, rule: rule }); return input; } };
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'fieldRules.js'), 'utf8'), win, { filename: 'fieldRules.js' });
  // The page's one data set, its node known (goal/G41.28, Q10), as spirit.start leaves it before any element runs.
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), win, { filename: 'data.js' });
  win.spirit.node = { key: 'KEY+LABEL/NODE==' };
  win.spirit.data.homeNode(win.spirit.node.key);
  if (fs.existsSync(FILE)) vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  // WHAT IT NEEDS, IT GETS ITSELF (goal/G43.24): no api is handed. The page's spirit object stands in: its escapeHtml, its
  // outcome as spirit.js has it, and the node family's setName, which records every call and answers as the node would
  // (its body, or a refusal thrown with its status and body).
  win.spirit.escapeHtml = function (s) { return String(s).replace(/</g, '&lt;'); };
  win.spirit.outcome = function (c) { return Promise.resolve(c).then(function (body) { return { status: 200, body: body }; }, function (e) { return { status: (e && e.status) || 0, body: (e && e.body) || null }; }); };
  win.spirit.node.setName = function (args) {
    w.calls.push({ name: 'node.setName', args: args });
    const a = answer('node.setName', args);
    return a && a.status === 200 ? Promise.resolve(a.body) : Promise.reject({ status: (a && a.status) || 0, body: a && a.body });
  };
  win.spirit.ready = Promise.resolve(win.spirit);
  // goal/G43.32: it stands at its path.
  w.E = win.spirit.element.spirit.element; w.win = win;
  return w;
}
const stored = function (name, args) { return { status: 200, body: { ok: true, name: String(args.name).trim() } }; };

// What the tests make, shared by the tests after them.
let w, host, el, input, rf, save, left, said, inSpan, spanText, nameBefore, c, N, r, h2, i2, s2;
test.run('spirit/element/changeMyLabel.js exists', 0.2, function () {
  return (fs.existsSync(FILE)) ? true : false;
}, test.limit.quick);
test.run('it adds changeMyLabel.create to window.spirit.element', 0.2, function () {
  w = world(stored);
  return (!!w.E.changeMyLabel && typeof w.E.changeMyLabel.create === 'function') ? true : false;
}, test.limit.quick);
test.run('it loads fieldInput itself', 0.2, function () {
  return (w.required.indexOf('spirit/element/fieldInput.js') !== -1) ? true : false;
}, test.limit.quick);
test.run('its input is marked data-field="label"', 0.2, async function () {
  // the field, marked with its rule (rule/12)
  host = node('host');
  el = w.E.changeMyLabel.create(host);
  await settle();
  input = host.querySelector('[data-field="label"]');
  rf = w.forms[0];
  // Since goal/G41.27 its Save is the rowForm's button.
  save = rf ? rf.button : host.querySelector('[data-label="save"]');
  left = host.querySelector('[data-label="left"]');
  said = host.querySelector('[data-label="said"]');
  return (!!input) ? true : false;
}, test.limit.quick);
test.run('it loads the rowForm itself', 0.2, function () {
  // its form, a rowForm: ✏️ "Name" [name-input] [Save] (goal/G41.27)
  // Andy, on G41.27: "Info app:\n\n[✏️] \"Name\" [name-input] [Save]\n\nthis might be in the changeMyLabel element....".
  // The box: "spirit.element.spirit.element.rowForm.create(container, { icon, button }) -> { root, span, button }", "The mounter drops
  // its form elements into span and wires the button itself", and "a line saying what a press did (a refusal, a result)
  // is the mounter's, below the bubble, not in it."
  return (w.required.indexOf('spirit/element/rowForm.js') !== -1) ? true : false;
}, test.limit.quick);
test.run('its form is one rowForm in its host, its icon ✏️ and its button Save', 0.2, function () {
  return (w.forms.length === 1 && rf.opts.icon === '✏️' && rf.opts.button === 'Save' && under(host).indexOf(rf.root) !== -1) ? true : false;
}, test.limit.quick);
test.run('its span says Name, then holds the name input, and nothing else', 0.2, function () {
  inSpan = rf ? under(rf.span) : [];
  spanText = rf ? (String(rf.span.innerHTML).replace(/<[^>]*>/g, ' ') + ' ' + inSpan.map(function (k) { return k.textContent || ''; }).join(' ')).replace(/\s+/g, ' ').trim() : '';
  nameBefore = rf ? (rf.span.innerHTML.indexOf('Name') !== -1 && rf.span.innerHTML.indexOf('Name') < rf.span.innerHTML.indexOf('data-field="label"')) ||
    (rf.span.kids.findIndex(function (k) { return /\bName\b/.test(k.textContent || ''); }) !== -1 && rf.span.kids.findIndex(function (k) { return /\bName\b/.test(k.textContent || ''); }) < rf.span.kids.findIndex(function (k) { return k === input || under(k).indexOf(input) !== -1; })) : false;
  return (!!rf && inSpan.indexOf(input) !== -1 && spanText === 'Name' && nameBefore && !inSpan.some(function (k) { return /^<button|^<select/.test(k.tag) || (/^<input/.test(k.tag) && k !== input); })) ? true : false;
}, test.limit.quick);
test.run('its Save is the rowForm\'s button, and it draws no Save of its own', 0.2, function () {
  return (!!rf && !host.querySelector('[data-label="save"]') && !/<button/.test(host.innerHTML)) ? true : false;
}, test.limit.quick);
test.run('its bytes left and its message stand below the bubble, not in it', 0.2, function () {
  return (!!rf && !!left && !!said && under(rf.root).indexOf(left) === -1 && under(rf.root).indexOf(said) === -1) ? true : false;
}, test.limit.quick);
test.run('it has its Save, its bytes left and its message', 0.2, function () {
  return (!!save && !!left && !!said) ? true : false;
}, test.limit.quick);
// Its type by path (goal/G48.4, the box: "a type identifier is ALWAYS spirit.type.*"): a label.
test.run('the input is held at its byte limit by fieldInput, the label type', 0.2, function () {
  return (w.attached.some(function (a) { return a.input === input && a.rule === 'spirit.type.string.label'; })) ? true : false;
}, test.limit.quick);
test.run('set puts the stored name in the field', 0.2, function () {
  // it shows what the node holds, and the bytes left
  el.set('Andy');
  return (input.value === 'Andy') ? true : false;
}, test.limit.quick);
test.run('the bytes left are counted in bytes as typed', 0.2, function () {
  return (/60 left/.test(left.textContent)) ? true : false;
}, test.limit.quick);
test.run('an emoji costs four bytes', 0.2, function () {
  input.value = 'Andy 😀';
  input.fire('input');
  return (/55 left/.test(left.textContent)) ? true : false;
}, test.limit.quick);
test.run('an empty name never reaches the wire, and the field says why', 0.2, async function () {
  // Save is refused while the rule says no, and says why
  input.value = '   ';
  input.fire('input');
  save.fire('click');
  await settle();
  return (w.calls.length === 0 && said.textContent.length > 0) ? true : false;
}, test.limit.quick);
test.run('Save asks node.setName with the field as typed', 0.2, async function () {
  // Save asks the node, and the field shows what it stored (rule/19)
  input.value = '  Bob  ';
  input.fire('input');
  save.fire('click');
  await settle();
  c = w.calls[0];
  return (c && c.name === 'node.setName' && c.args.name === '  Bob  ') ? true : false;
}, test.limit.quick);
test.run('the field then shows the name the node stored', 0.2, function () {
  return (input.value === 'Bob') ? true : false;
}, test.limit.quick);
test.run('after Save it says saved', 0.2, function () {
  return (/saved/.test(said.textContent)) ? true : false;
}, test.limit.quick);
test.run('it requires spirit/node/api.js and no data.js, and the name the node stored is kept in the node family\'s card', 0.2, function () {
  // what it changes, it listens for: the node card in the node family's cache (goal/G41.28)
  N = ((w.win.spirit.data || {}).node || {}).data;
  return (w.required.indexOf('spirit/node/api.js') !== -1 && !w.required.some(function (p) { return /data\.js$/.test(p); }) && !!N && !!N.card.get() && N.card.get().name === 'Bob') ? true : false;
}, test.limit.quick);
test.run('a name changed in the card, from elsewhere, redraws the field', 0.2, async function () {
  N.card.keep({ name: 'Eve' });
  await settle();
  return (input.value === 'Eve') ? true : false;
}, test.limit.quick);
test.run('Enter saves as Save does', 0.2, async function () {
  input.value = 'Carl';
  input.fire('keydown', { key: 'Enter', preventDefault: function () {} });
  await settle();
  return (w.calls.length === 2 && w.calls[1].args.name === 'Carl') ? true : false;
}, test.limit.quick);
// goal/G47.1, Q20, Andy: "mark the button busy from press until the mounter's answer comes": Save is the rowForm's press, and
// what it hands the rowForm settles only once the node has answered, so the button is busy until then.
test.run('its Save is handed to the rowForm as press, and the press settles only once the node has answered', 0.2, async function () {
  if (!rf || typeof rf.opts.press !== 'function') return false;
  input.value = 'Dora';
  save.fire('click');
  const p = rf.pressed;
  let at = null;
  if (p && typeof p.then === 'function') p.then(function () { at = said.textContent; });
  await settle();
  const asked = w.calls.length;
  return (asked === 3 && at === 'saved') ? true : false;
}, test.limit.quick);
test.run('the node\'s refusal is said beside the field', 0.2, async function () {
  // a refusal is said, and the field keeps what was typed
  r = world(function () { return { status: 200, body: { ok: false, error: 'name reserved' } }; });
  h2 = node('host');
  r.E.changeMyLabel.create(h2);
  await settle();
  i2 = h2.querySelector('[data-field="label"]');
  s2 = r.forms[0] ? r.forms[0].button : h2.querySelector('[data-label="save"]');
  i2.value = 'Dana';
  i2.fire('input');
  s2.fire('click');
  await settle();
  return (/name reserved/.test(h2.querySelector('[data-label="said"]').textContent) && i2.value === 'Dana') ? true : false;
}, test.limit.quick);
