'use strict';

// spirit/run/spirit/element/test/nodeInfoForms.js
// INFO'S TWO RELAY FORMS (goal/G43.27, requirements 9 and 10; spec: ./nodeInfoForms.md). Andy: "setting a star on a relay is
// what makes the face-form appear in \"info\", the email form must always show in \"info\"". nodeInfo.js runs in node on a
// bare window with the REAL joinForm.js and faceForm.js (what each shows is theirs to decide), the rowForm a stand-in. The
// node is the spirit object's node and relay families, stubs answering relay.status' rows as the node would. No node, no port.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const EL = path.join(RUN, 'spirit', 'element');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 40; i++) await new Promise(function (r) { setImmediate(r); }); };

// A node whose markup makes a child per tag; found by [attr="value"] or .class, anywhere below it.
function node(tag) {
  const heard = {}; let html = '';
  const n = { tag: tag || '', nodes: [], kids: [], value: '', defaultValue: '', className: '', textContent: '', hidden: false, style: {}, isConnected: true,
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v); n.nodes = []; n.kids = [];
      const re = /<([a-z]+)\b([^>]*)>/gi; let m;
      while ((m = re.exec(html))) n.nodes.push(node(m[0]));
    },
    getAttribute: function (k) { const m = new RegExp('\\s' + k + '="([^"]*)"').exec(n.tag); return m ? m[1] : null; },
    querySelector: function (sel) {
      const a = /^\[([\w-]+)="([^"]*)"\]$/.exec(sel);
      const c = /^\.([\w-]+)$/.exec(sel);
      const all = under(n);
      if (a) return all.filter(function (x) { return x.getAttribute(a[1]) === a[2]; })[0] || null;
      if (c) return all.filter(function (x) { return (' ' + (x.getAttribute('class') || x.className || '') + ' ').indexOf(' ' + c[1] + ' ') !== -1; })[0] || null;
      return null;
    },
    appendChild: function (k) { n.kids.push(k); k.parentNode = n; return k; },
    addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
    fire: function (t, e) { (heard[t] || []).slice().forEach(function (fn) { fn(e || {}); }); },
  };
  return n;
}
function under(n) { const out = []; (function walk(x) { x.nodes.concat(x.kids).forEach(function (c) { out.push(c); walk(c); }); }(n)); return out; }

const CARD = { ok: true, name: 'Andy', description: 'a node', key: 'NODEKEY+INFO==' };
// A seat on A (claimed, its relay known), one on O (owned), and B merely listed (no seat).
function rows(starred) {
  return [
    { url: 'https://a.example', label: 'A', relay: true, claimed: true, mine: starred === 'A', roll: { relayKey: 'RELAYKEY+A==' } },
    { url: 'https://o.example', label: 'O', relay: true, owned: true, mine: false, roll: { relayKey: 'RELAYKEY+O==' } },
    { url: 'https://b.example', label: 'B', relay: true, claimed: false, mine: false, roll: { relayKey: 'RELAYKEY+B==' } },
  ];
}

