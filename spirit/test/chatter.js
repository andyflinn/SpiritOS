'use strict';

// spirit/test/chatter.js
// goal/G4.10 and goal/G4.11: chatter, the app over the chatClerver: the peers on the left, one chat in the centre.
// RED on today's tree: there is no shell/chatter.
//
//   Andy, 2026-10-03, his go-all on goal/G4. The rulings stand verbatim in the boxes. G4.10: "A click on a row brings
//   that rows chat into the center/chat pane."; "We need to pick and icon/status pair for \"new message(s)\" waiting.";
//   "the count is not allowed by 4.14"; "🔴 is fine"; and, from the faceless items, "the initiation of a record,
//   because it begins when a user selects a peer as target for a message."; "a blocked contact should not be offered
//   to the chatter user at all." G4.11: "in chatter, it is the \"selected\" contact that shows in the titlebar of the
//   center pane."; "on every publish arrived, the chat must reconcile placement and re: references."; "ah the
//   delivered-checkmark. that would be mighty fine"; "we won't support \"read\""; "refused is the only other one worth
//   knowing to the user, besise delivered and replied-to."; "a newly arrived line becomes the current line, that can
//   be changed by clicking on an other one, or by using up/down arrow-keys, home/end keys for top/bottom of visible
//   chat lines."; "Do the popular style."; "put a style selector in there. and offer plain and speech bubbles."; "it
//   could also go into the chat pane's titlebar"; "this: Enter sends and Shift+Enter a new line (popular)"; "looks
//   like the preferences belon in shell/chatter (likely)".
//
// THE CONTRACT (the boxes of goal/G4.10, G4.11, and G4.9 for the app itself; shapes they left open marked NAMED).
//   THE APP (G4.9): shell/chatter/chatter.js and chatter.json, named chatter, icon CHAT, not intrinsic. It asks its
//   server as Desk does, api.verb('jobs.api', {ask: {chatClerver: {<verb>: args}}}), and hears it by
//   api.onPublished(fn, 'chatClerver'). It builds with the shell's elements, api.ui.elements.
//   G4.10, THE PEERS:
//     P1. The left pane is createContactSelector({face: 'pane', statuses, search}), statuses
//         [{status: 'none'}, {status: 'unanswered', iconKey: 'WAITING'}] (Andy: "use ICON:WAITING"), search asking peers.search
//         {text, since, before}. EVERY ASK carries exactly its verb's request keys, read from chatClerver.js: the
//         fake server refuses any other, as the real one does.
//     P2. A peer whose row counts unanswered above zero is marked unanswered (⌛ WAITING); the number is drawn nowhere, and
//         the row's raw record is not shown as its name (the label element names it by key).
//     P3. A click on a row opens that peer's chat in the centre: chat.read {peer, before: ''}.
//     P4. A new chat: a contact picked from the node's book (a createContactSelector dropdown, its rows from
//         contact.search), a blocked contact never offered (contact.search lists blocked rows; how they are left out
//         is the builder's, contact.get per row as peers.search does); the pick opens its (empty) chat and the
//         first line goes line.write {to}.
//     P5. A published line from a peer the list does not hold makes the list ask peers.search again.
//   G4.11, THE CHAT:
//     C1. One chat; its contact named in the centre pane's own title bar by createContactLabel({key, editable: true}).
//     C2. Lines drawn as elements carrying data-sent ('1' mine, '0' theirs) and data-seq (NAMED), placed by their
//         time, oldest first, never by arrival; a line published again is updated in place, never drawn twice.
//     C3. Marks, the popular style: a sent line ⏳ while unsent (refused 'unsent'), ✓ once kept (refused ''), ❗ when
//         refused (any other code); a received line no mark; no read mark.
//     C4. One current line (className holds 'current', NAMED): a line that arrives becomes it; a click, ArrowUp,
//         ArrowDown, Home and End move it.
//     C5. A reply: the line written answers the current line (re {writer, seq}); a line with a re shows a short
//         quote of the answered line's text (none when that line is drawn right before it: Andy, under G4.10), filled in when the answered line arrives after it; a click on the quote
//         makes the answered line current.
//     C6. The input (a TEXTAREA): Enter sends line.write {to, text, re}, Shift+Enter does not; the sent line shows at
//         once, by the seq line.write answered, ⏳ until the publish says kept.
//     C7. Older lines: with more, a scroll to the top asks chat.read {peer, before: the oldest line's at}.
//     C8. The style selector (a SELECT in the centre pane, offering plain and bubbles): a change is kept in
//         shell/chatter/ through api.fs, and the next mount shows it.
//   G4.10, REOPENED (Andy trying it live):
//     P6. Presence: chatter reads the node's relay-presence job through api.onJobs (the shell's one stream) and
//         sets the pane's root.present(key, state): green present, white otherwise, the ⌛ beside it.
//         The new-chat dropdown gets the same presence as the pane (Andy: "the color of presence dots in the
//         dropdown don't match the color of the presence dots in the pane...").
//     P7. Three panes, data-pane peers, chat and objects (NAMED); the objects pane shown and empty; each side pane
//         folds by its data-fold button (NAMED), POINTRIGHT/POINTLEFT pointing the way it will move.
//     P9. The pane's search matches the names shown, not keys (Andy: "the search on top or the pane seem to search
//         keys instead of labels..."): typed text finds a peer by its name in the node's book (contact.search), and
//         only peers with a chat are listed.
//     P10. Reading resets the count (Andy: "it's the fact that they're now reading that should reset the counter, and
//         make the hourglass disappear"): opening a chat takes its ⌛ away and shows its count in the centre pane's
//         title bar ("Andy: 35 new messages"); chatter keeps per peer the newest line shown, through api.fs in
//         shell/chatter, so the next mount draws no ⌛ for it; a newer line of theirs brings ⌛ back. A line written
//         in that chat drops the count from the title bar (Andy: "as soon as andy responds, drop the count").
//     P8. Two visible boundaries, data-divider left and right (NAMED), dragged by pointer events to resize; the
//         widths kept in the same api.fs file as the look, and drawn again on the next mount.
// NOT ASSERTED, the builder's: markup and classes beyond the names above, the bubbles' look, the fold buttons and the
// bounded window (G4.9), the missing fallback's wording.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const RUN = path.join(__dirname, '..', 'run');
const OWED = 'owed by goal/G4.10 and G4.11: ';
const OWED10 = 'owed by goal/G4.10: ';
const OWED11 = 'owed by goal/G4.11: ';
const APP = path.join(RUN, 'shell', 'chatter', 'chatter.js');
const MANIFEST = path.join(RUN, 'shell', 'chatter', 'chatter.json');
const ICON = kernel.core.const.ICON;

