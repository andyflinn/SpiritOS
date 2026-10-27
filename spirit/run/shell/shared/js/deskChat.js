// spirit/run/shell/shared/js/deskChat.js
// AN ITEM'S CHAT, ONE COPY FOR EVERY PAGE THAT SHOWS ONE (goal/G27.2).
//
// Lifted from the Desk face's chat mount (shell/desk/desk.js, deskMountChat, goal/G22.3) when the Stacks door dialog
// needed the same chat: the chat of the door's item (Andy, 2026-10-17, in goal/G27.2's box: the dialog's chat is "the
// chat of the desk item that added the door ... the inherited component as in deskDetails"). The Desk face mounts it
// for a plugin's goal, the door dialog for a door's item; each loads it on demand.
//
//   window.spirit.elements.createDeskChat(el, { id, ask, onPublished, escape, lineHtml, time, title, placeholder })
//     id           the item or goal whose chat it is
//     ask          the page's call to the desk server: ask(verb, args) -> Promise of the answer
//     onPublished  the desk server's stream: onPublished(fn) -> its unsubscribe (desk rule 8: it subscribes itself)
//     escape       the page's HTML escape; lineHtml(text) draws one line's text (the face's links), escape by default
//     time         time(at) draws a line's moment as HTML (the face's deskTime); the stamp, escaped, by default
//     title, placeholder   the log's label and the say box's placeholder
//   -> { destroy }
//
// The say box and Send on top (newest first, input on top, as every chat in Desk), then the log, read once with
// item.chat and drawn from what the server publishes; a gap in the changes reads it again. A line not kept stays in
// the box, said why.

(function () {
  function createDeskChat(el, o) {
    o = o || {};
    if (!el) return { destroy: function () {} };
    var esc = typeof o.escape === 'function' ? o.escape : function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
    var lineHtml = typeof o.lineHtml === 'function' ? o.lineHtml : function (t) { return esc(t).replace(/\n/g, '<br>'); };
    var time = typeof o.time === 'function' ? o.time : function (at) { return esc(at ? String(at).replace('T', ' ').replace(/\.\d+Z$/, 'Z') : ''); };
    var target = String(o.id || '');
    var key = 'desk-chat-' + target.replace(/[^A-Za-z0-9_-]/g, '-');
    var lines = null;
    var last = 0;
    var sending = false;
    var live = true;
    var off = null;
    // Every block a leading 1em; Send 1em after itself (the desk's UI rules). Chat text is under no field rule.
    el.innerHTML =
      '<div class="start-job-form card" style="margin-top:1em"><label class="field-label grow">Say' +
        '<textarea id="' + key + '-say" rows="3" placeholder="' + esc(o.placeholder || ('under ' + target)) + '"></textarea></label>' +
        '<button type="button" id="' + key + '-send" style="margin-right:1em">Send</button></div>' +
      '<div id="' + key + '-error" class="job-start-error"></div>' +
      '<div class="stat-tile wide" style="margin-top:1em"><div class="label">' + esc(o.title || ('Chat of ' + target)) + ', newest first</div>' +
        '<div id="' + key + '-log"></div></div>';
    // EVERY LINE A BUBBLE, LEFT-ALIGNED, 1em APART (goal/G6.2): his black on white, everybody else's filled.
    function bubbleHtml(l) {
      var mine = l.by === 'andy';
      var look = mine
        ? ' style="margin:1em 0;padding:6px 10px;background:#000;color:#fff;border-radius:var(--spirit-radius,8px)"'
        : ' style="margin:1em 0;padding:6px 10px;background:rgba(255,255,255,0.08);border-radius:var(--spirit-radius,8px)"';
      return '<div' + look + '><b>' + esc(mine ? 'you' : (l.name || l.by)) + '</b> <span class="job-manifest-note">' + time(l.at) + '</span> ' + lineHtml(l.text) + '</div>';
    }
    function bubble(l) {
      var hold = document.createElement('div');
      hold.innerHTML = bubbleHtml(l);
      return hold.firstChild;
    }
    // THE WHOLE LOG IS DRAWN ONLY WHEN IT IS READ (goal/G41.11; Andy: "in ALL the chats, new lines are no added, THE WHOLE
    // FUCKING THING IS REDRAWN, killing my attempted copies"): on the first read, and on a gap in the changes.
    function draw() {
      var log = document.getElementById(key + '-log');
      if (!log) return;
      if (lines === null) { log.innerHTML = '<div class="job-manifest-note">This chat has not been read yet.</div>'; return; }
      if (!lines.length) { log.innerHTML = '<div class="job-manifest-note">Nothing said yet under ' + esc(target) + '.</div>'; return; }
      log.innerHTML = lines.slice().reverse().map(bubbleHtml).join('');
    }
    // A NEW LINE GOES ON TOP, a changed one replaces its own bubble; every other bubble shown stays as it is.
    function place(at, added) {
      var log = document.getElementById(key + '-log');
      if (!log) return;
      if (lines.length === 1 && added) { draw(); return; }
      if (added) { log.insertBefore(bubble(lines[at]), log.firstChild); return; }
      var old = log.children ? log.children[lines.length - 1 - at] : null;
      if (old) log.replaceChild(bubble(lines[at]), old); else draw();
    }
    function same(a, b) { return a.by === b.by && a.at === b.at && a.text === b.text; }
    function read() {
      return Promise.resolve(o.ask('item.chat', { id: target })).then(function (r) {
        if (!live) return;
        lines = r && Array.isArray(r.chat) ? r.chat : [];
        draw();
      }, function () { /* shown as it stands */ });
    }
    function send() {
      var box = document.getElementById(key + '-say');
      var err = document.getElementById(key + '-error');
      var said = box ? String(box.value || '').trim() : '';
      if (!said || sending) return;
      sending = true;
      if (err) err.textContent = 'Sending…';
      Promise.resolve(o.ask('chat.add', { id: target, text: said })).then(function () {
        sending = false;
        if (box) box.value = '';
        if (err) err.textContent = '';
      }, function (e) {
        // What was typed stays in the box: an unkept line is the writer's to send again.
        sending = false;
        if (err) err.textContent = 'Not kept: ' + ((e && e.message) || e);
      });
    }
    var button = document.getElementById(key + '-send');
    if (button) button.addEventListener('click', send);
    if (typeof o.onPublished === 'function') {
      off = o.onPublished(function (obj) {
        if (!live || !obj || typeof obj !== 'object') return;
        var change = Number(obj.change) || 0;
        if (change && last && change < last) return;
        var gap = (last && change > last + 1) || obj.dropped;
        if (change) last = change;
        if (gap) { read(); return; }
        // A CHAT LINE IS ITS OWN ROW (goal/G33.4): {table: 'chat', id, row}; a line changed after (a take) replaces it.
        if (obj.table !== 'chat' || obj.id !== target || !obj.row || obj.removed || lines === null) return;
        var at = -1;
        lines.forEach(function (l, i) { if (same(l, obj.row)) at = i; });
        if (at === -1) { lines.push(obj.row); place(lines.length - 1, true); } else { lines[at] = obj.row; place(at, false); }
      });
    }
    draw();
    read();
    return { destroy: function () { live = false; if (typeof off === 'function') off(); off = null; } };
  }
  var win = typeof window !== 'undefined' ? window : {};
  (win.spirit = win.spirit || {}).elements = win.spirit.elements || {};
  win.spirit.elements.createDeskChat = createDeskChat;
}());
