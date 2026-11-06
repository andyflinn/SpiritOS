'use strict';

// spirit/run/spirit/element/search/contact/test/detailElement.js
// The tests of spirit/element/search/contact/detailElement.js, and of no other module (spec: ./contactDetails.md;
// goal/G41.9). The browser file runs in node on a window of its own, on a small DOM (markup parsed into a tree,
// selectors, clicks that bubble); the navigation, the node behind the page's api, the relay family and the armingButton
// element are recorders.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'detailElement.js');
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
function world(person, relayRows) {
  const document = makeDom();
  const w = { required: [], calls: [], posts: [], armings: [], closed: 0, statusAsked: 0, document: document };
  const answer = function (body) { return Promise.resolve({ status: 200, ok: true, text: JSON.stringify(body), body: body }); };
  const api = {
    verb: function (name, body) {
      w.calls.push({ name: name, body: body });
      if (name === 'contact.get') return answer({ ok: true, person: person });
      return answer({ ok: true });
    },
    peerPost: function (app, key, body) { w.posts.push({ app: app, key: key, body: body, at: w.calls.length }); return Promise.resolve({ ok: true, body: { ok: true } }); },
    closeDialog: function () { w.closed += 1; },
    setScreenTitle: function () {}, setScreenMark: function () {},
    armUntilElsewhere: function (fn) { w.disarm = fn; },
  };
  w.api = api;
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
    relay: { status: function () { w.statusAsked += 1; w.statusAt = w.calls.length; return Promise.resolve({ body: { rows: relayRows || [] } }); } },
    get element() { return this.elements; }, elements: {
      armingButton: {
        attach: function (button, opts) { return record('attach', button, opts); },
        create: function (opts) { const b = document.createElement('button'); b.type = 'button'; b.textContent = (opts && opts.label) || ''; return record('create', b, opts); },
      },
    },
  };
  // A PANEL'S MOUNT, NO NAVIGATION PAGE (goal/G43.18): the element made in a box of its own with the page's api, as a layer's
  // fill makes it (spirit/element/search/contact/rowElement.js, openDetails).
  w.open = function (key) { const box = document.createElement('div'); document.body.appendChild(box); w.box = box; return win.spirit.element.search.contact.detailElement.create(box, { key: key, api: api }); };
  vm.createContext(win);
  vm.runInContext(SRC, win, { filename: FILE });
  w.win = win;
  return w;
}
function armingFor(w, label) { return w.armings.filter(function (a) { return a.label === label; }).pop() || null; }
function inPage(w, button) { let e = button; while (e) { if (e === w.box) return true; e = e.parentNode; } return false; }

test.startTest('detailElement.js: its are-you-sure buttons are armingButtons (goal/G41.9)');

