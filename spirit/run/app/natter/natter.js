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
// What that mailbox says about itself, on one line and under no heading
// of its own: the row it opened from is the heading, and repeating the
// mailbox's name inside its own panel would be the app telling you what
// you just clicked.
//
// Four facts, four columns — value at reading size, caption beneath it
// as fine print. Label-and-value stacked in four rows made a list out of
// what is really one reading (UI_DESIGN_STYLE.md).
function natterReportHtml(api, badge) {
  if (!badge) return '<div class="job-log-empty">asking that mailbox…</div>';
  if (!badge.owned) {
    return '<div class="job-log-empty">' + api.escapeHtml(badge.error || 'not owner') + '</div>';
  }
  var report = badge.report || {};
  var peers = Array.isArray(report.peers) ? report.peers.length : 0;
  return spirit.shell.factRow([
      ['Owner', report.owner || '(none)'],
      ['Mode', report.mode || '(unknown)'],
      ['Peers', peers],
      ['Messages', report.messages == null ? '(unknown)' : report.messages],
    ]);
}

// Minting belongs to the mailbox it mints on, so it lives inside that
// mailbox's own panel rather than in a bubble at the foot of the app.
//
// That is what kills the picker: a mint used to have to ask WHICH owned
// mailbox, because the form floated free of all of them. Opened from a
// row, the row is the answer, and a question nobody has to ask cannot be
// answered wrongly. It also means the fields clear on their own — closing
// the row rebuilds the table, and the minted token goes with it, which
// was a rule the old panel had to enforce by hand.
//
// Only for a row this node owns: a mailbox somebody else owns has no
// mint markup at all to find, because natterReportHtml above returns
// before it.
function natterMintHtml(api, badge) {
  if (!badge || !badge.owned) return '';
  return '<div class="stat-tile wide natter-mint">' +
    // The one block in this panel that DOES need a heading: the strip
    // above it is a reading of the mailbox the row already named, but
    // this is a thing to do, and a form with no title is a form you have
    // to work out. ★ is the same mark the row carries for owning it.
    '<div class="panel-heading">' + natterIcon.STAR + ' Invite someone to this relay</div>' +
    // DICTIONARY.md, "Label (invite)": the public caption the token
    // unlocks. `saint` is the dictionary's own example, not a person.
    // The three fields and the one button that spends them, on one line
    // (§3). Label and token take the width; Days is a number and sits at
    // its own. Wraps on a narrow screen rather than squeezing.
    '<div class="start-job-form card">' +
    '<label class="field-label grow">Public label<input type="text" class="natter-inv-label" placeholder="e.g. saint"></label>' +
    '<label class="field-label">Days<input type="number" class="natter-inv-days" min="1" max="15" value="7"></label>' +
    // The token spoken on the phone. Empty means the relay picks hex;
    // typed, it is signed with the label and the days (cycle A2), so it
    // is the owner's to say and nobody else's to substitute.
    '<label class="field-label grow">Token<input type="text" class="natter-inv-token" placeholder="(optional, spoken)"></label>' +
    '<button type="button" class="cancel-btn natter-inv-go" data-mint-url="' + api.escapeHtml(badge.url || '') + '">Invite</button>' +
    '</div>' +
    // Under the row: the minted token is read off this screen onto a
    // phone, and it is long. It is an answer, not a control.
    '<span class="natter-inv-out"></span>' +
    '</div>';
}

// The door password and whether the window is open. Read from the hub
// when a row opens, because both can change without this app: the window
// closes on its own across a restart, and a password minted on first ask
// does not exist until something asks.
var natterDevice = { password: '', listening: false, loaded: false, ownedUrls: [], lastEvent: null };
var natterDeviceTimer = null;