const PEER = 'MCowBQYDK2VwAyEApeerpeerpeerpeerpeerpeerpeerpeerpeerp=';
const QUIET = 'MCowBQYDK2VwAyEAquietquietquietquietquietquietquiet=';
const NEWBIE = 'MCowBQYDK2VwAyEAnewbienewbienewbienewbienewbienewbi=';
const BLOCKED = 'MCowBQYDK2VwAyEAblockedblockedblockedblockedblocke=';
const STRANGER = 'MCowBQYDK2VwAyEAstrangerstrangerstrangerstrangerstr=';

// Each verb's request keys, read from the chatClerver itself (its table's `request: {...}`), so the fake server
// below refuses what the real one refuses and follows the verbs if they change.
const REQUEST_KEYS = (function () {
  const src = fs.readFileSync(path.join(RUN, 'process', 'js', 'chatClerver', 'chatClerver.js'), 'utf8');
  const out = {};
  const re = /'([\w.]+)':\s*\{\s*request:\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    let depth = 1; let i = re.lastIndex;
    while (i < src.length && depth) { if (src[i] === '{') depth += 1; else if (src[i] === '}') depth -= 1; i += 1; }
    try { out[m[1]] = Object.keys(new Function('return {' + src.slice(re.lastIndex, i - 1) + '}')()).sort().join(','); } catch (e) { /* not a literal */ }
  }
  return out;
})();

function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
async function settled() { for (let i = 0; i < 6; i += 1) await settle(); }

test.startTest('goal/G4.10 and G4.11: chatter, the peers on the left and one chat in the centre');

// ── A SMALL DOM ──────────────────────────────────────────────────────
// Built by createElement and appendChild; events bubble along parentNode; closest() for an attribute, a class or a
// tag. The shell's own elements (contactSelector, contactLabel) are loaded for real into it.

function node(tag) {
  let html = '';
  const e = { tagName: String(tag || 'div').toUpperCase(), value: '', textContent: '', className: '', style: {}, dataset: {},
    children: [], listeners: {}, parentNode: null, hidden: false, attrs: {}, scrollTop: 0, scrollHeight: 0, clientHeight: 0,
    appendChild: function (c) { if (c.parentNode) c.parentNode.removeChild(c); e.children.push(c); c.parentNode = e; return c; },
    insertBefore: function (c, ref) {
      if (c.parentNode) c.parentNode.removeChild(c);
      const i = ref ? e.children.indexOf(ref) : -1;
      if (i === -1) e.children.push(c); else e.children.splice(i, 0, c);
      c.parentNode = e; return c;
    },
    prepend: function (c) { return e.insertBefore(c, e.children[0] || null); },
    append: function () { Array.from(arguments).forEach(function (c) { e.appendChild(typeof c === 'string' ? Object.assign(node('#text'), { textContent: c }) : c); }); },
    removeChild: function (c) { e.children = e.children.filter(function (x) { return x !== c; }); c.parentNode = null; return c; },
    replaceChild: function (n, o) { const i = e.children.indexOf(o); if (i !== -1) { if (n.parentNode) n.parentNode.removeChild(n); e.children[i] = n; n.parentNode = e; o.parentNode = null; } return o; },
    replaceChildren: function () { e.children.forEach(function (c) { c.parentNode = null; }); e.children = []; Array.from(arguments).forEach(function (c) { e.appendChild(c); }); },
    remove: function () { if (e.parentNode) e.parentNode.removeChild(e); },
    addEventListener: function (t, fn) { (e.listeners[t] = e.listeners[t] || []).push(fn); },
    removeEventListener: function (t, fn) { e.listeners[t] = (e.listeners[t] || []).filter(function (f) { return f !== fn; }); },
    dispatchEvent: function (ev) { bubble(e, ev); return true; },
    setAttribute: function (k, v) { e.attrs[k] = String(v); if (k.indexOf('data-') === 0) e.dataset[camel(k.slice(5))] = String(v); if (k === 'class') e.className = String(v); if (k === 'hidden') e.hidden = true; },
    getAttribute: function (k) { if (k.indexOf('data-') === 0) { const d = e.dataset[camel(k.slice(5))]; return d === undefined ? null : d; } return e.attrs[k] === undefined ? null : e.attrs[k]; },
    hasAttribute: function (k) { return e.getAttribute(k) !== null; },
    removeAttribute: function (k) { delete e.attrs[k]; if (k.indexOf('data-') === 0) delete e.dataset[camel(k.slice(5))]; if (k === 'hidden') e.hidden = false; },
    closest: function (sel) {
      for (let n = e; n; n = n.parentNode) {
        const a = /^\[([\w-]+)\]$/.exec(sel);
        if (a && n.getAttribute && n.getAttribute(a[1]) !== null) return n;
        if (sel.charAt(0) === '.' && String(n.className || '').split(/\s+/).indexOf(sel.slice(1)) !== -1) return n;
        if (/^[a-z]+$/i.test(sel) && n.tagName === sel.toUpperCase()) return n;
      }
      return null;
    },
    querySelector: function (sel) { return all(e).slice(1).filter(function (n) { return n.closest && n.closest(sel) === n; })[0] || null; },
    querySelectorAll: function (sel) { return all(e).slice(1).filter(function (n) { return n.closest && n.closest(sel) === n; }); },
    contains: function (x) { for (let n = x; n; n = n.parentNode) if (n === e) return true; return false; },
    scrollIntoView: function () {}, focus: function () {}, select: function () {}, blur: function () {},
    getBoundingClientRect: function () { return { top: 0, bottom: 0, left: 0, right: 0, height: 0, width: 0 }; },
  };
  e.classList = {
    add: function (c) { const s = String(e.className || '').split(/\s+/).filter(Boolean); if (s.indexOf(c) === -1) s.push(c); e.className = s.join(' '); },
    remove: function (c) { e.className = String(e.className || '').split(/\s+/).filter(function (x) { return x && x !== c; }).join(' '); },
    toggle: function (c, on) { if (on === undefined) on = !e.classList.contains(c); if (on) e.classList.add(c); else e.classList.remove(c); return on; },
    contains: function (c) { return String(e.className || '').split(/\s+/).indexOf(c) !== -1; },
  };
  Object.defineProperty(e, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); e.children.forEach(function (c) { c.parentNode = null; }); e.children = []; }, enumerable: true });
  Object.defineProperty(e, 'isConnected', { get: function () { for (let n = e; n; n = n.parentNode) if (n.isDocumentRoot) return true; return false; } });
  return e;
}
function camel(s) { return s.replace(/-([a-z])/g, function (m, ch) { return ch.toUpperCase(); }); }
function bubble(target, ev) {
  if (!ev.target) { try { Object.defineProperty(ev, 'target', { value: target, configurable: true }); } catch (x) { ev.target = target; } }
  let stopped = false;
  const realStop = ev.stopPropagation;
  try { ev.stopPropagation = function () { stopped = true; if (realStop) realStop.call(ev); }; } catch (x) { /* frozen */ }
  for (let n = target; n && !stopped; n = n.parentNode) {
    (n.listeners[ev.type] || []).slice().forEach(function (fn) { fn.call(n, ev); });
    if (ev.bubbles === false && n === target) break;
  }
}
function fire(n, type, extra) { bubble(n, Object.assign({ type: type, bubbles: true, preventDefault: function () {} }, extra || {})); }
function all(root) { return [root].concat(root.children.reduce(function (acc, c) { return acc.concat(all(c)); }, [])); }
function visible(n, root) {
  for (let x = n; x; x = x.parentNode) { if (x.hidden || (x.style && x.style.display === 'none')) return false; if (x === root) return true; }
  return true;
}
function shown(n) { return all(n).map(function (x) { return (x.textContent || '') + ' ' + (x.innerHTML || '') + ' ' + (x.tagName === 'INPUT' || x.tagName === 'TEXTAREA' ? '' : (x.value || '')); }).join(' '); }

