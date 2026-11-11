'use strict';

// spirit/run/spirit/element/search/contact/test/detailElement.js
// The tests of spirit/element/search/contact/detailElement.js, and of no other module (spec: ./detailElement.md;
// goal/G41.9). The browser file runs in node on a window of its own, on a small DOM (markup parsed into a tree,
// selectors, clicks that bubble); the navigation, the node behind the page's api, the relay family and the armingButton
// element are recorders. After it, the parts once files of their own: relayPart (a relay's details, what relayPanel.js
// drew, on the same small DOM) and relayRowStreamPart (who paints, listens: a real scratch node and relay, and a real
// Chrome). The one test file of contact/detailElement.js.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'detailElement.js');
const SRC = fs.readFileSync(FILE, 'utf8');

const { scratchNode, scratchFaceRelay, chromePage, findChrome, sleep, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () {
  for (let i = 0; i < 30; i++) await new Promise(function (r) { setImmediate(r); });
  await new Promise(function (r) { setTimeout(r, 5); });
};

// ── A SMALL DOM ─────────────────────────────────────────────────────────────────────────────────────────────────────────
function makeDom() {
  const VOID = { input: 1, br: 1, img: 1, hr: 1, meta: 1, link: 1 };
  const decode = function (s) { return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, '&'); };
  const esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  const attrEsc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;'); };
  let root = null;
  function text(t) { return { nodeType: 3, data: t, parentNode: null }; }
  function compound(sel) {
    const c = { tag: '', id: '', cls: [], attrs: [] };
    const re = /([a-zA-Z][\w-]*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/g; let m;
    while ((m = re.exec(sel))) {
      if (m[1]) c.tag = m[1].toUpperCase(); else if (m[2]) c.id = m[2]; else if (m[3]) c.cls.push(m[3]);
      else c.attrs.push({ k: m[4], v: m[5] !== undefined ? m[5] : m[6] !== undefined ? m[6] : m[7] });
    }
    return c;
  }
  function matchOne(el, c) {
    if (!el || el.nodeType !== 1) return false;
    if (c.tag && el.tagName !== c.tag) return false;
    if (c.id && el.getAttribute('id') !== c.id) return false;
    const cls = (el.getAttribute('class') || '').split(/\s+/);
    if (c.cls.some(function (k) { return cls.indexOf(k) === -1; })) return false;
    return c.attrs.every(function (a) { return el.hasAttribute(a.k) && (a.v === undefined || el.getAttribute(a.k) === a.v); });
  }
  function matches(el, sel) {
    return String(sel).split(',').some(function (one) {
      const parts = one.trim().split(/\s+/).map(compound);
      if (!matchOne(el, parts[parts.length - 1])) return false;
      let i = parts.length - 2; let up = el.parentNode;
      while (i >= 0 && up) { if (matchOne(up, parts[i])) i--; up = up.parentNode; }
      return i < 0;
    });
  }
  function all(el, sel, out) { el.childNodes.forEach(function (c) { if (c.nodeType === 1) { if (matches(c, sel)) out.push(c); all(c, sel, out); } }); return out; }
  function parse(parent, html) {
    const re = /<!--[\s\S]*?-->|<(\/)?([a-zA-Z][\w-]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/)?>|([^<]+)/g;
    const stack = [parent]; let m;
    while ((m = re.exec(html))) {
      const top = stack[stack.length - 1];
      if (m[5] !== undefined) { top.appendChild(text(decode(m[5]))); continue; }
      if (!m[2]) continue;
      const tag = m[2].toLowerCase();
      if (m[1]) { for (let i = stack.length - 1; i > 0; i--) { if (stack[i].tagName === tag.toUpperCase()) { stack.length = i; break; } } continue; }
      const el = element(tag);
      const are = /([^\s=>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g; let a;
      while ((a = are.exec(m[3] || ''))) el.setAttribute(a[1], decode(a[2] !== undefined ? a[2] : a[3] !== undefined ? a[3] : a[4] !== undefined ? a[4] : ''));
      if (tag === 'input') el.value = el.getAttribute('value') || '';
      top.appendChild(el);
      if (!VOID[tag] && !m[4]) stack.push(el);
    }
  }
  function serialize(n) {
    if (n.nodeType === 3) return esc(n.data);
    const attrs = Object.keys(n.attrs).map(function (k) { return ' ' + k + '="' + attrEsc(n.attrs[k]) + '"'; }).join('');
    const tag = n.tagName.toLowerCase();
    return '<' + tag + attrs + '>' + (VOID[tag] ? '' : n.childNodes.map(serialize).join('') + '</' + tag + '>');
  }
  function element(tag) {
    const listeners = {};
    const el = {
      nodeType: 1, tagName: String(tag).toUpperCase(), attrs: {}, childNodes: [], parentNode: null, style: {},
      disabled: false, hidden: false, value: '',
      get children() { return el.childNodes.filter(function (c) { return c.nodeType === 1; }); },
      get id() { return el.getAttribute('id') || ''; }, set id(v) { el.setAttribute('id', v); },
      get className() { return el.getAttribute('class') || ''; }, set className(v) { el.setAttribute('class', v); },
      get type() { return el.getAttribute('type') || ''; }, set type(v) { el.setAttribute('type', v); },
      get title() { return el.getAttribute('title') || ''; }, set title(v) { el.setAttribute('title', v); },
      get textContent() { return el.childNodes.map(function (c) { return c.nodeType === 3 ? c.data : c.textContent; }).join(''); },
      set textContent(v) { el.childNodes.forEach(function (c) { c.parentNode = null; }); el.childNodes = []; if (String(v)) el.appendChild(text(String(v))); },
      get innerHTML() { return el.childNodes.map(serialize).join(''); },
      set innerHTML(v) { el.childNodes.forEach(function (c) { c.parentNode = null; }); el.childNodes = []; parse(el, String(v)); },
      get isConnected() { let e = el; while (e.parentNode) e = e.parentNode; return e === root; },
      get classList() {
        return {
          contains: function (k) { return el.className.split(/\s+/).indexOf(k) !== -1; },
          add: function (k) { if (!this.contains(k)) el.className = (el.className + ' ' + k).trim(); },
          remove: function (k) { el.className = el.className.split(/\s+/).filter(function (x) { return x && x !== k; }).join(' '); },
          toggle: function (k, on) { if (on === undefined ? !this.contains(k) : on) this.add(k); else this.remove(k); },
        };
      },
      get dataset() { const d = {}; Object.keys(el.attrs).forEach(function (k) { if (k.indexOf('data-') === 0) d[k.slice(5).replace(/-(\w)/g, function (x, c) { return c.toUpperCase(); })] = el.attrs[k]; }); return d; },
      setAttribute: function (k, v) { el.attrs[k] = String(v); },
      getAttribute: function (k) { return k in el.attrs ? el.attrs[k] : null; },
      hasAttribute: function (k) { return k in el.attrs; },
      removeAttribute: function (k) { delete el.attrs[k]; },
      appendChild: function (c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = el; el.childNodes.push(c); return c; },
      insertBefore: function (c, ref) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = el; const i = el.childNodes.indexOf(ref); if (i === -1) el.childNodes.push(c); else el.childNodes.splice(i, 0, c); return c; },
      removeChild: function (c) { const i = el.childNodes.indexOf(c); if (i !== -1) el.childNodes.splice(i, 1); c.parentNode = null; return c; },
      remove: function () { if (el.parentNode) el.parentNode.removeChild(el); },
      replaceWith: function (n) { const p = el.parentNode; if (!p) return; p.insertBefore(n, el); p.removeChild(el); },
      append: function () { Array.prototype.forEach.call(arguments, function (c) { el.appendChild(typeof c === 'string' ? text(c) : c); }); },
      matches: function (sel) { return matches(el, sel); },
      closest: function (sel) { let e = el; while (e && e.nodeType === 1) { if (matches(e, sel)) return e; e = e.parentNode; } return null; },
      querySelector: function (sel) { return all(el, sel, [])[0] || null; },
      querySelectorAll: function (sel) { return all(el, sel, []); },
      getElementsByTagName: function (t) { return all(el, t, []); },
      addEventListener: function (t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
      removeEventListener: function (t, fn) { listeners[t] = (listeners[t] || []).filter(function (f) { return f !== fn; }); },
      dispatchEvent: function (ev) {
        ev.target = ev.target || el; let stopped = false;
        ev.stopPropagation = function () { stopped = true; }; ev.preventDefault = ev.preventDefault || function () {};
        let e = el;
        while (e && !stopped) { ev.currentTarget = e; (e.listeners[ev.type] || []).slice().forEach(function (fn) { fn.call(e, ev); }); e = e.parentNode; }
        return true;
      },
      listeners: listeners,
      click: function () { el.dispatchEvent({ type: 'click', target: el }); },
      focus: function () {}, blur: function () {}, select: function () {},
      getBoundingClientRect: function () { return { top: 0, left: 0, width: 0, height: 0 }; },
    };
    return el;
  }
  root = element('html');
  const head = element('head'); const body = element('body');
  root.appendChild(head); root.appendChild(body);
  const document = {
    documentElement: root, head: head, body: body, readyState: 'complete',
    createElement: element, createTextNode: text,
    getElementById: function (id) { return all(root, '#' + id, [])[0] || null; },
    querySelector: function (s) { return root.querySelector(s); }, querySelectorAll: function (s) { return root.querySelectorAll(s); },
    addEventListener: function () {}, removeEventListener: function () {},
  };
  return document;
}

// ── THE WORLD ───────────────────────────────────────────────────────────────────────────────────────────────────────────
function personWorld(person, relayRows) {
  const document = makeDom();
  const w = { required: [], calls: [], posts: [], armings: [], closed: 0, statusAsked: 0, document: document };
  // THE NODE BEHIND THE SPIRIT OBJECT (goal/G43.24): every family.verb the panel asks is recorded; contact.get answers the
  // person. A verb answering a refusal rejects, as a family's call does, with the node's status and body.
  const families = new Proxy({}, { get: function (t, fam) {
    if (fam === 'then') return undefined;
    return new Proxy({}, { get: function (t2, verb) {
      return function (body) {
        const name = String(fam) + '.' + String(verb);
        w.calls.push({ name: name, body: body });
        if (w.refuse && w.refuse[name]) return Promise.reject(w.refuse[name]);
        return Promise.resolve(name === 'contact.get' ? { ok: true, person: person } : { ok: true });
      };
    } });
  } });
  // The layer it is drawn in (options.layer), its close and title the mounter's.
  const layer = { close: function () { w.closed += 1; }, setTitle: function (t) { w.title = String(t); } };
  w.layer = layer;
  const record = function (how, button, opts) {
    const o = opts || {};
    w.armings.push({ how: how, button: button, opts: o, label: o.label != null ? String(o.label) : String(button.textContent || '') });
    return button;
  };
  const win = { document: document, console: { log: function () {}, error: function () {} }, setTimeout: setTimeout, clearTimeout: clearTimeout };
  win.window = win;
  win.spirit = {
    escapeHtml: function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
    formatBytes: function (n) { return String(n) + ' B'; },
    // The shell's fact rows, drawn as the shell draws them: each name with its value, so what the detail shows can be read.
    shell: { factRow: function (rows) { return '<div class="facts">' + (rows || []).map(function (r) { return '<div>' + String(r[0]) + ' ' + String(r[1]) + '</div>'; }).join('') + '</div>'; } },
    require: function (p) { w.required.push(String(p).replace(/^\/+/, '')); return Promise.resolve({}); },
    ready: Promise.resolve(families),
    relay: { status: function () { w.statusAsked += 1; w.statusAt = w.calls.length; return Promise.resolve({ body: { rows: relayRows || [] } }); } },
    // goal/G43.32: the armingButton stands where an element now finds it, spirit.element.spirit.element.
    element: { spirit: { element: {
      armingButton: {
        attach: function (button, opts) { return record('attach', button, opts); },
        create: function (opts) { const b = document.createElement('button'); b.type = 'button'; b.textContent = (opts && opts.label) || ''; return record('create', b, opts); },
      },
    } } },
  };
  // goal/G43.32: the element places itself by installSpiritElement; the recorder hands that helper to the page stand-in
  // (spirit/test/headLessChrome.js pageSpirit).
  const recorder = win.spirit.require;
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(win.spirit);
  const pageRequire = win.spirit.require;
  win.spirit.require = function (p) { return /installSpiritElement\.js$/.test(p) ? pageRequire(p) : recorder(p); };
  // A PANEL'S MOUNT, NO NAVIGATION PAGE (goal/G43.18): the element made in a box of its own with its layer, as a layer's
  // fill makes it (spirit/element/search/contact/rowElement.js, openDetails).
  w.open = function (key) { const box = document.createElement('div'); document.body.appendChild(box); w.box = box; return win.spirit.element.spirit.element.search.contact.detailElement.create(box, { key: key, layer: layer }); };
  vm.createContext(win);
  vm.runInContext(SRC, win, { filename: FILE });
  w.win = win;
  return w;
}
function armingFor(w, label) { return w.armings.filter(function (a) { return a.label === label; }).pop() || null; }
function inPage(w, button) { let e = button; while (e) { if (e === w.box) return true; e = e.parentNode; } return false; }

// ── A RELAY'S WORLD (the relay part, once detailElement-relay.js) ──────────────────────────────────────────────────────
const ALLOC = { ok: true, onFile: { ramLimitMB: 256, discLimitMB: 2048 }, running: { ramLimitMB: 256, discLimitMB: 2048, members: 10, atRestMB: 40 },
  room: { ramMaxMB: 1024, discMaxMB: 8192 }, roll: { discUsedMB: 1 } };
function relayWorld(rows, relayStatus) {
  const document = makeDom();
  const w = { required: [], calls: [], posts: [], armings: [], closed: 0, document: document };
  // THE NODE BEHIND THE SPIRIT OBJECT (goal/G43.24): every family.verb the panel asks is recorded (w.calls), and each
  // packet it posts to a relay through peer.post is read out of its envelope (w.posts), the relay's answer put in one.
  const P = require(path.join(RUN, 'spirit', 'client', 'packet.js'));
  const relayAnswer = function (body) {
    if (body && body.config && !Object.keys(body.config).length) return ALLOC;
    if (body && body.config && body.config.restart) return { ok: true, restarting: true };
    if (body && body.revoke) return { ok: true, revoked: 1 };
    return { ok: true };
  };
  const families = new Proxy({}, { get: function (t, fam) {
    if (fam === 'then') return undefined;
    // relay.status, reached through spirit.ready as the page reaches every family (goal/G43.27, Q1: no api at load).
    // Its other verbs recorded, as every family's are below.
    if (fam === 'relay') return new Proxy({}, { get: function (t2, verb) {
      if (verb === 'status') return function () { return Promise.resolve({ body: { rows: JSON.parse(JSON.stringify(rows)), relayStatus: relayStatus || {} } }); };
      return function (body) { w.calls.push({ name: 'relay.' + String(verb), body: body }); return Promise.resolve({ ok: true }); };
    } });
    if (fam === 'peer') return { post: function (b) {
      const sent = P.decode(b.text);
      w.posts.push({ app: sent.app, key: b.to, body: sent.body });
      return Promise.resolve({ ok: true, text: P.encode('', relayAnswer(sent.body)).text });
    } };
    return new Proxy({}, { get: function (t2, verb) {
      return function (body) { w.calls.push({ name: String(fam) + '.' + String(verb), body: body }); return Promise.resolve({ ok: true }); };
    } });
  } });
  // The layer it is drawn in (options.layer): its close and title the mounter's.
  const layer = { close: function () { w.closed += 1; }, setTitle: function (t) { w.title = String(t); } };
  w.layer = layer;
  const record = function (how, button, opts) {
    const o = opts || {};
    w.armings.push({ how: how, button: button, opts: o, label: o.label != null ? String(o.label) : String(button.textContent || '') });
    return button;
  };
  const win = { document: document, console: { log: function () {}, error: function () {} }, setTimeout: setTimeout, clearTimeout: clearTimeout };
  win.window = win;
  win.spirit = {
    escapeHtml: function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
    formatBytes: function (n) { return String(n) + ' B'; },
    shell: { factRow: function () { return '<div class="facts"></div>'; } },
    ownerBadge: { removalRefusal: function () { return ''; } },
    // The stream, for its report on the relay event (goal/G41.32).
    event: { subscribe: function (h) { (w.streams = w.streams || []).push(h); return function () {}; } },
    // The node's stream through the data set (goal/G43.5): what a translator keeps of a relay's events, as the page's.
    data: { addTranslator: function (t) { const h = { onRelayEvent: t.onRelay }; (w.streams = w.streams || []).push(h); return function () { w.streams.splice(w.streams.indexOf(h), 1); }; } },
    require: function (p) { w.required.push(String(p).replace(/^\/+/, '')); return Promise.resolve({}); },
    ready: Promise.resolve(families),
    packet: P,
    // spirit.peerPost as spirit.js has it on a page (goal/G43.24): the body in its packet envelope, posted through the
    // node's peer.post (the stand-in above); how.answer resolves the node's whole answer, { ok, status, body, card, from, error }.
    peerPost: function (peer, app, body, how) {
      const PK = P;
      const made = PK.encode(app, body);
      return Promise.resolve(families).then(function (f) { return f.peer.post({ to: String(peer), text: made.text }); }).then(function (said) {
        const text = said && typeof said.text === 'string' ? said.text : '';
        const got = text ? PK.decode(text).body : null;
        const yes = !got || got.ok === undefined || !!got.ok;
        if (how && how.answer === true) return { ok: !!(said && said.ok) && yes, status: 200, body: got, card: (said && said.card) || null, from: (said && said.from) || '', error: (said && said.error) || '' };
        return got;
      });
    },
    // The contact family's cache (goal/G41.28): its manager loads, and the page watches spirit.data.contact.data's rows.
    cacheManager: function (name) { w.managers = (w.managers || []).concat(name); ((win.spirit.data = win.spirit.data || {}).contact = {}).data = { watch: function (h) { (w.watches = w.watches || []).push(h); return function () {}; } }; return Promise.resolve(true); },
    // goal/G43.32: the armingButton stands where an element now finds it, spirit.element.spirit.element.
    element: { spirit: { element: {
      armingButton: {
        attach: function (button, opts) { return record('attach', button, opts); },
        create: function (opts) { const b = document.createElement('button'); b.type = 'button'; b.textContent = (opts && opts.label) || ''; return record('create', b, opts); },
      },
    } } },
  };
  // goal/G43.32: the element places itself by installSpiritElement; the recorder hands that helper to the page stand-in
  // (spirit/test/headLessChrome.js pageSpirit).
  const recorder = win.spirit.require;
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(win.spirit);
  const pageRequire = win.spirit.require;
  win.spirit.require = function (p) { return /installSpiritElement\.js$/.test(p) ? pageRequire(p) : recorder(p); };
  // A PANEL'S MOUNT, NO NAVIGATION PAGE (goal/G43.18): the element made in a box of its own with its layer, as a layer's
  // fill makes it (spirit/element/search/contact/rowElement.js, openDetails).
  w.open = function (key) { const box = document.createElement('div'); document.body.appendChild(box); w.box = box; return win.spirit.element.spirit.element.search.contact.detailElement.create(box, { key: key, layer: layer, relay: true }); };
  vm.createContext(win);
  vm.runInContext(SRC, win, { filename: FILE });
  w.win = win;
  return w;
}
async function press(w, selector) { const el = w.document.querySelector(selector); if (el) { el.click(); await settle(); } return el; }

const OWNED_URL = 'https://mine.example';
const SEAT_URL = 'https://seat.example';
const OWNED = [{ key: 'RK', url: OWNED_URL, label: 'mine', status: 200, owned: true, claimed: true, claimedLabel: 'andy', roll: { relayKey: 'RK', relayLabel: 'Mine' } }];
const OWNED_SAID = {};
OWNED_SAID[OWNED_URL] = { key: 'RK', invites: [{ label: 'saint', expiresAt: '2099-01-01T00:00:00Z', invitedBy: 'andy' }] };
const SEATED = [{ key: 'RK2', url: SEAT_URL, label: 'seat', status: 200, owned: false, claimed: true, claimedLabel: 'andy', roll: { relayKey: 'RK2', relayLabel: 'Seat' } }];

// ── THE RELAY ROW STREAM'S HELPERS ─────────────────────────────────────────────────────────────────────────────────────
const MAIL = 'bert@example.org';
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }

async function home(base, verb, args) {
  const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
  const text = await r.text();
  return { status: r.status, text: text, body: parsed(text) };
}
// The node's own stream, as a page reads it: every event, kept.
function stream(base) {
  const kept = [];
  const c = new AbortController();
  const done = fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json', 'x-spirit-reader': 'server' }, body: JSON.stringify({ call: 'event.subscribe', args: {} }), signal: c.signal }).then(async function (r) {
    let held = '';
    const dec = new TextDecoder();
    for await (const chunk of r.body) {
      held += dec.decode(chunk, { stream: true });
      const parts = held.split('\n\n');
      held = parts.pop();
      parts.forEach(function (p) {
        const kind = (/^event: (.*)$/m.exec(p) || [])[1];
        const data = (/^data: (.*)$/m.exec(p) || [])[1];
        if (kind) kept.push({ kind: kind, data: parsed(data) });
      });
    }
  }).catch(function () { /* the stream ends with the test */ });
  return { kept: kept, stop: function () { c.abort(); return done; } };
}

