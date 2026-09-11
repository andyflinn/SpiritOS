// One relay from the Natter list, as its own screen.
//
// The second DIALOG, and the same reasoning as the first
// (app/contactsDetails): a dialog is a hidden app a table pushes for one
// row. It shows that row and nothing else, it cannot launch anything,
// and the only way out is back to the table it came from. What it wants
// to happen elsewhere it RETURNS, and the app underneath acts on it.
//
// Why a screen and not the expanding row it replaces — the same three
// reasons Contacts had, and one more that is this app's own:
//
//   - the table keeps its shape. A four-fact strip, an invite form and a
//     paragraph of prose lived inside a colspan="3", so the widest thing
//     on the page sat inside the narrowest;
//   - the table keeps its scroll and its place. Panes are hidden, never
//     destroyed, so the list is where you left it;
//   - one thing on screen, rather than one mailbox's panel with other
//     mailboxes listed above and below it;
//   - THE REPAINT PROBLEM GOES AWAY. The device panel polls every two
//     seconds, and the row expansion lived inside a tbody that
//     natterRenderList rebuilds wholesale — so the poll could not call
//     render without destroying the Invite fields under whoever was
//     typing in them. That constraint shaped a lot of code. Here the
//     panel owns its own container and nothing else repaints it.
//
// A sibling folder, not a child: discovery is flat and stays flat
// (app/<name>/<name>.js). The cost is that api.fs here is scoped to
// app/natterDetails/ — NOT to Natter's folder — so this app writes
// nothing locally. It does not need to: every verb here is a hub call,
// and the one file Natter keeps about minting (minted.json, the labels
// it is watching the census for) belongs to the list. A mint made here
// is RETURNED, and Natter records it.

var ndEscapeHtml = spirit.core.util.escapeHtml;
var ndIcon = spirit.core.const.ICON;
var ndApi = null;

var ndUrl = '';         // which mailbox this screen is
var ndBadge = null;     // what that mailbox last said about itself
var ndLabel = '';       // this node's own name, needed to sign a status ask
var ndMinted = '';      // a label minted while this screen was open
var ndChanged = false;  // has anything happened the list must repaint for?
var ndCanRemove = false; // may this mailbox come off the list at all?
var ndRemoveArmed = false; // Remove has been pressed once

// The door password and whether the window is open. Read from the hub
// when this screen opens, because both can change without this app: the
// window closes on its own across a restart, and a password minted on
// first ask does not exist until something asks.
var ndDevice = {
  password: '', listening: false, loaded: false,
  relayUrls: [], publicKey: '', lastEvent: null,
};
var ndTimer = null;

function ndPost(path, body) {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(function (r) {
    return r.text().then(function (t) { return { status: r.status, text: t }; });
  });
}

function ndBody() { return document.getElementById('nd-body'); }

// ---- what this mailbox says about itself -----------------------------

// Re-asked by URL, never handed over in params.
//
// params carries the URL and nothing else, on purpose. A badge captured
// at launch would sit here going stale while you read it, and the
// message count is the half most likely to move. The URL is the only
// part of a row that cannot change.
function ndLoad() {
  if (!ndLabel) { ndRender(); return Promise.resolve(); }
  return fetch('/api/hub/status?name=' + encodeURIComponent(ndLabel))
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var rows = (data && data.rows) || [];
      ndBadge = rows.filter(function (row) { return row && row.url === ndUrl; })[0] || null;
      ndRender();
    })
    .catch(function () { ndRender(); });
}

function ndReadDevice() {
  return fetch('/api/hub/device')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      ndDevice.password = (d && d.password) || '';
      ndDevice.listening = !!(d && d.listening);
      ndDevice.relayUrls = (d && d.relayUrls) || [];
      ndDevice.publicKey = (d && d.publicKey) || '';
      ndDevice.lastEvent = (d && d.lastEvent) || null;
      ndDevice.loaded = true;
    })
    .catch(function () { /* the panel simply reads as closed */ });
}

// ---- the three blocks ------------------------------------------------

