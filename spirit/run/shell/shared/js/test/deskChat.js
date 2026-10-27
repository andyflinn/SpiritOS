'use strict';

// spirit/run/shell/shared/js/test/deskChat.js
// The tests of shell/shared/js/deskChat.js, and of no other module (spec: ./deskChat.md; goal/G41.11). The browser file
// runs in node on a small page of its own (the page shell/desk/test/desk.js drives); the desk server is a recorder
// whose answers the test hands out, and the stream is one the test publishes on.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'deskChat.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

// ── THE PAGE (shell/desk/test/desk.js) ──────────────────────────────────────────────────────────────────────────────
const VOID = { input: 1, br: 1, img: 1, hr: 1, meta: 1, link: 1 };
function makeDom() {
  const doc = {};
  function el(tag) {
    const attrs = {}; const heard = {};
    const e = { tagName: String(tag || 'div').toUpperCase(), children: [], parentNode: null, style: {}, value: '', hidden: false, disabled: false, type: '', title: '', _text: '',
      get id() { return attrs.id || ''; }, set id(v) { attrs.id = String(v); },
      get className() { return attrs.class || ''; }, set className(v) { attrs.class = String(v); },
      get firstChild() { return e.children[0] || null; },
      get isConnected() { let p = e; while (p.parentNode) p = p.parentNode; return p === doc.root; },
      get textContent() { return e.children.length ? e.children.map(function (c) { return c.textContent; }).join('') : e._text; },
      set textContent(v) { e.children = []; e._text = String(v == null ? '' : v); },
      get innerHTML() { return e._html || ''; },
      set innerHTML(v) { e._html = String(v); e.children = []; e._text = ''; parseInto(e, String(v)); },
      getAttribute: function (k) { if (k === 'id') return attrs.id || null; return k in attrs ? attrs[k] : null; },
      setAttribute: function (k, v) { attrs[k] = String(v); },
      removeAttribute: function (k) { delete attrs[k]; },
      hasAttribute: function (k) { return k in attrs; },
      classList: { add: function (c) { const l = (attrs.class || '').split(/\s+/).filter(Boolean); if (l.indexOf(c) === -1) l.push(c); attrs.class = l.join(' '); },
        remove: function (c) { attrs.class = (attrs.class || '').split(/\s+/).filter(function (x) { return x && x !== c; }).join(' '); },
        contains: function (c) { return (attrs.class || '').split(/\s+/).indexOf(c) !== -1; },
        toggle: function (c, on) { if (on === undefined ? !e.classList.contains(c) : on) e.classList.add(c); else e.classList.remove(c); } },
      appendChild: function (c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = e; e.children.push(c); return c; },
      insertBefore: function (c, ref) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = e; const i = e.children.indexOf(ref); if (i === -1) e.children.push(c); else e.children.splice(i, 0, c); return c; },
      removeChild: function (c) { const i = e.children.indexOf(c); if (i !== -1) e.children.splice(i, 1); c.parentNode = null; return c; },
      replaceChild: function (n, o) { const i = e.children.indexOf(o); if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = e; if (i !== -1) e.children[i] = n; o.parentNode = null; return o; },
      remove: function () { if (e.parentNode) e.parentNode.removeChild(e); },
      addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
      removeEventListener: function (t, fn) { heard[t] = (heard[t] || []).filter(function (f) { return f !== fn; }); },
      dispatch: function (t, ev) { (heard[t] || []).slice().forEach(function (fn) { fn(ev); }); },
      closest: function (sel) { let p = e; while (p && p.tagName) { if (matches(p, sel)) return p; p = p.parentNode; } return null; },
      matches: function (sel) { return matches(e, sel); },
      querySelectorAll: function (sel) { const out = []; (function walk(n) { n.children.forEach(function (c) { if (matches(c, sel)) out.push(c); walk(c); }); }(e)); return out; },
      querySelector: function (sel) { return e.querySelectorAll(sel)[0] || null; },
      focus: function () {}, blur: function () {}, scrollIntoView: function () {}, getBoundingClientRect: function () { return { top: 0, left: 0, width: 0, height: 0 }; },
      attrs: attrs,
    };
    return e;
  }
  function one(n, sel) {
    sel = sel.trim();
    const m = /^([a-z]*)((?:#[\w-]+|\.[\w-]+|\[[\w-]+(?:="[^"]*")?\])*)$/i.exec(sel);
    if (!m) return false;
    if (m[1] && n.tagName !== m[1].toUpperCase()) return false;
    const parts = m[2].match(/#[\w-]+|\.[\w-]+|\[[\w-]+(?:="[^"]*")?\]/g) || [];
    return parts.every(function (p) {
      if (p[0] === '#') return n.getAttribute('id') === p.slice(1);
      if (p[0] === '.') return n.classList.contains(p.slice(1));
      const a = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(p);
      return a[2] === undefined ? n.hasAttribute(a[1]) : n.getAttribute(a[1]) === a[2];
    });
  }
  function matches(n, sel) { return String(sel).split(',').some(function (s) { return one(n, s); }); }
  function unesc(s) { return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, '\'').replace(/&amp;/g, '&'); }
  function parseInto(root, html) {
    const stack = [root];
    const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/g; let m;
    let raw = null;
    while ((m = re.exec(html))) {
      const top = stack[stack.length - 1];
      if (raw) { if (m[1] === '/' && m[2] && m[2].toLowerCase() === raw) { stack.pop(); raw = null; } continue; }
      if (m[5] !== undefined) { if (m[5].trim() || top.children.length === 0) { const t = el('#text'); t._text = unesc(m[5]); t.tagName = '#TEXT'; top.children.push(t); t.parentNode = top; } continue; }
      if (!m[2]) continue;
      const tag = m[2].toLowerCase();
      if (m[1] === '/') { for (let i = stack.length - 1; i > 0; i--) { if (stack[i].tagName === tag.toUpperCase()) { stack.length = i; break; } } continue; }
      const n = el(tag);
      const ar = /([\w-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g; let a;
      while ((a = ar.exec(m[3]))) n.attrs[a[1]] = unesc(a[3] !== undefined ? a[3] : a[4] !== undefined ? a[4] : a[5] !== undefined ? a[5] : '');
      if ('hidden' in n.attrs) n.hidden = true;
      if ('disabled' in n.attrs) n.disabled = true;
      if (n.attrs.type) n.type = n.attrs.type;
      if (n.attrs.title) n.title = n.attrs.title;
      if (n.attrs.value) n.value = n.attrs.value;
      n.parentNode = top; top.children.push(n);
      if (!VOID[tag] && !m[4]) { stack.push(n); if (tag === 'style' || tag === 'script') raw = tag; }
    }
  }
  doc.root = el('html');
  doc.body = doc.root.appendChild(el('body'));
  doc.head = doc.root.appendChild(el('head'));
  doc.documentElement = doc.root;
  doc.readyState = 'complete';
  doc.createElement = function (t) { return el(t); };
  doc.createTextNode = function (t) { const n = el('#text'); n._text = String(t); return n; };
  doc.getElementById = function (id) { return doc.root.querySelector('#' + id); };
  doc.querySelector = function (s) { return doc.root.querySelector(s); };
  doc.querySelectorAll = function (s) { return doc.root.querySelectorAll(s); };
  doc.addEventListener = function () {};
  doc.removeEventListener = function () {};
  // A click on an element, bubbling to every listener above it.
  doc.click = function (t) {
    const ev = { type: 'click', target: t, preventDefault: function () {}, stopPropagation: function () {} };
    let p = t; while (p) { if (p.dispatch) p.dispatch('click', ev); p = p.parentNode; }
  };
  return doc;
}
// An event on an element, bubbling to every listener above it, as doc.click does.
function fire(doc, type, target, extra) {
  const ev = Object.assign({ type: type, target: target, preventDefault: function () {}, stopPropagation: function () {} }, extra || {});
  let p = target; while (p) { if (p.dispatch) p.dispatch(type, ev); p = p.parentNode; }
  return ev;
}

function world() {
  const document = makeDom();
  const win = { document: document, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Promise: Promise };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  return { document: document, win: win, make: win.spirit.elements.createDeskChat };
}
// The desk: each ask recorded and held until the test answers it.
function desk() {
  const d = { asked: [] };
  d.ask = function (verb, args) {
    return new Promise(function (resolve, reject) { d.asked.push({ verb: verb, args: args, resolve: resolve, reject: reject }); });
  };
  d.of = function (verb) { return d.asked.filter(function (a) { return a.verb === verb; }); };
  return d;
}
function stream() {
  const s = { fn: null, offs: 0 };
  s.onPublished = function (fn) { s.fn = fn; return function () { s.offs++; }; };
  s.push = function (obj) { if (s.fn) s.fn(obj); };
  return s;
}
const L1 = { by: 'andy', at: '2026-10-27T10:00:00.000Z', text: 'first <b>' };
const L2 = { by: 'cw', name: 'claude-windows', at: '2026-10-27T10:01:00.000Z', text: 'second' };

test.startTest('deskChat.js: an item\'s chat, one copy for every page');

(async function () {
  test.subHeading('it adds createDeskChat to window.spirit.elements');
  const w = world();
  ok(typeof w.make === 'function', 'window.spirit.elements.createDeskChat is a function', 'elements: ' + short(Object.keys(w.win.spirit.elements)));
  const none = w.make(null, {});
  ok(none && typeof none.destroy === 'function', 'no element: it answers a harmless destroy', short(none));

  test.subHeading('drawn: the say box and Send on top, then the log, read once with item.chat');
  const d = desk(); const s = stream();
  const host = w.document.body.appendChild(w.document.createElement('div'));
  const chat = w.make(host, { id: 'goal/G9.1', ask: d.ask, onPublished: s.onPublished });
  const say = w.document.getElementById('desk-chat-goal-G9-1-say');
  const send = w.document.getElementById('desk-chat-goal-G9-1-send');
  const log = w.document.getElementById('desk-chat-goal-G9-1-log');
  ok(!!say && say.tagName === 'TEXTAREA' && !!send && !!log && !!w.document.getElementById('desk-chat-goal-G9-1-error'),
    'its ids are desk-chat-<id, anything not a word character a dash>: -say (a textarea), -send, -error, -log', 'ids: ' + short(host.querySelectorAll('[id]').map(function (n) { return n.id; })));
  ok(say.getAttribute('placeholder') === 'under goal/G9.1' && /Chat of goal\/G9\.1, newest first/.test(host.textContent), 'by default the placeholder is "under <id>" and the label "Chat of <id>, newest first"',
    say.getAttribute('placeholder') + ' / ' + host.textContent.slice(0, 120));
  ok(host.innerHTML.indexOf('id="desk-chat-goal-G9-1-say"') < host.innerHTML.indexOf('id="desk-chat-goal-G9-1-log"'), 'the say box comes before the log', 'order wrong');
  ok(/has not been read yet/.test(log.textContent), 'before the answer the log says it has not been read yet', log.textContent);
  ok(d.of('item.chat').length === 1 && d.of('item.chat')[0].args.id === 'goal/G9.1', 'item.chat {id} is asked once', short(d.asked.map(function (a) { return a.verb; })));
  d.of('item.chat')[0].resolve({ chat: [L1, L2] }); await settle();
  const bubbles = w.document.getElementById('desk-chat-goal-G9-1-log').children;
  ok(bubbles.length === 2 && /second/.test(bubbles[0].textContent) && /first/.test(bubbles[1].textContent), 'the lines are drawn newest first', short(bubbles.map(function (b) { return b.textContent; })));
  ok(/^you/.test(bubbles[1].textContent) && /background:#000;color:#fff/.test(bubbles[1].getAttribute('style')), 'Andy\'s line says "you", black on white', bubbles[1].textContent + ' ' + bubbles[1].getAttribute('style'));
  ok(/^claude-windows/.test(bubbles[0].textContent) && /rgba\(255,255,255,0\.08\)/.test(bubbles[0].getAttribute('style')), 'another\'s line says its name, filled', bubbles[0].textContent);
  ok(/2026-10-27 10:01:00Z/.test(bubbles[0].textContent), 'by default a moment is drawn as the stamp, T a space, the milliseconds gone', bubbles[0].textContent);
  ok(w.document.getElementById('desk-chat-goal-G9-1-log').innerHTML.indexOf('first &lt;b&gt;') !== -1, 'a line\'s text is escaped', 'the <b> was drawn as markup');

  test.subHeading('Send: chat.add with the text, one at a time; a line not kept stays in the box');
  say.value = '   ';
  w.document.click(send);
  ok(d.of('chat.add').length === 0, 'an empty say box sends nothing', 'sent ' + d.of('chat.add').length);
  say.value = '  hello there \n';
  w.document.click(send);
  w.document.click(send);
  ok(d.of('chat.add').length === 1 && d.of('chat.add')[0].args.id === 'goal/G9.1' && d.of('chat.add')[0].args.text === 'hello there',
    'one press sends chat.add {id, the text trimmed}; a second press while sending sends nothing', short(d.of('chat.add').map(function (a) { return a.args; })));
  ok(w.document.getElementById('desk-chat-goal-G9-1-error').textContent === 'Sending…', 'while it is in the air it says Sending…', w.document.getElementById('desk-chat-goal-G9-1-error').textContent);
  d.of('chat.add')[0].reject(new Error('too long')); await settle();
  ok(say.value === '  hello there \n' && w.document.getElementById('desk-chat-goal-G9-1-error').textContent === 'Not kept: too long', 'refused: what was typed stays, and it says Not kept: <why>',
    JSON.stringify(say.value) + ' / ' + w.document.getElementById('desk-chat-goal-G9-1-error').textContent);
  w.document.click(send);
  ok(d.of('chat.add').length === 2, 'after a refusal it may be sent again', 'sent ' + d.of('chat.add').length);
  d.of('chat.add')[1].resolve({ ok: true }); await settle();
  ok(say.value === '' && w.document.getElementById('desk-chat-goal-G9-1-error').textContent === '', 'kept: the box and the error line are emptied', JSON.stringify(say.value));

  test.subHeading('the stream: its own lines join, a take replaces, a gap reads again');
  s.push({ change: 10, table: 'chat', id: 'goal/G9.1', row: { by: 'cw', at: '2026-10-27T10:02:00.000Z', text: 'third' } }); await settle();
  let shown = w.document.getElementById('desk-chat-goal-G9-1-log').children.map(function (b) { return b.textContent; });
  ok(shown.length === 3 && /third/.test(shown[0]), 'a chat row of its id joins the log, newest first', short(shown));
  s.push({ change: 11, table: 'chat', id: 'goal/G9.1', row: { by: 'cw', name: 'cw', at: L2.at, text: 'second' } }); await settle();
  shown = w.document.getElementById('desk-chat-goal-G9-1-log').children.map(function (b) { return b.textContent; });
  ok(shown.length === 3 && /^cw/.test(shown[1]), 'the same line again (by, at and text) replaces it: a take', short(shown));
  s.push({ change: 12, table: 'chat', id: 'goal/G9.2', row: { by: 'x', at: 'y', text: 'not mine' } });
  s.push({ change: 13, table: 'box', id: 'goal/G9.1', row: { text: 'box' } });
  s.push({ change: 14, table: 'chat', id: 'goal/G9.1', row: { by: 'x', at: 'z', text: 'gone' }, removed: true });
  s.push({ change: 15, table: 'chat', id: 'goal/G9.1' });
  s.push(null); s.push('text');
  await settle();
  shown = w.document.getElementById('desk-chat-goal-G9-1-log').children.map(function (b) { return b.textContent; });
  ok(shown.length === 3 && d.of('item.chat').length === 1, 'another id\'s line, another table, a removed row, a row-less one, a non-object: none changes the log or reads again',
    short({ shown: shown.length, reads: d.of('item.chat').length }));
  s.push({ change: 9, table: 'chat', id: 'goal/G9.1', row: { by: 'x', at: 'old', text: 'stale' } }); await settle();
  ok(w.document.getElementById('desk-chat-goal-G9-1-log').children.length === 3, 'a change older than the last heard is dropped', 'drew a stale line');
  s.push({ change: 20, table: 'chat', id: 'goal/G9.1', row: { by: 'x', at: 'gap', text: 'after a gap' } }); await settle();
  ok(d.of('item.chat').length === 2, 'a gap in the change numbers reads the chat again with item.chat', 'reads: ' + d.of('item.chat').length);
  d.of('item.chat')[1].resolve({ chat: [L1] }); await settle();
  ok(w.document.getElementById('desk-chat-goal-G9-1-log').children.length === 1, 'and draws what that read answers', 'lines: ' + w.document.getElementById('desk-chat-goal-G9-1-log').children.length);
  s.push({ dropped: true }); await settle();
  ok(d.of('item.chat').length === 3, 'a dropped stream reads it again too', 'reads: ' + d.of('item.chat').length);
  d.of('item.chat')[2].resolve({ chat: [] }); await settle();
  ok(/Nothing said yet under goal\/G9\.1\./.test(w.document.getElementById('desk-chat-goal-G9-1-log').textContent), 'an empty chat says nothing was said yet under its id',
    w.document.getElementById('desk-chat-goal-G9-1-log').textContent);

  test.subHeading('destroy: unsubscribed; nothing heard or read after');
  chat.destroy();
  ok(s.offs === 1, 'destroy calls the stream\'s unsubscribe', 'offs: ' + s.offs);
  s.push({ change: 30, table: 'chat', id: 'goal/G9.1', row: { by: 'x', at: 'late', text: 'late' } }); await settle();
  ok(w.document.getElementById('desk-chat-goal-G9-1-log').children.length === 1 && d.of('item.chat').length === 3, 'a publish after destroy draws nothing and reads nothing', 'drew after destroy');
  chat.destroy();
  ok(s.offs === 1, 'a second destroy does not unsubscribe again', 'offs: ' + s.offs);

  test.subHeading('a read answered after destroy draws nothing; its options are used');
  const w2 = world(); const d2 = desk();
  const host2 = w2.document.body.appendChild(w2.document.createElement('div'));
  const c2 = w2.make(host2, { id: 'goal/G0', ask: d2.ask, title: 'Team <chat>', placeholder: 'say it',
    escape: function (t) { return String(t).replace(/</g, '[lt]'); }, lineHtml: function (t) { return '<i>' + t + '</i>'; }, time: function (at) { return 'AT(' + at + ')'; } });
  ok(/Team \[lt\]chat>, newest first/.test(host2.textContent) && w2.document.getElementById('desk-chat-goal-G0-say').getAttribute('placeholder') === 'say it',
    'title and placeholder are its own, through its escape', host2.textContent.slice(0, 120));
  d2.of('item.chat')[0].resolve({ chat: [{ by: 'cw', at: 'now', text: 'hi' }] }); await settle();
  const b2 = w2.document.getElementById('desk-chat-goal-G0-log').children[0];
  ok(!!b2 && /AT\(now\)/.test(b2.textContent) && !!b2.querySelector('i'), 'time draws the moment and lineHtml the text', short(b2 && b2.textContent));
  const w3 = world(); const d3 = desk();
  const host3 = w3.document.body.appendChild(w3.document.createElement('div'));
  const c3 = w3.make(host3, { id: 'x', ask: d3.ask });
  c3.destroy();
  d3.of('item.chat')[0].resolve({ chat: [{ by: 'a', at: 'b', text: 'c' }] }); await settle();
  ok(/has not been read yet/.test(w3.document.getElementById('desk-chat-x-log').textContent), 'an answer after destroy is not drawn', w3.document.getElementById('desk-chat-x-log').textContent);
  c2.destroy();
}()).then(function () { test.reportSuccessFailureCount(); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); });
