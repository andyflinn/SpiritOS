// Dynamically loaded by index.html's discoverDynamicApps (see natter.json
// for the id/name/icon this app is already declared under before this
// script ever runs). Maintains a simple list of known relay URLs — Server
// #3's future public-IP hub nodes, for eventual peer-to-peer connections.
// v0 is deliberately just a list: add/remove/view, one label + one URL
// per entry, nothing else — no liveness checking, no key material, no
// connection logic. Stored under this app's own scoped folder
// (app/natter/relays.json, a fixed filename) via api.fs, not shell-wide
// preferences — this is this app's own data, not a shell display setting.
var RELAYS_FILENAME = 'relays.json';

// The binding this node has, if it has one: { label, boundAt }. It lives
// here now (packet 3) because claiming is what this app does — the chat
// window used to hold both the claim form and the file, and neither was
// chat's business. The shell reads this same path for the window title
// and for the first-run gate (readNodeLabel in js/client/shell.js), so
// there is one file and one answer to "is this node bound".
var NATTER_SESSION_FILE = 'session.json';

// What this app is called on the wire when it mints. Nothing to do with
// packets — mint and claim are hub routes, not messages.
var natterMyName = '';
var natterOwnedUrls = [];
var natterMustPick = false;
var natterMintedLabels = [];

function natterLoadRelays(api) {
  var raw = api.fs.loadFile(RELAYS_FILENAME);
  if (raw == null) return [];
  try {
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

// The rule itself lives in js/ownerBadge.js, whose isomorphic half the
// shell loads (index.html) — one definition of "how few mailboxes this
// node may be left with", shared with the hub that has to speak to them.
// If that script did not load there is no helper and no Remove: losing
// the button is a nuisance, losing the last relay is a node that cannot
// claim, send or read anything.
function natterCanRemove(count) {
  var badge = (typeof window !== 'undefined' && window.spiritOwnerBadge) || null;
  return !!(badge && badge.canRemoveMailbox(count));
}

// Removal decided in one place, so the button and the click agree. A
// disabled-looking button that still deletes when clicked is the failure
// this cycle is about.
function natterRemoveAt(relays, index) {
  if (!natterCanRemove(relays.length)) return null;
  if (!(index >= 0 && index < relays.length)) return null;
  return relays.splice(index, 1)[0];
}

// What the badge probe last said about each URL: { owned, report }.
// `report` is the census the mailbox answers an owner with — owner, mode,
// peers, message count — and it arrives with the same signed call that
// decides whether this node owns the row at all (js/ownerBadge.js,
// readBadge). So the panel below costs no endpoint and no second
// authority: it shows what was already fetched to draw the star.
var natterBadgeByUrl = Object.create(null);

// The one expanded row, or null. Same rule as the Jobs table: opening one
// closes any other, because two open panels in a list of mailboxes is a
// page you have to scroll to compare rather than a thing you are looking
// at.
var natterExpandedUrl = null;

// Never the invites: a live token is a spoken secret, and a panel that
// opens on a click is visible to whoever is looking at the screen. The
// rule holds by construction as long as this shows what the probe
// returned and fetches nothing of its own — `report` carries no tokens.
//
// Peers by count, not by key. The census names every peer and carries a
// 48-character key for each; a wall of those is machine detail wearing a
// person's clothes (UI_DESIGN_STYLE.md §6).
function natterReportHtml(api, badge) {
  if (!badge) return '<div class="job-log-empty">asking that mailbox…</div>';
  if (!badge.owned) {
    return '<div class="job-log-empty">' + api.escapeHtml(badge.error || 'not owner') + '</div>';
  }
  var report = badge.report || {};
  var peers = Array.isArray(report.peers) ? report.peers.length : 0;
  function row(label, value) {
    return '<div class="file-info-row">' +
      '<span class="file-info-label">' + api.escapeHtml(label) + '</span>' +
      '<span>' + api.escapeHtml(String(value)) + '</span>' +
      '</div>';
  }
  return row('Owner', report.owner || '(none)') +
    row('Mode', report.mode || '(unknown)') +
    row('Peers', peers) +
    row('Messages', report.messages == null ? '(unknown)' : report.messages);
}

function natterRenderList(container, api, relays) {
  var tbody = container.querySelector('#natter-tbody');
  if (relays.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3">(no relays added yet)</td></tr>';
    return;
  }
  var removable = natterCanRemove(relays.length);
  tbody.innerHTML = relays.map(function (relay, index) {
    var badge = natterBadgeByUrl[relay.url];
    var owned = !!(badge && badge.owned);
    var open = owned && natterExpandedUrl === relay.url;
    // ★ means owned, here and in Relay Chat's To list — one mark, one
    // meaning, wherever a mailbox is named. A row this node does not own
    // has no star and nothing to open.
    //
    // The star only says the row can be opened; the row itself is the
    // control, which gives a phone the whole width of it to aim at. The
    // one thing that must not toggle is Remove, so the click handler
    // answers that first (mount, below) — otherwise a tap meant for a
    // panel would delete a mailbox.
    var star = owned ? '<span class="natter-star">★</span> ' : '';
    var mainRow = '<tr class="job-row' + (owned ? ' natter-openable' : '') + '"' +
      (owned ? ' data-row-url="' + api.escapeHtml(relay.url) + '"' : '') +
      (owned ? ' title="' + (open ? 'Hide' : 'Show') + ' what this mailbox says"' : '') + '>' +
      '<td>' + star + api.escapeHtml(relay.label) + '</td>' +
      '<td>' + api.escapeHtml(relay.url) + '</td>' +
      '<td>' + (removable
        ? '<button type="button" class="cancel-btn" data-remove-index="' + index + '">Remove</button>'
        : '<span class="muted">last relay</span>') +
      '</td>' +
      '</tr>';
    if (!open) return mainRow;
    return mainRow + '<tr class="job-log-row"><td colspan="3"><div class="stat-tile wide">' +
      natterReportHtml(api, badge) +
      '</div></td></tr>';
  }).join('');
}

// One signed status per row, the same call the owner badge makes: the
// mailbox already answers "is this key the owner here?" every time an
// owner asks for a census, so there is no second route and no second
// authority (js/ownerBadge.js). Answers land in natterBadgeByUrl and the
// list repaints — stars appear for what is owned and nothing else moves.
//
// Asked again whenever a panel is opened, because a badge is fetched on
// arrival and a message count from ten minutes ago is worse than one
// that says it is being fetched.
function natterProbe(api, container, relays) {
  var label = (typeof api.nodeLabel === 'function' && api.nodeLabel()) || '';
  if (!label) return Promise.resolve(); // no claim, nothing to sign as, no stars
  return fetch('/api/hub/status?name=' + encodeURIComponent(label))
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var rows = (data && data.rows) || [];
      rows.forEach(function (row) {
        if (row && row.url) natterBadgeByUrl[row.url] = row;
      });
      natterOwnedUrls = (data && data.ownedUrls) || [];
      natterMustPick = !!(data && data.mustPick);
      natterAcquireInvited(rows);
      natterRenderList(container, api, relays);
      natterPaintInvite(api, rows);
    })
    .catch(function () { /* a mailbox that cannot be reached is not one this node owns */ });
}