// What that mailbox says about itself, on one line and under no heading
// of its own: the title bar carries the mailbox's name, and repeating it
// inside its own screen would be the app telling you what you just
// clicked.
//
// Four facts, four columns — value at reading size, caption beneath it
// as fine print. Label-and-value stacked in four rows made a list out of
// what is really one reading (UI_DESIGN_STYLE.md).
function ndReportHtml() {
  if (!ndBadge) return '<div class="job-log-empty">asking that relay…</div>';

  // A MEMBER'S VIEW, from the public census rather than the owner-only
  // report. Three facts, not four: Mode and Messages are things the
  // mailbox tells its owner. What a member gets instead is the one fact
  // an owner never needs — the name they wear HERE, which with one
  // browser across several relays is a per-relay answer.
  if (!ndBadge.owned && ndBadge.claimed) {
    var c = ndBadge.census || {};
    return spirit.shell.factRow([
      ['Owner', c.owner || '(unknown)'],
      ['Peers', c.peers == null ? '(unknown)' : c.peers],
      ['You', c.myLabel || '(unknown)'],
    ]);
  }

  if (!ndBadge.owned) {
    return '<div class="job-log-empty">' + ndEscapeHtml(ndBadge.error || 'not owner') + '</div>';
  }
  var report = ndBadge.report || {};
  var peers = Array.isArray(report.peers) ? report.peers.length : 0;
  return spirit.shell.factRow([
    ['Owner', report.owner || '(none)'],
    ['Mode', report.mode || '(unknown)'],
    ['Peers', peers],
    ['Messages', report.messages == null ? '(unknown)' : report.messages],
  ]);
}

// Minting belongs to the mailbox it mints on, so it lives inside that
// mailbox's own screen rather than in a bubble at the foot of the app.
//
// That is what kills the picker: a mint used to have to ask WHICH owned
// mailbox, because the form floated free of all of them. Opened from a
// row, the row is the answer, and a question nobody has to ask cannot be
// answered wrongly.
//
// Only for a mailbox this node owns: one somebody else owns has no mint
// markup at all to find.
function ndMintHtml() {
  if (!ndBadge || !ndBadge.owned) return '';
  return '<div class="stat-tile wide natter-mint">' +
    // The one block on this screen that DOES need a heading: the strip
    // above it is a reading of the mailbox the title already named, but
    // this is a thing to do, and a form with no title is a form you have
    // to work out. ★ is the same mark the row carries for owning it.
    '<div class="panel-heading">' + ndIcon.STAR + ' Invite someone to this relay</div>' +
    // DICTIONARY.md, "Label (invite)": the public caption the token
    // unlocks. `saint` is the dictionary's own example, not a person.
    '<div class="start-job-form card">' +
    '<label class="field-label grow">Public label<input type="text" class="natter-inv-label" placeholder="e.g. saint"></label>' +
    '<label class="field-label">Days<input type="number" class="natter-inv-days" min="1" max="15" value="7"></label>' +
    // The token spoken on the phone. Empty means the relay picks hex;
    // typed, it is signed with the label and the days (cycle A2), so it
    // is the owner's to say and nobody else's to substitute.
    '<label class="field-label grow">Token<input type="text" class="natter-inv-token" placeholder="(optional, spoken)"></label>' +
    '<button type="button" class="cancel-btn natter-inv-go">Invite</button>' +
    '</div>' +
    // Under the row: the minted token is read off this screen onto a
    // phone, and it is long. It is an answer, not a control.
    '<span class="natter-inv-out"></span>' +
    '</div>';
}

function ndDeviceHost() {
  try { return new URL(ndUrl).origin; }
  catch (e) { return String(ndUrl || ''); }
}

// WHERE TO OPEN IT. `/<key>/device` names whose enrolment this is, which
// is what lets a relay hold a slot per identity rather than one for the
// box. Base64url, matching deviceAuth.keyToUrl — the same bytes, `-` and
// `_` for `+` and `/`, padding dropped, because a `/` in a path segment
// is not in the segment at all.
//
// Falls back to the bare `/device` when this node has no key yet, which
// the relay still reads as the owner.
function ndDeviceUrl(host) {
  var key = ndDevice.publicKey;
  if (!key) return host + '/device';
  var seg = String(key).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return host + '/' + seg + '/device';
}

