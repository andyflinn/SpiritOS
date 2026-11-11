'use strict';

// spirit/run/spirit/element/test/rotateKey.js
// The tests of spirit/element/rotateKey.js, and of no other module (spec: ./rotateKey.md; goal/G43.24, requirement 8;
// cycle-10/R13; goal/G41.9). The browser file runs in node on a window of its own. The arming button is the real one
// (spirit/element/armingButton.js, tested in its own file), put on the page when the element requires it, so a press here
// is a press as the page has it. The node is the spirit object's node family, a stub that records every rotateCipher and
// answers as the node would (its body, or a refusal thrown with its status and body). How it opens over Info is judged in
// ./nodeInfo.js and, on a real page, in ./nodeInfoRotate.js.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'rotateKey.js');
const SRC = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : '';
const CODE = SRC.replace(/\/\/.*$/gm, '');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

// The explanation and the button "as they are" (the box, 8): the words of the dialog it was, read as the page reads them.
const EXPLAINED = [
  'Rotate this node\'s cipher key',
  'When to use it: you believe this node\'s cipher key has been copied or seen, for example because the box was broken into or a backup of its home went somewhere it should not.',
  'What it does: makes a new cipher key and throws the old one away. Your identity stays the same; only the key others seal to changes. The new card goes to every relay you are on at once, and peers pick it up the next time they post to you.',
  'What it costs: anything already sealed to the old key and still on its way cannot be opened. Peers who are offline catch up when they next post.',
  'What it does not do: protect what was sent before. Whoever holds the old key can still read anything they captured with it.',
  'It is a crisis measure, not a routine one.',
];
const BUTTON = 'Rotate the key';
const ARMED = 'Rotate the key: press again';

// A node whose markup makes a child per tag, a button keeping its own words; found by [attr] or [attr="value"].
function node(tag) {
  const heard = {}; let html = ''; const attrs = {};
  const n = { tag: tag || '', nodes: [], kids: [], textContent: '', value: '', style: {}, className: '', disabled: false,
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v); n.nodes = []; n.kids = [];
      const re = /<([a-z]+)\b([^>]*)>/gi; let m;
      while ((m = re.exec(html))) {
        const c = node(m[0]);
        if (/\sdisabled\b/.test(m[2])) c.disabled = true;
        if (m[1].toLowerCase() === 'button') {
          const end = html.indexOf('</button>', re.lastIndex);
          c.textContent = end === -1 ? '' : html.slice(re.lastIndex, end).replace(/<[^>]*>/g, '');
        }
        n.nodes.push(c);
      }
    },
    setAttribute: function (k, v) { attrs[k] = String(v); },
    removeAttribute: function (k) { delete attrs[k]; },
    getAttribute: function (k) { if (k in attrs) return attrs[k]; const m = new RegExp('\\s' + k + '(?:="([^"]*)")?(?=[\\s>/])').exec(n.tag); return m ? (m[1] === undefined ? '' : m[1]) : null; },
    querySelector: function (sel) {
      const a = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(sel);
      if (!a) return null;
      return under(n).filter(function (c) { const v = c.getAttribute(a[1]); return a[2] === undefined ? v !== null : v === a[2]; })[0] || null;
    },
    appendChild: function (c) { n.kids.push(c); c.parentNode = n; return c; },
    addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
    // A disabled button is not clicked, as a browser has it.
    fire: function (t, e) { if (t === 'click' && n.disabled) return; (heard[t] || []).slice().forEach(function (fn) { fn(e || {}); }); },
  };
  return n;
}
function under(n) { const out = []; (function walk(x) { x.nodes.concat(x.kids).forEach(function (c) { out.push(c); walk(c); }); }(n)); return out; }
// What the dialog says, as words: its markup with the tags out.
function words(host) { return under(host).map(function (k) { return k.innerHTML; }).join(' ').replace(/<[^>]*>/g, ' ').replace(/&#39;/g, '\'').replace(/\s+/g, ' '); }

// The world: a bare window (rule/26), the arming button put on the page only once the element requires it; the spirit
// object's escapeHtml and outcome as spirit.js has them, and its node family's rotateCipher, which records every call.
function world(answer) {
  const w = { required: [], calls: [], listening: 0, attached: [], release: null };
  const win = {
    // The document's click listeners counted: an armed arming button listens there for a click elsewhere itself (goal/G43.24).
    document: { createElement: function (t) { return node('<' + t + '>'); },
      addEventListener: function (t) { if (t === 'click') w.listening += 1; }, removeEventListener: function (t) { if (t === 'click') w.listening -= 1; } },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String,
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  vm.createContext(win);
  win.spirit = {
    require: function (p) {
      w.required.push(String(p));
      if (p === 'spirit/element/armingButton.js') {
        vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'element', 'armingButton.js'), 'utf8'), win, { filename: 'armingButton.js' });
        // Every attach recorded, so what the button was handed is judged; the real attach does the arming.
        // goal/G43.32: it places itself at its path, spirit.element.spirit.element.armingButton.
        const real = win.spirit.element.spirit.element.armingButton.attach;
        win.spirit.element.spirit.element.armingButton.attach = function (b, o) { w.attached.push({ button: b, opts: o || {} }); return real(b, o); };
      }
      return w.hold ? w.hold : Promise.resolve({});
    },
    escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
    // The node family through spirit.ready, as the page reaches every family (goal/G43.27, Q1: no api at load).
    get ready() { return Promise.resolve(win.spirit); },
    outcome: function (c) { return Promise.resolve(c).then(function (body) { return { status: 200, body: body }; }, function (e) { return { status: (e && e.status) || 0, body: (e && e.body) || null }; }); },
    node: {
      rotateCipher: function (args) {
        w.calls.push({ name: 'node.rotateCipher', args: args });
        const a = answer(args);
        if (a && a.wait) return new Promise(function (r) { w.release = function () { r(a.body); }; });
        return a && a.status === 200 ? Promise.resolve(a.body) : Promise.reject({ status: (a && a.status) || 0, body: a && a.body });
      },
    },
  };
  // goal/G43.32: every element places itself by installSpiritElement; the recorder hands that helper to the page stand-in
  // (spirit/test/headLessChrome.js pageSpirit), at once, held or not.
  const recorder = win.spirit.require;
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(win.spirit);
  const pageRequire = win.spirit.require;
  win.spirit.require = function (p) { return /installSpiritElement\.js$/.test(p) ? pageRequire(p) : recorder(p); };
  if (SRC) vm.runInContext(SRC, win, { filename: FILE });
  w.win = win;
  w.button = function (host) { return host.querySelector('[data-rotate]'); };
  return w;
}
const rotated = function () { return { status: 200, body: { ok: true, at: 2, relays: 1 } }; };

