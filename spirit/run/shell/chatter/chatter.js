// spirit/run/shell/chatter/chatter.js
// CHATTER: the face of this node's chatClerver (process/js/chatClerver), goal/G4.9 to G4.11.
//
//   Andy, 2026-10-03: "the UI is out of scope, and might be called chatter (similar UI model to my desk, but a
//   surface designed from scratch."; "chatter is the name."; "i didn't switch goals. i included UI in the scope now".
//
// The chatClerver is faceless and knows keys only; chatter is everything a person sees. It asks its server as Desk
// does, by the verb's name on the flat apiDoor (chatClerver.<verb>, args), and hears every kept line by its publish, {line: {...}}. It
// builds with the shell's elements: the peer pane and the new-chat dropdown are contactSelector, every name is a
// contactLabel.
//
// TWO PANES (the objects pane on the right waits for file transfer, goal/G4.12):
//   LEFT, the peers (G4.10): a search by name over the peers with a chat; ⌛ while a peer has unanswered lines,
//   never the number (Andy: "the count is not allowed by 4.14"; the 🔴 he first chose became "use ICON:WAITING", since
//   it read as a presence dot); a click opens that chat. A new chat begins by picking a
//   contact from the node's book, a blocked one never offered (Andy: "a blocked contact should not be offered to the
//   chatter user at all."), and its first line goes line.write {to}.
//   CENTRE, one chat (G4.11): its contact named in the pane's own title bar; lines placed by their data, never by
//   arrival, a line published again updated in place; one current line, which an arrival becomes and a click or the
//   arrow, Home and End keys move; a reply answers the current line and quotes it; the popular marks, ⏳ travelling,
//   ✓ kept by the peer, ❗ refused, no read mark (Andy: "we won't support \"read\""); Enter sends, Shift+Enter a new
//   line; older lines by before on a scroll to the top, no paging; plain or speech bubbles, chosen in the title bar
//   and kept in this app's own folder (Andy: "looks like the preferences belon in shell/chatter").

