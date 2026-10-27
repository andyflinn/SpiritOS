'use strict';

// spirit/run/shell/js/test/changeMyDescription.js
// The tests of shell/js/changeMyDescription.js, and of no other module (spec: ./changeMyDescription.md; goal/G41.6). The
// browser file runs in node on a window of its own: the field rules are the real ones (spirit/fieldRules.js),
// fieldInput is a stub that keeps what was attached, and the node is a stub that answers node.setDescription.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'changeMyDescription.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

// A node whose markup makes a child per tag; found by [attr="value"].
function node(tag) {
  const heard = {}; let html = '';
  const n = { tag: tag || '', nodes: [], value: '', className: '', textContent: '', hidden: false, style: {}, disabled: false,
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v); n.nodes = [];
      const re = /<([a-z]+)\b([^>]*)>/gi; let m;
      while ((m = re.exec(html))) n.nodes.push(node(m[0]));
    },
    getAttribute: function (k) { const m = new RegExp('\\s' + k + '="([^"]*)"').exec(n.tag); return m ? m[1] : null; },
    querySelector: function (sel) {
      const a = /^\[([\w-]+)="([^"]*)"\]$/.exec(sel);
      return a ? n.nodes.filter(function (c) { return c.getAttribute(a[1]) === a[2]; })[0] || null : null;
    },
    addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
    fire: function (t, e) { (heard[t] || []).slice().forEach(function (fn) { fn(e || {}); }); },
  };
  return n;
}

function world(answer) {
  const w = { calls: [], attached: [], required: [], saved: [] };
  const win = {
    spirit: { elements: { fieldInput: { attach: function (input, rule) { w.attached.push({ input: input, rule: rule }); return input; } } },
      require: function (p) { w.required.push(String(p)); return Promise.resolve(true); } },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String,
    TextEncoder: TextEncoder, console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'fieldRules.js'), 'utf8'), win, { filename: 'fieldRules.js' });
  if (fs.existsSync(FILE)) vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  w.api = { escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); },
    verb: function (name, args) { w.calls.push({ name: name, args: args }); return Promise.resolve(answer(name, args)); } };
  w.E = win.spirit.elements;
  return w;
}
const stored = function (name, args) { return { status: 200, body: { ok: true, description: String(args.description).trim() } }; };

test.startTest('changeMyDescription.js: the node\'s description, changed');

(async function () {
  ok(fs.existsSync(FILE), 'shell/js/changeMyDescription.js exists', 'there is no shell/js/changeMyDescription.js');
  if (!fs.existsSync(FILE)) return;
  const w = world(stored);
  ok(!!w.E.changeMyDescription && typeof w.E.changeMyDescription.create === 'function', 'it adds changeMyDescription.create to window.spirit.elements', 'elements: ' + short(Object.keys(w.E)));
  if (!w.E.changeMyDescription) return;
  ok(w.required.indexOf('shell/js/fieldInput.js') !== -1, 'it loads fieldInput itself (goal/G41.3)', 'required: ' + short(w.required));

  test.subHeading('the field, marked with its rule (rule/12)');
  const host = node('host');
  const el = w.E.changeMyDescription.create(host, { api: w.api, onSaved: function (d) { w.saved.push(d); } });
  await settle();
  const input = host.querySelector('[data-field="description"]');
  const save = host.querySelector('[data-description="save"]');
  const left = host.querySelector('[data-description="left"]');
  const said = host.querySelector('[data-description="said"]');
  ok(!!input, 'its input is marked data-field="description"', 'markup: ' + short(host.innerHTML));
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
  ok(w.saved[0] === 'Bob', 'and onSaved hears it', 'saved: ' + short(w.saved));
  ok(/saved/.test(said.textContent), 'and it says saved', 'said: ' + said.textContent);
  input.value = 'Carl'; input.fire('keydown', { key: 'Enter', preventDefault: function () {} }); await settle();
  ok(w.calls.length === 2 && w.calls[1].args.description === 'Carl', 'Enter saves as Save does', 'calls: ' + short(w.calls.map(function (x) { return x.args; })));

  test.subHeading('a refusal is said, and the field keeps what was typed');
  const r = world(function () { return { status: 200, body: { ok: false, error: 'refused here' } }; });
  const h2 = node('host');
  r.E.changeMyDescription.create(h2, { api: r.api });
  await settle();
  const i2 = h2.querySelector('[data-field="description"]');
  i2.value = 'Dana'; i2.fire('input'); h2.querySelector('[data-description="save"]').fire('click'); await settle();
  ok(/refused here/.test(h2.querySelector('[data-description="said"]').textContent) && i2.value === 'Dana', 'the node\'s refusal is said beside the field', 'said: ' + h2.querySelector('[data-description="said"]').textContent);
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
