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

// The shell's own marks, so ★ here is the same ★ that means "this node
// owns it" on the row above and in Relay Chat's To list.
var natterIcon = spirit.core.const.ICON;

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

// THE PANEL LEFT THIS FILE. What a mailbox says, inviting somebody to
// it, and attaching a device are one screen now — app/natterDetails —
// pushed for the row it was opened from, the same way Contacts pushes
// app/contactsDetails for a person.
//
// This app keeps the LIST: what is on it, which rows are starred, adding
// and removing, and claiming a name. What went with the panel is every
// piece of state it needed — the expanded URL, the device password, the
// two-second poll and the context it had to be restarted from — none of
// which a table has any business holding.






// How long a finished pass stays the headline. Long enough that stepping
// away to the other device and back still answers "did it work?", short
// enough that yesterday's success is not reported as news.
var NATTER_DEV_FRESH_MS = 5 * 60 * 1000;







// WHAT WE KNOW ABOUT THIS RELAY, in the leftmost column and with no
// heading — there is no word for it, and a heading would only widen a
// column that is one glyph wide.
//
// The same three marks Contacts uses for a peer, and for the same
// reason (design/cleanup/2026-09-11-icon-convention.md). What differs is
// what counts as KNOWING, and Andy settled it:
//
//   "we can verify its existence by connecting to the URL, and if we're
//    bound to it, it supplies us with information. not only that. if
//    we're not bound to it, we know that, too."
//
// Both halves of that are knowledge, so both are answers:
//
//   GREEN  it answered, and this node is on it — it will carry for you
//   RED    we asked and cannot use it: it did not answer, or it
//          answered and this node is not on it
//   WHITE  nobody has asked yet
//
// White used to cover "did not answer" as well, on the grounds that an
// unreachable relay has told us nothing. That was wrong: failing to
// connect IS the answer to "can this carry a message for me", and it is
// no. The distinction white was protecting — down versus not-mine — is
// real but belongs in the tooltip, not in the glyph, because the glyph
// is answering a narrower question than it looked.
//
// So white now means exactly one thing: this has not been asked. That is
// the state of every row for the first moment after a reload, which is
// the one moment a screenful of red would be a lie.
function natterStatusMark(badge) {
  if (!badge) return natterIcon.WHITE_CIRCLE;
  if (badge.owned || badge.claimed) return natterIcon.GREEN_CIRCLE;
  return natterIcon.RED_CIRCLE;
}

// The glyph says usable or not; the words say which kind of not. Three
// reds are three different afternoons — a relay that is down, one that
// never took your claim, and one somebody else runs.
function natterStatusTitle(badge) {
  if (!badge) return 'not asked yet';
  if (!badge.status) return 'no answer — ' + (badge.error || 'this relay could not be reached');
  if (badge.owned) return 'you own this relay';
  if (badge.claimed) return 'this relay carries for you';
  return 'it answered, and you are not on it';
}

function natterRenderList(container, api, relays) {
  var tbody = container.querySelector('#natter-tbody');
  if (relays.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4">(no relays added yet)</td></tr>';
    return;
  }
  tbody.innerHTML = relays.map(function (relay) {
    var badge = natterBadgeByUrl[relay.url];
    var owned = !!(badge && badge.owned);
    // B2: a row this node HAS is openable, whether or not it owns the
    // mailbox. A peer owns nothing and still has a device slot there, so
    // gating the row on the star would hide the only control it has.
    var mine = owned || !!(badge && badge.claimed);
    // ★ MEANS OWNED, AND ONLY THAT — one mark, one meaning, here and in
    // Relay Chat's To list. It has a column of its own now rather than
    // sitting in front of a name: a mark sharing a cell with a label
    // pushed every label in the table a glyph to the right or not,
    // depending on the row. Its own column, and the labels line up down
    // the page whatever anyone is marked.
    //
    // Headerless, like the status column beside it and like the mark
    // column in Contacts. There is no word for it.
    var star = owned ? '<span class="natter-star">' + natterIcon.STAR + '</span>' : '';
    // One row per mailbox, and four cells: what we know, whether it is
    // yours, what you call it, and where it is. Only the Remove button
    // left — a destructive control is worth a moment's thought, and it
    // has one on the mailbox's own screen.
    return '<tr class="job-row' + (mine ? ' natter-openable' : '') + '"' +
      (mine ? ' data-row-url="' + api.escapeHtml(relay.url) + '"' : '') +
      (mine ? ' title="Open this relay"' : '') + '>' +
      '<td title="' + api.escapeHtml(natterStatusTitle(badge)) + '">' +
        natterStatusMark(badge) + '</td>' +
      '<td>' + star + '</td>' +
      '<td>' + api.escapeHtml(relay.label) + '</td>' +
      '<td>' + api.escapeHtml(relay.url) + '</td>' +
      '</tr>';
  }).join('');
}