// ---- Binding this node to a mailbox (packet 3) ----
//
// This is the app a fresh node is shown, and until a claim succeeds it is
// the only one (firstRun in js/client/shell.js). So the copy here is not
// a footnote beside a form — while it shows, it IS the page.
function natterPost(path, body) {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(function (r) {
    return r.text().then(function (t) { return { status: r.status, text: t }; });
  });
}

function natterBindStatus(text) {
  var el = document.getElementById('natter-bind-status');
  if (el) el.textContent = text || '';
}

function natterPaintBind(api, relays) {
  var row = document.getElementById('natter-bind-row');
  var note = document.getElementById('natter-bind-note');
  var fields = document.getElementById('natter-bind-fields');
  if (!row || !note || !fields) return;

  if (natterMyName) {
    // Bound: the claim form is not hidden, it has nothing left to ask.
    row.style.display = 'none';
    note.innerHTML = '';
    return;
  }
  row.style.display = '';
  fields.style.display = relays.length ? '' : 'none';

  // innerHTML for the one bold sentence. Every character is written in
  // this file — nothing from a mailbox, a peer or a file reaches it — so
  // there is nothing to escape. Anything interpolated later must be.
  note.innerHTML = relays.length
    ? 'This node needs a name on a public mailbox before it can do anything else. ' +
      'If you were invited, enter that name and the spoken word, then Claim. If you own the mailbox, ' +
      'Claim the owner name with no token. ' +
      '<strong>If you have no invite yet, ask countinn@gmail.com, he will give you an invite within 24 hours.</strong>'
    : 'This node has no mailbox listed yet. Add one above (for example https://spirit.andyflinn.com), then claim a name on it.';
}