// The control is a glyph, not a word. `Listening off` was ambiguous in
// the way only button labels manage to be — it could be the state or the
// action, and Andy read it as the state ("I never realized I had to
// start listening"). A blue dot beside a red dot cannot be read two ways.
//
// Blue and red specifically, and NOT ICON.START/ICON.STOP: those are
// aliases, and ICON.STOP is the ORANGE circle, which would make the
// bubble's "press the red button" a lie. See design/relay/DEVICE-PANEL.md §5.
function ndDeviceButtonHtml() {
  var on = !!ndDevice.listening;
  return '<button type="button" class="natter-dev-toggle' + (on ? ' beating' : '') + '"' +
    ' data-device-toggle="' + (on ? 'stop' : 'start') + '"' +
    ' title="' + (on ? 'Click to stop listening' : 'Click to start listening') + '">' +
    (on ? ndIcon.RED_CIRCLE : ndIcon.BLUE_CIRCLE) +
    '</button>';
}

// The sentence beside the control says what the control does next, and
// nothing else. What is HAPPENING — who is being asked, what came back —
// belongs in the bubble below, where there is room to say it in prose.
function ndDeviceSay() {
  if (!ndDevice.loaded) return '';
  return ndDevice.listening
    ? 'Now listening, press the red button to stop.'
    : 'Press the blue button to start listening.';
}

// How long a finished pass stays the headline. Long enough that stepping
// away to the other device and back still answers "did it work?", short
// enough that yesterday's success is not reported as news.
var ND_FRESH_MS = 5 * 60 * 1000;

// Four things the bubble can be about, most urgent first. Success
// outranks the standing instructions because the standing instructions
// are what was just completed; trouble outranks them because following
// them again will not help.
function ndDeviceMood() {
  if (!ndDevice.loaded) return 'off';
  var e = ndDevice.lastEvent;
  var fresh = !!(e && e.did && e.atMs && (Date.now() - e.atMs) < ND_FRESH_MS);
  if (fresh && e.did === 'installed') return 'added';
  if (fresh && (e.did === 'refused' || e.did === 'unreachable' || e.did === 'rejected')) {
    return 'trouble';
  }
  return ndDevice.listening ? 'listening' : 'off';
}

// Fine print, and the only line that changes on its own. Seconds rather
// than a clock time, because the only question is whether this is still
// beating — a number that keeps climbing says it is not.
function ndDeviceBeatText() {
  if (!ndDevice.listening) return '';
  var where = ndDevice.relayUrls.length
    ? ndDevice.relayUrls.join(', ')
    : '(no relay answered — nothing is being asked)';
  var e = ndDevice.lastEvent;
  if (!e || !e.did) {
    return 'This node asks ' + where + ' once a minute. No pass has finished yet.';
  }
  var ago = Math.max(0, Math.round((Date.now() - e.atMs) / 1000));
  var what = e.did === 'installed' ? 'a device was added'
    : e.did === 'rejected' ? 'a wrong password was refused'
    : e.did === 'unreachable' ? 'the relay could not be reached'
    : e.did === 'refused' ? 'the relay refused the poll'
    : e.did === 'quiet' ? 'the window is shut'
    : 'nothing was waiting';
  return 'This node asks ' + where + ' once a minute. Last pass ' + ago + 's ago — ' + what + '.';
}

function ndDeviceTroubleText() {
  var did = (ndDevice.lastEvent || {}).did;
  if (did === 'rejected') return 'A wrong password was refused.';
  if (did === 'unreachable') return 'The relay could not be reached.';
  // Not the same as an empty slot, and the difference is the one worth
  // printing: the mailbox answered and would not have us.
  return 'The relay refused the poll.';
}