async function info(relayRows) {
  const win = {
    document: { createElement: function (t) { return node('<' + t + '>'); } },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String,
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), win, { filename: 'data.js' });
  const S = win.spirit;
  S.element = {};
  S.elements = {};
  const field = { create: function () { return { destroy: function () {} }; } };
  S.element.changeMyLabel = field; S.element.changeMyDescription = field;
  S.element.rowForm = { create: function (c, x) {
    const f = { opts: x || {}, root: node('<div>'), span: node('<span>'), button: node('<button>') };
    f.root.appendChild(f.span); f.root.appendChild(f.button);
    if (c && typeof c.appendChild === 'function') c.appendChild(f.root);
    return f;
  } };
  S.node = { key: 'NODEKEY+INFO==', card: function () { return Promise.resolve(CARD); } };
  S.data.homeNode(S.node.key);
  // As the relay family's status answers (spirit/relay/api.js, status): { status, text, body: { rows, ... } }.
  S.relay = { status: function () {
    const body = { name: '', rows: relayRows.slice(), ownedUrls: [], claimedUrls: [], mustPick: false, relayStatus: {}, more: false };
    return Promise.resolve({ status: 200, text: JSON.stringify(body), body: body });
  } };
  S.ready = Promise.resolve(S);
  S.escapeHtml = function (s) { return String(s).replace(/</g, '&lt;'); };
  S.outcome = function (c) { return Promise.resolve(c).then(function (body) { return { status: 200, body: body }; }, function (e) { return { status: (e && e.status) || 0, body: (e && e.body) || null }; }); };
  // The two forms are the real files, run on this window as a page runs them; every other part a stand-in.
  const real = { 'spirit/element/joinForm.js': 1, 'spirit/element/faceForm.js': 1 };
  S.require = function (p) {
    if (real[p]) { vm.runInContext(fs.readFileSync(path.join(RUN, p), 'utf8'), win, { filename: p }); delete real[p]; }
    if (p === 'spirit/element/panel.js') S.elements.panel = { create: function () { return { open: function () { return Promise.resolve({}); }, destroy: function () {} }; } };
    if (p === 'spirit/element/rotateKey.js') S.elements.rotateKey = { create: function () { return { destroy: function () {} }; } };
    return Promise.resolve({});
  };
  S.cacheManager = function (name) {
    if (!(S.data[name] && S.data[name].data)) vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', String(name), 'data.js'), 'utf8'), win, { filename: name + '/data.js' });
    return Promise.resolve(true);
  };
  vm.runInContext(fs.readFileSync(path.join(EL, 'nodeInfo.js'), 'utf8'), win, { filename: 'nodeInfo.js' });
  const host = node('<div>');
  const made = S.elements.nodeInfo && typeof S.elements.nodeInfo.create === 'function' ? S.elements.nodeInfo.create(host, {}) : null;
  await settle();
  const slot = function (name) { return host.querySelector('[data-info="' + name + '"]'); };
  const shows = function (box, cls) { return !!box && box.style.display !== 'none' && !box.hidden && !!box.querySelector(cls); };
  return { made: made, email: slot('email'), face: slot('face'), shows: shows, S: S };
}

test.startTest('nodeInfoForms.js: Info shows the email form always, the face form only for a starred relay (goal/G43.27, 9 and 10)');

(async function () {
  test.subHeading('the world');
  const plain = await info(rows(''));
  ok(!!plain.made && !!plain.email && !!plain.face, 'the world: Info is made, with its email and face slots', 'Info made ' + !!plain.made + ', email slot ' + !!plain.email + ', face slot ' + !!plain.face + ': nothing judged');
  ok(!!plain.S.element.joinForm && !!plain.S.element.faceForm, 'the world: the real joinForm.js and faceForm.js ran on the page', 'joinForm ' + !!plain.S.element.joinForm + ', faceForm ' + !!plain.S.element.faceForm);

  test.subHeading('9. the email form always');
  ok(plain.shows(plain.email, '.sp-join-email'), 'seats on A and O, none starred: the email form shows', 'no email form: ' + short(plain.email && plain.email.innerHTML));
  const starred = await info(rows('A'));
  ok(starred.shows(starred.email, '.sp-join-email'), 'A starred: the email form shows', 'no email form: ' + short(starred.email && starred.email.innerHTML));
  const unseated = await info(rows('').map(function (r) { return Object.assign({}, r, { claimed: false, owned: false }); }));
  ok(unseated.shows(unseated.email, '.sp-join-email'), 'no seat on any relay: the email form still shows', 'no email form with no seat: ' + short(unseated.email && unseated.email.innerHTML));

  test.subHeading('10. the face form only for a starred relay');
  ok(!plain.shows(plain.face, '.sp-face-name'), 'no relay starred: no face form', 'a face form shows with no relay starred: ' + short(plain.face && plain.face.innerHTML));
  ok(starred.shows(starred.face, '.sp-face-name'), 'A starred: the face form shows', 'A starred, no face form: ' + short(starred.face && starred.face.innerHTML));
  const drawn = starred.face ? [starred.face].concat(under(starred.face)).map(function (k) { return k.innerHTML; }).join(' ') : '';
  const opts = (drawn.match(/<option value="([^"]*)"/g) || []).map(function (o) { return o.replace(/^<option value="|"$/g, ''); });
  ok(opts.length === 1 && opts[0] === 'https://a.example', 'it offers the starred relay alone', 'it offers ' + short(opts));

  test.reportSuccessFailureCount();
  process.exit(0);
})();