function line(o) {
  return { sent: o.sent, seq: o.seq, at: o.at, text: o.text, receivedAt: o.sent ? '' : o.at, re: o.re || { writer: '', seq: 0 }, refused: o.refused || '' };
}
function item(l) { return { key: l.sent + ':' + l.seq, label: JSON.stringify(l) }; }
const T = function (m) { return '2026-10-03T10:' + String(m).padStart(2, '0') + ':00.000Z'; };

// PEER's chat: theirs 1 (T1), mine 1 kept (T2), theirs 2 (T3), mine 2 unsent (T4), mine 3 refused (T5). Cut: more.
const CHAT = [
  line({ sent: 1, seq: 3, at: T(5), text: 'third of mine', refused: 'not-granted' }),
  line({ sent: 1, seq: 2, at: T(4), text: 'second of mine', refused: 'unsent' }),
  line({ sent: 0, seq: 2, at: T(3), text: 'how are you' }),
  line({ sent: 1, seq: 1, at: T(2), text: 'hello there', refused: '' }),
  line({ sent: 0, seq: 1, at: T(1), text: 'hi' }),
];

function mount(opts) {
  opts = opts || {};
  const docListeners = {};
  const docRoot = node('html'); docRoot.isDocumentRoot = true;
  const doc = {
    documentElement: docRoot, body: docRoot,
    createElement: node, createTextNode: function (t) { const n = node('#text'); n.textContent = String(t); return n; },
    createDocumentFragment: function () { return node('#fragment'); },
    addEventListener: function (t, fn) { (docListeners[t] = docListeners[t] || []).push(fn); },
    removeEventListener: function (t, fn) { docListeners[t] = (docListeners[t] || []).filter(function (f) { return f !== fn; }); },
    dispatchEvent: function (ev) { (docListeners[ev.type] || []).slice().forEach(function (fn) { fn(ev); }); return true; },
    getElementById: function () { return null; },
  };
  const asked = [];
  // The node's own verbs, as the elements ask them (spirit.core.ask).
  const coreAsk = function (verb, body) {
    asked.push({ via: 'core', verb: verb, body: body || {} });
    if (verb === 'contact.search') {
      // By name, as the node's book answers (hub.js searchPeople); with nothing typed, the two the picker offers.
      const book = [[PEER, 'Pete'], [QUIET, 'Quinn'], [NEWBIE, 'Newbie'], [BLOCKED, 'Blocky'], [STRANGER, 'Stan']];
      const q = String(body.q || '').toLowerCase();
      const items = q ? book.filter(function (b) { return b[1].toLowerCase().indexOf(q) !== -1; }).map(function (b) { return { key: b[0], label: b[1] }; })
        : [{ key: NEWBIE, label: 'Newbie' }, { key: BLOCKED, label: 'Blocky' }];
      return Promise.resolve({ status: 200, body: { ok: true, items: items, more: false } });
    }
    if (verb === 'contact.get') {
      const names = {}; names[PEER] = 'Pete'; names[QUIET] = 'Quinn'; names[NEWBIE] = 'Newbie'; names[BLOCKED] = 'Blocky'; names[STRANGER] = 'Stan';
      return Promise.resolve({ status: 200, body: { ok: true, key: body.key, person: { publicKey: body.key, caption: names[body.key] || body.key, blocked: body.key === BLOCKED } } });
    }
    if (verb === 'contact.label') return Promise.resolve({ status: 200, body: { publicKey: body.publicKey, myLabel: body.myLabel, caption: body.myLabel } });
    return Promise.resolve({ status: 200, body: {} });
  };
  let nextSeq = 4;
  // The chatClerver, as the app asks it (api.verb jobs.api).
  function clerver(verb, a) {
    asked.push({ via: 'clerver', verb: verb, body: a || {} });
    if (verb === 'peers.search') {
      const rows = [
        { key: PEER, label: JSON.stringify(Object.assign({ peer: PEER, at: T(5), sent: 1, seq: 3, unanswered: 2 }, opts.peerRow || {})) },
        { key: QUIET, label: JSON.stringify({ peer: QUIET, at: T(0), sent: 1, seq: 1, unanswered: 0 }) },
      ].concat(opts.extraPeers || []);
      // As the real one does: text is found in the key, nowhere else (chatClerver.js peers.search, G4.3). A fake that
      // ignored text let a build pass that hands the typed name on, which empties the list on a real node
      // (wsl-claude, 48250df7).
      const t = String(a.text || '');
      return { items: rows.filter(function (r) { return !t || r.key.indexOf(t) !== -1; }), more: false };
    }
    if (verb === 'chat.read') {
      if (a.peer !== PEER) return { items: [], more: false };
      if (a.before) return { items: [item(line({ sent: 0, seq: 0, at: T(0), text: 'the oldest' }))].filter(function () { return a.before === T(1); }), more: false };
      return { items: CHAT.map(item), more: true };
    }
    if (verb === 'line.write') { const s = a.to === PEER ? nextSeq++ : 1; return { seq: s, outcome: 'pending' }; }
    return {};
  }
  const published = [];
  const jobsFns = [];
  const saved = {};
  const api = {
    verb: function (name, args) {
      if (name !== 'jobs.api') { asked.push({ via: 'verb', verb: name, body: args }); return Promise.resolve({ status: 404, body: { ok: false } }); }
      const ask = (args && args.ask && args.ask.chatClerver) || null;
      if (!ask) return Promise.resolve({ status: 404, body: { ok: false, code: 'no-such-server' } });
      const v = Object.keys(ask)[0];
      // AS STRICT AS THE REAL SERVER: a call with any key more or less than the verb's request is refused. A fake that
      // took short asks let chatter ship peers.search {text} and chat.read {peer}, refused on a real node
      // (wsl-claude, found on Andy's WSL node).
      const want = REQUEST_KEYS[v];
      const got = Object.keys(ask[v] || {}).sort().join(',');
      if (!want || got !== want) {
        asked.push({ via: 'refused', verb: v, body: ask[v] || {} });
        return Promise.resolve({ status: 400, body: { ok: false, code: 'bad-request', error: v + ' takes ' + want + ', not ' + got } });
      }
      return Promise.resolve({ status: 200, body: clerver(v, ask[v]) });
    },
    onPublished: function (fn, server) { published.push({ fn: fn, server: server }); return function () {}; },
    onPacket: function () { return function () {}; },
    onReconnect: function () { return function () {}; },
    // The shell's one stream, fanned out: fn(jobsById, job, ctx), called at once with what is held (shell.js onJobs).
    onJobs: function (fn) { jobsFns.push(fn); fn(new Map(), null, { visible: true }); return function () {}; },
    setScreenTitle: function () {}, setScreenMark: function () {},
    escapeHtml: kernel.core.util.escapeHtml,
    fs: {
      loadFile: function (rel) { return Object.prototype.hasOwnProperty.call(opts.files || {}, rel) ? opts.files[rel] : (saved[rel] === undefined ? null : saved[rel]); },
      saveFile: function (rel, text) { saved[rel] = String(text); return Promise.resolve(); },
      statFile: function () { return null; },
    },
  };
  const win = { spiritFieldRules: require('../run/js/fieldRules.js'), spiritElements: {} };
  const sp = { core: { ask: coreAsk, util: { escapeHtml: kernel.core.util.escapeHtml, formatBytes: kernel.core.util.formatBytes }, const: { ICON: ICON } } };
  const load = function (file) {
    new Function('spirit', 'document', 'window', 'Event', 'CustomEvent', fs.readFileSync(file, 'utf8'))(sp, doc, win, Event, CustomEvent);
  };
  load(path.join(RUN, 'shell', 'js', 'contactSelector.js'));
  load(path.join(RUN, 'shell', 'js', 'contactLabel.js'));
  // Watched, not replaced: what chatter builds with is recorded, and the real element answers.
  const selectors = [];
  const labels = [];
  const realSelector = win.spiritElements.createContactSelector;
  const realLabel = win.spiritElements.createContactLabel;
  win.spiritElements.createContactSelector = function (o) { const r = realSelector(o); selectors.push({ options: o || {}, root: r }); return r; };
  win.spiritElements.createContactLabel = function (o) { const r = realLabel(o); labels.push({ options: o || {}, root: r }); return r; };
  api.ui = { elements: win.spiritElements };
  let behavior = null;
  sp.shell = { activateApp: function (b) { behavior = b; }, registerApp: function (b) { behavior = b; } };
  new Function('spirit', 'document', 'window', 'Event', 'CustomEvent', fs.readFileSync(APP, 'utf8'))(sp, doc, win, Event, CustomEvent);
  const container = node('div');
  docRoot.appendChild(container);
  if (behavior && typeof behavior.mount === 'function') behavior.mount(container, api);
  if (behavior && typeof behavior.render === 'function') { try { behavior.render(); } catch (e) { /* render is the app's */ } }
  return {
    container: container, asked: asked, selectors: selectors, labels: labels, saved: saved, behavior: behavior, doc: doc,
    // The node's relay-presence job, as the stream carries it: {type, data: {presence: {key: {present, at}}}}.
    presence: function (table) {
      const job = { id: 'relay-presence', type: 'relay-presence', data: { presence: table } };
      jobsFns.forEach(function (fn) { fn(new Map([[job.id, job]]), job, { visible: true }); });
    },
    listensToJobs: function () { return jobsFns.length > 0; },
    publish: function (obj) { published.filter(function (p) { return p.server === 'chatClerver'; }).forEach(function (p) { p.fn(obj); }); },
    listening: function () { return published.some(function (p) { return p.server === 'chatClerver'; }); },
    clerverAsks: function (verb) { return asked.filter(function (a) { return a.via === 'clerver' && a.verb === verb; }); },
  };
}