// Adding one of Andy's own handhelds, from the row that names the mailbox
// it will be added to — the same reasoning that killed the mint picker.
// The row is which relay, so the address in the sentence below can be
// that relay's and not a question.
//
// Owner rows only. A mailbox somebody else owns cannot take this node's
// device, and a node that owns nothing gets no markup at all: the panel
// is built inside a branch that has already returned for a row without a
// star (AGENT.md — do not show chrome that is not useful in that state).
function natterDeviceHtml(api, badge) {
  if (!badge || !badge.owned) return '';
  var on = !!natterDevice.listening;
  var host = '';
  try { host = new URL(badge.url).origin; } catch (e) { host = String(badge.url || ''); }
  return '<div class="stat-tile wide natter-device">' +
    '<div class="panel-heading">' + natterIcon.STAR + ' Add one of my own devices</div>' +
    '<div class="start-job-form card">' +
    // Copy, not print. The token above is read off the screen onto a
    // phone by a human; this is 128 characters and goes through the
    // clipboard into a browser's password manager, which is the whole
    // reason it can afford to be that long.
    //
    // And copying is what OPENS the window. There used to be a second
    // button for that, and it was chrome nobody could act on: it meant
    // nothing until the password had been taken, and forgetting it made
    // a correct password on the other device read as `not now` with no
    // way to see why (Andy — "I never realized I had to start listening
    // with the listening button"). Taking the password IS the intent to
    // add a device, so it is the one press, and the only control left is
    // the one that undoes it.
    '<button type="button" class="cancel-btn natter-dev-copy" data-device-copy="1">Copy password</button>' +
    // Present only once there is something to stop. Rendered rather than
    // hidden-by-class so the two states cannot both be pressable.
    '<button type="button" class="cancel-btn natter-dev-listen" data-device-listen="off"' +
      (on ? '' : ' hidden') + '>Listening off</button>' +
    '</div>' +
    // Says the sequence before it happens, so the copy is not a surprise
    // that turns something on.
    '<span class="natter-dev-note muted">Copy the password, then open ' + api.escapeHtml(host) +
    '/device on that device and paste it. Copying opens the window; it stays open until you' +
    ' press Listening off.</span>' +
    // What is actually happening, refreshed in place while the row is
    // open. A button alone said only what was last pressed, which is not
    // the same question as whether anything is still listening.
    '<span class="natter-dev-state muted">' + api.escapeHtml(natterDeviceStateText()) + '</span>' +
    '<span class="natter-dev-out"></span>' +
    '</div>';
}

// One sentence for the whole window: whether it is open, who is being
// asked, and what came back last.
function natterDeviceStateText() {
  if (!natterDevice.loaded) return '';
  if (!natterDevice.listening) {
    return 'Not listening — copy the password to open the window.';
  }
  var where = natterDevice.ownedUrls.length
    ? natterDevice.ownedUrls.join(', ')
    : '(no mailbox answered — nothing is being asked)';
  return 'Listening — asking ' + where + ' every 2s. ' + natterDeviceEventText();
}

function natterDeviceEventText() {
  var e = natterDevice.lastEvent;
  if (!e || !e.did) return 'No pass has finished yet.';
  var ago = Math.max(0, Math.round((Date.now() - e.atMs) / 1000));
  var what = e.did === 'installed' ? 'a device was added'
    : e.did === 'rejected' ? 'a wrong password was refused'
    : e.did === 'unreachable' ? 'the mailbox could not be reached'
    // Not the same as an empty slot, and the difference is the one worth
    // printing: the mailbox answered and would not have us. The usual
    // cause is a relay running older code than this node.
    : e.did === 'refused' ? 'THE MAILBOX REFUSED THE POLL — is it running this version?'
    : e.did === 'quiet' ? 'the window is shut'
    : 'nothing was waiting';
  // Seconds, not a clock time: the only thing worth knowing is whether
  // this is still beating. A number that keeps climbing says it is not.
  return 'Last pass ' + ago + 's ago — ' + what + '.';
}

