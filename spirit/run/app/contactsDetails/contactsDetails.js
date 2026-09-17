// One row of the address book, as its own screen.
//
// The first DIALOG (Andy). A dialog is a hidden app a table pushes for
// one row: it shows that row and nothing else, it cannot launch anything,
// and the only way out is back to the table it came from. What it wants
// to happen elsewhere it RETURNS, and the app underneath acts on it.
//
// Why a screen and not the expanding row it replaces:
//
//   - the table keeps its shape. A six-fact bubble and a form inside a
//     colspan made the widest thing on the page live inside the narrowest,
//     which is what pushed Contacts off a portrait screen;
//   - the table keeps its scroll. Panes are hidden and never destroyed,
//     so the list is exactly where it was when you come back — which is
//     the reason this is a separate app id and not a second view of
//     Contacts, whose one pane would have been rebuilt;
//   - one thing on screen. Reading somebody's numbers while their
//     neighbours are still listed above and below is what the row
//     expansion made you do.
//
// A sibling folder, not a child: discovery is flat and stays flat
// (app/<name>/<name>.js). The cost is that api.fs here is scoped to
// app/contactsDetails/ — NOT to Contacts' folder — so this app writes
// nothing locally. It does not need to: every decision about a person is
// a hub verb, and the one file Contacts keeps (prefs.json, the stranger
// policy) belongs to the list rather than to any row.

var cdEscapeHtml = spirit.core.util.escapeHtml;
var cdIcon = spirit.core.const.ICON;
var cdApi = null;

var cdKey = '';        // whose row this screen is
var cdPerson = null;   // the row itself, as buildPeople hands it over
var cdChanged = false; // has anything happened that the table must repaint for?
var cdBlockArmed = false;
var cdForgetArmed = false;

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
  var el = document.getElementById('cd-status');
  if (el) el.textContent = cdMessage;
}

// Re-fetched by key, never handed over in params.
//
// params carries the KEY and nothing else, on purpose. A row captured at
// launch would sit here going stale while you read it, and the numbers
// are the half most likely to move — a message arriving while this screen
// is open changes unanswered inbound. The key is the only part of a row
// that cannot change.
function cdLoad() {
  return cdPost('peer.list', null)
    .then(function (r) { return JSON.parse(r.text); })
    .then(function (data) {
      var people = (data && data.people) || [];
      cdPerson = people.filter(function (p) { return p.publicKey === cdKey; })[0] || null;
      cdRender();
    })
    .catch(function (e) { cdStatus('could not read the book: ' + e.message); });
}

// A rate is messages per day across peerStats' window, to one decimal,
// with the unit riding along. Same reading the table's own panel gave
// before this screen took it over.
function cdRate(perDay) {
  var n = Number(perDay);
  if (!isFinite(n) || n < 0) n = 0;
  return n.toFixed(1) + ' / day';
}

// The titlebar says WHOSE row this is, because the app's own name
// ("Contact") is the least useful word available on a screen that only
// ever shows one person. The mark comes with it: a screen about somebody
// refused should say so where you are already looking.
function cdTitle() {
  if (!cdPerson) return 'Contact';
  var mark = cdPerson.blocked ? cdIcon.NO + ' '
    : cdPerson.held ? cdIcon.WAITING + ' '
    : '';
  var name = cdPerson.publicLabel || '';
  var mine = cdPerson.myLabel || '';
  if (mine && name && mine !== name) return mark + name + ' (' + mine + ')';
  return mark + (mine || name || ('…' + (cdPerson.tail || '')));
}