function pane(app) { const s = app.selectors.filter(function (x) { return x.options.face === 'pane'; })[0]; return s || null; }
function picker(app) { return app.selectors.filter(function (x) { return x.options.face !== 'pane'; })[0] || null; }
function rowFor(root, key) { return all(root).filter(function (n) { return n.getAttribute && n.getAttribute('data-key') === key && visible(n, root); })[0] || null; }
function lines(app) {
  return all(app.container).filter(function (n) { return n.getAttribute && n.getAttribute('data-seq') !== null && n.getAttribute('data-sent') !== null; });
}
function lineFor(app, sent, seq) { return lines(app).filter(function (n) { return n.getAttribute('data-sent') === String(sent) && n.getAttribute('data-seq') === String(seq); }); }
function order(app) { return lines(app).map(function (n) { return n.getAttribute('data-sent') + ':' + n.getAttribute('data-seq'); }).join(','); }
function current(app) { return lines(app).filter(function (n) { return /\bcurrent\b/.test(n.className); }).map(function (n) { return n.getAttribute('data-sent') + ':' + n.getAttribute('data-seq'); }); }
function textarea(app) { return all(app.container).filter(function (n) { return n.tagName === 'TEXTAREA'; })[0] || null; }

async function main() {
  test.subHeading('the app (G4.9): shell/chatter, named chatter, icon CHAT, not intrinsic');
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (e) { manifest = null; }
  if (manifest && manifest.name === 'chatter' && manifest.icon === 'CHAT' && manifest.intrinsic === false) test.check('chatter.json: chatter, CHAT, intrinsic false');
  else test.fail(OWED + 'shell/chatter/chatter.json is ' + JSON.stringify(manifest));
  if (!fs.existsSync(APP)) { test.fail(OWED + 'there is no shell/chatter/chatter.js'); return; }
  let app = null;
  try { app = mount(); } catch (e) { test.fail(OWED + 'chatter did not mount: ' + (e && e.stack || e).toString().slice(0, 300)); return; }
  await settled();
  if (app.listening()) test.check('it hears its server: api.onPublished(fn, \'chatClerver\')');
  else test.fail(OWED + 'chatter does not listen to the chatClerver\'s publishes');

  // ── G4.10 ──
  test.subHeading('G4.10 P1-P2: the left pane is the shell\'s peer pane over peers.search, ⌛ for unanswered');
  const p = pane(app);
  const st = p && p.options.statuses;
  if (p && Array.isArray(st) && st[0] && st[0].status === 'none' && !st[0].iconKey && st.some(function (s) { return s.status === 'unanswered' && s.iconKey === 'WAITING'; })) test.check('createContactSelector({face: \'pane\', statuses: [none, unanswered WAITING]})');
  else test.fail(OWED10 + 'the pane is ' + (p ? JSON.stringify({ face: p.options.face, statuses: st }) : 'not made'));
  const searched = app.clerverAsks('peers.search');
  if (p && typeof p.options.search === 'function' && searched.length && searched[0].body.text === '') test.check('its search asks peers.search {text, since, before}, text \'\' first');
  else test.fail(OWED10 + 'peers.search asked ' + JSON.stringify(searched));
  const peerRow = p && rowFor(p.root, PEER);
  const quietRow = p && rowFor(p.root, QUIET);
  if (peerRow && quietRow && shown(peerRow).indexOf(ICON.WAITING) !== -1 && shown(quietRow).indexOf(ICON.WAITING) === -1 && shown(peerRow).indexOf(ICON.RED_CIRCLE) === -1) test.check('a peer with unanswered lines shows 🔴, a peer with none does not');
  else test.fail(OWED10 + 'rows: ' + JSON.stringify([peerRow && shown(peerRow), quietRow && shown(quietRow)]).slice(0, 220));
  if (peerRow && !/\{"peer"|unanswered/.test(shown(peerRow)) && !/\b2\b/.test(shown(peerRow).replace(/MCow\S+/g, ''))) test.check('neither the count nor the raw record is drawn; the row is named by key');
  else test.fail(OWED10 + 'the row shows ' + JSON.stringify(peerRow && shown(peerRow)).slice(0, 200));

  test.subHeading('G4.10 P3 and G4.11 C1: a click on a row opens its chat, named in the pane\'s title bar');
  if (peerRow) fire(peerRow, 'click');
  await settled();
  const read = app.clerverAsks('chat.read');
  if (read.length && read[0].body.peer === PEER && !read[0].body.before) test.check('chat.read {peer, before: \'\'} for the clicked row');
  else test.fail(OWED10 + 'chat.read asked ' + JSON.stringify(read));
  const title = app.labels.filter(function (l) { return l.options.key === PEER && l.options.editable === true; });
  if (title.length && app.container.contains(title[title.length - 1].root)) test.check('the centre pane\'s title bar names the contact: createContactLabel({key, editable: true})');
  else test.fail(OWED11 + 'labels made ' + JSON.stringify(app.labels.map(function (l) { return l.options; })).slice(0, 200));

  test.subHeading('G4.11 C2-C3: lines by their time, marks in the popular style');
  if (order(app) === '0:1,1:1,0:2,1:2,1:3') test.check('five lines, data-sent and data-seq, oldest first by time');
  else test.fail(OWED11 + 'lines drawn ' + JSON.stringify(order(app)));
  const m = function (s, q) { const n = lineFor(app, s, q)[0]; return n ? shown(n) : ''; };
  if (m(1, 2).indexOf(ICON.LOADING) !== -1 && m(1, 1).indexOf('✓') !== -1 && m(1, 3).indexOf('❗') !== -1) test.check('mine: ⏳ unsent, ✓ kept, ❗ refused');
  else test.fail(OWED11 + 'marks: unsent ' + JSON.stringify(m(1, 2)).slice(0, 80) + ', kept ' + JSON.stringify(m(1, 1)).slice(0, 80) + ', refused ' + JSON.stringify(m(1, 3)).slice(0, 80));
  if ([ICON.LOADING, '✓', '❗'].every(function (g) { return m(0, 2).indexOf(g) === -1; })) test.check('theirs: no mark');
  else test.fail(OWED11 + 'a received line is marked: ' + JSON.stringify(m(0, 2)).slice(0, 100));

  test.subHeading('G4.11 C2-C4: a publish is reconciled, the arrival becomes current, keys move it');
  app.publish({ line: Object.assign({ peer: PEER }, line({ sent: 1, seq: 2, at: T(4), text: 'second of mine', refused: '' })) });
  await settled();
  if (lineFor(app, 1, 2).length === 1 && m(1, 2).indexOf('✓') !== -1 && m(1, 2).indexOf(ICON.LOADING) === -1) test.check('a line published again is updated in place: ⏳ became ✓, one element');
  else test.fail(OWED11 + 'after the publish: ' + lineFor(app, 1, 2).length + ' elements, ' + JSON.stringify(m(1, 2)).slice(0, 100));
  app.publish({ line: Object.assign({ peer: PEER }, line({ sent: 0, seq: 4, at: T(7), text: 'the answer', re: { writer: PEER, seq: 3 } })) });
  await settled();
  if (order(app) === '0:1,1:1,0:2,1:2,1:3,0:4' && current(app).join() === '0:4') test.check('a line that arrives is placed by its time and becomes the current line');
  else test.fail(OWED11 + 'after an arrival: lines ' + JSON.stringify(order(app)) + ', current ' + JSON.stringify(current(app)));
  const replyBefore = m(0, 4);
  // The reply is not the current line when its answered line arrives, so a repaint of the old current line cannot
  // fill its quote by accident (wsl-claude's mutation, 4e9a523e).
  const elsewhere = lineFor(app, 0, 1)[0];
  if (elsewhere) { fire(elsewhere, 'click'); await settled(); }
  app.publish({ line: Object.assign({ peer: PEER }, line({ sent: 0, seq: 3, at: '2026-10-03T10:03:30.000Z', text: 'the question it answers' })) });
  await settled();
  if (order(app) === '0:1,1:1,0:2,0:3,1:2,1:3,0:4' && m(0, 4).indexOf('the question it answers') !== -1 && replyBefore.indexOf('the question it answers') === -1) test.check('a reply that came first gets its quote once the answered line arrives, placed before it by time');
  else test.fail(OWED11 + 'after the answered line: lines ' + JSON.stringify(order(app)) + ', the reply shows ' + JSON.stringify(m(0, 4)).slice(0, 160));
  const cur = function () { return current(app).join(); };
  const keyOn = function (k) { const n = lineFor(app, ...cur().split(':').map(Number))[0] || app.container; fire(n, 'keydown', { key: k }); };
  // From a known line: which of the two late arrivals is current is not the point here.
  const last = lineFor(app, 0, 4)[0];
  if (last) { fire(last, 'click'); await settled(); }
  keyOn('ArrowUp'); await settled(); const up = cur();
  keyOn('Home'); await settled(); const home = cur();
  keyOn('ArrowDown'); await settled(); const down = cur();
  keyOn('End'); await settled(); const end = cur();
  if (up === '1:3' && home === '0:1' && down === '1:1' && end === '0:4') test.check('ArrowUp, Home, ArrowDown, End move the current line');
  else test.fail(OWED11 + 'current after ArrowUp ' + up + ', Home ' + home + ', ArrowDown ' + down + ', End ' + end);
  const target = lineFor(app, 0, 2)[0];
  if (target) fire(target, 'click');
  await settled();
  if (cur() === '0:2') test.check('a click on a line makes it current');
  else test.fail(OWED11 + 'after a click on 0:2 the current line is ' + cur());
  const reply = lineFor(app, 0, 4)[0];
  const quote = reply && all(reply).filter(function (n) { return n !== reply && /the question it answers/.test(n.textContent || ''); })[0];
  if (quote) { fire(quote, 'click'); await settled(); }
  if (quote && cur() === '0:3') test.check('a click on a reply\'s quote makes the answered line current');
  else test.fail(OWED11 + 'the quote ' + (quote ? 'moved the current line to ' + cur() : 'is no element of the reply'));

  test.subHeading('G4.11 C5-C6: the input, Enter sends a reply to the current line');
  const box = textarea(app);
  if (!box) { test.fail(OWED11 + 'the chat has no TEXTAREA'); }
  else {
    const writes = function () { return app.clerverAsks('line.write'); };
    box.value = 'two\nlines';
    fire(box, 'keydown', { key: 'Enter', shiftKey: true });
    await settled();
    const none = writes().length === 0;
    box.value = 'my reply';
    fire(box, 'keydown', { key: 'Enter', shiftKey: false });
    await settled();
    const w = writes()[0];
    if (none && w && w.body.to === PEER && w.body.text === 'my reply' && w.body.re && w.body.re.writer === PEER && w.body.re.seq === 3) test.check('Shift+Enter sends nothing; Enter sends line.write {to, text, re: the current line}');
    else test.fail(OWED11 + 'Shift+Enter sent ' + !none + '; Enter sent ' + JSON.stringify(w));
    const mine = lineFor(app, 1, 4)[0];
    if (mine && /my reply/.test(shown(mine)) && shown(mine).indexOf(ICON.LOADING) !== -1) test.check('the sent line shows at once by the seq answered, ⏳');
    else test.fail(OWED11 + 'after Enter the line 1:4 is ' + JSON.stringify(mine && shown(mine)).slice(0, 120));
    if (mine && /the question it answers/.test(shown(mine))) test.check('and quotes the line it answers');
    else test.fail(OWED11 + 'the sent reply shows no quote: ' + JSON.stringify(mine && shown(mine)).slice(0, 120));
    app.publish({ line: Object.assign({ peer: PEER }, line({ sent: 1, seq: 4, at: T(8), text: 'my reply', re: { writer: PEER, seq: 3 }, refused: '' })) });
    await settled();
    if (lineFor(app, 1, 4).length === 1 && shown(lineFor(app, 1, 4)[0]).indexOf('✓') !== -1) test.check('its publish makes it ✓, still one element');
    else test.fail(OWED11 + 'after its publish: ' + lineFor(app, 1, 4).length + ' elements');
    // Andy, 2026-10-03 (under G4.10): "i like the small reference, on top of an answer, but maybe leave it out when
    // that line immediately precedes the answer." Theirs answers my 1:4, drawn right above it: no quote.
    app.publish({ line: Object.assign({ peer: PEER }, line({ sent: 0, seq: 5, at: T(9), text: 'right back at you', re: { writer: 'MY-OWN-KEY', seq: 4 } })) });
    await settled();
    const adj = lineFor(app, 0, 5)[0];
    const order5 = order(app);
    if (adj && /,1:4,0:5$/.test(order5) && !/my reply/.test(shown(adj))) test.check('a reply drawn right after the line it answers shows no quote');
    else test.fail(OWED10 + 'lines ' + JSON.stringify(order5) + '; the adjacent reply shows ' + JSON.stringify(adj && shown(adj)).slice(0, 120));
    if (/the question it answers/.test(m(0, 4))) test.check('and a reply further from its line keeps its quote');
    else test.fail(OWED10 + 'the reply 0:4 lost its quote: ' + JSON.stringify(m(0, 4)).slice(0, 120));
    // A line landing between them brings the quote back (wsl-claude's mutation of 3e957722: dropping that redraw passed).
    // The reply is made not current first, so the arrival's repaint of the old current line cannot do it by accident.
    const away = lineFor(app, 0, 1)[0];
    if (away) { fire(away, 'click'); await settled(); }
    app.publish({ line: Object.assign({ peer: PEER }, line({ sent: 0, seq: 6, at: '2026-10-03T10:08:30.000Z', text: 'squeezed in between' })) });
    await settled();
    const back5 = lineFor(app, 0, 5)[0];
    if (/,1:4,0:6,0:5$/.test(order(app)) && back5 && /my reply/.test(shown(back5))) test.check('a line landing between a reply and its line brings the quote back');
    else test.fail(OWED10 + 'lines ' + JSON.stringify(order(app)) + '; the reply 0:5 shows ' + JSON.stringify(back5 && shown(back5)).slice(0, 120));
  }

  test.subHeading('G4.11 C7: older lines by before, on a scroll to the top');
  const scrollers = all(app.container).filter(function (n) { return (n.listeners.scroll || []).length; });
  scrollers.forEach(function (n) { n.scrollTop = 0; fire(n, 'scroll', { bubbles: false }); });
  await settled();
  const older = app.clerverAsks('chat.read').filter(function (a) { return a.body.before; });
  if (older.length && older[0].body.peer === PEER && older[0].body.before === T(1) && lineFor(app, 0, 0).length === 1 && order(app).indexOf('0:0') === 0) test.check('chat.read {peer, before: the oldest line\'s at}, the older line drawn first');
  else test.fail(OWED11 + 'on a scroll to the top: ' + scrollers.length + ' elements listen to scroll; asked ' + JSON.stringify(older) + '; lines ' + JSON.stringify(order(app)));

  test.subHeading('G4.11 C8: plain or bubbles, chosen in the chat pane, kept in shell/chatter');
  const select = all(app.container).filter(function (n) { return n.tagName === 'SELECT' && /plain/.test(shown(n)) && /bubbles/.test(shown(n)); })[0];
  if (select) {
    // Andy, 2026-10-03 (under G4.10): "the style dropdown. call the second style just \"bubbles\", the long name forces
    // the style dropdown to be too wide."
    if (!/speech bubbles/i.test(shown(select))) test.check('the second style is called just "bubbles"');
    else test.fail(OWED10 + 'the style dropdown still says ' + JSON.stringify(shown(select)).slice(0, 120));
    select.value = 'bubbles';
    fire(select, 'change');
    await settled();
    const keptIn = Object.keys(app.saved).filter(function (k) { return /bubbles/.test(app.saved[k]); })[0];
    if (keptIn) test.check('a change is kept through api.fs (' + keptIn + ')');
    else test.fail(OWED11 + 'the style was kept nowhere: ' + JSON.stringify(app.saved).slice(0, 160));
    if (keptIn) {
      const again = mount({ files: (function () { const f = {}; f[keptIn] = app.saved[keptIn]; return f; })() });
      await settled();
      const sel2 = all(again.container).filter(function (n) { return n.tagName === 'SELECT' && /bubbles/.test(shown(n)); })[0];
      if (sel2 && sel2.value === 'bubbles') test.check('and the next mount shows bubbles');
      else test.fail(OWED11 + 'the next mount shows ' + JSON.stringify(sel2 && sel2.value));
    }
  } else test.fail(OWED11 + 'the chat pane has no SELECT offering plain and bubbles');

  test.subHeading('G4.10 P4-P5: a new chat with a contact from the book, never a blocked one');
  const app2 = mount();
  await settled();
  const pick = picker(app2);
  if (pick) {
    const button = all(pick.root).filter(function (n) { return n.tagName === 'BUTTON'; })[0];
    if (button) fire(button, 'click');
    await settled();
    if (app2.asked.some(function (a) { return a.verb === 'contact.search'; })) test.check('a contact dropdown over the node\'s contact.search');
    else test.fail(OWED10 + 'the new-chat dropdown never asked contact.search');
    const newRow = rowFor(pick.root, NEWBIE);
    if (newRow && !rowFor(pick.root, BLOCKED)) test.check('the book\'s contacts offered, the blocked one not');
    else test.fail(OWED10 + 'offered: Newbie ' + !!newRow + ', Blocky ' + !!rowFor(pick.root, BLOCKED));
    if (newRow) fire(newRow, 'click');
    await settled();
    const opened = app2.clerverAsks('chat.read').filter(function (a) { return a.body.peer === NEWBIE; });
    const named = app2.labels.filter(function (l) { return l.options.key === NEWBIE && l.options.editable === true; });
    if (opened.length && named.length) test.check('the pick opens its chat, named in the title bar');
    else test.fail(OWED10 + 'after the pick: chat.read ' + JSON.stringify(opened) + ', title labels ' + named.length);
    const box2 = textarea(app2);
    if (box2) {
      box2.value = 'first words';
      fire(box2, 'keydown', { key: 'Enter' });
      await settled();
    }
    const first = app2.clerverAsks('line.write')[0];
    if (first && first.body.to === NEWBIE && first.body.text === 'first words') test.check('the first line goes line.write {to: the picked contact}');
    else test.fail(OWED10 + 'the first line went ' + JSON.stringify(first));
  } else test.fail(OWED10 + 'there is no new-chat contact dropdown');
  const before = app2.clerverAsks('peers.search').length;
  app2.publish({ line: Object.assign({ peer: STRANGER }, line({ sent: 0, seq: 1, at: T(9), text: 'hello from nowhere' })) });
  await settled();
  if (app2.clerverAsks('peers.search').length > before) test.check('a line from a peer the list does not hold makes it ask peers.search again');
  else test.fail(OWED10 + 'a line from a new peer did not refresh the list');

  // ── goal/G4.10, reopened: Andy, 2026-10-03, trying chatter live: "and the list doesn't show presence."; "same green
  // and white dots i see in contacts"; "my line said, \"like in contacts\" where i only see green and white...";
  // "also i'd like to see pane boundaries (vertiacally) and possibly change theirs size by dragging the pane
  // boundary"; "and i kind of expected to see the empty right-hand pane, so i could test it's collapsibility".
  test.subHeading('G4.10 P6: presence from the relay-presence job, through the shell\'s one stream');
  const app3 = mount();
  await settled();
  if (app3.listensToJobs()) test.check('chatter hears jobs through api.onJobs (no stream of its own)');
  else test.fail(OWED10 + 'chatter does not ask api.onJobs');
  const p3 = pane(app3);
  const presTable = {}; presTable[PEER] = { present: true, at: T(9) }; presTable[QUIET] = { present: false, at: T(9) };
  app3.presence(presTable);
  await settled();
  const r3 = function (k) { const r = p3 && rowFor(p3.root, k); return r ? shown(r) : ''; };
  if (r3(PEER).indexOf(ICON.GREEN_CIRCLE) !== -1 && r3(QUIET).indexOf(ICON.GREEN_CIRCLE) === -1 && r3(QUIET).indexOf(ICON.WHITE_CIRCLE) !== -1) test.check('a present peer green, an absent one white');
  else test.fail(OWED10 + 'after the presence job: ' + JSON.stringify([r3(PEER), r3(QUIET)]).slice(0, 220));
  if (r3(PEER).indexOf(ICON.WAITING) !== -1) test.check('and its ⌛ for unanswered stands beside the green');
  else test.fail(OWED10 + 'PEER lost its unanswered mark: ' + JSON.stringify(r3(PEER)).slice(0, 160));
  // Andy, 2026-10-03: "2. the color of presence dots in the dropdown don't match the color of the presence dots in the pane..."
  const pk3 = picker(app3);
  const presTable2 = {}; presTable2[PEER] = { present: true, at: T(9) }; presTable2[NEWBIE] = { present: true, at: T(9) };
  app3.presence(presTable2);
  await settled();
  if (pk3) {
    const pkButton = all(pk3.root).filter(function (n) { return n.tagName === 'BUTTON'; })[0];
    if (pkButton) fire(pkButton, 'click');
    await settled();
    const nb = rowFor(pk3.root, NEWBIE);
    if (nb && shown(nb).indexOf(ICON.GREEN_CIRCLE) !== -1) test.check('the new-chat dropdown shows the same presence: a present contact green there too');
    else test.fail(OWED10 + 'in the dropdown a present contact shows ' + JSON.stringify(nb && shown(nb)).slice(0, 120));
  } else test.fail(OWED10 + 'no new-chat dropdown');

  test.subHeading('G4.10 P7: three panes, the right one empty, each side pane folding toward its edge');
  const paneEl = function (app, name) { return all(app.container).filter(function (n) { return n.getAttribute && n.getAttribute('data-pane') === name; })[0] || null; };
  const foldEl = function (app, name) { return all(app.container).filter(function (n) { return n.getAttribute && n.getAttribute('data-fold') === name; })[0] || null; };
  const objects = paneEl(app3, 'objects');
  if (paneEl(app3, 'peers') && paneEl(app3, 'chat') && objects && visible(objects, app3.container)) test.check('data-pane peers, chat and objects, the objects pane shown (empty until file transfer)');
  else test.fail(OWED10 + 'panes: peers ' + !!paneEl(app3, 'peers') + ', chat ' + !!paneEl(app3, 'chat') + ', objects ' + !!objects);
  const fo = foldEl(app3, 'objects'); const fp = foldEl(app3, 'peers');
  if (fo && fp) {
    const start = shown(fo).indexOf(ICON.POINTRIGHT) !== -1 && shown(fp).indexOf(ICON.POINTLEFT) !== -1;
    fire(fo, 'click'); await settled();
    const folded = !!objects && !visible(objects, app3.container) && shown(fo).indexOf(ICON.POINTLEFT) !== -1;
    fire(fo, 'click'); await settled();
    const back = !!objects && visible(objects, app3.container) && shown(fo).indexOf(ICON.POINTRIGHT) !== -1;
    if (start && folded && back) test.check('the objects fold: POINTRIGHT open, a click folds it (POINTLEFT), again opens; the peers fold mirrors it');
    else test.fail(OWED10 + 'folds: start ' + start + ', folded ' + folded + ', back ' + back);
  } else test.fail(OWED10 + 'fold buttons: peers ' + !!fp + ', objects ' + !!fo);

  test.subHeading('G4.10 P8: visible boundaries, dragged to resize, the widths kept in shell/chatter');
  const divider = function (app, side) { return all(app.container).filter(function (n) { return n.getAttribute && n.getAttribute('data-divider') === side; })[0] || null; };
  const widthOf = function (el) { return el ? String(el.style.width || el.style.flexBasis || '') : ''; };
  const dl = divider(app3, 'left'); const dr = divider(app3, 'right');
  if (dl && dr && visible(dl, app3.container) && visible(dr, app3.container)) test.check('data-divider left and right, both shown');
  else test.fail(OWED10 + 'dividers: left ' + !!dl + ', right ' + !!dr);
  if (dl && dr) {
    const peersEl = paneEl(app3, 'peers');
    const before1 = widthOf(peersEl);
    const drag = function (el, from, to) {
      fire(el, 'pointerdown', { clientX: from, button: 0, pointerId: 1 });
      app3.doc.dispatchEvent({ type: 'pointermove', clientX: to, pointerId: 1, preventDefault: function () {} });
      app3.doc.dispatchEvent({ type: 'pointerup', clientX: to, pointerId: 1, preventDefault: function () {} });
    };
    drag(dl, 300, 360);
    await settled();
    const after1 = widthOf(peersEl);
    if (/px$/.test(after1) && after1 !== before1) test.check('dragging the left boundary sets the peer pane\'s width (' + (before1 || 'none') + ' to ' + after1 + ')');
    else test.fail(OWED10 + 'after a drag the peer pane\'s width is ' + JSON.stringify(after1) + ' (was ' + JSON.stringify(before1) + ')');
    drag(dr, 900, 820);
    await settled();
    const kept = Object.keys(app3.saved).filter(function (k) { return app3.saved[k].indexOf(after1.replace('px', '')) !== -1; })[0];
    if (kept && /bubbles|plain/.test(app3.saved[kept])) test.check('the widths are kept with the look in one file through api.fs (' + kept + ')');
    else test.fail(OWED10 + 'kept: ' + JSON.stringify(app3.saved).slice(0, 200));
    if (kept) {
      const files = {}; files[kept] = app3.saved[kept];
      const app4 = mount({ files: files });
      await settled();
      if (widthOf(paneEl(app4, 'peers')) === after1) test.check('and the next mount draws the peer pane at that width');
      else test.fail(OWED10 + 'the next mount draws ' + JSON.stringify(widthOf(paneEl(app4, 'peers'))));
    }
  }

  test.subHeading('G4.10 P9: the pane\'s search finds peers by the names it shows');
  const app5 = mount();
  await settled();
  const p5 = pane(app5);
  const box5 = p5 && all(p5.root).filter(function (n) { return n.tagName === 'INPUT'; })[0];
  const listed = function () { return p5 ? all(p5.root).filter(function (n) { return n.getAttribute && n.getAttribute('data-key') !== null && visible(n, p5.root); }).map(function (n) { return n.getAttribute('data-key'); }) : []; };
  if (box5) {
    box5.value = 'pet';
    fire(box5, 'input');
    await settled();
    const byName = listed();
    box5.value = 'quin';
    fire(box5, 'input');
    await settled();
    const byName2 = listed();
    box5.value = 'stan';
    fire(box5, 'input');
    await settled();
    const noChat = listed();
    if (byName.join() === PEER && byName2.join() === QUIET) test.check('"pet" finds Pete, "quin" finds Quinn: names, not keys');
    else test.fail(OWED10 + 'typed "pet" lists ' + byName.length + ' rows (' + (byName.indexOf(PEER) !== -1 ? 'Pete among them' : 'not Pete') + '), "quin" lists ' + byName2.length);
    if (noChat.length === 0) test.check('a name in the book with no chat lists nobody (the pane holds chats only)');
    else test.fail(OWED10 + 'typed "stan" (no chat) lists ' + JSON.stringify(noChat));
    if (app5.asked.every(function (a) { return a.via !== 'refused'; })) test.check('and every ask of the chatClerver carried its exact keys');
    else test.fail(OWED10 + 'refused asks: ' + JSON.stringify(app5.asked.filter(function (a) { return a.via === 'refused'; })).slice(0, 200));
  } else test.fail(OWED10 + 'the pane has no search box');

  test.subHeading('G4.10 P10: reading resets the count; the count in the title bar');
  const app6 = mount();
  await settled();
  const p6 = pane(app6);
  const row6 = function (app, k) { const pp = pane(app); const r = pp && rowFor(pp.root, k); return r ? shown(r) : ''; };
  const peer6 = p6 && rowFor(p6.root, PEER);
  const hadWaiting = row6(app6, PEER).indexOf(ICON.WAITING) !== -1;
  if (peer6) fire(peer6, 'click');
  await settled();
  if (hadWaiting && row6(app6, PEER).indexOf(ICON.WAITING) === -1) test.check('opening Pete\'s chat takes his ⌛ away');
  else test.fail(OWED10 + 'Pete\'s row before opening had ⌛ ' + hadWaiting + ', after opening shows ' + JSON.stringify(row6(app6, PEER)).slice(0, 100));
  const outsideRows = all(app6.container).filter(function (n) { return !(p6 && p6.root.contains(n)); });
  if (outsideRows.some(function (n) { return /\b2 new messages\b/.test((n.textContent || '') + ' ' + (n.innerHTML || '')); })) test.check('the title bar shows "2 new messages" beside the name');
  else test.fail(OWED10 + 'no "2 new messages" in the centre pane');
  // Andy: "and as soon as andy responds, drop the count, and hide the hourglass".
  const box6 = textarea(app6);
  if (box6) { box6.value = 'my answer'; fire(box6, 'keydown', { key: 'Enter' }); await settled(); }
  const still = all(app6.container).filter(function (n) { return !(p6 && p6.root.contains(n)); }).some(function (n) { return /new messages/.test((n.textContent || '') + ' ' + (n.innerHTML || '')); });
  if (box6 && !still && row6(app6, PEER).indexOf(ICON.WAITING) === -1) test.check('a line written in that chat drops the count from the title bar, and ⌛ stays hidden');
  else test.fail(OWED10 + 'after writing a line: the count still shown ' + still + ', ⌛ ' + (row6(app6, PEER).indexOf(ICON.WAITING) !== -1));
  const seenIn = Object.keys(app6.saved).filter(function (k) { return app6.saved[k].indexOf(PEER) !== -1; })[0];
  if (seenIn) test.check('the reset is kept through api.fs (' + seenIn + ')');
  else test.fail(OWED10 + 'nothing kept for Pete: ' + JSON.stringify(app6.saved).slice(0, 160));
  if (seenIn) {
    const files6 = {}; files6[seenIn] = app6.saved[seenIn];
    const app7 = mount({ files: files6 });
    await settled();
    if (row6(app7, PEER).indexOf(ICON.WAITING) === -1) test.check('the next mount draws no ⌛ for a chat read since its last line');
    else test.fail(OWED10 + 'after a reload Pete shows ' + JSON.stringify(row6(app7, PEER)).slice(0, 100));
    const app8 = mount({ files: files6, peerRow: { at: T(30), sent: 0, seq: 9, unanswered: 3 } });
    await settled();
    if (row6(app8, PEER).indexOf(ICON.WAITING) !== -1) test.check('a newer line of his brings ⌛ back');
    else test.fail(OWED10 + 'with a newer line Pete shows ' + JSON.stringify(row6(app8, PEER)).slice(0, 100));
  }
}

main().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
