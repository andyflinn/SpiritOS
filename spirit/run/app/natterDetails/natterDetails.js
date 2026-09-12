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
//   - THE REPAINT PROBLEM GOES AWAY. The row expansion lived inside a
//     tbody that natterRenderList rebuilds wholesale, so anything that
//     repainted took the Invite fields with it, under whoever was typing
//     in them. The device panel polled every two seconds and that
//     constraint shaped a lot of code — the poll is gone now, but the
//     Invite form is still a form inside a list that repaints.
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

// THE PASSWORD AND THE KEY, and there is nothing else left to hold.
//
// It used to keep a window's state too — open or shut, which relays were
// being asked, what the last pass did — and all of that described a poll
// that no longer exists. Andy: "no backstop, no 'listening mode' on the
// personal node. the ability to setup one-device-for-all-peers just IS."
//
// Both are still READ rather than assumed: a password is minted on first
// ask, so it does not exist until something asks, and a node that has not
// claimed anywhere has no key yet.
var ndDevice = { password: '', publicKey: '', loaded: false };

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
      ndDevice.publicKey = (d && d.publicKey) || '';
      ndDevice.loaded = true;
    })
    .catch(function () { /* the panel simply says it could not ask */ });
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

// HOW MUCH OF THE ADDRESS TO SHOW, and it is the one number this panel
// has. Andy asked for the URL to be hidden and its length on the display
// to be controllable, so this is that control: the full address is what
// the link GOES to and what hovering it reveals, and this is only how
// much of it takes up room on the page.
//
// It is long because it carries a key: a host, then 58 characters of
// base64url nobody reads and nobody could check by eye, then `/device`.
// Printing the whole thing made the panel look like an error message.
var ND_LINK_CHARS = 52;

// Middle-elided rather than cut short, because the two ends are the parts
// that mean anything — which relay it is at the front, and `/device` at
// the back. What goes is the key in the middle, which is the part that
// was never readable.
function ndShortUrl(url) {
  var s = String(url || '');
  if (s.length <= ND_LINK_CHARS) return s;
  var keep = ND_LINK_CHARS - 1;
  var head = Math.ceil(keep * 0.7);
  return s.slice(0, head) + '…' + s.slice(s.length - (keep - head));
}

// WHAT TO DO WITH IT, in the order it is done, and it does not change.
//
// This panel used to have four moods and a line that repainted every two
// seconds — whether the window was open, which relays were being asked,
// how long ago the last pass ran and what it did. Every one of those was
// about the poll. There is no poll and there is no window: the relay
// hands the offer to this node on the connection it already holds, and
// the node answers in the same round trip.
//
// So the panel is static, and that is the feature rather than a
// simplification. There is no state here a person can get wrong, nothing
// to arm before walking to the other room, and nothing to watch.
//
// The two reminders are Andy's, and both are about the OTHER device
// rather than this one, which is why they are easy to forget at the
// moment they matter.
function ndDeviceBubbleHtml() {
  return '<div>Open that link on the other device — phone, tablet, a second ' +
      'browser — paste the password into the one field there, and press ' +
      '<strong>Add this device</strong>. It takes about a second.</div>' +
    '<div><strong>While you are there, bookmark that page.</strong> Its address ' +
      'carries your key, and it is not one anybody could retype.</div>' +
    '<div><strong>And let that browser\'s password manager memorise the ' +
      'password</strong> when it offers to, so it reaches your other devices of ' +
      'the same browser brand without passing through anything else.</div>' +
    '<div class="muted">The password does not expire and there is nothing to ' +
      'switch on here — a node with a password can always be enrolled to. Anybody ' +
      'holding it can add a device to this node, so keep it where you keep ' +
      'passwords. Adding a device replaces the one before it.</div>';
}