// No focus guard, and that is the shell's doing rather than an oversight.
// A dialog is never driven by the job tick (switchTo, renderActive), so
// the only repaints are the ones this file asks for: a load, and a
// decision. There is no two-second repaint left to destroy the field
// somebody is typing in — which is exactly what it used to do, and what
// every table in the shell still needs a guard against.
// ── AN OBVIOUS DUD, AND WHY ──────────────────────────────────────────
//
//   Andy: "show a warning bubble at the top of contact details if the
//   contact is an obvious dud... the bubble will show the reason."
//
// The node decides it, on a sweep that already probes every relay this
// node is on (hub.reconcileOrphans): a key that EVERY relay ANSWERED
// about and none of them listed. A relay that did not answer says
// nothing about anybody, which is why a rebooting box does not paint a
// book full of warnings.
//
// AT THE TOP, before the facts, because it changes what the facts mean.
// "Unanswered inbound: 0" reads as a quiet contact until you know there
// is nobody on the other end of it.
//
// THE REASON, NOT THE VERDICT. "This contact is dead" is a claim this
// screen cannot support; what it can support is the observation the
// verdict was made from, and a person who knows their own network reads
// far more out of it than a label would give them.
//
// "FIRST NOTICED", NEVER "WENT". Nothing watched before there was a
// field to watch with, so the date is when this node first CONCLUDED the
// key was missing — which for every row in an existing book is the day
// this shipped. Saying "gone since" would be inventing a history.
function cdDudBubble() {
  var since = (cdPerson && cdPerson.missingSince) || '';
  if (!since) return '';

  var when = '';
  try {
    var d = new Date(since);
    if (!isNaN(d.getTime())) when = d.toISOString().slice(0, 10);
  } catch (e) { when = ''; }

  return '<div class="stat-tile wide cd-dud">' +
    '<div>' + cdIcon.WARNING + ' <strong>No relay you are on lists this key.</strong></div>' +
    '<div class="job-manifest-note">' +
      'Every relay you are on answered, and none of them has a row for this ' +
      'contact — so this is not a connection problem. Either they left, or ' +
      'the relay you met them on is gone.' +
      (when ? ' First noticed ' + cdEscapeHtml(when) + '.' : '') +
      ' Nothing has been deleted: the name you gave them is yours and is on ' +
      'no relay to be recovered from, so Forget stays a decision you make.' +
    '</div>' +
    '</div>';
}