// What the tests make, shared by the tests after them.
let w, at, E, host, made, said, missing, b, a, rot, after, slow, h2, b2, busy, no, h3, b3, again, none, h4, b4, h5,
  b5, late, letGo, h6, m6;
test.run('spirit/element/rotateKey.js is there', 0.2, function () {
  return (!!SRC) ? true : 'there is no spirit/element/rotateKey.js';
}, test.limit.quick);
test.run('it sets spirit.element.spirit.element.rotateKey = { create }', 0.2, function () {
  // an element mounted the new shell's way (goal/G43.24, requirements 7 and 8)
  w = world(rotated);
  // goal/G43.32: it stands at its path.
  at = ((w.win.spirit.element || {}).spirit || {}).element || {};
  E = at.rotateKey;
  return (!!E && typeof E.create === 'function') ? true : 'elements: ' + short(Object.keys(at));
}, test.limit.quick);
test.run('no spirit.shell.activateApp, no dialog of the old shell', 0.2, function () {
  return (!/\bactivateApp\b|\bspirit\.shell\b|\bcallDialog\b|\bcloseDialog\b/.test(CODE)) ? true : 'rotateKey.js still mounts or closes the old shell\'s way';
}, test.limit.quick);
test.run('it asks the node through the spirit object, spirit.node.rotateCipher, no api.verb', 0.2, function () {
  // Andy: "every fucking element gets the interfaces it needs": the node's own verb, through the spirit object, no api.verb.
  return (!/\.verb\s*\(/.test(CODE) && /\bnode\.rotateCipher\b/.test(CODE)) ? true : 'rotateKey.js asks through an api, or not spirit.node.rotateCipher';
}, test.limit.quick);
test.run('it loads spirit/element/armingButton.js itself, through spirit.require (rule/26)', 0.2, function () {
  return (w.required.indexOf('spirit/element/armingButton.js') !== -1) ? true : 'required: ' + short(w.required);
}, test.limit.quick);
test.run('no data-armed of its own', 0.2, function () {
  // nothing hand-rolled: the are-you-sure is the arming button's (goal/G41.9)
  return (!/data-armed/.test(CODE)) ? true : 'its code still writes data-armed';
}, test.limit.quick);
test.run('it calls no armUntilElsewhere itself', 0.2, function () {
  return (!/armUntilElsewhere/.test(CODE)) ? true : 'its code still calls armUntilElsewhere';
}, test.limit.quick);
test.run('it takes no api and hands none on', 0.2, function () {
  // Andy: "anybody can mount any element without knowing what it actually needs...." (goal/G43.24).
  return (!/\bapi\b/.test(CODE)) ? true : 'its code still names an api';
}, test.limit.quick);
test.run('no armed flag and no armed class of its own', 0.2, function () {
  return (!/\brkArmed\b/.test(CODE) && !/classList\.(add|remove|toggle)\(\s*['"]armed['"]/.test(CODE)) ? true : 'its code still keeps an armed flag or class';
}, test.limit.quick);
test.run('create(container), its container alone, answers { destroy() }', 0.2, async function () {
  host = node('<div>');
  made = E.create(host);
  await settle();
  return (!!made && typeof made.destroy === 'function') ? true : 'create answered ' + short(made && Object.keys(made));
}, test.limit.quick);
test.run('it says its title, when to use it, what it does, what it costs, what it does not do, and that it is a crisis measure', 0.2, function () {
  // its explanation first, as it is
  said = words(host);
  missing = EXPLAINED.filter(function (l) { return said.indexOf(l) === -1; });
  return (!missing.length) ? true : 'missing: ' + short(missing) + ' in ' + short(said);
}, test.limit.quick);
test.run('and then its button', 0.2, function () {
  b = w.button(host);
  return (!!b) ? true : 'no button: ' + short(host.innerHTML);
}, test.limit.quick);
test.run('the explanation stands before the button', 0.2, function () {
  return (said.indexOf(EXPLAINED[5]) !== -1 && said.indexOf(BUTTON) > said.indexOf(EXPLAINED[5])) ? true : 'said: ' + short(said);
}, test.limit.quick);
test.run('its button is attached as an armingButton', 0.2, function () {
  // its button, the shell's two-press armingButton
  a = w.attached.filter(function (x) { return x.button === b; }).pop();
  return (!!a) ? true : 'attached: ' + w.attached.length;
}, test.limit.quick);
test.run('it says Rotate the key, and armed Rotate the key: press again', 0.2, function () {
  return (a.opts.label === BUTTON && a.opts.armedLabel === ARMED && b.textContent === BUTTON) ? true : 'label ' + short(a.opts.label) + ', armed ' + short(a.opts.armedLabel) + ', shows ' + short(b.textContent);
}, test.limit.quick);
test.run('the arming button is handed no api: it hears a click elsewhere itself', 0.2, function () {
  return (!('api' in a.opts)) ? true : 'handed: ' + short(Object.keys(a.opts));
}, test.limit.quick);
test.run('it starts disarmed, and nothing is rotated', 0.2, function () {
  return (b.getAttribute('data-armed') === null && w.calls.length === 0) ? true : 'armed ' + short(b.getAttribute('data-armed')) + ', calls ' + w.calls.length;
}, test.limit.quick);
test.run('one press arms it: it says Rotate the key: press again, and listens for a click elsewhere', 0.2, async function () {
  b.fire('click', { preventDefault: function () {} });
  await settle();
  return (b.getAttribute('data-armed') === 'true' && b.textContent === ARMED && w.listening === 1) ? true : 'armed ' + short(b.getAttribute('data-armed')) + ', says ' + short(b.textContent) + ', listening ' + w.landed;
}, test.limit.quick);
test.run('one press rotates nothing', 0.2, function () {
  return (w.calls.length === 0) ? true : 'one press asked node.rotateCipher ' + w.calls.length + ' times';
}, test.limit.quick);
test.run('disarmed (attention moved), it says Rotate the key again', 0.2, async function () {
  b.disarm();
  await settle();
  return (b.textContent === BUTTON && b.getAttribute('data-armed') === null) ? true : 'says ' + short(b.textContent);
}, test.limit.quick);
test.run('and the next press only arms it again: two presses must be two presses in a row', 0.2, async function () {
  b.fire('click', { preventDefault: function () {} });
  await settle();
  return (w.calls.length === 0) ? true : 'asked ' + w.calls.length + ' times';
}, test.limit.quick);
test.run('the second press asks spirit.node.rotateCipher({}) once', 0.2, async function () {
  // the second press: one rotateCipher, the result said
  b.fire('click', { preventDefault: function () {} });
  await settle();
  rot = w.calls.filter(function (c) { return c.name === 'node.rotateCipher'; });
  return (rot.length === 1 && rot[0].args && JSON.stringify(rot[0].args) === '{}') ? true : 'calls: ' + short(w.calls);
}, test.limit.quick);
test.run('it says what the node answered: Rotated, the card\'s number, and how many relays it went to', 0.2, function () {
  after = words(host);
  return (/Rotated/.test(after) && after.indexOf('This node\'s card is now number 2, handed to 1 relay(s).') !== -1) ? true : 'said: ' + short(after.slice(after.indexOf('crisis')));
}, test.limit.quick);
test.run('rotated, its button is gone: nothing to press twice again in this visit', 0.2, function () {
  return (!w.button(host)) ? true : 'a button is still drawn';
}, test.limit.quick);
test.run('and the explanation stays', 0.2, function () {
  return (EXPLAINED.every(function (l) { return after.indexOf(l) !== -1; })) ? true : 'the explanation went';
}, test.limit.quick);
test.run('asked, its button is drawn disabled until the answer lands', 0.2, async function () {
  // while the node has not answered, the button waits
  slow = world(function () { return { wait: true, body: { ok: true, at: 3, relays: 2 } }; });
  h2 = node('<div>');
  slow.win.spirit.element.spirit.element.rotateKey.create(h2, {});
  await settle();
  b2 = slow.button(h2);
  b2.fire('click', { preventDefault: function () {} });
  b2.fire('click', { preventDefault: function () {} });
  await settle();
  busy = slow.button(h2);
  return (slow.calls.length === 1 && !!busy && busy.disabled === true) ? true : 'calls ' + slow.calls.length + ', button ' + (busy ? 'disabled ' + busy.disabled : 'gone');
}, test.limit.quick);
test.run('and the answer, when it lands, is said', 0.2, async function () {
  if (busy) busy.fire('click', { preventDefault: function () {} });
  if (busy) busy.fire('click', { preventDefault: function () {} });
  await settle();
  if (slow.release) slow.release();
  await settle();
  return (slow.calls.length === 1 && /number 3, handed to 2 relay/.test(words(h2))) ? true : 'calls ' + slow.calls.length + ', said ' + short(words(h2).slice(-120));
}, test.limit.quick);
test.run('the node\'s refusal is said, escaped, and nothing claims a rotation', 0.2, async function () {
  // a refusal is said, and the button stays to try again
  no = world(function () { return { status: 403, body: { ok: false, code: 'owner-only', error: 'owner <only>' } }; });
  h3 = node('<div>');
  no.win.spirit.element.spirit.element.rotateKey.create(h3, {});
  await settle();
  b3 = no.button(h3);
  b3.fire('click', { preventDefault: function () {} });
  b3.fire('click', { preventDefault: function () {} });
  await settle();
  return (no.calls.length === 1 && /owner &lt;only&gt;/.test(h3.innerHTML + under(h3).map(function (k) { return k.innerHTML; }).join('')) && !/Rotated/.test(words(h3))) ? true : 'said: ' + short(words(h3).slice(-120));
}, test.limit.quick);
test.run('its button is back, disarmed', 0.2, function () {
  again = no.button(h3);
  return (!!again && !again.disabled && again.getAttribute('data-armed') === null && again.textContent === BUTTON) ? true : 'button: ' + short(again && { text: again.textContent, disabled: again.disabled });
}, test.limit.quick);
test.run('a node that does not answer is said as no answer', 0.2, async function () {
  none = world(function () { return { status: 0, body: null }; });
  h4 = node('<div>');
  none.win.spirit.element.spirit.element.rotateKey.create(h4, {});
  await settle();
  b4 = none.button(h4);
  b4.fire('click', { preventDefault: function () {} });
  b4.fire('click', { preventDefault: function () {} });
  await settle();
  return (/no answer/.test(words(h4))) ? true : 'said: ' + short(words(h4).slice(-80));
}, test.limit.quick);
test.run('made again after a rotation, it shows its button, disarmed, and no result', 0.2, async function () {
  // every create starts disarmed and without an old result
  h5 = node('<div>');
  E.create(h5, {});
  await settle();
  b5 = w.button(h5);
  return (!!b5 && b5.getAttribute('data-armed') === null && !/Rotated/.test(words(h5)) && w.calls.length === 1) ? true : 'button ' + !!b5 + ', said ' + short(words(h5).slice(-80));
}, test.limit.quick);
test.run('destroy empties its container', 0.2, function () {
  // destroy
  made.destroy();
  return (host.innerHTML === '') ? true : 'left: ' + short(host.innerHTML);
}, test.limit.quick);
test.run('destroyed before its arming button loads, it draws and attaches nothing', 0.2, async function () {
  // The arming button not yet loaded (its require held), the file run again on that window: an element destroyed before
  // it lands attaches nothing.
  late = world(rotated);
  letGo = null;
  late.hold = new Promise(function (r) { letGo = r; });
  // goal/G43.32: installSpiritElement overwrites no element that stands; the run again takes the place of a fresh page's.
  delete late.win.spirit.element.spirit.element.rotateKey;
  vm.runInContext(SRC, late.win, { filename: FILE });
  h6 = node('<div>');
  m6 = late.win.spirit.element.spirit.element.rotateKey.create(h6, {});
  m6.destroy();
  letGo({});
  await settle();
  return (h6.innerHTML === '' && late.attached.length === 0) ? true : 'left ' + short(h6.innerHTML) + ', attached ' + late.attached.length;
}, test.limit.quick);
