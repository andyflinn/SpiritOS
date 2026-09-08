// Chat 1 — the app says who you are (CYCLE-CHAT-1.md).
//
// One claimed label per personal node, remembered in this app's own
// folder (app/relayChat/session.json, via the scoped api.fs) so a reload
// does not make you claim again. The file is a reminder, never a
// credential: what proves the label is still yours is the mailbox
// answering a SIGNED inbox read for it. A stored name whose peer now
// carries somebody else's key comes back 403 and the app shows unbound,
// which is also what happens after a cutover that emptied the mailbox.
var RC_SESSION_FILE = 'session.json';

spirit.shell.activateApp({
  mount: function (container, api) {
    var myName = '';
    var statusEl;
    var titleEl;
    var ownedUrls = [];
    var invitePainted = ''; // what the invite slot was last drawn for
    // Chat 5: the conversation lives on this node, one file per peer,
    // because the mailbox keeps messages by recipient and never hands
    // back what you said. `logs` is what has been read off disk this
    // visit, keyed by chatLog id — the files are the record, this is the
    // cache.
    var chatLog = window.spiritChatLog;
    var logs = {};       // peer public key -> entries read off disk this visit
    var captions = {};   // peer public key -> what this node calls them
    var mailboxKey = ''; // the mailbox's own key, so `relay` is filed like any peer
    var people = [];     // the mailbox's peers, captioned by this node
    var relayRow = null;   // the ONE mailbox this node speaks to: { url, label, owned }
    var otherRelays = [];  // Natter rows the hub does not speak to, shown inert
    var reservedName = 'relay'; // what the wire calls the mailbox when addressing it
    var search = '';     // a gesture, never remembered

    // Chat 6: what was on screen last time. Deliberately not
    // session.json — that file is who this node IS ({label, boundAt}),
    // and a check asserts it stays that. This is what it was looking at.
    var RC_VIEW_FILE = 'view.json';
    var view = { toKey: '', filter: 'peers', lastSeen: {} };
    // `new` is a place to stand, not a place to be left. It is never
    // written to view.json — a reload into a filter that has emptied is
    // a list with no way out — and when the last unread clears, the
    // filter snaps back to whichever real one was showing before.
    var filterBeforeNew = '';
    var missingTo = '';  // a remembered To the mailbox no longer has

    // Chat 3 — the page reads top to bottom as a conversation: who you
    // are, what was said, and the box you say the next thing in. The
    // claim row stays above the thread because binding is what you do
    // once; the invite folds away because minting is what an owner does
    // rarely, and hiding it from non-owners is chat 4, not this sitting.
    container.innerHTML =
      '<h3 id="rc-title">Relay Chat</h3>' +
      // What an unbound node is told, and what it can do about it — one
      // tile, because they are one thought. Two tiles of different
      // widths read as two unrelated things on a page that has only one
      // thing to say (chat 7).
      '<div class="stat-tile wide" id="rc-claim-row">' +
        '<div id="rc-unbound"></div>' +
        '<div id="rc-claim-fields">' +
          '<label>Your name<input type="text" id="rc-name" placeholder="andy"></label>' +
          '<label>Invite token<input type="text" id="rc-invite" placeholder="(only if you were invited)"></label>' +
          '<button type="button" id="rc-claim">Claim</button>' +
        '</div>' +
        '<span id="rc-status"></span>' +
      '</div>' +
      // Who you are talking to, chosen before what you say. A To value
      // is always a KEY — a peer's, or the mailbox's own — never a
      // caption: two johns are two peers and one word, and `relay` names
      // whichever mailbox the hub happens to be pointed at.
      //
      // The filter and the search do the same job from two directions:
      // the filter is what kind of row you want, the search is which one
      // you mean. Only the filter is remembered — a search is a gesture,
      // and reopening the app into a filtered list nobody asked for is
      // worse than typing three letters again.
      '<div class="start-job-form" id="rc-to-bar">' +
        '<button type="button" class="cancel-btn" data-filter="peers" id="rc-filter-peers">Peers</button>' +
        '<button type="button" class="cancel-btn" data-filter="relays" id="rc-filter-relays">Relays</button>' +
        '<button type="button" class="cancel-btn" data-filter="all" id="rc-filter-all">All</button>' +
        // Only on the page while it means something, which is the whole
        // of its design: the count stops being a notice you have to act
        // on somewhere else and becomes the thing you press.
        '<button type="button" class="cancel-btn" data-filter="new" id="rc-filter-new" style="display:none">New</button>' +
        '<input type="text" id="rc-search" placeholder="find someone">' +
      '</div>' +
      '<select id="rc-to-pick" class="rc-wide"><option value="">(pick a person)</option></select>' +
      '<div class="job-log-panel" id="rc-thread"></div>' +
      // Docked under the thread, where a chat composer belongs.
      '<div class="start-job-form" id="rc-composer">' +
        '<input type="text" id="rc-text" placeholder="say something">' +
        '<button type="button" id="rc-send">Send</button>' +
      '</div>' +
      // Last, and empty until this node owns a mailbox. Chat 4: the mint
      // UI is not hidden for a friend, it is not built for them —
      // ownedUrls decides, and a node that owns nothing has no invite
      // markup at all to find. See paintInvitePanel below.
      '<div id="rc-invite-slot"></div>';

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
      if (waiting > 0) text += ' · ' + waiting;
      titleEl.textContent = text;
      document.title = text;
      paintUnbound();

      // Claiming is what you do once. A bound node has nothing to do
      // with this row, and a chat that keeps asking your name at the top
      // of every visit reads as a form, so it goes away — and comes
      // straight back the moment the mailbox stops recognising the
      // label (the 403 in restoreSession calls unbind, which lands
      // here).
      //
      // "Bound" is today's whole answer to "claimed on every relay this
      // node uses": the hub claims, sends and reads on the first Natter
      // row only (loadRelayUrl, hub.js), so there is exactly one mailbox
      // to be claimed on. When the hub learns to speak to a chosen relay
      // the way minting already does, this becomes a per-relay question
      // and this line is where it is asked.
      // The tile goes when there is a name; the FIELDS go when there is
      // no mailbox to claim on. The instruction stays either way, which
      // is why they share one tile.
      document.getElementById('rc-claim-row').style.display = myName ? 'none' : '';
      document.getElementById('rc-claim-fields').style.display = natterUrls() ? '' : 'none';
    }

    // How many conversations have something in them this node has not
    // read. Conversations, not lines: the number is a nudge to look, and
    // a line count would be a number nobody can act on.
    function unseenCount() {
      return Object.keys(logs).filter(hasUnseen).length;
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
    // the line. AGENT.md — do not show chrome that is not useful in that
    // state — and here the instruction for getting in is the page, not a
    // footnote beside a dead form.
    var RC_BOUND_ONLY = ['rc-to-bar', 'rc-to-pick', 'rc-thread', 'rc-composer', 'rc-invite-slot'];

    function showBoundChrome(show) {
      RC_BOUND_ONLY.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.style.display = show ? '' : 'none';
      });
    }

    function paintUnbound() {
      var note = document.getElementById('rc-unbound');
      if (!note) return;
      showBoundChrome(!!myName);
      if (myName) {
        note.textContent = '';
        return;
      }
      note.textContent = natterUrls()
        ? 'Chat needs a name on a public mailbox. If you were invited, enter that name and the spoken word, then Claim. If you own the mailbox, Claim the owner name with no token.'
        : 'This node has no mailbox yet. Open Natter, add one (for example https://spirit.andyflinn.com), then come back.';
    }

    // What was on screen last time: who was selected, which filter, and
    // how far each conversation had been read. Not session.json — that
    // is who this node is, and it stays two fields.
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
        filter: ['peers', 'relays', 'all'].indexOf(parsed.filter) === -1 ? 'peers' : parsed.filter,
        lastSeen: (parsed.lastSeen && typeof parsed.lastSeen === 'object') ? parsed.lastSeen : {},
      };
    }

    function saveView() {
      api.fs.saveFile(RC_VIEW_FILE, JSON.stringify(view, null, 2))
        .catch(function (e) { setStatus('could not remember the view: ' + e.message); });
    }

    // Restore the To first, then widen the filter until that row can be
    // seen. A remembered conversation that is filtered out of its own
    // list is a conversation the app lost on your behalf.
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

      var isRelay = !!mailboxKey && view.toKey === mailboxKey;
      if (isRelay && view.filter === 'peers') view.filter = 'relays';
      if (!isRelay && view.filter === 'relays') view.filter = 'peers';
      paintToList();
      document.getElementById('rc-to-pick').value = view.toKey;
      renderThread();
    }

    function bind(label) {
      myName = label;
      paintTitle();
      api.fs.saveFile(RC_SESSION_FILE, JSON.stringify({
        label: label,
        boundAt: new Date().toISOString(),
      }, null, 2)).catch(function (e) {
        setStatus('could not remember this name: ' + e.message);
      });
    }

    function unbind() {
      myName = '';
      ownedUrls = [];
      invitePainted = '';
      document.getElementById('rc-invite-slot').innerHTML = '';
      paintTitle();
      api.fs.deleteFile(RC_SESSION_FILE);
    }

    // Reload path. The stored label is only a question; the mailbox
    // answers it. A signed inbox read is the cheapest form of "is this
    // still me": the relay verifies the signature against the peer that
    // holds that label, so somebody else's name comes back 403 without
    // this node claiming anything or writing anything.
    function restoreSession() {
      var raw = null;
      try { raw = api.fs.loadFile(RC_SESSION_FILE); }
      catch (e) { raw = null; }
      if (!raw) return;
      var label = '';
      try { label = (JSON.parse(raw) || {}).label || ''; }
      catch (e) { return; }
      if (!label) return;

      fetch('/api/hub/inbox?name=' + encodeURIComponent(label))
        .then(function (r) {
          if (r.status !== 200) {
            unbind();
            setStatus(label + ' does not belong to this node any more (' + r.status + ') — claim again');
            return;
          }
          myName = label;
          paintTitle();
          document.getElementById('rc-name').value = label;
          refreshInbox();
          refreshBadges();
          // The people list is what the remembered To is looked up in,
          // so the selection is restored once it has arrived.
          refreshPeople().then(selectRestoredTo);
        })
        .catch(function (e) { setStatus('could not check ' + label + ': ' + e.message); });
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
        logs[peerKey] = chatLog.parse(raw).entries;
      }
      return logs[peerKey];
    }

    // Files each line under the peer it belongs to — whoever this node
    // was NOT — as a thin entry: direction, time, words. A line whose
    // other party has no key (the mailbox itself, a keyless peer) is not
    // written anywhere: `relay` is a caption, and a file named after a
    // caption is a file nothing can read back as a peer.
    function recordMessages(messages, dir) {
      var byPeer = {};
      (messages || []).forEach(function (m) {
        var peerKey = chatLog.peerKeyFor(m, dir, mailboxKey);
        if (!peerKey) return;
        (byPeer[peerKey] = byPeer[peerKey] || []).push(chatLog.entryFor(m, dir));
      });

      Object.keys(byPeer).forEach(function (peerKey) {
        var before = logFor(peerKey);
        var after = chatLog.merge(before, byPeer[peerKey]);
        if (after.length === before.length) return; // nothing new to file
        logs[peerKey] = after;
        api.fs.saveFile(chatLog.fileFor(peerKey), chatLog.serialize(peerKey, after))
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
    function refreshInbox() {
      if (!myName) return;
      fetch('/api/hub/inbox?name=' + encodeURIComponent(myName))
        .then(function (r) { return r.json(); })
        .then(function (data) {
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
      if (mailboxKey) logFor(mailboxKey);
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
          reservedName = (data && data.reservedName) || 'relay';
          mailboxKey = (data && data.mailboxPublicKey) || '';

          captions = {};
          people.forEach(function (person) { captions[person.publicKey] = person.caption; });
          if (mailboxKey) captions[mailboxKey] = relayCaption(data && data.relay);

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
      if (mailboxKey && key === mailboxKey) return true;
      return people.some(function (person) { return person.publicKey === key; });
    }

    function relayCaption(url) {
      var label = (relayRow && relayRow.label) || url || 'this mailbox';
      return label + ' (this mailbox)';
    }

    // The To list: peers in one group, the mailbox in the other, and a
    // key for a value in both.
    //
    // Exactly ONE relay is selectable — the first Natter row, which is
    // the only mailbox the hub speaks to (loadRelayUrl, hub.js). Another
    // Natter row would look selected and still send here, so it is shown
    // inert with the reason rather than offered: a control whose only
    // interesting value is refused is worse than no control.
    function paintToList() {
      var pick = document.getElementById('rc-to-pick');
      var chosen = pick.value;
      var needle = search.toLowerCase();

      function matches(text) {
        return !needle || String(text).toLowerCase().indexOf(needle) !== -1;
      }

      var html = '<option value="">(pick a person)</option>';

      // The filter decides what is in the list. It used to be overridden
      // by "has something unread", so that a marked row could never be
      // hidden — and on a node where everything is unread that swallowed
      // the filter whole and made the buttons look broken. What is
      // hidden is said underneath instead (hiddenUnread, below): a
      // control that does what it says beats a control that quietly
      // knows better.
      var peerRows = (view.filter === 'relays') ? [] : people.filter(function (person) {
        // A row already chosen stays in the list whatever is typed:
        // filtering must never silently change who you are writing to.
        if (person.publicKey === chosen) return true;
        if (view.filter === 'new' && !hasUnseen(person.publicKey)) return false;
        return matches(person.caption);
      });

      {
        if (peerRows.length) {
          html += '<optgroup label="Peers">' + peerRows.map(function (person) {
            var mark = hasUnseen(person.publicKey) ? '• ' : '';
            var text = mark + person.caption + (person.mine ? ' — you' : '');
            return '<option value="' + api.escapeHtml(person.publicKey) + '">' + api.escapeHtml(text) + '</option>';
          }).join('') + '</optgroup>';
        }
      }

      {
        var relayHtml = '';
        // The mailbox is a conversation like any other, so it answers to
        // `new` on the same terms as a peer.
        var relayWanted = mailboxKey && relayRow && view.filter !== 'peers' &&
          (mailboxKey === chosen ||
            ((view.filter !== 'new' || hasUnseen(mailboxKey)) &&
              (matches(relayRow.label) || matches(relayRow.url))));
        if (relayWanted) {
          var relayMark = hasUnseen(mailboxKey) ? '• ' : '';
          var owned = relayRow.owned ? '★ ' : '';
          relayHtml += '<option value="' + api.escapeHtml(mailboxKey) + '">' +
            api.escapeHtml(relayMark + owned + relayRow.label + '  ' + relayRow.url) + '</option>';
        }
        // Every other Natter row, named and unselectable. The hub sends
        // to the first URL only, so offering these would be a promise
        // the node cannot keep.
        otherRelays.forEach(function (row) {
          if (view.filter === 'peers' || view.filter === 'new') return;
          if (!matches(row.label) && !matches(row.url)) return;
          relayHtml += '<option value="" disabled>' +
            api.escapeHtml((row.owned ? '★ ' : '') + row.label + '  ' + row.url +
              '  — not the mailbox this node speaks to') + '</option>';
        });
        if (relayHtml) html += '<optgroup label="Relays">' + relayHtml + '</optgroup>';
      }

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
    }

    // `new` is only ever a place to stand while there is something to
    // stand on. Read the last unread and it snaps back to whichever real
    // filter was showing when it was pressed: a filter that means
    // "nothing" is worse than no filter at all.
    //
    // This replaces the line that used to sit under the list saying how
    // many marked rows the filter was hiding. A notice telling you to go
    // and look somewhere else is worse than a button that takes you
    // there, and this one is on the page only while it means something.
    function snapBackFromNew() {
      if (view.filter !== 'new') return;
      if (unseenCount() > 0) return;
      view.filter = filterBeforeNew || 'peers';
      filterBeforeNew = '';
      saveView();
      paintToList();
    }

    function paintFilterButtons() {
      ['peers', 'relays', 'all', 'new'].forEach(function (name) {
        var button = document.getElementById('rc-filter-' + name);
        if (button) button.style.opacity = (view.filter === name) ? '1' : '0.55';
      });

      // The count is on the button because that is where it can be acted
      // on, and the button is on the page only while there is something
      // to press it for. It stays in the tab as well: the two answer
      // different questions — one for when you are looking at the app,
      // one for when you are not.
      var waiting = unseenCount();
      var newButton = document.getElementById('rc-filter-new');
      if (!newButton) return;
      newButton.style.display = waiting > 0 ? '' : 'none';
      newButton.textContent = 'New ' + waiting;
    }

    // The badge is one signed status per Natter row — the same census call
    // the owner already had, asked of every URL instead of the first. A
    // node that owns nothing gets no panel and no picker.
    // Create-invitation is not a second app and not an admin screen: it
    // is this app, with one more panel, and only while this node's key
    // owns a mailbox in Natter. A friend who claimed with a token owns
    // nothing, so there is nothing here for them to be refused by.
    //
    // Painted rather than toggled: a `display: none` panel is still a
    // mint form in the page, and the whole point of the owner badge is
    // that the answer comes from the mailbox rather than from the app
    // choosing what to reveal.
    function paintInvitePanel(rows, mustPick) {
      var slot = document.getElementById('rc-invite-slot');
      if (!ownedUrls.length) {
        slot.innerHTML = '';
        return;
      }
      var owned = rows.filter(function (row) { return row.owned; });
      slot.innerHTML =
        '<details class="stat-tile wide" id="rc-invite-panel">' +
          '<summary>Invite someone</summary>' +
          '<label class="field-label">Invite<input type="text" id="rc-inv-label" placeholder="saint"></label>' +
          '<label class="field-label">Days<input type="number" id="rc-inv-days" min="1" max="15" value="7"></label>' +
          // The token Andy speaks on the phone. Empty means the relay
          // picks hex; typed, it is signed with the label and the days
          // (A2), so it is his to say and nobody else's to substitute.
          '<label class="field-label">Token<input type="text" id="rc-inv-token" placeholder="(optional, spoken)"></label>' +
          (mustPick
            ? '<label class="field-label">Mailbox<select id="rc-inv-pick">' +
                owned.map(function (row) {
                  return '<option value="' + api.escapeHtml(row.url) + '">' + api.escapeHtml(row.label) + '</option>';
                }).join('') +
              '</select></label>'
            : '') +
          '<button type="button" class="cancel-btn" id="rc-inv-go">Invite</button>' +
          '<span id="rc-inv-out"></span>' +
        '</details>';
    }

    // The badge is one signed status per Natter row — the same census call
    // the owner already had, asked of every URL instead of the first. A
    // node that owns nothing gets no panel and no picker.
    function refreshBadges() {
      if (!myName) return;
      fetch('/api/hub/status?name=' + encodeURIComponent(myName))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          ownedUrls = (data && data.ownedUrls) || [];
          var rows = (data && data.rows) || [];
          var mustPick = !!(data && data.mustPick);

          // The badge probe is also where the Relays group comes from:
          // it already asks every Natter row whether this node owns it.
          // The first row is the one the hub speaks to; the rest are
          // named and inert.
          relayRow = rows.length ? rows[0] : null;
          otherRelays = rows.slice(1);
          if (mailboxKey && relayRow) captions[mailboxKey] = relayCaption(relayRow.url);
          paintToList();
          // Repainting on every refresh would wipe a half-typed invite,
          // and this runs again on every claim. Only a change in what is
          // owned changes what is drawn.
          var sig = ownedUrls.join(',') + '|' + mustPick;
          if (sig === invitePainted) return;
          invitePainted = sig;
          paintInvitePanel(rows, mustPick);
        })
        .catch(function (e) { setStatus('badge failed: ' + e.message); });
    }

    // Delegated: the button is painted and repainted by
    // paintInvitePanel, so nothing may hold a reference to it.
    document.getElementById('rc-invite-slot').addEventListener('click', function (event) {
      if (!event.target || !event.target.closest || !event.target.closest('#rc-inv-go')) return;
      var out = document.getElementById('rc-inv-out');
      var spoken = document.getElementById('rc-inv-token').value.trim();
      var picker = document.getElementById('rc-inv-pick');
      // Never relays.json[0] by habit: with one owned mailbox the node
      // knows which; with several the human has already said.
      var url = ownedUrls.length === 1 ? ownedUrls[0] : (picker && picker.value);
      hubPost('/api/hub/invite', {
        name: myName,
        label: document.getElementById('rc-inv-label').value.trim(),
        days: Number(document.getElementById('rc-inv-days').value) || 7,
        token: spoken,
        url: url
      }).then(function (r) {
        var token = '';
        try { token = JSON.parse(r.text).token || ''; } catch (e) { token = ''; }
        // Printed, not copied: Andy reads it off this screen onto a phone.
        // What is shown is what the relay stored — the typed token when it
        // took it, hex when the field was empty — never the field itself,
        // which would show a token no mailbox has if the mint was refused.
        out.textContent = (r.status === 201 && token)
          ? token + '  →  ' + url
          : r.status + ' ' + r.text;
      });
    });

    document.getElementById('rc-claim').addEventListener('click', function () {
      var name = document.getElementById('rc-name').value.trim();
      var invite = document.getElementById('rc-invite').value.trim();
      hubPost('/api/hub/claim', invite ? { name: name, invite: invite } : { name: name }).then(function (r) {
        setStatus(r.status + ' ' + r.text);
        // 201 = new claim. 409 is only us when the peer already on the
        // mailbox carries OUR key — the node sets `mine` for that. Any
        // other 409 is somebody else's name, and sending as them would
        // just fail the signature check on the relay.
        var mine = false;
        try { mine = !!JSON.parse(r.text).mine; } catch (e) { mine = false; }
        if (r.status === 201 || (r.status === 409 && mine)) {
          bind(name);
          refreshBadges();
          refreshPeople().then(selectRestoredTo);
        }
      });
    });

    // Picking a peer is picking a conversation, and it is remembered:
    // the thread narrows to that peer's archive and comes back to it on
    // the next visit.
    document.getElementById('rc-to-pick').addEventListener('change', function () {
      missingTo = '';
      view.toKey = pickedPeerKey();
      saveView();
      renderThread();   // reading it is what marks it read
      paintToList();    // so its dot goes
      paintTitle();     // and so does its share of the count
    });

    // The filter is what kind of row you want; it is remembered. The
    // search is which one you mean; it is not.
    ['peers', 'relays', 'all', 'new'].forEach(function (name) {
      document.getElementById('rc-filter-' + name).addEventListener('click', function () {
        if (name === 'new') {
          // Remember where to come back to, and write nothing down: a
          // reload into a filter that has since emptied is a list with
          // no way out.
          if (view.filter !== 'new') filterBeforeNew = view.filter;
          view.filter = 'new';
        } else {
          filterBeforeNew = '';
          view.filter = name;
          saveView();
        }
        paintToList();
      });
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
      // is — but the WIRE addresses the mailbox by its reserved caption,
      // because that is the word relay.js resolves and the one the
      // console answers to. Translating here keeps the key in the UI and
      // leaves relay.js alone.
      var picked = pickedPeerKey();
      var to = (mailboxKey && picked === mailboxKey) ? reservedName : picked;
      var text = document.getElementById('rc-text').value;
      if (!myName) {
        setStatus('claim a name first');
        return;
      }
      if (!picked) {
        setStatus('pick who this is for');
        return;
      }
      hubPost('/api/hub/send', { from: myName, to: to, text: text }).then(function (r) {
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

    paintTitle();
    loadView();
    paintFilterButtons();
    renderThread();
    restoreSession();
    setInterval(refreshInbox, 2000);
  },
  render: function () {}
});