function ndDeviceTroubleAdvice() {
  var did = (ndDevice.lastEvent || {}).did;
  if (did === 'rejected') {
    return 'Somebody pasted a password this node does not hold. If that was you, press ' +
      'the red button and start again, so a fresh one reaches your clipboard.';
  }
  if (did === 'unreachable') {
    return 'The relay did not answer at all. It is usually restarting; this node keeps ' +
      'asking once a minute and will carry on by itself.';
  }
  return 'The relay answered and would not have this node. The usual cause is a relay ' +
    'running older code than this one.';
}

// Document-toned prose, not form chrome: while this screen is open, this
// paragraph is the page. Each state says the one thing to do next.
function ndDeviceBubbleHtml(host) {
  var target = ndDeviceUrl(host);
  var where = ndEscapeHtml(target);
  // _blank with rel="noopener", not target="_new" — the latter is not a
  // standard keyword, and the new tab must not get a handle on the shell.
  var link = '<a href="' + where + '" target="_blank" rel="noopener">' + where + '</a>';
  var keep = '<div><strong>Be sure to (a) bookmark that site and (b) let the browser\'s ' +
    'password manager memorise the password, so it reaches your other devices of the ' +
    'same browser brand.</strong></div>';
  var beat = '<div class="natter-dev-beat muted">' +
    ndEscapeHtml(ndDeviceBeatText()) + '</div>';

  switch (ndDeviceMood()) {
    // The channel that carries this was already there and unspent: the
    // node learns of an enrolment within a pass and the panel said
    // nothing, so the only way to answer "did it work?" was to switch
    // devices and try.
    case 'added':
      return '<div class="natter-dev-loud">A device was added just now.</div>' +
        '<div>It can read this node\'s inbox through ' + link + ' from here on.</div>' +
        keep + beat;

    case 'trouble':
      return '<div class="natter-dev-loud">' +
          ndEscapeHtml(ndDeviceTroubleText()) + '</div>' +
        '<div>' + ndEscapeHtml(ndDeviceTroubleAdvice()) + '</div>' +
        beat;

    case 'listening':
      return '<div>Navigate to this website on the other device to finish a device ' +
        'connection: ' + link + '</div>' + keep + beat;

    default:
      return '<div>When you start listening by pressing the blue button, a secret ' +
        'password will be copied to your clipboard, which you can paste into the ' +
        'password field at ' + where + ' to finish a device connection.</div>';
  }
}

// Adding one of Andy's own handhelds, from the screen that names the
// mailbox it will be added to — the same reasoning that killed the mint
// picker.
//
// Mailboxes this node HAS, which since B2 is not the same as ones it
// owns. A peer owns no relay and still has a slot of its own there, so
// gating this on the star would keep the feature at the owner for want
// of one word — which is exactly where it sat until B2.
//
// Still not every mailbox: one this node has no claim on cannot take its
// device, and showing the panel there would be chrome nobody can act on
// (AGENT.md — do not show chrome that is not useful in that state).
function ndDeviceHtml() {
  if (!ndBadge || !(ndBadge.owned || ndBadge.claimed)) return '';
  var host = ndDeviceHost();
  // The host is kept on the panel because the two-second repaint has
  // only the container to work from.
  return '<div class="stat-tile wide natter-device" data-device-host="' +
      ndEscapeHtml(host) + '">' +
    // NO STAR, unlike the Invite panel above. ★ means "you own this
    // mailbox" everywhere in this app and in Relay Chat's To list — one
    // mark, one meaning. Invite is genuinely owner-only and keeps it;
    // since B2 this panel is not, and a peer seeing the owned mark on a
    // panel that has nothing to do with owning would be the mark
    // starting to mean two things.
    '<div class="panel-heading">Add one of my own devices</div>' +
    // One control and one sentence about it. The transient word about
    // what the last press did sits on the same line, because it is about
    // the press and not about what to do next.
    '<div class="natter-dev-row">' +
      ndDeviceButtonHtml() +
      '<span class="natter-dev-say">' + ndEscapeHtml(ndDeviceSay()) + '</span>' +
      '<span class="natter-dev-out muted"></span>' +
    '</div>' +
    '<div class="stat-tile nested natter-dev-bubble" data-mood="' + ndDeviceMood() + '">' +
      ndDeviceBubbleHtml(host) +
    '</div>' +
    '</div>';
}

