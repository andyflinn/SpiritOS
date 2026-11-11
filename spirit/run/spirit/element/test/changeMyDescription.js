'use strict';

// spirit/run/spirit/element/test/changeMyDescription.js
// The tests of spirit/element/changeMyDescription.js, and of no other module (spec: ./changeMyDescription.md; goal/G41.6). The
// browser file runs in node on a window of its own: the field rules are the real ones (spirit/fieldRules.js),
// fieldInput is a stub that keeps what was attached, and the node is a stub that answers node.setDescription.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'changeMyDescription.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
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
        if (c && typeof c.appendChild === 'function') c.appendChild(f.root);
        w.forms.push(f); return f;
      } } } } },
      require: function (p) { w.required.push(String(p)); return Promise.resolve(true); },
      // A family's cache (goal/G41.28): the family's own manager, run on this window over the real data set.
      cacheManager: function (name) {
        w.managers = (w.managers || []).concat(name);
        vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', String(name), 'data.js'), 'utf8'), win, { filename: name + '/data.js' });
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
  win.spirit.node = { key: 'KEY+DESCRIPTION/NODE==' };
  win.spirit.data.homeNode(win.spirit.node.key);
  if (fs.existsSync(FILE)) vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  // WHAT IT NEEDS, IT GETS ITSELF (goal/G43.24): no api is handed. The page's spirit object stands in: its escapeHtml, its
  // outcome as spirit.js has it, and the node family's setDescription, which records every call and answers as the node would
  // (its body, or a refusal thrown with its status and body).
  win.spirit.escapeHtml = function (s) { return String(s).replace(/</g, '&lt;'); };
  win.spirit.outcome = function (c) { return Promise.resolve(c).then(function (body) { return { status: 200, body: body }; }, function (e) { return { status: (e && e.status) || 0, body: (e && e.body) || null }; }); };
  win.spirit.node.setDescription = function (args) {
    w.calls.push({ name: 'node.setDescription', args: args });
    const a = answer('node.setDescription', args);
    return a && a.status === 200 ? Promise.resolve(a.body) : Promise.reject({ status: (a && a.status) || 0, body: a && a.body });
  };
  win.spirit.ready = Promise.resolve(win.spirit);
  // goal/G43.32: it stands at its path.
  w.E = win.spirit.element.spirit.element; w.win = win;
  return w;
}
const stored = function (name, args) { return { status: 200, body: { ok: true, description: String(args.description).trim() } }; };

