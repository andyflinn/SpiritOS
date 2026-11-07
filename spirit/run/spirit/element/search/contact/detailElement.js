// spirit/run/spirit/element/search/contact/detailElement.js
// One row of the contacts, as its own panel, opened over the list that
// mounted it (search/contact/rowElement.js, openDetails): it shows that
// row and nothing else, and the only way out is the panel's ✕, back to
// that list. Nothing is handed back: what it changes reaches every view
// on the stream.
//
// Why a panel and not the expanding row it replaces:
//
//   - the table keeps its shape. A six-fact bubble and a form inside a
//     colspan made the widest thing on the page live inside the narrowest,
//     which is what pushed Contacts off a portrait screen;
//   - one thing on screen. Reading somebody's numbers while their
//     neighbours are still listed above and below is what the row
//     expansion made you do.
//
// It writes nothing locally: every decision about a person is a verb of
// the node, asked through the api it is handed (options.api).

// ONE PANEL PER ROW (goal/G43.18; Andy: "now you need to give each contact row its own detail panel, similar to the concept
// where tabs in "agent" can hold the same ui for different rows"): everything below is one panel's own, made per create, its
// parts found inside its own box, so two people open side by side never share a screen.
function cdInstance(cdRoot) {
function cdById(id) { return cdRoot.querySelector('[id="' + id + '"]'); }
var cdEscapeHtml = spirit.escapeHtml;
var cdApi = null;

var cdKey = '';        // whose row this screen is
var cdPerson = null;   // the row itself, as contact.get answers it
var cdChanged = false; // has anything happened? Nothing reads it now: the list repaints from the stream

// Through the shell (AGENT.md, Comms). The verb is the argument; this app
// no longer knows an address.
function cdPost(verb, body) {
  return cdApi.verb(verb, body);
}

// ── A MESSAGE THAT SURVIVES THE REPAINT ──────────────────────────────
//
// `#cd-status` is written by cdRender as part of body.innerHTML, always
// empty — so every message this wrote was destroyed by the next repaint,
// and the failure path repaints. Andy: "i tried 3 times now to remove her
// seat, and failed WITHOUT ERROR MESSAGE."
//
// The relay had answered `no such peer` every time. The screen said
// nothing because the screen had already thrown the sentence away.
//
// Kept in a variable and drawn from it, like every other thing on this
// screen: a repaint redraws state, and a message is state until somebody
// has read it.
var cdMessage = '';

function cdStatus(text) {
  cdMessage = String(text || '');
  var el = cdById('cd-status');
  if (el) el.textContent = cdMessage;
}

// Re-fetched by key, never handed over in params.
//
// params carries the KEY and nothing else, on purpose. A row captured at
// launch would sit here going stale while you read it, and the numbers
// are the half most likely to move — a message arriving while this screen
// is open changes unanswered inbound. The key is the only part of a row
// that cannot change.
// THE STAR, AND WHAT IT MEANS (goal/G41.30; Andy: "NO signature. just the armingButton, with a precise documentation of the
// risk."; "the message is different for members and owners, showing members who they have to trust, and, if the relay
// claims to be mine, the message should be slightly different"). In every panel, at home only: on a face the node refuses
// contact.own anyway. What a relay says here is its own word: nothing it says sets the star.
var cdClaim = null;   // { owned, ownerLabel } of the relay shown, from relay.status
function cdRelayClaim() {
  cdClaim = null;
  return spirit.relay.status('').then(function (r) {
    ((r.body && r.body.rows) || []).forEach(function (row) {
      if (row && (row.key === cdKey || (row.roll && row.roll.relayKey === cdKey))) cdClaim = { owned: !!row.owned, ownerLabel: String(row.ownerLabel || '') };
    });
  }, function () { cdClaim = null; });
}
function cdStarWords() {
  var gives = '<b>What the star gives:</b> your face on this relay can run programs, read and change files, and change grants ' +
    'on this machine. That person and anyone holding this relay can do all of that as you, and so can anyone who reads your login mail.';
  var node = '<b>What the star gives:</b> this node\'s posts and streams reach you without asking, and it is never dropped from your list. ' +
    'It gives this node no way to run anything on this machine.';
  if (cdPerson.mine) return (cdPerson.relay ? gives : node) + ' <b>Taking the star away</b> ends that.';
  if (!cdPerson.relay) return node + ' Star only a node you set up yourself: its own card saying you own it proves nothing.';
  if (cdClaim && cdClaim.owned) return '<b>This relay says you own it.</b> Its word proves nothing. If you DID install this relay on a VPS and ' +
    'you DID set its DNS records, press this. If you did not, this relay is lying to you: do not press. ' + gives;
  var who = cdClaim && cdClaim.ownerLabel ? 'this relay says it is owned by ' + cdEscapeHtml(cdClaim.ownerLabel) : 'this relay does not say who owns it';
  return '<b>You do not own this relay:</b> ' + who + '. You would have to trust whoever runs it, and whoever can break into its ' +
    'machine, with this machine. ' + gives;
}
function cdStarBlock() {
  if (window.spirit && window.spirit.transport) return '';
  // No seat on a relay, no star to give (goal/G41.32, Q20; the node refuses it too); one already on can still come off.
  if (cdPerson.relay && !cdPerson.mine && !cdPerson.seated) return '';
  return '<div class="stat-tile wide"><div class="label">Star</div><div>' + cdStarWords() + '</div>' +
    '<div class="start-job-form card"><button type="button" class="cancel-btn" id="cd-own">' + (cdPerson.mine ? 'Take the star away' : 'Give it the star') + '</button></div></div>';
}
function cdStar() {
  return cdPost('contact.own', { key: cdKey, own: !cdPerson.mine }).then(function () { return cdLoad(); });
}

function cdLoad() {
  // ONE PERSON, BY KEY (puppets/G2): contact.get, where this used to read
  // the whole book to keep one row of it.
  return cdPost('contact.get', { key: cdKey })
    .then(function (r) { return JSON.parse(r.text); })
    .then(function (data) {
      cdPerson = (data && data.ok && data.person) || null;
      return cdPerson && cdPerson.relay ? cdRelayClaim() : null;
    })
    .then(function () { cdRender(); })
    .catch(function (e) { cdStatus('could not read the book: ' + e.message); });
}

// The titlebar says WHOSE row this is, because the panel's own name
// ("Contact") is the least useful word available on a screen that only
// ever shows one person. The mark comes with it: a screen about somebody
// refused should say so where you are already looking.
function cdTitle() {
  if (!cdPerson) return 'Contact';
  var mark = cdPerson.blocked ? '❌' + ' ' : '';
  var name = cdPerson.publicLabel || '';
  var mine = cdPerson.myLabel || '';
  if (mine && name && mine !== name) return mark + name + ' (' + mine + ')';
  // No key's tail stands in for a name (Andy, 2026-10-24, goal/G40.1).
  return mark + (mine || name || '(no name)');
}

// No focus guard, and that is no oversight. This panel is never
// repainted by a tick, so the only repaints are the ones this file asks
// for: a load, and a decision. There is no two-second repaint left to
// destroy the field somebody is typing in.
// THE "OBVIOUS DUD" BUBBLE AND THE "LOCKED TO RELAYS I OWN" FOLD STOOD
// HERE (2026-09-19). Both were drawn from facts a roster sweep wrote —
// `missingSince` (a key on no roll) and `memberOf` (seats on relays I
// own) — and no relay may return a roster any more. Andy: "relays only
// provide one way to find nodes or relays: SEARCH. What is not found
// cannot influence decisions." A contact that went stale is simply stale:
// "email addresses change, contacts go stale. Deal with it."

// THE ARE-YOU-SURE IS THE SHELL'S (goal/G41.9): Block and Forget are armingButtons, attached after every draw. The
// element arms, puts the button back the moment attention moves (Andy: "whenever i click anywhere else on the screen
// the button must reset, back to its original state, and the whole are-you-sure procedure must be done from scratch"),
// and keeps one armed at a time; this screen says only what each says and what its second press does.
function cdArming(id, label, armedLabel, run) {
  var button = cdById(id);
  var E = window.spirit && window.spirit.element && window.spirit.element.armingButton;
  if (!button || !E) return;
  E.attach(button, { label: label, armedLabel: armedLabel, run: run, api: cdApi });
}

// Two presses. Blocking is the one decision here that stops mail
// arriving, and the button sits at the end of a row you may have
// been tabbing along.
function cdBlock() {
  return cdPeerAction('block');
}

// THE SCREEN GOES WITH THE ROW. Every other action here repaints
// the person; this one removed them, so there is nobody left to
// paint and staying would be a screen about a contact that is not
// one. The panel closes, back to the list, where the change is visible.
// ONLY THE ROW (goal/G43.17; Andy: ""forget" a contact means only: delete that row from my contacts. it does NOT mean:
// "eject them from relays i own", not at all. not the same scope of decision."). A seat on a relay you own is the
// relay's, and is not touched here.
function cdForget() {
  return cdPeerAction('forget').then(function (ok) {
    if (ok) { cdChanged = true; cdApi.closeDialog(); }
  });
}

function cdRender() {
  var body = cdById('cd-body');
  if (!body) return;

  if (cdApi) cdApi.setScreenTitle(cdTitle());

  // THE PADLOCK ON THE BAR is gone with the seats it stood for. Cleared on
  // every render all the same, where the api handed still has the call.
  if (cdApi && cdApi.setScreenMark) cdApi.setScreenMark('', '');

  if (!cdPerson) {
    // The row went away while this screen was open — blocked from
    // somewhere else, or a book edited by hand. Say so rather than
    // drawing an empty panel that looks like a load that never finished.
    body.innerHTML = '<div class="stat-tile wide">' +
      '<div class="job-log-empty">That contact is no longer in the book.</div>' +
      '</div>';
    return;
  }

  // Andy's order: who they are, then what they cost. The three verbs that
  // answer the second half are the buttons underneath — accept, block,
  // and leaving them where they are.
  //
  // NO COUNTERS (goal/G43.14; Andy: "KILL those fields in shadow-roll, KILL the functionality, KILL it!"): unanswered inbound
  // and the two rates went, even for a row that still carries them.
  var facts = spirit.shell.factRow([
    ['Public Handle', cdPerson.publicLabel || '(none)'],
    ['My Label', cdPerson.myLabel || '(none)'],
    ['Storage', spirit.formatBytes(cdPerson.bytesHeld || 0)],
  ]);

  // Accept is offered only to somebody waiting, Unblock only to somebody
  // refused: the buttons are how the two states are told apart, which is
  // exactly how the chat strip and the old row panel did it.
  var buttons = '';
  if (cdPerson.blocked) {
    buttons = '<button type="button" class="cancel-btn" id="cd-unblock">Unblock</button>';
  } else {
    // Somebody not kept, a person a search found, can be added (goal/G43.17; Andy: "those contacts CAN be added").
    if (!cdPerson.keep && !cdPerson.mine) {
      buttons += '<button type="button" class="cancel-btn" id="cd-accept">Accept</button>';
    }
    buttons += '<button type="button" class="cancel-btn" id="cd-block">Block</button>';
  }

  // ── AND FORGETTING, WHICH IS OFFERED TO EVERYBODY ─────────────────
  //
  //   Andy: "i also have no method of removing sonny from my contacts so
  //   i could re-test easily."
  //
  // There was none. Block silences a row and KEEPS it, which is right for
  // "not from this person" and has never been an answer to "I added the
  // wrong one".
  //
  // OFFERED IN BOTH STATES, unlike Accept and Unblock, because it is not
  // about the relationship: it is about this node's own book. A blocked
  // person can be forgotten without being unblocked — the node's forget
  // (spirit/contacts.js) downgrades that row rather than deleting it, or the block would evaporate and
  // they would be readmitted the moment they wrote.
  //
  // Two presses, for the same reason Block has two: it is at the end of a
  // row somebody may have been tabbing along, and it throws away what they
  // wrote — myLabel is theirs and is not on any relay to be recovered from.
  buttons += '<button type="button" class="cancel-btn" id="cd-forget">Forget</button>';

  var handle = cdPerson.publicLabel || '';
  var caption = handle ? 'Change My Label for ' + cdEscapeHtml(handle) : 'Change My Label';

  body.innerHTML =
    '<div class="stat-tile wide">' +
      facts +
      // The caption and its input take the width and the buttons fill the
      // end; align-items:flex-end on the row is what lines a button up
      // with the input rather than with the caption above it.
      '<div class="start-job-form card">' +
        '<label class="field-label grow">' + caption +
          '<input type="text" id="cd-label-input"' +
          ' value="' + cdEscapeHtml(cdPerson.myLabel || '') + '"' +
          ' placeholder="' + cdEscapeHtml(cdPerson.publicLabel || '') + '">' +
        '</label>' +
        buttons +
      '</div>' +
    '</div>' +
    cdStarBlock() +
    '<div class="job-manifest-note" id="cd-status">' +
      cdEscapeHtml(cdMessage) + '</div>';

  cdArming('cd-block', 'Block', 'Block — press again', cdBlock);
  cdArming('cd-forget', 'Forget', 'Forget — press again', cdForget);
  cdArming('cd-own', cdPerson.mine ? 'Take the star away' : 'Give it the star', cdPerson.mine ? 'Take the star away — press again' : 'Give it the star: I accept this risk — press again', cdStar);
}

// Everything this screen decides is a hub verb. Nothing is written to
// disk here, and nothing about the person is kept: the node's contacts are the book.
// THE ACTION IS THE VERB, and since 2026-09-15 it is spelled as one.
// This built `{ action: 'block' }` and posted it to a route that was
// itself a verb, so hub.js had to dispatch the field by hand. Now the
// door does it, `cdPeerAction('block')` names `contact.block`, and the
// only thing that changed on this screen is which string it says.
// cdSeats, cdSeatTitle AND cdSeatNames STOOD HERE, reading `memberOf` off
// the row — gone with it (2026-09-19).


function cdPeerAction(action, extra) {
  var body = { publicKey: cdKey };
  Object.keys(extra || {}).forEach(function (k) { body[k] = extra[k]; });
  return cdPost('contact.' + action, body).then(function (r) {
    if (r.status !== 200) {
      cdStatus(action + ' failed: ' + r.status + ' ' + r.text);
      return false;
    }
    cdStatus('');
    // Marked, though nothing reads it now: the list behind this panel
    // repaints from the stream.
    cdChanged = true;
    return cdLoad().then(function () { return true; });
  });
}

var cdPage = ({
  // Once per panel, from create. Everything about WHO this screen is
  // showing belongs in open() — see below.
  mount: function (container, api) {
    cdApi = api;
    container.innerHTML = '<div id="cd-body" class="stack"></div>';

    // Delegated, because the panel is repainted after every decision and
    // a handler bound to a button would go with it.
    cdById('cd-body').addEventListener('click', function (event) {
      var id = event.target && event.target.id;
      // Block and Forget are not here: each is an armingButton (cdArming).
      if (id === 'cd-accept') { cdPeerAction('accept'); return; }
      if (id === 'cd-unblock') { cdPeerAction('unblock'); return; }
    });

    cdById('cd-body').addEventListener('change', function (event) {
      if (!event.target || event.target.id !== 'cd-label-input') return;
      var typed = event.target.value.trim();
      // Checked here before anything is asked, by the same rule the node
      // checks again (spirit/fieldRules.js; Andy, goal/G4.16: "the shell may
      // as well rule that inputs themselves implement constraints in
      // fieldRules.js"). Empty clears your name for them, and is asked.
      var rule = (typeof window !== 'undefined' && window.spirit && window.spirit.fieldRules) || null;
      var bad = (typed && rule) ? rule.problem(typed) : '';
      if (bad) { cdStatus(bad); return; }
      cdPeerAction('label', { myLabel: typed });
    });

  },

  // Called by create, right after mount, with the key: this is where the
  // subject arrives, and where everything about a last subject would be
  // let go of. Each panel is one person's (cdInstance), so a half-armed
  // Block never carries over to another; the load redraws the buttons
  // and attaches new ones all the same.
  open: function (params) {
    cdKey = (params && params.key) || '';
    cdPerson = null;
    cdChanged = false;
    cdLoad();
  },

});
return cdPage;
}
// The armingButton it draws Block and Forget with, it loads itself (goal/G41.3), through spirit.require.
if (window.spirit && window.spirit.require) window.spirit.require('spirit/element/armingButton.js');
// A PANEL, NO APP (goal/G40.8; Andy: "natterDetails and contactDetails will become standard intrinsic shell elements"; since
// goal/G43.18 no page on the navigation: "the details of relays and contacts ... taking over the screen new-style"): the
// contact row opens it over its list as a layer, its title and ✕ the layer's, its api the shell's (spirit.shell.pageApi);
// nothing is handed back (what it changes reaches every view on the stream).
// AND THE SHELL'S ELEMENT SHAPE (goal/G41.19, box v23: "every element gets a container and appends itself"):
// create(container, options) draws the same screen into the container, options { api, key }.
// ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18; Andy: "contactDetails.js should really be
// spirit/run/spirit/element/search/contact/detailElement.js"): merged into, so the parts of search/contact/ load in any order.
Object.assign(['search', 'contact', 'detailElement'].reduce(function (o, k) { return (o[k] = o[k] || {}); }, (window.spirit.element = window.spirit.element || {})), {
  create: function (container, options) {
    var o = options || {};
    var done = { destroy: function () { container.innerHTML = ''; } };
    // UNCONFIGURED, IT SAYS SO and throws nothing (box v23: "no throw even unconfigured").
    if (!o.api || !o.key) {
      var note = document.createElement('div');
      note.className = 'job-manifest-note';
      note.textContent = 'not configured: no contact named';
      container.appendChild(note);
      return done;
    }
    var page = cdInstance(container);
    page.mount(container, o.api);
    page.open(o);
    return done;
  },
  // NO open OF ITS OWN (goal/G43.18): it opens as a panel over what mounted its list (search/contact/rowElement.js, openDetails),
  // never as a page on the navigation.
});
