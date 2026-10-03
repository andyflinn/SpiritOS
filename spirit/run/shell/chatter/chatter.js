// spirit/run/shell/chatter/chatter.js
// CHATTER: the face of this node's chatClerver (process/js/chatClerver), goal/G4.9 to G4.11.
//
//   Andy, 2026-10-03: "the UI is out of scope, and might be called chatter (similar UI model to my desk, but a
//   surface designed from scratch."; "chatter is the name."; "i didn't switch goals. i included UI in the scope now".
//
// The chatClerver is faceless and knows keys only; chatter is everything a person sees. It asks its server as Desk
// does, jobs.api {ask: {chatClerver: {verb: args}}}, and hears every kept line by its publish, {line: {...}}. It
// builds with the shell's elements: the peer pane and the new-chat dropdown are contactSelector, every name is a
// contactLabel.
//
// TWO PANES (the objects pane on the right waits for file transfer, goal/G4.12):
//   LEFT, the peers (G4.10): a search over peers.search; 🔴 while a peer has unanswered lines, never the number
//   (Andy: "the count is not allowed by 4.14", "🔴 is fine"); a click opens that chat. A new chat begins by picking a
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
var chPick = null;        // the new-chat dropdown (contactSelector)
var chPeer = '';          // the key of the chat shown
var chSelf = '';          // this node's key, for a reply to one of its own lines
var chLines = {};         // 'sent:seq' -> {line, el}
var chOrder = [];         // the keys of chLines, by the line's data
var chCurrent = '';       // the current line's key
var chMore = false;       // the server cut the chat: older lines exist
var chLoadingOlder = false;
var chStyle = 'plain';
var chOpenSeq = 0;        // the newest openChat wins
var ICON = (spirit.core.const && spirit.core.const.ICON) || {};
var CH_PREFS = 'prefs.json';
var CH_STYLES = ['plain', 'bubbles'];

// The app's own elements, built once at mount and held here.
var chParts = {};
function chEl(id) { return chParts[id] || null; }