var chApi = null;
var chPane = null;        // the peer pane (contactSelector, face pane)
var chPeer = '';          // the key of the chat shown
var chSearch = null;      // the open chat's search, the shared list (goal/G29.18)
function chEscapeHtml(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
var chSelf = '';          // this node's key, for a reply to one of its own lines
var chLines = {};         // 'sent:seq' -> {line, el}
var chOrder = [];         // the keys of chLines, by the line's data
var chCurrent = '';       // the current line's key
var chMore = false;       // the server cut the chat: older lines exist
var chLoadingOlder = false;
var chStyle = 'plain';
var chOpenSeq = 0;        // the newest openChat wins
var chSeen = {};          // per peer, the newest line time already shown here (kept in shell/chatter)
var CH_PREFS = 'prefs.json';
var CH_STYLES = ['plain', 'bubbles'];

// The app's own elements, built once at mount and held here.
var chParts = {};
function chEl(id) { return chParts[id] || null; }
// THE ICON ELEMENT, LOADED BY THE APP ITSELF (goal/G41.23, rule/26): through the one loader, once.
var chIconPart = window.spirit && typeof window.spirit.require === 'function'
  ? Promise.resolve(window.spirit.require('spirit/element/icon.js')).then(null, function () { /* the arrows stay text */ })
  : Promise.resolve();

// THE LINES ARE THE chatClerver FAMILY'S CACHE (goal/G41.28; Andy: "anything not using the new spiritData.js and it's
// buddies clientCacheManager.js must do so in this item. no exceptions."): every line a read, a search or a send brings is
// kept by the family's cache manager (spirit.data.chatClerver.data.keep), and every line the server publishes too; the window places
// a line of the open chat from there (its watch), and an arrival (its published) is read, made current and scrolled to.
// chLines holds the window's own elements, each with the line it paints.
function chData() { return (window.spirit && ((window.spirit.data || {}).chatClerver || {}).data) || null; }
function chKeep(peer, lines) { var C = chData(); if (C && peer) C.keep(peer, lines); }

function chAsk(verb, args) {
  return Promise.resolve(chApi.verb('chatClerver.' + verb, args || {})).then(function (r) {
    var body = r && r.body;
    if (!r || r.status !== 200 || !body || body.ok === false) {
      throw new Error((body && (body.code || body.error)) || 'the chatClerver did not answer');
    }
    return body;
  });
}

function chSay(text) {
  var out = chEl('ch-status');
  if (out) out.textContent = text || '';
}

// ── THE PEERS (G4.10) ────────────────────────────────────────────────

// chats.search's rows carry the record as label: {peer, at, sent, seq, unanswered}. The pane is handed keys alone
// (the label element names them); the record only decides the mark.
//
// ONE PANE, THE CONTACTS (goal/G29.9, goal/G41.28). Andy, 2026-10-18: "in chatter, why does the contact pane look
// different from contacts? It fails to show proper columns for contacts, it should be all-pane mode there, that would
// be enough." So the pane is the contact selector, a view of the contacts the contact family's cache keeps (Andy, Q25:
// "WHY wouldn't chatter use the the contacts in spirit.data?"), less this node and every blocked contact (P5: never
// offered), by one hidden filter ("Why can't chatter insert a hidden filter when it draws contacts?"); a new chat starts
// from any of them.
var CH_OFFERED = { name: 'offered', when: function () { return false; },
  test: function (row) { return row && row.key !== chSelf && row.blocked !== true ? 1 : 0; } };
// THE ⌛ MARKS: the chats (chats.search, the record {peer, at, sent, seq, unanswered}), kept in the chatClerver family's
// cache, decide which contact has a line waiting. Exactly the verb's keys: the app server refuses any other shape
// (appServer.js, no-such-argument).
function chMarkChats() {
  return chAsk('chats.search', {}).then(function (b) {
    var C = chData(); if (C) C.keepChats(b);
    ((b && b.items) || []).forEach(function (it) { if (it && it.key && chPane) chPane.mark(it.key, chWaiting(it.key) ? 'unanswered' : 'none'); });
  }, function () { /* no marks */ });
}

// READING RESETS THE COUNT (Andy, goal/G4.10: "it's the fact that they're now reading that should reset the counter,
// and make the hourglass disappear"; "keep the waiting count"). The count is the chatClerver's unanswered; ⌛ shows
// while it is above zero and a line newer than the newest one shown here exists. Kept in this app's folder on the
// node, never sent: there is still no read mark (Andy: "we won't support \"read\"").
function chWaiting(key) {
  var row = chData() ? chData().chat(key) : null;
  if (!row || !(Number(row.unanswered) > 0)) return false;
  return !chSeen[key] || String(row.at || '') > chSeen[key];
}

function chMarkSeen(key, at) {
  if (!key || !at || (chSeen[key] && chSeen[key] >= at)) return;
  chSeen[key] = String(at);
  if (chPane) chPane.mark(key, chWaiting(key) ? 'unanswered' : 'none');
  chSavePrefs();
}

function chShowCount(n) {
  var el = chEl('ch-title-count');
  if (!el) return;
  el.textContent = n > 0 ? n + ' new message' + (n === 1 ? '' : 's') : '';
}

// ── ONE CHAT (G4.11) ─────────────────────────────────────────────────

function chKey(sent, seq) { return Number(sent) + ':' + Number(seq); }

// The line a re names, in this chat: the peer's when the writer is the peer, this node's otherwise.
function chAnsweredKey(re) {
  if (!re || !Number(re.seq)) return '';
  return chKey(re.writer === chPeer ? 0 : 1, re.seq);
}

function chBefore(a, b) {
  if (a.at !== b.at) return a.at < b.at;
  if (a.sent !== b.sent) return a.sent < b.sent;
  return a.seq < b.seq;
}

function chMark(l) {
  if (Number(l.sent) !== 1) return '';
  if (l.refused === 'unsent') return '⏳' || '⏳';
  if (!l.refused) return '✓' || '✓';
  return '❗' || '❗';
}

function chTime(at) {
  var d = new Date(at);
  if (isNaN(d.getTime())) return '';
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function chQuoteText(l) {
  var k = chAnsweredKey(l.re);
  if (!k) return null;
  // No quote for the line right above (Andy, goal/G4.10: "maybe leave it out when that line immediately precedes the
  // answer"); a line placed between them later brings it back.
  var at = chOrder.indexOf(chKey(l.sent, l.seq));
  if (at > 0 && chOrder[at - 1] === k) return null;
  var ans = chLines[k];
  if (!ans) return '…';
  var t = String(ans.line.text || '');
  return t.length > 80 ? t.slice(0, 80) + '…' : t;
}

function chPaintLine(entry) {
  var l = entry.line;
  var el = entry.el;
  el.className = 'ch-line ' + (Number(l.sent) === 1 ? 'ch-mine' : 'ch-theirs') +
    (chKey(l.sent, l.seq) === chCurrent ? ' current' : '');
  el.innerHTML = '';
  var quote = chQuoteText(l);
  if (quote !== null) {
    var q = document.createElement('div');
    q.className = 'ch-quote';
    q.textContent = quote;
    el.appendChild(q);
  }
  var text = document.createElement('div');
  text.className = 'ch-text';
  text.textContent = String(l.text || '');
  el.appendChild(text);
  var meta = document.createElement('span');
  meta.className = 'ch-meta';
  var mark = chMark(l);
  meta.textContent = chTime(l.at) + (mark ? ' ' + mark : '');
  if (l.refused && l.refused !== 'unsent') meta.title = 'refused: ' + l.refused;
  el.appendChild(meta);
}

// Placed by its data, never by its arrival; a line already drawn is updated in place. Answers whether it was new.
function chUpsert(l) {
  var line = {
    sent: Number(l.sent), seq: Number(l.seq), at: String(l.at || ''), text: String(l.text || ''),
    receivedAt: String(l.receivedAt || ''), re: l.re || { writer: '', seq: 0 }, refused: String(l.refused || ''),
  };
  var key = chKey(line.sent, line.seq);
  var list = chEl('ch-lines');
  if (!list) return false;
  var entry = chLines[key];
  var fresh = !entry;
  if (fresh) {
    var el = document.createElement('div');
    el.setAttribute('data-sent', String(line.sent));
    el.setAttribute('data-seq', String(line.seq));
    entry = chLines[key] = { line: line, el: el };
  } else {
    entry.line = line;
  }
  chOrder = chOrder.filter(function (k) { return k !== key; });
  var at = chOrder.length;
  for (var i = 0; i < chOrder.length; i += 1) {
    if (chBefore(line, chLines[chOrder[i]].line)) { at = i; break; }
  }
  chOrder.splice(at, 0, key);
  var next = chOrder[at + 1] ? chLines[chOrder[at + 1]].el : null;
  list.insertBefore(entry.el, next);
  chPaintLine(entry);
  // A reply drawn before its answered line gets its quote now, and the line after this one is drawn again: whether
  // its quote shows depends on what now stands right above it.
  var below = chOrder[at + 1];
  chOrder.forEach(function (k) {
    if (k !== key && (k === below || chAnsweredKey(chLines[k].line.re) === key)) chPaintLine(chLines[k]);
  });
  return fresh;
}

function chSetCurrent(key) {
  if (!chLines[key]) return;
  var old = chCurrent;
  chCurrent = key;
  if (old && chLines[old]) chPaintLine(chLines[old]);
  chPaintLine(chLines[key]);
  if (chLines[key].el.scrollIntoView) chLines[key].el.scrollIntoView({ block: 'nearest' });
}

function chMove(how) {
  if (!chOrder.length) return;
  var i = chOrder.indexOf(chCurrent);
  if (how === 'ArrowUp') i = i <= 0 ? 0 : i - 1;
  else if (how === 'ArrowDown') i = i === -1 ? chOrder.length - 1 : Math.min(chOrder.length - 1, i + 1);
  else if (how === 'Home') i = 0;
  else if (how === 'End') i = chOrder.length - 1;
  chSetCurrent(chOrder[i]);
}

function chItemsToLines(items) {
  return (items || []).map(function (it) {
    try { return JSON.parse(it.label || '{}'); } catch (e) { return null; }
  }).filter(function (l) { return l && l.seq !== undefined && l.sent !== undefined; });
}

function chOpen(key) {
  if (!key) return;
  var mine = ++chOpenSeq;
  chPeer = key;
  chLines = {};
  chOrder = [];
  chCurrent = '';
  chMore = false;
  var list = chEl('ch-lines');
  if (list) list.innerHTML = '';
  var slot = chEl('ch-title-name');
  if (slot) {
    slot.innerHTML = '';
    window.spirit.element.contactLabel.create(slot, { key: key, editable: true });
  }
  // The count is said once, as the chat opens ("Andy: 35 new messages"), and the chat is then read.
  var row = chData() ? chData().chat(key) : null;
  chShowCount(chWaiting(key) ? Number(row.unanswered) : 0);
  if (row) chMarkSeen(key, row.at);
  var box = chEl('ch-input');
  if (box) box.disabled = false;
  chSay('');
  // What is kept of this chat already is drawn at once; the read brings the rest.
  if (chData()) chData().lines(key).forEach(chUpsert);
  return chAsk('chat.read', { peer: key, before: '', after: '' }).then(function (body) {
    if (mine !== chOpenSeq) return;
    chMore = !!body.more;
    chKeep(key, chItemsToLines(body.items));
    if (chOrder.length) chSetCurrent(chOrder[chOrder.length - 1]);
    var list2 = chEl('ch-lines');
    if (list2) list2.scrollTop = list2.scrollHeight;
  }, function (e) { if (mine === chOpenSeq) chSay('the chat could not be read: ' + e.message); });
}

function chOlder() {
  if (!chPeer || !chMore || chLoadingOlder || !chOrder.length) return;
  chLoadingOlder = true;
  var peer = chPeer;
  var list = chEl('ch-lines');
  var height = list ? list.scrollHeight : 0;
  chAsk('chat.read', { peer: peer, before: chLines[chOrder[0]].line.at, after: '' }).then(function (body) {
    chLoadingOlder = false;
    if (peer !== chPeer) return;
    chMore = !!body.more;
    chKeep(peer, chItemsToLines(body.items));
    // Kept where the reader was: the older lines grow above what was shown.
    if (list && list.scrollHeight > height) list.scrollTop = list.scrollHeight - height;
  }, function (e) { chLoadingOlder = false; chSay('older lines could not be read: ' + e.message); });
}

function chSend() {
  var box = chEl('ch-input');
  if (!box || !chPeer) return;
  var text = String(box.value || '');
  if (!text.trim()) return;
  var to = chPeer;
  var re = { writer: '', seq: 0 };
  var cur = chCurrent && chLines[chCurrent] && chLines[chCurrent].line;
  if (cur) re = { writer: cur.sent === 1 ? chSelf : chPeer, seq: cur.seq };
  box.value = '';
  // Answering drops the count (Andy: "as soon as andy responds, drop the count, and hide the hourglass").
  chShowCount(0);
  chAsk('line.write', { to: to, text: text, re: re }).then(function (body) {
    if (to !== chPeer) return;
    var seq = Number(body.seq);
    // The publish may have kept it already, with a newer mark; it is never overwritten by this answer.
    if (seq && !(chData() && chData().line(to, 1, seq))) {
      chKeep(to, [{ sent: 1, seq: seq, at: new Date().toISOString(), text: text, re: re,
        refused: body.outcome === 'sent' ? '' : body.outcome === 'refused' ? 'refused' : 'unsent' }]);
      var list = chEl('ch-lines');
      if (list) list.scrollTop = list.scrollHeight;
    }
  }, function (e) {
    // Nothing kept, so nothing lost: what was typed goes back in the box.
    if (!box.value) box.value = text;
    chSay('not sent: ' + e.message);
  });
}

// A LINE THE SERVER PUBLISHED, once the family's cache keeps it (spirit.data.chatClerver.data.published): every kept line, written or
// received. The window has placed it already (its watch); another chat's line marks the peer list again only, and a new
// line of the open chat is read, made current and scrolled to.
function chArrived(peer, l, fresh) {
  if (!l) return;
  chMarkChats();
  if (l.peer !== chPeer) return;
  // A line of theirs arriving in the open chat is read as it is drawn.
  if (Number(l.sent) === 0) chMarkSeen(l.peer, l.at);
  if (fresh) {
    chSetCurrent(chKey(l.sent, l.seq));
    var list = chEl('ch-lines');
    if (list) list.scrollTop = list.scrollHeight;
  }
}

// ── THE LOOK, KEPT IN shell/chatter (G4.11) ──────────────────────────

// The look and the two side panes' widths, one file in this app's own folder (goal/G4.10: Andy, "possibly change
// theirs size by dragging the pane boundary"; the widths kept beside the look so they survive a reload).
var CH_WIDTH = { peers: 280, objects: 220 };
var CH_WIDTH_MIN = 160;
var CH_WIDTH_MAX = 640;
function chLoadPrefs() {
  var raw = null;
  try { raw = chApi.fs && chApi.fs.loadFile(CH_PREFS); } catch (e) { raw = null; }
  var prefs = {};
  try { prefs = raw ? JSON.parse(raw) : {}; } catch (e) { prefs = {}; }
  return prefs && typeof prefs === 'object' ? prefs : {};
}
function chClampWidth(n, fallback) {
  var v = Math.round(Number(n));
  if (!(v > 0)) return fallback;
  return Math.max(CH_WIDTH_MIN, Math.min(CH_WIDTH_MAX, v));
}
function chSavePrefs() {
  if (!chApi || !chApi.fs) return;
  var body = JSON.stringify({ style: chStyle, peersWidth: CH_WIDTH.peers, objectsWidth: CH_WIDTH.objects, seen: chSeen });
  Promise.resolve(chApi.fs.saveFile(CH_PREFS, body)).catch(function () { chSay('the look could not be kept'); });
}

function chApplyStyle() {
  var root = chApi && chApi._root;
  if (!root) return;
  root.className = 'ch-app ch-style-' + chStyle;
}

// ── THE APP ──────────────────────────────────────────────────────────

// WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the contact selector (its peer pane) and the contact label, before it
// mounts, so no shell has to have put them on the page.
var chElements = Promise.all(['spirit/element/search/contact.js', 'spirit/element/contactLabel.js'].map(function (p) { return spirit.require(p); }));

spirit.shell.activateApp({
  mount: function (container, api) {
    return chElements.then(function () { chMount(container, api); }, function () { container.textContent = 'Chatter could not be loaded.'; });
  },
});

function chMount(container, api) {
    chApi = api;
    var prefs = chLoadPrefs();
    chStyle = CH_STYLES.indexOf(prefs.style) !== -1 ? prefs.style : 'plain';
    CH_WIDTH.peers = chClampWidth(prefs.peersWidth, 280);
    CH_WIDTH.objects = chClampWidth(prefs.objectsWidth, 220);
    chSeen = {};
    if (prefs.seen && typeof prefs.seen === 'object') {
      Object.keys(prefs.seen).forEach(function (k) { if (typeof prefs.seen[k] === 'string') chSeen[k] = prefs.seen[k]; });
    }
    var root = document.createElement('div');
    api._root = root;
    container.appendChild(root);
    function make(tag, id, cls, attrs) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
      if (id) chParts[id] = e;
      return e;
    }
    var css = make('style');
    css.textContent =
      '.ch-app { display: flex; gap: 12px; height: calc(100vh - 120px); min-height: 320px; }' +
      '.ch-left { flex: 0 0 auto; display: flex; flex-direction: column; gap: 12px; overflow: hidden; }' +
      '.ch-right { flex: 0 0 auto; overflow-y: auto; opacity: 0.6; font-size: 13px; }' +
      '.ch-divider { flex: 0 0 6px; cursor: col-resize; background: rgba(255, 255, 255, 0.12); border-radius: 3px; touch-action: none; }' +
      '.ch-divider:hover { background: rgba(255, 255, 255, 0.3); }' +
      // A folded pane and its boundary: [hidden] would lose to the panes' own display: flex.
      '.ch-app [hidden] { display: none !important; }' +
      '.ch-fold { flex: 0 0 auto; align-self: flex-start; background: none; border: none; cursor: pointer; font-size: 16px; }' +
      '.ch-centre { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }' +
      '.ch-title { display: flex; align-items: center; gap: 12px; font-size: 18px; font-weight: 600; }' +
      '.ch-title-name { flex: 1; min-width: 0; }' +
      '.ch-title-count { font-size: 13px; font-weight: 400; opacity: 0.75; }' +
      '.ch-lines { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; outline: none; }' +
      '.ch-line { padding: 4px 8px; border-radius: 8px; cursor: pointer; }' +
      '.ch-line.current { outline: 1px solid #5b8def; }' +
      '.ch-quote { font-size: 12px; opacity: 0.7; border-left: 3px solid #5b8def; padding-left: 6px; margin-bottom: 2px; }' +
      '.ch-text { white-space: pre-wrap; word-break: break-word; }' +
      '.ch-meta { font-size: 11px; opacity: 0.6; margin-left: 8px; }' +
      '.ch-style-plain .ch-line { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }' +
      '.ch-style-plain .ch-mine .ch-text { font-weight: 500; }' +
      '.ch-style-bubbles .ch-line { max-width: 70%; }' +
      '.ch-style-bubbles .ch-mine { align-self: flex-end; background: #0f3460; }' +
      '.ch-style-bubbles .ch-theirs { align-self: flex-start; background: #2a2f3a; }' +
      '.ch-style-bubbles .ch-meta { display: block; text-align: right; margin-left: 0; }' +
      '.ch-input { width: 100%; min-height: 3em; resize: vertical; font: inherit; }' +
      '.ch-status { font-size: 13px; color: #ff8080; }' +
      '.ch-status:empty { display: none; }';
    root.appendChild(css);
    // THREE PANES (G4.9): peers left, the chat centre, objects right, each side pane folding toward its own window
    // edge by a button there, and sized by dragging the boundary between it and the chat.
    root.appendChild(make('button', 'ch-fold-peers', 'ch-fold', { type: 'button', title: 'fold the peers away', 'data-fold': 'peers' }));
    root.appendChild(make('div', 'ch-left', 'ch-left', { 'data-pane': 'peers' }));
    root.appendChild(make('div', 'ch-divider-left', 'ch-divider', { 'data-divider': 'left', title: 'drag to resize' }));
    var centre = make('div', null, 'ch-centre', { 'data-pane': 'chat' });
    var titleBar = make('div', null, 'ch-title');
    var name = make('span', 'ch-title-name', 'ch-title-name');
    name.textContent = 'choose a peer';
    titleBar.appendChild(name);
    titleBar.appendChild(make('span', 'ch-title-count', 'ch-title-count'));
    var styleSel = make('select', 'ch-style', null, { title: 'how lines look' });
    [['plain', 'plain'], ['bubbles', 'bubbles']].forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o[0];
      opt.textContent = o[1];
      styleSel.appendChild(opt);
    });
    titleBar.appendChild(styleSel);
    centre.appendChild(titleBar);
    // THIS CHAT, SEARCHED (goal/G29.18): the shared list over chat.search, its own box, a who filter.
    centre.appendChild(make('div', 'ch-search', 'ch-search'));
    centre.appendChild(make('div', 'ch-lines', 'ch-lines', { tabindex: '0' }));
    centre.appendChild(make('div', 'ch-status', 'ch-status'));
    var input = make('textarea', 'ch-input', 'ch-input', { placeholder: 'Enter sends, Shift+Enter a new line' });
    input.disabled = true;
    centre.appendChild(input);
    root.appendChild(centre);
    root.appendChild(make('div', 'ch-divider-right', 'ch-divider', { 'data-divider': 'right', title: 'drag to resize' }));
    // Empty until file transfer (goal/G4.12, deferred); shown so its fold can be tried (Andy: "i kind of expected
    // to see the empty right-hand pane, so i could test it's collapsibility").
    var objectsPane = make('div', 'ch-right', 'ch-right', { 'data-pane': 'objects' });
    objectsPane.textContent = 'objects arrive here once file transfer exists';
    root.appendChild(objectsPane);
    root.appendChild(make('button', 'ch-fold-objects', 'ch-fold', { type: 'button', title: 'fold the objects away', 'data-fold': 'objects' }));
    chApplyStyle();

    function sizePanes() {
      [['ch-left', CH_WIDTH.peers], ['ch-right', CH_WIDTH.objects]].forEach(function (pw) {
        var el = chEl(pw[0]);
        el.style.width = pw[1] + 'px';
      });
    }
    sizePanes();

    // Each side pane folds toward its own edge (G4.9): the button points the way the pane will move.
    function fold(which, paneId, dividerId, openGlyph, foldedGlyph) {
      var btn = chEl('ch-fold-' + which);
      var paneEl = chEl(paneId);
      var divider = chEl(dividerId);
      // goal/G41.23: the arrow is an icon (Andy: "this element will replace icons painting all shell elements and apps."),
      // through spirit/element/icon.js once it has loaded (chIconPart), its glyph as text until then.
      function paint() {
        var glyph = paneEl.hidden ? foldedGlyph : openGlyph;
        var I = window.spirit && window.spirit.element && window.spirit.element.icon;
        btn.textContent = '';
        if (I && typeof I.create === 'function') I.create(btn, { glyph: glyph }); else btn.textContent = glyph;
      }
      btn.addEventListener('click', function () {
        paneEl.hidden = !paneEl.hidden;
        divider.hidden = paneEl.hidden;
        paint();
      });
      paint();
      chIconPart.then(paint);
    }
    fold('peers', 'ch-left', 'ch-divider-left', '◀️' || '◀', '▶️' || '▶');
    fold('objects', 'ch-right', 'ch-divider-right', '▶️' || '▶', '◀️' || '◀');

    // A boundary dragged resizes the side pane beside it; the width is kept when the drag ends.
    function drag(dividerId, which, sign) {
      var divider = chEl(dividerId);
      divider.addEventListener('pointerdown', function (event) {
        if (event.button !== undefined && event.button !== 0) return;
        if (event.preventDefault) event.preventDefault();
        var startX = Number(event.clientX) || 0;
        var startW = CH_WIDTH[which];
        function move(e) {
          CH_WIDTH[which] = chClampWidth(startW + sign * ((Number(e.clientX) || 0) - startX), startW);
          sizePanes();
        }
        function up(e) {
          move(e);
          document.removeEventListener('pointermove', move);
          document.removeEventListener('pointerup', up);
          chSavePrefs();
        }
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
      });
    }
    drag('ch-divider-left', 'peers', 1);
    drag('ch-divider-right', 'objects', -1);

    // goal/G29.9: one pane over the book and the chats; the new-chat dropdown that stood here is gone.
    // A LIST GETS A BOX OF A STATED SIZE (rule/16): a fill box in the peers pane, which fills the app's height, the list
    // scrolling inside it.
    var left = document.createElement('div');
    left.className = 'fill';
    chEl('ch-left').appendChild(left);
    chPane = window.spirit.element.search.contact.create(left, {
      face: 'pane', filters: [CH_OFFERED],
      // Waiting lines as ⌛, not a dot that reads as presence (Andy, goal/G4.10: "use ICON:WAITING").
      statuses: [{ status: 'none' }, { status: 'unanswered', glyph: '⌛' }],
    });
    chPane.addEventListener('change', function () { if (chPane.value) chOpen(chPane.value); });
    chMarkChats();

    // THIS CHAT, SEARCHED (goal/G29.18; Andy, 2026-10-18: "the chat window itself can then have a search", and "the
    // chat-history-search should have filters me, other person or both"). The shared list, asking chatClerver's
    // chat.search for the open chat's lines; nothing is asked until words are typed. A row is keyed by its chat as
    // well, so a line of another chat held from an earlier search never stands for this one; a press puts the line
    // in view when the window holds it.
    // A VIEW OF THE CHATS' LINES IN spirit.data (goal/G41.28): the probability search over the lines the chatClerver
    // family's cache keeps (spirit.data.chatClerver.data.branch), each line the shared row element; the open chat's alone, by the
    // who filter. Asked of chatClerver's chat.search once words are typed; every line found is seated in the branch and
    // so joins the history (Andy, 2026-10-18: "all found lines are added to the chat, if they're missing, that won't
    // hurt"), each by its time.
    var chSearchRows = null;
    function chSearchRow(row) {
      var R = window.spirit.element.rowElement;
      var l = row || {};
      chSearchRows = chSearchRows || R.index(function () {});
      return R.create({
        kind: 'chatLine', key: String(l.key || ''), index: chSearchRows, row: l,
        fields: [
          { name: 'at', paint: function (v) { return chEscapeHtml(v.at ? new Date(v.at).toLocaleString() : ''); } },
          { name: 'who', paint: function (v) { return Number(v.sent) === 1 ? 'me' : 'them'; } },
          { name: 'text', paint: function (v) { return chEscapeHtml(String(v.text || '')); } },
        ],
        actions: [],
      });
    }
    Promise.all([spirit.require('spirit/element/search.js'), spirit.require('spirit/element/rowElement.js'), spirit.cacheManager('chatClerver')]).then(function () {
      var C = chData();
      if (!C) return;
      chSearch = window.spirit.element.search.create(chEl('ch-search'), {
        data: C.branch,
        api: {
          verb: function (name, body) {
            var a = body || {};
            var peer = chPeer;
            if (!peer || !String(a.text || '').trim()) return Promise.resolve({ status: 200, body: { items: [], more: false } });
            return chAsk('chat.search', { peer: peer, text: String(a.text || ''), who: String(a.who || '') }).then(function (b) {
              var items = chItemsToLines((b && b.items) || []).map(function (l) {
                l.peer = peer;
                return { key: C.keyOf(peer, l.sent, l.seq), label: JSON.stringify(l) };
              });
              return { status: 200, body: { items: items, more: !!(b && b.more) } };
            });
          },
        },
        server: 'chatClerver',
        verb: 'chat.search',
        args: function (text, filters) { return { text: text, who: filters.who === 'both' ? '' : filters.who }; },
        columns: [{ field: 'at', label: 'When', sort: 'date' }, { field: 'who', label: '' }, { field: 'text', label: 'Line' }],
        filters: [{ name: 'who', choices: [{ value: 'both', word: 'both' }, { value: 'me', word: 'me' }, { value: 'them', word: 'the other' }],
          test: function (l, v) {
            if (!l || l.peer !== chPeer) return 0;
            return v === 'me' ? (Number(l.sent) === 1 ? 1 : 0) : v === 'them' ? (Number(l.sent) === 0 ? 1 : 0) : 1;
          } }],
        element: chSearchRow,
        // A DROPDOWN, AND A PICK IS A LINE IN THE HISTORY (Andy, 2026-10-18: "can that chat history thing be a dropdown,
        // when a line is selected it inserts it's hole content into the shown chat history, if it's missing, and the
        // selected line becomes the currently selected line in the chat history?"): the line is in its place by time,
        // kept already, and becomes the current line, the one a reply quotes (chSend).
        face: 'dropdown',
        placeholder: 'search this chat…',
        // AND ITS CONTEXT (Andy: "make sure the lines befor and after the selected one are added to the chat, so that
        // context is visible..."): the line right before it and the line right after, one ask each, one after the other.
        pick: function (l) {
          if (!l) return;
          var peer = chPeer;
          chSetCurrent(chKey(l.sent, l.seq));
          var one = function (body) { chKeep(peer, chItemsToLines((body && body.items) || []).slice(0, 1)); };
          chAsk('chat.read', { peer: peer, before: String(l.at || ''), after: '' }).then(one)
            .then(function () { return chAsk('chat.read', { peer: peer, before: '', after: String(l.at || '') }); }).then(one)
            .catch(function () { /* the picked line stands; its neighbours come with the next read */ });
        },
        empty: 'Type words to search this chat.',
      });
    }, function () { /* the chat is not searched */ });

    var lines = chEl('ch-lines');
    lines.addEventListener('click', function (event) {
      var t = event.target;
      if (!t || !t.closest) return;
      if (t.closest('.ch-quote')) {
        var line = t.closest('[data-seq]');
        var entry = line && chLines[chKey(line.getAttribute('data-sent'), line.getAttribute('data-seq'))];
        var k = entry && chAnsweredKey(entry.line.re);
        if (k && chLines[k]) { chSetCurrent(k); return; }
      }
      var hit = t.closest('[data-seq]');
      if (hit) chSetCurrent(chKey(hit.getAttribute('data-sent'), hit.getAttribute('data-seq')));
    });
    lines.addEventListener('keydown', function (event) {
      if (['ArrowUp', 'ArrowDown', 'Home', 'End'].indexOf(event.key) === -1) return;
      if (event.preventDefault) event.preventDefault();
      chMove(event.key);
    });
    lines.addEventListener('scroll', function () { if (lines.scrollTop <= 0) chOlder(); });

    chEl('ch-input').addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' || event.shiftKey) return;
      if (event.preventDefault) event.preventDefault();
      chSend();
    });

    var style = chEl('ch-style');
    style.value = chStyle;
    style.addEventListener('change', function () {
      chStyle = CH_STYLES.indexOf(style.value) !== -1 ? style.value : 'plain';
      chApplyStyle();
      chSavePrefs();
    });

    // PRESENCE, as Contacts shows it (goal/G4.10: "same green and white dots i see in contacts"): each contact's present
    // as the contact family's cache keeps it (spirit.data.contact.data, goal/G41.28), drawn as the app opens and again on each
    // change; a key it no longer knows present goes white, as in Contacts: unknown is never present.
    Promise.resolve(spirit.cacheManager('contact')).then(function () {
      var C = ((window.spirit.data || {}).contact || {}).data;
      if (!C) return;
      function dot(key, row) { if (chPane && typeof chPane.present === 'function') chPane.present(key, !!(row && row.present === true)); }
      var all = C.contacts();
      Object.keys(all).forEach(function (key) { dot(key, all[key]); });
      C.watch(function (key, row) { if (key) dot(key, row); });
    }, function () { /* the dots stay white */ });

    // The lines as the chatClerver family's cache keeps them: placed in the open chat as they change, an arrival read.
    Promise.resolve(spirit.cacheManager('chatClerver')).then(function () {
      var C = chData();
      if (!C) return;
      C.watch(function (peer, line) { if (peer && peer === chPeer) chUpsert(line); });
      C.published(chArrived);
    }, function () { /* no lines are kept: the chat says so as it is read */ });
    if (api.onReconnect) api.onReconnect(function () { if (chPane) chPane.refresh(); chMarkChats(); if (chPeer) chOpen(chPeer); });
    // This node's key, for a reply to one of its own lines.
    Promise.resolve(api.verb('node.card', {})).then(function (r) {
      chSelf = String((r && r.body && (r.body.publicKey || (r.body.card && r.body.card.publicKey))) || '');
    }, function () { /* a reply to its own line then names no writer */ });
}
