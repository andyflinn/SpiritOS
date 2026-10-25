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
// it is watching the roll for) belongs to the list. A mint made here
// is RETURNED, and Natter records it.

var ndEscapeHtml = spirit.escapeHtml;

// WHAT A LABEL MAY BE, asked before a round trip is spent on it. The
// rule is js/fieldRules.js, loaded by index.html, and the relay enforces
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
// TWO PLACES CARRY IT, and the order matters: `roll.relayKey` comes
// from the public roll every probe already fetches, so a plain MEMBER
// has it — which `report.key` cannot give, because a report is pushed to
// the owner alone. `rename` is an own-row verb every member holds, so
// reading the owner's copy first would have worked for exactly one
// person and looked fine.
function ndRelayKey() {
  if (!ndBadge) return '';
  return (ndBadge.roll && ndBadge.roll.relayKey)
    || (ndBadge.report && ndBadge.report.key)
    || '';
}

// Said once, because three verbs need to say it. A relay that has not
// answered a roll yet cannot be addressed, and that is a different
// thing from a relay that refused.
function ndNoKey(out, cls) {
  out.className = 'job-manifest-note ' + cls + ' is-error';
  out.textContent = 'this relay has not answered yet';
}

function ndLabelProblem(name) {
  var rule = (typeof window !== 'undefined' && window.spirit && window.spirit.fieldRules) || null;
  return rule ? rule.problem(name) : '';
}
var ndApi = null;

var ndUrl = '';         // which mailbox this screen is
var ndBadge = null;     // what that relay last said about itself
var ndRows = [];        // every configured relay's row — see ndLoad
var ndLabel = '';       // this node's own name, needed to sign a status ask
var ndMinted = '';      // a label minted while this screen was open
var ndChanged = false;  // has anything happened the list must repaint for?
var ndRelayLabel = '';  // what the LIST calls this relay, for the title
var ndRelayNamed = '';  // the public label the relay just confirmed, until the node's next read of its card says it

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
      '<span class="nd-fold-mark">' + (shut ? '▶️' : '🔽') + '</span> ' +
      (mark ? mark + ' ' : '') + ndEscapeHtml(title) +
    '</div>' +
    (shut ? '' : '<div class="nd-panel-body">' + inner + '</div>') +
    '</div>';
}

// HAS THE QUESTION COME BACK? Not "was the answer good" — just whether
// this screen is still waiting. It is the difference between a spinner
// and a result, and without it every failure on this screen wore the
// spinner's face. See ndReportHtml.
var ndAsked = false;

// THE NODE ANSWERED, AND THIS RELAY IS NOT ON ITS LIST (goal/G16.3). Not a
// failure: Natter's Add opens this screen for a relay the node does not
// list yet, because a claim that succeeds is what lists it — there is no
// verb that adds one. So this screen offers the claim, and says why.
var ndUnlisted = false;

// This relay's answer to "add newcomers to my contacts". Handed in by
// Natter, which showed the relay list; absent reads as ON, because an owner
// who wrote an invite already decided they want to reach that person.

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
  return ndApi.verb(verb, body);
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
  ndUnlisted = false;
