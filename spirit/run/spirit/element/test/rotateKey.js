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

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
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

test.startTest('rotateKey.js: the rotate key dialog, an element');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  ok(!!SRC, 'spirit/element/rotateKey.js is there', 'there is no spirit/element/rotateKey.js');
  if (!SRC) return;

  test.subHeading('an element mounted the new shell\'s way (goal/G43.24, requirements 7 and 8)');
  const w = world(rotated);
  // goal/G43.32: it stands at its path.
  const at = ((w.win.spirit.element || {}).spirit || {}).element || {};
  const E = at.rotateKey;
  ok(!!E && typeof E.create === 'function', 'it sets spirit.element.spirit.element.rotateKey = { create }', 'elements: ' + short(Object.keys(at)));
  if (!E) return;
  ok(!/\bactivateApp\b|\bspirit\.shell\b|\bcallDialog\b|\bcloseDialog\b/.test(CODE), 'no spirit.shell.activateApp, no dialog of the old shell', 'rotateKey.js still mounts or closes the old shell\'s way');
  // Andy: "every fucking element gets the interfaces it needs": the node's own verb, through the spirit object, no api.verb.
  ok(!/\.verb\s*\(/.test(CODE) && /\bnode\.rotateCipher\b/.test(CODE), 'it asks the node through the spirit object, spirit.node.rotateCipher, no api.verb', 'rotateKey.js asks through an api, or not spirit.node.rotateCipher');
  ok(w.required.indexOf('spirit/element/armingButton.js') !== -1, 'it loads spirit/element/armingButton.js itself, through spirit.require (rule/26)', 'required: ' + short(w.required));

  test.subHeading('nothing hand-rolled: the are-you-sure is the arming button\'s (goal/G41.9)');
  ok(!/data-armed/.test(CODE), 'no data-armed of its own', 'its code still writes data-armed');
  ok(!/armUntilElsewhere/.test(CODE), 'it calls no armUntilElsewhere itself', 'its code still calls armUntilElsewhere');
  // Andy: "anybody can mount any element without knowing what it actually needs...." (goal/G43.24).
  ok(!/\bapi\b/.test(CODE), 'it takes no api and hands none on', 'its code still names an api');
  ok(!/\brkArmed\b/.test(CODE) && !/classList\.(add|remove|toggle)\(\s*['"]armed['"]/.test(CODE), 'no armed flag and no armed class of its own', 'its code still keeps an armed flag or class');

  const host = node('<div>');
  const made = E.create(host);
  await settle();
  ok(!!made && typeof made.destroy === 'function', 'create(container), its container alone, answers { destroy() }', 'create answered ' + short(made && Object.keys(made)));

  test.subHeading('its explanation first, as it is');
  const said = words(host);
  const missing = EXPLAINED.filter(function (l) { return said.indexOf(l) === -1; });
  ok(!missing.length, 'it says its title, when to use it, what it does, what it costs, what it does not do, and that it is a crisis measure', 'missing: ' + short(missing) + ' in ' + short(said));
  const b = w.button(host);
  ok(!!b, 'and then its button', 'no button: ' + short(host.innerHTML));
  if (!b) return;
  ok(said.indexOf(EXPLAINED[5]) !== -1 && said.indexOf(BUTTON) > said.indexOf(EXPLAINED[5]), 'the explanation stands before the button', 'said: ' + short(said));

  test.subHeading('its button, the shell\'s two-press armingButton');
  const a = w.attached.filter(function (x) { return x.button === b; }).pop();
  ok(!!a, 'its button is attached as an armingButton', 'attached: ' + w.attached.length);
  if (!a) return;
  ok(a.opts.label === BUTTON && a.opts.armedLabel === ARMED && b.textContent === BUTTON, 'it says ' + BUTTON + ', and armed ' + ARMED, 'label ' + short(a.opts.label) + ', armed ' + short(a.opts.armedLabel) + ', shows ' + short(b.textContent));
  ok(!('api' in a.opts), 'the arming button is handed no api: it hears a click elsewhere itself', 'handed: ' + short(Object.keys(a.opts)));
  ok(b.getAttribute('data-armed') === null && w.calls.length === 0, 'it starts disarmed, and nothing is rotated', 'armed ' + short(b.getAttribute('data-armed')) + ', calls ' + w.calls.length);
  b.fire('click', { preventDefault: function () {} }); await settle();
  ok(b.getAttribute('data-armed') === 'true' && b.textContent === ARMED && w.listening === 1, 'one press arms it: it says ' + ARMED + ' and listens for a click elsewhere', 'armed ' + short(b.getAttribute('data-armed')) + ', says ' + short(b.textContent) + ', listening ' + w.landed);
  ok(w.calls.length === 0, 'one press rotates nothing', 'one press asked node.rotateCipher ' + w.calls.length + ' times');
  b.disarm(); await settle();
  ok(b.textContent === BUTTON && b.getAttribute('data-armed') === null, 'disarmed (attention moved), it says ' + BUTTON + ' again', 'says ' + short(b.textContent));
  b.fire('click', { preventDefault: function () {} }); await settle();
  ok(w.calls.length === 0, 'and the next press only arms it again: two presses must be two presses in a row', 'asked ' + w.calls.length + ' times');

  test.subHeading('the second press: one rotateCipher, the result said');
  b.fire('click', { preventDefault: function () {} }); await settle();
  const rot = w.calls.filter(function (c) { return c.name === 'node.rotateCipher'; });
  ok(rot.length === 1 && rot[0].args && JSON.stringify(rot[0].args) === '{}', 'the second press asks spirit.node.rotateCipher({}) once', 'calls: ' + short(w.calls));
  const after = words(host);
  ok(/Rotated/.test(after) && after.indexOf('This node\'s card is now number 2, handed to 1 relay(s).') !== -1, 'it says what the node answered: Rotated, the card\'s number, and how many relays it went to', 'said: ' + short(after.slice(after.indexOf('crisis'))));
  ok(!w.button(host), 'rotated, its button is gone: nothing to press twice again in this visit', 'a button is still drawn');
  ok(EXPLAINED.every(function (l) { return after.indexOf(l) !== -1; }), 'and the explanation stays', 'the explanation went');

  test.subHeading('while the node has not answered, the button waits');
  const slow = world(function () { return { wait: true, body: { ok: true, at: 3, relays: 2 } }; });
  const h2 = node('<div>');
  slow.win.spirit.element.spirit.element.rotateKey.create(h2, {});
  await settle();
  const b2 = slow.button(h2);
  b2.fire('click', { preventDefault: function () {} }); b2.fire('click', { preventDefault: function () {} }); await settle();
  const busy = slow.button(h2);
  ok(slow.calls.length === 1 && !!busy && busy.disabled === true, 'asked, its button is drawn disabled until the answer lands', 'calls ' + slow.calls.length + ', button ' + (busy ? 'disabled ' + busy.disabled : 'gone'));
  if (busy) busy.fire('click', { preventDefault: function () {} });
  if (busy) busy.fire('click', { preventDefault: function () {} });
  await settle();
  if (slow.release) slow.release();
  await settle();
  ok(slow.calls.length === 1 && /number 3, handed to 2 relay/.test(words(h2)), 'and the answer, when it lands, is said', 'calls ' + slow.calls.length + ', said ' + short(words(h2).slice(-120)));

  test.subHeading('a refusal is said, and the button stays to try again');
  const no = world(function () { return { status: 403, body: { ok: false, code: 'owner-only', error: 'owner <only>' } }; });
  const h3 = node('<div>');
  no.win.spirit.element.spirit.element.rotateKey.create(h3, {});
  await settle();
  const b3 = no.button(h3);
  b3.fire('click', { preventDefault: function () {} }); b3.fire('click', { preventDefault: function () {} }); await settle();
  ok(no.calls.length === 1 && /owner &lt;only&gt;/.test(h3.innerHTML + under(h3).map(function (k) { return k.innerHTML; }).join('')) && !/Rotated/.test(words(h3)), 'the node\'s refusal is said, escaped, and nothing claims a rotation', 'said: ' + short(words(h3).slice(-120)));
  const again = no.button(h3);
  ok(!!again && !again.disabled && again.getAttribute('data-armed') === null && again.textContent === BUTTON, 'its button is back, disarmed', 'button: ' + short(again && { text: again.textContent, disabled: again.disabled }));
  const none = world(function () { return { status: 0, body: null }; });
  const h4 = node('<div>');
  none.win.spirit.element.spirit.element.rotateKey.create(h4, {});
  await settle();
  const b4 = none.button(h4);
  b4.fire('click', { preventDefault: function () {} }); b4.fire('click', { preventDefault: function () {} }); await settle();
  ok(/no answer/.test(words(h4)), 'a node that does not answer is said as no answer', 'said: ' + short(words(h4).slice(-80)));

  test.subHeading('every create starts disarmed and without an old result');
  const h5 = node('<div>');
  E.create(h5, {});
  await settle();
  const b5 = w.button(h5);
  ok(!!b5 && b5.getAttribute('data-armed') === null && !/Rotated/.test(words(h5)) && w.calls.length === 1, 'made again after a rotation, it shows its button, disarmed, and no result', 'button ' + !!b5 + ', said ' + short(words(h5).slice(-80)));

  test.subHeading('destroy');
  made.destroy();
  ok(host.innerHTML === '', 'destroy empties its container', 'left: ' + short(host.innerHTML));
  // The arming button not yet loaded (its require held), the file run again on that window: an element destroyed before
  // it lands attaches nothing.
  const late = world(rotated);
  let letGo = null;
  late.hold = new Promise(function (r) { letGo = r; });
  // goal/G43.32: installSpiritElement overwrites no element that stands; the run again takes the place of a fresh page's.
  delete late.win.spirit.element.spirit.element.rotateKey;
  vm.runInContext(SRC, late.win, { filename: FILE });
  const h6 = node('<div>');
  const m6 = late.win.spirit.element.spirit.element.rotateKey.create(h6, {});
  m6.destroy();
  letGo({}); await settle();
  ok(h6.innerHTML === '' && late.attached.length === 0, 'destroyed before its arming button loads, it draws and attaches nothing', 'left ' + short(h6.innerHTML) + ', attached ' + late.attached.length);
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
