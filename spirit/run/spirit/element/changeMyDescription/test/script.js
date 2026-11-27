'use strict';

// spirit/run/spirit/element/changeMyDescription/test/script.js
// The tests of spirit/element/changeMyDescription/script.js, and of no other module (spec: ./script.md; goal/G41.6). The
// browser file runs in node on a window of its own: the description type is the real one (spirit/type/string/description/script.js),
// fieldInput is a stub that keeps what was attached, and the node is a stub that answers node.setDescription.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/element/changeMyDescription/script.js';
const FILE = path.join(RUN, SUBJECT);

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
  const w = { calls: [], attached: [], required: [], saved: [], forms: [], nodeApi: {} };
  const win = {
    // ITS STAND-INS ARE requireScript's ANSWERS (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers ...
    // never by writing them into spirit.required"; Andy: "spirit.requireScript must allways return either an object or a
    // function... or fail/throw"): the rowForm and fieldInput, kept in STANDS (below), answered by requireScript.
    spirit: {
      // The one-row form (goal/G41.27), tested in its own folder: a stand-in answering { root, span, button } as the
      // real one does, its root appended to the container it is given, its button saying the words it was handed.
      zzRowForm: { create: function (c, o) {
        const f = { container: c, opts: o || {}, root: node('<div>'), span: node('<span>'), button: node('<button>') };
        f.button.textContent = String((o && o.button) || ''); f.root.appendChild(f.span); f.root.appendChild(f.button);
        // A press calls press, the mounter's request, and keeps what it answered, as the real one's busyButton waits on it.
        f.button.addEventListener('click', function () { if (typeof f.opts.press === 'function') f.pressed = f.opts.press(); });
        if (c && typeof c.appendChild === 'function') c.appendChild(f.root);
        w.forms.push(f); return f;
      } },
      // Each path kept; the node family's api.js requires its companion data.js (goal/G41.28, G47.1), as the real one
      // does: the real file, run once on this window over the real data set.
      requireScript: function (p) {
        w.required.push(String(p));
        if (p === 'spirit/node/api.js' && !w.ran) { w.ran = true; win.spirit.requireScript('spirit/node/data.js'); }
        // The node branch, required by its api.js's path, answers the stand-in's node verbs (goal/G49.6: one place, no branch by name).
        if (p === 'spirit/node/api.js') return Promise.resolve(w.nodeApi);
        if (Object.prototype.hasOwnProperty.call(w.stands, String(p))) return Promise.resolve(w.stands[String(p)]);
        return Promise.reject(new Error('no stand-in for ' + p));
      } },
    document: { createElement: function (t) { return node('<' + t + '>'); }, createTextNode: function (t) { const x = node('#text'); x.textContent = String(t); return x; } },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String,
    TextEncoder: TextEncoder, console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  const recorder = win.spirit.requireScript;
  // The files of the tree it loads as they are, by their paths, through the page's requireScript (goal/G49.6).
  const REAL = [SUBJECT, 'spirit/node/data.js', 'spirit/type/string/description/script.js', 'spirit/client/script.js'];
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(win.spirit, null, { window: win, real: REAL });
  const pageRequire = win.spirit.requireScript;
  win.spirit.requireScript = function (p) { return REAL.indexOf(String(p)) !== -1 ? pageRequire(p) : recorder(p); };
  w.stands = {
    'spirit/element/rowForm/script.js': win.spirit.zzRowForm,
    'spirit/element/fieldInput/script.js': { attach: function (input, rule) { w.attached.push({ input: input, rule: rule }); return input; } },
  };
  delete win.spirit.zzRowForm;
  vm.createContext(win);
  win.spirit.requireScript('spirit/type/string/description/script.js');
  // The page's one data set, its node known (goal/G41.28, Q10), as spirit.startPage leaves it before any element runs.
  win.spirit.requireScript('spirit/client/script.js');
  win.spirit.nodeFacts = { key: 'KEY+DESCRIPTION/NODE==' };
  win.spirit.required.spirit.data.homeNode(win.spirit.nodeFacts.key);
  if (fs.existsSync(FILE)) pageRequire(SUBJECT);
  // WHAT IT NEEDS, IT GETS ITSELF (goal/G43.24): no api is handed. The page's spirit object stands in: its escapeHtml, its
  // outcome as spirit.js has it, and the node family's setDescription, which records every call and answers as the node would
  // (its body, or a refusal thrown with its status and body).
  win.spirit.escapeHtml = function (s) { return String(s).replace(/</g, '&lt;'); };
  win.spirit.callOutcome = function (c) { return Promise.resolve(c).then(function (body) { return { status: 200, body: body }; }, function (e) { return { status: (e && e.status) || 0, body: (e && e.body) || null }; }); };
  w.nodeApi.setDescription = function (args) {
    w.calls.push({ name: 'node.setDescription', args: args });
    const a = answer('node.setDescription', args);
    return a && a.status === 200 ? Promise.resolve(a.body) : Promise.reject({ status: (a && a.status) || 0, body: a && a.body });
  };
  win.spirit.readyPromise = Promise.resolve(win.spirit);
  // goal/G43.32: it stands at its path.
  w.E = win.spirit.required.spirit.element; w.win = win;
  return w;
}
const stored = function (name, args) { return { status: 200, body: { ok: true, description: String(args.description).trim() } }; };