// TAKING A MAILBOX OFF THE LIST, from the screen that is that mailbox —
// the same reasoning that put Invite here. In a row it was a button
// inside the thing it would delete, so every tap that could mean either
// had to be disambiguated before it could be obeyed.
//
// TWO PRESSES, like Block in app/contactsDetails. This is the one
// control here that takes something away, and it sits at the end of a
// screen somebody may have been tabbing down. The second press is not a
// dialog and not a checkbox: it is the same button, saying what it will
// do this time.
//
// `canRemove` comes from the list, not from a count taken here. The rule
// is about the LIST — a node with no mailbox can neither claim, send nor
// read — and a screen that counted rows would be a second place for that
// rule to live.
function ndRemoveHtml() {
  if (!ndCanRemove) {
    return '<div class="stat-tile wide">' +
      '<div class="job-log-empty">This is the last relay on the list, and a node ' +
      'keeps at least one — it could not claim a name, send, or read without it.</div>' +
      '</div>';
  }
  return '<div class="stat-tile wide natter-forget">' +
    '<div class="panel-heading">Take this relay off the list</div>' +
    '<div>' + ndEscapeHtml(ndUrl) + ' stays exactly as it is. This node simply stops ' +
      'listing it — nothing is removed from the relay itself, and your row on it ' +
      '(if you have one) is untouched. Adding it back is the URL and nothing else.</div>' +
    '<button type="button" class="cancel-btn natter-forget-go">' +
      (ndRemoveArmed ? 'Press again to take it off' : 'Take it off this list') +
    '</button>' +
    '</div>';
}

// ---- painting --------------------------------------------------------

function ndRender() {
  var body = ndBody();
  if (!body) return;
  body.innerHTML =
    '<div class="stat-tile wide">' + ndReportHtml() + '</div>' +
    ndMintHtml() +
    ndDeviceHtml() +
    ndRemoveHtml();
}

// Painted into the existing panel, never by re-rendering the screen.
// ndRender rebuilds everything, so a two-second poll that called it would
// destroy the Invite fields under whoever was typing in them — the same
// repaint-kills-the-field trap the row expansion had.
function ndDevicePaint() {
  var body = ndBody();
  var panel = body && body.querySelector('.natter-device');
  if (!panel) return;
  var on = !!ndDevice.listening;

  var btn = panel.querySelector('.natter-dev-toggle');
  if (btn) {
    btn.textContent = on ? ndIcon.RED_CIRCLE : ndIcon.BLUE_CIRCLE;
    btn.title = on ? 'Click to stop listening' : 'Click to start listening';
    btn.setAttribute('data-device-toggle', on ? 'stop' : 'start');
    // Toggled rather than rewritten: replacing the element would restart
    // the animation every two seconds, and a heartbeat that resets on a
    // timer is a stutter.
    btn.classList.toggle('beating', on);
  }

  var say = panel.querySelector('.natter-dev-say');
  if (say) say.textContent = ndDeviceSay();

  var bubble = panel.querySelector('.natter-dev-bubble');
  if (!bubble) return;
  var mood = ndDeviceMood();
  // Rewritten only when the state actually changes. A two-second
  // innerHTML would rebuild the link under whoever was reaching for it.
  if (bubble.getAttribute('data-mood') !== mood) {
    bubble.setAttribute('data-mood', mood);
    bubble.innerHTML = ndDeviceBubbleHtml(panel.getAttribute('data-device-host') || '');
  }
  var beat = bubble.querySelector('.natter-dev-beat');
  if (beat) beat.textContent = ndDeviceBeatText();
}