// Painted into the existing panel, never by re-rendering the table.
// natterRenderList rebuilds the whole tbody, so a two-second poll that
// called it would destroy the Invite fields under whoever was typing in
// them — the same repaint-kills-the-field trap the dialogs hit.
function natterDevicePaint(container) {
  var panel = container.querySelector('.natter-device');
  if (!panel) return;
  // The stop control exists only while there is something to stop. It
  // never becomes a start button: copying is the start.
  var btn = panel.querySelector('.natter-dev-listen');
  if (btn) btn.hidden = !natterDevice.listening;
  var state = panel.querySelector('.natter-dev-state');
  if (state) state.textContent = natterDeviceStateText();
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
    // Two blocks, because they are two thoughts: what this mailbox
    // reports, and the one thing you can do with it. The second takes
    // its own space above (UI_DESIGN_STYLE.md), so a row that offers no
    // mint leaves no gap where one would have been.
    return mainRow + '<tr class="job-log-row"><td colspan="3">' +
      '<div class="stat-tile wide">' + natterReportHtml(api, badge) + '</div>' +
      natterMintHtml(api, badge) +
      natterDeviceHtml(api, badge) +
      '</td></tr>';
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
      natterAcquireInvited(rows);
      natterRenderList(container, api, relays);
    })
    .catch(function () { /* a mailbox that cannot be reached is not one this node owns */ });
}

// ---- Binding this node to a mailbox (packet 3) ----
//
// This is the app a fresh node is shown, and until a claim succeeds it is
// the only one (firstRun in js/client/shell.js). So the copy here is not
// a footnote beside a form — while it shows, it IS the page.
// Asked once per row-open rather than held from mount: the hub mints the
// password on first ask, and `listening` is the live timer, so a cached
// answer would go stale exactly where it matters.
function natterLoadDevice(api, container, relays) {
  return natterReadDevice().then(function () {
    natterRenderList(container, api, relays);
    natterDeviceWatch(container);
  });
}

function natterReadDevice() {
  return fetch('/api/hub/device')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      natterDevice.password = (d && d.password) || '';
      natterDevice.listening = !!(d && d.listening);
      natterDevice.ownedUrls = (d && d.ownedUrls) || [];
      natterDevice.lastEvent = (d && d.lastEvent) || null;
      natterDevice.loaded = true;
    })
    .catch(function () { /* the panel simply reads as closed */ });
}

// While the row is open, ask again on the tick's own cadence. The window
// can close without this app touching it — the node restarting is enough
// — and a panel painted once would go on claiming it was open for as
// long as the row stayed expanded.
function natterDeviceWatch(container) {
  natterDeviceUnwatch();
  natterDeviceTimer = setInterval(function () {
    if (!container.querySelector('.natter-device')) {
      natterDeviceUnwatch();
      return;
    }
    natterReadDevice().then(function () { natterDevicePaint(container); });
  }, 2000);
}

function natterDeviceUnwatch() {
  if (natterDeviceTimer) {
    clearInterval(natterDeviceTimer);
    natterDeviceTimer = null;
  }
}

// The window, opened or shut from the row. The button repaints from what
// the hub answers rather than from what was pressed: starting the timer
// probes for owned mailboxes and can come back with none, and a button
// that said "Listening on" while nothing was polling is the one lie this
// design can tell.
function natterDeviceListen(api, container, relays, button) {
  var out = button.closest('.natter-device').querySelector('.natter-dev-out');
  out.textContent = '';
  return natterDeviceSetListening(api, container, relays, false, out);
}

function natterDeviceSetListening(api, container, relays, want, out) {
  return natterPost('/api/hub/device-listen', { on: want }).then(function (r) {
    var body = {};
    try { body = JSON.parse(r.text); } catch (e) { body = {}; }
    natterDevice.listening = !!body.listening;
    natterDevice.ownedUrls = body.ownedUrls || [];
    if (want && !natterDevice.listening) {
      out.textContent = 'copied, but no mailbox this node owns answered — nothing is listening';
    }
    // Painted in place, and the watch restarted so the sentence stays
    // true from here. Re-rendering the list would fold nothing but would
    // take the Invite fields with it.
    natterDevicePaint(container);
    if (natterDevice.listening) natterDeviceWatch(container);
    else natterDeviceUnwatch();
  });
}