// What the tests make, shared by the tests after them.
let w, host, el, input, rf, save, said, inSpan, spanText, c, N, r, h2, i2, s2;
test.run('spirit/element/changeMyDescription/script.js exists', 0.2, function () {
  return (fs.existsSync(FILE)) ? true : false;
}, test.limit.quick);
test.run('it adds changeMyDescription.create to window.spirit.required', 0.2, function () {
  w = world(stored);
  return (!!w.E.changeMyDescription && typeof w.E.changeMyDescription.create === 'function') ? true : false;
}, test.limit.quick);
test.run('it loads fieldInput itself', 0.2, function () {
  return (w.required.indexOf('spirit/element/fieldInput/script.js') !== -1) ? true : false;
}, test.limit.quick);
test.run('its input is marked data-field="description"', 0.2, async function () {
  // the field, marked with its rule (rule/12)
  host = node('host');
  el = w.E.changeMyDescription.create(host);
  await settle();
  input = host.querySelector('[data-field="description"]');
  rf = w.forms[0];
  // Since goal/G41.27 its Save is the rowForm's button.
  save = rf ? rf.button : host.querySelector('[data-description="save"]');
  said = host.querySelector('[data-description="said"]');
  return (!!input) ? true : false;
}, test.limit.quick);
test.run('it loads the rowForm itself', 0.2, function () {
  // its form, a rowForm: ✏️ [Description-input] [Save] (goal/G41.27)
  // Andy, on G41.27: "changeMyDescription:\n\n[✏️][Description-input][Save]". The box: "spirit.element.spirit.element.rowForm.create(container, { icon, button }) -> { root, span, button }", "The mounter drops its form elements into span and wires the
  // button itself", and "a line saying what a press did (a refusal, a result) is the mounter's, below the bubble, not in it."
  return (w.required.indexOf('spirit/element/rowForm/script.js') !== -1) ? true : false;
}, test.limit.quick);
test.run('its form is one rowForm in its host, its icon ✏️ and its button Save', 0.2, function () {
  return (w.forms.length === 1 && rf.opts.icon === '✏️' && rf.opts.button === 'Save' && under(host).indexOf(rf.root) !== -1) ? true : false;
}, test.limit.quick);
test.run('its span holds the description input alone: no word beside it', 0.2, function () {
  inSpan = rf ? under(rf.span) : [];
  spanText = rf ? (String(rf.span.innerHTML).replace(/<[^>]*>/g, ' ') + ' ' + inSpan.map(function (k) { return k.textContent || ''; }).join(' ')).replace(/\s+/g, ' ').trim() : '';
  return (!!rf && inSpan.indexOf(input) !== -1 && spanText === '' && !inSpan.some(function (k) { return /^<button|^<select/.test(k.tag) || (/^<input/.test(k.tag) && k !== input); })) ? true : false;
}, test.limit.quick);
test.run('its Save is the rowForm\'s button, and it draws no Save of its own', 0.2, function () {
  return (!!rf && !host.querySelector('[data-description="save"]') && !/<button/.test(host.innerHTML)) ? true : false;
}, test.limit.quick);
test.run('its message stands below the bubble, not in it', 0.2, function () {
  return (!!rf && !!said && under(rf.root).indexOf(said) === -1) ? true : false;
}, test.limit.quick);
// goal/G41.27's box v8, Andy: "those fucking character counter OUTSIDE the fucking form ... they ALL have to go".
test.run('it has its Save and its message, and outside the form nothing but its message', 0.2, function () {
  const outside = under(host).filter(function (k) { return under(rf.root).indexOf(k) === -1 && k !== rf.root && /^<div/.test(k.tag) && k.getAttribute && k.getAttribute('data-description'); });
  return (!!save && !!said && outside.every(function (k) { return k.getAttribute('data-description') === 'said' || k.getAttribute('data-description') === 'form'; })) ? true : false;
}, test.limit.quick);
// Its type by path (goal/G48.4, the box: "a type identifier is ALWAYS spirit.type.*"): a description.
test.run('the input is held at its byte limit by fieldInput, the description type', 0.2, function () {
  return (w.attached.some(function (a) { return a.input === input && a.rule === 'spirit/type/string/description/script.js'; })) ? true : false;
}, test.limit.quick);
test.run('set puts the stored description it is handed in the field', 0.2, function () {
  // it shows what the node holds
  el.set('Andy');
  return (input.value === 'Andy') ? true : false;
}, test.limit.quick);
test.run('a description past its limit never reaches the wire, and the field says why', 0.2, async function () {
  // Save is refused while the rule says no, and says why
  input.value = 'x'.repeat(129);
  input.fire('input');
  save.fire('click');
  await settle();
  return (w.calls.length === 0 && said.textContent.length > 0) ? true : false;
}, test.limit.quick);
test.run('Save asks node.setDescription with the field as typed', 0.2, async function () {
  // Save asks the node, and the field shows what it stored (rule/19)
  input.value = '  Bob  ';
  input.fire('input');
  save.fire('click');
  await settle();
  c = w.calls[0];
  return (c && c.name === 'node.setDescription' && c.args.description === '  Bob  ') ? true : false;
}, test.limit.quick);
test.run('the field then shows the description the node stored', 0.2, function () {
  return (input.value === 'Bob') ? true : false;
}, test.limit.quick);
test.run('after the save it says saved', 0.2, function () {
  return (/saved/.test(said.textContent)) ? true : false;
}, test.limit.quick);
test.run('it requires spirit/node/api.js, and the description the node stored is kept in the card of the node branch\'s data', 0.2, function () {
  // what it changes, it listens for: the node card in the node family's cache (goal/G41.28)
  N = ((w.win.spirit.required.spirit.data || {}).node || {}).data;
  return (w.required.indexOf('spirit/node/api.js') !== -1 && !!N && !!N.card.get() && N.card.get().description === 'Bob') ? true : false;
}, test.limit.quick);
test.run('it requires no data script, as only an api.js requires its data.js', 0.2, function () {
  return !w.required.some(function (p) { return /data\.js$/.test(p); }) ? true : false;
}, test.limit.quick);
test.run('a description changed in the card, from elsewhere, redraws the field', 0.2, async function () {
  N.card.keep({ description: 'Eve' });
  await settle();
  return (input.value === 'Eve') ? true : false;
}, test.limit.quick);
test.run('Enter saves as Save does', 0.2, async function () {
  input.value = 'Carl';
  input.fire('keydown', { key: 'Enter', preventDefault: function () {} });
  await settle();
  return (w.calls.length === 2 && w.calls[1].args.description === 'Carl') ? true : false;
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
  r = world(function () { return { status: 200, body: { ok: false, error: 'refused here' } }; });
  // As on a page, where requireScript answers an element only once what it requires has answered (goal/G49.9): the world's
  // stand-ins answer first.
  await settle();
  h2 = node('host');
  r.E.changeMyDescription.create(h2);
  await settle();
  i2 = h2.querySelector('[data-field="description"]');
  s2 = r.forms[0] ? r.forms[0].button : h2.querySelector('[data-description="save"]');
  i2.value = 'Dana';
  i2.fire('input');
  s2.fire('click');
  await settle();
  return (/refused here/.test(h2.querySelector('[data-description="said"]').textContent) && i2.value === 'Dana') ? true : false;
}, test.limit.quick);