// A ROW OPENS THE MAILBOX, and that is all a row does now.
//
// callDialog rather than launchApp, because this is a question with an
// answer. The shell hands the dialog its subject on every call and gives
// back what it decided, so the code that opens the screen is the code
// three lines below that acts on it — rather than a hook declared at the
// bottom of the file, far from the click.
//
// The URL alone, plus this node's name so the screen can sign a status
// ask of its own. The dialog re-fetches the badge rather than being
// handed one, because the numbers move while it is open.
//
// What comes back matters for one reason: a mint made over there is a
// label this app has to start watching the census for, and minted.json
// is Natter's file — the dialog's own api.fs is scoped to its folder and
// cannot write it. So the dialog RETURNS the label and this records it,
// which is the dialog contract doing exactly what it is for.
function natterOpenMailbox(api, container, relays, url) {
  // `canRemove` rather than letting the screen work it out: the rule is
  // about the LIST — a node with no mailbox at all can neither claim,
  // send, nor read — and the list is the only thing that knows how long
  // it is. A screen that counted rows would be a second place for that
  // rule to live, and a second place is where it drifts.
  api.callDialog('app/natterDetails', {
    url: url,
    label: natterMyName,
    canRemove: natterCanRemove(relays.length),
  }).then(function (result) {
    if (!result) return;
    if (result.minted) natterRememberMinted(api, result.minted);
    // REMOVAL IS RETURNED, NOT DONE. relays.json is this app's file —
    // the screen's own api.fs is scoped to its folder — so the screen
    // says what it decided and this performs it, under the same guard
    // that has always stood here.
    if (result.removed) {
      natterRemoveUrl(api, container, relays, result.removed);
      return;
    }
    if (result.changed) natterProbe(api, container, relays);
  });
}

