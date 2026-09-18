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

// ── THE BINDINGS THIS NODE HOLDS, ONE PER RELAY ──────────────────────
//
//   Andy: "We must persist our bound-status for every listed relay and
//   give that persisted status a high degree of trust."
//
// The file was { label, boundAt } — ONE answer for a node that may hold
// a row on several relays. A rename is per-relay (relay.renameSelf moves
// one row), an unbind is per-relay (an owner purges one seat), and one
// slot for all of it meant the node re-derived its whole standing on
// every probe from whatever happened to be reachable. That is how a
// successful rename read as theft and deleted the session.
//
// The shape now, and it is ADDITIVE so nothing has to migrate:
//
//   {
//     "label": "andyflinn",          <- the primary, unchanged in meaning
//     "boundAt": "...",
//     "relays": {
//       "https://spirit.andyflinn.com": {
//         "label": "andyflinn",
//         "boundAt": "...",
//         "confirmedAt": "..."       <- when a relay last positively said yes
//       }
//     }
//   }
//
// `label` and `boundAt` stay exactly where they were, so js/client/shell.js
// (readNodeLabel, the window title, the first-run gate) and every harness
// that reads `held.label` keep working untouched. A file written by older
// code simply has no `relays` and grows one on the first probe.
//
// HIGH TRUST MEANS: an entry is believed until THAT relay answers and
// says it holds no row for this key. Silence never erodes it — see
// natterCheckBinding. `confirmedAt` is what makes the trust auditable
// rather than a feeling: it says when the relay last agreed.
var NATTER_SESSION_FILE = 'session.json';

// The primary caption — what this node calls itself, and what the shell
// puts in the window title. Derived, never stored independently: it is
// the first relay in relays.json order that we hold a binding for. Front
// of the list is already this tree's notion of primary (hub.loadRelayUrl,
// and labMaster deliberately moves spirit-3 to the front for it).
var natterMyName = '';

// url -> { label, boundAt, confirmedAt }. Null until the file is read.
var natterBindings = Object.create(null);

// minted.json AND natterMintedLabels STOOD HERE. They existed to
// recognise an invitee by the LABEL on their invite, which stopped being
// possible when a claimant gained the right to pick their own public
// label (R1) and stopped being necessary when the browser started
// receiving owner-events. The relay names the key. See natterOnClaim.
//
// The file itself is left on disk rather than deleted: it is one small
// array of labels, nothing reads it, and a node that downgrades should
// find it where it left it.

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
// KEPT DELIBERATELY WITHOUT A CALLER, and this is the one place that says
// so. The "Take this relay off the list" panel went on 2026-09-13 because
// one satellite makes it a way to break your own node — but the RULE it
// enforced is worth more than the button, and spirit/test/natterLast.js
// still proves it. When there is a second satellite the panel comes back
// and finds its rule already standing.
function natterCanRemove(relays, url) {
  var badge = (typeof window !== 'undefined' && window.spiritOwnerBadge) || null;
  return !!(badge && badge.canRemoveRelay(relays, url));
}