(async function () {
  test.subHeading('nothing hand-rolled is left');
  const code = SRC.replace(/\/\/.*$/gm, '');
  ok(!/cdBlockArmed|cdForgetArmed/.test(SRC), 'no armed flags of its own (cdBlockArmed, cdForgetArmed)', 'contactDetails.js still keeps cdBlockArmed or cdForgetArmed');
  ok(!/data-armed/.test(code), 'no data-armed in its code', 'contactDetails.js still writes data-armed');
  ok(!/armUntilElsewhere/.test(code), 'no armUntilElsewhere of its own', 'contactDetails.js still calls armUntilElsewhere');
  ok(!/classList\.(add|toggle)\(\s*['"]armed['"]/.test(code) && !/class="[^"]*\barmed\b/.test(code), 'no armed class', 'contactDetails.js still sets an armed class');

  const KEY = 'K1';
  const OWNED = [
    { url: 'https://mine.example', owned: true, roll: { relayKey: 'RK1' } },
    { url: 'https://other.example', owned: false, claimed: true, roll: { relayKey: 'RK2' } },
  ];
  const w = world({ key: KEY, publicLabel: 'bob', myLabel: '', blocked: false, held: false }, OWNED);
  test.subHeading('it loads armingButton itself (goal/G41.3)');
  ok(w.required.indexOf('spirit/element/armingButton.js') !== -1, 'it requires spirit/element/armingButton.js through spirit.require', 'required: ' + short(w.required));

  const E = w.win.spirit.element.search.contact.detailElement;
  ok(!!E && typeof E.create === 'function' && E.open === undefined, 'it is window.spirit.element.search.contact.detailElement, made by create; no open of its own: it opens as a panel (goal/G43.18)', 'detailElement: create ' + typeof (E && E.create) + ', open ' + typeof (E && E.open));
  if (!E) return;
  w.open(KEY);
  await settle();
  ok(w.calls.some(function (c) { return c.name === 'contact.get' && c.body.key === KEY; }), 'it reads the row by contact.get', 'calls: ' + short(w.calls.map(function (c) { return c.name; })));

  test.subHeading('Block is an arming button');
  const block = armingFor(w, 'Block');
  ok(!!block, 'Block is made by armingButton', 'armings: ' + short(w.armings.map(function (a) { return a.label; })));
  if (block) {
    ok(block.opts.armedLabel === 'Block — press again', 'armed, it says Block — press again', 'armedLabel: ' + short(block.opts.armedLabel));
    ok(block.opts.api === w.api, 'it is handed the page\'s api, so a click elsewhere puts it back', 'api handed: ' + short(block.opts.api === w.api));
    ok(inPage(w, block.button), 'the button stands in the page', 'the Block button is not in the page');
    const before = w.calls.length;
    if (typeof block.opts.run === 'function') await block.opts.run();
    await settle();
    const asked = w.calls.slice(before).filter(function (c) { return c.name === 'contact.block'; })[0];
    ok(asked && asked.body.publicKey === KEY, 'its run asks contact.block for the row on screen', 'asked: ' + short(w.calls.slice(before)));
  }

  // goal/G43.17, Andy: ""forget" a contact means only: delete that row from my contacts. it does NOT mean: "eject them from relays
  // i own", not at all. not the same scope of decision." The world still has a relay this node owns (RK1), so a seat it would
  // give up is there to be given up, and is not.
  test.subHeading('Forget is an arming button, and only deletes the row: Andy, "it does NOT mean: "eject them from relays i own""');
  const forget = armingFor(w, 'Forget');
  ok(!!forget, 'Forget is made by armingButton', 'armings: ' + short(w.armings.map(function (a) { return a.label; })));
  if (forget) {
    ok(!/seat|relay/i.test(String(forget.opts.armedLabel || '')), 'armed, it says nothing of seats or relays', 'armedLabel: ' + short(forget.opts.armedLabel));
    ok(forget.opts.api === w.api && inPage(w, forget.button), 'handed the page\'s api, and in the page', 'api ' + (forget.opts.api === w.api) + ', in page ' + inPage(w, forget.button));
    const before = w.calls.length;
    const postsBefore = w.posts.length;
    if (typeof forget.opts.run === 'function') await forget.opts.run();
    await settle();
    const posts = w.posts.slice(postsBefore);
    const forgot = w.calls.slice(before).filter(function (c) { return c.name === 'contact.forget'; })[0];
    ok(!posts.length, 'its run posts nothing to any relay, the one this node owns included: no seat is removed', 'posts: ' + short(posts));
    ok(forgot && forgot.body.publicKey === KEY, 'it asks contact.forget for the row', 'asked: ' + short(w.calls.slice(before).map(function (c) { return c.name; })));
    ok(w.closed === 1, 'and the page closes', 'closed ' + w.closed + ' times');
  }

  test.subHeading('a press on the drawn button asks nothing by itself');
  const w2 = world({ key: 'K2', publicLabel: 'carl', blocked: false, held: false }, []);
  w2.open('K2');
  await settle();
  const drawn = w2.document.getElementById('cd-block') || (armingFor(w2, 'Block') || {}).button;
  const before2 = w2.calls.length;
  if (drawn) { drawn.click(); await settle(); const again = w2.document.getElementById('cd-block') || drawn; again.click(); await settle(); }
  ok(!!drawn && !w2.calls.slice(before2).some(function (c) { return c.name === 'contact.block'; }), 'two presses on the drawn Block block nobody without the element', 'asked: ' + short(w2.calls.slice(before2).map(function (c) { return c.name; })));

  test.subHeading('a blocked row offers Unblock, and Forget still arms');
  const w3 = world({ key: 'K3', publicLabel: 'dora', blocked: true }, []);
  w3.open('K3');
  await settle();
  ok(!armingFor(w3, 'Block') && !!w3.document.getElementById('cd-unblock'), 'no Block, but Unblock, a plain button', 'armings: ' + short(w3.armings.map(function (a) { return a.label; })));
  ok(!!armingFor(w3, 'Forget'), 'Forget is an arming button here too', 'armings: ' + short(w3.armings.map(function (a) { return a.label; })));

  // THE STAR, AT HOME, TWO PRESSES (goal/G41.30; Andy: "so this button will put the star on relays and puppets. AND take it
  // away."; "NO signature. just the armingButton, with a precise documentation of the risk."; every contact's details
  // panel has it, at home; the face does not show it).
  // goal/G43.14, Andy: "KILL those fields in shadow-roll, KILL the functionality, KILL it!": a row that still carried them shows none.
  test.subHeading('the box: "a contact\'s detail no longer shows them"');
  {
    const wc = world({ key: 'KC', publicLabel: 'carol', myLabel: '', blocked: false, held: false, unansweredInbound: 7, inboundPerDay: 3.5, outboundPerDay: 1.25 }, []);
    wc.open('KC');
    await settle();
    const shown = wc.box ? String(wc.box.textContent || '') : '';
    ok(/carol/.test(shown) && /Public Handle/.test(shown), 'the world: the detail of carol is drawn, with its facts', 'the detail: ' + short(shown));
    ok(!/Unanswered inbound|Inbound rate|Outbound rate/.test(shown), 'it shows no unanswered inbound, no inbound rate and no outbound rate', 'the detail: ' + short(shown));
    ok(shown.indexOf('3.5') === -1 && shown.indexOf('1.25') === -1, 'and none of their numbers', 'the detail: ' + short(shown));
  }

  test.subHeading('the star: an arming button, its risk said beside it');
  const page = function (x) { return x.box ? String(x.box.textContent || '') : ''; };
  const starOf = function (x) { const b = x.document.getElementById('cd-own'); return b ? x.armings.filter(function (a) { return a.button === b; }).pop() || null : null; };
  const w5 = world({ key: 'K5', publicLabel: 'a node', mine: false }, []);
  w5.open('K5');
  await settle();
  const s5 = starOf(w5);
  ok(!!s5, 'a node\'s panel draws #cd-own, an arming button', 'armings: ' + short(w5.armings.map(function (a) { return a.label; })));
  ok(/without asking/.test(page(w5)) && /never dropped/.test(page(w5)), 'it says what the star gives a node: its streams taken without asking, and it is never dropped', 'the page says: ' + short(page(w5)));
  const b5 = w5.calls.length;
  const drawn5 = w5.document.getElementById('cd-own');
  if (drawn5) { drawn5.click(); await settle(); }
  ok(!!drawn5 && !w5.calls.slice(b5).some(function (c) { return c.name === 'contact.own'; }), 'a press on the button alone sends nothing: the arming button holds it', 'calls: ' + short(w5.calls.slice(b5)));
  if (s5) { await s5.opts.run(); await settle(); }
  const sent5 = w5.calls.filter(function (c) { return c.name === 'contact.own'; }).pop();
  ok(!!sent5 && sent5.body.key === 'K5' && sent5.body.own === true, 'its second press sends contact.own {key, own: true}', 'sent: ' + short(sent5));
  const w6 = world({ key: 'K6', publicLabel: 'a puppet', mine: true }, []);
  w6.open('K6');
  await settle();
  const s6 = starOf(w6);
  if (s6) { await s6.opts.run(); await settle(); }
  const sent6 = w6.calls.filter(function (c) { return c.name === 'contact.own'; }).pop();
  ok(!!sent6 && sent6.body.key === 'K6' && sent6.body.own === false, 'on a starred row the same button takes the star away: contact.own {key, own: false}', 'sent: ' + short(sent6));
  const w7 = world({ key: 'K7', publicLabel: 'a node', mine: false }, []);
  w7.win.spirit.transport = { ask: function () {} };
  w7.open('K7');
  await settle();
  ok(!!w7.box && !w7.document.getElementById('cd-own') && !starOf(w7), 'on a face (window.spirit.transport) no button is drawn', 'on a face: #cd-own ' + !!w7.document.getElementById('cd-own'));
}()).then(function () { test.reportSuccessFailureCount(); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); });
