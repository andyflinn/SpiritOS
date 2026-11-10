'use strict';

// spirit/run/spirit/app/starter/test/starter.js
// The tests of spirit/app/starter/starter.js, and of no other module (spec: ./starter.md; goal/G43.27). The browser file
// runs in node on a bare window: the node's family is a stand-in that answers node.card, and spirit.outcome wraps an
// answer as spirit.js's does ({status, body}).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
// spirit/app/starter/test/ -> the run root, four up.
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'starter.js');
const SRC = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : '';
const MANIFEST = path.join(__dirname, '..', 'starter.json');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

function node(tag) {
  let html = '';
  const n = { tag: tag || '', kids: [], className: '', own: '',
    get textContent() { return n.own + n.kids.map(function (k) { return k.textContent; }).join(''); },
    set textContent(v) { n.own = String(v); n.kids = []; },
    get innerHTML() { return html; },
    set innerHTML(v) { html = String(v); n.kids = []; n.own = ''; },
    appendChild: function (c) { n.kids.push(c); return c; },
  };
  return n;
}

// A world: card is what node.card answers (a body), or an Error for a refusal; hold delays the answer.
function world(card, hold) {
  const w = { asked: [], required: [] };
  const win = {
    document: { createElement: function (t) { return node('<' + t + '>'); } },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String,
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  vm.createContext(win);
  const family = { card: function (args) {
    w.asked.push({ verb: 'node.card', args: args });
    const answer = card instanceof Error ? Promise.reject(card) : Promise.resolve(card);
    return hold ? hold.then(function () { return answer; }) : answer;
  } };
  win.spirit = {
    ready: Promise.resolve({ node: family }),
    outcome: function (c) {
      return Promise.resolve(c).then(function (body) { return { status: 200, body: body }; },
        function (e) { return { status: 500, body: { ok: false, error: e.message } }; });
    },
    require: function (p) { w.required.push(String(p)); return Promise.resolve({}); },
  };
  if (SRC) vm.runInContext(SRC, win, { filename: FILE });
  w.win = win;
  return w;
}

test.startTest('starter.js: the smallest app, one element that shows its node');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  test.subHeading('1. one element');
  const w = world({ name: 'probe-node', description: 'a node for the test' });
  const E = (w.win.spirit.elements || {}).starter;
  ok(!!E && typeof E.create === 'function', 'spirit.elements.starter.create is there', 'no spirit.elements.starter.create: ' + short(E && Object.keys(E)));
  if (!E) { test.reportSuccessFailureCount(); return; }
  const box = node('<div>');
  const made = E.create(box, {});
  ok(!!made && typeof made.destroy === 'function', 'create answers { destroy }', 'create answered ' + short(made));

  test.subHeading('2. it asks its node once');
  await settle();
  ok(w.asked.length === 1 && w.asked[0].verb === 'node.card', 'it asks node.card once', 'it asked ' + short(w.asked));
  ok(w.required.length === 0, 'it requires nothing', 'it required ' + short(w.required));

  test.subHeading('3. it shows what the card says');
  const text = box.textContent;
  ok(/node: probe-node/.test(text), 'the node\'s name is drawn', 'no name in ' + short(text));
  ok(/description: a node for the test/.test(text), 'its description is drawn', 'no description in ' + short(text));

  test.subHeading('4. a refusal is said');
  const r = world(new Error('no such verb'));
  const rbox = node('<div>');
  r.win.spirit.elements.starter.create(rbox, {});
  await settle();
  ok(/refused: no such verb/.test(rbox.textContent), 'a refused card draws a refused row with its error', 'a refusal drew ' + short(rbox.textContent));

  test.subHeading('5. destroy empties its container');
  made.destroy();
  ok(box.innerHTML === '' && box.kids.length === 0, 'destroy leaves the container empty', 'after destroy: ' + short(box.textContent));
  let release = null;
  const late = world({ name: 'late', description: 'late' }, new Promise(function (r2) { release = r2; }));
  const lbox = node('<div>');
  late.win.spirit.elements.starter.create(lbox, {}).destroy();
  release();
  await settle();
  ok(!/late/.test(lbox.textContent), 'an answer after destroy draws nothing', 'a late answer drew ' + short(lbox.textContent));

  test.subHeading('6. its starter.json is the app shape');
  let m = null;
  try { m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (e) { m = null; }
  const i = (m && m.identity) || {};
  ok(i.label === 'Starter' && i.intrinsic === false, 'identity: label Starter, not intrinsic', 'identity: ' + short(i));
  ok(!!(m && m.mount && m.mount['starter.js'] === true), 'mount names starter.js', 'mount: ' + short(m && m.mount));
  ok(!!(m && m.shell && m.shell.mount === true && m.shell.tile === true), 'a shell mount and a tile', 'shell: ' + short(m && m.shell));
  ok(!!(m && m.node && m.node.mount === false), 'no node mount: the node starts nothing for it', 'node: ' + short(m && m.node));

  test.reportSuccessFailureCount();
})();
