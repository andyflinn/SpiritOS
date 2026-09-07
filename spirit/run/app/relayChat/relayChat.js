spirit.shell.activateApp({
  mount: function (container, api) {
    var myName = '';
    var statusEl;
    var ownedUrls = [];

    container.innerHTML =
      '<div class="stat-tile wide">' +
        '<label>Your name<input type="text" id="rc-name" placeholder="andy"></label>' +
        '<label>Invite token<input type="text" id="rc-invite" placeholder="(only if you were invited)"></label>' +
        '<button type="button" id="rc-claim">Claim</button>' +
        '<label>To<input type="text" id="rc-to" placeholder="bert"></label>' +
        '<label>Text<input type="text" id="rc-text" placeholder="hello"></label>' +
        '<button type="button" id="rc-send">Send</button>' +
        '<span id="rc-status"></span>' +
      '</div>' +
      // Create-invitation is not a second app and not an admin screen: it
      // is this app, with one more row, shown only while this node's key
      // owns a mailbox in Natter. No badge, no row. See DICTIONARY.md.
      '<div class="stat-tile wide" id="rc-invite-panel" style="display:none">' +
        '<label>Invite<input type="text" id="rc-inv-label" placeholder="saint"></label>' +
        '<label>Days<input type="number" id="rc-inv-days" min="1" max="15" value="7"></label>' +
        // A typed token is a wish until the relay will mint one: the mint
        // signature covers label and days only, so an unsigned token from
        // the page would be a token an owner never signed for. Andy has
        // this for a later sitting (A2), not cycle B.
        '<label>Token<input type="text" id="rc-inv-token" placeholder="(optional, not minted yet)"></label>' +
        '<label id="rc-inv-pick-wrap" style="display:none">Mailbox<select id="rc-inv-pick"></select></label>' +
        '<button type="button" id="rc-inv-go">Invite</button>' +
        '<span id="rc-inv-out"></span>' +
      '</div>' +
      '<pre id="rc-log"></pre>';

    statusEl = document.getElementById('rc-status');

    function setStatus(t) { statusEl.textContent = t; }

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

    function refreshInbox() {
      if (!myName) return;
      fetch('/api/hub/inbox?name=' + encodeURIComponent(myName))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var lines = (data.messages || []).map(function (m) {
            return m.sentAt + ' ' + m.from + ' → ' + m.to + ': ' + m.text;
          });
          document.getElementById('rc-log').textContent = lines.join('\n') || '(empty)';
        })
        .catch(function (e) { setStatus('inbox failed: ' + e.message); });
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
          var panel = document.getElementById('rc-invite-panel');
          var pickWrap = document.getElementById('rc-inv-pick-wrap');
          var pick = document.getElementById('rc-inv-pick');
          panel.style.display = ownedUrls.length ? '' : 'none';
          pickWrap.style.display = (data && data.mustPick) ? '' : 'none';
          pick.innerHTML = '';
          rows.filter(function (row) { return row.owned; }).forEach(function (row) {
            var opt = document.createElement('option');
            opt.value = row.url;
            opt.textContent = row.label;
            pick.appendChild(opt);
          });
        })
        .catch(function (e) { setStatus('badge failed: ' + e.message); });
    }

    document.getElementById('rc-inv-go').addEventListener('click', function () {
      var out = document.getElementById('rc-inv-out');
      var wanted = document.getElementById('rc-inv-token').value.trim();
      // Never relays.json[0] by habit: with one owned mailbox the node
      // knows which; with several the human has already said.
      var url = ownedUrls.length === 1
        ? ownedUrls[0]
        : document.getElementById('rc-inv-pick').value;
      hubPost('/api/hub/invite', {
        name: myName,
        label: document.getElementById('rc-inv-label').value.trim(),
        days: Number(document.getElementById('rc-inv-days').value) || 7,
        url: url
      }).then(function (r) {
        var token = '';
        try { token = JSON.parse(r.text).token || ''; } catch (e) { token = ''; }
        // Printed, not copied: Andy reads it off this screen onto a phone.
        out.textContent = token
          ? token + '  →  ' + url + (wanted && wanted !== token
              ? '   (your token was not used — the relay mints, A2)' : '')
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
          myName = name;
          refreshBadges();
        }
      });
    });

    document.getElementById('rc-send').addEventListener('click', function () {
      var to = document.getElementById('rc-to').value.trim();
      var text = document.getElementById('rc-text').value;
      if (!myName) {
        setStatus('claim a name first');
        return;
      }
      hubPost('/api/hub/send', { from: myName, to: to, text: text }).then(function (r) {
        setStatus(r.status + ' ' + r.text);
        document.getElementById('rc-text').value = '';
        refreshInbox();
      });
    });

    setInterval(refreshInbox, 2000);
  },
  render: function () {}
});
