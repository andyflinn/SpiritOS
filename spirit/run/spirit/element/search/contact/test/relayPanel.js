'use strict';

// spirit/run/spirit/element/search/contact/test/relayPanel.js
// The tests of spirit/element/search/contact/relayPanel.js, and of no other module (spec: ./relayPanel.md; goal/G41.9).
// The browser file runs in node on a window of its own, on a small DOM (markup parsed into a tree, selectors, clicks
// that bubble); the navigation, the node behind the page's api, the relay family and the armingButton element are
// recorders.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'relayPanel.js');
const SRC = fs.readFileSync(FILE, 'utf8');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
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
const ALLOC = { ok: true, onFile: { ramLimitMB: 256, discLimitMB: 2048 }, running: { ramLimitMB: 256, discLimitMB: 2048, members: 10, atRestMB: 40 },
  room: { ramMaxMB: 1024, discMaxMB: 8192 }, roll: { discUsedMB: 1 } };
function world(rows, relayStatus) {
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
    events: { subscribe: function (h) { (w.streams = w.streams || []).push(h); return function () {}; } },
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
  w.open = function (key) { const box = document.createElement('div'); document.body.appendChild(box); w.box = box; return win.spirit.element.spirit.element.search.contact.relayPanel.create(box, { key: key, layer: layer }); };
  vm.createContext(win);
  vm.runInContext(SRC, win, { filename: FILE });
  w.win = win;
  return w;
}
function armingFor(w, label) { return w.armings.filter(function (a) { return a.label === label; }).pop() || null; }
function inPage(w, button) { let e = button; while (e) { if (e === w.box) return true; e = e.parentNode; } return false; }
async function press(w, selector) { const el = w.document.querySelector(selector); if (el) { el.click(); await settle(); } return el; }

const OWNED_URL = 'https://mine.example';
const SEAT_URL = 'https://seat.example';
const OWNED = [{ key: 'RK', url: OWNED_URL, label: 'mine', status: 200, owned: true, claimed: true, claimedLabel: 'andy', roll: { relayKey: 'RK', relayLabel: 'Mine' } }];
const OWNED_SAID = {};
OWNED_SAID[OWNED_URL] = { key: 'RK', invites: [{ label: 'saint', expiresAt: '2099-01-01T00:00:00Z', invitedBy: 'andy' }] };
const SEATED = [{ key: 'RK2', url: SEAT_URL, label: 'seat', status: 200, owned: false, claimed: true, claimedLabel: 'andy', roll: { relayKey: 'RK2', relayLabel: 'Seat' } }];

test.startTest('relayPanel.js: its are-you-sure buttons are armingButtons (goal/G41.9)');