// relay.status is gone (puppets/G2): spirit.relay.status (the relay family's api.js)
  // asks relay.search and relay.get and hands back the same shape.
  return spirit.relay.status(ndLabel || '').then(function (r) { return r && r.body; })
    .then(function (data) {
      ndAsked = true;
      var rows = (data && data.rows) || [];
      ndBadge = rows.filter(function (row) { return row && row.url === ndUrl; })[0] || null;
      // An answer that names other relays and not this one is the node
      // saying "not on my list" — only when the answer is a real one.
      ndUnlisted = !ndBadge && !!(data && Array.isArray(data.rows));
      // ── AND THE OTHER RELAYS, WHICH WERE FETCHED AND THROWN AWAY ────
      //
      //   Andy: "i can fetch the roll of all relays I'm connected to,
      //   and find potential partners that are not partners yet."
      //
      // `relay.status` answers for EVERY configured relay (it carried each
      // roster too, until the roll went) — ownerBadge.probe walks the list —
      // and this kept one row and dropped the rest. Which is why finding a partner meant opening
      // who.json: the page already held the answer and discarded it one
      // line after receiving it.
      //
      // The same shape as censusFacts keeping `roster` instead of
      // summarising it away. Costs nothing: no request, no wire, no
      // store — a reference to data already in hand.
      ndRows = rows;
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
      // Anything this screen needs to ASK for is asked here, once per
      ndRender();
    })
    .catch(function () { ndAsked = true; ndRender(); });
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
    return ndPanel('why-red', '⚠️', 'This relay did not answer',
      '<div>' + ndEscapeHtml(ndBadge.error || 'no answer') + '</div>' +
      '<div class="muted">Nothing is wrong with your node. A relay that is ' +
        'switched off and an address with a typo in it look the same from here, ' +
        'so this does not guess between them. If the address is right, it will ' +
        'go green by itself when the relay comes back.</div>');
  }

  // 2. It answered, and has no row for you. The only state with an
  //    actual next move, so the next move is the paragraph.
  return ndPanel('why-red', '⚠️', 'This relay answered, and you are not on it',
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
  return ndPanel('local', '⚠️', 'Why this relay is not useful',
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

function ndRefusedHtml(refused) {
  var since = new Date(refused.at);
  var when = isNaN(since.getTime()) ? String(refused.at || 'an unknown time') : since.toLocaleString();
  var remove = ndRemoveBody();
  return '<div class="stat-tile wide">' +
    '<div class="panel-heading">' + '⚠️' + ' This relay refused this node</div>' +
    '<div>Since ' + ndEscapeHtml(when) + ' it has answered “' +
      ndEscapeHtml(refused.why || 'your id is not a valid sender here') + '”. ' +
      'Your seat is gone: the relay no longer holds a row for this node, so it sends nothing through it ' +
      'and holds no stream to it.</div>' +
    '<div class="muted">Only a new invite from its owner brings the seat back. ' +
      'Ask them for one, then claim with it below.</div>' +
    remove +
    '</div>';
}

// WHETHER THIS RELAY MAY COME OFF THE LIST, asked here (goal/G30.7, Natter retired): the one rule the node enforces too,
// ownerBadge.removalRefusal, over the list's rows as ndLoad holds them (owned, claimed). '' when it may.
function ndRemoveRefusal() {
  var badge = window.spirit && window.spirit.ownerBadge;
  if (!badge || typeof badge.removalRefusal !== 'function') return 'this page cannot tell whether it may be removed';
  return badge.removalRefusal(ndRows, ndUrl);
}
function ndRemoveBody() {
  var why = ndRemoveRefusal();
  if (why) return '<div class="job-manifest-note">It cannot be removed: ' + ndEscapeHtml(why) + '.</div>';
  return '<div class="start-job-form"><button type="button" class="cancel-btn nd-remove">Remove this relay</button></div>' +
    '<div class="job-manifest-note nd-remove-out">Remove takes it off this node\'s list and gives up the seat record here.</div>';
}
function ndRemoveHtml() {
  return ndPanel('remove', '⚠️', 'Remove this relay from your list', ndRemoveBody());
}

// Two presses, then relay.remove, here (goal/G30.7: Natter, which performed it, is gone). The node asks the same rule.
function ndRemove(button) {
  if (ndRemoveRefusal()) return;
  if (button.getAttribute('data-armed') !== 'yes') {
    button.setAttribute('data-armed', 'yes');
    button.textContent = 'Press again to remove';
    return;
  }
  button.removeAttribute('data-armed');
  if (!ndApi) return;
  ndApi.verb('relay.remove', { key: ndUrl }).then(function (r) {
    var said = (r && r.body) || {};
    if (said.ok) { ndApi.closeDialog(); return; }
    var out = document.querySelector('.nd-remove-out');
    if (out) out.textContent = 'not removed: ' + (said.error || 'no answer');
  });
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
    if (ndUnlisted) {
      return '<div class="stat-tile wide"><div class="job-log-empty">' +
        ndEscapeHtml(ndUrl) + ' is not on this node’s relay list yet. ' +
        'Claim a seat on it below: a claim that succeeds is what puts it on the list.' +
        '</div></div>';
    }
    return '<div class="stat-tile wide"><div class="job-log-empty">' +
      'This node could not get an answer about ' + ndEscapeHtml(ndUrl) + '. ' +
      'It is either unreachable from here, or this node is running older code than it is.' +
      '</div></div>';
  }

  // THIS RELAY REFUSED THIS NODE (goal/G19.1). Not a fold: it is the one
  // thing to read here. Andy, 2026-10-12: "the seat is already vacated, so
  // the nodes ID has to get a new invite, that what the info in natter is
  // supposed to convey." No try-again; the user's own Remove, never on the
  // last relay.
  if (ndBadge.refused) return ndRefusedHtml(ndBadge.refused);

  // A MEMBER'S VIEW, from what the key door answers rather than the
  // owner-only report: who owns it, and the name this node wears HERE,
  // which with one browser across several relays is a per-relay answer.
  if (!ndBadge.owned && ndBadge.claimed) {
    var c = ndBadge.roll || {};
    return ndPanel('relay', 'ℹ️', 'What this relay says', spirit.shell.factRow([
      ['Owner', c.owner || '(unknown)'],
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
    return ndPanel('relay', 'ℹ️', 'What this relay says',
      '<div class="job-log-empty">this relay has not reported yet</div>');
  }
  var report = ndBadge.report;
  // `peers` is a COUNT here, where the old owner-only report carried the
  // roster itself. The pushed report counts on the relay — see
  // relayStatus.report — because a monitor wants a number, and no route
  // serves a roster at all since the roll was deleted (2026-09-18).
  //
  // MESSAGES IS GONE, and not merely missing: R8 deleted the ring, so
  // there is no count to show. A relay stores nothing on anyone's behalf,
  // and a row reading "Messages 0" would suggest the question still
  // applies.
  var facts = [
    ['Owner', report.owner || '(none)'],
    ['Mode', report.mode || '(unknown)'],
    ['Peers', report.peers == null ? '(unknown)' : report.peers],
    ['Connected', report.present == null ? '(unknown)' : report.present],
  ];
  return ndPanel('relay', 'ℹ️', 'What this relay says',
    spirit.shell.factRow(facts.concat(ndGovernorFacts(report))));
}

// ── THE MONITOR'S TWO PANELS, AS ROWS (cycle 1) ─────────────────────
//
// design/principles/NODE-AND-RELAY.md §4: ACTIVITY (what is happening)
// and LEVER POSITIONS (the limits it runs under right now, and why the
// last one moved). The data was on the wire already — `meter`, `routes`,
// `memory` — and cycle 1 adds `ramLimitMB`, `levers` and `decision`.
//
// Each row appears only when the relay sent its field, so a relay with no
// Governor draws no lever row rather than a blank one (AGENT.md: no chrome
// that is not useful in this state).
function ndGovernorFacts(report) {
  var rows = [];
  var mem = report.memory || {};
  var mb = function (b) { return (Math.round((b || 0) / 104857.6) / 10) + ' MB'; };
  if (typeof mem.heapUsed === 'number') {
    var heap = mb(mem.heapUsed);
    if (typeof report.ramLimitMB === 'number') {
      heap += ' of ' + report.ramLimitMB + ' MB (' +
        Math.round(mem.heapUsed / (report.ramLimitMB * 1048576) * 100) + '%)';
    }
    rows.push(['Heap', heap]);
    if (typeof mem.rss === 'number') rows.push(['RSS', mb(mem.rss)]);
  }
  if (typeof report.routes === 'number') rows.push(['In flight', report.routes]);
  var m = report.meter;
  if (m && typeof m.posts === 'number') {
    rows.push(['Activity', m.posts + ' posts, ' + (m.bytesPerSec || 0) + ' B/s over ' + (m.seconds || 0) + ' s']);
  }
  // WHAT THE RELAY HOLDS, IN PARTS (goal/G30.15; Andy: "the number i really need to see is: How many members (with 3
  // streams) per MegaByte"): its own memory at rest, the streams by kind at what each costs, the RAM still free, and
  // the members it serves.
  var c = report.capacity;
  if (c) {
    rows.push(['At rest', c.atRestMB + ' MB']);
    var s = c.streams || {};
    rows.push(['Streams', (s.nodes || 0) + ' home nodes, ' + (s.faces || 0) + ' faces, ' + (s.feeds || 0) + ' feeds, ' + c.streamKB + ' KB each']);
    if (typeof c.freeMB === 'number') rows.push(['Free', c.freeMB + ' MB of ' + c.ramLimitMB + ' MB']);
    rows.push(['Members a megabyte', c.membersPerMB + ', at ' + c.seatStreams + ' streams each']);
    if (typeof c.members === 'number') rows.push(['Members served', c.members]);
  }
  var lever = report.levers && report.levers.connections1;
  if (lever) {
    // The lever's readOut (lever.js) is {value, floor, ceiling, ...}: the allowance is its value, as relayMonitor
    // reads it (goal/G30.7; it read position and allowed, which the relay has not sent since cycle 1).
    rows.push(['Connections', 'allowing ' + lever.value +
      ' (floor ' + lever.floor + ', ceiling ' + lever.ceiling + ')']);
  }
  var d = report.decision;
  if (d) {
    rows.push(['Last move', d.from + ' → ' + d.to + ': ' + d.why +
      (d.closed ? ', closed ' + d.closed : '') + (d.at ? ' at ' + String(d.at).slice(11, 19) : '')]);
  }
  return rows;
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
// ── THE RENAME PANEL STOOD HERE, AND IT IS IN INFO NOW ──────────────
//
//   Andy: "when I'm on the phone with a friend to connect, i have no idea
//   which 'relay' contains which 'label' of mine. i want this app to
//   distribute my label to ALL relays I'm a member of. Then we remove the
//   Label-change interface from natter detail."
//
// This panel was right about the MECHANISM and wrong about the question.
// A label is stored per membership, so a screen that is one membership is
// where a rename can be aimed — which is what the comment here argued,
// and it still holds. What it missed is that nobody wants to be called
// different things: one label per relay is a consequence of how the
// ledger works, not something a person set out to arrange.
//
// So the gesture moved up a level. Info holds one name and posts it to
// every relay this key holds a row on, and shows what each one calls you
// — which is the question that was unanswerable from here, because this
// screen can only ever see one mailbox.
//
// WHAT STAYS HERE is the READING: what this relay calls this node is
// shown on the row above, under "You". That is a fact about this
// membership and belongs on this membership's screen. It is the control
// that left, not the fact.
//
// The relay's own verb is untouched (relay.renameSelf) and so is the
// packet: `{ rename: { label } }` addressed to the relay's key, sent by
// Info now instead of from here.

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
  // An unlisted relay has no badge — the node probes only what it lists —
  // and the claim is the one way onto the list (goal/G16.3), so it is
  // offered without one.
  // A SEAT IS THE TEST, NOT A STREAM (goal/G28.1). Andy, 2026-10-16: "if a natter detail knows there is no seat, it
  // MUST offer the redeem-invite interface." A stream can only be had with a seat, so a relay with no seat gets the
  // form whether or not it answers this minute.
  if (!ndUnlisted) {
    if (!ndBadge || ndBadge.owned || ndBadge.claimed) return '';
  }
  // ONLY WHERE THE RELAY SENDS MAIL (goal/G30.2): its card says services.sendMail, which the node keeps on the row.
  // An unlisted relay has no row yet, so it offers the invite form alone.
  var joinByMail = !!(ndBadge && ndBadge.services && ndBadge.services.sendMail === true);
  return ndPanel('claim', '▶️', 'Claim a seat on this relay',
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
    // JOIN WITH YOUR EMAIL, FIRST (goal/G30.2): the one thing a new user types. The relay mails a link to this node;
    // opening it takes the seat (shell.js joinFromLink). The invite form below stays for an invite somebody gave you.
    // The form is the shell element joinForm (goal/G30.1, box v33), bound once on nd-body at mount.
    (joinByMail && ndJoinForm() ? '<div class="nd-join-form"></div>' : '') +
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

// YOUR EMAIL ON A RELAY WHERE YOU HOLD A SEAT (goal/G30.1, box v28): the join form for a seated member and the owner
// too. A repeat join from a seated key is an email update on the relay: the same mail, link and code, and the address
// is written only when the code is confirmed. "Add" while this node holds none for the relay, "Change" once it does,
// and the input shows the address held, so he sees whether a change is needed. Only where the relay sends mail, as the
// claim panel's join form.
function ndEmailHtml() {
  if (!ndBadge || !(ndBadge.owned || ndBadge.claimed)) return '';
  if (!(ndBadge.services && ndBadge.services.sendMail === true)) return '';
  if (!ndJoinForm()) return '';
  // The words are the control's own (joinForm.words, box v41), the same the Join app's step 1 shows.
  var w = ndJoinForm().words({ seated: true, email: ndBadge.email, emailVerified: !!ndBadge.emailVerified });
  return ndPanel('email', '✉️', w.title, '<div class="nd-join-form"></div>', 'natter-email');
}

// THE FACE FORM ON ITS RELAY (goal/G40.10, box v19): the same face form as Join and Info, its dropdown fixed to this relay;
// it offers a relay only with a verified email, so without one it draws nothing.
function ndFaceHtml() {
  if (!ndBadge || !(ndBadge.owned || ndBadge.claimed) || !ndBadge.emailVerified) return '';
  return ndPanel('face', '🌐', 'A face name', '<div class="nd-face-form"></div>', 'natter-face');
}

// THE JOIN FORM IS A SHELL ELEMENT (goal/G30.1, box v33): shell/js/joinForm.js, loaded by index.html.
function ndJoinForm() { return (window.spirit && window.spirit.elements && window.spirit.elements.joinForm) || null; }

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
//
// ── AND IT IS HALF A PANEL NOW, NOT A PANEL ──────────────────────────
//
//   Andy: "the two invite blocks should be one single invite block."
//
// They were two folds and one subject. Minting and what has been minted
// answer each other — the row that appears below the form IS the answer
// to "did that work" — and a person who has just read a token onto a
// phone has to open a second bar to see the reservation they made. The
// note in ndRender already said they belonged adjacent; adjacent was
// never enough, because either could be the one that is shut.
//
// So this returns a FRAGMENT and ndInvitePanel puts it under the form.
// It keeps its own function because it is a different thing to build: the
// form is markup, this is a list off the relay's report.
function ndInviteRowsHtml() {
  var report = ndBadge && ndBadge.report;
  // NO REPORT IS NOT NO INVITES. A screen that has not heard back yet
  // must not answer "nothing outstanding" — that is a claim about the
  // relay made on the strength of not having asked it.
  if (!report) {
    return '<div class="job-log-empty">' +
      (ndAsked ? 'this relay has not said what is outstanding' : 'asking that relay\u2026') +
      '</div>';
  }
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

  return body +
    // Said once, here, rather than implied by a count that does not add
    // up: one label may carry several live invites, so revoking takes
    // every invite under that name.
    '<div class="job-manifest-note">Revoking a name takes back every ' +
    'outstanding invite under it. An invite that has already been claimed ' +
    'is not here — the seat is on the peer list now.</div>' +
    '<div class="job-manifest-note nd-inv-revoke-out"></div>';
}

// How many are outstanding, for the bar. '' rather than '(0)' when the
// relay has not reported: a number on a folded bar is read as a fact, and
// "none" is not something this screen knows yet.
function ndInviteCount() {
  var report = ndBadge && ndBadge.report;
  if (!report) return '';
  var n = (report.invites || []).length;
  return n ? ' (' + n + ')' : '';
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
        (shut ? '▶️' : '🔽') + '</span> ' +
      '⭐' + ' Managing my relay' +
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
// ── TWO PANELS STOOD HERE, AND BOTH ARE GONE ─────────────────────────
//
//   Andy: "i, as a user: want to deal in natter with relays, not people
//   or nodes. that panel 'enrollment list', i would never use: when i
//   deal with people i go to contacts. and contactsDetails will offer me
//   all functionality i need that are related to a single contact. It
//   would be the most likely panel i use on the phone when
//   inspecting/configuring that person's data on my node."
//   "another panel, 'When somebody new joins' makes no sense anymore
//   either. gotta go, too."
//
// ── "WHO IS ENROLLED HERE" ───────────────────────────────────────────
//
// A second list of people, on the screen about a box. It had three
// buttons and the first of them had become a falsehood: every member of a
// relay this node owns is now a contact automatically (hub.reconcileMembers),
// so "Add to contacts" posted an acquire at rank `invite` for somebody
// already filed at rank `member` — ranks never fall, so it changed
// nothing and then reported "added". A button that claims credit for a
// state that existed before it was pressed.
//
// The other two are not lost:
//
//   PARTNER put a key in the field below. The field is still there and
//   still takes a pasted key; its placeholder no longer promises a row
//   above to press.
//   REMOVE evicted somebody. Contacts Details evicts too, as the first
//   half of Forget — see cdReleaseSeats.
//
// WHAT IS GENUINELY GONE is evicting somebody while KEEPING them as a
// contact. That is a real thing to want ("off my relay, still my friend")
// and it now has no control anywhere. Said here rather than discovered:
// if it is wanted, contactsDetails is where Andy put per-contact
// functionality, and it is a button beside Forget rather than a panel.
//
// ── "WHEN SOMEBODY NEW JOINS" ────────────────────────────────────────
//
// The auto-add policy, and it was dead before it stopped making sense.
// `autoAdd` was written to relays.json by this panel and read back by
// this panel, and by nothing else in the tree — no node module ever
// looked at it, so no newcomer was ever added or not added because of
// it. Andy is right twice: it is superseded by members becoming contacts
// on their own, and it never did anything.


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
// Nor is it the caption in your relay list — that one is yours, local,
// and nobody else ever sees it. This is what the relay publishes about
// itself, so every member's screen can show it.
function ndRelayLabelHtml() {
  if (!ndBadge || !ndBadge.owned) return '';
  var roll = ndBadge.roll || {};
  // The relay's own label as its card said (goal/G30.7), or the one it just confirmed while the node's copy catches up.
  var now = ndRelayNamed || roll.relayLabel || '';
  return ndPanel('relaylabel', 'ℹ️', 'Change what this relay is called',
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
  // both sides (js/fieldRules.js), so the two cannot disagree.
  var badName = ndLabelProblem(wanted);
  if (badName) { say(badName, true); return; }

  var relayKey = ndRelayKey();
  if (!relayKey) { ndNoKey(out, 'nd-relay-label-out'); return; }

  say('asking…');
  ndApi.peerPost('relay', relayKey, { relayLabel: { label: wanted } }).then(function (r) {
    var said = r && r.reply;
    if (r && r.ok && said && said.ok !== false) {
      say('this relay is called ' + (said.label || wanted) + ' now');
      ndRelayNamed = String(said.label || wanted);
      ndChanged = true;
      ndLoad();
      return;
    }
    say((said && said.error) || (r && r.error) || 'refused', true);
  });
}

// ── MEMORY AND DISC, FOR ITS OWNER (goal/G30.15) ────────────────────
//
//   Andy: "what we need is, under managing my relay, a UI for memory and disc allocation."
//
// The relay's own config verb answers it: read with an empty ask (what is on file, what runs, what the box can give,
// the roll), written with figures that apply at the next start, and restart:true asks for that start now. Each field
// says the members its figure serves: the RAM left after the relay's own memory at rest, 16 streams a megabyte, three
// streams a seat. Restart drops every stream on the box, so it takes two presses.
var ndAlloc = null;       // the config read's answer
var ndAllocAsked = false;
var ndAllocSaid = '';
function ndAllocMembers(ramMB) {
  var r = (ndAlloc && ndAlloc.running) || {};
  var mb = Number(ramMB) - Number(r.atRestMB || 0);
  if (!(mb > 0)) return 0;
  return Math.floor(Math.floor(mb * Number(r.streamsPerMB || 16)) / Number(r.seatStreams || 3));
}
function ndReadAlloc() {
  var relayKey = ndRelayKey();
  if (!relayKey) return;
  ndAllocAsked = true;
  ndApi.peerPost('relay', relayKey, { config: {} }).then(function (r) {
    ndAlloc = r && r.ok && r.body ? r.body : null;
    if (!ndAlloc) ndAllocSaid = (r && (r.error || (r.body && r.body.error))) || 'the relay did not say';
    ndRender();
  });
}
function ndAllocationHtml() {
  if (!ndBadge || !ndBadge.owned) return '';
  if (!ndAlloc && !ndAllocAsked) ndReadAlloc();
  if (!ndAlloc) {
    return ndPanel('allocation', 'ℹ️', 'Memory and disc',
      '<div class="job-manifest-note">' + ndEscapeHtml(ndAllocSaid || 'asking that relay…') + '</div>', 'natter-allocation');
  }
  var f = ndAlloc.onFile || {};
  var run = ndAlloc.running || {};
  var room = ndAlloc.room || {};
  var roll = ndAlloc.roll || {};
  var ram = f.ramLimitMB !== undefined ? f.ramLimitMB : run.ramLimitMB;
  var disc = f.discLimitMB !== undefined ? f.discLimitMB : run.discLimitMB;
  // DISC IN GB (goal/G30.15; Andy: "disc should be measured in GB, not MB"); the relay keeps MB.
  var gb = function (mb) { return mb === undefined || mb === null ? 'not known' : (Math.round(Number(mb) / 1024 * 100) / 100) + ' GB'; };
  return ndPanel('allocation', 'ℹ️', 'Memory and disc',
    spirit.shell.factRow([
      ['Memory set', ram + ' MB'], ['Memory running', run.ramLimitMB + ' MB'],
      ['The box can give', (room.ramMaxMB !== undefined ? room.ramMaxMB + ' MB' : 'not known')],
      ['The relay at rest', (run.atRestMB || 0) + ' MB'], ['Members served now', run.members === undefined || run.members === null ? 'no limit' : run.members],
    ]) +
    spirit.shell.factRow([
      ['Disc set', gb(disc)], ['Disc running', gb(run.discLimitMB)],
      ['The box can give', gb(room.discMaxMB)],
      ['The roll uses', (roll.discUsedMB || 0) + ' MB'],
    ]) +
    '<div class="start-job-form card">' +
      '<label class="field-label">Memory, MB<input type="number" min="1" class="nd-alloc-ram" value="' + ndEscapeHtml(ram) + '"></label>' +
      '<span class="job-manifest-note nd-alloc-serves">serves ' + ndAllocMembers(ram) + ' members</span>' +
      '<label class="field-label">Disc, GB<input type="number" min="0.01" step="0.01" class="nd-alloc-disc" value="' + ndEscapeHtml(Math.round(Number(disc) / 1024 * 100) / 100) + '"></label>' +
      '<button type="button" class="cancel-btn nd-alloc-save">Save</button>' +
      '<button type="button" class="cancel-btn nd-alloc-restart">Restart</button>' +
    '</div>' +
    '<div class="job-manifest-note">More memory or disc applies at once; less applies at the next restart of the relay.</div>' +
    '<div class="job-manifest-note nd-alloc-out">' + ndEscapeHtml(ndAllocSaid) + '</div>',
    'natter-allocation');
}
// The members a typed memory figure serves, said under the field as it is typed.
function ndAllocTyped(input) {
  var panel = input.closest('.natter-allocation');
  var said = panel && panel.querySelector('.nd-alloc-serves');
  if (said) said.textContent = 'serves ' + ndAllocMembers(input.value) + ' members';
}
function ndAllocAsk(ask, out) {
  var relayKey = ndRelayKey();
  if (!relayKey) { ndNoKey(out, 'nd-alloc-out'); return; }
  out.textContent = 'asking…';
  ndApi.peerPost('relay', relayKey, { config: ask }).then(function (r) {
    var b = r && r.body;
    if (r && r.ok && b && b.ok !== false) {
      var when = function (w) { return w === 'now' ? 'now' : 'at the next restart'; };
      ndAllocSaid = ask.restart
        ? (b.restarting ? 'restarting now: it comes back on the figures in its file' : 'this relay cannot restart itself: ' + (b.restartRefused || 'no restarter'))
        : 'saved: ' + b.after.ramLimitMB + ' MB memory (' + b.after.members + ' members) ' + when(b.ram) + ', ' +
          (Math.round(b.after.discLimitMB / 1024 * 100) / 100) + ' GB disc ' + when(b.disc);
      ndAlloc = null;
      ndAllocAsked = false;
      ndRender();
      return;
    }
    // KEPT, so the next redraw does not wipe it (goal/G30.15).
    ndAllocSaid = (b && b.error) || (r && r.error) || 'refused';
    out.className = 'job-manifest-note nd-alloc-out is-error';
    out.textContent = ndAllocSaid;
  });
}
function ndAllocSave(button) {
  var panel = button.closest('.natter-allocation');
  // Disc is typed in GB; the relay takes MB.
  ndAllocAsk({ ramLimitMB: Number(panel.querySelector('.nd-alloc-ram').value), discLimitMB: Math.round(Number(panel.querySelector('.nd-alloc-disc').value) * 1024) },
    panel.querySelector('.nd-alloc-out'));
}
function ndAllocRestart(button) {
  if (button.getAttribute('data-armed') !== '1') {
    button.setAttribute('data-armed', '1');
    button.classList.add('armed');
    button.textContent = 'Restart? Every stream drops';
    if (ndApi && ndApi.armUntilElsewhere) ndApi.armUntilElsewhere(ndDisarm);
    return;
  }
  // RESTART ONLY (goal/G30.15): no figures go with it, so nothing in the file is written over.
  ndAllocAsk({ restart: true }, button.closest('.natter-allocation').querySelector('.nd-alloc-out'));
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


// RETURNED, NOT WRITTEN. relays.json is Natter's file and this app's
// api.fs is scoped to its own folder, so the screen says what was chosen
// and Natter records it against the relay this screen is.
//
// Repainted from the local value rather than from an answer, which is
// the opposite of how the stranger policy works in Contacts — and the
// difference is real: that one is applied by the NODE and read back from
// it, this one is a line in a file Natter owns and will write.

// ── ADDING ONE PERSON, BY KEY ───────────────────────────────────────
//
// `peer.acquire` is the same verb Contacts uses to confirm somebody
// found by handle, and it verifies against the relay's roll before it
// writes a row — so this cannot add a key the relay does not actually
// carry, however stale this screen's copy of the list is.
// ── REMOVING AN ENROLMENT, WHICH IS A POST LIKE EVERYTHING ELSE ─────
//
// `removePeer` addressed to the relay's own key. Two presses, because
// this is the one control on this screen that destroys something
// somebody else is relying on — the same arming the device rotate uses.
//
// IT TAKES THEIR INVITES WITH IT (relay.forgetPeer), which the answer
// says out loud: un-inviting somebody while leaving their token working
// would be a lie.

// ── THE PARTNER RELAYS PANEL STOOD HERE ──────────────────────────────
//
// The owner's list of partner relays, the picker of eligible owners, and
// the Check-and-add and Break controls (ndPartnerCandidates,
// ndPartnerPickerHtml, ndMountPartnerPick, ndPartnersHtml, ndPartnerAdd,
// ndPartnerDrop, ndPartnerPicked). Partnering as a permission is gone by
// Andy's decision (goal/G22.6, 2026-10-13): "the partner roll and the
// partner budget are removed" — a relay carries posts to its members from
// any relay, so there is nothing for an owner to grant here, and the
// relay no longer answers the `partner` and `unpartner` verbs.

// ── "ON PARTNER RELAYS" STOOD HERE, AND IS GONE (2026-09-17) ─────────
//
//   Andy: "relay details for non-owned relays: section 'On partner
//   relays' needs to go." — then, of the owner's copy: "kill it there,
//   too."
//
// It listed people enrolled on the PARTNERS of this relay, so a
// partnership could be seen to add something:
//
//   Andy, when it was built: "we want to prove that with a partnership
//   more peer id's can be visible for every node bound to either
//   partner." / "seeing only is the goal."
//
// It proved that, and then the proof stopped being worth its price. The
// panel's own note was the argument against it — "Not reachable: posting
// needs forwarding, which is not built" — so what it offered was a list
// of people you cannot write to, and it cost a `relay.roster` per
// partner to draw: a whole public roll of somebody else's box, fanned
// out across every partnership, on every visit to this screen.
//
// WHAT WENT WITH IT: ndReachAdd and its click handler, the ndReach
// cache, ndLoadReach, ndReachHtml, ndPartnerList, ndEnsureReach and
// ndReachPanel — and `relay.roster` itself, whose only caller this was.
//
// The question it answered is search's now. `peer.search` crosses
// partnerships, ranks, bounds its answer, and marks each row with the
// partner it came through (`vias`) — which is the same fact this
// tabulated, asked for rather than downloaded.

// ── ONE INVITE BLOCK ─────────────────────────────────────────────────
//
//   Andy: "the two invite blocks should be one single invite block."
//
// The form, then what it has produced. One fold, one subject, and the
// answer to a mint lands in the same open panel that asked for it.
//
// TWO CLASSES ON ONE TILE, and that is not laziness: `natter-mint` and
// `natter-invites` are what the mint and revoke handlers reach for with
// `closest()`. Keeping both means neither handler learns that its panel
// moved — and a delegated handler that silently finds nothing is the
// failure mode this screen is most prone to, since every control here is
// bound to the body and not to the button.
//
// ★ is the same mark the row carries for owning it, and this panel is
// genuinely owner-only — see the note on the device panel, which is not.
function ndInvitePanel() {
  if (!ndBadge || !ndBadge.owned) return '';
  return ndPanel('invite', '⭐', 'Invites' + ndInviteCount(),
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
    '<span class="natter-inv-out"></span>' +
    // AND WHAT IS OUTSTANDING, in the same fold. A minted token appears
    // above this and its reservation appears in it, which is the pairing
    // two panels could never guarantee.
    ndInviteRowsHtml(),
    'natter-mint natter-invites');
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
// It did not, and nothing was broken: the roll carried the new name to
// the browser correctly and NOTHING DREW IT. Every caption on this
// screen came from the caller's relays.json — the reader's private
// shorthand — so publishing a name changed a field nobody displayed.
//
// THE ORDER IS THE OPPOSITE OF A CONTACT'S, and the difference is real.
// contactBook prefers MY label for a person: I chose it to tell two people
// apart, and a peer must not be able to rename themselves on my screen.
// A relay is not a peer I am distinguishing — it is a service, and this
// is ITS screen. What it calls itself is the fact; my list shorthand is
// a convenience that stands in until there is one.
//
// So: published first, local second, url last. Somebody who prefers
// their own word still has it in the list, which is where they wrote it.
function ndRelayName() {
  var roll = (ndBadge && ndBadge.roll) || {};
  return roll.relayLabel || ndRelayLabel || ndUrl || '';
}

function ndSetTitle() {
  if (!ndApi || typeof ndApi.setScreenTitle !== 'function') return;
  var name = ndRelayName();
  ndApi.setScreenTitle(name ? 'Relay Details for ' + name : 'Relay Details');
}

// ── PUTTING EVERY ARMED BUTTON BACK ──────────────────────────────────
//
//   Andy: "whenever i click anywhere else on the screen the button must
//   reset, back to its original state, and the whole are-you-sure
//   procedure must be done from scratch."
//
// This screen arms in the DOM — `data-armed` plus a changed label — so
// the disarm is simply a repaint: ndRender rebuilds every panel from
// state, and `data-armed` is not state. Four buttons, one answer.
//
// HARMLESS TWICE, which the shell requires of a disarm hook: a repaint of
// a screen that is already right paints the same thing.
function ndDisarm() {
  ndRender();
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
    // Claim renders only where this node holds no row. Its other half —
    // the rename panel for a row it does hold — moved to Info, so this is
    // now a panel that is either there or absent rather than one of a
    // pair. See ndClaimHtml.
    ndClaimHtml() +
    ndEmailHtml() +
    ndFaceHtml() +
    // ── THE OWNER'S HALF, INSIDE ONE FOLD ────────────────────────────
    //
    // Minting and what has been minted are ONE panel now (ndInvitePanel).
    // They were two, sitting adjacent for exactly this reason — the answer
    // to "did that work" is the row that appears under the form — and
    // adjacency could not deliver it, because either of the two could be
    // the one that is shut.
    // The partner relays panel that closed this fold went with partnering
    // (goal/G22.6).
    ndOwnerGroupHtml(
      ndRelayLabelHtml() +
      ndAllocationHtml() +
      ndInvitePanel()
    ) +
    ndRemoveHtml();
    // The device panel was removed by goal/G16.2 with the device enrolment.
  ndMountForms(body);
}

// THE TWO FORMS, THE SAME EVERYWHERE (goal/G40.10, box v19; Andy: "on the relays detail page the picker CAN be shown as
// a reminder, but unchangeable, with only one option"): drawn by their own mount into the panels, fixed to this relay.
function ndMountForms(body) {
  var el = (window.spirit && window.spirit.elements) || {};
  var here = Object.assign({ url: ndUrl, label: (ndBadge && ndBadge.label) || ndUrl }, ndBadge || {});
  Array.prototype.forEach.call(body.querySelectorAll('.nd-join-form'), function (box) { if (el.joinForm) el.joinForm.mount(box, { relays: [here], fixed: ndUrl }); });
  var face = body.querySelector('.nd-face-form');
  if (face && el.faceForm) el.faceForm.mount(face, { relays: [here], fixed: ndUrl, reload: function () { return ndLoad(); } });
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
// TAKING A SEAT ON THIS RELAY, and `url: ndUrl` is the whole reason this
// can be here — the screen is which relay, so the claim is aimed rather
// than landing on relays.json[0].
//
// AND THE URL NEED NOT BE LISTED YET (goal/G16.3): the claim is what puts
// a relay on the node's own list, so hub.handleClaim aims at a named url
// whether or not the node lists it.
//
// RETURNED, NOT RECORDED, like the mint below:
// session.json is Natter's file and api.fs here is scoped to this app's
// own folder. The screen says what the relay agreed to; Natter writes it
// down against this url.
// THE JOIN BY EMAIL STOOD HERE (ndJoin, goal/G30.2): it is the shell element joinForm now (goal/G30.1, box v33),
// bound on nd-body at mount, below.

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
  // object both sides (js/fieldRules.js), so the two cannot disagree.
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
      ndApi.closeDialog();
      return;
    }
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
    if (ndApi && ndApi.armUntilElsewhere) ndApi.armUntilElsewhere(ndDisarm);
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
    out.textContent = 'this relay has not answered yet';
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
    // part worth carrying back: it is what Natter watches the roll for,
    // so the person can be added as a contact the moment they turn up.
    // Never the token. That is the secret, and it does not leave this
    // screen.
    if (token) {
      ndMinted = label;
      ndChanged = true;
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

var ndPage = ({

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
    // HTTP request, and a roll fetch before it reads the second. The
    // status has effectively always landed by then. It is not a formal
    // guarantee, and it is the thing to suspect if an invite ever shows
    // up exactly one beat late.
    if (api.onRelayEvent) {
      api.onRelayEvent(function (event) {
        var about = (event && event.relay) || '';
        if (about && ndUrl && about !== ndUrl) return;
        if (!ndUrl) return;
        // A report nudge (`kind: 'status'`, cycle 1) reloads like any other
        // event. It is already paced — at most one a second per relay — by
        // the node (presenceNode.js), so this screen keeps no timer.
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

      var relayLabelBtn = target.closest('.nd-relay-label-go');
      if (relayLabelBtn) { ndSetRelayLabel(relayLabelBtn); return; }

      // Memory and disc (goal/G30.15).
      var allocSave = target.closest('.nd-alloc-save');
      if (allocSave) { ndAllocSave(allocSave); return; }
      var allocRestart = target.closest('.nd-alloc-restart');
      if (allocRestart) { ndAllocRestart(allocRestart); return; }





      // A RADIO IS A CLICK HERE, not a change event. The panels are
      // repainted wholesale, so a change listener bound to an input goes
      // with the next repaint — the same reason every control on this
      // screen is delegated.

      var claimBtn = target.closest('.nd-claim-go');
      if (claimBtn) { ndClaim(claimBtn); return; }

      var removeBtn = target.closest('.nd-remove');
      if (removeBtn) { ndRemove(removeBtn); return; }

    });

    // ENTER IS THE BUTTON. One text field with one button beside it is a
    // form, and a form submits on Return. This one did not, so the most
    // obvious gesture on the screen did nothing at all (Andy, 2026-09-15).
    //
    // Delegated for the same reason the clicks above are: the panels are
    // repainted, and a handler bound to an input would go with it.
    //
    // Claim, not invite. Claim is a form with one thing to say and Return
    // says it. The invite panel has a number field and a token that may
    // be generated for you — guessing what Return means there would be a
    // worse answer than the button it already has.
    //
    // Rename was the other one, and went to Info with its panel.
    // The `change` listener for the partner picker stood here; the picker
    // went with partnering (goal/G22.6).

    // The members a memory figure serves, said as it is typed (goal/G30.15).
    ndBody().addEventListener('input', function (event) {
      var t = event.target;
      if (t && t.classList && t.classList.contains('nd-alloc-ram')) ndAllocTyped(t);
    });

    ndBody().addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      var target = event.target;
      if (!target || !target.closest || !target.classList) return;

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
  // inside.
  open: function (params) {
    ndUrl = (params && params.url) || '';
    ndRelayNamed = '';
    ndLabel = (params && params.label) || '';
    // The list's caption for this relay. It is the list's to know — this
    // screen is handed one subject and never searches the relay list.
    ndRelayLabel = (params && params.relayLabel) || '';
    ndBadge = null;
    // Opening a second relay must show "asking" again, not the previous
    // relay's answer wearing this one's name.
    ndAsked = false;
    ndMinted = '';
    ndChanged = false;
    // A half-armed Remove must mean two presses about the SAME mailbox.
    // Arming it for one and then opening another has to disarm — the
    // shell can promise open() runs, it cannot know what is stale here.
    ndOpenPanel = '';

    ndSetTitle();
    ndRender();
    // ndLoad is the one that calls ndRender when it lands. No `render`
    // hook and nothing to restart on the way back onto the screen: this
    // dialog holds no live fact.
    ndLoad();
  },

});
// A PAGE ON THE NAVIGATION, NO APP (goal/G40.8; Andy: "natterDetails and contactDetails will become standard intrinsic
// shell elements", "the shell does ALL the wrapping"): open(params) pushes this screen as a page, params { url, label?, relayLabel? }; its
// title and back are the frame's, and nothing is handed back (what it changes reaches every view on the stream).
(window.spirit.elements = window.spirit.elements || {}).natterDetails = {
  open: function (params) {
    return window.spirit.elements.navigation.push({ title: 'Relay', mount: function (box, page) {
      ndPage.mount(box, page.api);
      ndPage.open(params || {});
    } });
  },
};
