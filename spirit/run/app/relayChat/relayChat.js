// Relay Chat — the conversation, and only that.
//
// Three jobs used to share this window (ARCHITECTURAL-CONCERNS.md).
// Adding and blocking people left for Contacts (packet 2); claiming a
// name, redeeming a token and minting an invite left for Natter, which
// also keeps the binding file (packet 3). What is left is the thread,
// who it is with, and how loudly mail arrives.
//
// Who this node is comes from the shell — api.nodeLabel(), the same
// accessor the window title uses — so this app never reads or writes a
// binding and cannot disagree with the titlebar about whether there is
// a name.

// What this node does with mail from somebody it has not added. The
// control moved to Contacts (Andy): it is a question about the address
// book, and adding, accepting and renaming all went there in packet 2 —
// this was the piece that stayed behind.
//
// Chat still has to carry the answer, because chat is what polls the
// inbox and the hub takes the policy as a query parameter. So it is read
// here and written there: one copy of the setting, owned by the app that
// draws the control, reached read-only through the unscoped read a
// system app already has.
//
// Read on every poll rather than cached, so changing it in Contacts
// takes effect on chat's next inbox read without the two apps having to
// talk to each other.
var RC_UNKNOWN_FILE = 'app/contacts/prefs.json';
var RC_UNKNOWN_CHOICES = ['silent', 'hold', 'acquire'];

// What this app is called on the wire. Not the shell app id and not the
// folder: a packet names the CONVERSATION KIND, so this app can be
// renamed or moved without a peer's stored traffic becoming unreadable
// (ARCHITECTURAL-CONCERNS.md, packet 1).
var RC_PACKET_APP = 'relay-chat';