// ── WHAT THE LOCK IS, SPELLED OUT ────────────────────────────────────
//
//   Andy: "for those locked contacts display a foldable bubble containing
//   a list of the relays that cause the locked status.... Title: Locked
//   to relays I own." — and, on the mark for it: "ICON.INFO".
//
// INFO AND NOT A WARNING, which is the difference between this and the
// bubble above it. A dud is something wrong; this is a fact about a box
// you keep, and one you arranged on purpose. The two must not wear the
// same face or the warning stops meaning anything.
//
// FOLDED SHUT, so it costs a line. The mark in the titlebar is the
// question — "why does this screen have a padlock on it" — and this is
// the answer, available without being in the way. Somebody who already
// knows never opens it.
//
// THE RELAYS ARE THE CONTENT, because they are what Forget will have to
// remove, one by one, and a person deciding whether to press it needs to
// see how many that is.
function cdLockedFold() {
  var seats = cdSeats();
  if (!seats.length) return '';

  return '<details class="stat-tile wide cd-locked">' +
    '<summary>' + cdIcon.INFO + ' Locked to relays I own</summary>' +
    '<div class="job-manifest-note">' +
      'They hold a seat on ' + (seats.length === 1 ? 'this relay' : 'these relays') +
      ', so this contact was created for you and cannot simply be ' +
      'forgotten. Forget removes the ' +
      (seats.length === 1 ? 'seat' : 'seats') + ' as well, and says so before it does.' +
    '</div>' +
    '<ul class="cd-seat-list">' +
      seats.map(function (url) {
        return '<li>' + cdEscapeHtml(String(url).replace(/^https?:\/\//, '')) + '</li>';
      }).join('') +
    '</ul>' +
    '</details>';
}

// ── PUTTING THE SCREEN BACK ──────────────────────────────────────────
//
//   Andy: "whenever i click anywhere else on the screen the button must
//   reset, back to its original state, and the whole are-you-sure
//   procedure must be done from scratch."
//
// Handed to the shell at the moment either button arms. It calls this on
// the next click anywhere that is not the one being handled — so an armed
// Block or Forget cannot survive a person's attention moving.
//
// HARMLESS TWICE, which the shell requires: the confirming press runs the
// handler first, which clears the flag itself, and this then repaints a
// screen that is already right.
function cdDisarm() {
  if (!cdBlockArmed && !cdForgetArmed) return;
  cdBlockArmed = false;
  cdForgetArmed = false;
  cdRender();
}

function cdRender() {
  var body = document.getElementById('cd-body');
  if (!body) return;

  if (cdApi) cdApi.setScreenTitle(cdTitle());

  // ── AND A PADLOCK ON THE BAR ────────────────────────────────────────
  //
  //   Andy: "if contact has slot on any of my relays: after the label of
  //   the contact in the title bar display a ICON.LOCKED in the same size
  //   as the back and home icons."
  //
  // AFTER setScreenTitle, always: that call writes textContent, which
  // wipes every child of the bar — so a mark set before it would be gone
  // by the time anybody saw it.
  //
  // CLEARED WHEN THERE IS NO SEAT, and that is not tidiness: this screen
  // is reused for every contact, so a mark left on would tell the truth
  // about the last person and a lie about this one.
  if (cdApi && cdApi.setScreenMark) {
    cdApi.setScreenMark(
      cdSeats().length ? cdIcon.LOCKED : '',
      cdSeats().length ? cdSeatTitle() : ''
    );
  }

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
  // Rates are per day over peerStats' 14-day window, not lifetime: a
  // lifetime total only ever grows, so it ranks contacts by how long they
  // have been in the book, which is the opposite of the question.
  var facts = spirit.shell.factRow([
    ['Public Handle', cdPerson.publicLabel || '(none)'],
    ['My Label', cdPerson.myLabel || '(none)'],
    ['Unanswered inbound', String(cdPerson.unansweredInbound || 0)],
    ['Inbound rate', cdRate(cdPerson.inboundPerDay)],
    ['Outbound rate', cdRate(cdPerson.outboundPerDay)],
    ['Storage', spirit.core.util.formatBytes(cdPerson.bytesHeld || 0)],
  ]);

  // Accept is offered only to somebody waiting, Unblock only to somebody
  // refused: the buttons are how the two states are told apart, which is
  // exactly how the chat strip and the old row panel did it.
  var buttons = '';
  if (cdPerson.blocked) {
    buttons = '<button type="button" class="cancel-btn" id="cd-unblock">Unblock</button>';
  } else {
    if (cdPerson.held) {
      buttons += '<button type="button" class="cancel-btn" id="cd-accept">Accept</button>';
    }
    buttons += '<button type="button" class="cancel-btn" id="cd-block">' +
      (cdBlockArmed ? 'Block — press again' : 'Block') + '</button>';
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
  // person can be forgotten without being unblocked — whoBook downgrades
  // that row rather than deleting it, or the block would evaporate and
  // they would be readmitted the moment they wrote.
  //
  // Two presses, for the same reason Block has two: it is at the end of a
  // row somebody may have been tabbing along, and it throws away what they
  // wrote — myLabel is theirs and is not on any relay to be recovered from.
  // ── AND WHAT IT COSTS, WHEN THEY SIT ON A RELAY OF MINE ──────────
  //
  //   Andy: "undeletable until i agree to also remove their relay slots."
  //
  // Not a refusal with no way forward: the second press is the agreement.
  // A member cannot be forgotten while they hold the seat, so Forget here
  // means BOTH — evict, then forget — and the button has to say so before
  // it is pressed rather than after.
  //
  // The relays are named. "Remove their seat" is not answerable without
  // knowing from where, and one person may be seated on several of mine.
  var seats = cdSeats();
  buttons += '<button type="button" class="cancel-btn" id="cd-forget">' +
    (cdForgetArmed
      ? (seats.length
        ? 'Remove their seat on ' + cdEscapeHtml(cdSeatNames()) + ' and forget — press again'
        : 'Forget — press again')
      : 'Forget') + '</button>';

  var handle = cdPerson.publicLabel || '';
  var caption = handle ? 'Change My Label for ' + cdEscapeHtml(handle) : 'Change My Label';

  body.innerHTML =
    // BEFORE THE PANEL, not inside it: the warning is about whether this
    // screen is worth reading, so it is not one of the things on it.
    cdDudBubble() +
    // Then the lock, which is the same kind of statement — about the
    // screen rather than on it — and is why the titlebar has a padlock.
    // Under the warning, because a warning outranks an explanation.
    cdLockedFold() +
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
    '<div class="job-manifest-note" id="cd-status">' +
      cdEscapeHtml(cdMessage) + '</div>';
}

// Everything this screen decides is a hub verb. Nothing is written to
// disk here, and nothing about the person is kept: whoBook is the book.
// THE ACTION IS THE VERB, and since 2026-09-15 it is spelled as one.
// This built `{ action: 'block' }` and posted it to a route that was
// itself a verb, so hub.js had to dispatch the field by hand. Now the
// door does it, `cdPeerAction('block')` names `contact.block`, and the
// only thing that changed on this screen is which string it says.
// ── THE SEATS THIS PERSON HOLDS ON RELAYS I OWN ──────────────────────
//
// Sent on the row by the node (hub.buildPeople, `memberOf`) — a standing
// fact rather than a lookup, so this screen never has to ask whether the
// person can be forgotten. The node refuses that on the same field.
function cdSeats() {
  var list = cdPerson && cdPerson.memberOf;
  return Array.isArray(list) ? list : [];
}

// What the padlock says when you hover it. The relays, because that is
// what Forget will have to name.
function cdSeatTitle() {
  var on = cdSeatNames();
  return cdSeats().length === 1
    ? 'They hold a seat on ' + on + ', so Forget removes it too'
    : 'They hold seats on ' + on + ', so Forget removes them too';
}

function cdSeatNames() {
  return cdSeats().map(function (u) {
    return String(u).replace(/^https?:\/\//, '');
  }).join(', ');
}

// ── GIVING UP THE SEATS, WHICH MUST HAPPEN FIRST ─────────────────────
//
// Evict, then forget. The other order strands a row: a forget that
// succeeded followed by an eviction that failed would leave somebody
// seated on the relay with no record of them here, and the next sweep
// would put the contact straight back — so the screen would have appeared
// to do something it had not.
//
// ONE AT A TIME rather than in parallel, because a failure has to stop
// the rest: if the second relay refuses, the first eviction has already
// happened and is true, but nothing is forgotten and the person can see
// exactly where it got to.
//
// THE RELAY'S KEY COMES FROM relay.status, asked once and only here. A
// relay is addressed by key like any other peer (removePeer rides the
// ordinary post, natterDetails does the same), and the census carries the
// key — so no new verb, and no cost at all for anybody who never presses
// this.
function cdReleaseSeats() {
  var seats = cdSeats();
  if (!seats.length) return Promise.resolve(true);

  cdStatus('removing their seat\u2026');
  return cdPost('relay.status', {}).then(function (r) {
    var rows = (r.body && r.body.rows) || [];
    var keyFor = Object.create(null);
    rows.forEach(function (row) {
      if (row && row.url && row.census && row.census.relayKey) {
        keyFor[row.url] = row.census.relayKey;
      }
    });

    return seats.reduce(function (chain, url) {
      return chain.then(function (carryOn) {
        if (!carryOn) return false;
        var relayKey = keyFor[url];
        if (!relayKey) {
          cdStatus(url + ' has not said what its key is, so the seat cannot be removed');
          return false;
        }
        return cdApi.peerPost('relay', relayKey, { removePeer: { key: cdKey } })
          .then(function (out) {
            var said = out && out.body;
            if (out && out.ok && (!said || said.ok !== false)) return true;

            // ── ALREADY GONE IS NOT A FAILURE ────────────────────────
            //
            // `no such peer` means the relay holds no row for this key —
            // which is the state this was trying to reach. Treating it as
            // a refusal left the contact permanently unforgettable
            // whenever the seat had been removed some other way, and the
            // node's own `memberOf` had not caught up.
            //
            // The catching-up is fixed too (hub.statusFor reconciles on
            // every probe now), but this has to be right on its own: the
            // two screens race, and the one holding the button should not
            // depend on winning.
            var why = String((said && said.error) || (out && out.error) || '');
            if (/no such peer/i.test(why) || (said && said.status === 404)) return true;

            cdStatus('could not remove their seat on ' + url + ': ' +
              (why || 'no answer'));
            return false;
          });
      });
    }, Promise.resolve(true));
  }).catch(function (e) {
    cdStatus('could not reach your relays: ' + String((e && e.message) || e));
    return false;
  });
}

function cdPeerAction(action, extra) {
  var body = { publicKey: cdKey };
  Object.keys(extra || {}).forEach(function (k) { body[k] = extra[k]; });
  return cdPost('contact.' + action, body).then(function (r) {
    if (r.status !== 200) {
      cdStatus(action + ' failed: ' + r.status + ' ' + r.text);
      return false;
    }
    cdStatus('');
    // The table behind this screen paints from a list it fetched before
    // this screen existed, so it has to be told. Said NOW rather than on
    // the way out, because the way out is Back and Back is the shell's.
    cdChanged = true;
    if (cdApi) cdApi.setDialogResult({ changed: true, key: cdKey });
    return cdLoad().then(function () { return true; });
  });
}

spirit.shell.activateApp({
  // Once per pane, ever. Everything about WHO this screen is showing
  // belongs in open(), which runs on every call — see below.
  mount: function (container, api) {
    cdApi = api;
    container.innerHTML = '<div id="cd-body" class="stack"></div>';

    // Delegated, because the panel is repainted after every decision and
    // a handler bound to a button would go with it.
    document.getElementById('cd-body').addEventListener('click', function (event) {
      var id = event.target && event.target.id;
      if (id === 'cd-accept') { cdBlockArmed = cdForgetArmed = false; cdPeerAction('accept'); return; }
      if (id === 'cd-unblock') { cdBlockArmed = cdForgetArmed = false; cdPeerAction('unblock'); return; }
      if (id === 'cd-forget') {
        if (!cdForgetArmed) {
          // ONE LOADED BUTTON AT A TIME. Two on a screen is the same
          // trap twice, and the shell cannot do this part: the click
          // that arms this one is the click it is told to ignore, so
          // the other button's disarm never fires. The pairing is this
          // screen's own knowledge.
          cdBlockArmed = false;
          cdForgetArmed = true;
          if (cdApi.armUntilElsewhere) cdApi.armUntilElsewhere(cdDisarm);
          cdRender();
          return;
        }
        cdForgetArmed = false;
        // THE SCREEN GOES WITH THE ROW. Every other action here repaints
        // the person; this one removed them, so there is nobody left to
        // paint and staying would be a screen about a contact that is not
        // one. Back to the book, which is where the change is visible.
        // Seats first, and the forget only if every one of them went.
        // A member the node still believes is seated is refused by the
        // node anyway (hub, contact.forget) — this is the agreement that
        // makes the refusal answerable, not a way around it.
        cdReleaseSeats().then(function (released) {
          if (!released) { cdRender(); return; }
          return cdPeerAction('forget').then(function (ok) {
            if (ok) { cdChanged = true; cdApi.closeDialog({ changed: true }); }
          });
        });
        return;
      }
      if (id === 'cd-block') {
        cdForgetArmed = false;
        // Two presses. Blocking is the one decision here that stops mail
        // arriving, and the button sits at the end of a row you may have
        // been tabbing along.
        if (!cdBlockArmed) {
          cdForgetArmed = false;   // see the note on Forget, above
          cdBlockArmed = true;
          if (cdApi.armUntilElsewhere) cdApi.armUntilElsewhere(cdDisarm);
          cdRender();
          return;
        }
        cdBlockArmed = false;
        cdPeerAction('block');
      }
    });

    document.getElementById('cd-body').addEventListener('change', function (event) {
      if (!event.target || event.target.id !== 'cd-label-input') return;
      cdPeerAction('label', { myLabel: event.target.value.trim() });
    });

  },

  // Every call, mounted or not — the shell guarantees it (switchTo). So
  // this is where the subject arrives, and where everything about the
  // last subject has to be let go of.
  //
  // The shell can promise that open() runs; it cannot know what is stale
  // inside. A half-armed Block is the example: two presses must mean two
  // presses about the SAME person, so arming it for bert and then
  // opening carol has to disarm.
  open: function (params) {
    cdKey = (params && params.key) || '';
    cdPerson = null;
    cdChanged = false;
    cdBlockArmed = false;
    cdLoad();
  },

});
