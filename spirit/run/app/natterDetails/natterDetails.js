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

// WHAT A LABEL MAY BE, asked before a round trip is spent on it. The
// rule is js/labelRule.js, loaded by index.html, and the relay enforces
// the same one — this only saves the hop and says what is wrong while
// the cursor is still in the box.
//
// If that script did not load there is no rule here and every label is
// let through to the relay, which decides as it always did. Losing a
// courtesy is a nuisance; inventing a second opinion about what a label
// may be would be worse. Same shape as natterCanRemove in Natter.
// ── HOW THIS SCREEN ADDRESSES THE RELAY IT IS ────────────────────────
//
//   Andy: "I'm aiming to close all post-path doors on node"
//
// Every verb here is a peerPost now, and a peerPost is addressed to a
// KEY. `ndUrl` still says which relay this screen is ABOUT; it no longer
// aims anything.
//
// TWO PLACES CARRY IT, and the order matters: `census.relayKey` comes
// from the public census every probe already fetches, so a plain MEMBER
// has it — which `report.key` cannot give, because a report is pushed to
// the owner alone. `rename` is an own-row verb every member holds, so
// reading the owner's copy first would have worked for exactly one
// person and looked fine.
function ndRelayKey() {
  if (!ndBadge) return '';
  return (ndBadge.census && ndBadge.census.relayKey)
    || (ndBadge.report && ndBadge.report.key)
    || '';
}

// Said once, because three verbs need to say it. A relay that has not
// answered a census yet cannot be addressed, and that is a different
// thing from a relay that refused.
function ndNoKey(out, cls) {
  out.className = 'job-manifest-note ' + cls + ' is-error';
  out.textContent = 'this relay has not said what its key is yet';
}

function ndLabelProblem(name) {
  var rule = (typeof window !== 'undefined' && window.spiritLabelRule) || null;
  return rule ? rule.problem(name) : '';
}
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

// ── AND WHETHER THE OWNER GROUP IS OPEN ─────────────────────────────
//
//   Andy: "Managing my relay should be a folded container."
//
// A SECOND VARIABLE, NOT A SECOND ENTRY IN THE FIRST. `ndOpenPanel`
// means "which of the sibling panels is open", and the group is not one
// of its siblings — it CONTAINS some of them. Folding the group away
// must not decide which panel is open inside it, and opening a panel
// inside must not close the group.
//
// That is the whole of the two-level model, and it is two variables
// rather than a tree because there are exactly two levels. A third would
// be the moment to build something general; two is not.
//
// SHUT ON ARRIVAL, like every panel. An owner opening a relay is usually
// looking at what it says, not administering it — and a group that
// arrived open would put five bars back on the screen, which is the
// thing it exists to stop.
var ndOwnerGroupOpen = false;

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

// HAS THE QUESTION COME BACK? Not "was the answer good" — just whether
// this screen is still waiting. It is the difference between a spinner
// and a result, and without it every failure on this screen wore the
// spinner's face. See ndReportHtml.
var ndAsked = false;

// This relay's answer to "add newcomers to my contacts". Handed in by
// Natter, which owns relays.json; absent reads as ON, because an owner
// who wrote an invite already decided they want to reach that person.
var ndAutoAdd = true;

// ONE DOOR, AND THE VERB IS THE ARGUMENT. This took a path until
// 2026-09-15, which was a fair shape while there were five of them and
// is a misleading one now that there is exactly one: a path that is
// always the same string is not information, it is a constant every
// caller had to keep saying correctly.
//
// So the caller names WHAT IT WANTS and nothing about where that lives.
// A verb that moves from hub.js to somewhere else changes nothing here,
// and there is no longer a way to get the address right and the request
// wrong.
function ndPost(verb, body) {
  var payload = { verb: verb };
  if (body) Object.keys(body).forEach(function (k) { payload[k] = body[k]; });
  return fetch('/api/spirit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(function (r) {
    return r.text().then(function (t) { return { status: r.status, text: t }; });
  });
}