// The mint panel, and only for a mailbox this node owns. Not hidden for a
// friend — not built for them: ownedUrls decides, and a node that owns
// nothing has no invite markup at all to find.
function natterPaintInvite(api, rows) {
  var slot = document.getElementById('natter-invite-slot');
  if (!slot) return;
  if (!natterMyName || !natterOwnedUrls.length) {
    slot.innerHTML = '';
    return;
  }
  var owned = (rows || []).filter(function (row) { return row.owned; });
  slot.innerHTML =
    '<details class="stat-tile wide" id="natter-invite-panel">' +
      '<summary>Invite someone to a relay</summary>' +
      // DICTIONARY.md, "Label (invite)": the public caption the token
      // unlocks. `saint` is the dictionary own example, not a person.
      '<label class="field-label">Public label<input type="text" id="natter-inv-label" placeholder="e.g. saint"></label>' +
      '<label class="field-label">Days<input type="number" id="natter-inv-days" min="1" max="15" value="7"></label>' +
      // The token spoken on the phone. Empty means the relay picks hex;
      // typed, it is signed with the label and the days (cycle A2), so it
      // is the owner's to say and nobody else's to substitute.
      '<label class="field-label">Token<input type="text" id="natter-inv-token" placeholder="(optional, spoken)"></label>' +
      (natterMustPick
        ? '<label class="field-label">Mailbox<select id="natter-inv-pick">' +
            owned.map(function (row) {
              return '<option value="' + api.escapeHtml(row.url) + '">' + api.escapeHtml(row.label) + '</option>';
            }).join('') +
          '</select></label>'
        : '') +
      '<button type="button" class="cancel-btn" id="natter-inv-go">Invite</button>' +
      '<span id="natter-inv-out"></span>' +
    '</details>';

  // Closing the panel ends the call: the minted token stays on screen
  // after a 201, and whoever opens this next is starting a different
  // invitation rather than reading the last one. Attached here rather
  // than delegated, because `toggle` does not bubble.
  var panel = document.getElementById('natter-invite-panel');
  if (panel) {
    panel.addEventListener('toggle', function () {
      if (panel.open) return;
      var label = document.getElementById('natter-inv-label');
      var days = document.getElementById('natter-inv-days');
      var token = document.getElementById('natter-inv-token');
      var out = document.getElementById('natter-inv-out');
      if (label) label.value = '';
      if (token) token.value = '';
      if (days) days.value = '7';
      if (out) out.textContent = '';
    });
  }
}

// A label this node minted an invite for. Not the token — that is the
// secret — just enough to recognise the person when they turn up claimed
// on this owner's own census.
function natterRememberMinted(api, label) {
  var wanted = String(label || '').trim();
  if (!wanted || natterMintedLabels.indexOf(wanted) !== -1) return;
  natterMintedLabels.push(wanted);
  if (natterMintedLabels.length > 50) natterMintedLabels = natterMintedLabels.slice(-50);
  api.fs.saveFile('minted.json', JSON.stringify(natterMintedLabels, null, 2)).catch(function () {});
}

// The smallest owner-side invite acquire that needs no new field on the
// mailbox: the wire still does not say which key consumed a token, but
// the owner census names every peer and its key, and in keys mode only
// the key that redeemed the token can hold that label. Owner-only,
// because a census is — which is exactly the case that needed it.
function natterAcquireInvited(rows) {
  if (!natterMintedLabels.length) return;
  var claimed = {};
  (rows || []).forEach(function (row) {
    var peers = (row && row.report && row.report.peers) || [];
    peers.forEach(function (peer) {
      var label = (peer && (peer.publicLabel || peer.name)) || '';
      if (label && peer.publicKey) claimed[label] = peer.publicKey;
    });
  });
  natterMintedLabels.slice().forEach(function (label) {
    var key = claimed[label];
    if (!key) return;
    natterMintedLabels = natterMintedLabels.filter(function (l) { return l !== label; });
    natterPost('/api/hub/contact', { publicKey: key, via: 'invite' }).catch(function () {});
  });
}

// Claiming is what turns a first-run node into an ordinary one, so the
// file is written here and the shell is TOLD rather than left to notice:
// writing session.json does move the fs-watcher's list, and the snapshot
// would repaint — but only because the file is new, and only while that
// watcher is alive.
function natterBind(api, container, relays, label) {
  natterMyName = label;
  api.fs.saveFile(NATTER_SESSION_FILE, JSON.stringify({
    label: label,
    boundAt: new Date().toISOString(),
  }, null, 2)).then(function () {
    if (typeof api.nodeLabelChanged === 'function') api.nodeLabelChanged();
    natterPaintBind(api, relays);
    natterProbe(api, container, relays);
  }).catch(function (e) {
    natterBindStatus('could not remember this name: ' + e.message);
  });
}