// Adding one of Andy's own handhelds, from the screen that names the
// relay it will be added through — the same reasoning that killed the
// mint picker.
//
// Relays this node HAS, which since B2 is not the same as ones it owns. A
// peer owns no relay and still holds a row there, so gating this on the
// star would keep the feature at the owner for want of one word — which
// is exactly where it sat until B2.
//
// Still not every relay: one this node has no claim on cannot carry its
// enrolment, and showing the panel there would be chrome nobody can act
// on (AGENT.md — do not show chrome that is not useful in that state).
function ndDeviceHtml() {
  if (!ndBadge || !(ndBadge.owned || ndBadge.claimed)) return '';
  var target = ndDeviceUrl(ndDeviceHost());
  var full = ndEscapeHtml(target);
  return '<div class="stat-tile wide natter-device">' +
    // NO STAR, unlike the Invite panel above. ★ means "you own this
    // relay" everywhere in this app and in Relay Chat's To list — one
    // mark, one meaning. Invite is genuinely owner-only and keeps it;
    // since B2 this panel is not, and a peer seeing the owned mark on a
    // panel that has nothing to do with owning would be the mark starting
    // to mean two things.
    '<div class="panel-heading">Add one of my own devices</div>' +
    '<div class="natter-dev-row">' +
      '<button type="button" class="cancel-btn natter-dev-copy">' +
        ndIcon.KEY + ' Copy password</button>' +
      // _blank with rel="noopener", not target="_new" — the latter is not
      // a standard keyword, and the new tab must not get a handle on the
      // shell. The title carries the address in full: it is a LOCATOR and
      // not a credential (deviceAuth.js), public at /api/relay/who
      // already, so hiding it is about the page not being readable rather
      // than about the address being secret.
      '<a class="natter-dev-link" href="' + full + '" target="_blank"' +
        ' rel="noopener" title="' + full + '">' +
        ndEscapeHtml(ndShortUrl(target)) + '</a>' +
      '<span class="natter-dev-out muted"></span>' +
    '</div>' +
    '<div class="stat-tile nested natter-dev-bubble">' +
      ndDeviceBubbleHtml() +
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

// NOTHING REPAINTS THIS SCREEN ANY MORE except ndRender, and ndRender
// runs only when something was pressed.
//
// There was a two-second poll here, and a paint function careful enough
// not to destroy the Invite fields under whoever was typing in them, and
// a visibility check so it stopped when this screen was not the one on
// screen. All of it existed to keep one sentence true — "listening,
// last pass 12s ago" — about a timer that no longer runs.
//
// The panel below states no fact that can go stale while it is read. That
// is what made all of this deletable.

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

// COPYING THE PASSWORD, and it is now the only thing this panel does.
//
// It used to be half of a control that also opened a window, because
// there were once two buttons and the copy was the one that opened it,
// which nobody could guess (Andy — "I never realized I had to start
// listening"). There is no window to open. One button, one meaning.
//
// The clipboard is the whole transport: the password goes from this
// screen into a browser's password manager on the other device and syncs
// from there, which is why 128 characters costs nothing to use.
function ndDeviceCopy(button) {
  var out = button.closest('.natter-device').querySelector('.natter-dev-out');
  out.textContent = '';
  var copy = ndDevice.password && navigator.clipboard && navigator.clipboard.writeText
    ? navigator.clipboard.writeText(ndDevice.password)
    : Promise.reject(new Error('no clipboard'));
  return copy.then(function () {
    out.textContent = 'password copied';
  }, function () {
    // Said out loud rather than silently doing nothing. A copy button
    // that fails quietly sends somebody to the other device to paste
    // whatever was on the clipboard before.
    out.textContent = ndDevice.password
      ? 'could not copy — this browser refused the clipboard'
      : 'no password on this node yet';
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

      var copyBtn = target.closest('.natter-dev-copy');
      if (copyBtn) { ndDeviceCopy(copyBtn); return; }

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
    // The password first, then the badge — the panel needs both to paint,
    // and ndLoad is the one that calls ndRender when it lands. No `render`
    // hook and nothing to restart on the way back onto the screen: this
    // dialog holds no live fact, which is the whole of what changed here.
    ndReadDevice().then(function () {
      return ndLoad();
    });
  },

});
