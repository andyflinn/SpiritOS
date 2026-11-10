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
  const w = world({ key: KEY, publicLabel: 'bob', myLabel: '', blocked: false }, OWNED);
  test.subHeading('it loads armingButton itself (goal/G41.3)');
  ok(w.required.indexOf('spirit/element/armingButton.js') !== -1, 'it requires spirit/element/armingButton.js through spirit.require', 'required: ' + short(w.required));

  const E = w.win.spirit.element.spirit.element.search.contact.detailElement;
  ok(!!E && typeof E.create === 'function' && E.open === undefined, 'it is window.spirit.element.spirit.element.search.contact.detailElement, made by create; no open of its own: it opens as a panel (goal/G43.18)', 'detailElement: create ' + typeof (E && E.create) + ', open ' + typeof (E && E.open));
  if (!E) return;
  w.open(KEY);
  await settle();
  ok(w.calls.some(function (c) { return c.name === 'contact.get' && c.body.key === KEY; }), 'it reads the row by contact.get', 'calls: ' + short(w.calls.map(function (c) { return c.name; })));

  test.subHeading('Block is an arming button');
  const block = armingFor(w, 'Block');
  ok(!!block, 'Block is made by armingButton', 'armings: ' + short(w.armings.map(function (a) { return a.label; })));
  if (block) {
    ok(block.opts.armedLabel === 'Block — press again', 'armed, it says Block — press again', 'armedLabel: ' + short(block.opts.armedLabel));
    ok(!('api' in block.opts), 'it is handed no api: the button hears a click elsewhere itself', 'handed: ' + short(Object.keys(block.opts)));
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
    ok(!('api' in forget.opts) && inPage(w, forget.button), 'handed no api, and in the page', 'api ' + ('api' in forget.opts) + ', in page ' + inPage(w, forget.button));
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
  const w2 = world({ key: 'K2', publicLabel: 'carl', blocked: false }, []);
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
    const wc = world({ key: 'KC', publicLabel: 'carol', myLabel: '', blocked: false, unansweredInbound: 7, inboundPerDay: 3.5, outboundPerDay: 1.25 }, []);
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

  // WHAT IT NEEDS, IT REQUIRES ITSELF (goal/G43.24; Andy: "anybody can mount any element without knowing what it actually
  // needs...."): it asks the node through the spirit object, is handed no api, and draws with its key alone.
  test.subHeading('it asks through the spirit object, and is handed no api');
  ok(!/\bapi\b/.test(code), 'its code names no api', 'its code still names an api');
  ok(typeof w.title === 'string' && w.title.indexOf('bob') !== -1, 'its title goes to the layer it is drawn in (options.layer.setTitle)', 'title: ' + short(w.title));
  const w8 = world({ key: 'K8', publicLabel: 'carol' }, []);
  const box8 = w8.document.createElement('div'); w8.document.body.appendChild(box8); w8.box = box8;
  w8.win.spirit.element.spirit.element.search.contact.detailElement.create(box8, { key: 'K8' });
  await settle();
  ok(w8.calls.some(function (c) { return c.name === 'contact.get' && c.body.key === 'K8'; }) && /carol/.test(box8.innerHTML), 'mounted with its key alone, no layer, it reads the row and draws it', 'calls: ' + short(w8.calls.map(function (c) { return c.name; })));
  w8.refuse = { 'contact.block': { status: 403, body: { ok: false, error: 'not yours' } } };
  const b8 = armingFor(w8, 'Block');
  if (b8) { await b8.opts.run(); await settle(); }
  ok(!!b8 && /block failed: 403/.test(box8.innerHTML) && /not yours/.test(box8.innerHTML), 'a verb the node refuses says its status and words', 'said: ' + short(box8.innerHTML.slice(0, 400)));

  // GOAL/G43.32 (Andy: "the contact list already knows the difference between contact types. so should the detail panel."): told
  // the row is a relay, or holding a relay's row in the contact family's cache, it draws that relay's details itself (what
  // relayPanel.js drew, in this file now: relayPart below (once ./detailElement-relay.js) judges them), and asks nothing of a person's details.
  test.subHeading('it knows the contact\'s type: a relay\'s details for a relay');
  ok(!w.required.some(function (p) { return /relayPanel\.js$/.test(p); }), 'it loads no relayPanel.js: a relay\'s details are its own', 'required: ' + short(w.required));
  // What it draws for a relay, told or from the cache, is judged where a relay's world is: relayPart below (once ./detailElement-relay.js).
}()).catch(function (e) { test.fail('the test threw ' + (e && e.stack || e)); })
  .then(async function () {
    // The parts that were once files of their own (detailElement-relay.js, detailElement-relayRowStream.js): one test file
    // per script (spirit/run/spirit/test/TEST_SYSTEM.md), each part a section of it, run in order.
    for (const [what, part] of [['relay', relayPart], ['relayRowStream', relayRowStreamPart]]) {
      try { await part(); } catch (e) { test.fail('the ' + what + ' part threw ' + (e && e.stack || e)); }
    }
  })
  .then(function () { test.reportSuccessFailureCount(); process.exit(process.exitCode || 0); });