// What the tests make, shared by the tests after them.
let w, host, el, input, rf, save, left, said, inSpan, spanText, c, N, r, h2, i2, s2;
test.run('spirit/element/changeMyDescription.js exists', 0.2, function () {
  return (fs.existsSync(FILE)) ? true : 'there is no spirit/element/changeMyDescription.js';
}, 1000);
test.run('it adds changeMyDescription.create to window.spirit.element', 0.2, function () {
  w = world(stored);
  return (!!w.E.changeMyDescription && typeof w.E.changeMyDescription.create === 'function') ? true : 'elements: ' + short(Object.keys(w.E));
}, 1000);
test.run('it loads fieldInput itself (goal/G41.3)', 0.2, function () {
  return (w.required.indexOf('spirit/element/fieldInput.js') !== -1) ? true : 'required: ' + short(w.required);
}, 1000);
test.run('its input is marked data-field="description"', 0.2, async function () {
  // the field, marked with its rule (rule/12)
  host = node('host');
  el = w.E.changeMyDescription.create(host);
  await settle();
  input = host.querySelector('[data-field="description"]');
  rf = w.forms[0];
  // Since goal/G41.27 its Save is the rowForm's button.
  save = rf ? rf.button : host.querySelector('[data-description="save"]');
  left = host.querySelector('[data-description="left"]');
  said = host.querySelector('[data-description="said"]');
  return (!!input) ? true : 'markup: ' + short(host.innerHTML);
}, 1000);
test.run('it loads the rowForm itself (rule/26)', 0.2, function () {
  // its form, a rowForm: ✏️ [Description-input] [Save] (goal/G41.27)
  // Andy, on G41.27: "changeMyDescription:\n\n[✏️][Description-input][Save]". The box: "spirit.element.spirit.element.rowForm.create(container, { icon, button }) -> { root, span, button }", "The mounter drops its form elements into span and wires the
  // button itself", and "a line saying what a press did (a refusal, a result) is the mounter's, below the bubble, not in it."
  return (w.required.indexOf('spirit/element/rowForm.js') !== -1) ? true : 'required: ' + short(w.required);
}, 1000);
test.run('its form is one rowForm in its host, its icon ✏️ and its button Save', 0.2, function () {
  return (w.forms.length === 1 && rf.opts.icon === '✏️' && rf.opts.button === 'Save' && under(host).indexOf(rf.root) !== -1) ? true : 'rowForms: ' + short(w.forms.map(function (f) { return f.opts; }));
}, 1000);
test.run('its span holds the description input alone: no word beside it', 0.2, function () {
  inSpan = rf ? under(rf.span) : [];
  spanText = rf ? (String(rf.span.innerHTML).replace(/<[^>]*>/g, ' ') + ' ' + inSpan.map(function (k) { return k.textContent || ''; }).join(' ')).replace(/\s+/g, ' ').trim() : '';
  return (!!rf && inSpan.indexOf(input) !== -1 && spanText === '' && !inSpan.some(function (k) { return /^<button|^<select/.test(k.tag) || (/^<input/.test(k.tag) && k !== input); })) ? true : 'span says ' + short(spanText) + ', input in it ' + (inSpan.indexOf(input) !== -1);
}, 1000);
test.run('its Save is the rowForm\'s button, and it draws no Save of its own', 0.2, function () {
  return (!!rf && !host.querySelector('[data-description="save"]') && !/<button/.test(host.innerHTML)) ? true : 'markup: ' + short(host.innerHTML);
}, 1000);
test.run('its bytes left and its message stand below the bubble, not in it', 0.2, function () {
  return (!!rf && !!left && !!said && under(rf.root).indexOf(left) === -1 && under(rf.root).indexOf(said) === -1) ? true : 'in the bubble: ' + short([rf && under(rf.root).indexOf(left) !== -1, rf && under(rf.root).indexOf(said) !== -1]);
}, 1000);
test.run('it has its Save, its bytes left and its message', 0.2, function () {
  return (!!save && !!left && !!said) ? true : 'markup: ' + short(host.innerHTML);
}, 1000);
test.run('the input is held at its byte limit by fieldInput, the description rule', 0.2, function () {
  return (w.attached.some(function (a) { return a.input === input && a.rule === 'description'; })) ? true : 'attached: ' + short(w.attached.map(function (a) { return a.rule; }));
}, 1000);
test.run('set(value) puts the stored description in the field', 0.2, function () {
  // it shows what the node holds, and the bytes left
  el.set('Andy');
  return (input.value === 'Andy') ? true : 'value: ' + input.value;
}, 1000);
test.run('the bytes left are counted in bytes as typed', 0.2, function () {
  return (/124 left/.test(left.textContent)) ? true : 'left: ' + left.textContent;
}, 1000);
test.run('an emoji costs four bytes', 0.2, function () {
  input.value = 'Andy 😀';
  input.fire('input');
  return (/119 left/.test(left.textContent)) ? true : 'left: ' + left.textContent;
}, 1000);
test.run('a description past its limit never reaches the wire, and the field says why', 0.2, async function () {
  // Save is refused while the rule says no, and says why
  input.value = 'x'.repeat(129);
  input.fire('input');
  save.fire('click');
  await settle();
  return (w.calls.length === 0 && said.textContent.length > 0) ? true : 'calls ' + w.calls.length + ', said: ' + said.textContent;
}, 1000);
test.run('Save asks node.setDescription with the field as typed', 0.2, async function () {
  // Save asks the node, and the field shows what it stored (rule/19)
  input.value = '  Bob  ';
  input.fire('input');
  save.fire('click');
  await settle();
  c = w.calls[0];
  return (c && c.name === 'node.setDescription' && c.args.description === '  Bob  ') ? true : 'calls: ' + short(w.calls);
}, 1000);
test.run('the field then shows the description the node stored', 0.2, function () {
  return (input.value === 'Bob') ? true : 'value: "' + input.value + '"';
}, 1000);
test.run('and it says saved', 0.2, function () {
  return (/saved/.test(said.textContent)) ? true : 'said: ' + said.textContent;
}, 1000);
test.run('it loads the node manager, and the description the node stored is kept in ((spirit.data || {}).node || {}).data\'s card', 0.2, function () {
  // what it changes, it listens for: the node card in the node family's cache (goal/G41.28)
  N = ((w.win.spirit.data || {}).node || {}).data;
  return ((w.managers || []).indexOf('node') !== -1 && !!N && !!N.card.get() && N.card.get().description === 'Bob') ? true : 'managers: ' + short(w.managers) + ', card ' + short(N && N.card.get());
}, 1000);
test.run('a description changed in the card, from elsewhere, redraws the field', 0.2, async function () {
  N.card.keep({ description: 'Eve' });
  await settle();
  return (input.value === 'Eve') ? true : 'value: "' + input.value + '"';
}, 1000);
test.run('Enter saves as Save does', 0.2, async function () {
  input.value = 'Carl';
  input.fire('keydown', { key: 'Enter', preventDefault: function () {} });
  await settle();
  return (w.calls.length === 2 && w.calls[1].args.description === 'Carl') ? true : 'calls: ' + short(w.calls.map(function (x) { return x.args; }));
}, 1000);
test.run('the node\'s refusal is said beside the field', 0.2, async function () {
  // a refusal is said, and the field keeps what was typed
  r = world(function () { return { status: 200, body: { ok: false, error: 'refused here' } }; });
  h2 = node('host');
  r.E.changeMyDescription.create(h2);
  await settle();
  i2 = h2.querySelector('[data-field="description"]');
  s2 = r.forms[0] ? r.forms[0].button : h2.querySelector('[data-description="save"]');
  i2.value = 'Dana';
  i2.fire('input');
  s2.fire('click');
  await settle();
  return (/refused here/.test(h2.querySelector('[data-description="said"]').textContent) && i2.value === 'Dana') ? true : 'said: ' + h2.querySelector('[data-description="said"]').textContent;
}, 1000);