function natterDeviceCopy(api, container, relays, button) {
  var out = button.closest('.natter-device').querySelector('.natter-dev-out');
  if (!natterDevice.password) {
    out.textContent = 'no password yet';
    return;
  }
  // The clipboard is the whole transport here — the password goes from
  // this screen into a browser's password manager and syncs to the
  // handheld from there, which is why 128 characters costs nothing. If
  // the browser refuses, say so rather than appearing to have copied.
  var copy = navigator.clipboard && navigator.clipboard.writeText
    ? navigator.clipboard.writeText(natterDevice.password)
    : Promise.reject(new Error('no clipboard'));
  copy.then(function () {
    out.textContent = 'copied';
    // Only now. A window opened after a copy that failed would claim to
    // be waiting for a password nobody has — the state has to stay true
    // to what actually happened.
    return natterDeviceSetListening(api, container, relays, true, out);
  }).catch(function () {
    out.textContent = 'could not copy — this browser refused the clipboard, so the window stayed shut';
  });
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
      : 'Add a mailbox below, then claim a name on it';
  }

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
// One mint, on the mailbox whose row it was pressed in. `url` comes off
// the button rather than a picker or relays.json[0]: the row is which
// mailbox, and the hub still checks that URL is one this node lists.
function natterMint(api, button) {
  // The panel, not the button's parent. When the fields and the button
  // became a .start-job-form row (§3), the button's parent stopped being
  // the panel and the answer span became a sibling of that row rather
  // than a child of it — so the lookup found nothing, assigning to it
  // threw inside the promise, and a mint that had genuinely succeeded
  // said nothing at all. Asking for the panel is what the code meant
  // both before and after.
  var panel = button.closest('.natter-mint');
  function field(cls) { return panel.querySelector('.' + cls); }
  var out = field('natter-inv-out');
  var label = field('natter-inv-label').value.trim();
  var days = Number(field('natter-inv-days').value) || 7;
  var spoken = field('natter-inv-token').value.trim();
  var url = button.getAttribute('data-mint-url');

  natterPost('/api/hub/invite', {
    name: natterMyName,
    label: label,
    days: days,
    token: spoken,
    url: url,
  }).then(function (r) {
    var token = '';
    try { token = JSON.parse(r.text).token || ''; } catch (e) { token = ''; }
    if (r.status === 201 && token) natterRememberMinted(api, label);
    // Printed, not copied: it is read off this screen onto a phone. What
    // is shown is what the relay stored — the typed token when it took
    // it, hex when the field was empty — never the field, which would
    // show a token no mailbox has if the mint was refused.
    //
    // The class says which of the two it is, so a refusal does not read
    // as a token somebody might try to speak down a phone.
    var ok = r.status === 201 && token;
    out.className = 'natter-inv-out ' + (ok ? 'is-token' : 'is-error');
    out.textContent = ok ? token + '  ->  ' + url : r.status + ' ' + r.text;
  });
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
      '<table class="jobs-table natter-table"><thead><tr><th>Label</th><th>URL</th><th></th></tr></thead><tbody id="natter-tbody"></tbody></table>' +
      '';

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

    container.querySelector('#natter-tbody').addEventListener('click', function (e) {
      // Minting, from inside the row it mints on. Answered before the
      // row toggle below, or pressing Invite would fold the panel it was
      // pressed in.
      var mintBtn = e.target.closest && e.target.closest('[data-mint-url]');
      if (mintBtn) {
        natterMint(api, mintBtn);
        return;
      }

      // Both device controls answered before the row toggle, for the same
      // reason Invite is: pressing one inside the panel must not fold the
      // panel it was pressed in.
      var copyBtn = e.target.closest && e.target.closest('[data-device-copy]');
      if (copyBtn) {
        natterDeviceCopy(api, container, relays, copyBtn);
        return;
      }

      var listenBtn = e.target.closest && e.target.closest('[data-device-listen]');
      if (listenBtn) {
        natterDeviceListen(api, container, relays, listenBtn);
        return;
      }

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
        if (natterExpandedUrl) {
          natterProbe(api, container, relays);
          natterLoadDevice(api, container, relays);
        } else {
          // The panel is gone, so nothing is left to paint into.
          natterDeviceUnwatch();
        }
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