// By URL, not by index. An index is a position in a list that repaints,
// and the screen that asked was opened from a row whose position nothing
// promises to keep.
function natterRemoveUrl(api, container, relays, url) {
  var index = -1;
  // Looked up rather than closed over: this function used to live inside
  // mount(), where `statusEl` was a local, and moving it out of that
  // closure left the name resolving to nothing. The element is the same
  // one either way and the id has never moved.
  var statusEl = document.getElementById('natter-status');
  relays.forEach(function (relay, i) { if (relay.url === url) index = i; });
  if (index === -1) return;
  var removed = natterRemoveAt(relays, index);
  // The last mailbox does not come off, whatever a screen decided. The
  // guard lives here because the file lives here.
  function say(text) { if (statusEl) statusEl.textContent = text; }
  if (!removed) {
    say('a node keeps at least one relay');
    natterRenderList(container, api, relays);
    return;
  }
  api.fs.saveFile(RELAYS_FILENAME, JSON.stringify(relays, null, 2)).then(function () {
    say('removed ' + url);
    natterRenderList(container, api, relays);
  }).catch(function (err) {
    relays.splice(index, 0, removed);
    say('remove failed: ' + err.message);
  });
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
      natterAcquireInvited(rows);
      natterRenderList(container, api, relays);
    })
    .catch(function () { /* a mailbox that cannot be reached is not one this node owns */ });
}








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
  var heading = document.getElementById('natter-bind-heading');
  if (!row || !note || !fields) return;

  var addRowBound = document.getElementById('natter-add-row');
  if (natterMyName) {
    // Bound: the claim form is not hidden, it has nothing left to ask —
    // and adding a mailbox becomes available, which is what this app is
    // for once a node has a name.
    row.style.display = 'none';
    note.innerHTML = '';
    if (addRowBound) addRowBound.style.display = '';
    return;
  }
  row.style.display = '';
  fields.style.display = relays.length ? '' : 'none';

  // Adding a mailbox is not the first thing a new node does — claiming a
  // name on the one it ships with is. So the Add row waits until this
  // node is bound.
  //
  // Unless there is nothing listed: then adding one IS the first thing,
  // and hiding the only control that could do it would leave a node
  // whose relays.json is missing with no way forward and no way to say
  // so. Same shape as the escape hatch the shell used to need, now that
  // this app is the one an unbound node is shown.
  var addRow = document.getElementById('natter-add-row');
  if (addRow) addRow.style.display = (natterMyName || !relays.length) ? '' : 'none';

  // The heading names the mailbox, because a claim happens ON one and
  // this form never said which. There is no field for it and there
  // should not be: the hub claims, sends and reads on the FIRST Natter
  // row only (loadRelayUrl, hub.js), so a URL box would be a control
  // whose every other value is silently ignored. When the hub learns to
  // speak to a chosen mailbox, this line is where the choice goes.
  //
  // "a name", not "an invite": the owner of a mailbox claims with no
  // token at all, and the token field already says it is optional.
  if (heading) {
    heading.textContent = relays.length
      ? 'Claim a name on ' + ((relays[0] && (relays[0].label || relays[0].url)) || 'this relay')
      : 'Add a relay below, then claim a name on it';
  }

  // innerHTML for the one bold sentence. Every character is written in
  // this file — nothing from a mailbox, a peer or a file reaches it — so
  // there is nothing to escape. Anything interpolated later must be.
  note.innerHTML = relays.length
    ? 'This node needs a name on a public relay before it can do anything else. ' +
      'If you were invited, enter that name and the spoken word, then Claim. If you own the relay, ' +
      'Claim the owner name with no token. ' +
      '<strong>If you have no invite yet, ask countinn@gmail.com, he will give you an invite within 24 hours.</strong>'
    : 'This node has no relay listed yet. Add one above (for example https://spirit.andyflinn.com), then claim a name on it.';
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
        '<div class="panel-heading" id="natter-bind-heading"></div>' +
        '<div id="natter-bind-note"></div>' +
        '<div class="start-job-form" id="natter-bind-fields">' +
          '<label class="field-label">Public label<input type="text" id="natter-name" placeholder="the name peers see"></label>' +
          '<label class="field-label">Invite token<input type="text" id="natter-token" placeholder="(only if you were invited)"></label>' +
          '<button type="button" id="natter-claim">Claim</button>' +
        '</div>' +
        '<div class="job-manifest-note" id="natter-bind-status"></div>' +
      '</div>' +
      '<div class="stat-tile wide" id="natter-add-row">' +
        '<div class="panel-heading">Add a relay this node can use</div>' +
        '<div class="start-job-form">' +
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
      '</div>' +
      // Two headerless columns, then the one word there IS a word for.
      // The status mark and the owned star have no heading for the same
      // reason the mark column in Contacts has none: naming them would
      // only widen a column that is one glyph wide, and the glyph is
      // what is read.
      '<table class="jobs-table natter-table"><thead><tr><th></th><th></th><th>Label</th><th>URL</th></tr></thead><tbody id="natter-tbody"></tbody></table>' +
      '';

    statusEl = document.getElementById('natter-status');

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

    // ONE THING A ROW DOES. There were three branches here, answered in
    // a careful order because Invite, the device toggle and Remove all
    // sat INSIDE the row that opened — so each had to be caught before
    // it triggered the row. All three are on the mailbox's own screen
    // now, and a row has nothing on it to press but itself.
    container.querySelector('#natter-tbody').addEventListener('click', function (e) {
      var row = e.target.closest && e.target.closest('[data-row-url]');
      var rowUrl = row && row.getAttribute('data-row-url');
      if (!rowUrl) return;
      natterOpenMailbox(api, container, relays, rowUrl);
    });
  },
  // Nothing to do on the way back in. This used to restart the device
  // poll, which is the one thing in this app that ran on a timer; the
  // poll went with the panel, and app/natterDetails restarts its own.
  //
  // Kept rather than dropped because the shell calls render on every
  // visit and on the job tick while this app is active — a list that
  // repainted itself on either would take the Add fields with it.
  render: function () {},
});