// Symmetrical, and abrupt on purpose: a node the mailbox no longer
// recognises goes back to first run.
function natterUnbind(api, relays) {
  natterMyName = '';
  natterOwnedUrls = [];
  natterPaintInvite(api, []);
  api.fs.deleteFile(NATTER_SESSION_FILE);
  if (typeof api.nodeLabelChanged === 'function') api.nodeLabelChanged();
  natterPaintBind(api, relays);
}

// The stored label is only a question; the mailbox answers it. A signed
// inbox read is the cheapest form of "is this still me" — the relay
// verifies the signature against the peer holding that label, so
// somebody else's name comes back 403 without this node claiming or
// writing anything.
function natterVerifyBinding(api, container, relays) {
  if (!natterMyName) return Promise.resolve();
  var label = natterMyName;
  return fetch('/api/hub/inbox?name=' + encodeURIComponent(label) + '&unknown=silent')
    .then(function (r) {
      if (r.status !== 200) {
        natterUnbind(api, relays);
        natterBindStatus(label + ' does not belong to this node any more (' + r.status + ') — claim again');
      }
    })
    .catch(function () { /* unreachable is not the same as not ours */ });
}

spirit.shell.activateApp({
  mount: function (container, api) {
    var relays = natterLoadRelays(api);
    var statusEl;

    // The shared row (.start-job-form): fields with a button on the end,
    // one gap between everything, wrapping to full-width targets on a
    // narrow screen, and a block of space under it before the list. It
    // used to be a tile of bare labels with no spacing rules at all, so
    // a caption, its input and the next caption ran together.
    // .field-label is the shared caption-over-input pair — see
    // UI_DESIGN_STYLE.md before inventing either of them again.
    container.innerHTML =
      // First, because on a fresh node this is the whole page: a name on
      // a public mailbox is what everything else waits for.
      '<div class="stat-tile wide" id="natter-bind-row">' +
        '<div id="natter-bind-note"></div>' +
        '<div class="start-job-form" id="natter-bind-fields">' +
          '<label class="field-label">Public label<input type="text" id="natter-name" placeholder="the name peers see"></label>' +
          '<label class="field-label">Invite token<input type="text" id="natter-token" placeholder="(only if you were invited)"></label>' +
          '<button type="button" id="natter-claim">Claim</button>' +
        '</div>' +
        '<div class="job-manifest-note" id="natter-bind-status"></div>' +
      '</div>' +
      '<div class="stat-tile wide start-job-form">' +
        // The dictionary's word rather than an example with a person's
        // name in it. This caption is yours, it stays on this node and
        // never goes on the wire — DICTIONARY.md calls that a private
        // caption ("My label"). One word for one thing, in the UI as in
        // the docs.
        '<label class="field-label">Private label<input type="text" id="natter-label" placeholder="only you see this"></label>' +
        '<label class="field-label">URL<input type="text" id="natter-url" placeholder="https://example.com"></label>' +
        '<button type="button" id="natter-add">Add</button>' +
        '<span id="natter-status"></span>' +
      '</div>' +
      '<table class="jobs-table"><thead><tr><th>Label</th><th>URL</th><th></th></tr></thead><tbody id="natter-tbody"></tbody></table>' +
      // Last, and empty until this node owns a mailbox. See
      // natterPaintInvite: a node that owns nothing has no invite markup
      // at all to find.
      '<div id="natter-invite-slot"></div>';

    statusEl = document.getElementById('natter-status');
    // A fresh visit starts fully collapsed, like the Jobs table.
    natterExpandedUrl = null;

    // What this node is called, as the shell reads it — one accessor,
    // one answer, and the same one the window title uses.
    natterMyName = (typeof api.nodeLabel === 'function' && api.nodeLabel()) || '';
    try {
      var mintedRaw = api.fs.loadFile('minted.json');
      natterMintedLabels = mintedRaw ? (JSON.parse(mintedRaw) || []) : [];
    } catch (e) { natterMintedLabels = []; }
    if (natterMyName) document.getElementById('natter-name').value = natterMyName;

    natterPaintBind(api, relays);
    natterRenderList(container, api, relays);
    natterProbe(api, container, relays);
    natterVerifyBinding(api, container, relays);

    document.getElementById('natter-claim').addEventListener('click', function () {
      var name = document.getElementById('natter-name').value.trim();
      var token = document.getElementById('natter-token').value.trim();
      if (!name) { natterBindStatus('a name is required'); return; }
      natterPost('/api/hub/claim', token ? { name: name, invite: token } : { name: name })
        .then(function (r) {
          natterBindStatus(r.status + ' ' + r.text);
          // 201 is a new claim. 409 is only us when the peer already on
          // the mailbox carries OUR key — the node sets `mine` for that.
          // Any other 409 is somebody else's name, and claiming it would
          // fail the signature check on the relay anyway.
          var mine = false;
          try { mine = !!JSON.parse(r.text).mine; } catch (e) { mine = false; }
          if (r.status === 201 || (r.status === 409 && mine)) {
            natterBind(api, container, relays, name);
          }
        });
    });

    // Delegated: the panel is painted and repainted by natterPaintInvite,
    // so nothing may hold a reference to its button.
    document.getElementById('natter-invite-slot').addEventListener('click', function (event) {
      if (!event.target || !event.target.closest) return;
      if (!event.target.closest('#natter-inv-go')) return;
      var out = document.getElementById('natter-inv-out');
      var spoken = document.getElementById('natter-inv-token').value.trim();
      var picker = document.getElementById('natter-inv-pick');
      // Never relays.json[0] by habit: with one owned mailbox the node
      // knows which; with several the human has already said.
      var url = natterOwnedUrls.length === 1 ? natterOwnedUrls[0] : (picker && picker.value);
      var mintedLabel = document.getElementById('natter-inv-label').value.trim();
      natterPost('/api/hub/invite', {
        name: natterMyName,
        label: mintedLabel,
        days: Number(document.getElementById('natter-inv-days').value) || 7,
        token: spoken,
        url: url,
      }).then(function (r) {
        var token = '';
        try { token = JSON.parse(r.text).token || ''; } catch (e) { token = ''; }
        if (r.status === 201 && token) natterRememberMinted(api, mintedLabel);
        // Printed, not copied: it is read off this screen onto a phone.
        // What is shown is what the relay stored — the typed token when
        // it took it, hex when the field was empty — never the field,
        // which would show a token no mailbox has if the mint failed.
        out.textContent = (r.status === 201 && token) ? token + '  ->  ' + url : r.status + ' ' + r.text;
      });
    });

    document.getElementById('natter-add').addEventListener('click', function () {
      var labelInput = document.getElementById('natter-label');
      var urlInput = document.getElementById('natter-url');
      var label = labelInput.value.trim();
      var url = urlInput.value.trim();
      if (!label || !url) {
        statusEl.textContent = 'both a label and a URL are required';
        return;
      }
      relays.push({ label: label, url: url });
      api.fs.saveFile(RELAYS_FILENAME, JSON.stringify(relays, null, 2)).then(function () {
        labelInput.value = '';
        urlInput.value = '';
        statusEl.textContent = 'saved';
        natterRenderList(container, api, relays);
      }).catch(function (err) {
        relays.pop();
        statusEl.textContent = 'save failed: ' + err.message;
      });
    });

    container.querySelector('#natter-tbody').addEventListener('click', function (e) {
      var indexAttr = e.target.getAttribute('data-remove-index');

      // The row opens what its mailbox says — but only where the click
      // was not Remove. Answered in that order deliberately: the
      // destructive control sits inside the openable row, and a tap that
      // could mean either must mean the one that cannot be undone by
      // tapping again.
      if (indexAttr == null) {
        var row = e.target.closest && e.target.closest('[data-row-url]');
        var rowUrl = row && row.getAttribute('data-row-url');
        if (!rowUrl) return;
        // Opening one closes any other.
        natterExpandedUrl = (natterExpandedUrl === rowUrl) ? null : rowUrl;
        natterRenderList(container, api, relays);
        if (natterExpandedUrl) natterProbe(api, container, relays);
        return;
      }
      var index = Number(indexAttr);
      var removed = natterRemoveAt(relays, index);
      // A button that survived a stale render, or was put back by hand,
      // still does not empty the list.
      if (!removed) {
        statusEl.textContent = 'a node keeps at least one relay';
        natterRenderList(container, api, relays);
        return;
      }
      api.fs.saveFile(RELAYS_FILENAME, JSON.stringify(relays, null, 2)).then(function () {
        statusEl.textContent = 'saved';
        natterRenderList(container, api, relays);
      }).catch(function (err) {
        relays.splice(index, 0, removed);
        statusEl.textContent = 'remove failed: ' + err.message;
      });
    });
  },
  render: function () {},
});
