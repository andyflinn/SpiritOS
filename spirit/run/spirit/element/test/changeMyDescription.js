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

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
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
    spirit: { element: { fieldInput: { attach: function (input, rule) { w.attached.push({ input: input, rule: rule }); return input; } },
      // The one-row form (goal/G41.27), tested in its own folder: a stand-in answering { root, span, button } as the
      // real one does, its root appended to the container it is given, its button saying the words it was handed.
      rowForm: { create: function (c, o) {
        const f = { container: c, opts: o || {}, root: node('<div>'), span: node('<span>'), button: node('<button>') };
        f.button.textContent = String((o && o.button) || ''); f.root.appendChild(f.span); f.root.appendChild(f.button);
        if (c && typeof c.appendChild === 'function') c.appendChild(f.root);
        w.forms.push(f); return f;
      } } },
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
  w.E = win.spirit.element; w.win = win;
  return w;
}
const stored = function (name, args) { return { status: 200, body: { ok: true, description: String(args.description).trim() } }; };

test.startTest('changeMyDescription.js: the node\'s description, changed');

(async function () {
  ok(fs.existsSync(FILE), 'spirit/element/changeMyDescription.js exists', 'there is no spirit/element/changeMyDescription.js');
  if (!fs.existsSync(FILE)) return;
  const w = world(stored);
  ok(!!w.E.changeMyDescription && typeof w.E.changeMyDescription.create === 'function', 'it adds changeMyDescription.create to window.spirit.element', 'elements: ' + short(Object.keys(w.E)));
  if (!w.E.changeMyDescription) return;
  ok(w.required.indexOf('spirit/element/fieldInput.js') !== -1, 'it loads fieldInput itself (goal/G41.3)', 'required: ' + short(w.required));

  test.subHeading('the field, marked with its rule (rule/12)');
  const host = node('host');
  const el = w.E.changeMyDescription.create(host);
  await settle();
  const input = host.querySelector('[data-field="description"]');
  const rf = w.forms[0];
  // Since goal/G41.27 its Save is the rowForm's button.
  const save = rf ? rf.button : host.querySelector('[data-description="save"]');
  const left = host.querySelector('[data-description="left"]');
  const said = host.querySelector('[data-description="said"]');
  ok(!!input, 'its input is marked data-field="description"', 'markup: ' + short(host.innerHTML));

  test.subHeading('its form, a rowForm: ✏️ [Description-input] [Save] (goal/G41.27)');
  // Andy, on G41.27: "changeMyDescription:\n\n[✏️][Description-input][Save]". The box: "spirit.elements.rowForm.create(container, { icon, button }) -> { root, span, button }", "The mounter drops its form elements into span and wires the
  // button itself", and "a line saying what a press did (a refusal, a result) is the mounter's, below the bubble, not in it."
  ok(w.required.indexOf('spirit/element/rowForm.js') !== -1, 'it loads the rowForm itself (rule/26)', 'required: ' + short(w.required));
  ok(w.forms.length === 1 && rf.opts.icon === '✏️' && rf.opts.button === 'Save' && under(host).indexOf(rf.root) !== -1, 'its form is one rowForm in its host, its icon ✏️ and its button Save', 'rowForms: ' + short(w.forms.map(function (f) { return f.opts; })));
  const inSpan = rf ? under(rf.span) : [];
  const spanText = rf ? (String(rf.span.innerHTML).replace(/<[^>]*>/g, ' ') + ' ' + inSpan.map(function (k) { return k.textContent || ''; }).join(' ')).replace(/\s+/g, ' ').trim() : '';
  ok(!!rf && inSpan.indexOf(input) !== -1 && spanText === '' && !inSpan.some(function (k) { return /^<button|^<select/.test(k.tag) || (/^<input/.test(k.tag) && k !== input); }),
    'its span holds the description input alone: no word beside it', 'span says ' + short(spanText) + ', input in it ' + (inSpan.indexOf(input) !== -1));
  ok(!!rf && !host.querySelector('[data-description="save"]') && !/<button/.test(host.innerHTML), 'its Save is the rowForm\'s button, and it draws no Save of its own', 'markup: ' + short(host.innerHTML));
  ok(!!rf && !!left && !!said && under(rf.root).indexOf(left) === -1 && under(rf.root).indexOf(said) === -1, 'its bytes left and its message stand below the bubble, not in it', 'in the bubble: ' + short([rf && under(rf.root).indexOf(left) !== -1, rf && under(rf.root).indexOf(said) !== -1]));
  ok(!!save && !!left && !!said, 'it has its Save, its bytes left and its message', 'markup: ' + short(host.innerHTML));
  if (!input || !save || !left || !said) return;
  ok(w.attached.some(function (a) { return a.input === input && a.rule === 'description'; }), 'the input is held at its byte limit by fieldInput, the description rule', 'attached: ' + short(w.attached.map(function (a) { return a.rule; })));

  test.subHeading('it shows what the node holds, and the bytes left');
  el.set('Andy');
  ok(input.value === 'Andy', 'set(value) puts the stored description in the field', 'value: ' + input.value);
  ok(/124 left/.test(left.textContent), 'the bytes left are counted in bytes as typed', 'left: ' + left.textContent);
  input.value = 'Andy 😀'; input.fire('input');
  ok(/119 left/.test(left.textContent), 'an emoji costs four bytes', 'left: ' + left.textContent);

  test.subHeading('Save is refused while the rule says no, and says why');
  input.value = 'x'.repeat(129); input.fire('input'); save.fire('click'); await settle();
  ok(w.calls.length === 0 && said.textContent.length > 0, 'a description past its limit never reaches the wire, and the field says why', 'calls ' + w.calls.length + ', said: ' + said.textContent);

  test.subHeading('Save asks the node, and the field shows what it stored (rule/19)');
  input.value = '  Bob  '; input.fire('input'); save.fire('click'); await settle();
  const c = w.calls[0];
  ok(c && c.name === 'node.setDescription' && c.args.description === '  Bob  ', 'Save asks node.setDescription with the field as typed', 'calls: ' + short(w.calls));
  ok(input.value === 'Bob', 'the field then shows the description the node stored', 'value: "' + input.value + '"');
  ok(/saved/.test(said.textContent), 'and it says saved', 'said: ' + said.textContent);

  test.subHeading('what it changes, it listens for: the node card in the node family\'s cache (goal/G41.28)');
  const N = ((w.win.spirit.data || {}).node || {}).data;
  ok((w.managers || []).indexOf('node') !== -1 && !!N && !!N.card.get() && N.card.get().description === 'Bob', 'it loads the node manager, and the description the node stored is kept in ((spirit.data || {}).node || {}).data\'s card', 'managers: ' + short(w.managers) + ', card ' + short(N && N.card.get()));
  N.card.keep({ description: 'Eve' }); await settle();
  ok(input.value === 'Eve', 'a description changed in the card, from elsewhere, redraws the field', 'value: "' + input.value + '"');
  input.value = 'Carl'; input.fire('keydown', { key: 'Enter', preventDefault: function () {} }); await settle();
  ok(w.calls.length === 2 && w.calls[1].args.description === 'Carl', 'Enter saves as Save does', 'calls: ' + short(w.calls.map(function (x) { return x.args; })));

  test.subHeading('a refusal is said, and the field keeps what was typed');
  const r = world(function () { return { status: 200, body: { ok: false, error: 'refused here' } }; });
  const h2 = node('host');
  r.E.changeMyDescription.create(h2);
  await settle();
  const i2 = h2.querySelector('[data-field="description"]');
  const s2 = r.forms[0] ? r.forms[0].button : h2.querySelector('[data-description="save"]');
  i2.value = 'Dana'; i2.fire('input'); s2.fire('click'); await settle();
  ok(/refused here/.test(h2.querySelector('[data-description="said"]').textContent) && i2.value === 'Dana', 'the node\'s refusal is said beside the field', 'said: ' + h2.querySelector('[data-description="said"]').textContent);
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