function pageText(x) { return x && x.box ? String(x.box.textContent || '') : ''; }
function armingLabels(x) { return short(x ? x.armings.map(function (a) { return a.label; }) : x); }
function callNames(calls) { return short((calls || []).map(function (c) { return c.name; })); }

// ── THE TESTS ───────────────────────────────────────────────────────────────────────────────────────────────────────────
// One test.run per test (goal/G47.2). What the worlds and the tests make, for the tests after them: P for a person's
// detail, L for a relay's, S for the relay row stream's scratch node, relay and Chrome.
const P = {};
const L = {};
const S = { others: [] };
const CODE = SRC.replace(/\/\/.*$/gm, '');
const NO_E = 'no detailElement with a create: the element did not place itself';

// nothing hand-rolled is left
test.run('no armed flags of its own (cdBlockArmed, cdForgetArmed)', 0.2, function () {
  return !/cdBlockArmed|cdForgetArmed/.test(SRC) || 'contactDetails.js still keeps cdBlockArmed or cdForgetArmed';
}, 1000);
test.run('no data-armed in its code', 0.2, function () {
  return !/data-armed/.test(CODE) || 'contactDetails.js still writes data-armed';
}, 1000);
test.run('no armUntilElsewhere of its own', 0.2, function () {
  return !/armUntilElsewhere/.test(CODE) || 'contactDetails.js still calls armUntilElsewhere';
}, 1000);
test.run('no armed class', 0.2, function () {
  return (!/classList\.(add|toggle)\(\s*['"]armed['"]/.test(CODE) && !/class="[^"]*\barmed\b/.test(CODE)) || 'contactDetails.js still sets an armed class';
}, 1000);

// it loads armingButton itself (goal/G41.3)
const KEY = 'K1';
const PERSON_RELAYS = [
  { url: 'https://mine.example', owned: true, roll: { relayKey: 'RK1' } },
  { url: 'https://other.example', owned: false, claimed: true, roll: { relayKey: 'RK2' } },
];
test.run('it requires spirit/element/armingButton.js through spirit.require', 0.2, function () {
  P.w = personWorld({ key: KEY, publicLabel: 'bob', myLabel: '', blocked: false }, PERSON_RELAYS);
  return P.w.required.indexOf('spirit/element/armingButton.js') !== -1 || 'required: ' + short(P.w.required);
}, 1000);
test.run('it is window.spirit.element.spirit.element.search.contact.detailElement, made by create; no open of its own: it opens as a panel (goal/G43.18)', 0.2, function () {
  if (!P.w) return 'no world: the element did not run';
  const E = P.w.win.spirit.element.spirit.element.search.contact.detailElement;
  if (E && typeof E.create === 'function') P.E = E;
  return (!!E && typeof E.create === 'function' && E.open === undefined) || 'detailElement: create ' + typeof (E && E.create) + ', open ' + typeof (E && E.open);
}, 1000);
test.run('it reads the row by contact.get', 0.2, async function () {
  if (!P.E) return NO_E;
  P.w.open(KEY);
  await settle();
  P.opened = true;
  return P.w.calls.some(function (c) { return c.name === 'contact.get' && c.body.key === KEY; }) || 'calls: ' + callNames(P.w.calls);
}, 1000);

// Block is an arming button
const NO_BLOCK = 'no Block arming button';
test.run('Block is made by armingButton', 0.2, function () {
  if (!P.opened) return NO_E;
  P.block = armingFor(P.w, 'Block');
  return !!P.block || 'armings: ' + armingLabels(P.w);
}, 1000);
test.run('armed, it says Block — press again', 0.2, function () {
  if (!P.block) return NO_BLOCK;
  return P.block.opts.armedLabel === 'Block — press again' || 'armedLabel: ' + short(P.block.opts.armedLabel);
}, 1000);
test.run('it is handed no api: the button hears a click elsewhere itself', 0.2, function () {
  if (!P.block) return NO_BLOCK;
  return !('api' in P.block.opts) || 'handed: ' + short(Object.keys(P.block.opts));
}, 1000);
test.run('the button stands in the page', 0.2, function () {
  if (!P.block) return NO_BLOCK;
  return inPage(P.w, P.block.button) || 'the Block button is not in the page';
}, 1000);
test.run('its run asks contact.block for the row on screen', 0.2, async function () {
  if (!P.block) return NO_BLOCK;
  const before = P.w.calls.length;
  if (typeof P.block.opts.run === 'function') await P.block.opts.run();
  await settle();
  const asked = P.w.calls.slice(before).filter(function (c) { return c.name === 'contact.block'; })[0];
  return (!!asked && asked.body.publicKey === KEY) || 'asked: ' + short(P.w.calls.slice(before));
}, 1000);

// goal/G43.17, Andy: ""forget" a contact means only: delete that row from my contacts. it does NOT mean: "eject them from relays
// i own", not at all. not the same scope of decision." The world still has a relay this node owns (RK1), so a seat it would
// give up is there to be given up, and is not.
// Forget is an arming button, and only deletes the row: Andy, "it does NOT mean: "eject them from relays i own""
const NO_FORGET = 'no Forget arming button';
test.run('Forget is made by armingButton', 0.2, function () {
  if (!P.opened) return NO_E;
  P.forget = armingFor(P.w, 'Forget');
  return !!P.forget || 'armings: ' + armingLabels(P.w);
}, 1000);
test.run('armed, it says nothing of seats or relays', 0.2, function () {
  if (!P.forget) return NO_FORGET;
  return !/seat|relay/i.test(String(P.forget.opts.armedLabel || '')) || 'armedLabel: ' + short(P.forget.opts.armedLabel);
}, 1000);
test.run('Forget is handed no api, and is in the page', 0.2, function () {
  if (!P.forget) return NO_FORGET;
  return (!('api' in P.forget.opts) && inPage(P.w, P.forget.button)) || 'api ' + ('api' in P.forget.opts) + ', in page ' + inPage(P.w, P.forget.button);
}, 1000);
test.run('its run posts nothing to any relay, the one this node owns included: no seat is removed', 0.2, async function () {
  if (!P.forget) return NO_FORGET;
  const before = P.w.calls.length;
  const postsBefore = P.w.posts.length;
  if (typeof P.forget.opts.run === 'function') await P.forget.opts.run();
  await settle();
  P.forgetRan = true;
  P.forgot = P.w.calls.slice(before).filter(function (c) { return c.name === 'contact.forget'; })[0];
  P.forgetCalls = P.w.calls.slice(before);
  const posts = P.w.posts.slice(postsBefore);
  return !posts.length || 'posts: ' + short(posts);
}, 1000);
test.run('it asks contact.forget for the row', 0.2, function () {
  if (!P.forgetRan) return NO_FORGET;
  return (!!P.forgot && P.forgot.body.publicKey === KEY) || 'asked: ' + callNames(P.forgetCalls);
}, 1000);
test.run('and the page closes', 0.2, function () {
  if (!P.forgetRan) return NO_FORGET;
  return P.w.closed === 1 || 'closed ' + P.w.closed + ' times';
}, 1000);

// a press on the drawn button asks nothing by itself
test.run('two presses on the drawn Block block nobody without the element', 0.2, async function () {
  const w2 = personWorld({ key: 'K2', publicLabel: 'carl', blocked: false }, []);
  w2.open('K2');
  await settle();
  const drawn = w2.document.getElementById('cd-block') || (armingFor(w2, 'Block') || {}).button;
  const before2 = w2.calls.length;
  if (drawn) { drawn.click(); await settle(); const again = w2.document.getElementById('cd-block') || drawn; again.click(); await settle(); }
  return (!!drawn && !w2.calls.slice(before2).some(function (c) { return c.name === 'contact.block'; })) || 'asked: ' + callNames(w2.calls.slice(before2));
}, 1000);

// a blocked row offers Unblock, and Forget still arms
test.run('no Block, but Unblock, a plain button', 0.2, async function () {
  P.w3 = personWorld({ key: 'K3', publicLabel: 'dora', blocked: true }, []);
  P.w3.open('K3');
  await settle();
  return (!armingFor(P.w3, 'Block') && !!P.w3.document.getElementById('cd-unblock')) || 'armings: ' + armingLabels(P.w3);
}, 1000);
test.run('Forget is an arming button here too', 0.2, function () {
  if (!P.w3) return 'no blocked row drawn';
  return !!armingFor(P.w3, 'Forget') || 'armings: ' + armingLabels(P.w3);
}, 1000);

// THE STAR, AT HOME, TWO PRESSES (goal/G41.30; Andy: "so this button will put the star on relays and puppets. AND take it
// away."; "NO signature. just the armingButton, with a precise documentation of the risk."; every contact's details
// panel has it, at home; the face does not show it).
// goal/G43.14, Andy: "KILL those fields in shadow-roll, KILL the functionality, KILL it!": a row that still carried them shows none.
// the box: "a contact's detail no longer shows them"
const NO_CAROL = 'no detail of carol: the world failed';
test.run('the world: the detail of carol is drawn, with its facts', 0.2, async function () {
  const wc = personWorld({ key: 'KC', publicLabel: 'carol', myLabel: '', blocked: false, unansweredInbound: 7, inboundPerDay: 3.5, outboundPerDay: 1.25 }, []);
  wc.open('KC');
  await settle();
  const shown = pageText(wc);
  if (/carol/.test(shown) && /Public Handle/.test(shown)) P.carol = shown;
  return P.carol !== undefined || 'the detail: ' + short(shown);
}, 1000);
test.run('it shows no unanswered inbound, no inbound rate and no outbound rate', 0.2, function () {
  if (P.carol === undefined) return NO_CAROL;
  return !/Unanswered inbound|Inbound rate|Outbound rate/.test(P.carol) || 'the detail: ' + short(P.carol);
}, 1000);
test.run('and none of their numbers', 0.2, function () {
  if (P.carol === undefined) return NO_CAROL;
  return (P.carol.indexOf('3.5') === -1 && P.carol.indexOf('1.25') === -1) || 'the detail: ' + short(P.carol);
}, 1000);

// the star: an arming button, its risk said beside it
const personStarOf = function (x) { const b = x.document.getElementById('cd-own'); return b ? x.armings.filter(function (a) { return a.button === b; }).pop() || null : null; };
test.run('a node\'s panel draws #cd-own, an arming button', 0.2, async function () {
  P.w5 = personWorld({ key: 'K5', publicLabel: 'a node', mine: false }, []);
  P.w5.open('K5');
  await settle();
  P.s5 = personStarOf(P.w5);
  return !!P.s5 || 'armings: ' + armingLabels(P.w5);
}, 1000);
test.run('it says what the star gives a node: its streams taken without asking, and it is never dropped', 0.2, function () {
  if (!P.w5) return 'no panel of a node drawn';
  return (/without asking/.test(pageText(P.w5)) && /never dropped/.test(pageText(P.w5))) || 'the page says: ' + short(pageText(P.w5));
}, 1000);
test.run('a press on the button alone sends nothing: the arming button holds it', 0.2, async function () {
  if (!P.w5) return 'no panel of a node drawn';
  const b5 = P.w5.calls.length;
  const drawn5 = P.w5.document.getElementById('cd-own');
  if (drawn5) { drawn5.click(); await settle(); }
  return (!!drawn5 && !P.w5.calls.slice(b5).some(function (c) { return c.name === 'contact.own'; })) || 'calls: ' + short(P.w5.calls.slice(b5));
}, 1000);
test.run('its second press sends contact.own {key, own: true}', 0.2, async function () {
  if (!P.w5) return 'no panel of a node drawn';
  if (P.s5) { await P.s5.opts.run(); await settle(); }
  const sent5 = P.w5.calls.filter(function (c) { return c.name === 'contact.own'; }).pop();
  return (!!sent5 && sent5.body.key === 'K5' && sent5.body.own === true) || 'sent: ' + short(sent5);
}, 1000);
test.run('on a starred row the same button takes the star away: contact.own {key, own: false}', 0.2, async function () {
  const w6 = personWorld({ key: 'K6', publicLabel: 'a puppet', mine: true }, []);
  w6.open('K6');
  await settle();
  const s6 = personStarOf(w6);
  if (s6) { await s6.opts.run(); await settle(); }
  const sent6 = w6.calls.filter(function (c) { return c.name === 'contact.own'; }).pop();
  return (!!sent6 && sent6.body.key === 'K6' && sent6.body.own === false) || 'sent: ' + short(sent6);
}, 1000);
test.run('on a face (window.spirit.transport) no button is drawn', 0.2, async function () {
  const w7 = personWorld({ key: 'K7', publicLabel: 'a node', mine: false }, []);
  w7.win.spirit.transport = { ask: function () {} };
  w7.open('K7');
  await settle();
  return (!!w7.box && !w7.document.getElementById('cd-own') && !personStarOf(w7)) || 'on a face: #cd-own ' + !!w7.document.getElementById('cd-own');
}, 1000);

// WHAT IT NEEDS, IT REQUIRES ITSELF (goal/G43.24; Andy: "anybody can mount any element without knowing what it actually
// needs...."): it asks the node through the spirit object, is handed no api, and draws with its key alone.
test.run('its code names no api', 0.2, function () {
  return !/\bapi\b/.test(CODE) || 'its code still names an api';
}, 1000);
test.run('its title goes to the layer it is drawn in (options.layer.setTitle)', 0.2, function () {
  if (!P.opened) return NO_E;
  return (typeof P.w.title === 'string' && P.w.title.indexOf('bob') !== -1) || 'title: ' + short(P.w.title);
}, 1000);
test.run('mounted with its key alone, no layer, it reads the row and draws it', 0.2, async function () {
  const w8 = personWorld({ key: 'K8', publicLabel: 'carol' }, []);
  const box8 = w8.document.createElement('div'); w8.document.body.appendChild(box8); w8.box = box8;
  w8.win.spirit.element.spirit.element.search.contact.detailElement.create(box8, { key: 'K8' });
  await settle();
  P.w8 = w8;
  return (w8.calls.some(function (c) { return c.name === 'contact.get' && c.body.key === 'K8'; }) && /carol/.test(box8.innerHTML)) || 'calls: ' + callNames(w8.calls);
}, 1000);
test.run('a verb the node refuses says its status and words', 0.2, async function () {
  if (!P.w8) return 'no detail mounted with its key alone';
  P.w8.refuse = { 'contact.block': { status: 403, body: { ok: false, error: 'not yours' } } };
  const b8 = armingFor(P.w8, 'Block');
  if (b8) { await b8.opts.run(); await settle(); }
  const html = P.w8.box.innerHTML;
  return (!!b8 && /block failed: 403/.test(html) && /not yours/.test(html)) || 'said: ' + short(html.slice(0, 400));
}, 1000);

// GOAL/G43.32 (Andy: "the contact list already knows the difference between contact types. so should the detail panel."): told
// the row is a relay, or holding a relay's row in the contact family's cache, it draws that relay's details itself (what
// relayPanel.js drew, in this file now: the relay part below (once ./detailElement-relay.js) judges them), and asks nothing of a
// person's details.
// it knows the contact's type: a relay's details for a relay
test.run('it loads no relayPanel.js: a relay\'s details are its own', 0.2, function () {
  if (!P.w) return 'no world: the element did not run';
  return !P.w.required.some(function (p) { return /relayPanel\.js$/.test(p); }) || 'required: ' + short(P.w.required);
}, 1000);

// ── THE RELAY PART (once detailElement-relay.js) ───────────────────────────────────────────────────────────────────────
// The tests of spirit/element/search/contact/detailElement.js for a relay, what relayPanel.js drew until goal/G43.32 (spec:
// ./detailElement.md, its relay section; goal/G41.9, G43.32): its are-you-sure buttons are armingButtons.

// nothing hand-rolled is left
test.run('for a relay: no data-armed in its code', 0.2, function () {
  return !/data-armed/.test(CODE) || 'detailElement.js still reads or writes data-armed';
}, 1000);
test.run('for a relay: no armUntilElsewhere of its own', 0.2, function () {
  return !/armUntilElsewhere/.test(CODE) || 'detailElement.js still calls armUntilElsewhere';
}, 1000);
test.run('for a relay: no armed class', 0.2, function () {
  return !/classList\.(add|toggle)\(\s*['"]armed['"]/.test(CODE) || 'detailElement.js still sets an armed class';
}, 1000);

// it loads armingButton itself (goal/G41.3)
const NO_RELAY = 'no relay detail drawn: the element did not place itself';
test.run('for a relay: it requires spirit/element/armingButton.js through spirit.require', 0.2, function () {
  L.w = relayWorld(OWNED, OWNED_SAID);
  return L.w.required.indexOf('spirit/element/armingButton.js') !== -1 || 'required: ' + short(L.w.required);
}, 1000);
test.run('it is window.spirit.element.spirit.element.search.contact.detailElement, made by create, a relay told relay: true; no open of its own: it opens as a panel (goal/G43.18)', 0.2, function () {
  if (!L.w) return 'no world: the element did not run';
  const E = L.w.win.spirit.element.spirit.element.search.contact.detailElement;
  if (E && typeof E.create === 'function') L.E = E;
  return (!!E && typeof E.create === 'function' && E.open === undefined) || 'relayPanel: create ' + typeof (E && E.create) + ', open ' + typeof (E && E.open);
}, 1000);

// Restart, in Memory and disc, is an arming button
const NO_RESTART = 'no Restart arming button';
test.run('Restart is made by armingButton', 0.2, async function () {
  if (!L.E) return NO_RELAY;
  L.w.open('RK');
  await settle();
  await press(L.w, '.nd-group-fold');
  L.opened = true;
  await press(L.w, '[data-fold="allocation"]');
  L.restart = armingFor(L.w, 'Restart');
  return !!L.restart || 'armings: ' + armingLabels(L.w);
}, 1000);
test.run('armed, it says Restart? Every stream drops', 0.2, function () {
  if (!L.restart) return NO_RESTART;
  return L.restart.opts.armedLabel === 'Restart? Every stream drops' || 'armedLabel: ' + short(L.restart.opts.armedLabel);
}, 1000);
test.run('Restart is handed no api, and is in the page', 0.2, function () {
  if (!L.restart) return NO_RESTART;
  return (!('api' in L.restart.opts) && inPage(L.w, L.restart.button)) || 'api ' + ('api' in L.restart.opts) + ', in page ' + inPage(L.w, L.restart.button);
}, 1000);
test.run('its run posts the relay config { restart: true } and nothing else', 0.2, async function () {
  if (!L.restart) return NO_RESTART;
  const before = L.w.posts.length;
  if (typeof L.restart.opts.run === 'function') await L.restart.opts.run();
  await settle();
  const asked = L.w.posts.slice(before).filter(function (p) { return p.body && p.body.config && p.body.config.restart; })[0];
  return (!!asked && asked.key === 'RK' && asked.app === 'relay' && Object.keys(asked.body.config).join() === 'restart') || 'posts: ' + short(L.w.posts.slice(before));
}, 1000);

// Revoke, on each invite, is an arming button
const NO_REVOKE = 'no Revoke arming button';
test.run('an invite\'s Revoke is made by armingButton', 0.2, async function () {
  if (!L.opened) return NO_RELAY;
  if (!L.w.document.querySelector('[data-fold="invite"]')) await press(L.w, '.nd-group-fold');
  await press(L.w, '[data-fold="invite"]');
  L.revoke = armingFor(L.w, 'Revoke');
  return !!L.revoke || 'armings: ' + armingLabels(L.w);
}, 1000);
test.run('armed, it names the invite: Revoke saint?', 0.2, function () {
  if (!L.revoke) return NO_REVOKE;
  return L.revoke.opts.armedLabel === 'Revoke saint?' || 'armedLabel: ' + short(L.revoke.opts.armedLabel);
}, 1000);
test.run('Revoke is handed no api, and is in the page', 0.2, function () {
  if (!L.revoke) return NO_REVOKE;
  return (!('api' in L.revoke.opts) && inPage(L.w, L.revoke.button)) || 'api ' + ('api' in L.revoke.opts) + ', in page ' + inPage(L.w, L.revoke.button);
}, 1000);
test.run('its run posts the relay revoke { label: saint }', 0.2, async function () {
  if (!L.revoke) return NO_REVOKE;
  const before = L.w.posts.length;
  if (typeof L.revoke.opts.run === 'function') await L.revoke.opts.run();
  await settle();
  const asked = L.w.posts.slice(before).filter(function (p) { return p.body && p.body.revoke; })[0];
  return (!!asked && asked.key === 'RK' && asked.body.revoke.label === 'saint') || 'posts: ' + short(L.w.posts.slice(before));
}, 1000);

// Remove is an arming button, with the reset it lacked
const NO_REMOVE = 'no Remove arming button';
test.run('Remove is made by armingButton', 0.2, async function () {
  if (!L.opened) return NO_RELAY;
  await press(L.w, '[data-fold="remove"]');
  L.remove = armingFor(L.w, 'Remove this relay');
  return !!L.remove || 'armings: ' + armingLabels(L.w);
}, 1000);
test.run('armed, it says Press again to remove', 0.2, function () {
  if (!L.remove) return NO_REMOVE;
  return L.remove.opts.armedLabel === 'Press again to remove' || 'armedLabel: ' + short(L.remove.opts.armedLabel);
}, 1000);
test.run('Remove is handed no api: the button hears a click elsewhere itself', 0.2, function () {
  if (!L.remove) return NO_REMOVE;
  return (!('api' in L.remove.opts) && inPage(L.w, L.remove.button)) || 'api ' + ('api' in L.remove.opts) + ', in page ' + inPage(L.w, L.remove.button);
}, 1000);
test.run('its run asks relay.remove for this relay', 0.2, async function () {
  if (!L.remove) return NO_REMOVE;
  const before = L.w.calls.length;
  if (typeof L.remove.opts.run === 'function') await L.remove.opts.run();
  await settle();
  L.removeRan = true;
  const asked = L.w.calls.slice(before).filter(function (c) { return c.name === 'relay.remove'; })[0];
  return (!!asked && asked.body.key === OWNED_URL) || 'asked: ' + short(L.w.calls.slice(before));
}, 1000);
test.run('and the page closes once the node says ok', 0.2, function () {
  if (!L.removeRan) return NO_REMOVE;
  return L.w.closed === 1 || 'closed ' + L.w.closed;
}, 1000);

// a press on the drawn button asks nothing by itself
test.run('two presses on the drawn Remove remove nothing without the element', 0.2, async function () {
  const w2 = relayWorld(OWNED, OWNED_SAID);
  w2.open('RK');
  await settle();
  await press(w2, '[data-fold="remove"]');
  const before2 = w2.calls.length;
  const drawn = await press(w2, '.nd-remove');
  await press(w2, '.nd-remove');
  return (!!drawn && !w2.calls.slice(before2).some(function (c) { return c.name === 'relay.remove'; })) || 'asked: ' + callNames(w2.calls.slice(before2));
}, 1000);

// Leave, on a relay this node holds a seat on, is an arming button with the reset it lacked
const NO_LEAVE = 'no Leave arming button';
test.run('Leave is made by armingButton', 0.2, async function () {
  L.w3 = relayWorld(SEATED, {});
  L.w3.open('RK2');
  await settle();
  await press(L.w3, '[data-fold="leave"]');
  L.leave = armingFor(L.w3, 'Leave this relay');
  return !!L.leave || 'armings: ' + armingLabels(L.w3);
}, 1000);
test.run('armed, it says Press again to leave', 0.2, function () {
  if (!L.leave) return NO_LEAVE;
  return L.leave.opts.armedLabel === 'Press again to leave' || 'armedLabel: ' + short(L.leave.opts.armedLabel);
}, 1000);
test.run('Leave is handed no api: the button hears a click elsewhere itself', 0.2, function () {
  if (!L.leave) return NO_LEAVE;
  return (!('api' in L.leave.opts) && inPage(L.w3, L.leave.button)) || 'api ' + ('api' in L.leave.opts) + ', in page ' + inPage(L.w3, L.leave.button);
}, 1000);
test.run('its run asks relay.leave for this relay', 0.2, async function () {
  if (!L.leave) return NO_LEAVE;
  const before = L.w3.calls.length;
  if (typeof L.leave.opts.run === 'function') await L.leave.opts.run();
  await settle();
  const asked = L.w3.calls.slice(before).filter(function (c) { return c.name === 'relay.leave'; })[0];
  return (!!asked && asked.body.key === SEAT_URL) || 'asked: ' + short(L.w3.calls.slice(before));
}, 1000);
test.run('two presses on the drawn Leave leave nothing without the element', 0.2, async function () {
  const w4 = relayWorld(SEATED, {});
  w4.open('RK2');
  await settle();
  await press(w4, '[data-fold="leave"]');
  const before4 = w4.calls.length;
  const drawnLeave = await press(w4, '.nd-leave');
  await press(w4, '.nd-leave');
  return (!!drawnLeave && !w4.calls.slice(before4).some(function (c) { return c.name === 'relay.leave'; })) || 'asked: ' + callNames(w4.calls.slice(before4));
}, 1000);

// THE STAR ON A RELAY (goal/G41.30; Andy: "the message is different for members and owners, showing members who they
// have to trust, and, if the relay claims to be mine, the message should be slightly different like \"if you DID install
// this relay on a VSP and you DID set it's DNS records.....\""; "NO signature. just the armingButton, with a precise
// documentation of the risk."). What a relay's owner field says is that relay's own word, so it reads "says".
// the star on a relay: an arming button, and who you have to trust
const relayStarOf = function (x) { const b = x.document.querySelector('.nd-own'); return b ? x.armings.filter(function (a) { return a.button === b; }).pop() || null : null; };
const MEMBER = [{ key: 'RK2', url: SEAT_URL, label: 'seat', status: 200, owned: false, claimed: true, claimedLabel: 'andy', mine: false, ownerLabel: 'Olga', roll: { relayKey: 'RK2', relayLabel: 'Seat' } }];
const CLAIMS = [{ key: 'RK', url: OWNED_URL, label: 'mine', status: 200, owned: true, claimed: true, claimedLabel: 'andy', mine: false, ownerLabel: 'andy', roll: { relayKey: 'RK', relayLabel: 'Mine' } }];
const NO_MEMBER = 'no panel of a member\'s relay drawn';
const NO_CLAIMS = 'no panel of a relay claiming this node drawn';
test.run('a relay\'s panel draws .nd-own, an arming button', 0.2, async function () {
  L.w5 = relayWorld(MEMBER, {});
  L.w5.open('RK2');
  await settle();
  await press(L.w5, '[data-fold="star"]');
  L.s5 = relayStarOf(L.w5);
  return !!L.s5 || 'armings: ' + armingLabels(L.w5);
}, 1000);
test.run('a relay that does not claim this node names who must be trusted, "says it is owned by" its owner', 0.2, function () {
  if (!L.w5) return NO_MEMBER;
  return /says it is owned by Olga/.test(pageText(L.w5)) || 'the page says: ' + short(pageText(L.w5));
}, 1000);
test.run('and says that person and anyone holding the relay can run programs and change files on this machine', 0.2, function () {
  if (!L.w5) return NO_MEMBER;
  const t = pageText(L.w5);
  return (/run programs/.test(t) && /change files/.test(t) && /anyone holding/.test(t)) || 'the page says: ' + short(t);
}, 1000);
test.run('it does not speak of having installed it', 0.2, function () {
  if (!L.w5) return NO_MEMBER;
  return !/If you DID install/.test(pageText(L.w5)) || 'the page says: ' + short(pageText(L.w5));
}, 1000);
test.run('a press on the button alone sends nothing', 0.2, async function () {
  if (!L.w5) return NO_MEMBER;
  const b5 = L.w5.calls.length;
  const drawn5 = L.w5.document.querySelector('.nd-own');
  if (drawn5) { drawn5.click(); await settle(); }
  return (!!drawn5 && !L.w5.calls.slice(b5).some(function (c) { return c.name === 'contact.own'; })) || 'calls: ' + short(L.w5.calls.slice(b5));
}, 1000);
test.run('its second press sends contact.own {key: the relay\'s key, own: true}', 0.2, async function () {
  if (!L.w5) return NO_MEMBER;
  if (L.s5) { await L.s5.opts.run(); await settle(); }
  const sent5 = L.w5.calls.filter(function (c) { return c.name === 'contact.own'; }).pop();
  return (!!sent5 && sent5.body.key === 'RK2' && sent5.body.own === true) || 'sent: ' + short(sent5);
}, 1000);
test.run('a relay claiming this node says: "If you DID install this relay on a VPS and you DID set its DNS records"', 0.2, async function () {
  L.w6 = relayWorld(CLAIMS, OWNED_SAID);
  L.w6.open('RK');
  await settle();
  await press(L.w6, '[data-fold="star"]');
  return /If you DID install this relay on a VPS and you DID set its DNS records/.test(pageText(L.w6)) || 'the page says: ' + short(pageText(L.w6));
}, 1000);
test.run('and that otherwise it is lying', 0.2, function () {
  if (!L.w6) return NO_CLAIMS;
  return /lying/.test(pageText(L.w6)) || 'the page says: ' + short(pageText(L.w6));
}, 1000);
test.run('with the same button', 0.2, function () {
  if (!L.w6) return NO_CLAIMS;
  return !!relayStarOf(L.w6) || 'armings: ' + armingLabels(L.w6);
}, 1000);
test.run('on a starred relay the same button takes the star away', 0.2, async function () {
  const w7 = relayWorld([Object.assign({}, CLAIMS[0], { mine: true })], OWNED_SAID);
  w7.open('RK');
  await settle();
  await press(w7, '[data-fold="star"]');
  const s7 = relayStarOf(w7);
  if (s7) { await s7.opts.run(); await settle(); }
  const sent7 = w7.calls.filter(function (c) { return c.name === 'contact.own'; }).pop();
  return (!!sent7 && sent7.body.key === 'RK' && sent7.body.own === false) || 'sent: ' + short(sent7);
}, 1000);
test.run('for a relay, on a face (window.spirit.transport) no button is drawn', 0.2, async function () {
  const w8 = relayWorld(MEMBER, {});
  w8.win.spirit.transport = { ask: function () {} };
  w8.open('RK2');
  await settle();
  return (!!w8.box && !w8.document.querySelector('.nd-own') && !relayStarOf(w8)) || 'on a face: .nd-own ' + !!w8.document.querySelector('.nd-own');
}, 1000);

// WHAT IT NEEDS, IT REQUIRES ITSELF (goal/G43.24; Andy: "anybody can mount any element without knowing what it actually
// needs...."): the node's verbs and its posts to the relay go through the spirit object; it is handed no api.
test.run('for a relay: its code names no api', 0.2, function () {
  return (!/\bapi\b/.test(CODE) && !/ndApi/.test(CODE)) || 'its code still names an api';
}, 1000);
test.run('a post to the relay goes through spirit.peerPost, which puts it in its envelope; the panel encodes no packet of its own', 0.2, function () {
  const panelCode = fs.readFileSync(path.join(RUN, 'spirit', 'element', 'search', 'contact', 'detailElement.js'), 'utf8').replace(/\/\/.*$/gm, '');
  const viaPeerPost = /spirit\.peerPost\(/.test(panelCode);
  const ownEncode = /packet\.encode\(/.test(panelCode);
  return (viaPeerPost && !ownEncode) || 'its code: peerPost ' + viaPeerPost + ', its own encode ' + ownEncode;
}, 1000);
test.run('each post to the relay is a packet for it through peer.post, in its envelope', 0.2, function () {
  if (!L.opened) return NO_RELAY;
  return (L.w.posts.length > 0 && L.w.posts.every(function (p) { return p.app === 'relay' && p.key === 'RK'; })) || 'posts: ' + short(L.w.posts.map(function (p) { return { app: p.app, key: p.key }; }));
}, 1000);
test.run('for a relay: its title goes to the layer it is drawn in (options.layer.setTitle)', 0.2, function () {
  if (!L.opened) return NO_RELAY;
  return (typeof L.w.title === 'string' && /^Relay Details/.test(L.w.title)) || 'title: ' + short(L.w.title);
}, 1000);

// ONE DETAIL FOR EVERY KIND OF CONTACT (goal/G43.32; Andy: "the contact list already knows the difference between contact
// types. so should the detail panel."): not told, the contact family's cache says what the row is.
// it knows the contact's type, from the contact family's cache when not told
const held = function (wx, relay) { (wx.win.spirit.data = wx.win.spirit.data || {}).contact = { data: { contact: function (k) { return { key: k, relay: relay }; }, watch: function () { return function () {}; } } }; };
test.run('a relay\'s row in the cache: it draws the relay\'s details, and asks nothing a person\'s ask (contact.get)', 0.2, async function () {
  const wr = relayWorld(OWNED, OWNED_SAID);
  held(wr, true);
  const boxR = wr.document.createElement('div'); wr.document.body.appendChild(boxR);
  wr.win.spirit.element.spirit.element.search.contact.detailElement.create(boxR, { key: 'RK', layer: wr.layer });
  await settle();
  return (/nd-/.test(boxR.innerHTML) && !wr.calls.some(function (c) { return c.name === 'contact.get'; })) || 'calls: ' + callNames(wr.calls);
}, 1000);
test.run('a person\'s row: it draws a person\'s details, reading the person (contact.get)', 0.2, async function () {
  const wp = relayWorld(OWNED, OWNED_SAID);
  held(wp, false);
  const boxP = wp.document.createElement('div'); wp.document.body.appendChild(boxP);
  wp.win.spirit.element.spirit.element.search.contact.detailElement.create(boxP, { key: 'KP', layer: wp.layer });
  await settle();
  return wp.calls.some(function (c) { return c.name === 'contact.get' && c.body && c.body.key === 'KP'; }) || 'calls: ' + callNames(wp.calls);
}, 1000);

// ── THE RELAY ROW STREAM PART (once detailElement-relayRowStream.js, and relayPanel-rowStream.js until goal/G43.32, when the
// relay panel went into the contact detail) ──────────────────────────────────────────────────────────────────────────
// WHO PAINTS, LISTENS (goal/G41.32; Andy, Q13: "every row's data, wherever it's visible must update instantly: who paints,
// listens.", and "BEING INVISIBLE doesn't change a elements fucking duty to listen to fucking changes"; the box:
// "natterDetails will become an shell element: relayPanel.js, it is configured with it's own contact row, and follows only
// that."; "the "⭐ Star this relay" section should be a folded block"). hub.js relaySummary builds a relay's owned, claimed,
// roll, services and status from what the node holds, and asks no relay, so the node publishes each as it changes, on the
// relay's row, under those names; the report goes on the relay event, which only a starred face hears (wsl, in the item's
// chat, cw's check of it). A real scratch node and relay, the node's own stream, and a real Chrome for the panel.
const NO_NODE = 'the scratch node or relay did not come up: nothing judged';
const NO_CHROME = 'no Chrome page: the panel is not judged';
const rowsOf = function (key) { return S.stream.kept.filter(function (e) { return e.kind === 'job-updated' && e.data && e.data.id === 'spirit.contact' && e.data.data && e.data.data.row && e.data.data.row.publicKey === key; }).map(function (e) { return e.data.data.row; }); };
const last = function (key) { const r = rowsOf(key); return r.length ? r[r.length - 1] : null; };
const joinCode = function (relay) { return relay.mailed[0] && ((/[?&]join=([A-Za-z0-9_-]+)/.exec(relay.mailed[0].text)) || [])[1]; };
const panelText = function () { return S.chrome.evaluate('document.getElementById("zzPanel").textContent').then(String); };
const starred = async function (k) { const a = await home(S.N.base, 'contact.search', { q: '', mine: 'yes' }); return !!(a.body && (a.body.items || []).some(function (i) { return i.key === k; })); };

test.after(async function () {
  try { if (S.stream) S.stream.stop(); } catch (e) { /* gone */ }
  const chrome = S.chrome || S.chromeTried;
  try { if (chrome && chrome.sock) chrome.sock.close(); if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  try { if (S.R) S.R.stop(); } catch (e) { /* gone */ }
  S.others.forEach(function (o) { try { o.stop(); } catch (e) { /* gone */ } });
  try { if (S.N && S.N.child) S.N.child.kill(); } catch (e) { /* gone */ }
  try { if (S.N && S.N.root) fs.rmSync(S.N.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});

// a seat taken: the row says so, with no one asking
test.run('the relay mails a join code', 0.2, async function () {
  S.N = await scratchNode();
  S.R = await scratchFaceRelay({ members: [] });
  if (!S.N.up || !S.R.up) return NO_NODE;
  S.me = (await home(S.N.base, 'node.card')).body.publicKey;
  S.stream = stream(S.N.base);
  S.key = S.R.relayKey;
  S.up = true;
  await home(S.N.base, 'relay.add', { url: S.R.base, label: 'scratch' });
  await home(S.N.base, 'relay.join', { url: S.R.base, email: MAIL });
  await until(function () { return S.R.mailed.length > 0; }, 5000);
  S.code = joinCode(S.R);
  return !!S.code || 'no join code: nothing judged';
}, 15000);
const NO_SEAT = 'no join code: nothing judged';
test.run('claimed is on the row', 0.2, async function () {
  if (!S.code) return NO_SEAT;
  await home(S.N.base, 'relay.join', { url: S.R.base, email: MAIL, code: S.code });
  await until(function () { const r = last(S.key); return !!r && r.claimed === true && r.status === 200; }, 10000);
  S.seated = last(S.key) || {};
  return S.seated.claimed === true || 'the last row: ' + short(S.seated);
}, 12000);
test.run('status is on the row, the stream held', 0.2, function () {
  if (!S.seated) return NO_SEAT;
  return S.seated.status === 200 || 'the last row: ' + short(S.seated);
}, 1000);
test.run('services are on the row, from the relay\'s card', 0.2, function () {
  if (!S.seated) return NO_SEAT;
  return (!!S.seated.services && S.seated.services.sendMail === true) || 'the last row: ' + short(S.seated);
}, 1000);
test.run('the roll is on the row', 0.2, function () {
  if (!S.seated) return NO_SEAT;
  return (!!S.seated.roll && S.seated.roll.relayKey === S.key) || 'the last row: ' + short(S.seated);
}, 1000);
test.run('owned is on the row: false, no report has come', 0.2, function () {
  if (!S.seated) return NO_SEAT;
  return S.seated.owned === false || 'the last row: ' + short(S.seated);
}, 1000);

// the relay gone and back, and now naming this node its owner: the row follows
const NO_BACK = 'the relay did not come back: nothing judged';
test.run('the relay comes back with this node as its owner', 0.2, async function () {
  if (!S.seated) return NO_SEAT;
  S.report0 = S.stream.kept.length;
  S.back = await S.R.becomeOwned(S.me);
  return !!S.back || NO_BACK;
}, 1000);
test.run('while it was gone the row said status 0', 0.2, function () {
  if (!S.back) return NO_BACK;
  return rowsOf(S.key).some(function (r) { return r.status === 0; }) || 'no row said the stream dropped: ' + short(rowsOf(S.key).map(function (r) { return r.status; }));
}, 1000);
test.run('back: status 200 and owned true, on the row', 0.2, async function () {
  if (!S.back) return NO_BACK;
  await until(function () { const r = last(S.key); return !!r && r.owned === true && r.status === 200; }, 20000);
  S.ownedRow = last(S.key) || {};
  return (S.ownedRow.status === 200 && S.ownedRow.owned === true) || 'the last row: ' + short(S.ownedRow);
}, 7000);
test.run('and the roll names this node its owner', 0.2, function () {
  if (!S.ownedRow) return NO_BACK;
  return (!!S.ownedRow.roll && S.ownedRow.roll.ownerKey === S.me) || 'the last row: ' + short(S.ownedRow);
}, 1000);

// a report arrives: it is on the stream, whole, and not on the row
test.run('the relay event carries the report', 0.2, async function () {
  if (!S.back) return NO_BACK;
  await until(function () { return S.stream.kept.slice(S.report0).some(function (e) { return e.kind === 'relay-event' && e.data && e.data.report; }); }, 20000);
  const rep = S.stream.kept.slice(S.report0).filter(function (e) { return e.kind === 'relay-event' && e.data && e.data.report; }).pop();
  return (!!rep && rep.data.kind === 'status' && typeof rep.data.report === 'object' && Object.keys(rep.data.report).length > 0) || 'relay events: ' + short(S.stream.kept.slice(S.report0).filter(function (e) { return e.kind === 'relay-event'; }).map(function (e) { return e.data; }));
}, 1000);
// Rows reach every face, starred or not, and a report lists invites.
test.run('no row carries a report', 0.2, function () {
  if (!S.back) return NO_BACK;
  return rowsOf(S.key).every(function (r) { return r.report === undefined; }) || 'a row with a report: ' + short(rowsOf(S.key).filter(function (r) { return r.report !== undefined; })[0]);
}, 1000);

// a card that changes: the row's label follows
const LABEL = 'zzRenamed';
test.run('the owner renames the relay', 0.2, async function () {
  if (!S.up) return NO_NODE;
  const rn = await home(S.N.base, 'peer.post', { to: S.key, text: JSON.stringify({ app: 'relay', body: { relayLabel: { label: LABEL } } }) });
  return rn.status === 200 || 'relayLabel: ' + rn.status + ' ' + short(rn.text);
}, 1000);
test.run('the row says the new label', 0.2, async function () {
  if (!S.up) return NO_NODE;
  await until(function () { const r = last(S.key); return !!r && !!r.roll && r.roll.relayLabel === LABEL; }, 8000);
  return ((last(S.key) || {}).roll || {}).relayLabel === LABEL || 'the last row: ' + short(last(S.key));
}, 1000);

// a relay's detail: the contact detail, configured with its row
test.run('spirit/element/search/contact/detailElement.js is there', 0.2, function () {
  return fs.existsSync(path.join(RUN, 'spirit/element/search/contact/detailElement.js')) || 'no spirit/element/search/contact/detailElement.js';
}, 1000);
test.run('and natterDetails is gone', 0.2, function () {
  return !fs.existsSync(path.join(RUN, 'spirit/element/natterDetails')) || 'spirit/element/natterDetails is still there';
}, 1000);
test.run('detailElement.create(host, { key, relay: true }) draws it', 0.2, async function () {
  if (!S.up) return NO_NODE;
  const where = findChrome();
  if (!where) return 'no Chrome here: the panel is not judged';
  const chrome = await chromePage(where);
  S.chromeTried = chrome;
  if (chrome.error) return 'Chrome: ' + chrome.error;
  // The shell Andy uses, at home as on a relay: boot.js. The older page at / loads every element up front and would hide a
  // panel that forgets to load its own.
  await chrome.send('Page.navigate', { url: S.N.base + '/face.html' });
  await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.require)'); }, 20000);
  await sleep(3000);
  const mounted = await chrome.evaluate('Promise.resolve(window.spirit.require("spirit/element/search/contact/detailElement.js")).then(function () { var E = window.spirit.element.spirit.element.search.contact.detailElement; if (!E || typeof E.create !== "function") return "no create"; var h = document.createElement("div"); h.id = "zzPanel"; document.body.appendChild(h); window.__panel = E.create(h, { key: ' + JSON.stringify(S.key) + ', relay: true }); return "ok"; }, function (e) { return "refused: " + e.message; })');
  if (mounted !== 'ok') return 'the panel: ' + short(mounted);
  S.chrome = chrome;
  return true;
}, 12000);
test.run('it paints the relay\'s label', 0.2, async function () {
  if (!S.chrome) return NO_CHROME;
  await until(function () { return panelText().then(function (t) { return t.indexOf(LABEL) !== -1; }); }, 8000);
  return (await panelText()).indexOf(LABEL) !== -1 || 'the panel says: ' + short(await panelText());
}, 2000);

// Andy: "the folding panel "⭐ Star this relay" must use the same heading and style al all the other folding panels in relayPanel."
// the star is a folding panel like the others
const FOLDS = 'Array.prototype.slice.call(document.querySelectorAll("#zzPanel .nd-fold"))';
test.run('its heading stands among the others', 0.2, async function () {
  if (!S.chrome) return NO_CHROME;
  S.star = await S.chrome.evaluate('(function () { var all = ' + FOLDS + '; var s = all.filter(function (h) { return h.textContent.indexOf("Star this relay") !== -1; })[0]; var o = all.filter(function (h) { return h !== s; })[0]; if (!s || !o) return { star: !!s, other: !!o }; return { star: true, other: true, sameHeading: s.className === o.className && s.tagName === o.tagName, sameTile: s.parentElement.className.split(" ").slice(0, 2).join(" ") === o.parentElement.className.split(" ").slice(0, 2).join(" "), mark: !!s.querySelector(".nd-fold-mark"), details: !!document.querySelector("#zzPanel details"), buttonWhileShut: !!document.querySelector("#zzPanel .nd-own") }; }())');
  return (!!S.star && S.star.star && S.star.other) || 'the folds: ' + short(S.star);
}, 1000);
test.run('with the same heading, tile and fold mark', 0.2, function () {
  if (!S.chrome) return NO_CHROME;
  return (!!S.star && S.star.sameHeading && S.star.sameTile && S.star.mark) || 'the star: ' + short(S.star);
}, 1000);
test.run('and no fold of its own', 0.2, function () {
  if (!S.chrome) return NO_CHROME;
  return (!!S.star && S.star.details === false) || 'the star: ' + short(S.star);
}, 1000);
test.run('it arrives shut: its button is not shown', 0.2, function () {
  if (!S.chrome) return NO_CHROME;
  return (!!S.star && S.star.buttonWhileShut === false) || 'the star: ' + short(S.star);
}, 1000);
test.run('pressed, it opens and holds its button', 0.2, async function () {
  if (!S.chrome) return NO_CHROME;
  await S.chrome.evaluate('(function () { var s = ' + FOLDS + '.filter(function (h) { return h.textContent.indexOf("Star this relay") !== -1; })[0]; if (s) s.click(); }())');
  await sleep(500);
  const opened = await S.chrome.evaluate('(function () { var b = document.querySelector("#zzPanel .nd-own"); return !!b && b.closest(".stat-tile").textContent.indexOf("Star this relay") !== -1; }())');
  return opened === true || 'the star opened: ' + short(opened);
}, 2000);

// Andy: "the folding panel "A face name" should actually show the faceForm, unless the relay is "starred"", "that's one bug,
// and one design change.", "bug: "A face name" doesn't show the faceForm.", "change: don't show it if the relay is starred...".
// TURNED ROUND SINCE: goal/G43.18's box (v29), Andy: "on the home node, NO face is offered (faceForm hides itself) for a
// relay without star." relayPanel's ndFaceHtml asks faceForm.offers, which offers a starred relay only, so the fold
// shows only when starred: the checks below assert G41.32's rule and fail against it.
// "A face name" shows the faceForm, unless the relay is starred
const faceHead = 'Array.prototype.slice.call(document.querySelectorAll("#zzPanel .nd-fold")).filter(function (h) { return h.textContent.indexOf("A face name") !== -1; })[0]';
const hasFaceHead = function () { return S.chrome.evaluate('!!(' + faceHead + ')'); };
test.run('with no star, its fold stands', 0.2, async function () {
  if (!S.chrome) return NO_CHROME;
  await until(hasFaceHead, 5000);
  return (await hasFaceHead()) || 'no "A face name" fold: ' + short(await panelText());
}, 16000);
test.run('opened, it holds the faceForm: its field and its button', 0.2, async function () {
  if (!S.chrome) return NO_CHROME;
  await S.chrome.evaluate('(function () { var h = ' + faceHead + '; if (h) h.click(); }())');
  await until(function () { return S.chrome.evaluate('!!document.querySelector("#zzPanel .nd-face-form input")'); }, 5000);
  const drawn = await S.chrome.evaluate('(function () { var f = document.querySelector("#zzPanel .nd-face-form"); return f ? { input: !!f.querySelector("input"), button: !!f.querySelector("button"), text: f.textContent.slice(0, 80) } : null; }())');
  return (!!drawn && drawn.input && drawn.button) || 'the fold holds: ' + short(drawn);
}, 16000);
test.run('the star on, at home', 0.2, async function () {
  if (!S.up) return NO_NODE;
  const sOn = await home(S.N.base, 'contact.own', { key: S.key, own: true });
  return sOn.status === 200 || 'contact.own: ' + sOn.status + ' ' + short(sOn.text);
}, 1000);
test.run('starred: the fold is gone, with no reload', 0.2, async function () {
  if (!S.chrome) return NO_CHROME;
  await until(function () { return hasFaceHead().then(function (h) { return !h; }); }, 5000);
  return !(await hasFaceHead()) || 'starred, "A face name" is still there';
}, 16000);
test.run('the star off, at home', 0.2, async function () {
  if (!S.up) return NO_NODE;
  const sOff = await home(S.N.base, 'contact.own', { key: S.key, own: false });
  return sOff.status === 200 || 'contact.own false: ' + sOff.status + ' ' + short(sOff.text);
}, 1000);
test.run('and it comes back', 0.2, async function () {
  if (!S.chrome) return NO_CHROME;
  await until(hasFaceHead, 5000);
  return (await hasFaceHead()) || 'the star off, "A face name" did not come back';
}, 16000);

// it listens, shown or hidden, and asks no one again
const asks = function () { return S.chrome.heard.filter(function (m) { return m.method === 'Network.requestWillBeSent' && /"call":"relay\.(status|get)"/.test(String((m.params.request || {}).postData || '')); }).length; };
const NEW1 = 'zzNameOne';
const NEW2 = 'zzNameTwo';
test.run('shown: the new label is painted', 0.2, async function () {
  if (!S.chrome) return NO_CHROME;
  S.asked = asks();
  await home(S.N.base, 'peer.post', { to: S.key, text: JSON.stringify({ app: 'relay', body: { relayLabel: { label: NEW1 } } }) });
  await until(function () { return panelText().then(function (t) { return t.indexOf(NEW1) !== -1; }); }, 8000);
  return (await panelText()).indexOf(NEW1) !== -1 || 'the panel says: ' + short(await panelText());
}, 3000);
test.run('and no relay.status or relay.get was asked for it', 0.2, function () {
  if (S.asked === undefined) return NO_CHROME;
  return asks() === S.asked || (asks() - S.asked) + ' reads were asked for one change';
}, 1000);
test.run('hidden: the new label is painted all the same', 0.2, async function () {
  if (!S.chrome) return NO_CHROME;
  await S.chrome.evaluate('document.getElementById("zzPanel").style.display = "none"; 1');
  await home(S.N.base, 'peer.post', { to: S.key, text: JSON.stringify({ app: 'relay', body: { relayLabel: { label: NEW2 } } }) });
  await until(function () { return panelText().then(function (t) { return t.indexOf(NEW2) !== -1; }); }, 8000);
  const said = await panelText();
  await S.chrome.evaluate('document.getElementById("zzPanel").style.display = ""; 1');
  return said.indexOf(NEW2) !== -1 || 'hidden, the panel says: ' + short(said);
}, 3000);

// it follows only its row
// Another relay's row, joined and not owned: a panel that listened to it would stop saying this relay is owned.
test.run('a second relay comes up', 0.2, async function () {
  if (!S.chrome) return NO_CHROME;
  S.before = await panelText();
  S.Other = await scratchFaceRelay({ members: [] });
  S.others.push(S.Other);
  return !!S.Other.up || 'the second relay did not come up: nothing judged';
}, 4000);
test.run('the other relay\'s row, seated and not owned, is on the stream', 0.2, async function () {
  if (!S.Other) return 'no second relay';
  const Other = S.Other;
  await home(S.N.base, 'relay.add', { url: Other.base, label: 'zzOtherRelay' });
  await home(S.N.base, 'relay.join', { url: Other.base, email: MAIL });
  await until(function () { return Other.mailed.length > 0; }, 5000);
  await home(S.N.base, 'relay.join', { url: Other.base, email: MAIL, code: joinCode(Other) });
  await until(function () { const r = last(Other.relayKey); return !!r && r.claimed === true && r.owned === false; }, 10000);
  const otherRow = last(Other.relayKey) || {};
  return (otherRow.claimed === true && otherRow.owned === false) || 'nothing judged: ' + short(otherRow);
}, 15000);
test.run('and nothing of it reaches this panel', 0.2, async function () {
  if (S.before === undefined) return NO_CHROME;
  await sleep(1000);
  const now = await panelText();
  return now === S.before || 'it repainted for another relay\'s row: ' + short(now);
}, 4000);

// gone from the page, it stops
test.run('it has a destroy', 0.2, async function () {
  if (!S.chrome) return NO_CHROME;
  S.mark = S.chrome.heard.length;
  const gone = await S.chrome.evaluate('(function () { if (!window.__panel || typeof window.__panel.destroy !== "function") return false; window.__panel.destroy(); return true; }())');
  return gone === true || 'no destroy on the panel';
}, 1000);
test.run('a later change neither throws nor paints', 0.2, async function () {
  if (S.mark === undefined) return NO_CHROME;
  await home(S.N.base, 'peer.post', { to: S.key, text: JSON.stringify({ app: 'relay', body: { relayLabel: { label: 'zzNameThree' } } }) });
  await sleep(1500);
  const threw = S.chrome.heard.slice(S.mark).filter(function (m) { return m.method === 'Runtime.exceptionThrown'; }).map(function (m) { return m.params.exceptionDetails.text; });
  const now = await panelText();
  return (!threw.length && now.indexOf('zzNameThree') === -1) || 'after destroy: ' + short(threw) + ' ' + short(now);
}, 6000);

// THE FACE FORM OFFERS MEMBERS' RELAYS WITH NO STAR (goal/G41.32; Andy: "show only relays in the relay-dropdown that the node is
// a member of AND are not starred.", "if there are no relays that satisfy the requirement, don't display the form at all.",
// "faceForm provides that check as a function", "info-app: don't show the faceForm, if the faceForm says it shouldn't be
// displayed"; and of following the rows with no read: "agreed."). This node sits on two relays here, neither starred.
// TURNED ROUND SINCE: goal/G43.18's box (v29), Andy: "on the home node, NO face is offered (faceForm hides itself) for a
// relay without star." faceForm.js offers a starred relay only, so the checks below assert G41.32's rule and fail against it.
// the face form: its check, as a function
const NO_OFFERS = 'no faceForm.offers';
test.run('faceForm.offers(relays) is there', 0.2, async function () {
  if (!S.chrome) return NO_CHROME;
  await S.chrome.send('Page.navigate', { url: S.N.base + '/face.html' });
  await until(function () { return S.chrome.evaluate('!!(window.spirit && window.spirit.require)'); }, 20000);
  await sleep(3000);
  S.check = await S.chrome.evaluate('Promise.resolve(window.spirit.require("spirit/element/faceForm.js")).then(function () { var F = window.spirit.element.spirit.element.faceForm; if (!F || typeof F.offers !== "function") return null; var u = "http://x"; return { member: F.offers([{ url: u, claimed: true, mine: false }]), owner: F.offers([{ url: u, owned: true, mine: false }]), starred: F.offers([{ url: u, claimed: true, mine: true }]), stranger: F.offers([{ url: u, claimed: false, owned: false, mine: false }]), none: F.offers([]), one: F.offers([{ url: u, claimed: true, mine: true }, { url: "http://y", claimed: true, mine: false }]) }; })');
  return !!S.check || NO_OFFERS;
}, 10000);
test.run('true for a relay this node is a member of or owns, with no star', 0.2, function () {
  if (!S.check) return NO_OFFERS;
  return (S.check.member === true && S.check.owner === true && S.check.one === true) || 'offers: ' + short(S.check);
}, 1000);
test.run('false for a starred relay, one it holds no seat on, and for none', 0.2, function () {
  if (!S.check) return NO_OFFERS;
  return (S.check.starred === false && S.check.stranger === false && S.check.none === false) || 'offers: ' + short(S.check);
}, 1000);

// Info: the form offers members' relays with no star, and follows the star with no reload
const options = function () { return S.chrome.evaluate('JSON.stringify(Array.prototype.slice.call(document.querySelectorAll("[data-info=\\"face\\"] .sp-face-relay option")).map(function (o) { return o.value; }))').then(function (t) { return JSON.parse(t || '[]'); }); };
const tileShown = function () { return S.chrome.evaluate('(function () { var b = document.querySelector("[data-info=\\"face\\"]"); return !!b && b.offsetParent !== null && !!b.querySelector(".sp-face-relay"); }())'); };
const emptyTile = function () { return S.chrome.evaluate('(function () { var b = document.querySelector("[data-info=\\"face\\"]"); return !!b && b.offsetParent !== null; }())'); };
const infoReads = function () { return S.chrome.heard.filter(function (m) { return m.method === 'Network.requestWillBeSent' && /"call":"(relay\.(status|get)|contact\.search)"/.test(String((m.params.request || {}).postData || '')); }).length; };
const NO_OTHER = 'no second relay';
test.run('neither starred: it offers both', 0.2, async function () {
  if (!S.chrome) return NO_CHROME;
  if (!S.Other) return NO_OTHER;
  await S.chrome.evaluate('(function () { var e = Array.prototype.slice.call(document.querySelectorAll("*")).filter(function (x) { return x.offsetParent !== null && !x.children.length && x.textContent.trim() === "Info"; })[0]; if (e) e.click(); }())');
  await until(function () { return options().then(function (o) { return o.length >= 2; }); }, 8000);
  const both = await options();
  return (both.indexOf(S.R.base) !== -1 && both.indexOf(S.Other.base) !== -1) || 'it offers: ' + short(both);
}, 25000);
test.run('one starred, no reload: it is gone from the dropdown, the other stays', 0.2, async function () {
  if (!S.chrome) return NO_CHROME;
  if (!S.Other) return NO_OTHER;
  S.readsBefore = infoReads();
  await home(S.N.base, 'contact.own', { key: S.key, own: true });
  await until(function () { return options().then(function (o) { return o.indexOf(S.R.base) === -1; }); }, 5000);
  const oneLeft = await options();
  return (oneLeft.indexOf(S.R.base) === -1 && oneLeft.indexOf(S.Other.base) !== -1) || 'it offers: ' + short(oneLeft);
}, 16000);
test.run('and the form followed the row, reading nothing', 0.2, function () {
  if (S.readsBefore === undefined) return NO_CHROME;
  return infoReads() === S.readsBefore || (infoReads() - S.readsBefore) + ' reads for one star';
}, 1000);
test.run('both starred: no form, and no empty tile left in Info', 0.2, async function () {
  if (!S.chrome) return NO_CHROME;
  if (!S.Other) return NO_OTHER;
  await home(S.N.base, 'contact.own', { key: S.Other.relayKey, own: true });
  await until(function () { return emptyTile().then(function (t) { return !t; }); }, 5000);
  return (!(await tileShown()) && !(await emptyTile())) || 'with both starred: form ' + (await tileShown()) + ', its tile ' + (await emptyTile());
}, 16000);
test.run('one star off: the form is back, offering that relay', 0.2, async function () {
  if (!S.chrome) return NO_CHROME;
  if (!S.Other) return NO_OTHER;
  await home(S.N.base, 'contact.own', { key: S.Other.relayKey, own: false });
  await until(tileShown, 5000);
  const offeredBack = await options();
  return ((await tileShown()) && offeredBack.indexOf(S.Other.base) !== -1 && offeredBack.indexOf(S.R.base) === -1) || 'form ' + (await tileShown()) + ', it offers ' + short(offeredBack);
}, 1000);

// A RELAY THIS NODE IS NOT A MEMBER OF CANNOT BE STARRED (goal/G41.32; Andy: "a relay I'm not a member of can not be starred
// (relays i own automatically give me membership)"). At the node's own door, so no screen can get round it.
// only a relay this node is a member of or owns can be starred
const NO_FAR = 'no third relay';
test.run('a third relay comes up', 0.2, async function () {
  if (!S.up) return NO_NODE;
  S.Far = await scratchFaceRelay({ members: [] });
  S.others.push(S.Far);
  return !!S.Far.up || 'the third relay did not come up: nothing judged';
}, 3000);
test.run('listed, no seat: contact.own is refused at home, with a code', 0.2, async function () {
  if (!S.Far) return NO_FAR;
  await home(S.N.base, 'relay.add', { url: S.Far.base, label: 'zzFar' });
  await until(function () { return rowsOf(S.Far.relayKey).length > 0; }, 8000);
  const farNo = await home(S.N.base, 'contact.own', { key: S.Far.relayKey, own: true });
  return (farNo.status >= 400 && farNo.status < 500 && !!(farNo.body && farNo.body.code)) || 'contact.own of a relay with no seat: ' + farNo.status + ' ' + short(farNo.text);
}, 2000);
test.run('and no star lands', 0.2, async function () {
  if (!S.Far) return NO_FAR;
  return !(await starred(S.Far.relayKey)) || 'a relay with no seat has a star';
}, 1000);
test.run('taking away a star it does not have changes nothing', 0.2, async function () {
  if (!S.Far) return NO_FAR;
  const farOwnOff = await home(S.N.base, 'contact.own', { key: S.Far.relayKey, own: false });
  const pass = !(await starred(S.Far.relayKey));
  // A node that is no relay: what contact.own answers is said, not judged; this rule is about relays alone.
  S.person = require(path.join(RUN, 'spirit', 'relayAuth.js')).generateIdentity('zzPuppet').publicKey;
  await home(S.N.base, 'contact.block', { publicKey: S.person });
  const personAns = await home(S.N.base, 'contact.own', { key: S.person, own: true });
  test.comment('a node that is no relay, contact.own answers ' + personAns.status + ': this rule is about relays alone');
  return pass || 'after own false (answered ' + farOwnOff.status + ') it has a star';
}, 3000);

// its panel offers no star there
test.run('the panel draws for it', 0.2, async function () {
  if (!S.chrome) return NO_CHROME;
  if (!S.Far) return NO_FAR;
  const farPanel = await S.chrome.evaluate('Promise.resolve(window.spirit.require("spirit/element/search/contact/detailElement.js")).then(function () { var h = document.createElement("div"); h.id = "zzFar"; document.body.appendChild(h); window.spirit.element.spirit.element.search.contact.detailElement.create(h, { key: ' + JSON.stringify(S.Far.relayKey) + ', relay: true }); return "ok"; })');
  await until(function () { return S.chrome.evaluate('document.querySelectorAll("#zzFar .nd-fold").length > 0'); }, 8000);
  S.farStar = await S.chrome.evaluate('Array.prototype.slice.call(document.querySelectorAll("#zzFar .nd-fold")).filter(function (h) { return h.textContent.indexOf("Star this relay") !== -1; }).length');
  return (farPanel === 'ok' && await S.chrome.evaluate('document.querySelectorAll("#zzFar .nd-fold").length > 0')) || 'no panel for a relay with no seat';
}, 1000);
test.run('with no star fold', 0.2, function () {
  if (S.farStar === undefined) return 'no panel for the third relay';
  return S.farStar === 0 || 'a relay with no seat offers a star';
}, 1000);

// a member can star it; leaving takes the star away
// Leaving: read from his ruling, and Q21 asks him outright (ubi: "a relay you have left keeps its star"); if he says no, these two checks go.
test.run('joined: the star goes on', 0.2, async function () {
  if (!S.Far) return NO_FAR;
  await home(S.N.base, 'relay.join', { url: S.Far.base, email: MAIL });
  await until(function () { return S.Far.mailed.length > 0; }, 5000);
  await home(S.N.base, 'relay.join', { url: S.Far.base, email: MAIL, code: joinCode(S.Far) });
  await until(function () { const r = last(S.Far.relayKey); return !!r && r.claimed === true; }, 10000);
  const farYes = await home(S.N.base, 'contact.own', { key: S.Far.relayKey, own: true });
  return (farYes.status === 200 && await starred(S.Far.relayKey)) || 'contact.own of a member\'s relay: ' + farYes.status + ' ' + short(farYes.text);
}, 25000);
test.run('it leaves the relay: its row holds no seat', 0.2, async function () {
  if (!S.Far) return NO_FAR;
  // The first ask may still be waiting for the relay's card, as relay.face's does.
  let left = null;
  for (let i = 0; i < 8; i++) { left = await home(S.N.base, 'relay.leave', { key: S.Far.base }); if (left.status < 300 || left.status === 404) break; await sleep(2000); }
  await until(function () { const r = last(S.Far.relayKey); return !!r && r.claimed === false; }, 8000);
  return ((last(S.Far.relayKey) || {}).claimed) === false || 'relay.leave: ' + left.status + ' ' + short(left.text) + ', row ' + short(last(S.Far.relayKey));
}, 36000);
test.run('and the star is gone with the seat', 0.2, async function () {
  if (!S.Far) return NO_FAR;
  await until(function () { return starred(S.Far.relayKey).then(function (x) { return !x; }); }, 5000);
  return !(await starred(S.Far.relayKey)) || 'it left the relay and the star stayed';
}, 1000);
test.run('and cannot be put back', 0.2, async function () {
  if (!S.Far) return NO_FAR;
  const notAgain = await home(S.N.base, 'contact.own', { key: S.Far.relayKey, own: true });
  return (notAgain.status >= 400 && notAgain.status < 500) || 'contact.own after leaving: ' + notAgain.status + ' ' + short(notAgain.text);
}, 1000);

// a relay this node owns counts as membership
const NO_OWN = 'no relay naming this node its owner';
test.run('a relay naming this node its owner comes up', 0.2, async function () {
  if (!S.up) return NO_NODE;
  S.Own = await scratchFaceRelay({ members: [], ownerKey: S.me });
  S.others.push(S.Own);
  return !!S.Own.up || 'it did not come up: nothing judged';
}, 3000);
test.run('its report has come: owned', 0.2, async function () {
  if (!S.Own) return NO_OWN;
  const Own = S.Own;
  await home(S.N.base, 'relay.add', { url: Own.base, label: 'zzOwned' });
  await home(S.N.base, 'relay.join', { url: Own.base, email: MAIL });
  await until(function () { return Own.mailed.length > 0; }, 5000);
  const ownCode = joinCode(Own);
  if (ownCode) await home(S.N.base, 'relay.join', { url: Own.base, email: MAIL, code: ownCode });
  await until(function () { const r = last(Own.relayKey); return !!r && r.owned === true; }, 20000);
  const ownedRow2 = last(Own.relayKey) || {};
  return ownedRow2.owned === true || 'no report: nothing judged: ' + short(ownedRow2);
}, 19000);
test.run('owned: the star goes on', 0.2, async function () {
  if (!S.Own) return NO_OWN;
  const ownYes = await home(S.N.base, 'contact.own', { key: S.Own.relayKey, own: true });
  return (ownYes.status === 200 && await starred(S.Own.relayKey)) || 'contact.own of an owned relay: ' + ownYes.status + ' ' + short(ownYes.text);
}, 1000);

// Andy: "the contact list should do something to mark a relay, like print its label in bold-italic."
// the contact list marks a relay: its label in bold italic
const styleOf = function (words) { return S.chrome.evaluate('(function () { var e = Array.prototype.slice.call(document.querySelectorAll("*")).filter(function (x) { return x.offsetParent !== null && !x.children.length && x.textContent.trim() === ' + JSON.stringify(words) + '; })[0]; if (!e) return null; var c = getComputedStyle(e); return { weight: Number(c.fontWeight), style: c.fontStyle }; }())'); };
test.run('a relay\'s label is bold and italic', 0.2, async function () {
  if (!S.chrome) return NO_CHROME;
  if (!S.person) return 'no person\'s row was made';
  await home(S.N.base, 'contact.label', { publicKey: S.person, myLabel: 'zzPersonRow' });
  await home(S.N.base, 'contact.unblock', { publicKey: S.person });
  await home(S.N.base, 'contact.accept', { publicKey: S.person });
  await S.chrome.send('Page.navigate', { url: S.N.base + '/face.html' });
  await until(function () { return S.chrome.evaluate('!!(window.spirit && window.spirit.require)'); }, 20000);
  await sleep(3000);
  await S.chrome.evaluate('(function () { var e = Array.prototype.slice.call(document.querySelectorAll("*")).filter(function (x) { return x.offsetParent !== null && !x.children.length && x.textContent.trim() === "Contacts"; })[0]; if (e) e.click(); }())');
  await until(function () { return styleOf('scratch'); }, 8000);
  const relayLook = await styleOf('scratch');
  S.listed = true;
  return (!!relayLook && relayLook.weight >= 700 && relayLook.style === 'italic') || 'a relay\'s label: ' + short(relayLook);
}, 14000);
test.run('a person is listed too', 0.2, async function () {
  if (!S.listed) return 'the contact list was not opened';
  await until(function () { return styleOf('zzPersonRow'); }, 5000);
  S.personLook = await styleOf('zzPersonRow');
  return !!S.personLook || 'no person\'s row: the difference is not judged';
}, 1000);
test.run('and a person\'s label is not', 0.2, function () {
  if (!S.listed) return 'the contact list was not opened';
  return (!!S.personLook && !(S.personLook.weight >= 700 && S.personLook.style === 'italic')) || 'a person\'s label: ' + short(S.personLook);
}, 1000);