// Removal decided in one place, so the button and the click agree. A
// disabled-looking button that still deletes when clicked is the failure
// this cycle is about.
function natterRemoveAt(relays, index) {
  var row = relays && relays[index];
  if (!natterCanRemove(relays, row && row.url)) return null;
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
// What the Add row says back. Its own line, separate from
// `natter-bind-status`, which is about this node's SEAT rather than
// about the list — two questions, two places, so neither can overwrite
// the other's answer.
function natterStatus(text) {
  var el = document.getElementById('natter-status');
  if (el) el.textContent = text || '';
}

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
    // EVERY ROW OPENS, and that is the whole gate now.
    //
    //   Andy: "every relay on the natter list must invoke the
    //   natterDetails dialog, if nothing else, the dialog explains why
    //   the relay is non-green."
    //
    // It was `owned || claimed`, which is the set of rows you can DO
    // something with — and that is exactly backwards for the rows that
    // need explaining. A red circle with a tooltip and no way in is a
    // dead end on the one row somebody is actually asking about.
    //
    // The three reds are three different afternoons (see
    // natterStatusTitle): a relay that is down, one that answered and
    // has no row for you, and a lab fixture no peer can reach. A glyph
    // cannot say which; a screen can.
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
    return '<tr class="job-row natter-openable"' +
      ' data-row-url="' + api.escapeHtml(relay.url) + '"' +
      ' title="Open this relay">' +
      '<td title="' + api.escapeHtml(natterStatusTitle(badge)) + '">' +
        natterStatusMark(badge) + '</td>' +
      '<td>' + star + '</td>' +
      '<td>' + api.escapeHtml(natterRelayName(relays, relay.url)) + '</td>' +
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
// The caption the list shows for a url, or '' if it has none. A label is
// display and may be empty; the url is the identity.
function natterLabelFor(relays, url) {
  var row = (relays || []).filter(function (r) { return r && r.url === url; })[0];
  return (row && row.label) || '';
}

// ── WHAT A RELAY IS CALLED, NOW THAT IT CAN SAY ─────────────────────
//
//   Andy: "the Label change doesn't propagate on my UI"
//   Andy: "The relay list displays it"
//
// It did not propagate, and nothing was broken: the census carried the
// new name to the browser and NOTHING DREW IT. Every caption came from
// relays.json — the reader's private shorthand — so a relay could
// publish a name and no screen would ever show it.
//
// PUBLISHED FIRST, LOCAL SECOND, and that order is the opposite of a
// contact's on purpose. contactBook prefers MY label for a person: I chose
// it to tell two people apart, and a peer must not be able to rename
// themselves on my screen. A relay is not somebody I am distinguishing
// — it is a service with a name, and my list word was only ever
// standing in until it had one.
//
// The local label is not lost and not overridden anywhere it was typed:
// it is still what relays.json holds, still what the Add row wrote, and
// still what shows for a relay that has never been named.
function natterRelayName(relays, url) {
  var badge = natterBadgeByUrl[url];
  var published = (badge && badge.census && badge.census.relayLabel) || '';
  return published || natterLabelFor(relays, url) || url || '';
}

function natterOpenRelay(api, container, relays, url) {
  // `canRemove` rather than letting the screen work it out: the rule is
  // about the LIST — a node with no mailbox at all can neither claim,
  // send, nor read — and the list is the only thing that knows how long
  // it is. A screen that counted rows would be a second place for that
  // rule to live, and a second place is where it drifts.
  api.callDialog('app/natterDetails', {
    url: url,
    label: natterMyName,
    // WHAT THIS LIST CALLS IT, for the dialog's own title. The screen is
    // handed one subject and never reads relays.json — the caption is
    // the list's to know, the same way canRemove was.
    relayLabel: natterRelayName(relays, url),
    // `autoAdd` WAS HANDED IN HERE and is gone with the panel that read
    // it (Andy: "another panel, 'When somebody new joins' makes no sense
    // anymore either. gotta go, too").
    //
    // It was superseded — every member of a relay this node owns becomes
    // a contact on its own now (hub.reconcileMembers) — but it is worth
    // recording that it had never done anything either: this app wrote
    // the field and this app read it back, and no module in the node
    // ever looked at it. No newcomer was ever added or not added because
    // of that radio.
  }).then(function (result) {
    if (!result) return;
    // REMOVAL IS RETURNED, NOT DONE. relays.json is this app's file —
    // the screen's own api.fs is scoped to its folder — so the screen
    // says what it decided and this performs it, under the same guard
    // that has always stood here.
    // `result.renamed` WAS HANDLED HERE and is gone with the panel that
    // produced it: renaming moved to Info, which posts one label to every
    // relay at once (Andy: "i have no idea which 'relay' contains which
    // 'label' of mine").
    //
    // Nothing had to replace it, and that is worth saying because it
    // looks like a gap. natterCheckBinding already ADOPTS each relay's
    // caption off the census on every probe — see the long note on it
    // below, written after a rename that succeeded was mistaken for
    // theft. A label changed anywhere is picked up here by the ordinary
    // probe, with nobody telling this app anything.
    //
    // A CLAIM IS NOT THE SAME, which is why the branch below stays: a
    // seat taken on a relay this node had no row on is not a caption
    // moving, it is a membership appearing, and the file has to say so
    // before the next probe has anything to adopt.
    if (result.claimed) {
      natterBind(api, container, relays, url, result.claimed);
      return;
    }
    if (result.changed) natterProbe(api, container, relays);
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
// IT ALSO ANSWERS "IS THIS STILL ME", which is why natterVerifyBinding
// is gone and this takes one more line instead of a second fetch. See
// natterCheckBinding below.
// ── IT IS ASKED EVEN WITH NO LABEL, AND THAT IS THE RECOVERY ─────────
//
// This used to return here when the node had no local label: "no claim,
// nothing to sign as, no stars". That was true when the probe SIGNED a
// status request as a label. R3 ended it — hub.handleStatus reads `name`
// only to echo it back for display, and ownerBadge.probe asks the public
// census by KEY (handleStatus: "both answers come from the census, by
// key, so a caller without a key gets nothing").
//
// Leaving the guard in place meant a node that lost session.json could
// never find out it was still enrolled: no label, so no probe; no probe,
// so no label. It was one unsigned public GET away from the answer the
// whole time, and it stranded this node twice on 2026-09-15.
//
// So: always ask. natterCheckBinding writes back whatever relays report
// for this key, which is how a node with no file recovers its bindings
// by itself.
function natterProbe(api, container, relays) {
  var label = natterMyName || '';
  return api.verb('relay.status', { name: label })
    .then(function (r) { return r.body; })
    .then(function (data) {
      var rows = (data && data.rows) || [];
      rows.forEach(function (row) {
        if (row && row.url) natterBadgeByUrl[row.url] = row;
      });
      natterCheckBinding(api, relays, rows);
      natterRenderList(container, api, relays);
    })
    .catch(function () { /* a mailbox that cannot be reached is not one this node owns */ });
}








// Through the shell, which is the only thing that speaks to the node
// (AGENT.md, Comms). This was a private `fetch` wrapper, one of six
// identical copies across the apps, each written because `api` had no verb
// call on it. It does now.
function natterPost(api, verb, body) {
  return api.verb(verb, body);
}

function natterBindStatus(text) {
  var el = document.getElementById('natter-bind-status');
  if (el) el.textContent = text || '';
}

function natterPaintBind(api, relays) {
  var row = document.getElementById('natter-bind-row');
  var note = document.getElementById('natter-bind-note');
  var heading = document.getElementById('natter-bind-heading');
  if (!row || !note) return;

  var addRow = document.getElementById('natter-add-row');
  // BOUND ANYWHERE IS BOUND. The tile is guidance for a node that holds
  // no seat at all; one seat on one relay and it has nothing left to say.
  if (Object.keys(natterBindings).length) {
    row.style.display = 'none';
    note.innerHTML = '';
    if (addRow) addRow.style.display = '';
    return;
  }
  row.style.display = '';

  // ── THE ADD ROW IS SHOWN, AND IT WAS THE MISSING HALF ──────────────
  //
  // This read `relays.length ? 'none' : ''`, on the reasoning that
  // adding a relay is not the first thing a new node does. Which is true
  // of somebody being invited onto spirit-3 and false of everybody else:
  //
  //   Andy: "when somebody else has their own relay, it should land on
  //   natter, and offer the addition of a new relay or using spirit-3."
  //
  // relays.json ships with spirit-3 in it, so `relays.length` is one on
  // a fresh node and the ONLY control that could add your own relay was
  // hidden — behind claiming a seat on somebody else's first. An unbound
  // node has exactly two things it might want to do and this screen
  // offered one of them.
  //
  // Now it is shown whenever this node holds no seat, which is when both
  // choices are live. It goes back to hiding the moment a binding
  // exists, because then the tile has nothing left to say and the list
  // is an ordinary list again.
  if (addRow) addRow.style.display = '';

  // TWO WAYS ON, NOT ONE INSTRUCTION. The claim happens on the relay's
  // own screen — which carries the warning and the form — so this names
  // both routes there and takes no name of its own.
  if (heading) {
    heading.textContent = relays.length
      ? 'This node has no seat on any relay yet'
      : 'Add a relay below, then claim a seat on it';
  }

  // innerHTML for the one bold sentence. Every character is written in
  // this file — nothing from a relay, a peer or a file reaches it — so
  // there is nothing to escape. Anything interpolated later must be.
  note.innerHTML = relays.length
    ? 'This node needs a seat on a public relay before it can do anything else, ' +
      'and there are two ways to get one.' +
      '<br><br>' +
      '<strong>Use a relay you already have.</strong> Add it below, then open its row ' +
      'and claim the owner name with no token.' +
      '<br><br>' +
      '<strong>Or take a seat on somebody else’s.</strong> Open a relay in the list below ' +
      'and claim there, with the invite name and the token they read out to you. ' +
      // STILL THE LOUDEST SENTENCE ON THE PAGE. On a fresh node this
      // paragraph IS the page, and somebody holding no invite has
      // nothing to do until they get one — so the way to get one stays
      // bold. It briefly stopped being, while this copy was rewritten
      // into two routes, and natterBind caught it.
      '<strong>If you have no invite yet, ask countinn@gmail.com, ' +
      'he will give you one within 24 hours.</strong>'
    : 'This node has no relay listed yet. Add one above (for example https://spirit.andyflinn.com), then open it and claim a seat.';
}


// ── WHO JUST JOINED, FROM THE RELAY ITSELF ──────────────────────────
//
//   Andy: "when someone binds to the relay the owner may want to
//   auto-add the new ID to his contacts. he issued an invite, so he must
//   want to be connected with the new addition."
//
// THIS USED TO GUESS, and the guess was made of labels. Natter kept
// minted.json — the invite labels this browser had issued — and watched
// the owner census for a peer whose PUBLIC LABEL matched one of them.
// Three ways that was wrong, and only the first was ever written down:
//
//   IT MATCHED THE WRONG THING. A claimant picks their public label
//   freely (R1), so the label they wear is not the label on the invite.
//   Anybody who chose their own name was never recognised.
//   IT ONLY RAN WHILE NATTER WAS OPEN, because it rode on the probe.
//   IT ONLY KNEW WHAT THIS BROWSER MINTED. An invite issued from another
//   device was invisible here.
//
// None of that guessing is necessary. The relay has always told its
// owner, live, exactly who redeemed which invite, BY KEY:
//
//   ownerEvent('claim', { label, invite, key, owner, why })
//
// So this reads `key` and acts on it, which is the rule for every
// consumer of an owner-event (decision 0010, "What the owner is told"):
// key is what you act on, label is only for display.
//
//   Andy: "any search for enrollment row or peers or anything is really
//   search-key-by-public-label"
//
// It was the last place in the running tree that resolved a label back
// to a key in order to DO something. There is now none.
//
// ONLY WHEN AN INVITE WAS CONSUMED. A claim with no `invite` is the
// owner taking their own first seat, or an open box before it had an
// owner — neither is somebody you invited, and neither is consent to put
// them in your address book.
// ── THE POLICY IS PER RELAY, AND THAT WAS ANDY'S CORRECTION ──────────
//
// I proposed node-wide, beside the unknown-senders policy, on the
// grounds that "what I do about people" should be answered once.
//
// ── THE POLICY THAT GATED THIS IS GONE, AND SO IS THE NEED FOR IT ────
//
//   Andy: "another panel, 'When somebody new joins' makes no sense
//   anymore either. gotta go, too."
//
// `autoAdd` stood here — a per-relay switch for "add newcomers to my
// contacts", argued for because a lab box and spirit-3 should not share
// an answer. It gated the acquire below.
//
// It is superseded rather than merely deleted: everybody with a seat on
// a relay this node OWNS is now a contact, from the node, on every probe
// and on every claim (hub.reconcileMembers, hub.syncMembers). And these
// events only ever reach the owner of the relay they happened on — so
// the set this gated is exactly the set the node now adopts
// unconditionally.
//
// I TOLD ANDY THIS FIELD WAS DEAD BEFORE CHECKING ITS CALLERS, and it
// was not: this function read it. The grep found the definition and not
// the use, and the suite caught it. Recorded because the wrong half of
// "it does nothing" is the half that deletes something that does.
// The list as this app last read it, so an event arriving while nothing
// is being painted can still be answered. natterOnClaim is called from a
// subscription, not from a render.
var natterRelaysCache = null;

function natterOnClaim(api, event) {
  if (!event || event.kind !== 'claim') return;
  var key = String(event.key || '');
  var onInvite = String(event.invite || '');
  if (!key || !onInvite) return;
  // Never yourself. The owner's own claim carries the owner's own key,
  // and hub.handleContact refuses it anyway — this saves the round trip
  // and the confusing refusal in the log.
  if (event.owner) return;

  // ACQUIRING MOVED TO THE NODE. This posted `peer.acquire` for the
  // newcomer, and it could only work while a browser was open on this
  // app — an owner who was not looking missed the contact entirely.
  //
  // hub.syncMembers does it now: on the claim event as it arrives at the
  // node, and again on every probe for anybody the first pass missed.
  // Leaving this in would be a second writer of the same row at a lower
  // rank (`invite` under `member`), which changes nothing because ranks
  // never fall — a call that cannot have an effect.
  //
  // The function stays because the guards above are still worth having
  // for whatever a claim event is used for next, and because an empty
  // subscription is a thing somebody deletes without noticing the
  // subscription went with it.
}

// Read once, on mount. A file from before 2026-09-15 has a label and no
// map: that label is a real binding and must not be thrown away, so it is
// carried into the map under the first listed relay — the only relay the
// hub could claim on when that file was written (loadRelayUrl), which
// makes it the one it was about.
function natterLoadSession(api, relays) {
  natterBindings = Object.create(null);
  var held = null;
  try { held = JSON.parse(api.fs.loadFile(NATTER_SESSION_FILE) || 'null'); }
  catch (e) { held = null; }
  if (!held) { natterMyName = ''; return; }

  var map = held.relays;
  if (map && typeof map === 'object') {
    Object.keys(map).forEach(function (url) {
      var row = map[url];
      if (row && row.label) natterBindings[url] = row;
    });
  } else if (held.label && relays.length) {
    natterBindings[relays[0].url] = {
      label: held.label,
      boundAt: held.boundAt || new Date().toISOString(),
      confirmedAt: '',
    };
  }
  natterMyName = natterPrimaryLabel(relays);
}

// THE PRIMARY IS DERIVED, NOT DECIDED. First relay in list order that we
// hold a binding for. So renaming yourself on a relay that is not the
// first does not move your window title, which would be a strange thing
// for a caption on somebody else's relay to do.
function natterPrimaryLabel(relays) {
  for (var i = 0; i < relays.length; i += 1) {
    var held = natterBindings[relays[i].url];
    if (held && held.label) return held.label;
  }
  // A binding on a relay no longer listed still names this node — losing
  // a row from relays.json is not losing the seat it pointed at.
  var any = Object.keys(natterBindings)[0];
  return (any && natterBindings[any].label) || '';
}

function natterBindingFor(url) {
  return natterBindings[url] || null;
}

// One write, and the shell is TOLD rather than left to notice: writing
// session.json does move the fs-watcher's list and the snapshot would
// repaint — but only because the file is NEW, and only while that watcher
// is alive. A claim is not the place to depend on either.
//
// The file goes away entirely only when the last binding does. That is
// the one destructive act in here, and it now happens once, at the end,
// instead of on every partial disagreement.
function natterSaveSession(api, relays) {
  var urls = Object.keys(natterBindings);
  // TOLD ONLY WHEN IT CHANGED. This now runs on every probe, because
  // `confirmedAt` moves whenever a relay agrees — and nodeLabelChanged
  // repaints the window title, the desktop and the titlebar chrome. That
  // is the right thing to do when a node is renamed and pure churn when
  // it has simply been confirmed as what it already was.
  var wasPrimary = natterMyName;
  natterMyName = natterPrimaryLabel(relays);
  var titleMoved = natterMyName !== wasPrimary;

  var done;
  if (!urls.length) {
    done = Promise.resolve(api.fs.deleteFile(NATTER_SESSION_FILE));
  } else {
    var primaryAt = '';
    for (var i = 0; i < relays.length && !primaryAt; i += 1) {
      var held = natterBindings[relays[i].url];
      if (held && held.label === natterMyName) primaryAt = held.boundAt || '';
    }
    done = api.fs.saveFile(NATTER_SESSION_FILE, JSON.stringify({
      label: natterMyName,
      boundAt: primaryAt || new Date().toISOString(),
      relays: natterBindings,
    }, null, 2));
  }

  return Promise.resolve(done).then(function () {
    if (titleMoved && typeof api.nodeLabelChanged === 'function') api.nodeLabelChanged();
    natterPaintBind(api, relays);
  }).catch(function (e) {
    natterBindStatus('could not remember this binding: ' + (e && e.message));
  });
}

// A relay said yes — a claim went through, a rename was confirmed, or a
// probe found our row. `boundAt` survives a re-confirmation: it says when
// this node first took a seat here, and nothing later should overwrite
// that, the same way the relay never rewrites `claimedAt`.
function natterNoteBinding(api, relays, url, label) {
  var had = natterBindings[url];
  natterBindings[url] = {
    label: label,
    boundAt: (had && had.boundAt) || new Date().toISOString(),
    confirmedAt: new Date().toISOString(),
  };
  return natterSaveSession(api, relays);
}

// One seat gone, not the node. This is an owner purging a row, and it is
// only ever reached on COMPLETE evidence — see natterCheckBinding.
function natterDropBinding(api, relays, url) {
  if (!natterBindings[url]) return Promise.resolve();
  delete natterBindings[url];
  return natterSaveSession(api, relays);
}

// Claiming is what turns a first-run node into an ordinary one.
function natterBind(api, container, relays, url, label) {
  return natterNoteBinding(api, relays, url, label).then(function () {
    natterProbe(api, container, relays);
  });
}

// The stored label is only a question; the relay answers it.
//
// IT USED TO BE A SIGNED INBOX READ. `natterVerifyBinding` fetched
// `/api/hub/inbox?name=<label>` and treated anything but a 200 as "this
// label is not mine any more" — the relay verified the signature against
// the peer holding that label, so somebody else's name came back 403.
// That was never a READ: it was an authorization probe wearing a read's
// clothes, and R8 deleted the route under it on 2026-09-15.
//
// THE CENSUS ANSWERS IT BETTER, and was already on the wire. probe()
// above fetches a status per relay and, for any row this node holds,
// `/api/relay/who` alongside it — so the label this relay calls us by is
// a fact already in hand, thrown away until now (ownerBadge.claimedLabel).
//
// Better in three ways, none of them incidental:
//
//   NO SECOND REQUEST. One round of fetches answers the badge, the
//   member panel and this.
//   NO SIGNATURE. The census is public by design (decision 0010), so
//   nothing here puts a credential anywhere.
//   IT SAYS WHAT HAPPENED. A 403 could not tell "somebody else has this
//   name" from "the relay forgot me" from "I was removed". A label in
//   hand distinguishes them, and the message below says which.
//
// UNREACHABLE IS NOT THE SAME AS NOT OURS, which is the one rule the old
// version got right and is easy to lose here: a row with no answer
// carries no `claimedLabel` either, and must not unbind. So this acts on
// rows that ANSWERED and said we hold no label, and stays silent about
// the rest.
// ── THE BINDING IS A KEY, NOT A NAME (Andy, 2026-09-15) ──────────────
//
//   Andy: "checkbinding must be key-based... if i have a key"
//
// THIS CORRECTS THE VERSION ABOVE IT, which asked "does any relay still
// call me by my stored label?" and unbound when none did. That question
// was coherent while a label was how a peer was found. R4 ended it: the
// key is the identity, the label is a caption the key owns, and a peer
// may change its own caption whenever it likes.
//
// So the old reading had a branch for "somebody else is wearing the
// name" — and that branch cannot happen. `claimedLabel` is read off THIS
// NODE'S OWN ROW, matched by `p.publicKey === myKey` (ownerBadge.js,
// claimedLabelFrom). A label that differs from the cache is never a
// stranger; it is our own row wearing a caption the cache has not caught
// up with.
//
// IT COST A LIVE SESSION. A rename to `andyflinn` succeeded on spirit-3,
// the cache still said `andy`, and this concluded the name had been
// stolen — unbound the node, deleted session.json, and sent a shell that
// was correctly enrolled back to first run. The node's own successful
// rename looked exactly like theft.
//
// WHAT IS ASKED NOW: does a relay that answered hold a row for this key?
// That is `claimed` (or `owned`, which implies it). If yes, we are bound
// and the relay's caption is adopted. Only if every relay that answered
// holds no row for this key is the binding gone — which is what an owner
// purging a seat actually looks like.
//
// UNREACHABLE IS STILL NOT THE SAME AS NOT OURS, which the old version
// got right and is easy to lose: a relay that did not answer says
// nothing and must not unbind. `status > 0` is the test — NOT `!error`,
// because probe sets `error: 'no row here'` on a relay that answered
// perfectly well and simply has no row for us. That row is evidence, and
// filtering it out was throwing away the only thing that can prove an
// unbind.
function natterCheckBinding(api, relays, rows) {
  var asked = (rows || []).filter(function (row) { return row && row.url; });
  var answered = asked.filter(function (row) { return Number(row.status) > 0; });
  if (!answered.length) return; // nothing replied; nothing to conclude

  // DECIDED ON A COPY, COMMITTED ONCE. Mutating as we go and then
  // declining to save would leave the map and the file disagreeing,
  // which is the disease this whole change is treating.
  var next = Object.create(null);
  Object.keys(natterBindings).forEach(function (u) { next[u] = natterBindings[u]; });

  var now = new Date().toISOString();
  var moved = false;
  var adopted = '';

  answered.forEach(function (row) {
    var held = natterBindings[row.url];

    // ── A ROW FOR THIS KEY IS THE BINDING ────────────────────────────
    if (row.claimed || row.owned) {
      var label = row.claimedLabel || (held && held.label) || '';
      if (!label) return; // enrolled, but nothing said what we are called
      if (!held || held.label !== label) {
        if (held) adopted = label;
        moved = true;
      }
      // `confirmedAt` moves on every agreement, not only on a change:
      // "this relay said yes 4 seconds ago" and "said yes in September"
      // are different degrees of the same trust, and a field that only
      // updated when something moved could not tell them apart.
      next[row.url] = {
        label: label,
        boundAt: (held && held.boundAt) || now,
        confirmedAt: now,
      };
      return;
    }

    // ── THIS RELAY ANSWERED AND HOLDS NOTHING FOR THIS KEY ───────────
    //
    // Per-relay now, which is what makes it safe to act on: losing a
    // seat on one relay is not losing the node. The old rule deleted
    // session.json — every binding — on the word of whichever relays
    // happened to be reachable.
    if (held) {
      delete next[row.url];
      moved = true;
    }
  });

  // ── SILENCE IS NOT EVIDENCE, AND OFFLINE IS MOSTLY SILENCE ─────────
  //
  // A relay that did not answer keeps its entry untouched above, which
  // is the whole point of persisting them: the half-offline node no
  // longer has to be special-cased, because an unreachable relay simply
  // is not in `answered` and nothing is concluded about it.
  //
  // What remains is the FILE, which goes when the last entry does. That
  // is destructive and currently unrecoverable by hand, so it happens
  // only when every relay we were asked about answered. A node that is
  // entirely offline concluded nothing above and must not lose its file
  // for it.
  var left = Object.keys(next).length;
  if (!left && answered.length < asked.length) return;

  natterBindings = next;
  var was = natterMyName;
  natterSaveSession(api, relays);

  if (!left) {
    if (moved) natterBindStatus('no relay holds a row for this key — claim again');
  } else if (adopted && adopted !== was) {
    natterBindStatus('this relay now calls this node ' + adopted);
  }
}

spirit.shell.activateApp({
  mount: function (container, api) {
    var relays = natterLoadRelays(api);
    natterRelaysCache = relays;

    // ── WHAT THE RELAY SAYS, WITHOUT BEING ASKED ────────────────────
    //
    //   Andy: "there are events that the owner node should be notified
    //   of, no matter if natter is probing."
    //
    // Subscribed in mount, once per pane, so it keeps working while
    // somebody is in Chat or Files. The old acquire rode on natterProbe
    // and therefore only ran while this screen was open, which is the
    // half of "no matter if natter is probing" that was actually broken.
    //
    // The six kinds are registered in decision 0010 ("What the owner is
    // told"); this answers one of them and ignores the rest rather than
    // switching on all six, because the others change nothing this app
    // holds.
    if (api.onRelayEvent) {
      api.onRelayEvent(function (event) { natterOnClaim(api, event); });
    }
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
      // ── THE CLAIM FORM LEFT THIS FILE (2026-09-15) ─────────────────
      //
      //   Andy: "the never-bound-to-any-relay form that shows up if I'm
      //   truly not bound yet, it shows up in natter, instead of
      //   natterDetails for spirit.andyflinn.com"
      //
      // A claim happens ON a relay, and this form never said which. It
      // could not: hub.handleClaim used relays.json[0] whatever the
      // caller meant, and the comment that used to stand here admitted
      // as much — "a URL box would be a control whose every other value
      // is silently ignored". So the heading named row zero and hoped.
      //
      // Both halves are fixed together. handleClaim takes a url through
      // ownerBadge.chooseUrl like invite, rename and remove-peer already
      // did, and the form moved to the screen that IS one relay, where
      // it is the mirror of rename: every relay screen offers either
      // "you are X here" or "claim a seat here", and never both.
      //
      // What is left here is the sentence an unbound node needs, which
      // is not a form — it is a direction to the list below.
      '<div class="stat-tile wide" id="natter-bind-row">' +
        '<div class="panel-heading" id="natter-bind-heading"></div>' +
        '<div id="natter-bind-note"></div>' +
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

    // The bindings, one per relay, and the primary caption derived from
    // them. Read from this app's own file rather than through
    // api.nodeLabel: the shell's accessor answers "what is this node
    // called", which is one of the things in here, and this app is the
    // one that owns the file.
    natterLoadSession(api, relays);
    natterPaintBind(api, relays);
    natterRenderList(container, api, relays);
    // One call now. The binding check rides on the probe's own answer —
    // natterCheckBinding is called from inside it, on the rows it already
    // fetched.
    //
    natterProbe(api, container, relays);

    // THE CLAIM HANDLER STOOD HERE and went with the form it drove. It
    // is app/natterDetails/ndClaim now, where it can name the relay it
    // is aimed at — see the comment on the tile above.

    // ONE THING A ROW DOES. There were three branches here, answered in
    // a careful order because Invite, the device toggle and Remove all
    // sat INSIDE the row that opened — so each had to be caught before
    // it triggered the row. All three are on the mailbox's own screen
    // now, and a row has nothing on it to press but itself.
    // ── THE ADD BUTTON, WHICH HAD NO HANDLER AT ALL ──────────────────
    //
    // Found by Andy trying to add lab.andyflinn.com: he typed a label and
    // a URL, pressed Add, and nothing happened. Not a refusal — nothing.
    //
    // It was wired in the app's first commit (4107fe0) and lost in a
    // later refactor. Nobody noticed for a simple reason: the add row was
    // hidden whenever any relay was listed, and relays.json SHIPS with
    // spirit-3 in it — so the only node that could see this control was
    // one with an empty list, which is a state almost nobody reaches.
    //
    // Then this afternoon the row was shown to every unbound node, so
    // that somebody with their own relay could add it. That made a dead
    // button visible, which is how it was finally pressed.
    //
    // The lesson is the one this session keeps finding: a control nobody
    // can reach is a control nobody can test, and hiding it is not the
    // same as it working.
    document.getElementById('natter-add').addEventListener('click', function () {
      var labelInput = document.getElementById('natter-label');
      var urlInput = document.getElementById('natter-url');
      var label = labelInput.value.trim();
      var url = urlInput.value.trim().replace(/\/+$/, '');

      if (!label || !url) {
        natterStatus('both a label and a URL are required');
        return;
      }

      // THE SAME RULE THE WIRE ENFORCES, asked here so a typo costs no
      // round trip. hub.assertRelayUrl refuses anything but https, or
      // http to loopback for a lab relay — a node that added an http URL
      // to a public host would have a row it could never use.
      var ok = false;
      try {
        var target = new URL(url);
        var host = String(target.hostname || '').toLowerCase();
        var loopback = host === 'localhost' || host === '127.0.0.1' ||
          host === '::1' || host === '[::1]';
        ok = target.protocol === 'https:' || (target.protocol === 'http:' && loopback);
      } catch (e) { ok = false; }
      if (!ok) {
        natterStatus('a relay must be https — http is allowed only to 127.0.0.1');
        return;
      }

      if (relays.some(function (row) { return row && row.url === url; })) {
        natterStatus('that relay is already on the list');
        return;
      }

      // PUSHED, THEN SAVED, THEN POPPED IF THE SAVE FAILED. The list on
      // screen and the list on disk must not disagree, and the failure
      // path is the one that decides that.
      relays.push({ label: label, url: url });
      Promise.resolve(api.fs.saveFile(RELAYS_FILENAME, JSON.stringify(relays, null, 2) + '\n'))
        .then(function () {
          labelInput.value = '';
          urlInput.value = '';
          natterStatus('added — asking it now…');
          natterRelaysCache = relays;
          natterRenderList(container, api, relays);
          // Ask it straight away. A row that sat white until the next
          // visit would leave somebody wondering whether Add worked,
          // which is the question this whole comment is about.
          //
          // AND SAY WHAT CAME BACK. "asking it now…" with no end is the
          // same fault natterDetails had this morning — a progress line
          // that cannot finish looks identical to a hang, and the person
          // reading it has no way to tell which they are looking at.
          //
          // The three outcomes are the three the dot draws, said in
          // words, because a fresh row is exactly the moment somebody
          // does not yet know what the colours mean.
          return natterProbe(api, container, relays).then(function () {
            var badge = natterBadgeByUrl[url];
            if (!badge || !Number(badge.status)) {
              natterStatus('added, but it did not answer — check the address');
              return;
            }
            if (badge.owned || badge.claimed) {
              natterStatus('added, and you have a seat there');
              return;
            }
            // ANSWERED, AND YOU ARE NOT ON IT. The useful half: it is
            // reachable, so the next step is a claim rather than a
            // correction.
            natterStatus('added — it answered, and you have no seat yet. Open it to claim one.');
          });
        })
        .catch(function (err) {
          relays.pop();
          natterStatus('could not save: ' + ((err && err.message) || 'unknown'));
        });
    });

    container.querySelector('#natter-tbody').addEventListener('click', function (e) {
      var row = e.target.closest && e.target.closest('[data-row-url]');
      var rowUrl = row && row.getAttribute('data-row-url');
      if (!rowUrl) return;
      natterOpenRelay(api, container, relays, rowUrl);
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