// While this screen is the app on screen, ask again on the tick's own
// cadence. The window can close without this app touching it — the node
// restarting is enough — and a panel painted once would go on claiming
// it was open for as long as the screen stayed up.
//
// Visibility here is the SHELL's, never the browser's. `api.isVisible()`
// answers "is this app the active one" (shell.js, buildApiFor).
// document.visibilityState would be the wrong question twice over: it
// says nothing about which app is on screen, and it goes false the
// moment somebody opens the relay's /device page in another tab — which
// is the one moment this panel must not go quiet.
//
// It has to be asked, not assumed: panes are hidden and never destroyed,
// so `.natter-device` still answers querySelector long after this screen
// stopped being on screen, and this poll would otherwise run for the
// life of the page.
function ndWatch() {
  ndUnwatch();
  ndTimer = setInterval(function () {
    var body = ndBody();
    if (!body || !body.querySelector('.natter-device') || !ndApi || !ndApi.isVisible()) {
      ndUnwatch();
      return;
    }
    ndReadDevice().then(ndDevicePaint);
  }, 2000);
}

function ndUnwatch() {
  if (ndTimer) {
    clearInterval(ndTimer);
    ndTimer = null;
  }
}

// ---- the two things this screen does ---------------------------------

// One mint, on the mailbox this screen is. `ndUrl` rather than a picker
// or relays.json[0]: the screen is which mailbox, and the hub still
// checks that URL is one this node lists.
function ndMint(button) {
  var panel = button.closest('.natter-mint');
  function field(cls) { return panel.querySelector('.' + cls); }
  var out = field('natter-inv-out');
  var label = field('natter-inv-label').value.trim();
  var days = Number(field('natter-inv-days').value) || 7;
  var spoken = field('natter-inv-token').value.trim();

  ndPost('/api/hub/invite', {
    name: ndLabel,
    label: label,
    days: days,
    token: spoken,
    url: ndUrl,
  }).then(function (r) {
    var token = '';
    try { token = JSON.parse(r.text).token || ''; } catch (e) { token = ''; }
    // RETURNED, NOT RECORDED. minted.json is Natter's file — api.fs here
    // is scoped to this app's own folder — and the label is the only
    // part worth carrying back: it is what Natter watches the census for,
    // so the person can be added as a contact the moment they turn up.
    // Never the token. That is the secret, and it does not leave this
    // screen.
    if (r.status === 201 && token) {
      ndMinted = label;
      ndChanged = true;
      if (ndApi) ndApi.setDialogResult({ changed: true, url: ndUrl, minted: label });
    }
    // Printed, not copied: it is read off this screen onto a phone. What
    // is shown is what the relay stored — the typed token when it took
    // it, hex when the field was empty — never the field, which would
    // show a token no mailbox has if the mint was refused.
    //
    // The class says which of the two it is, so a refusal does not read
    // as a token somebody might try to speak down a phone.
    var ok = r.status === 201 && token;
    out.className = 'natter-inv-out ' + (ok ? 'is-token' : 'is-error');
    out.textContent = ok ? token + '  ->  ' + ndUrl : r.status + ' ' + r.text;
  });
}

// The window, opened or shut, on ONE control. The button repaints from
// what the hub answers rather than from what was pressed: starting the
// timer probes for mailboxes and can come back with none, and a button
// that said "listening" while nothing was polling is the one lie this
// design can tell.
function ndDeviceToggle(button) {
  var out = button.closest('.natter-device').querySelector('.natter-dev-out');
  out.textContent = '';
  if (ndDevice.listening) return ndSetListening(false, out);
  return ndDeviceStart(out);
}

// Starting IS taking the password: one press, one meaning. There used to
// be two buttons and the copy was the one that opened the window, which
// nobody could guess (Andy — "I never realized I had to start listening").
//
// This reverses one thing deliberately, and DEVICE-PANEL.md §2 is where
// the reversal was decided: the old code refused to open the window when
// the clipboard failed, on the grounds that a window waiting for a
// password nobody holds is a lie. Under one control, start is the point.
// So it starts, and says the copy failed — the password is still on the
// node and still reachable, where a door that silently stayed shut was
// the failure this panel exists to prevent.
function ndDeviceStart(out) {
  // The clipboard is the whole transport here — the password goes from
  // this screen into a browser's password manager and syncs to the
  // handheld from there, which is why 128 characters costs nothing.
  var copy = ndDevice.password && navigator.clipboard && navigator.clipboard.writeText
    ? navigator.clipboard.writeText(ndDevice.password)
    : Promise.reject(new Error('no clipboard'));
  return copy.then(function () {
    out.textContent = 'password copied';
  }, function () {
    out.textContent = ndDevice.password
      ? 'could not copy — this browser refused the clipboard'
      : 'no password on this node yet';
  }).then(function () {
    return ndSetListening(true, out);
  });
}