function chAsk(verb, args) {
  var ask = { chatClerver: {} };
  ask.chatClerver[verb] = args || {};
  return Promise.resolve(chApi.verb('jobs.api', { ask: ask })).then(function (r) {
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

// peers.search's rows carry the record as label: {peer, at, sent, seq, unanswered}. The pane is handed keys alone
// (the label element names them); the record only decides the mark.
function chPeersSearch(text) {
  return chAsk('peers.search', { text: String(text || '') }).then(function (body) {
    var items = (body.items || []).map(function (it) {
      var row = {};
      try { row = JSON.parse(it.label || '{}'); } catch (e) { row = {}; }
      if (chPane) chPane.mark(it.key, Number(row.unanswered) > 0 ? 'unanswered' : 'none');
      return { key: it.key };
    });
    return { items: items, more: !!body.more };
  });
}

// The node's book, less every blocked contact: contact.search lists blocked rows, so each is asked of the book
// (contact.get), as peers.search does; a contact the book cannot answer for is not offered either.
function chContactsSearch(text) {
  return spirit.core.ask('contact.search', { q: String(text || '') }).then(function (a) {
    var body = (a && a.body) || {};
    var items = (body.items || []).filter(function (it) { return it && it.key && it.key !== chSelf; });
    return Promise.all(items.map(function (it) {
      return spirit.core.ask('contact.get', { key: it.key }).then(function (g) {
        var person = g && g.status === 200 && g.body && g.body.person;
        return person && !person.blocked ? { key: it.key, label: it.label } : null;
      }, function () { return null; });
    })).then(function (rows) {
      return { items: rows.filter(Boolean), more: !!body.more };
    });
  });
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
  if (l.refused === 'unsent') return ICON.LOADING || '⏳';
  if (!l.refused) return ICON.DELIVERED || '✓';
  return ICON.REFUSED || '❗';
}

function chTime(at) {
  var d = new Date(at);
  if (isNaN(d.getTime())) return '';
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function chQuoteText(l) {
  var k = chAnsweredKey(l.re);
  if (!k) return null;
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
  // A reply drawn before its answered line gets its quote now.
  chOrder.forEach(function (k) {
    if (k !== key && chAnsweredKey(chLines[k].line.re) === key) chPaintLine(chLines[k]);
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
    slot.appendChild(chApi.ui.elements.createContactLabel({ key: key, editable: true }));
  }
  var box = chEl('ch-input');
  if (box) box.disabled = false;
  chSay('');
  return chAsk('chat.read', { peer: key }).then(function (body) {
    if (mine !== chOpenSeq) return;
    chMore = !!body.more;
    chItemsToLines(body.items).forEach(chUpsert);
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
  chAsk('chat.read', { peer: peer, before: chLines[chOrder[0]].line.at }).then(function (body) {
    chLoadingOlder = false;
    if (peer !== chPeer) return;
    chMore = !!body.more;
    chItemsToLines(body.items).forEach(chUpsert);
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
  chAsk('line.write', { to: to, text: text, re: re }).then(function (body) {
    if (to !== chPeer) return;
    var seq = Number(body.seq);
    // The publish may have drawn it already, with a newer mark; it is never overwritten by this answer.
    if (seq && !chLines[chKey(1, seq)]) {
      chUpsert({ sent: 1, seq: seq, at: new Date().toISOString(), text: text, re: re,
        refused: body.outcome === 'sent' ? '' : body.outcome === 'refused' ? 'refused' : 'unsent' });
      var list = chEl('ch-lines');
      if (list) list.scrollTop = list.scrollHeight;
    }
  }, function (e) {
    // Nothing kept, so nothing lost: what was typed goes back in the box.
    if (!box.value) box.value = text;
    chSay('not sent: ' + e.message);
  });
}

// Every kept line, written or received, by its publish. Another chat's line refreshes the peer list only.
function chOnPublished(obj) {
  if (!obj || typeof obj !== 'object' || !obj.line) return;
  var l = obj.line;
  if (chPane) chPane.refresh();
  if (l.peer !== chPeer) return;
  var fresh = chUpsert(l);
  if (fresh) {
    chSetCurrent(chKey(l.sent, l.seq));
    var list = chEl('ch-lines');
    if (list) list.scrollTop = list.scrollHeight;
  }
}

// ── THE LOOK, KEPT IN shell/chatter (G4.11) ──────────────────────────

function chLoadStyle() {
  var raw = null;
  try { raw = chApi.fs && chApi.fs.loadFile(CH_PREFS); } catch (e) { raw = null; }
  var prefs = {};
  try { prefs = raw ? JSON.parse(raw) : {}; } catch (e) { prefs = {}; }
  return CH_STYLES.indexOf(prefs.style) !== -1 ? prefs.style : 'plain';
}

function chApplyStyle() {
  var root = chApi && chApi._root;
  if (!root) return;
  root.className = 'ch-app ch-style-' + chStyle;
}

// ── THE APP ──────────────────────────────────────────────────────────

spirit.shell.activateApp({
  mount: function (container, api) {
    chApi = api;
    chStyle = chLoadStyle();
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
      '.ch-left { flex: 0 0 280px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }' +
      '.ch-app.ch-left-folded .ch-left { display: none; }' +
      '.ch-fold { flex: 0 0 auto; align-self: flex-start; background: none; border: none; cursor: pointer; font-size: 16px; }' +
      '.ch-centre { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }' +
      '.ch-title { display: flex; align-items: center; gap: 12px; font-size: 18px; font-weight: 600; }' +
      '.ch-title-name { flex: 1; min-width: 0; }' +
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
    var foldBtn = make('button', 'ch-fold', 'ch-fold', { type: 'button', title: 'fold the peers away' });
    root.appendChild(foldBtn);
    root.appendChild(make('div', 'ch-left', 'ch-left'));
    var centre = make('div', null, 'ch-centre');
    var titleBar = make('div', null, 'ch-title');
    var name = make('span', 'ch-title-name', 'ch-title-name');
    name.textContent = 'choose a peer';
    titleBar.appendChild(name);
    var styleSel = make('select', 'ch-style', null, { title: 'how lines look' });
    [['plain', 'plain'], ['bubbles', 'speech bubbles']].forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o[0];
      opt.textContent = o[1];
      styleSel.appendChild(opt);
    });
    titleBar.appendChild(styleSel);
    centre.appendChild(titleBar);
    centre.appendChild(make('div', 'ch-lines', 'ch-lines', { tabindex: '0' }));
    centre.appendChild(make('div', 'ch-status', 'ch-status'));
    var input = make('textarea', 'ch-input', 'ch-input', { placeholder: 'Enter sends, Shift+Enter a new line' });
    input.disabled = true;
    centre.appendChild(input);
    root.appendChild(centre);
    chApplyStyle();

    // The peer pane folds away to the left (G4.9): the button points the way the pane will move.
    var fold = chEl('ch-fold');
    function paintFold() {
      var folded = /\bch-left-folded\b/.test(root.className);
      fold.textContent = folded ? (ICON.POINTRIGHT || '▶') : (ICON.POINTLEFT || '◀');
    }
    fold.addEventListener('click', function () {
      root.className = /\bch-left-folded\b/.test(root.className)
        ? root.className.replace(/\s*ch-left-folded\b/, '') : root.className + ' ch-left-folded';
      paintFold();
    });
    paintFold();

    var left = chEl('ch-left');
    chPick = api.ui.elements.createContactSelector({ search: chContactsSearch, placeholder: 'new chat with…' });
    chPick.addEventListener('change', function () { if (chPick.value) chOpen(chPick.value); });
    left.appendChild(chPick);
    chPane = api.ui.elements.createContactSelector({
      face: 'pane', search: chPeersSearch,
      statuses: [{ status: 'none' }, { status: 'unanswered', iconKey: 'RED_CIRCLE' }],
    });
    chPane.addEventListener('change', function () { if (chPane.value) chOpen(chPane.value); });
    left.appendChild(chPane);

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
      if (api.fs) Promise.resolve(api.fs.saveFile(CH_PREFS, JSON.stringify({ style: chStyle }))).catch(function () {
        chSay('the look could not be kept');
      });
    });

    api.onPublished(chOnPublished, 'chatClerver');
    if (api.onReconnect) api.onReconnect(function () { if (chPane) chPane.refresh(); if (chPeer) chOpen(chPeer); });
    // This node's key, for a reply to one of its own lines.
    Promise.resolve(api.verb('node.card', {})).then(function (r) {
      chSelf = String((r && r.body && (r.body.publicKey || (r.body.card && r.body.card.publicKey))) || '');
    }, function () { /* a reply to its own line then names no writer */ });
  },
});