async function relayPart() {
  // The relay part (once detailElement-relay.js).
  // The tests of spirit/element/search/contact/detailElement.js for a relay, what relayPanel.js drew until goal/G43.32, and of no
  // other module (spec: ./detailElement.md, its relay section; goal/G41.9).
  // The browser file runs in node on a window of its own, on a small DOM (markup parsed into a tree, selectors, clicks
  // that bubble); the navigation, the node behind the page's api, the relay family and the armingButton element are
  // recorders.

  const fs = require('fs');
  const path = require('path');
  const vm = require('vm');
  const RUN = path.resolve(__dirname, '../../../../..');
  const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
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
  function armingFor(w, label) { return w.armings.filter(function (a) { return a.label === label; }).pop() || null; }
  function inPage(w, button) { let e = button; while (e) { if (e === w.box) return true; e = e.parentNode; } return false; }
  async function press(w, selector) { const el = w.document.querySelector(selector); if (el) { el.click(); await settle(); } return el; }

  const OWNED_URL = 'https://mine.example';
  const SEAT_URL = 'https://seat.example';
  const OWNED = [{ key: 'RK', url: OWNED_URL, label: 'mine', status: 200, owned: true, claimed: true, claimedLabel: 'andy', roll: { relayKey: 'RK', relayLabel: 'Mine' } }];
  const OWNED_SAID = {};
  OWNED_SAID[OWNED_URL] = { key: 'RK', invites: [{ label: 'saint', expiresAt: '2099-01-01T00:00:00Z', invitedBy: 'andy' }] };
  const SEATED = [{ key: 'RK2', url: SEAT_URL, label: 'seat', status: 200, owned: false, claimed: true, claimedLabel: 'andy', roll: { relayKey: 'RK2', relayLabel: 'Seat' } }];

  test.subHeading('detailElement-relay: detailElement.js, a relay: its are-you-sure buttons are armingButtons (goal/G41.9, G43.32)');

  await (async function () {
    test.subHeading('nothing hand-rolled is left');
    const code = SRC.replace(/\/\/.*$/gm, '');
    ok(!/data-armed/.test(code), 'no data-armed in its code', 'detailElement.js still reads or writes data-armed');
    ok(!/armUntilElsewhere/.test(code), 'no armUntilElsewhere of its own', 'detailElement.js still calls armUntilElsewhere');
    ok(!/classList\.(add|toggle)\(\s*['"]armed['"]/.test(code), 'no armed class', 'detailElement.js still sets an armed class');

    const w = world(OWNED, OWNED_SAID);
    test.subHeading('it loads armingButton itself (goal/G41.3)');
    ok(w.required.indexOf('spirit/element/armingButton.js') !== -1, 'it requires spirit/element/armingButton.js through spirit.require', 'required: ' + short(w.required));
    const E = w.win.spirit.element.spirit.element.search.contact.detailElement;
    ok(!!E && typeof E.create === 'function' && E.open === undefined, 'it is window.spirit.element.spirit.element.search.contact.detailElement, made by create, a relay told relay: true; no open of its own: it opens as a panel (goal/G43.18)', 'relayPanel: create ' + typeof (E && E.create) + ', open ' + typeof (E && E.open));
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
    const panelCode = fs.readFileSync(path.join(RUN, 'spirit', 'element', 'search', 'contact', 'detailElement.js'), 'utf8').replace(/\/\/.*$/gm, '');
    const viaPeerPost = /spirit\.peerPost\(/.test(panelCode);
    const ownEncode = /packet\.encode\(/.test(panelCode);
    ok(viaPeerPost && !ownEncode, 'a post to the relay goes through spirit.peerPost, which puts it in its envelope; the panel encodes no packet of its own', 'its code: peerPost ' + viaPeerPost + ', its own encode ' + ownEncode);
    ok(w.posts.length > 0 && w.posts.every(function (p) { return p.app === 'relay' && p.key === 'RK'; }), 'each post to the relay is a packet for it through peer.post, in its envelope', 'posts: ' + short(w.posts.map(function (p) { return { app: p.app, key: p.key }; })));
    ok(typeof w.title === 'string' && /^Relay Details/.test(w.title), 'its title goes to the layer it is drawn in (options.layer.setTitle)', 'title: ' + short(w.title));

    // ONE DETAIL FOR EVERY KIND OF CONTACT (goal/G43.32; Andy: "the contact list already knows the difference between contact
    // types. so should the detail panel."): not told, the contact family's cache says what the row is.
    test.subHeading('it knows the contact\'s type, from the contact family\'s cache when not told');
    const held = function (wx, relay) { (wx.win.spirit.data = wx.win.spirit.data || {}).contact = { data: { contact: function (k) { return { key: k, relay: relay }; }, watch: function () { return function () {}; } } }; };
    const wr = world(OWNED, OWNED_SAID);
    held(wr, true);
    const boxR = wr.document.createElement('div'); wr.document.body.appendChild(boxR);
    wr.win.spirit.element.spirit.element.search.contact.detailElement.create(boxR, { key: 'RK', layer: wr.layer });
    await settle();
    ok(/nd-/.test(boxR.innerHTML) && !wr.calls.some(function (c) { return c.name === 'contact.get'; }), 'a relay\'s row in the cache: it draws the relay\'s details, and asks nothing a person\'s ask (contact.get)', 'calls: ' + short(wr.calls.map(function (c) { return c.name; })));
    const wp = world(OWNED, OWNED_SAID);
    held(wp, false);
    const boxP = wp.document.createElement('div'); wp.document.body.appendChild(boxP);
    wp.win.spirit.element.spirit.element.search.contact.detailElement.create(boxP, { key: 'KP', layer: wp.layer });
    await settle();
    ok(wp.calls.some(function (c) { return c.name === 'contact.get' && c.body && c.body.key === 'KP'; }), 'a person\'s row: it draws a person\'s details, reading the person (contact.get)', 'calls: ' + short(wp.calls.map(function (c) { return c.name; })));
  }());
}

async function relayRowStreamPart() {
  // The relayRowStream part (once detailElement-relayRowStream.js, and relayPanel-rowStream.js until goal/G43.32, when the
  // relay panel went into the contact detail).
  // WHO PAINTS, LISTENS (goal/G41.32; Andy, Q13: "every row's data, wherever it's visible must update instantly: who paints,
  // listens.", and "BEING INVISIBLE doesn't change a elements fucking duty to listen to fucking changes"; the box:
  // "natterDetails will become an shell element: relayPanel.js, it is configured with it's own contact row, and follows only
  // that."; "the "⭐ Star this relay" section should be a folded block"). hub.js relaySummary builds a relay's owned, claimed,
  // roll, services and status from what the node holds, and asks no relay, so the node publishes each as it changes, on the
  // relay's row, under those names; the report goes on the relay event, which only a starred face hears (wsl, in the item's
  // chat, cw's check of it). A real scratch node and relay, the node's own stream, and a real Chrome for the panel.

  const fs = require('fs');
  const path = require('path');
  const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
  const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
  const { scratchNode, scratchFaceRelay, chromePage, findChrome, sleep, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

  const MAIL = 'bert@example.org';
  function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 320); }
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

  test.subHeading('detailElement-relayRowStream: who paints, listens: a relay\'s row and its detail (goal/G41.32, G43.32)');

  await (async function () {
    const N = await scratchNode();
    const R = await scratchFaceRelay({ members: [] });
    let S = null;
    const others = [];
    let chrome = null;
    try {
      if (!N.up || !R.up) { test.fail('the scratch node or relay did not come up: nothing judged'); return; }
      const me = (await home(N.base, 'node.card')).body.publicKey;
      S = stream(N.base);
      const rowsOf = function (key) { return S.kept.filter(function (e) { return e.kind === 'job-updated' && e.data && e.data.id === 'spirit.contact' && e.data.data && e.data.data.row && e.data.data.row.publicKey === key; }).map(function (e) { return e.data.data.row; }); };
      const last = function (key) { const r = rowsOf(key); return r.length ? r[r.length - 1] : null; };
      const key = R.relayKey;

      test.subHeading('a seat taken: the row says so, with no one asking');
      await home(N.base, 'relay.add', { url: R.base, label: 'scratch' });
      await home(N.base, 'relay.join', { url: R.base, email: MAIL });
      await until(function () { return R.mailed.length > 0; }, 5000);
      const code = R.mailed[0] && ((/[?&]join=([A-Za-z0-9_-]+)/.exec(R.mailed[0].text)) || [])[1];
      ok(!!code, 'the relay mails a join code', 'no join code: nothing judged');
      if (!code) return;
      await home(N.base, 'relay.join', { url: R.base, email: MAIL, code: code });
      await until(function () { const r = last(key); return !!r && r.claimed === true && r.status === 200; }, 10000);
      const seated = last(key) || {};
      ok(seated.claimed === true, 'claimed is on the row', 'the last row: ' + short(seated));
      ok(seated.status === 200, 'status is on the row, the stream held', 'the last row: ' + short(seated));
      ok(!!seated.services && seated.services.sendMail === true, 'services are on the row, from the relay\'s card', 'the last row: ' + short(seated));
      ok(!!seated.roll && seated.roll.relayKey === key, 'the roll is on the row', 'the last row: ' + short(seated));
      ok(seated.owned === false, 'owned is on the row: false, no report has come', 'the last row: ' + short(seated));

      test.subHeading('the relay gone and back, and now naming this node its owner: the row follows');
      const report0 = S.kept.length;
      const back = await R.becomeOwned(me);
      ok(back, 'the relay comes back with this node as its owner', 'the relay did not come back: nothing judged');
      if (!back) return;
      const down = rowsOf(key).some(function (r) { return r.status === 0; });
      ok(down, 'while it was gone the row said status 0', 'no row said the stream dropped: ' + short(rowsOf(key).map(function (r) { return r.status; })));
      await until(function () { const r = last(key); return !!r && r.owned === true && r.status === 200; }, 20000);
      const ownedRow = last(key) || {};
      ok(ownedRow.status === 200 && ownedRow.owned === true, 'back: status 200 and owned true, on the row', 'the last row: ' + short(ownedRow));
      ok(!!ownedRow.roll && ownedRow.roll.ownerKey === me, 'and the roll names this node its owner', 'the last row: ' + short(ownedRow));

      test.subHeading('a report arrives: it is on the stream, whole, and not on the row');
      await until(function () { return S.kept.slice(report0).some(function (e) { return e.kind === 'relay-event' && e.data && e.data.report; }); }, 20000);
      const rep = S.kept.slice(report0).filter(function (e) { return e.kind === 'relay-event' && e.data && e.data.report; }).pop();
      ok(!!rep && rep.data.kind === 'status' && typeof rep.data.report === 'object' && Object.keys(rep.data.report).length > 0, 'the relay event carries the report', 'relay events: ' + short(S.kept.slice(report0).filter(function (e) { return e.kind === 'relay-event'; }).map(function (e) { return e.data; })));
      // Rows reach every face, starred or not, and a report lists invites.
      ok(rowsOf(key).every(function (r) { return r.report === undefined; }), 'no row carries a report', 'a row with a report: ' + short(rowsOf(key).filter(function (r) { return r.report !== undefined; })[0]));

      test.subHeading('a card that changes: the row\'s label follows');
      const LABEL = 'zzRenamed';
      const rn = await home(N.base, 'peer.post', { to: key, text: JSON.stringify({ app: 'relay', body: { relayLabel: { label: LABEL } } }) });
      ok(rn.status === 200, 'the owner renames the relay', 'relayLabel: ' + rn.status + ' ' + short(rn.text));
      await until(function () { const r = last(key); return !!r && !!r.roll && r.roll.relayLabel === LABEL; }, 8000);
      ok(((last(key) || {}).roll || {}).relayLabel === LABEL, 'the row says the new label', 'the last row: ' + short(last(key)));

      test.subHeading('a relay\'s detail: the contact detail, configured with its row');
      ok(fs.existsSync(path.join(RUN, 'spirit/element/search/contact/detailElement.js')), 'spirit/element/search/contact/detailElement.js is there', 'no spirit/element/search/contact/detailElement.js');
      ok(!fs.existsSync(path.join(RUN, 'spirit/element/natterDetails')), 'and natterDetails is gone', 'spirit/element/natterDetails is still there');
      const where = findChrome();
      if (!where) { test.fail('no Chrome here: the panel is not judged'); return; }
      chrome = await chromePage(where);
      if (chrome.error) { test.fail('Chrome: ' + chrome.error); return; }
      // The shell Andy uses, at home as on a relay: boot.js. The older page at / loads every element up front and would hide a
      // panel that forgets to load its own.
      await chrome.send('Page.navigate', { url: N.base + '/face.html' });
      await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.require)'); }, 20000);
      await sleep(3000);
      const mounted = await chrome.evaluate('Promise.resolve(window.spirit.require("spirit/element/search/contact/detailElement.js")).then(function () { var E = window.spirit.element.spirit.element.search.contact.detailElement; if (!E || typeof E.create !== "function") return "no create"; var h = document.createElement("div"); h.id = "zzPanel"; document.body.appendChild(h); window.__panel = E.create(h, { key: ' + JSON.stringify(key) + ', relay: true }); return "ok"; }, function (e) { return "refused: " + e.message; })');
      ok(mounted === 'ok', 'detailElement.create(host, { key, relay: true }) draws it', 'the panel: ' + short(mounted));
      if (mounted !== 'ok') return;
      const text = function () { return chrome.evaluate('document.getElementById("zzPanel").textContent').then(String); };
      await until(function () { return text().then(function (t) { return t.indexOf(LABEL) !== -1; }); }, 8000);
      ok((await text()).indexOf(LABEL) !== -1, 'it paints the relay\'s label', 'the panel says: ' + short(await text()));

      // Andy: "the folding panel "⭐ Star this relay" must use the same heading and style al all the other folding panels in relayPanel."
      test.subHeading('the star is a folding panel like the others');
      const FOLDS = 'Array.prototype.slice.call(document.querySelectorAll("#zzPanel .nd-fold"))';
      const star = await chrome.evaluate('(function () { var all = ' + FOLDS + '; var s = all.filter(function (h) { return h.textContent.indexOf("Star this relay") !== -1; })[0]; var o = all.filter(function (h) { return h !== s; })[0]; if (!s || !o) return { star: !!s, other: !!o }; return { star: true, other: true, sameHeading: s.className === o.className && s.tagName === o.tagName, sameTile: s.parentElement.className.split(" ").slice(0, 2).join(" ") === o.parentElement.className.split(" ").slice(0, 2).join(" "), mark: !!s.querySelector(".nd-fold-mark"), details: !!document.querySelector("#zzPanel details"), buttonWhileShut: !!document.querySelector("#zzPanel .nd-own") }; }())');
      ok(!!star && star.star && star.other, 'its heading stands among the others', 'the folds: ' + short(star));
      ok(!!star && star.sameHeading && star.sameTile && star.mark, 'with the same heading, tile and fold mark', 'the star: ' + short(star));
      ok(!!star && star.details === false, 'and no fold of its own', 'the star: ' + short(star));
      ok(!!star && star.buttonWhileShut === false, 'it arrives shut: its button is not shown', 'the star: ' + short(star));
      await chrome.evaluate('(function () { var s = ' + FOLDS + '.filter(function (h) { return h.textContent.indexOf("Star this relay") !== -1; })[0]; if (s) s.click(); }())');
      await sleep(500);
      const opened = await chrome.evaluate('(function () { var b = document.querySelector("#zzPanel .nd-own"); return !!b && b.closest(".stat-tile").textContent.indexOf("Star this relay") !== -1; }())');
      ok(opened === true, 'pressed, it opens and holds its button', 'the star opened: ' + short(opened));

      // Andy: "the folding panel "A face name" should actually show the faceForm, unless the relay is "starred"", "that's one bug,
      // and one design change.", "bug: "A face name" doesn't show the faceForm.", "change: don't show it if the relay is starred...".
      // TURNED ROUND SINCE: goal/G43.18's box (v29), Andy: "on the home node, NO face is offered (faceForm hides itself) for a
      // relay without star." relayPanel's ndFaceHtml asks faceForm.offers, which offers a starred relay only, so the fold
      // shows only when starred: the checks below assert G41.32's rule and fail against it.
      test.subHeading('"A face name" shows the faceForm, unless the relay is starred');
      const faceHead = 'Array.prototype.slice.call(document.querySelectorAll("#zzPanel .nd-fold")).filter(function (h) { return h.textContent.indexOf("A face name") !== -1; })[0]';
      const hasFaceHead = function () { return chrome.evaluate('!!(' + faceHead + ')'); };
      await until(hasFaceHead, 5000);
      ok(await hasFaceHead(), 'with no star, its fold stands', 'no "A face name" fold: ' + short(await text()));
      await chrome.evaluate('(function () { var h = ' + faceHead + '; if (h) h.click(); }())');
      await until(function () { return chrome.evaluate('!!document.querySelector("#zzPanel .nd-face-form input")'); }, 5000);
      const drawn = await chrome.evaluate('(function () { var f = document.querySelector("#zzPanel .nd-face-form"); return f ? { input: !!f.querySelector("input"), button: !!f.querySelector("button"), text: f.textContent.slice(0, 80) } : null; }())');
      ok(!!drawn && drawn.input && drawn.button, 'opened, it holds the faceForm: its field and its button', 'the fold holds: ' + short(drawn));
      const sOn = await home(N.base, 'contact.own', { key: key, own: true });
      ok(sOn.status === 200, 'the star on, at home', 'contact.own: ' + sOn.status + ' ' + short(sOn.text));
      await until(function () { return hasFaceHead().then(function (h) { return !h; }); }, 5000);
      ok(!(await hasFaceHead()), 'starred: the fold is gone, with no reload', 'starred, "A face name" is still there');
      const sOff = await home(N.base, 'contact.own', { key: key, own: false });
      ok(sOff.status === 200, 'the star off, at home', 'contact.own false: ' + sOff.status + ' ' + short(sOff.text));
      await until(hasFaceHead, 5000);
      ok(await hasFaceHead(), 'and it comes back', 'the star off, "A face name" did not come back');

      test.subHeading('it listens, shown or hidden, and asks no one again');
      const asks = function () { return chrome.heard.filter(function (m) { return m.method === 'Network.requestWillBeSent' && /"call":"relay\.(status|get)"/.test(String((m.params.request || {}).postData || '')); }).length; };
      const asked = asks();
      const NEW1 = 'zzNameOne';
      await home(N.base, 'peer.post', { to: key, text: JSON.stringify({ app: 'relay', body: { relayLabel: { label: NEW1 } } }) });
      await until(function () { return text().then(function (t) { return t.indexOf(NEW1) !== -1; }); }, 8000);
      ok((await text()).indexOf(NEW1) !== -1, 'shown: the new label is painted', 'the panel says: ' + short(await text()));
      ok(asks() === asked, 'and no relay.status or relay.get was asked for it', (asks() - asked) + ' reads were asked for one change');
      await chrome.evaluate('document.getElementById("zzPanel").style.display = "none"; 1');
      const NEW2 = 'zzNameTwo';
      await home(N.base, 'peer.post', { to: key, text: JSON.stringify({ app: 'relay', body: { relayLabel: { label: NEW2 } } }) });
      await until(function () { return text().then(function (t) { return t.indexOf(NEW2) !== -1; }); }, 8000);
      ok((await text()).indexOf(NEW2) !== -1, 'hidden: the new label is painted all the same', 'hidden, the panel says: ' + short(await text()));
      await chrome.evaluate('document.getElementById("zzPanel").style.display = ""; 1');

      test.subHeading('it follows only its row');
      // Another relay's row, joined and not owned: a panel that listened to it would stop saying this relay is owned.
      const before = await text();
      const Other = await scratchFaceRelay({ members: [] });
      others.push(Other);
      ok(Other.up, 'a second relay comes up', 'the second relay did not come up: nothing judged');
      await home(N.base, 'relay.add', { url: Other.base, label: 'zzOtherRelay' });
      await home(N.base, 'relay.join', { url: Other.base, email: MAIL });
      await until(function () { return Other.mailed.length > 0; }, 5000);
      const code2 = Other.mailed[0] && ((/[?&]join=([A-Za-z0-9_-]+)/.exec(Other.mailed[0].text)) || [])[1];
      await home(N.base, 'relay.join', { url: Other.base, email: MAIL, code: code2 });
      await until(function () { const r = last(Other.relayKey); return !!r && r.claimed === true && r.owned === false; }, 10000);
      const otherRow = last(Other.relayKey) || {};
      ok(otherRow.claimed === true && otherRow.owned === false, 'the other relay\'s row, seated and not owned, is on the stream', 'nothing judged: ' + short(otherRow));
      await sleep(1000);
      ok((await text()) === before, 'and nothing of it reaches this panel', 'it repainted for another relay\'s row: ' + short(await text()));

      test.subHeading('gone from the page, it stops');
      const mark = chrome.heard.length;
      const gone = await chrome.evaluate('(function () { if (!window.__panel || typeof window.__panel.destroy !== "function") return false; window.__panel.destroy(); return true; }())');
      ok(gone === true, 'it has a destroy', 'no destroy on the panel');
      await home(N.base, 'peer.post', { to: key, text: JSON.stringify({ app: 'relay', body: { relayLabel: { label: 'zzNameThree' } } }) });
      await sleep(1500);
      const threw = chrome.heard.slice(mark).filter(function (m) { return m.method === 'Runtime.exceptionThrown'; }).map(function (m) { return m.params.exceptionDetails.text; });
      ok(!threw.length && (await text()).indexOf('zzNameThree') === -1, 'a later change neither throws nor paints', 'after destroy: ' + short(threw) + ' ' + short(await text()));

      // THE FACE FORM OFFERS MEMBERS' RELAYS WITH NO STAR (goal/G41.32; Andy: "show only relays in the relay-dropdown that the node is
      // a member of AND are not starred.", "if there are no relays that satisfy the requirement, don't display the form at all.",
      // "faceForm provides that check as a function", "info-app: don't show the faceForm, if the faceForm says it shouldn't be
      // displayed"; and of following the rows with no read: "agreed."). This node sits on two relays here, neither starred.
      // TURNED ROUND SINCE: goal/G43.18's box (v29), Andy: "on the home node, NO face is offered (faceForm hides itself) for a
      // relay without star." faceForm.js offers a starred relay only, so the checks below assert G41.32's rule and fail against it.
      test.subHeading('the face form: its check, as a function');
      await chrome.send('Page.navigate', { url: N.base + '/face.html' });
      await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.require)'); }, 20000);
      await sleep(3000);
      const check = await chrome.evaluate('Promise.resolve(window.spirit.require("spirit/element/faceForm.js")).then(function () { var F = window.spirit.element.spirit.element.faceForm; if (!F || typeof F.offers !== "function") return null; var u = "http://x"; return { member: F.offers([{ url: u, claimed: true, mine: false }]), owner: F.offers([{ url: u, owned: true, mine: false }]), starred: F.offers([{ url: u, claimed: true, mine: true }]), stranger: F.offers([{ url: u, claimed: false, owned: false, mine: false }]), none: F.offers([]), one: F.offers([{ url: u, claimed: true, mine: true }, { url: "http://y", claimed: true, mine: false }]) }; })');
      ok(!!check, 'faceForm.offers(relays) is there', 'no faceForm.offers');
      if (check) {
        ok(check.member === true && check.owner === true && check.one === true, 'true for a relay this node is a member of or owns, with no star', 'offers: ' + short(check));
        ok(check.starred === false && check.stranger === false && check.none === false, 'false for a starred relay, one it holds no seat on, and for none', 'offers: ' + short(check));
      }

      test.subHeading('Info: the form offers members\' relays with no star, and follows the star with no reload');
      await chrome.evaluate('(function () { var e = Array.prototype.slice.call(document.querySelectorAll("*")).filter(function (x) { return x.offsetParent !== null && !x.children.length && x.textContent.trim() === "Info"; })[0]; if (e) e.click(); }())');
      const options = function () { return chrome.evaluate('JSON.stringify(Array.prototype.slice.call(document.querySelectorAll("[data-info=\\"face\\"] .sp-face-relay option")).map(function (o) { return o.value; }))').then(function (t) { return JSON.parse(t || '[]'); }); };
      const tileShown = function () { return chrome.evaluate('(function () { var b = document.querySelector("[data-info=\\"face\\"]"); return !!b && b.offsetParent !== null && !!b.querySelector(".sp-face-relay"); }())'); };
      const emptyTile = function () { return chrome.evaluate('(function () { var b = document.querySelector("[data-info=\\"face\\"]"); return !!b && b.offsetParent !== null; }())'); };
      await until(function () { return options().then(function (o) { return o.length >= 2; }); }, 8000);
      const both = await options();
      ok(both.indexOf(R.base) !== -1 && both.indexOf(Other.base) !== -1, 'neither starred: it offers both', 'it offers: ' + short(both));
      const reads = function () { return chrome.heard.filter(function (m) { return m.method === 'Network.requestWillBeSent' && /"call":"(relay\.(status|get)|contact\.search)"/.test(String((m.params.request || {}).postData || '')); }).length; };
      const readsBefore = reads();
      await home(N.base, 'contact.own', { key: key, own: true });
      await until(function () { return options().then(function (o) { return o.indexOf(R.base) === -1; }); }, 5000);
      const oneLeft = await options();
      ok(oneLeft.indexOf(R.base) === -1 && oneLeft.indexOf(Other.base) !== -1, 'one starred, no reload: it is gone from the dropdown, the other stays', 'it offers: ' + short(oneLeft));
      ok(reads() === readsBefore, 'and the form followed the row, reading nothing', (reads() - readsBefore) + ' reads for one star');
      await home(N.base, 'contact.own', { key: Other.relayKey, own: true });
      await until(function () { return emptyTile().then(function (t) { return !t; }); }, 5000);
      ok(!(await tileShown()) && !(await emptyTile()), 'both starred: no form, and no empty tile left in Info', 'with both starred: form ' + (await tileShown()) + ', its tile ' + (await emptyTile()));
      await home(N.base, 'contact.own', { key: Other.relayKey, own: false });
      await until(tileShown, 5000);
      const offeredBack = await options();
      ok((await tileShown()) && offeredBack.indexOf(Other.base) !== -1 && offeredBack.indexOf(R.base) === -1, 'one star off: the form is back, offering that relay', 'form ' + (await tileShown()) + ', it offers ' + short(offeredBack));

      // A RELAY THIS NODE IS NOT A MEMBER OF CANNOT BE STARRED (goal/G41.32; Andy: "a relay I'm not a member of can not be starred
      // (relays i own automatically give me membership)"). At the node's own door, so no screen can get round it.
      test.subHeading('only a relay this node is a member of or owns can be starred');
      const starred = async function (k) { const a = await home(N.base, 'contact.search', { q: '', mine: 'yes' }); return !!(a.body && (a.body.items || []).some(function (i) { return i.key === k; })); };
      const Far = await scratchFaceRelay({ members: [] });
      others.push(Far);
      ok(Far.up, 'a third relay comes up', 'the third relay did not come up: nothing judged');
      await home(N.base, 'relay.add', { url: Far.base, label: 'zzFar' });
      await until(function () { return rowsOf(Far.relayKey).length > 0; }, 8000);
      const farNo = await home(N.base, 'contact.own', { key: Far.relayKey, own: true });
      ok(farNo.status >= 400 && farNo.status < 500 && !!(farNo.body && farNo.body.code), 'listed, no seat: contact.own is refused at home, with a code', 'contact.own of a relay with no seat: ' + farNo.status + ' ' + short(farNo.text));
      ok(!(await starred(Far.relayKey)), 'and no star lands', 'a relay with no seat has a star');
      const farOwnOff = await home(N.base, 'contact.own', { key: Far.relayKey, own: false });
      ok(!(await starred(Far.relayKey)), 'taking away a star it does not have changes nothing: ' + farOwnOff.status, 'after own false it has a star');
      const person = require(path.join(RUN, 'spirit', 'relayAuth.js')).generateIdentity('zzPuppet').publicKey;
      await home(N.base, 'contact.block', { publicKey: person });
      const personAns = await home(N.base, 'contact.own', { key: person, own: true });
      test.comment('a node that is no relay, contact.own answers ' + personAns.status + ': this rule is about relays alone');

      test.subHeading('its panel offers no star there');
      const farPanel = await chrome.evaluate('Promise.resolve(window.spirit.require("spirit/element/search/contact/detailElement.js")).then(function () { var h = document.createElement("div"); h.id = "zzFar"; document.body.appendChild(h); window.spirit.element.spirit.element.search.contact.detailElement.create(h, { key: ' + JSON.stringify(Far.relayKey) + ', relay: true }); return "ok"; })');
      await until(function () { return chrome.evaluate('document.querySelectorAll("#zzFar .nd-fold").length > 0'); }, 8000);
      const farStar = await chrome.evaluate('Array.prototype.slice.call(document.querySelectorAll("#zzFar .nd-fold")).filter(function (h) { return h.textContent.indexOf("Star this relay") !== -1; }).length');
      ok(farPanel === 'ok' && await chrome.evaluate('document.querySelectorAll("#zzFar .nd-fold").length > 0'), 'the panel draws for it', 'no panel for a relay with no seat');
      ok(farStar === 0, 'with no star fold', 'a relay with no seat offers a star');

      test.subHeading('a member can star it; leaving takes the star away');
      // Leaving: read from his ruling, and Q21 asks him outright (ubi: "a relay you have left keeps its star"); if he says no, these two checks go.
      await home(N.base, 'relay.join', { url: Far.base, email: MAIL });
      await until(function () { return Far.mailed.length > 0; }, 5000);
      const farCode = Far.mailed[0] && ((/[?&]join=([A-Za-z0-9_-]+)/.exec(Far.mailed[0].text)) || [])[1];
      await home(N.base, 'relay.join', { url: Far.base, email: MAIL, code: farCode });
      await until(function () { const r = last(Far.relayKey); return !!r && r.claimed === true; }, 10000);
      const farYes = await home(N.base, 'contact.own', { key: Far.relayKey, own: true });
      ok(farYes.status === 200 && await starred(Far.relayKey), 'joined: the star goes on', 'contact.own of a member\'s relay: ' + farYes.status + ' ' + short(farYes.text));
      // The first ask may still be waiting for the relay's card, as relay.face's does.
      let left = null;
      for (let i = 0; i < 8; i++) { left = await home(N.base, 'relay.leave', { key: Far.base }); if (left.status < 300 || left.status === 404) break; await sleep(2000); }
      await until(function () { const r = last(Far.relayKey); return !!r && r.claimed === false; }, 8000);
      ok(((last(Far.relayKey) || {}).claimed) === false, 'it leaves the relay: its row holds no seat', 'relay.leave: ' + left.status + ' ' + short(left.text) + ', row ' + short(last(Far.relayKey)));
      await until(function () { return starred(Far.relayKey).then(function (x) { return !x; }); }, 5000);
      ok(!(await starred(Far.relayKey)), 'and the star is gone with the seat', 'it left the relay and the star stayed');
      const notAgain = await home(N.base, 'contact.own', { key: Far.relayKey, own: true });
      ok(notAgain.status >= 400 && notAgain.status < 500, 'and cannot be put back', 'contact.own after leaving: ' + notAgain.status + ' ' + short(notAgain.text));

      test.subHeading('a relay this node owns counts as membership');
      const Own = await scratchFaceRelay({ members: [], ownerKey: me });
      others.push(Own);
      ok(Own.up, 'a relay naming this node its owner comes up', 'it did not come up: nothing judged');
      await home(N.base, 'relay.add', { url: Own.base, label: 'zzOwned' });
      await home(N.base, 'relay.join', { url: Own.base, email: MAIL });
      await until(function () { return Own.mailed.length > 0; }, 5000);
      const ownCode = Own.mailed[0] && ((/[?&]join=([A-Za-z0-9_-]+)/.exec(Own.mailed[0].text)) || [])[1];
      if (ownCode) await home(N.base, 'relay.join', { url: Own.base, email: MAIL, code: ownCode });
      await until(function () { const r = last(Own.relayKey); return !!r && r.owned === true; }, 20000);
      const ownedRow2 = last(Own.relayKey) || {};
      ok(ownedRow2.owned === true, 'its report has come: owned', 'no report: nothing judged: ' + short(ownedRow2));
      const ownYes = await home(N.base, 'contact.own', { key: Own.relayKey, own: true });
      ok(ownYes.status === 200 && await starred(Own.relayKey), 'owned: the star goes on', 'contact.own of an owned relay: ' + ownYes.status + ' ' + short(ownYes.text));

      // Andy: "the contact list should do something to mark a relay, like print its label in bold-italic."
      test.subHeading('the contact list marks a relay: its label in bold italic');
      await home(N.base, 'contact.label', { publicKey: person, myLabel: 'zzPersonRow' });
      await home(N.base, 'contact.unblock', { publicKey: person });
      await home(N.base, 'contact.accept', { publicKey: person });
      await chrome.send('Page.navigate', { url: N.base + '/face.html' });
      await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.require)'); }, 20000);
      await sleep(3000);
      await chrome.evaluate('(function () { var e = Array.prototype.slice.call(document.querySelectorAll("*")).filter(function (x) { return x.offsetParent !== null && !x.children.length && x.textContent.trim() === "Contacts"; })[0]; if (e) e.click(); }())');
      const styleOf = function (words) { return chrome.evaluate('(function () { var e = Array.prototype.slice.call(document.querySelectorAll("*")).filter(function (x) { return x.offsetParent !== null && !x.children.length && x.textContent.trim() === ' + JSON.stringify(words) + '; })[0]; if (!e) return null; var c = getComputedStyle(e); return { weight: Number(c.fontWeight), style: c.fontStyle }; }())'); };
      await until(function () { return styleOf('scratch'); }, 8000);
      const relayLook = await styleOf('scratch');
      ok(!!relayLook && relayLook.weight >= 700 && relayLook.style === 'italic', 'a relay\'s label is bold and italic', 'a relay\'s label: ' + short(relayLook));
      await until(function () { return styleOf('zzPersonRow'); }, 5000);
      const personLook = await styleOf('zzPersonRow');
      ok(!!personLook, 'a person is listed too', 'no person\'s row: the difference is not judged');
      ok(!!personLook && !(personLook.weight >= 700 && personLook.style === 'italic'), 'and a person\'s label is not', 'a person\'s label: ' + short(personLook));
    } finally {
      try { if (S) S.stop(); } catch (e) { /* gone */ }
      try { if (chrome && chrome.sock) chrome.sock.close(); if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
      try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ }
      try { R.stop(); } catch (e) { /* gone */ }
      others.forEach(function (o) { try { o.stop(); } catch (e) { /* gone */ } });
      try { if (N.child) N.child.kill(); } catch (e) { /* gone */ }
      try { if (N.root) fs.rmSync(N.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    }
  }());
}