function ndSetListening(want, out) {
  return ndPost('/api/hub/device-listen', { on: want }).then(function (r) {
    var body = {};
    try { body = JSON.parse(r.text); } catch (e) { body = {}; }
    ndDevice.listening = !!body.listening;
    ndDevice.relayUrls = body.relayUrls || [];
    if (want && !ndDevice.listening) {
      // Appended rather than replacing, because what the clipboard did
      // is still the other half of what just happened.
      out.textContent = (out.textContent ? out.textContent + ' — but ' : '') +
        'no relay this node owns answered, so nothing is listening';
    }
    // Painted in place, and the watch restarted so the sentence stays
    // true from here. Re-rendering would fold nothing but would take the
    // Invite fields with it.
    ndDevicePaint();
    if (ndDevice.listening) ndWatch();
    else ndUnwatch();
  });
}

spirit.shell.activateApp({

  // Structure only. Everything about WHICH mailbox belongs in open(),
  // which runs on every call — see below.
  mount: function (container, api) {
    ndApi = api;
    container.innerHTML = '<div id="nd-body" class="stack"></div>';

    // Delegated, because the panels are repainted and a handler bound to
    // a button would go with them.
    ndBody().addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var mintBtn = target.closest('.natter-inv-go');
      if (mintBtn) { ndMint(mintBtn); return; }

      var devBtn = target.closest('[data-device-toggle]');
      if (devBtn) { ndDeviceToggle(devBtn); return; }

      var forget = target.closest('.natter-forget-go');
      if (forget) {
        if (!ndRemoveArmed) { ndRemoveArmed = true; ndRender(); return; }
        ndRemoveArmed = false;
        // ANSWERED, NOT DONE. relays.json belongs to the list, and this
        // app's api.fs is scoped to its own folder. The list performs it
        // under the guard that has always stood there — which is also
        // what makes `canRemove` advice rather than permission.
        ndChanged = true;
        if (ndApi) ndApi.setDialogResult({ changed: true, url: ndUrl, removed: ndUrl });
        ndRender();
      }
    });
  },

  // Every call, mounted or not — the shell guarantees it (switchTo). So
  // this is where the subject arrives, and where everything about the
  // last subject has to be let go of.
  //
  // The shell can promise that open() runs; it cannot know what is stale
  // inside. The device poll is the example: it is keyed to nothing and
  // would happily go on painting one mailbox's panel while another
  // mailbox's screen is up.
  open: function (params) {
    ndUnwatch();
    ndUrl = (params && params.url) || '';
    ndLabel = (params && params.label) || '';
    ndCanRemove = !!(params && params.canRemove);
    ndBadge = null;
    ndMinted = '';
    ndChanged = false;
    // A half-armed Remove must mean two presses about the SAME mailbox.
    // Arming it for one and then opening another has to disarm — the
    // shell can promise open() runs, it cannot know what is stale here.
    ndRemoveArmed = false;
    ndDevice.loaded = false;

    ndRender();
    ndReadDevice().then(function () {
      return ndLoad();
    }).then(function () {
      ndWatch();
    });
  },

  // The only hook the shell gives an app on the way back onto the
  // screen: switchTo calls render on every visit. Idempotent on purpose
  // — it starts the device poll again only if the panel is on screen and
  // nothing is already polling.
  render: function () {
    if (ndTimer) return;
    var body = ndBody();
    if (!body || !body.querySelector('.natter-device')) return;
    ndWatch();
  },

});
