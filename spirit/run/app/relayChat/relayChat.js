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
    // Lines this node sent. The mailbox's inbox is per-RECIPIENT — it
    // returns what was addressed to you, never what you sent — so
    // without this a thread would show only the other half of the
    // conversation. Session-lifetime on purpose: these are echoes of
    // what the relay accepted (id and all), not a second store, and a
    // reload asks the mailbox again rather than trusting them.
    var sentByMe = [];

    // Chat 3 — the page reads top to bottom as a conversation: who you
    // are, what was said, and the box you say the next thing in. The
    // claim row stays above the thread because binding is what you do
    // once; the invite folds away because minting is what an owner does
    // rarely, and hiding it from non-owners is chat 4, not this sitting.
    container.innerHTML =
      '<h3 id="rc-title">Relay Chat</h3>' +
      '<div class="stat-tile wide" id="rc-claim-row">' +
        '<label>Your name<input type="text" id="rc-name" placeholder="andy"></label>' +
        '<label>Invite token<input type="text" id="rc-invite" placeholder="(only if you were invited)"></label>' +
        '<button type="button" id="rc-claim">Claim</button>' +
        '<span id="rc-status"></span>' +
      '</div>' +
      '<div class="job-log-panel" id="rc-thread"></div>' +
      // Docked under the thread, where a chat composer belongs. To is a
      // list of PEOPLE, and a person is a key: two johns are two rows
      // because the mailbox keeps them as two peers, and a typed name
      // could not say which one you meant. `relay` is in the list too —
      // it is a real destination (the mailbox itself, which answers the
      // owner with a census) and the only one that is a name rather than
      // a key, so it comes from the node rather than from a string
      // written here.
      '<div class="start-job-form" id="rc-composer">' +
        '<select id="rc-to-pick"><option value="">(pick a person)</option></select>' +
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
      titleEl.textContent = text;
      document.title = text;

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
      document.getElementById('rc-claim-row').style.display = myName ? 'none' : '';
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
          refreshPeople();
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

    // One line per message: time, who, text. "Who" is the other party —
    // your own lines are marked by class, not by repeating your name at
    // yourself. Everything crossing this boundary came off a mailbox any
    // peer can write to, so every piece of it is escaped.
    function renderThread(fetched) {
      var thread = document.getElementById('rc-thread');
      if (!thread) return;

      // Merge by id: a message that comes back from the mailbox (a note
      // to yourself does) must not appear twice.
      var seen = Object.create(null);
      var messages = [];
      (fetched || []).forEach(function (m) { seen[m.id] = true; messages.push(m); });
      sentByMe.forEach(function (m) { if (!seen[m.id]) messages.push(m); });
      messages.sort(function (a, b) { return String(a.sentAt).localeCompare(String(b.sentAt)); });

      // Same sticky-scroll rule the Jobs log uses: pin to the bottom
      // while you are reading the newest line, leave the scroll alone
      // while you are reading back through older ones.
      var distanceFromBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight;
      var stick = distanceFromBottom < 40;

      thread.innerHTML = messages.map(function (m) {
        var mine = !!myName && m.from === myName;
        var when = new Date(m.sentAt);
        var time = isNaN(when.getTime()) ? m.sentAt : when.toLocaleTimeString();
        var who = mine ? m.to : m.from;
        return '<div class="rc-msg ' + (mine ? 'me' : 'them') + '">' +
          '<span class="rc-time">' + api.escapeHtml(time) + '</span>' +
          '<span class="rc-who">' + api.escapeHtml(mine ? '→ ' + who : who) + '</span>' +
          '<span class="rc-text">' + api.escapeHtml(m.text) + '</span>' +
          '</div>';
      }).join('') || '<div class="job-log-empty">(nothing here yet)</div>';

      if (stick) thread.scrollTop = thread.scrollHeight;
    }

    function refreshInbox() {
      if (!myName) return;
      fetch('/api/hub/inbox?name=' + encodeURIComponent(myName))
        .then(function (r) { return r.json(); })
        .then(function (data) { renderThread(data.messages || []); })
        .catch(function (e) { setStatus('inbox failed: ' + e.message); });
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
      if (!myName) return;
      fetch('/api/hub/who')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var pick = document.getElementById('rc-to-pick');
          var chosen = pick.value;
          var people = (data && data.people) || [];
          pick.innerHTML = '<option value="">(pick a person)</option>';
          // The mailbox itself, named by the node rather than by a
          // literal here: `relay` is reserved, so it is never a peer in
          // `who`, but it is the one destination that answers back.
          if (data && data.reservedName) {
            var box = document.createElement('option');
            box.value = data.reservedName;
            box.textContent = data.reservedName + ' (this mailbox)';
            pick.appendChild(box);
          }
          people.forEach(function (person) {
            var opt = document.createElement('option');
            opt.value = person.publicKey;
            opt.textContent = person.caption + (person.mine ? ' — you' : '');
            pick.appendChild(opt);
          });
          pick.value = chosen; // a refresh must not silently change who you were about to write to
        })
        .catch(function (e) { setStatus('people failed: ' + e.message); });
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
          refreshPeople();
        }
      });
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
      // Whoever is picked, and only that: a key, or the reserved name of
      // the mailbox. Nothing is typed at this control any more, so
      // nothing can be aimed at a name that does not exist.
      var to = document.getElementById('rc-to-pick').value;
      var text = document.getElementById('rc-text').value;
      if (!myName) {
        setStatus('claim a name first');
        return;
      }
      if (!to) {
        setStatus('pick who this is for');
        return;
      }
      hubPost('/api/hub/send', { from: myName, to: to, text: text }).then(function (r) {
        if (r.status === 201) {
          var msg = null;
          try { msg = JSON.parse(r.text); } catch (e) { msg = null; }
          // What the relay stored, not what was typed: the wire may have
          // resolved a key to a public label on the way through.
          if (msg && msg.id) sentByMe.push(msg);
          setStatus('');
          document.getElementById('rc-text').value = '';
        } else {
          setStatus(r.status + ' ' + r.text);
        }
        refreshInbox();
      });
    });

    paintTitle();
    restoreSession();
    setInterval(refreshInbox, 2000);
  },
  render: function () {}
});