spirit.shell.activateApp({
  mount: function (container, api) {
    var myName = '';
    var myTail = ''; // the end of this node's own key, for the footer
    var statusEl;
    var titleEl;
    // Chat 5: the conversation lives on this node, one file per peer,
    // because the mailbox keeps messages by recipient and never hands
    // back what you said. `logs` is what has been read off disk this
    // visit, keyed by chatLog id — the files are the record, this is the
    // cache.
    var ICON = spirit.core.const.ICON;
    var chatLog = window.spiritChatLog;
    var logs = {};       // peer public key -> entries read off disk this visit
    // peer public key -> chat's own refusal of them, off the same file's
    // header. Read for free: logFor already parses the whole file for
    // every peer on mount (loadKnownLogs) and used to keep only the
    // entries. This is NOT the node's block — that is whoBook's, it lives
    // in Contacts, and nothing here may lift it.
    var blockedHere = {};
    var captions = {};   // peer public key -> what this node calls them
    // The mailbox's own key. Not somebody to write to any more — the To
    // list is people, full stop — but still what an old console exchange
    // on disk is filed under, so chatLog keeps being handed it rather
    // than filing yesterday's lines under nothing.
    var mailboxKey = '';
    var people = [];     // the mailbox's peers, captioned by this node
    var search = '';     // a gesture, never remembered

    // Chat 6: what was on screen last time. Deliberately not
    // the binding — that file is who this node IS ({label, boundAt}) and
    // lives with the app that claims it. This is what chat was looking
    // at.
    // Settings. Separate from view.json for the same reason view.json is
    // separate from the binding: this is what this node has DECIDED,
    // not what it was looking at and not who it is. A remembered filter
    // may be reset without touching a policy about strangers.
    var RC_PREFS_FILE = 'prefs.json';
    // What is left after the stranger policy moved to Contacts: this app's
    // own notifications, which are nobody else's business.
    var prefs = { dnd: false };

    var RC_VIEW_FILE = 'view.json';
    var view = { toKey: '', lastSeen: {} };
    // The only filter left, and it is never written down. `new` is a
    // place to stand, not a place to be left — a reload into a filter
    // that has since emptied is a list with no way out — so it lives
    // here and clears when the last unread does.
    //
    // view.json used to carry a `filter` too, back when the list held
    // two kinds of thing and Peers / Relays / All chose between them.
    // The list is people now, so there is nothing left for it to
    // remember. An old file still loads; the field is simply not read.
    var filter = '';     // '' is everyone, 'new' is unread only
    var missingTo = '';  // a remembered To the mailbox no longer has
    // The peer whose Block has been pressed once. Not remembered
    // anywhere: an armed refusal that survived a reload would be waiting
    // for a press nobody knew they were half way through.
    var blockArmed = '';

    // Chat 3 — the page reads top to bottom as a conversation: who you
    // are, what was said, and the box you say the next thing in. The
    // claim row stays above the thread because binding is what you do
    // once; the invite folds away because minting is what an owner does
    // rarely, and hiding it from non-owners is chat 4, not this sitting.
    container.innerHTML =
      '<h3 id="rc-title">Relay Chat</h3>' +
      // Claiming moved to Natter (packet 3): binding this node to a
      // mailbox is what that app is for, and it is the app a fresh node
      // is shown. What is left here is the status line chat writes to.
      '<span id="rc-status"></span>' +
      // Who you are talking to, chosen before what you say. A To value
      // is always a KEY, never a caption: two johns are two peers and
      // one word.
      //
      // Peers / Relays / All used to stand here. They existed to tell
      // two kinds of row apart, and there is only one kind now — a
      // mailbox is not somebody you talk to (see paintToList). What is
      // left is New, and the search, which were never about that.
      '<div class="start-job-form" id="rc-to-bar">' +
        // Only on the page while it means something, which is the whole
        // of its design: the count stops being a notice you have to act
        // on somewhere else and becomes the thing you press. It toggles,
        // because it is now the only way in and so must be the way out.
        '<button type="button" class="cancel-btn" data-filter="new" id="rc-filter-new" style="display:none">New</button>' +
        '<input type="text" id="rc-search" placeholder="find someone">' +
      '</div>' +
      // The open conversation and the decision about it, on one line: the
      // select already says who this is, so the button beside it needs
      // no second caption. Empty for the mailbox and for
      // nobody-selected — there is nothing to accept or refuse about a
      // relay.
      '<div class="start-job-form" id="rc-to-row">' +
        '<select id="rc-to-pick" class="rc-wide"><option value="">(pick a person)</option></select>' +
        '<span id="rc-peer-strip"></span>' +
      '</div>' +
      '<div class="job-log-panel" id="rc-thread"></div>' +
      // Docked under the thread, where a chat composer belongs.
      '<div class="start-job-form" id="rc-composer">' +
        '<input type="text" id="rc-text" placeholder="say something">' +
        '<button type="button" id="rc-send">Send</button>' +
      '</div>' +
      // Settings. Folded away like the other rare jobs, and last because
      // it is the one you touch least. The sound toggle and the Refuse
      // reply are not drawn, because neither is built, and a control that
      // silently does nothing is worse than one that is not there.
      //
      // One switch left in it. "Messages from people I have not added"
      // moved to Contacts (Andy) — it asks what to do about somebody who
      // is not in the address book, which is a question about the address
      // book, not about a chat window. What remains is this app's own
      // notifications, and that is the right size for this app to keep.
      '<details class="stat-tile wide" id="rc-settings-panel">' +
        '<summary>Settings</summary>' +
        // A single switch needs no fold, and a fold that does not fold
        // reads as a broken one — so it is drawn as a peer of the
        // section headings instead, in the same two-column shape the
        // radios use: control, title, and the fine print under the
        // title.
        '<label class="rc-choice stat-tile nested" id="rc-dnd">' +
          '<input type="checkbox" id="rc-dnd-toggle">' +
          '<span class="rc-choice-title">Do not disturb</span>' +
          '<span class="rc-choice-note">Nothing announces itself: no count beside the title, and no sound ' +
          'or notification when those exist. Everything still arrives, is filed, and is marked unread in ' +
          'your list — this is about being interrupted, not about being unreachable.</span>' +
        '</label>' +
      '</details>' +
      // Fine print at the foot of the page: who this node is here, and
      // what its key ends with. The other half of adding somebody is
      // being added, and that question arrives with somebody already on
      // the phone — so the answer is on the page, not behind a panel
      // called Add someone, not behind `whoami` at the mailbox. It is
      // one short line, it is never interacted with, and it is the only
      // place a person can read their own ending without being told
      // where to look.
      '<div class="job-manifest-note" id="rc-footer"></div>';

    statusEl = document.getElementById('rc-status');
    titleEl = document.getElementById('rc-title');

    function setStatus(t) { statusEl.textContent = t; }

    // The heading lives inside this app's own container rather than in
    // the shell titlebar: switchTo rewrites that titlebar from app.name
    // on every visit, so anything written there would survive exactly
    // until the next navigation.
    function paintTitle() {
      var text = myName ? 'Relay Chat [' + myName + ']' : 'Relay Chat';
      // Mail you are not looking at. The thread shows one conversation,
      // so a line from anyone else would otherwise be invisible: it
      // marks its own row, and the count rides in the title for the case
      // where the app is not the tab in front of you.
      var waiting = unseenCount();
      if (waiting > 0 && !quiet()) text += ' · ' + waiting;
      titleEl.textContent = text;
      // The tab belongs to the shell (paintWindowTitle in shell.js): it
      // says which NODE you are looking at, which is what several open
      // windows need to be told apart. This app said "Relay Chat [andy]"
      // there and would now be fighting the shell for the same string,
      // one writer per navigation, last one wins.

      // The unread count rides in the title only. The footer is the one
      // steady line on the page: a person reading their key ending to
      // somebody on the phone should not have it move when mail lands.
      paintMyTail(myTail);

    }

    // How many conversations have something in them this node has not
    // read. Conversations, not lines: the number is a nudge to look, and
    // a line count would be a number nobody can act on.
    function unseenCount() {
      return Object.keys(logs).filter(hasUnseen).length;
    }

    // Do not disturb. One accessor rather than a check at each site,
    // because the sites that matter most do not exist yet: a sound and a
    // desktop notification are the whole reason this switch is worth
    // having, and each of them has to ask something. This is what they
    // ask.
    //
    // It silences NOTIFICATIONS, never information. The dropdown keeps
    // its marks, the New filter still finds unread rows, the thread and
    // the logs are untouched, and view.json goes on remembering how far
    // each conversation was read — so switching it off simply shows the
    // count that was accumulating all along. Nothing is lost while it is
    // on, and nothing about the wire or the disk changes either way.
    //
    // Unrelated to the radio above it: that one decides whether a
    // stranger arrives at all, this one decides how loudly the people
    // you already know do.
    function quiet() {
      return prefs.dnd === true;
    }

    // How many mailboxes Natter lists — read straight off Natter's own
    // file through api.readProject, the unscoped read the shell hands a
    // system app (CLEANUP-PLAN step 6). No network, no mailbox contact,
    // and an answer before this node has claimed anything.
    function natterUrls() {
      if (!api.readProject) return 1; // an older shell: assume a mailbox and show the form
      var raw = null;
      try { raw = api.readProject('app/natter/relays.json'); }
      catch (e) { raw = null; }
      if (!raw) return 0;
      try {
        var rows = JSON.parse(raw);
        if (!Array.isArray(rows)) return 0;
        return rows.filter(function (row) { return row && row.url; }).length;
      } catch (e) {
        return 0;
      }
    }

    // Three states, three things to say, and the first one has no Claim
    // button at all: a name on a mailbox that does not exist is not a
    // thing this node can do yet, so it is not offered.
    // Everything that only means something once this node has a name.
    // While it has none, none of it can do anything: a To list with
    // nobody in it, a thread of nothing, a composer that would refuse
    // the line. In practice an unbound node is shown Natter and never
    // this app (firstRun, shell.js), so this is a belt for a brace.
    var RC_BOUND_ONLY = ['rc-to-bar', 'rc-to-row', 'rc-to-pick', 'rc-settings-panel', 'rc-thread', 'rc-composer'];

    function showBoundChrome(show) {
      RC_BOUND_ONLY.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.style.display = show ? '' : 'none';
      });
      if (show) paintAddressable();
    }

    // What was on screen last time: who was selected, which filter, and
    // how far each conversation had been read. Not the binding — that is
    // who this node is, and it lives in Natter.
    function loadView() {
      var raw = null;
      try { raw = api.fs.loadFile(RC_VIEW_FILE); }
      catch (e) { raw = null; }
      if (!raw) return;
      var parsed = null;
      try { parsed = JSON.parse(raw); }
      catch (e) { return; }
      if (!parsed || typeof parsed !== 'object') return;
      view = {
        toKey: String(parsed.toKey || ''),
        lastSeen: (parsed.lastSeen && typeof parsed.lastSeen === 'object') ? parsed.lastSeen : {},
      };
    }

    function saveView() {
      api.fs.saveFile(RC_VIEW_FILE, JSON.stringify(view, null, 2))
        .catch(function (e) { setStatus('could not remember the view: ' + e.message); });
    }

    function loadPrefs() {
      var raw = null;
      try { raw = api.fs.loadFile(RC_PREFS_FILE); }
      catch (e) { raw = null; }
      if (!raw) return;
      var parsed = null;
      try { parsed = JSON.parse(raw); }
      catch (e) { return; }
      if (!parsed || typeof parsed !== 'object') return;
      prefs = {
        // False unless it says otherwise: being unreachable by default is
        // the wrong kind of safe.
        //
        // An `unknown` in an older file is read past. It moved to
        // app/contacts/prefs.json, Contacts adopts it once, and a second
        // live answer is exactly what a leftover here would be.
        dnd: parsed.dnd === true,
      };
    }

    function savePrefs() {
      api.fs.saveFile(RC_PREFS_FILE, JSON.stringify(prefs, null, 2))
        .catch(function (e) { setStatus('could not remember the setting: ' + e.message); });
    }

    // A remembered conversation, if the list still has it. It used to
    // have to widen the filter to get there — a To could be filtered out
    // of its own list by the kind of row it was. With one kind of row
    // left, only `new` can hide it, and paintToList keeps the chosen row
    // whatever is filtered.
    function selectRestoredTo() {
      if (!view.toKey) return;

      if (!isKnownKey(view.toKey)) {
        missingTo = captions[view.toKey] || 'that peer';
        view.toKey = '';
        saveView();
        paintToList();
        renderThread();
        return;
      }

      paintToList();
      document.getElementById('rc-to-pick').value = view.toKey;
      renderThread();
    }

    // Who this node is, asked of the shell rather than read off disk.
    // The binding is Natter's file now (packet 3), and the shell has one
    // accessor for it — the same one the window title uses — so chat
    // cannot disagree with the titlebar about whether there is a name.
    function restoreSession() {
      myName = (typeof api.nodeLabel === 'function' && api.nodeLabel()) || '';
      showBoundChrome(!!myName);
      paintTitle();
      if (!myName) {
        // Not reachable in practice: an unbound node is shown Natter and
        // nothing else. Said anyway, because 'shown' is a shell rule and
        // this is what this app would otherwise be — a chat window with
        // nobody to be.
        setStatus('claim a name in Natter first');
        return;
      }
      refreshInbox();
      // The people list is what the remembered To is looked up in, so
      // the selection is restored once it has arrived.
      refreshPeople().then(selectRestoredTo);
    }

    function hubPost(path, obj) {
      return fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(obj)
      }).then(function (r) {
        return r.text().then(function (t) {
          return { status: r.status, text: t };
        });
      });
    }

    // Reading and writing one peer's file. Loads are cached for the
    // visit; writes go out immediately, because a line that is only in
    // memory is a line a reload loses, which is the whole of chat 5.
    function logFor(peerKey) {
      if (!chatLog.isLoggable(peerKey)) return [];
      if (!logs[peerKey]) {
        var raw = null;
        try { raw = api.fs.loadFile(chatLog.fileFor(peerKey)); }
        catch (e) { raw = null; }
        var parsed = chatLog.parse(raw);
        logs[peerKey] = parsed.entries;
        blockedHere[peerKey] = parsed.blocked;
      }
      return logs[peerKey];
    }

    // Chat's own refusal of a peer. Asked through logFor so the file is
    // read if this is the first question about them this visit — the
    // answer is in the header and there is no second place to look.
    function isBlockedHere(peerKey) {
      if (!chatLog.isLoggable(peerKey)) return false;
      logFor(peerKey);
      return !!blockedHere[peerKey];
    }

    // One writer for the file, so the flag and the entries can never be
    // saved apart. That is not tidiness: recordMessages writes on every
    // inbox read, and a save that carried only the entries would erase a
    // block the first time the blocked peer wrote again.
    function saveLog(peerKey) {
      return api.fs.saveFile(
        chatLog.fileFor(peerKey),
        chatLog.serialize(peerKey, logs[peerKey] || [], blockedHere[peerKey])
      );
    }

    // Files each line under the peer it belongs to — whoever this node
    // was NOT — as a thin entry: direction, time, words. A line whose
    // other party has no key (the mailbox itself, a keyless peer) is not
    // written anywhere: `relay` is a caption, and a file named after a
    // caption is a file nothing can read back as a peer.
    // What a message says, once the envelope is off.
    //
    //   a packet for this app  -> its body is the line
    //   a plain string         -> the line itself; every live mailbox is
    //                             full of them, and they are chat
    //   a packet for any other -> not ours. Dropped: no row, no peerfile,
    //                             no mark. Sitting 2 can hold; holding it
    //                             today would mean inventing the store
    //                             that still has to be designed.
    //
    // null means "not a chat line", which is the only thing keeping
    // another app's traffic out of a chat archive.
    function chatLineFrom(message) {
      var info = message && message.packet;
      if (!info) {
        // Nothing decoded came with it (a send response, an older
        // shape): read the text the same way the hub would have.
        var decoded = window.spiritPacket.decode(message && message.text);
        info = { legacy: decoded.legacy, app: decoded.app, body: decoded.body };
      }
      if (info.legacy) return String(info.body == null ? '' : info.body);
      if (info.app !== RC_PACKET_APP) return null;
      return typeof info.body === 'string' ? info.body : JSON.stringify(info.body);
    }

    // The message as the archive should hold it: the chat line, never the
    // envelope it travelled in. peerfile stays chat-only.
    function asChatMessage(message) {
      var line = chatLineFrom(message);
      if (line === null) return null;
      var copy = {};
      Object.keys(message || {}).forEach(function (key) { copy[key] = message[key]; });
      copy.text = line;
      return copy;
    }

    function recordMessages(messages, dir) {
      var byPeer = {};
      (messages || []).forEach(function (raw) {
        var m = asChatMessage(raw);
        if (!m) return; // another app's packet is not a line in this thread
        var peerKey = chatLog.peerKeyFor(m, dir, mailboxKey);
        if (!peerKey) return;
        (byPeer[peerKey] = byPeer[peerKey] || []).push(chatLog.entryFor(m, dir));
      });

      Object.keys(byPeer).forEach(function (peerKey) {
        var before = logFor(peerKey);
        var after = chatLog.merge(before, byPeer[peerKey]);
        if (after.length === before.length) return; // nothing new to file
        logs[peerKey] = after;
        // Through saveLog, or this line would drop the header — see
        // there. A blocked peer's mail is still filed on purpose: the
        // block stops this app showing them, never the mailbox accepting
        // them, so the record has to stay whole for when it is lifted.
        saveLog(peerKey)
          .catch(function (e) { setStatus('could not write the log: ' + e.message); });
      });
    }

    // A To value is a key — a peer's, or the mailbox's own. Nothing else
    // is ever in that control, so this is the whole of "who am I looking
    // at".
    function pickedPeerKey() {
      return document.getElementById('rc-to-pick').value || '';
    }

    // The thread is one conversation, never a mixture. A mixed log reads
    // as noise and hides which conversation a line belongs to; the cost
    // is that mail from somebody you are not looking at is off screen,
    // which is what the dots in the To list are for.
    function visibleEntries() {
      var picked = pickedPeerKey();
      if (!picked) return [];
      return logFor(picked).map(function (entry) {
        return { entry: entry, peerKey: picked };
      });
    }

    // The newest thing in a peer's archive, or '' for an empty one.
    function newestAt(peerKey) {
      var entries = logFor(peerKey);
      return entries.length ? String(entries[entries.length - 1].at || '') : '';
    }

    // A row is marked when its archive has grown past the last time this
    // node had that conversation open. Without this, filtering the thread
    // to one peer would hide a line from anyone else with nothing on
    // screen to say so.
    function hasUnseen(peerKey) {
      // Somebody refused here is not somebody with news. Their lines are
      // still arriving and still being filed — a chat block cannot stop
      // that — but a • on the row and a count on the New button would be
      // this app asking for attention on behalf of a person the operator
      // has already said no to. One answer here covers the mark, the
      // count, the New button and the New filter, so pressing New can
      // never land on a row with no composer.
      if (isBlockedHere(peerKey)) return false;
      var newest = newestAt(peerKey);
      if (!newest) return false;
      var seen = view.lastSeen[peerKey] || '';
      return newest > seen;
    }

    // Reading a conversation is what marks it read. Saved rather than
    // held in memory, or a reload would light every row up again.
    function markSeen(peerKey) {
      if (!peerKey) return;
      var newest = newestAt(peerKey);
      if (!newest || view.lastSeen[peerKey] === newest) return;
      view.lastSeen[peerKey] = newest;
      saveView();
    }

    // A file knows a key; a human reads a caption. captions comes from
    // the people list, so a peer this node has renamed in whoBook reads
    // as that name here too.
    function captionFor(peerKey) {
      return captions[peerKey] || peerKey;
    }

    // One row per entry: time, who, text. Direction decides whose line
    // it is — a `sent` entry is yours, and the caption names the other
    // party rather than repeating your own name at you. Everything here
    // came off a mailbox any peer can write to, so every piece of it is
    // escaped.
    function renderThread() {
      var thread = document.getElementById('rc-thread');
      if (!thread) return;
      var rows = visibleEntries();
      var picked = pickedPeerKey();

      // Same sticky-scroll rule the Jobs log uses: pin to the bottom
      // while you are reading the newest line, leave the scroll alone
      // while you are reading back through older ones.
      var distanceFromBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight;
      var stick = distanceFromBottom < 40;

      // Four different silences, and they are not the same thing. A
      // remembered peer who is gone is the one that would otherwise look
      // like an empty conversation, and the app must not answer it by
      // quietly selecting somebody else.
      var empty;
      if (missingTo) {
        empty = '<div class="job-log-empty">' + api.escapeHtml(missingTo) +
          ' is gone — not on this mailbox any more</div>';
      } else if (!picked) {
        empty = '<div class="job-log-empty">Pick someone to see that conversation.</div>';
      } else if (!chatLog.isLoggable(picked)) {
        empty = '<div class="job-log-empty">(nothing is kept for this row — this mailbox has no key of its own yet)</div>';
      } else {
        empty = '<div class="job-log-empty">(nothing here yet)</div>';
      }

      thread.innerHTML = rows.map(function (row) {
        var mine = row.entry.dir === 'sent';
        var when = new Date(row.entry.at);
        var time = isNaN(when.getTime()) ? row.entry.at : when.toLocaleTimeString();
        var who = captionFor(row.peerKey);
        return '<div class="rc-msg ' + (mine ? 'me' : 'them') + '">' +
          '<span class="rc-time">' + api.escapeHtml(time) + '</span>' +
          '<span class="rc-who">' + api.escapeHtml(mine ? '→ ' + who : who) + '</span>' +
          '<span class="rc-text">' + api.escapeHtml(row.entry.text) + '</span>' +
          '</div>';
      }).join('') || empty;

      if (stick) thread.scrollTop = thread.scrollHeight;
      // Having it on screen is having read it.
      markSeen(picked);
    }

    // The inbox is still where anything said TO this node arrives. Every
    // line is filed before it is drawn, so the thread is a view of the
    // files rather than of the last response.
    // The node's policy about strangers, off the file Contacts owns.
    // Anything missing, unreadable or unrecognised reads as `silent`:
    // the tightest setting that still lets two people who added each
    // other talk, so the safe answer is also the default and a broken
    // file cannot quietly open a node up.
    function unknownChoice() {
      var raw = null;
      try { raw = api.readProject(RC_UNKNOWN_FILE); }
      catch (e) { raw = null; }
      var parsed = null;
      try { parsed = JSON.parse(raw); }
      catch (e) { parsed = null; }
      var wanted = parsed && parsed.unknown;
      return RC_UNKNOWN_CHOICES.indexOf(wanted) === -1 ? 'silent' : wanted;
    }

    function refreshInbox() {
      if (!myName) return;
      // The policy travels with the request. The hub does not open any
      // app's prefs.json — it is applied there so a dropped message never
      // reaches the browser at all, but the answer comes from whoever
      // asks, and that is this app.
      //
      // Which is the seam worth knowing about: the control is in Contacts
      // and the polling is here, so two apps have to stay honest about
      // one node-level setting. Whether the hub should read it itself is
      // the open question (see unknownChoice, top of file).
      fetch('/api/hub/inbox?name=' + encodeURIComponent(myName) +
        '&unknown=' + encodeURIComponent(unknownChoice()))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          // Fan-in: the shell routes anything addressed to another app,
          // and drops what nobody is listening for. This app's own
          // packets and the legacy plain lines are recorded below, the
          // way they always were.
          if (typeof api.deliverPackets === 'function') api.deliverPackets(data && data.messages);
          // Everything an inbox read returns was RECEIVED by this node:
          // that is what the route is. Direction is never guessed from
          // the sender's name — a note to yourself is sent and received,
          // and both halves happened.
          recordMessages(data.messages || [], 'received');
          // A line from someone you are not looking at goes to their
          // row, never into the open thread.
          renderThread();
          paintToList();
          paintTitle();
        })
        .catch(function (e) { setStatus('inbox failed: ' + e.message); });
    }

    // Every peer this node knows of, read off disk once a visit, so the
    // combined view after a reload is the whole record and not merely
    // whatever the mailbox still holds for us.
    function loadKnownLogs(people) {
      (people || []).forEach(function (person) { logFor(person.publicKey); });
      renderThread();
    }

    // The people list, captioned by this node: myLabel where whoBook has
    // one, otherwise the label the mailbox shows. The value of each row
    // is the peer's public KEY — that is what send() resolves against,
    // so picking a row cannot land on the other john.
    function refreshPeople() {
      // Like the inbox and the badges: nothing is asked of the mailbox
      // until this node is bound to a name. An unbound node has nobody
      // to write to, so a people list would be a question with no use
      // for its answer.
      if (!myName) return Promise.resolve();
      return fetch('/api/hub/who')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          people = (data && data.people) || [];
          mailboxKey = (data && data.mailboxPublicKey) || '';
          paintMyTail(data && data.selfTail);

          captions = {};
          people.forEach(function (person) { captions[person.publicKey] = person.caption; });

          loadKnownLogs(people);
          paintToList();
        })
        .catch(function (e) { setStatus('people failed: ' + e.message); });
    }

    // Whether a key is anybody this node can address right now. Asked
    // explicitly rather than by handing a value to a <select> and seeing
    // whether it stuck: a browser silently refuses an option that does
    // not exist, and "did the DOM keep what I gave it" is not a decision
    // to rest on.
    function isKnownKey(key) {
      if (!key) return false;
      return people.some(function (person) { return person.publicKey === key; });
    }

    // The To list: people, and a key for a value.
    //
    // Relays used to be in here too. Chatting to a mailbox reaches the
    // console (relayConsole.js), and for a mailbox you do not own the
    // whole of what it will answer is `help` and `whoami` — one
    // diagnostic word, for a row offered to everybody whether they own
    // the thing or not. What it cost to carry was three filter buttons,
    // a rule that flipped the filter when the KIND of your selection
    // changed, and inert rows captioned to explain why they could not be
    // picked. A list that has to apologise for its own contents.
    //
    // The console is untouched on the wire; it is simply not something
    // this app offers. Where it is genuinely useful — an owned mailbox,
    // answering status / peers / invites — its home is the row in Natter
    // that already reports on that mailbox, the same way the mint moved
    // into the row it mints on and stopped needing a picker.
    function paintToList() {
      var pick = document.getElementById('rc-to-pick');
      var chosen = pick.value;
      var needle = search.toLowerCase();
      var blockedHtml = ''; // built with the peers, appended last of all

      function matches(text) {
        return !needle || String(text).toLowerCase().indexOf(needle) !== -1;
      }

      // Contacts, not the census: a mailbox full of peers is an empty
      // list until somebody writes to this node or it redeems an invite.
      // Said plainly, or an empty control reads as a broken one and the
      // first fix anyone reaches for is to refill it from `who`.
      var html = '<option value="">' +
        (people.length ? '(pick a person)' : '(nobody yet — a contact appears when someone writes to you)') +
        '</option>';

      // The filter decides what is in the list. It used to be overridden
      // by "has something unread", so that a marked row could never be
      // hidden — and on a node where everything is unread that swallowed
      // the filter whole and made the buttons look broken. What is
      // hidden is said underneath instead (hiddenUnread, below): a
      // control that does what it says beats a control that quietly
      // knows better.
      var peerRows = people.filter(function (person) {
        // A row already chosen stays in the list whatever is typed:
        // filtering must never silently change who you are writing to.
        if (person.publicKey === chosen) return true;
        if (filter === 'new' && !hasUnseen(person.publicKey)) return false;
        return matches(person.caption);
      });

      {
        // Two groups, because they are two kinds of row. Somebody held or
        // blocked is still selectable — picking them is how you accept
        // them — but they carry a × and the composer goes away while they
        // are chosen, so the list never offers a send that would be
        // refused.
        // The marks say who refused this row, which is the same thing as
        // saying whether there is anything to be done about it here
        // (Andy). Two refusals exist and they are different facts, so
        // they get different pictures and a row carrying both wears both:
        //
        //   📇 ROLODEX  the node refuses them — set in Contacts, and only
        //               Contacts can lift it. Wherever this shows, the
        //               strip offers nothing.
        //   ❌ NO       this app refuses them — set here, lifted here.
        //   📇 ❌       both, and they are undone in that order.
        //   ×          waiting: nobody has refused them, nobody has said
        //               yes either.
        //   •          unread, and only on a row that is none of the above.
        //
        // A block mark replaces × and suppresses •: a refusal is the
        // whole of why a row is not a conversation, and hasUnseen already
        // answers false for one refused here.
        function optionFor(person) {
          var mark = '';
          if (person.blocked) mark += ICON.ROLODEX + ' ';
          if (isBlockedHere(person.publicKey)) mark += ICON.NO + ' ';
          if (!mark && person.held) mark = '× ';
          else if (!mark && hasUnseen(person.publicKey)) mark = '• ';
          var text = mark + person.caption + (person.mine ? ' — you' : '');
          return '<option value="' + api.escapeHtml(person.publicKey) + '">' + api.escapeHtml(text) + '</option>';
        }
        // Refused here counts as held for the list, so the row drops to
        // the bottom group with the others you are not talking to — and
        // stays visible, because a row that vanished could never be
        // unblocked.
        var canWrite = peerRows.filter(function (person) {
          return !person.held && !isBlockedHere(person.publicKey);
        });
        // Held and blocked together, and last of everything: the bottom
        // of a list is where you look for somebody on purpose, and these
        // are rows you open to change your mind about rather than to
        // talk to.
        blockedHtml = peerRows.filter(function (person) {
          return person.held || isBlockedHere(person.publicKey);
        }).map(optionFor).join('');
        if (canWrite.length) {
          html += '<optgroup label="Peers">' + canWrite.map(optionFor).join('') + '</optgroup>';
        }
      }

      if (blockedHtml) html += '<optgroup label="Blocked">' + blockedHtml + '</optgroup>';

      pick.innerHTML = html;

      // A To that is no longer on the mailbox: say which one, and select
      // nobody. Picking the neighbouring row would be the app deciding
      // who you meant.
      if (chosen && !isKnownKey(chosen)) {
        missingTo = captions[chosen] || 'that peer';
        pick.value = '';
        if (view.toKey) {
          view.toKey = '';
          saveView();
        }
        renderThread();
      } else {
        pick.value = chosen; // a refresh must not silently change who you were about to write to
      }

      snapBackFromNew();
      paintFilterButtons();
      // Arming belongs to the row it was pressed on: a To that has moved
      // takes the half-pressed refusal with it.
      if (blockArmed && blockArmed !== pick.value) blockArmed = '';
      paintPeerStrip();
      paintAddressable();
    }

    // The strip beside the To control — same row, to its right — holding
    // whatever this app may decide about whoever is open. Which is: its
    // own refusal, and nothing else.
    //
    //   blocked in Contacts → the Contacts icon, and nothing else. The
    //                node refuses them and chat has no authority to undo
    //                that (Andy), so there is no verb to offer — only the
    //                way to where the verb lives. It is the app's own
    //                picture rather than a sentence because the row is
    //                already wearing that picture: 📇 on the row, 📇 to
    //                press, and the two are the same fact said once.
    //   blocked here → Unblock here, in one press. Undoing a no is the
    //                safe direction; making it as hard as the no would
    //                punish whoever changed their mind.
    //   waiting    → the way to Contacts. Accepting is that app's verb
    //                (packet 2) and stays there. This row keeps a route
    //                where the 📇 row gets none, because × names no app:
    //                somebody has to be told where the yes is said.
    //   a contact  → Block here, in two presses. A block is not a delete:
    //                the row stays, marked, because a list you can be
    //                removed from silently is a list nobody can undo a
    //                mistake in. Two presses because this control sits a
    //                thumb-width from the To picker, and a refusal
    //                nobody meant is a bad thing to reach by accident.
    //
    // "here" is in every caption on purpose. This refusal is chat's, it
    // lives in chat's own log file, and it does not stop a single message
    // arriving — the words have to carry that or the button promises
    // something the app cannot do.
    function paintPeerStrip() {
      var strip = document.getElementById('rc-peer-strip');
      if (!strip) return;
      var key = pickedPeerKey();
      var person = people.filter(function (p) { return p.publicKey === key; })[0];
      if (!key || !person) {
        strip.innerHTML = '';
        return;
      }
      if (person.blocked) {
        // The same id the sentence below uses, so one handler answers
        // both routes — the strip only ever holds one of them.
        //
        // ICON.ROLODEX rather than a lookup through listApps: it is the
        // same constant the mark on the row uses, so the picture you
        // press cannot drift from the picture you saw. Safe because
        // Contacts is intrinsic and its icon is locked as shipped
        // (intrinsic-app-icon-locked, setAppOverride).
        strip.innerHTML = '<button type="button" class="cancel-btn" id="rc-open-contacts" ' +
          'title="Open Contacts">' + ICON.ROLODEX + '</button>';
        return;
      }
      if (isBlockedHere(key)) {
        strip.innerHTML = '<button type="button" class="cancel-btn" data-rc-unblock="' +
          api.escapeHtml(key) + '">Unblock here</button>';
        return;
      }
      if (person.held) {
        // Waiting, not refused. There is nothing to unblock and the yes
        // is not chat's to say, so this is the way to where it is said —
        // a row you cannot act on and cannot leave is a dead end.
        strip.innerHTML = '<button type="button" class="cancel-btn" id="rc-open-contacts">' +
          'Not added — open Contacts</button>';
        return;
      }
      // Armed means the first press has happened and the button is now
      // asking. It is keyed to the peer, so arming one and then picking
      // somebody else disarms rather than following the selection —
      // "press again" has to mean the person it was pressed about.
      var armed = blockArmed === key;
      strip.innerHTML = '<button type="button" class="cancel-btn" data-rc-block="' +
        api.escapeHtml(key) + '">' + (armed ? 'Press again to block' : 'Block here') + '</button>';
    }

    // One refusal, or one taking-back of it. A write to this app's own
    // file and nothing else: no shell surface, no hub call, no capability
    // the rest of the page could borrow. That is the whole point of
    // keeping it in the header — a mere app must not be able to reach a
    // node-global switch (Andy), and chat cannot, because the only thing
    // it holds is its own log.
    //
    // logFor first, so a peer never written to before has a file to hold
    // the flag; the entries are empty and that is a true record.
    function setBlockedHere(key, blocked) {
      if (!chatLog.isLoggable(key)) return;
      logFor(key);
      blockedHere[key] = !!blocked;
      saveLog(key)
        .then(function () { setStatus(''); })
        .catch(function (e) { setStatus('could not write the log: ' + e.message); });
      // Painted from what is now true rather than after the write lands:
      // the flag is already in memory, and a list that waited on the disk
      // would lag a press behind.
      paintToList();
    }

    // A thread and a composer are for saying something to somebody. With
    // nobody in the list they are three controls that cannot be used: an
    // empty log, a box that takes a line, and a Send that would refuse
    // it. AGENT.md — do not show chrome that is not useful in that
    // state. So the page for a freshly bound node with no contacts is
    // the one thing that can move it forward: the list saying a contact
    // appears when somebody writes, and Add someone by handle under it.
    //
    // The test is the To control itself, not "how many contacts exist":
    // what matters is whether the list currently holds somebody who can
    // be written to, which is a question about the filter as much as
    // about the contacts.
    function paintAddressable() {
      var pick = document.getElementById('rc-to-pick');
      if (!pick) return;
      var options = pick.options || [];
      var can = false;
      for (var i = 0; i < options.length; i += 1) {
        if (options[i].value && !options[i].disabled) { can = true; break; }
      }
      // Somebody held is somebody you have not agreed to talk to yet, so
      // there is nothing to type at them. The strip says what to do
      // instead.
      var open = people.filter(function (p) { return p.publicKey === pickedPeerKey(); })[0];
      if (open && open.held) can = false;
      ['rc-thread', 'rc-composer'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.style.display = can ? '' : 'none';
      });
    }

    // `new` is only ever a place to stand while there is something to
    // stand on. Read the last unread and it drops back to everyone: a
    // filter that means "nothing" is worse than no filter at all.
    //
    // This replaces the line that used to sit under the list saying how
    // many marked rows the filter was hiding. A notice telling you to go
    // and look somewhere else is worse than a button that takes you
    // there, and this one is on the page only while it means something.
    function snapBackFromNew() {
      if (filter !== 'new') return;
      // Standing in `new` when the button that took you there has just
      // gone would leave a filter nothing can turn off.
      if (unseenCount() > 0 && !quiet()) return;
      filter = '';
      paintToList();
    }

    function paintFilterButtons() {
      var pressed = document.getElementById('rc-filter-new');
      if (pressed) pressed.style.opacity = (filter === 'new') ? '1' : '0.55';

      // The count is on the button because that is where it can be acted
      // on, and the button is on the page only while there is something
      // to press it for. It stays in the tab as well: the two answer
      // different questions — one for when you are looking at the app,
      // one for when you are not.
      // Not while you have asked not to be disturbed: a button that
      // appears on its own, carrying a number that grows, is a
      // notification whatever else it is also good for. The rows keep
      // their marks — reading a list is not being interrupted — so
      // nothing is hidden, only unannounced.
      var waiting = unseenCount();
      var newButton = document.getElementById('rc-filter-new');
      if (!newButton) return;
      newButton.style.display = (waiting > 0 && !quiet()) ? '' : 'none';
      newButton.textContent = 'New ' + waiting;
    }

    // Drop the To list open. A native <select> cannot simply be told to
    // open: showPicker() is the only way, it needs a real user gesture
    // (a click is one), and it is not in every browser. So this is a
    // request rather than a promise — where it is refused or missing,
    // focus at least puts the keyboard on the control, and nothing here
    // may throw on the way past.
    function openToList() {
      var pick = document.getElementById('rc-to-pick');
      if (!pick) return;
      try {
        if (typeof pick.showPicker === 'function') { pick.showPicker(); return; }
      } catch (e) { /* refused: not a gesture, or not allowed here */ }
      if (typeof pick.focus === 'function') pick.focus();
    }

    function paintSettings() {
      var dnd = document.getElementById('rc-dnd-toggle');
      if (dnd) dnd.checked = quiet();
    }

    // The footer. Same six characters, same words, as the row the other
    // side is reading off their screen while they add you — so a phone
    // call is two people comparing one string, not one of them hunting
    // for a key. Nothing here until the node knows its own key, because
    // a footer that says `key ends` and then nothing is worse than no
    // footer at all.
    function paintMyTail(tail) {
      var foot = document.getElementById('rc-footer');
      if (!foot) return;
      myTail = tail || '';
      foot.textContent = myTail
        ? (myName || 'this node') + ' · key ends ' + myTail
        : '';
    }

    // Picking a peer is picking a conversation, and it is remembered:
    // the thread narrows to that peer's archive and comes back to it on
    // the next visit.
    document.getElementById('rc-to-pick').addEventListener('change', function () {
      missingTo = '';
      view.toKey = pickedPeerKey();
      saveView();
      renderThread();   // reading it is what marks it read
      paintToList();    // so its dot goes, and the strip follows the pick
      paintTitle();     // and so does its share of the count
    });

    // The strip is repainted on every list paint, so the click is
    // delegated and holds no reference to the button.
    document.getElementById('rc-peer-strip').addEventListener('click', function (event) {
      if (!event.target || !event.target.closest) return;

      if (event.target.closest('#rc-open-contacts')) {
        api.launchApp('app/contacts');
        return;
      }

      var blockBtn = event.target.closest('[data-rc-block]');
      if (blockBtn) {
        var blockKey = blockBtn.getAttribute('data-rc-block');
        // First press arms and says so; second press is the refusal.
        if (blockArmed !== blockKey) {
          blockArmed = blockKey;
          paintPeerStrip();
          return;
        }
        blockArmed = '';
        setBlockedHere(blockKey, true);
        return;
      }

      var unblockBtn = event.target.closest('[data-rc-unblock]');
      if (unblockBtn) setBlockedHere(unblockBtn.getAttribute('data-rc-unblock'), false);
    });

    // The one filter left, and neither it nor the search is written
    // down. It toggles: with Peers / Relays / All gone it is the only
    // way into `new`, so it has to be the way out too, or the list has a
    // door that only opens inwards.
    document.getElementById('rc-filter-new').addEventListener('click', function () {
      if (filter === 'new') {
        filter = '';
        paintToList();
        return;
      }
      filter = 'new';
      paintToList();
      // Pressing New is asking "who wrote to me?", and the answer is in
      // the list — so open it.
      openToList();
    });

    document.getElementById('rc-search').addEventListener('input', function (event) {
      search = (event.target && event.target.value) || document.getElementById('rc-search').value || '';
      paintToList();
    });

    // A chat that needs a mouse for every line reads as a form. Enter
    // sends; the button stays for anyone who wants it.
    document.getElementById('rc-text').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        document.getElementById('rc-send').click();
      }
    });

    document.getElementById('rc-send').addEventListener('click', function () {
      // Whoever is picked, and only that. The control holds keys, which
      // is what a conversation is filed under and what a peer actually
      // is. There used to be a translation here, turning the mailbox's
      // key into the reserved caption relay.js resolves — the mailbox is
      // not in the list any more, so the only address left is a peer's
      // own key.
      var picked = pickedPeerKey();
      var to = picked;
      var text = document.getElementById('rc-text').value;
      if (!myName) {
        setStatus('claim a name first');
        return;
      }
      if (!picked) {
        setStatus('pick who this is for');
        return;
      }
      // The composer is already hidden for a held row, but Enter, a
      // stale page and a second window all reach this line too. The last
      // word about who may be written to belongs here, not to whether a
      // control happens to be on screen.
      var open = people.filter(function (p) { return p.publicKey === picked; })[0];
      if (open && open.held) {
        setStatus(open.blocked
          ? 'that person is blocked — unblock them first'
          : 'accept them first, then you can write');
        return;
      }
      // The envelope is the hub's to build; this says who and what.
      // The mailbox still stores a string in `text`, still signed the
      // same way, so nothing on spirit-3 has to move for this.
      hubPost('/api/hub/send', { from: myName, to: to, app: RC_PACKET_APP, body: text }).then(function (r) {
        if (r.status === 201) {
          var msg = null;
          try { msg = JSON.parse(r.text); } catch (e) { msg = null; }
          // What the relay stored, not what was typed: the wire may have
          // resolved a key to a public label on the way through. Filed
          // under the peer it was addressed to — this is the only copy
          // of the line that will ever exist, since the mailbox keeps
          // none for the sender.
          if (msg) {
            recordMessages([msg], 'sent');
            // A word to the mailbox is answered in the same breath: the
            // console does not post its reply into the mailbox (it would
            // evict real mail from a 200-entry ring nobody could read it
            // back out of), so the answer rides home on the send and is
            // filed here like anything else received.
            if (msg.consoleReply) recordMessages([msg.consoleReply], 'received');
            renderThread();
          }
          setStatus('');
          document.getElementById('rc-text').value = '';
        } else {
          setStatus(r.status + ' ' + r.text);
        }
        refreshInbox();
      });
    });

    // The door, from the receiving side. Nothing routes through it yet
    // that this app would not have seen anyway — RC still owns the poll,
    // and hands its catch to the shell to fan out (api.deliverPackets) —
    // but the handler is where a second client's traffic would go, and
    // registering it now is what makes the routing real rather than a
    // shape to be filled in later.
    if (typeof api.onPacket === 'function') {
      api.onPacket(RC_PACKET_APP, function () {
        // Chat lines are recorded by refreshInbox, which sees every
        // message including the legacy ones this handler never gets.
        // Nothing to do here yet; the subscription is what claims the
        // name, and a second app cannot quietly take it.
      });
    }

    document.getElementById('rc-dnd-toggle').addEventListener('change', function (event) {
      prefs.dnd = !!(event.target && event.target.checked);
      savePrefs();
      // Nothing to re-fetch: this changes how the same facts are shown.
      // Both announcements answer to it — the count beside the title and
      // the New button — so switching it off brings back exactly what was
      // accumulating while it was on.
      paintTitle();
      paintToList();
    });

    paintTitle();
    loadView();
    loadPrefs();
    paintSettings();
    paintFilterButtons();
    renderThread();
    restoreSession();
    setInterval(refreshInbox, 2000);
  },
  render: function () {}
});
