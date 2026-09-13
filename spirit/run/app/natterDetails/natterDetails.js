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
var ndRelayLabel = '';  // what the LIST calls this relay, for the title

// WHICH ONE PANEL IS OPEN. '' means none, and none is how the screen
// arrives.
//
//   Andy: "default state of the folding bubbles = closed, only one bubble
//   open at the same time."
//
// It was the other way round — every panel open, remembering which had
// been folded away — and that is a page you scroll. Closed by default
// makes the screen a LIST OF WHAT IS HERE: five bars, each saying what it
// is and whether it is a warning, and opening one is choosing.
//
// One at a time for the same reason. Two open panels and the bars stop
// being a list; the screen goes back to being scrolled and the choosing
// stops meaning anything.
//
// Reset on open(), because the default is the default: arriving at a
// relay with a panel already open would be this screen deciding what the
// question is before it has been asked.
var ndOpenPanel = '';

// A PANEL, WITH A TITLE BAR THAT FOLDS IT.
//
//   Andy: "All panels in natterDetails must be foldable, and the
//   Titlebar should have the current titles, ICON.LINK 'Add one of my own
//   devices', ICON.WARNING for any of the diagnostics"
//
// The heading was a div and the panel was always open, so a screen with a
// device panel, an invite form and two diagnostics was a page somebody
// had to scroll past to reach the thing they came for.
//
// The mark is part of the title bar rather than decoration: ⚠️ says this
// one is telling you something is wrong, 🔗 says this one is a thing to
// do. A reader scanning folded bars can tell those apart without opening
// either.
//
// `id` is what the fold is remembered under, so it must not change with
// the panel's state — "device" stays "device" whether it is armed,
// loaded or refused.
function ndPanel(id, mark, title, inner, extraClass) {
  var shut = ndOpenPanel !== id;
  return '<div class="stat-tile wide' + (extraClass ? ' ' + extraClass : '') + '">' +
    '<div class="panel-heading nd-fold" data-fold="' + ndEscapeHtml(id) + '"' +
      ' title="' + (shut ? 'Show' : 'Hide') + ' this">' +
      '<span class="nd-fold-mark">' + (shut ? ndIcon.POINTRIGHT : ndIcon.POINTDOWN) + '</span> ' +
      (mark ? mark + ' ' : '') + ndEscapeHtml(title) +
    '</div>' +
    (shut ? '' : '<div class="nd-panel-body">' + inner + '</div>') +
    '</div>';
}

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
// A LAB RELAY IS NOT A PUBLIC ONE, and the difference is the same one
// the wire enforces (hub.assertRelayUrl) and the same one that decides
// whether a relay may come off the list at all: https, or http only to
// loopback. No peer on the internet can reach you at 127.0.0.1.
function ndIsLoopback(url) {
  var target;
  try { target = new URL(String(url || '')); }
  catch (e) { return false; }
  var host = String(target.hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}

// WHY THE CIRCLE IS NOT GREEN, in the shapes it actually comes in.
//
// The glyph answers "usable or not". These are different afternoons with
// different next moves, and until now the only place that distinction
// existed was a tooltip on a row that could not be opened.
//
// RETURNS THE INSIDE OF THE BUBBLE, not a bubble. ndRender already wraps
// this in a stat-tile, and returning another one nested a tile inside a
// tile — which is why the heading did not read as a heading. The other
// branches of ndReportHtml return bare content for the same reason.
function ndWhyNotGreen() {
  // 1. Nothing answered. A URL that is wrong and a box that is down look
  //    identical from here, and saying so is more useful than picking.
  if (!ndBadge.status) {
    return ndPanel('why-red', ndIcon.WARNING, 'This relay did not answer',
      '<div>' + ndEscapeHtml(ndBadge.error || 'no answer') + '</div>' +
      '<div class="muted">Nothing is wrong with your node. A relay that is ' +
        'switched off and an address with a typo in it look the same from here, ' +
        'so this does not guess between them. If the address is right, it will ' +
        'go green by itself when the relay comes back.</div>');
  }

  // 2. It answered, and has no row for you. The only state with an
  //    actual next move, so the next move is the paragraph.
  return ndPanel('why-red', ndIcon.WARNING, 'This relay answered, and you are not on it',
    '<div>It is running and reachable. It simply has no row in your name, ' +
      'so this node cannot send through it or be reached on it.</div>' +
    '<div class="muted">Rows are not self-service: whoever owns this relay ' +
      'mints an invite and gives you the token, and Natter claims a name with ' +
      'it. Until then the relay is listed here and does nothing for you.</div>');
}

// A BUBBLE OF ITS OWN, and it appears whether the relay is green or not.
//
//   Andy: "another bubble that should automatically appear if the URL is
//   local to this machine… a lay person readable explanation"
//
// This started as a sentence inside the red explanation, and that was
// wrong in the case that matters most: a lab relay that is RUNNING shows
// a green circle and a perfectly good report, and is still useless for
// reaching anybody. Green answers "did it reply"; it has never answered
// "can a peer get to me here", and those come apart exactly here.
//
// Plain words on purpose. "Loopback" and "publicly routable" are the
// correct terms and neither of them tells somebody what to do next.
function ndLocalHtml() {
  if (!ndIsLoopback(ndUrl)) return '';
  return ndPanel('local', ndIcon.WARNING, 'Why this relay is not useful',
    '<div>This address points back at the machine you are on. ' +
      'Only programs running on this same computer can reach it — ' +
      'nobody else on the internet can, however well it is working.</div>' +
    '<div class="muted">A relay is the thing your friends\' nodes connect ' +
      'to in order to find yours. One that only this machine can reach has ' +
      'nobody to introduce you to: it is fine for trying things out on your ' +
      'own, and it cannot carry a single message to or from anyone else.' +
      '<br><br>' +
      'It stays in the list and costs you nothing. What it cannot do is be ' +
      'the relay you rely on — for that you want an address other people ' +
      'can reach, which is what the public one in this list is for.</div>');
}

function ndReportHtml() {
  // Not a panel: it is a moment, not a thing to fold. Folding it away
  // would leave a screen that says nothing at all while the answer is on
  // its way.
  if (!ndBadge) {
    return '<div class="stat-tile wide"><div class="job-log-empty">asking that relay…</div></div>';
  }

  // A MEMBER'S VIEW, from the public census rather than the owner-only
  // report. Three facts, not four: Mode and Messages are things the
  // mailbox tells its owner. What a member gets instead is the one fact
  // an owner never needs — the name they wear HERE, which with one
  // browser across several relays is a per-relay answer.
  if (!ndBadge.owned && ndBadge.claimed) {
    var c = ndBadge.census || {};
    return ndPanel('relay', ndIcon.INFO, 'What this relay says', spirit.shell.factRow([
      ['Owner', c.owner || '(unknown)'],
      ['Peers', c.peers == null ? '(unknown)' : c.peers],
      ['You', c.myLabel || '(unknown)'],
    ]));
  }

  // NOT GREEN, AND THIS IS WHERE IT GETS EXPLAINED. The row showed a red
  // circle and a tooltip; a tooltip has room for a state and none for a
  // reason or a way out.
  if (!ndBadge.owned) return ndWhyNotGreen();
  var report = ndBadge.report || {};
  var peers = Array.isArray(report.peers) ? report.peers.length : 0;
  return ndPanel('relay', ndIcon.INFO, 'What this relay says', spirit.shell.factRow([
    ['Owner', report.owner || '(none)'],
    ['Mode', report.mode || '(unknown)'],
    ['Peers', peers],
    ['Messages', report.messages == null ? '(unknown)' : report.messages],
  ]));
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
  // ★ is the same mark the row carries for owning it, and this panel is
  // genuinely owner-only — see the note on the device panel, which is not.
  return ndPanel('invite', ndIcon.STAR, 'Invite someone to this relay',
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
    '<span class="natter-inv-out"></span>', 'natter-mint');
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
  // NO STAR, unlike the Invite panel above. ★ means "you own this relay"
  // everywhere in this app and in Relay Chat's To list — one mark, one
  // meaning. Invite is genuinely owner-only and keeps it; since B2 this
  // panel is not, and a peer seeing the owned mark on a panel that has
  // nothing to do with owning would be the mark starting to mean two
  // things.
  //
  // 🔗 instead, because that is what this panel hands you: a link to open
  // somewhere else. It says "a thing to do" where ⚠️ says "something is
  // wrong", which is what lets a reader tell two folded bars apart.
  return ndPanel('device', ndIcon.LINK, 'Add one of my own devices',
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
    '</div>', 'natter-device');
}
// "Take this relay off the list" stood here until 2026-09-13.
//
//   Andy: "the 'Take this relay off the list' should be gone for now.
//   It's nothing that bites us until there is more than one known
//   satellite in space…."
//
// With one real relay the control is a way to break your own node, and
// with one real relay the explanation it showed instead ("this is the
// last one, a node keeps at least one") is a paragraph answering a
// question nobody asked.
//
// THE RULE IT ENFORCED IS NOT GONE. natterCanRemove and natterRemoveAt in
// natter.js still hold "a node keeps at least one relay", and
// spirit/test/natterLast.js still proves it. What went is the surface —
// so when there is a second satellite, this is a panel to write again and
// not a rule to rediscover.

// ---- painting --------------------------------------------------------

// THE TITLE OF THE WHOLE SCREEN.
//
//   Andy: "The Title of the entire Dialog should say 'Relay Details for
//   <relay label>'"
//
// The shell titles a dialog with the app's NAME, which here is the least
// useful word available — every one of these screens is "Relay Details",
// and the question a person has is which relay. setScreenTitle is the
// door contactsDetails already uses for exactly this, and it refuses a
// write from an app that is not on screen, so a badge arriving late
// cannot retitle whatever somebody went back to.
//
// The label rather than the url: the url is on the row and in the device
// link, and a title bar is one sticky line that a full https address
// eats. Falls back to the url when the list gave no label, because a
// title saying "Relay Details for" and then nothing is worse than a long
// one.
function ndSetTitle() {
  if (!ndApi || typeof ndApi.setScreenTitle !== 'function') return;
  var name = ndRelayLabel || ndUrl || '';
  ndApi.setScreenTitle(name ? 'Relay Details for ' + name : 'Relay Details');
}

function ndRender() {
  var body = ndBody();
  if (!body) return;
  // Every piece brings its own tile now, because every piece is a panel
  // with a title bar that folds it. Wrapping here as well is what put a
  // bubble inside a bubble and stopped the headings reading as headings.
  body.innerHTML =
    ndReportHtml() +
    ndLocalHtml() +
    ndMintHtml() +
    ndDeviceHtml();
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

      // THE FOLD, before anything else. A title bar is a control and the
      // panels below it contain controls of their own — a click inside an
      // open panel must not be read as a click on its bar.
      var bar = target.closest('.nd-fold');
      if (bar) {
        var id = bar.getAttribute('data-fold');
        if (id) {
          // Pressing the open one shuts it, which leaves none open. A bar
          // that could only ever hand over to another bar would be a
          // screen with no way back to the list.
          ndOpenPanel = (ndOpenPanel === id) ? '' : id;
          ndRender();
        }
        return;
      }

      var mintBtn = target.closest('.natter-inv-go');
      if (mintBtn) { ndMint(mintBtn); return; }

      var copyBtn = target.closest('.natter-dev-copy');
      if (copyBtn) { ndDeviceCopy(copyBtn); return; }

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
    // The list's caption for this relay. It is the list's to know — this
    // screen is handed one subject and never reads relays.json.
    ndRelayLabel = (params && params.relayLabel) || '';
    ndBadge = null;
    ndMinted = '';
    ndChanged = false;
    // A half-armed Remove must mean two presses about the SAME mailbox.
    // Arming it for one and then opening another has to disarm — the
    // shell can promise open() runs, it cannot know what is stale here.
    ndDevice.loaded = false;
    ndOpenPanel = '';

    ndSetTitle();
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