// The same call when the answer is JSON and a failure is simply "the
// panel could not ask" — which is most of the reads on this screen.
function ndAsk(verb, body) {
  return ndPost(verb, body).then(function (r) {
    try { return JSON.parse(r.text); } catch (e) { return null; }
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
// ── AN UNBOUND NODE ASKS TOO, AND IT IS THE ONE THAT MUST ────────────
//
// This began `if (!ndLabel) { ndRender(); return; }` and that guard made
// the claim panel unreachable by the only node that needs it: no label,
// so no ask; no ask, so no badge; no badge, so ndClaimHtml returns ''
// and the screen says "asking that relay…" for ever. jazz sat on that
// for an afternoon.
//
// It is the same shape as the bug natterProbe had — Andy: "it was one
// unsigned public GET away from the answer the whole time" — and it has
// the same cause. The badge USED to be a signed status call, so a label
// was needed to sign it. Since R3 the probe is key-based: `name` is
// echoed back and decides nothing (hub.handleStatus says so out loud),
// and a node with no label still has a key.
//
// So: always ask.
function ndLoad() {
  ndAsked = false;
  return ndAsk('relay.status', { name: ndLabel || '' })
    .then(function (data) {
      ndAsked = true;
      var rows = (data && data.rows) || [];
      ndBadge = rows.filter(function (row) { return row && row.url === ndUrl; })[0] || null;
      // WHAT THE RELAY LAST SAID ABOUT ITSELF, pushed rather than asked
      // for (R3). The owner-only report used to ride on the badge row,
      // because the badge WAS a signed status GET and the report was its
      // body. That request is gone; the same report arrives unprompted on
      // the stream this node already holds, and `relay.status` has
      // been handing it over under `relayStatus` all along.
      //
      // Absent rather than empty for a relay that has not spoken, which
      // is the distinction the panel below needs: "said nothing yet" is
      // not "said zero".
      if (ndBadge) {
        var said = (data && data.relayStatus) || {};
        ndBadge.report = said[ndUrl] || null;
      }
      ndRender();
    })
    .catch(function () { ndAsked = true; ndRender(); });
}

function ndReadDevice() {
  //  until 2026-09-15. One door, verb in the body.
  return ndAsk('device.info')
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
  // ── "ASKING" AND "ASKED, AND GOT NOTHING" ARE DIFFERENT ────────────
  //
  // This said "asking that relay…" for both, with no timeout and no
  // error path — every failure looked like a slow network, for ever. It
  // cost two diagnoses in one day: a node running yesterday's code, and
  // an unbound node that never asked at all. Neither was slow.
  //
  // `ndAsked` is the whole fix: a question that has come back and
  // brought no row for this relay is an ANSWER, and says so.
  if (!ndBadge) {
    if (!ndAsked) {
      return '<div class="stat-tile wide"><div class="job-log-empty">asking that relay…</div></div>';
    }
    return '<div class="stat-tile wide"><div class="job-log-empty">' +
      'This node could not get an answer about ' + ndEscapeHtml(ndUrl) + '. ' +
      'It is either unreachable from here, or this node is running older code than it is.' +
      '</div></div>';
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

  // THE OWNER'S VIEW, off the report the relay PUSHED (R3). It used to
  // be the body of a signed status GET this screen made; that request is
  // gone, and the same report now arrives unprompted on the stream the
  // node already holds.
  //
  // A relay that has not spoken yet says so, rather than drawing zeros.
  // "Said nothing" and "said zero" are different facts, and a panel that
  // rendered them alike would be the careless half of the distinction
  // hub.js already takes care to preserve.
  if (!ndBadge.report) {
    return ndPanel('relay', ndIcon.INFO, 'What this relay says',
      '<div class="job-log-empty">this relay has not reported yet</div>');
  }
  var report = ndBadge.report;
  // `peers` is a COUNT here, where the old owner-only report carried the
  // roster itself. The pushed report counts on the relay — see
  // relayStatus.report — because a monitor wants a number and a roster is
  // already public at /api/relay/who.
  //
  // MESSAGES IS GONE, and not merely missing: R8 deleted the ring, so
  // there is no count to show. A relay stores nothing on anyone's behalf,
  // and a row reading "Messages 0" would suggest the question still
  // applies.
  return ndPanel('relay', ndIcon.INFO, 'What this relay says', spirit.shell.factRow([
    ['Owner', report.owner || '(none)'],
    ['Mode', report.mode || '(unknown)'],
    ['Peers', report.peers == null ? '(unknown)' : report.peers],
    ['Connected', report.present == null ? '(unknown)' : report.present],
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
// WHAT THIS RELAY CALLS THIS NODE, changed by this node.
//
//   Andy: "after enrollment the public label of an ID is property of the
//   ID... the relay owner will not be allowed to control the public
//   label of any keyed peer."
//
// SHOWN ON A ROW THIS NODE HOLDS, owned or not, which is the whole
// condition — the label belongs to the key, and owning the box is beside
// the point. A relay this node merely LISTS gets no panel, because there
// is no row to rename.
//
// PER RELAY, and that is why it lives on this screen rather than in
// Natter's bind row. A node on several relays may be called different
// things on each: the label belongs to the key, but WHICH label is a
// fact about one membership, and this screen is one membership.
//
// The field starts empty rather than pre-filled with the current label.
// Pre-filling would make the current name look like a thing being edited
// and a stray keystroke into a rename — and the name it would show is
// already on the row above, under "You".
function ndRenameHtml() {
  if (!ndBadge || !(ndBadge.owned || ndBadge.claimed)) return '';
  var now = ndBadge.claimedLabel || '';
  return ndPanel('rename', ndIcon.INFO, 'Change what this relay calls me',
    '<div class="start-job-form card">' +
    '<label class="field-label grow">New public label' +
      '<input type="text" class="nd-name-new" placeholder="' +
      (now ? 'currently ' + ndEscapeHtml(now) : 'the name peers see') + '"></label>' +
    '<button type="button" class="nd-name-go">Change</button>' +
    '</div>' +
    '<div class="job-manifest-note nd-name-out"></div>',
    'natter-rename');
}

// ── THE MIRROR OF RENAME ─────────────────────────────────────────────
//
//   Andy: "the never-bound-to-any-relay form that shows up if I'm truly
//   not bound yet, it shows up in natter, instead of natterDetails for
//   spirit.andyflinn.com"
//
// Rename shows when this key holds a row here; this shows when it does
// not. One of the two is always on a relay's screen and never both, so
// the screen answers "what is my standing here, and what can I do about
// it" without the list having to know.
//
// It could not live here until hub.handleClaim learned to take a url
// (ownerBadge.chooseUrl, the same switch invite and rename use). A Claim
// button on spirit-3's panel that quietly claimed on the lab row would
// have been worse than no button at all.
//
// NOT OFFERED TO A RELAY THAT DID NOT ANSWER. A claim posted at a relay
// that is down fails at the router with nothing learned, and a form that
// invites that is a form that wastes a person's time. `status` is the
// same "did it answer" test natterCheckBinding uses.
function ndClaimHtml() {
  if (!ndBadge || ndBadge.owned || ndBadge.claimed) return '';
  if (!Number(ndBadge.status)) return '';
  return ndPanel('claim', ndIcon.POINTRIGHT, 'Claim a seat on this relay',
    // ── THE ORDER IS THE ORDER OF THE PHONE CALL ────────────────────
    //
    //   Andy: "the redeem token should start with the same fields
    //   labeled invite name and invite token and the last (optional) my
    //   public label."
    //
    // It was Public label, Invite token, Name on the invite — so the two
    // things somebody was READ OUT sat first and third with an unrelated
    // decision between them, and the box you fill in first was the one
    // nobody told you.
    //
    // WORSE, AND THE REAL FAULT: "Public label" was the caption on the
    // MINT screen too, for the word the owner writes on the invite. The
    // same two words meant two different things at the two ends of one
    // phone call, which is precisely the confusion R1 existed to remove
    // (design/cycles/2026-09-15-labels-are-not-identities.md). The word
    // that travels is "Invite name" on both screens now.
    '<div class="start-job-form card">' +
    '<label class="field-label grow">Invite name' +
      '<input type="text" class="nd-claim-invite" placeholder="(the word the owner read out)"></label>' +
    '<label class="field-label">Invite token' +
      '<input type="text" class="nd-claim-token" placeholder="(the token they sent you)"></label>' +
    // OPTIONAL, AND LAST, because it is the only thing on this form you
    // get to decide. Left empty it becomes the invite name — being
    // called what the person who invited you called you is a sane
    // default, and it is what the old form forced on everybody by having
    // no second box at all.
    '<label class="field-label grow">My public label' +
      '<input type="text" class="nd-claim-name" placeholder="(optional — the name peers see)"></label>' +
    '<button type="button" class="nd-claim-go">Claim</button>' +
    '</div>' +
    // Every character written in this file; nothing from a relay reaches
    // it, so there is nothing to escape here.
    '<div class="job-manifest-note">If you own this relay, claim the owner name with no token.</div>' +
    '<div class="job-manifest-note nd-claim-out"></div>',
    'natter-claim');
}

// ── WHAT IS OUTSTANDING, AND TAKING ONE BACK ─────────────────────────
//
//   Andy: "The relay owner maintains invites through a panel in
//   natterDetail (not implemented yet, and a pre-enrolment label is of
//   great value for that."
//
// THE DATA WAS ALREADY ON THIS SCREEN. Every report the relay pushes
// carries `invites` — label, expiry and who minted it — and nothing has
// ever drawn them. Six were outstanding on spirit-3 while this was being
// written, one of them already expired.
//
// OWNER ONLY, because invites are. A member sees no report at all
// (relayStatus reaches the owner's stream), so this renders off
// `ndBadge.report` and needs no second gate — but `owned` is asserted
// anyway, because a panel that depends on data being absent is a panel
// that appears the day the data arrives for another reason.
//
// WHY THE LABEL IS WORTH SHOWING, which is the whole reason the field
// survived R1: it is what the owner wrote on the invite to remember WHO
// they meant — a phone number, a first name — and it is the only handle
// on a keyless reservation. The token is not here and never will be:
// that is the spoken secret, it left on a phone call, and the relay does
// not report it either.
function ndInvitesHtml() {
  if (!ndBadge || !ndBadge.owned) return '';
  var report = ndBadge.report;
  if (!report) return '';
  var rows = (report.invites || []).slice();

  var body;
  if (!rows.length) {
    body = '<div class="job-log-empty">nothing outstanding — every invite ' +
      'has been claimed, revoked or expired</div>';
  } else {
    // Soonest to expire first: the one about to lapse is the one an owner
    // is deciding about, and an already-lapsed row sorts to the top where
    // it can be cleared.
    rows.sort(function (a, b) {
      return String((a && a.expiresAt) || '').localeCompare(String((b && b.expiresAt) || ''));
    });
    body = '<table class="jobs-table"><thead><tr>' +
      '<th>Name on the invite</th><th>Expires</th><th>Invited by</th><th></th>' +
      '</tr></thead><tbody>' +
      rows.map(function (row) {
        var label = String((row && row.label) || '');
        var lapsed = ndInviteLapsed(row);
        return '<tr class="job-row">' +
          '<td class="label-cell">' + ndEscapeHtml(label) + '</td>' +
          '<td' + (lapsed ? ' title="this one has lapsed and no longer opens anything"' : '') + '>' +
            ndEscapeHtml(ndInviteWhen(row)) + '</td>' +
          '<td class="label-cell">' + ndEscapeHtml(String((row && row.invitedBy) || '')) + '</td>' +
          // Revoke carries the LABEL, not a row index: the list repaints
          // from a report that arrives on its own, so an index would be
          // aimed at whatever had moved into that position.
          '<td><button type="button" class="cancel-btn nd-inv-revoke"' +
            ' data-invite-label="' + ndEscapeHtml(label) + '">Revoke</button></td>' +
          '</tr>';
      }).join('') +
      '</tbody></table>';
  }

  return ndPanel('invites', ndIcon.STAR, 'Invites outstanding on this relay',
    body +
    // Said once, here, rather than implied by a count that does not add
    // up: one label may carry several live invites, so revoking takes
    // every invite under that name.
    '<div class="job-manifest-note">Revoking a name takes back every ' +
    'outstanding invite under it. An invite that has already been claimed ' +
    'is not here — the seat is on the peer list now.</div>' +
    '<div class="job-manifest-note nd-inv-revoke-out"></div>',
    'natter-invites');
}

// EXPIRY IN WORDS, because an ISO timestamp is not a thing anybody reads
// to decide whether to make a phone call. Rounded down deliberately: "in
// 2 days" for anything past two days is the truth an owner acts on, and
// a countdown to the minute would be a number that goes stale on a
// screen that only repaints when something is pressed.
function ndInviteLapsed(row) {
  var at = Date.parse(String((row && row.expiresAt) || ''));
  return !isNaN(at) && at <= Date.now();
}

function ndInviteWhen(row) {
  var at = Date.parse(String((row && row.expiresAt) || ''));
  if (isNaN(at)) return 'unknown';
  var ms = at - Date.now();
  if (ms <= 0) return 'expired';
  var mins = Math.floor(ms / 60000);
  if (mins < 60) return 'in ' + mins + (mins === 1 ? ' minute' : ' minutes');
  var hours = Math.floor(mins / 60);
  if (hours < 48) return 'in ' + hours + (hours === 1 ? ' hour' : ' hours');
  return 'in ' + Math.floor(hours / 24) + ' days';
}

// ── THE OWNER'S HALF OF THIS SCREEN, UNDER ONE HEADING ──────────────
//
//   Andy: "maybe there should be an owner group-bubble labeled Managing
//   my relay."
//
// A member sees three bars here; an owner sees five and counting, and
// the ones that kept arriving were all owner-only. This is the line
// between "what I am on this relay" and "what I run".
//
// A FOLDED CONTAINER, which it was not for about an hour. It shipped as
// a plain heading with the owner bubbles loose beneath it, on the
// argument that folding needed a two-level model and that decision was
// parked. Andy unparked it the moment he saw it:
//
//   Andy: "Managing my relay should be a folded container."
//
// Which is right, and the heading version was solving the wrong half:
// grouping them visually still leaves five bars on the screen. Folding
// them leaves one.
//
// The contents are passed in rather than called here, so this function
// decides only how a group LOOKS and the render order stays in one
// place — the same reason ndPanel takes `inner`.
function ndOwnerGroupHtml(inner) {
  if (!ndBadge || !ndBadge.owned) return '';
  var shut = !ndOwnerGroupOpen;
  return '<div class="stat-tile wide nd-group">' +
    '<div class="panel-heading nd-group-fold"' +
      ' title="' + (shut ? 'Show' : 'Hide') + ' what you can do as owner">' +
      '<span class="nd-fold-mark">' +
        (shut ? ndIcon.POINTRIGHT : ndIcon.POINTDOWN) + '</span> ' +
      ndIcon.STAR + ' Managing my relay' +
    '</div>' +
    (shut ? '' : '<div class="nd-group-body">' + inner + '</div>') +
    '</div>';
}

// ── WHAT HAPPENS WHEN SOMEBODY NEW TAKES A SEAT ─────────────────────
//
//   Andy: "when someone binds to the relay the owner may want to
//   auto-add the new ID to his contacts. he issued an invite, so he must
//   want to be connected with the new addition."
//
// PER RELAY, which corrects my own proposal — I argued for node-wide,
// beside the unknown-senders policy, and Andy was right that they answer
// different questions. unknown-senders is about STRANGERS and is a
// property of this node. This is about people YOU let onto THIS relay,
// and you can own two relays for two purposes.
//
// RETURNED, NOT WRITTEN, like every other decision on this screen:
// relays.json is Natter's file and api.fs here is scoped to this app's
// folder. The screen says what was chosen; Natter records it.
function ndAutoAddHtml() {
  if (!ndBadge || !ndBadge.owned) return '';
  var on = ndAutoAdd !== false;
  return ndPanel('policy', ndIcon.INFO, 'When somebody new joins',
    '<div class="start-job-form card">' +
    '<label class="rc-choice">' +
      '<input type="radio" name="nd-autoadd" value="add"' + (on ? ' checked' : '') + '>' +
      '<span class="rc-choice-title">Add them to my contacts</span>' +
      '<span class="rc-choice-note">You wrote the invite, so you already decided you ' +
        'want to reach them. They get a row the moment they claim it.</span>' +
    '</label>' +
    '<label class="rc-choice">' +
      '<input type="radio" name="nd-autoadd" value="no"' + (on ? '' : ' checked') + '>' +
      '<span class="rc-choice-title">Leave them alone</span>' +
      '<span class="rc-choice-note">They take a seat and nothing else happens. ' +
        'You can add them from the list above whenever you like.</span>' +
    '</label>' +
    '</div>' +
    '<div class="job-manifest-note">This is about this relay only. What this node does ' +
      'about a stranger who simply writes to it is a different question, and Contacts ' +
      'answers it.</div>',
    'natter-policy');
}

// ── WHO IS ENROLLED HERE ────────────────────────────────────────────
//
//   Andy: "Details must have a list bubble that allows the owner to
//   remove enrollments, add one or all to contacts."
//
// The enrolment register, which costs no wire: `report.peers` is already
// in hand from the relay-status the relay pushes its owner.
//
// BY KEY, ROW BY ROW. spirit-3 currently lists two peers called `jazz`
// and two called `rock` — orphans from lab nodes whose identities were
// wiped — and that is the case that proves the point:
//
//   Andy: "any search for enrollment row or peers or anything is really
//   search-key-by-public-label"
//
// A label is a caption two people can wear. Every button below carries
// the KEY, and the tail is shown precisely so a human can tell two rows
// with one name apart.
//
// NO "ADD ALL". It is one press, ten consequences, and all of them on
// YOUR node rather than the relay — the asymmetry that makes an undo
// tedious. The policy above is how you say "all of them", in advance and
// one at a time as they arrive.
// ── WHAT THIS BOX CALLS ITSELF ──────────────────────────────────────
//
//   Andy: "the owner should be able to change the public label of his
//   relay... it lives in the json file on the relay that holds the
//   relay's key: key and label are a pair, in keyed mode."
//
// NOT THE SAME AS THE ROW ABOVE IT. "Change what this relay calls me"
// moves this node's own row and every member has it. This moves the
// BOX's caption, and only the owner may.
//
// Nor is it the caption in your relays.json — that one is yours, local,
// and nobody else ever sees it. This is what the relay publishes about
// itself, so every member's screen can show it.
function ndRelayLabelHtml() {
  if (!ndBadge || !ndBadge.owned) return '';
  var census = ndBadge.census || {};
  var now = census.relayLabel || '';
  return ndPanel('relaylabel', ndIcon.INFO, 'Change what this relay is called',
    '<div class="start-job-form card">' +
    '<label class="field-label grow">Public label of this relay' +
      '<input type="text" class="nd-relay-label"' +
      ' value="' + ndEscapeHtml(now) + '"' +
      ' placeholder="' + (now ? '' : 'this relay has not been named') + '"></label>' +
    '<button type="button" class="cancel-btn nd-relay-label-go">Change</button>' +
    '</div>' +
    '<div class="job-manifest-note">Everybody on this relay sees this. The name in ' +
      'your own list is yours alone and nobody else ever sees it.</div>' +
    '<div class="job-manifest-note nd-relay-label-out"></div>',
    'natter-relaylabel');
}

function ndSetRelayLabel(button) {
  var panel = button.closest('.natter-relaylabel');
  var out = panel.querySelector('.nd-relay-label-out');
  var wanted = panel.querySelector('.nd-relay-label').value.trim();

  function say(text, bad) {
    out.className = 'job-manifest-note nd-relay-label-out ' + (bad ? 'is-error' : 'is-token');
    out.textContent = text;
  }

  // Asked here first, so a space costs no round trip. Same rule object
  // both sides (js/labelRule.js), so the two cannot disagree.
  var badName = ndLabelProblem(wanted);
  if (badName) { say(badName, true); return; }

  var relayKey = ndRelayKey();
  if (!relayKey) { ndNoKey(out, 'nd-relay-label-out'); return; }

  say('asking…');
  ndApi.peerPost('relay', relayKey, { relayLabel: { label: wanted } }).then(function (r) {
    var said = r && r.reply;
    if (r && r.ok && said && said.ok !== false) {
      say('this relay is called ' + (said.label || wanted) + ' now');
      ndChanged = true;
      ndLoad();
      return;
    }
    say((said && said.error) || (r && r.error) || 'refused', true);
  });
}

// A DATE, NOT A DURATION. The invite panel next door says "in 6 days"
// because an expiry is a countdown and what you want is how long you
// have. An enrolment is a fact in the past and what you want is WHEN —
// "3 days ago" and "2 months ago" both sort two rows correctly and
// neither tells you which jazz you were talking to in March.
//
// Local date, no clock: the relay writes ISO in UTC, and an hour of
// timezone slip on a row that is months old is noise.
function ndWhen(iso) {
  if (!iso) return '';
  var at = new Date(iso);
  if (isNaN(at.getTime())) return '';
  return at.toLocaleDateString();
}

function ndPeersHtml() {
  if (!ndBadge || !ndBadge.owned) return '';
  // THE CENSUS, NOT THE REPORT. I reached for `report.peers` first and
  // it is a COUNT — the owner-only report says how many, the public
  // census says who. ownerBadge.censusFacts keeps the rows it was
  // already parsing now; see `roster` there.
  var census = ndBadge.census || {};
  var rows = (census.roster || []).slice();

  var body;
  if (!rows.length) {
    body = '<div class="job-log-empty">nobody is enrolled here yet</div>';
  } else {
    body = '<table class="job-table"><thead><tr>' +
      '<th>Label</th><th>Key</th><th>Enrolled</th><th></th>' +
      '</tr></thead><tbody>' +
      rows.map(function (peer) {
        var key = String((peer && peer.publicKey) || '');
        var label = String((peer && (peer.publicLabel || peer.name)) || '');
        var isOwner = !!(peer && peer.owner);
        return '<tr>' +
          '<td>' + (isOwner ? ndIcon.STAR + ' ' : '') + ndEscapeHtml(label || '(no label)') + '</td>' +
          '<td class="nd-peer-tail">…' + ndEscapeHtml(key.slice(-8)) + '</td>' +
          '<td>' + ndEscapeHtml(ndWhen(peer && peer.claimedAt)) + '</td>' +
          '<td>' +
            // THE OWNER'S OWN ROW TAKES NEITHER BUTTON. Adding yourself
            // is refused by the node anyway, and removing yourself is
            // how a relay loses the only key that can administer it.
            (isOwner ? '<span class="muted">that is you</span>' :
              '<button type="button" class="cancel-btn nd-peer-add" data-peer-key="' +
                ndEscapeHtml(key) + '">Add to contacts</button> ' +
              '<button type="button" class="cancel-btn nd-peer-drop" data-peer-key="' +
                ndEscapeHtml(key) + '">Remove</button>') +
          '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table>';
  }

  return ndPanel('peers', ndIcon.INFO, 'Who is enrolled here (' + rows.length + ')',
    body + '<div class="job-manifest-note nd-peer-out"></div>', 'natter-peers');
}

// RETURNED, NOT WRITTEN. relays.json is Natter's file and this app's
// api.fs is scoped to its own folder, so the screen says what was chosen
// and Natter records it against the relay this screen is.
//
// Repainted from the local value rather than from an answer, which is
// the opposite of how the stranger policy works in Contacts — and the
// difference is real: that one is applied by the NODE and read back from
// it, this one is a line in a file Natter owns and will write.
function ndSetAutoAdd(on) {
  ndAutoAdd = !!on;
  ndChanged = true;
  if (ndApi) ndApi.setDialogResult({ changed: true, url: ndUrl, autoAdd: ndAutoAdd });
  ndRender();
}

// ── ADDING ONE PERSON, BY KEY ───────────────────────────────────────
//
// `peer.acquire` is the same verb Contacts uses to confirm somebody
// found by handle, and it verifies against the relay's census before it
// writes a row — so this cannot add a key the relay does not actually
// carry, however stale this screen's copy of the list is.
function ndPeerAdd(button) {
  var key = button.getAttribute('data-peer-key') || '';
  var panel = button.closest('.natter-peers');
  var out = panel && panel.querySelector('.nd-peer-out');
  if (!key || !out) return;

  out.className = 'job-manifest-note nd-peer-out';
  out.textContent = 'adding…';
  ndPost('peer.acquire', { publicKey: key, via: 'invite' }).then(function (r) {
    var said = null;
    try { said = JSON.parse(r.text); } catch (e) { said = null; }
    if (r.status === 201) {
      out.className = 'job-manifest-note nd-peer-out is-token';
      out.textContent = 'added — ' + ((said && said.publicLabel) || 'they') + ' is in your contacts';
      ndChanged = true;
      return;
    }
    out.className = 'job-manifest-note nd-peer-out is-error';
    out.textContent = (said && said.error) || (r.status + ' ' + r.text);
  });
}

// ── REMOVING AN ENROLMENT, WHICH IS A POST LIKE EVERYTHING ELSE ─────
//
// `removePeer` addressed to the relay's own key. Two presses, because
// this is the one control on this screen that destroys something
// somebody else is relying on — the same arming the device rotate uses.
//
// IT TAKES THEIR INVITES WITH IT (relay.forgetPeer), which the answer
// says out loud: un-inviting somebody while leaving their token working
// would be a lie.
function ndPeerDrop(button) {
  var key = button.getAttribute('data-peer-key') || '';
  var panel = button.closest('.natter-peers');
  var out = panel && panel.querySelector('.nd-peer-out');
  if (!key || !out) return;

  if (button.getAttribute('data-armed') !== 'yes') {
    button.setAttribute('data-armed', 'yes');
    button.textContent = 'Really remove?';
    out.className = 'job-manifest-note nd-peer-out';
    out.textContent = 'this takes their seat and any invite they hold. Press again.';
    return;
  }
  button.removeAttribute('data-armed');
  button.textContent = 'Remove';

  var relayKey = ndRelayKey();
  if (!relayKey) { ndNoKey(out, 'nd-peer-out'); return; }

  out.className = 'job-manifest-note nd-peer-out';
  out.textContent = 'removing…';
  ndApi.peerPost('relay', relayKey, { removePeer: { key: key } }).then(function (r) {
    var said = r && r.reply;
    if (r && r.ok && said && said.ok !== false) {
      out.className = 'job-manifest-note nd-peer-out is-token';
      out.textContent = 'removed' + (said.invitesRevoked
        ? ' — and ' + said.invitesRevoked + ' invite(s) with them' : '');
      ndChanged = true;
      // The relay pushes an owner-event for this, which re-asks anyway.
      // Asked here too, because the press and the repaint should not
      // look like two separate things to the person who made them.
      ndLoad();
      return;
    }
    out.className = 'job-manifest-note nd-peer-out is-error';
    out.textContent = (said && said.error) || (r && r.error) || 'refused';
  });
}

// ── PARTNER RELAYS ──────────────────────────────────────────────────
//
//   Andy: "every relay can promote a peer to 'partner' status in the
//   peer-ledger… a non-owner peer possesses his own relay somewhere. and
//   via owner input, both can establish that fact."
//
// TIER ONE, so this changes nothing about routing. What it does is make
// the relationship a fact in the ledger — see design/relay/PARTNERS.md.
//
// THE OWNER TYPES THE URL, and that is load-bearing rather than lazy: a
// KEY IS NOT AN ADDRESS. Nothing on this wire maps one to the other, and
// nothing should — that is the DNS-shaped question this system has
// avoided. So a human supplies where, and the census supplies the proof.
function ndPartnersHtml() {
  if (!ndBadge || !ndBadge.owned) return '';
  var report = ndBadge.report;
  var rows = (report && report.partners) || [];

  var body;
  if (!rows.length) {
    body = '<div class="job-log-empty">no partners — this relay reaches only its own members</div>';
  } else {
    body = '<table class="job-table"><thead><tr>' +
      '<th>Partner</th><th>Their relay</th><th>Since</th><th></th>' +
      '</tr></thead><tbody>' +
      rows.map(function (p) {
        var key = String(p.key || '');
        return '<tr>' +
          '<td>' + ndEscapeHtml(p.label || '(no label)') +
            ' <span class="nd-peer-tail">…' + ndEscapeHtml(key.slice(-8)) + '</span></td>' +
          '<td>' + ndEscapeHtml(p.url || '') + '</td>' +
          '<td>' + ndEscapeHtml(ndWhen(p.since)) + '</td>' +
          '<td><button type="button" class="cancel-btn nd-partner-drop"' +
            ' data-partner-key="' + ndEscapeHtml(key) + '">Break</button></td>' +
        '</tr>';
      }).join('') +
      '</tbody></table>';
  }

  return ndPanel('partners', ndIcon.LINK, 'Partner relays (' + rows.length + ')',
    body +
    '<div class="start-job-form card">' +
    '<label class="field-label grow">Their relay' +
      '<input type="text" class="nd-partner-url" placeholder="https://their-relay.example"></label>' +
    '<label class="field-label grow">Who owns it' +
      '<input type="text" class="nd-partner-key" placeholder="paste their key, or use the list above"></label>' +
    '<button type="button" class="cancel-btn nd-partner-go">Check and add</button>' +
    '</div>' +
    '<div class="job-manifest-note">A partner is somebody enrolled here who owns a relay ' +
      'of their own. This checks that before adding them — their relay says publicly who ' +
      'owns it, and the key has to be theirs.</div>' +
    '<div class="job-manifest-note nd-partner-out"></div>',
    'natter-partners');
}

// TWO STEPS, AND THE FIRST ONE GRANTS NOTHING. `relay.partnerCheck` is
// read-only: it fetches a PUBLIC census and compares a key. Only if that
// says yes does the second step post an owner verb — so there is exactly
// one path that writes a peer row, and the check is not on it.
function ndPartnerAdd(button) {
  var panel = button.closest('.natter-partners');
  var out = panel.querySelector('.nd-partner-out');
  var url = panel.querySelector('.nd-partner-url').value.trim();
  var key = panel.querySelector('.nd-partner-key').value.trim();

  function say(text, bad) {
    out.className = 'job-manifest-note nd-partner-out ' + (bad ? 'is-error' : 'is-token');
    out.textContent = text;
  }

  if (!url || !key) { say('a partner needs their relay and the key that owns it', true); return; }

  var relayKey = ndRelayKey();
  if (!relayKey) { ndNoKey(out, 'nd-partner-out'); return; }

  say('asking that relay who owns it…');
  ndAsk('relay.partnerCheck', { publicKey: key, url: url }).then(function (said) {
    if (!said || !said.ok) {
      say((said && said.error) || 'could not check that relay', true);
      return;
    }
    // THE PROOF CAME BACK, so now the owner verb. `relayKey` here is
    // THEIR relay's own key, captured from the same census that proved
    // the ownership — pinned now so a later forward hop can verify them
    // signing as themselves.
    say('they own it — adding…');
    ndApi.peerPost('relay', relayKey, {
      partner: { key: key, url: said.url, relayKey: said.relayKey },
    }).then(function (r) {
      var answer = r && r.reply;
      if (r && r.ok && answer && answer.ok !== false) {
        say('partnered with ' + (said.relayLabel || said.url));
        ndChanged = true;
        ndLoad();
        return;
      }
      say((answer && answer.error) || (r && r.error) || 'refused', true);
    });
  });
}

// Two presses, like every other destructive control on this screen.
function ndPartnerDrop(button) {
  var panel = button.closest('.natter-partners');
  var out = panel.querySelector('.nd-partner-out');
  var key = button.getAttribute('data-partner-key') || '';
  if (!key || !out) return;

  if (button.getAttribute('data-armed') !== 'yes') {
    button.setAttribute('data-armed', 'yes');
    button.textContent = 'Really break?';
    out.className = 'job-manifest-note nd-partner-out';
    out.textContent = 'they keep their seat here; only the partnership ends. Press again.';
    return;
  }
  button.removeAttribute('data-armed');
  button.textContent = 'Break';

  var relayKey = ndRelayKey();
  if (!relayKey) { ndNoKey(out, 'nd-partner-out'); return; }

  ndApi.peerPost('relay', relayKey, { unpartner: { key: key } }).then(function (r) {
    var answer = r && r.reply;
    if (r && r.ok && answer && answer.ok !== false) {
      out.className = 'job-manifest-note nd-partner-out is-token';
      out.textContent = 'partnership ended';
      ndChanged = true;
      ndLoad();
      return;
    }
    out.className = 'job-manifest-note nd-partner-out is-error';
    out.textContent = (answer && answer.error) || (r && r.error) || 'refused';
  });
}

function ndMintHtml() {
  if (!ndBadge || !ndBadge.owned) return '';
  // ★ is the same mark the row carries for owning it, and this panel is
  // genuinely owner-only — see the note on the device panel, which is not.
  return ndPanel('invite', ndIcon.STAR, 'Invite someone to this relay',
    // DICTIONARY.md, "Label (invite)": the public caption the token
    // unlocks. `saint` is the dictionary's own example, not a person.
    '<div class="start-job-form card">' +
    // "Invite name", NOT "Public label", and the rename is the point.
    // This box was captioned Public label while the REDEEM screen used
    // those same two words for a different thing — the name the invitee
    // picks for themselves. One phone call, two screens, and the same
    // two words meaning two different things at each end of it.
    //
    // It is the word you read out. It is called that here and there.
    '<label class="field-label grow">Invite name<input type="text" class="natter-inv-label" placeholder="e.g. saint"></label>' +
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
    // ── ROTATE, WHERE THE PASSWORD IS ───────────────────────────────
    //
    //   Andy: "rotate password must be a UI element in the device-fold
    //   in the relay detail"
    //
    // The verb has existed and been reachable since device support
    // landed, with nothing on any screen to press — waiting on named
    // work rather than forgotten. This is the screen that shows the
    // password, so it is the screen that replaces it.
    //
    // ARMED, like Remove and Revoke: rotating invalidates a word that
    // may already be half-typed into a phone across the room. Not
    // destructive of anything permanent — a new one is minted on the
    // next ask — but it breaks something in flight.
    '<div class="natter-dev-row">' +
      '<button type="button" class="cancel-btn natter-dev-rotate">' +
        ndIcon.WARNING + ' New password</button>' +
      '<span class="natter-dev-rotate-out muted"></span>' +
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
// ── WHAT THE BOX CALLS ITSELF WINS, ON THE BOX'S OWN SCREEN ─────────
//
//   Andy: "the Label change doesn't propagate on my UI"
//
// It did not, and nothing was broken: the census carried the new name to
// the browser correctly and NOTHING DREW IT. Every caption on this
// screen came from the caller's relays.json — the reader's private
// shorthand — so publishing a name changed a field nobody displayed.
//
// THE ORDER IS THE OPPOSITE OF A CONTACT'S, and the difference is real.
// whoBook prefers MY label for a person: I chose it to tell two people
// apart, and a peer must not be able to rename themselves on my screen.
// A relay is not a peer I am distinguishing — it is a service, and this
// is ITS screen. What it calls itself is the fact; my list shorthand is
// a convenience that stands in until there is one.
//
// So: published first, local second, url last. Somebody who prefers
// their own word still has it in the list, which is where they wrote it.
function ndRelayName() {
  var census = (ndBadge && ndBadge.census) || {};
  return census.relayLabel || ndRelayLabel || ndUrl || '';
}

function ndSetTitle() {
  if (!ndApi || typeof ndApi.setScreenTitle !== 'function') return;
  var name = ndRelayName();
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
    // Claim and rename are the two halves of one question and only one
    // of them ever renders — see ndClaimHtml.
    ndClaimHtml() +
    ndRenameHtml() +
    // ── THE OWNER'S HALF, INSIDE ONE FOLD ────────────────────────────
    //
    // Minting and what has been minted stay adjacent: the answer to "did
    // that work" is the row that appears in the panel below it.
    //
    // The device panel is NOT in here, and that is the line the group
    // draws. It is about attaching a device to THIS NODE — a member with
    // no relay of their own has one too — so it stays outside, among the
    // things you ARE rather than the things you RUN.
    ndOwnerGroupHtml(
      ndRelayLabelHtml() +
      ndMintHtml() +
      ndInvitesHtml() +
      ndPeersHtml() +
      ndPartnersHtml() +
      ndAutoAddHtml()
    ) +
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
// CHANGING WHAT THIS RELAY CALLS THIS NODE.
//
// A post like any other, and the node signs it — so the relay renames
// whoever signed and there is no key on the wire to name anybody else.
//
// RE-ASKED AFTERWARDS rather than patched locally. The screen shows what
// the relay says, and a rename is exactly the moment where believing our
// own optimistic copy would be wrong: the relay can refuse it — a live
// invite holds that name — and a panel that had already written the new
// label would be showing a name nobody answers to.
function ndRename(button) {
  var panel = button.closest('.natter-rename');
  var out = panel.querySelector('.nd-name-out');
  var wanted = panel.querySelector('.nd-name-new').value.trim();
  // The same courtesy the claim panel does, and the same rule object.
  var badWanted = ndLabelProblem(wanted);
  if (badWanted) {
    out.className = 'job-manifest-note nd-name-out is-error';
    out.textContent = badWanted;
    return;
  }

  // AN OWN-ROW VERB, and the reason ndRelayKey reads the census first:
  // a member renaming itself is sent no report, so the owner's copy of
  // the key would not be there.
  var relayKey = ndRelayKey();
  if (!relayKey) { ndNoKey(out, 'nd-name-out'); return; }

  ndApi.peerPost('relay', relayKey, { rename: { label: wanted } }).then(function (r) {
    var said = r.body;
    var ok = r.ok && said && said.ok;
    out.className = 'job-manifest-note nd-name-out ' + (ok ? 'is-token' : 'is-error');
    out.textContent = ok
      ? (said.unchanged ? 'already ' + said.label
        : said.was + '  ->  ' + said.label)
      : (said && said.error) || r.error || ('HTTP ' + r.status);
    if (!ok) return;
    // THE LIST BEHIND THIS SCREEN SHOWS LABELS, so it has to repaint —
    // and the binding Natter keeps is this node's own name, which may be
    // the thing that just moved.
    ndChanged = true;
    if (ndApi) {
      ndApi.setDialogResult({ changed: true, url: ndUrl, renamed: said.label, hash: r.hash });
    }
    ndLoad();
  });
}

// TAKING A SEAT ON THIS RELAY, and `url: ndUrl` is the whole reason this
// can be here — the screen is which relay, so the claim is aimed rather
// than landing on relays.json[0].
//
// RETURNED, NOT RECORDED, like the rename above and the mint below:
// session.json is Natter's file and api.fs here is scoped to this app's
// own folder. The screen says what the relay agreed to; Natter writes it
// down against this url.
function ndClaim(button) {
  var panel = button.closest('.natter-claim');
  var out = panel.querySelector('.nd-claim-out');
  var name = panel.querySelector('.nd-claim-name').value.trim();
  var token = panel.querySelector('.nd-claim-token').value.trim();
  var onInvite = panel.querySelector('.nd-claim-invite').value.trim();

  function say(text, bad) {
    out.className = 'job-manifest-note nd-claim-out ' + (bad ? 'is-error' : 'is-token');
    out.textContent = text;
  }

  // ASKED HERE FIRST, so a space costs nothing.
  //
  //   Andy: "an input field should validate before taxing the wire...
  //   hops on wire can be saved etc..."
  //
  // The relay still decides — it writes the ledger — but there is no
  // reason to cross an ocean to be told about a character. Same rule
  // object both sides (js/labelRule.js), so the two cannot disagree.
  // THE PUBLIC LABEL IS OPTIONAL AND FALLS BACK TO THE INVITE NAME.
  // Being called what the person who invited you called you is the
  // obvious default, and it is what the form imposed on everybody back
  // when it had one box doing both jobs.
  //
  // The fallback is HERE and not on the relay deliberately: the relay
  // has no business inventing a label for somebody, and a claim it
  // filled in the blanks of would be a claim signed over bytes the
  // claimant never chose.
  var wanted = name || onInvite;
  if (!wanted) {
    say('type the invite name you were given, or a public label of your own', true);
    return;
  }

  var badName = ndLabelProblem(wanted);
  if (badName) { say(badName, true); return; }
  // ASKED FOR HERE rather than discovered as a 400 from the relay. The
  // two arrive together — a token and a word, down one phone call — so a
  // token with no word is a half-copied invite, and saying so before the
  // request saves a round trip nobody learns from.
  if (token && !onInvite) {
    say('an invite needs the name the owner put on it, as well as the token', true);
    return;
  }

  var body = { name: wanted, url: ndUrl };
  if (token) body.invite = token;
  if (onInvite) body.inviteLabel = onInvite;

  ndPost('relay.claim', body).then(function (r) {
    // 201 is a new seat. 409 is only us when the peer already on the
    // relay carries OUR key — the node sets `mine` for exactly that. Any
    // other 409 is somebody else's label, and claiming it would fail the
    // signature check on the relay anyway.
    var said = null;
    try { said = JSON.parse(r.text); } catch (e) { said = null; }
    var mine = !!(said && said.mine);
    var ok = r.status === 201 || (r.status === 409 && mine);
    if (!ok) {
      say((said && said.error) || (r.status + ' ' + r.text), true);
      return;
    }
    say(mine ? 'already yours here, as ' + wanted : 'claimed — this relay calls you ' + wanted);
    ndChanged = true;

    // ── A CLAIM CLOSES THIS SCREEN, AND THAT IS NOT A FLOURISH ───────
    //
    //   Andy: "when jazz (successfully btw) redeemed her invite, the UI
    //   didn't pop to full featured mode."
    //
    // It could not, and the reason is the dialog contract rather than
    // anything to do with claiming. What this screen decides it RETURNS
    // — session.json is Natter's file and api.fs here is scoped to this
    // app's folder — and a returned result is delivered WHEN THE DIALOG
    // EXITS, because that is when callDialog's promise resolves.
    //
    // So jazz claimed, stayed on this screen to read the confirmation,
    // and Natter never heard. No binding recorded, no session.json, no
    // nodeLabelChanged, and a shell still painted for a node with no
    // name — all of it waiting behind a Back press nobody had a reason
    // to make.
    //
    // Claiming is also the one verb here that finishes the screen. Every
    // other one — rename, invite, revoke, rotate — leaves you with more
    // to do on this relay. Taking a seat is the end of the errand, and
    // the thing that comes next is the shell you could not use yet.
    if (ndApi && ndApi.closeDialog) {
      ndApi.closeDialog({ changed: true, url: ndUrl, claimed: wanted });
      return;
    }
    if (ndApi) ndApi.setDialogResult({ changed: true, url: ndUrl, claimed: wanted });
    ndLoad();
  });
}

// TAKING ONE BACK. The label travels, never an index — see the button.
//
// RE-ASKED AFTERWARDS rather than patched locally, for the same reason
// rename is: the relay decides how many rows went, and a panel that had
// already removed the row would be showing a guess. ndLoad re-reads the
// report, and the row leaves because the relay says it has.
function ndRevoke(button) {
  var panel = button.closest('.natter-invites');
  var out = panel.querySelector('.nd-inv-revoke-out');
  var label = button.getAttribute('data-invite-label') || '';
  if (!label) return;

  // Two presses about the SAME name, the way Remove was armed before it.
  // Revoking is not destructive of anything a person cannot redo — the
  // owner can mint again — but it breaks a phone call that has already
  // happened, so it is worth a second of thought.
  if (button.getAttribute('data-armed') !== label) {
    button.setAttribute('data-armed', label);
    button.textContent = 'Revoke ' + label + '?';
    return;
  }

  // ── THE FIRST VERB THROUGH THE LOOPBACK CLIENT LAYER ───────────────
  //
  //   Andy: "all of natter really can and must go through the shell ->
  //   clientLayer -> node -> relay"
  //   Andy: "I'm aiming to close all post-path doors on node"
  //
  // This said `ndPost('/api/hub/revoke', …)` and that door existed for
  // one day. What it did was build `{revoke:{label}}` and hand it to
  // router.post — which is what a peerPost IS, so the door was a second
  // way of saying a thing the protocol already said.
  //
  // ADDRESSED BY KEY, NOT BY URL. `ndUrl` still says which relay this
  // SCREEN is, but it no longer aims the verb: the post goes to the
  // relay's own public key and the node picks the road (presence.
  // relaysNaming). That is why the relay had to start naming itself in
  // every member's roster — see relay.streamRoster.
  var relayKey = (ndBadge && ndBadge.report && ndBadge.report.key) || '';
  if (!relayKey) {
    out.className = 'job-manifest-note nd-inv-revoke-out is-error';
    out.textContent = 'this relay has not said what its key is yet';
    button.removeAttribute('data-armed');
    button.textContent = 'Revoke';
    return;
  }

  button.disabled = true;
  ndApi.peerPost('relay', relayKey, { revoke: { label: label } }).then(function (r) {
    // THE ANSWER IS A BODY, decoded by the layer from the envelope the
    // relay replied in. No JSON.parse here, and no second opinion about
    // what an empty envelope means.
    var said = r.body;
    var ok = r.ok && said && said.ok;
    out.className = 'job-manifest-note nd-inv-revoke-out ' + (ok ? 'is-token' : 'is-error');
    if (!ok) {
      out.textContent = (said && said.error) || r.error || ('HTTP ' + r.status);
      button.disabled = false;
      button.removeAttribute('data-armed');
      button.textContent = 'Revoke';
      return;
    }
    // ZERO IS NOT A FAILURE. It means the expiry swept them first, which
    // is the ordinary way an invite ends — and saying "revoked 0" plainly
    // beats a success message that implies something was taken back.
    var n = Number(said.revoked) || 0;
    out.textContent = n
      ? 'revoked ' + n + (n === 1 ? ' invite for ' : ' invites for ') + label
      : 'nothing outstanding for ' + label + ' — it had already lapsed or been claimed';
    ndChanged = true;
    // The hash rides back because this was a post. Returned with the
    // result so the list — and a log reader one day — can name the
    // transaction this press was (decision 0011).
    if (ndApi) {
      ndApi.setDialogResult({ changed: true, url: ndUrl, revoked: label, hash: r.hash });
    }
    ndLoad();
  });
}

function ndMint(button) {
  var panel = button.closest('.natter-mint');
  function field(cls) { return panel.querySelector('.' + cls); }
  var out = field('natter-inv-out');
  var label = field('natter-inv-label').value.trim();
  var days = Number(field('natter-inv-days').value) || 7;
  var spoken = field('natter-inv-token').value.trim();

  var relayKey = ndRelayKey();
  if (!relayKey) { ndNoKey(out, 'natter-inv-out'); return; }

  // `name: ndLabel` TRAVELLED HERE and never mattered: the relay reads
  // the owner's name out of allow.json, because the only sender who
  // reaches that line IS the owner and a name the caller supplied would
  // be a second opinion about that. The door carried it anyway. `url`
  // went too — the post is addressed to the relay's key.
  ndApi.peerPost('relay', relayKey, {
    invite: { label: label, days: days, token: spoken },
  }).then(function (r) {
    var said = r.body;
    var token = (said && said.invite && said.invite.token) || '';
    // RETURNED, NOT RECORDED. minted.json is Natter's file — api.fs here
    // is scoped to this app's own folder — and the label is the only
    // part worth carrying back: it is what Natter watches the census for,
    // so the person can be added as a contact the moment they turn up.
    // Never the token. That is the secret, and it does not leave this
    // screen.
    if (token) {
      ndMinted = label;
      ndChanged = true;
      if (ndApi) {
        ndApi.setDialogResult({ changed: true, url: ndUrl, minted: label, hash: r.hash });
      }
    }
    // Printed, not copied: it is read off this screen onto a phone. What
    // is shown is what the relay stored — the typed token when it took
    // it, hex when the field was empty — never the field, which would
    // show a token no mailbox has if the mint was refused.
    //
    // The class says which of the two it is, so a refusal does not read
    // as a token somebody might try to speak down a phone.
    var ok = !!token;
    out.className = 'natter-inv-out ' + (ok ? 'is-token' : 'is-error');
    out.textContent = ok
      ? token + '  ->  ' + ndUrl
      : (said && said.error) || r.error || ('HTTP ' + r.status);
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
// A NEW WORD FOR THE PHONE. `device.rotate` — local, so it cannot fail
// for being offline, which is why nothing here handles unreachability.
//
// Two presses about the same button, the way Revoke and Remove are: the
// old password stops working the instant this lands, and somebody may be
// halfway through typing it on another device.
function ndDeviceRotate(button) {
  var panel = button.closest('.natter-device');
  var out = panel.querySelector('.natter-dev-rotate-out');

  if (button.getAttribute('data-armed') !== 'yes') {
    button.setAttribute('data-armed', 'yes');
    button.textContent = 'Replace the password?';
    out.textContent = 'the word now on this screen stops working';
    return Promise.resolve();
  }

  button.disabled = true;
  return ndPost('device.rotate').then(function (r) {
    button.disabled = false;
    button.removeAttribute('data-armed');
    button.textContent = ndIcon.WARNING + ' New password';
    if (r.status < 200 || r.status >= 300) {
      out.textContent = 'could not replace it: ' + r.status + ' ' + r.text;
      return;
    }
    // RE-ASKED, not patched from the answer. The screen shows what the
    // node says, and device.info is what says it — the same rule the
    // rename panel follows.
    out.textContent = 'replaced — the new word is above';
    return ndReadDevice().then(function () { ndRender(); });
  });
}

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

    // ── THE RELAY SAYS WHEN, RATHER THAN THIS SCREEN ASKING AGAIN ────
    //
    //   Andy: "during any of those transactions, there is no live
    //   update. once the invite is successfully issued, that invite
    //   should be immediately visible in outstanding invites."
    //
    // Once per pane, in mount rather than open, because the subscription
    // outlives any one relay being looked at and there is nothing to
    // tear down when the screen is left — a dialog is hidden, never
    // destroyed, and subscribing in open() would stack a listener per
    // visit.
    //
    // FILTERED TO THIS RELAY, by the key it publishes. Andy may own more
    // than one, and a mint on the other one must not repaint this
    // screen's list with rows that are not its own. An event with no
    // relay named is taken — older relays did not say, and a missed
    // repaint is worse than a redundant one.
    //
    // ndLoad(), not a local patch of the list: the event says something
    // changed, and the screen already knows how to ask what is true. A
    // handler that spliced the new invite in by hand would be a second
    // opinion about the relay's ledger, which is the relay's to hold.
    //
    // WHICH MAKES THE ORDER WORTH KNOWING. The invites are not in this
    // event — they ride a SECOND message, `relay-status`, which
    // relay.ownerEvent sends immediately after this one (statusToOwner,
    // at the foot of it) and which stops at the node in
    // presenceNode.statusByRelay. ndLoad reads it back through
    // relay.status.
    //
    // So the two are ordered frames on one already-open socket, and this
    // screen's reaction to the first has to cross an SSE delivery, an
    // HTTP request, and a census fetch before it reads the second. The
    // status has effectively always landed by then. It is not a formal
    // guarantee, and it is the thing to suspect if an invite ever shows
    // up exactly one beat late.
    if (api.onRelayEvent) {
      api.onRelayEvent(function (event) {
        var about = (event && event.relay) || '';
        if (about && ndUrl && about !== ndUrl) return;
        if (!ndUrl) return;
        ndLoad();
      });
    }

    // Delegated, because the panels are repainted and a handler bound to
    // a button would go with them.
    ndBody().addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      // THE FOLD, before anything else. A title bar is a control and the
      // panels below it contain controls of their own — a click inside an
      // open panel must not be read as a click on its bar.
      // THE GROUP BAR FIRST, and it must be tested before `.nd-fold`
      // below — the panels inside it carry that class, and a click on
      // one of them is a click inside the group, not on it. Its own bar
      // deliberately does NOT carry `.nd-fold`, so the two cannot be
      // confused by a selector.
      if (target.closest('.nd-group-fold')) {
        ndOwnerGroupOpen = !ndOwnerGroupOpen;
        ndRender();
        return;
      }

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

      var revokeBtn = target.closest('.nd-inv-revoke');
      if (revokeBtn) { ndRevoke(revokeBtn); return; }

      var partnerGo = target.closest('.nd-partner-go');
      if (partnerGo) { ndPartnerAdd(partnerGo); return; }

      var partnerDrop = target.closest('.nd-partner-drop');
      if (partnerDrop) { ndPartnerDrop(partnerDrop); return; }

      var relayLabelBtn = target.closest('.nd-relay-label-go');
      if (relayLabelBtn) { ndSetRelayLabel(relayLabelBtn); return; }

      var addBtn = target.closest('.nd-peer-add');
      if (addBtn) { ndPeerAdd(addBtn); return; }

      var dropBtn = target.closest('.nd-peer-drop');
      if (dropBtn) { ndPeerDrop(dropBtn); return; }

      // A RADIO IS A CLICK HERE, not a change event. The panels are
      // repainted wholesale, so a change listener bound to an input goes
      // with the next repaint — the same reason every control on this
      // screen is delegated.
      var policy = target.closest('input[name="nd-autoadd"]');
      if (policy) { ndSetAutoAdd(policy.value === 'add'); return; }

      var claimBtn = target.closest('.nd-claim-go');
      if (claimBtn) { ndClaim(claimBtn); return; }

      var nameBtn = target.closest('.nd-name-go');
      if (nameBtn) { ndRename(nameBtn); return; }

      var copyBtn = target.closest('.natter-dev-copy');
      if (copyBtn) { ndDeviceCopy(copyBtn); return; }

      var rotateBtn = target.closest('.natter-dev-rotate');
      if (rotateBtn) { ndDeviceRotate(rotateBtn); return; }

    });

    // ENTER IS THE BUTTON. One text field with one button beside it is a
    // form, and a form submits on Return. This one did not, so the most
    // obvious gesture on the screen did nothing at all (Andy, 2026-09-15).
    //
    // Delegated for the same reason the clicks above are: the panels are
    // repainted, and a handler bound to an input would go with it.
    //
    // Rename and claim, not invite. Those two are a form with one thing
    // to say, and Return says it. The invite panel has a number field and
    // a token that may be generated for you — guessing what Return means
    // there would be a worse answer than the button it already has.
    ndBody().addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      var target = event.target;
      if (!target || !target.closest || !target.classList) return;

      if (target.classList.contains('nd-name-new')) {
        var renamePanel = target.closest('.natter-rename');
        var renameGo = renamePanel && renamePanel.querySelector('.nd-name-go');
        if (renameGo) { event.preventDefault(); ndRename(renameGo); }
        return;
      }

      // Any of the three claim fields: this is the first-run gesture on a
      // fresh node, and it should not require finding the button.
      if (target.classList.contains('nd-claim-name') ||
          target.classList.contains('nd-claim-token') ||
          target.classList.contains('nd-claim-invite')) {
        var claimPanel = target.closest('.natter-claim');
        var claimGo = claimPanel && claimPanel.querySelector('.nd-claim-go');
        if (claimGo) { event.preventDefault(); ndClaim(claimGo); }
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
    // The list's caption for this relay. It is the list's to know — this
    // screen is handed one subject and never reads relays.json.
    ndRelayLabel = (params && params.relayLabel) || '';
    ndAutoAdd = !(params && params.autoAdd === false);
    ndBadge = null;
    // Opening a second relay must show "asking" again, not the previous
    // relay's answer wearing this one's name.
    ndAsked = false;
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