(async function () {
  test.subHeading('nothing hand-rolled is left');
  const code = SRC.replace(/\/\/.*$/gm, '');
  ok(!/data-armed/.test(code), 'no data-armed in its code', 'relayPanel.js still reads or writes data-armed');
  ok(!/armUntilElsewhere/.test(code), 'no armUntilElsewhere of its own', 'relayPanel.js still calls armUntilElsewhere');
  ok(!/classList\.(add|toggle)\(\s*['"]armed['"]/.test(code), 'no armed class', 'relayPanel.js still sets an armed class');

  const w = world(OWNED, OWNED_SAID);
  test.subHeading('it loads armingButton itself (goal/G41.3)');
  ok(w.required.indexOf('spirit/element/armingButton.js') !== -1, 'it requires spirit/element/armingButton.js through spirit.require', 'required: ' + short(w.required));
  const E = w.win.spirit.element.spirit.element.search.contact.relayPanel;
  ok(!!E && typeof E.create === 'function' && E.open === undefined, 'it is window.spirit.element.spirit.element.search.contact.relayPanel, made by create; no open of its own: it opens as a panel (goal/G43.18)', 'relayPanel: create ' + typeof (E && E.create) + ', open ' + typeof (E && E.open));
  if (!E) return;
  w.open('RK');
  await settle();
  await press(w, '.nd-group-fold');

  test.subHeading('Restart, in Memory and disc, is an arming button');
  await press(w, '[data-fold="allocation"]');
  const restart = armingFor(w, 'Restart');
  ok(!!restart, 'Restart is made by armingButton', 'armings: ' + short(w.armings.map(function (a) { return a.label; })));
  if (restart) {
    ok(restart.opts.armedLabel === 'Restart? Every stream drops', 'armed, it says Restart? Every stream drops', 'armedLabel: ' + short(restart.opts.armedLabel));
    ok(!('api' in restart.opts) && inPage(w, restart.button), 'handed no api, and in the page', 'api ' + ('api' in restart.opts) + ', in page ' + inPage(w, restart.button));
    const before = w.posts.length;
    if (typeof restart.opts.run === 'function') await restart.opts.run();
    await settle();
    const asked = w.posts.slice(before).filter(function (p) { return p.body && p.body.config && p.body.config.restart; })[0];
    ok(asked && asked.key === 'RK' && asked.app === 'relay' && Object.keys(asked.body.config).join() === 'restart', 'its run posts the relay config { restart: true } and nothing else', 'posts: ' + short(w.posts.slice(before)));
  }

  test.subHeading('Revoke, on each invite, is an arming button');
  if (!w.document.querySelector('[data-fold="invite"]')) await press(w, '.nd-group-fold');
  await press(w, '[data-fold="invite"]');
  const revoke = armingFor(w, 'Revoke');
  ok(!!revoke, 'an invite\'s Revoke is made by armingButton', 'armings: ' + short(w.armings.map(function (a) { return a.label; })));
  if (revoke) {
    ok(revoke.opts.armedLabel === 'Revoke saint?', 'armed, it names the invite: Revoke saint?', 'armedLabel: ' + short(revoke.opts.armedLabel));
    ok(!('api' in revoke.opts) && inPage(w, revoke.button), 'handed no api, and in the page', 'api ' + ('api' in revoke.opts) + ', in page ' + inPage(w, revoke.button));
    const before = w.posts.length;
    if (typeof revoke.opts.run === 'function') await revoke.opts.run();
    await settle();
    const asked = w.posts.slice(before).filter(function (p) { return p.body && p.body.revoke; })[0];
    ok(asked && asked.key === 'RK' && asked.body.revoke.label === 'saint', 'its run posts the relay revoke { label: saint }', 'posts: ' + short(w.posts.slice(before)));
  }

  test.subHeading('Remove is an arming button, with the reset it lacked');
  await press(w, '[data-fold="remove"]');
  const remove = armingFor(w, 'Remove this relay');
  ok(!!remove, 'Remove is made by armingButton', 'armings: ' + short(w.armings.map(function (a) { return a.label; })));
  if (remove) {
    ok(remove.opts.armedLabel === 'Press again to remove', 'armed, it says Press again to remove', 'armedLabel: ' + short(remove.opts.armedLabel));
    ok(!('api' in remove.opts) && inPage(w, remove.button), 'handed no api: the button hears a click elsewhere itself', 'api ' + ('api' in remove.opts) + ', in page ' + inPage(w, remove.button));
    const before = w.calls.length;
    if (typeof remove.opts.run === 'function') await remove.opts.run();
    await settle();
    const asked = w.calls.slice(before).filter(function (c) { return c.name === 'relay.remove'; })[0];
    ok(asked && asked.body.key === OWNED_URL, 'its run asks relay.remove for this relay', 'asked: ' + short(w.calls.slice(before)));
    ok(w.closed === 1, 'and the page closes once the node says ok', 'closed ' + w.closed);
  }

  test.subHeading('a press on the drawn button asks nothing by itself');
  const w2 = world(OWNED, OWNED_SAID);
  w2.open('RK');
  await settle();
  await press(w2, '[data-fold="remove"]');
  const before2 = w2.calls.length;
  const drawn = await press(w2, '.nd-remove');
  await press(w2, '.nd-remove');
  ok(!!drawn && !w2.calls.slice(before2).some(function (c) { return c.name === 'relay.remove'; }), 'two presses on the drawn Remove remove nothing without the element', 'asked: ' + short(w2.calls.slice(before2).map(function (c) { return c.name; })));

  test.subHeading('Leave, on a relay this node holds a seat on, is an arming button with the reset it lacked');
  const w3 = world(SEATED, {});
  w3.open('RK2');
  await settle();
  await press(w3, '[data-fold="leave"]');
  const leave = armingFor(w3, 'Leave this relay');
  ok(!!leave, 'Leave is made by armingButton', 'armings: ' + short(w3.armings.map(function (a) { return a.label; })));
  if (leave) {
    ok(leave.opts.armedLabel === 'Press again to leave', 'armed, it says Press again to leave', 'armedLabel: ' + short(leave.opts.armedLabel));
    ok(!('api' in leave.opts) && inPage(w3, leave.button), 'handed no api: the button hears a click elsewhere itself', 'api ' + ('api' in leave.opts) + ', in page ' + inPage(w3, leave.button));
    const before = w3.calls.length;
    if (typeof leave.opts.run === 'function') await leave.opts.run();
    await settle();
    const asked = w3.calls.slice(before).filter(function (c) { return c.name === 'relay.leave'; })[0];
    ok(asked && asked.body.key === SEAT_URL, 'its run asks relay.leave for this relay', 'asked: ' + short(w3.calls.slice(before)));
  }
  const w4 = world(SEATED, {});
  w4.open('RK2');
  await settle();
  await press(w4, '[data-fold="leave"]');
  const before4 = w4.calls.length;
  const drawnLeave = await press(w4, '.nd-leave');
  await press(w4, '.nd-leave');
  ok(!!drawnLeave && !w4.calls.slice(before4).some(function (c) { return c.name === 'relay.leave'; }), 'two presses on the drawn Leave leave nothing without the element', 'asked: ' + short(w4.calls.slice(before4).map(function (c) { return c.name; })));

  // THE STAR ON A RELAY (goal/G41.30; Andy: "the message is different for members and owners, showing members who they
  // have to trust, and, if the relay claims to be mine, the message should be slightly different like \"if you DID install
  // this relay on a VSP and you DID set it's DNS records.....\""; "NO signature. just the armingButton, with a precise
  // documentation of the risk."). What a relay's owner field says is that relay's own word, so it reads "says".
  test.subHeading('the star on a relay: an arming button, and who you have to trust');
  const page = function (x) { return x.box ? String(x.box.textContent || '') : ''; };
  const starOf = function (x) { const b = x.document.querySelector('.nd-own'); return b ? x.armings.filter(function (a) { return a.button === b; }).pop() || null : null; };
  const MEMBER = [{ key: 'RK2', url: SEAT_URL, label: 'seat', status: 200, owned: false, claimed: true, claimedLabel: 'andy', mine: false, ownerLabel: 'Olga', roll: { relayKey: 'RK2', relayLabel: 'Seat' } }];
  const w5 = world(MEMBER, {});
  w5.open('RK2');
  await settle();
  await press(w5, '[data-fold="star"]');
  const s5 = starOf(w5);
  ok(!!s5, 'a relay\'s panel draws .nd-own, an arming button', 'armings: ' + short(w5.armings.map(function (a) { return a.label; })));
  ok(/says it is owned by Olga/.test(page(w5)), 'a relay that does not claim this node names who must be trusted, "says it is owned by" its owner', 'the page says: ' + short(page(w5)));
  ok(/run programs/.test(page(w5)) && /change files/.test(page(w5)) && /anyone holding/.test(page(w5)), 'and says that person and anyone holding the relay can run programs and change files on this machine', 'the page says: ' + short(page(w5)));
  ok(!/If you DID install/.test(page(w5)), 'it does not speak of having installed it', 'the page says: ' + short(page(w5)));
  const b5 = w5.calls.length;
  const drawn5 = w5.document.querySelector('.nd-own');
  if (drawn5) { drawn5.click(); await settle(); }
  ok(!!drawn5 && !w5.calls.slice(b5).some(function (c) { return c.name === 'contact.own'; }), 'a press on the button alone sends nothing', 'calls: ' + short(w5.calls.slice(b5)));
  if (s5) { await s5.opts.run(); await settle(); }
  const sent5 = w5.calls.filter(function (c) { return c.name === 'contact.own'; }).pop();
  ok(!!sent5 && sent5.body.key === 'RK2' && sent5.body.own === true, 'its second press sends contact.own {key: the relay\'s key, own: true}', 'sent: ' + short(sent5));
  const CLAIMS = [{ key: 'RK', url: OWNED_URL, label: 'mine', status: 200, owned: true, claimed: true, claimedLabel: 'andy', mine: false, ownerLabel: 'andy', roll: { relayKey: 'RK', relayLabel: 'Mine' } }];
  const w6 = world(CLAIMS, OWNED_SAID);
  w6.open('RK');
  await settle();
  await press(w6, '[data-fold="star"]');
  ok(/If you DID install this relay on a VPS and you DID set its DNS records/.test(page(w6)), 'a relay claiming this node says: "If you DID install this relay on a VPS and you DID set its DNS records"', 'the page says: ' + short(page(w6)));
  ok(/lying/.test(page(w6)), 'and that otherwise it is lying', 'the page says: ' + short(page(w6)));
  ok(!!starOf(w6), 'with the same button', 'armings: ' + short(w6.armings.map(function (a) { return a.label; })));
  const STARRED = [Object.assign({}, CLAIMS[0], { mine: true })];
  const w7 = world(STARRED, OWNED_SAID);
  w7.open('RK');
  await settle();
  await press(w7, '[data-fold="star"]');
  const s7 = starOf(w7);
  if (s7) { await s7.opts.run(); await settle(); }
  const sent7 = w7.calls.filter(function (c) { return c.name === 'contact.own'; }).pop();
  ok(!!sent7 && sent7.body.key === 'RK' && sent7.body.own === false, 'on a starred relay the same button takes the star away', 'sent: ' + short(sent7));
  const w8 = world(MEMBER, {});
  w8.win.spirit.transport = { ask: function () {} };
  w8.open('RK2');
  await settle();
  ok(!!w8.box && !w8.document.querySelector('.nd-own') && !starOf(w8), 'on a face (window.spirit.transport) no button is drawn', 'on a face: .nd-own ' + !!w8.document.querySelector('.nd-own'));

  // WHAT IT NEEDS, IT REQUIRES ITSELF (goal/G43.24; Andy: "anybody can mount any element without knowing what it actually
  // needs...."): the node's verbs and its posts to the relay go through the spirit object; it is handed no api.
  test.subHeading('it asks through the spirit object, and is handed no api');
  ok(!/\bapi\b/.test(code) && !/ndApi/.test(code), 'its code names no api', 'its code still names an api');
  const panelCode = fs.readFileSync(path.join(RUN, 'spirit', 'element', 'search', 'contact', 'relayPanel.js'), 'utf8').replace(/\/\/.*$/gm, '');
  const viaPeerPost = /spirit\.peerPost\(/.test(panelCode);
  const ownEncode = /packet\.encode\(/.test(panelCode);
  ok(viaPeerPost && !ownEncode, 'a post to the relay goes through spirit.peerPost, which puts it in its envelope; the panel encodes no packet of its own', 'its code: peerPost ' + viaPeerPost + ', its own encode ' + ownEncode);
  ok(w.posts.length > 0 && w.posts.every(function (p) { return p.app === 'relay' && p.key === 'RK'; }), 'each post to the relay is a packet for it through peer.post, in its envelope', 'posts: ' + short(w.posts.map(function (p) { return { app: p.app, key: p.key }; })));
  ok(typeof w.title === 'string' && /^Relay Details/.test(w.title), 'its title goes to the layer it is drawn in (options.layer.setTitle)', 'title: ' + short(w.title));
}()).then(function () { test.reportSuccessFailureCount(); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); });
