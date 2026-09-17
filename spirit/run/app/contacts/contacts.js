// The address book, which used to be three panels inside Relay Chat
// (packet 2, ARCHITECTURAL-CONCERNS.md). whoBook is still the store and
// the hub still owns every verb; what moved is the view.
//
// Chat is one app that reads this list. Chess will be another, and a
// contact card arriving as a packet will be a third — none of which are
// reasons to open a chat window. RC keeps the To dropdown and nothing
// else: no adding, no accepting, no blocking, no relabelling.
//
// Everything here goes through the hub's own routes, the same ones the
// chat window called:
//
//   peer.list       the address book, captioned by this node
//   peer.find       every key the mailbox carries under a word
//   peer.acquire    confirm one of those keys (acquiredVia handle)
//   contact.accept .block .unblock .label     what this node keeps
//   contact.senders .setSenders               and who it listens to
//
// All six at one door, /api/spirit, with the verb in the body. `peer.*`
// asks the relay and can fail because this box is offline; `contact.*`
// is this disk and cannot.
//
// No packets. Sharing a contact is a later sitting and a bigger
// question: a card that arrives from somebody else is their six
// characters, not yours.

var contactsEscapeHtml = spirit.core.util.escapeHtml;
var contactsIcon = spirit.core.const.ICON;
var contactsApi = null;

// What this node does with mail from somebody it has not added. It moved
// here from Relay Chat (Andy): the question is what to do about a person
// who is not in the address book, and this app is the address book.
// Adding, accepting and renaming came over in packet 2; this was the
// piece that stayed behind, and beside a chat thread it read as a setting
// about chat rather than about people.
//
// The hub is where it is APPLIED — a dropped message never reaches the
// browser at all (js/hub.js, unknownPolicy) — and since 2026-09-12 it is
// also where it is HELD. It used to travel as a query parameter from
// whoever polled the inbox, then as this app's own file; the open
// question in both arrangements was whether the node should read it
// itself rather than trust a caller, and the answer turned out to be
// that the node should OWN it. This app draws the control and asks.
// NO FILE HERE ANY MORE. It was app/contacts/prefs.json, and before that
// app/relayChat/prefs.json — it has now moved twice between apps, which
// was the tell that it belonged to neither. It is preferences.json on the
// node, reached through `contact.senders`, and this app no longer stores
// it at all.
//
// The old files are not read here either: hub.js honours
// app/contacts/prefs.json when preferences.json says nothing, so the
// migration happens once, on the node, where the value now lives.
var CONTACTS_UNKNOWN_CHOICES = ['silent', 'hold', 'acquire'];
var contactsPrefs = { unknown: 'silent' };

// A short name to choose by, and a sentence saying what it costs. The
// name is what the heading repeats back and what somebody remembers
// having picked; the sentence is read once.
//
// The stored values do not change with the wording: 'acquire' is what the
// hub is asked for and what prefs.json holds, whatever the radio happens
// to be called on screen.
//
// The words describe the BOOK, because that is what the setting decides.
// They used to sound like a choice about whether a message body is kept
// or dropped, which is only true of `acquire` — the other two drop the
// line either way, and what actually differs between them is whether the
// person gets a row (packet 4).
var CONTACTS_UNKNOWN_LABELS = {
  silent: {
    title: 'Ignore',
    note: 'No row. The line is not kept. They are not told.',
  },
  hold: {
    title: 'List them',
    note: 'A waiting row (×). The line is not kept. You accept or block later.',
  },
  acquire: {
    title: 'Add them',
    note: 'Writing is enough: they get a row and the line is kept.',
  },
};

var contactsPeople = [];
// Search results — see contactsSearchSeen. Not a standing list: a
// thousand-member relay makes that unreadable and expensive both.
var contactsSeen = [];
var contactsSeenMore = false;
// Relays that could not answer the search — older code, or down.
var contactsSeenSilent = [];
var contactsSelfTail = '';

// ── WHO IS THAT, ASKED OF THEM ───────────────────────────────────────
//
//   Andy: "when a contact is actually found, a bubble should open below
//   with the description: obtained via peerPost() to the perspective
//   peer."
//   Andy, earlier: "when a peer is selected in the shell, a description
//   can then be procured via the relay-partner POST chain, this would
//   incidentally also validate true 'reachability'."
//
// A search answers off a relay's CENSUS — a label and a key, which is
// what the relay was told and has no opinion about. This asks the person
// themselves, and it is a different kind of fact: they composed it, they
// are awake to say it, and the packet came back. That last part is why
// "could not reach them" is an answer here and not a failure — it is the
// one thing a census can never tell you.
//
// Keyed by public key: `'asking' | { name, description } | { why }`.
// Kept across repaints of the list so pressing a row twice does not
// re-ask, and thrown away with each new search, because a card is about
// a person and the list is about a question.
var contactsCards = Object.create(null);

// ── ASKED FOR EVERY ANSWER, NOT ON A CLICK ───────────────────────────
//
//   Andy: "when a contact is found, there should be a bubble below with
//   a description obtained via a peerPost to the ID of the found peer."
//
// THIS CORRECTS THE FIRST VERSION, which opened one bubble at a time when
// a row was pressed, and it was wrong for the reason the whole arc
// exists: the description is what REPLACED the key ending, and a key
// ending was readable without doing anything to it. A fact you have to go
// hunting for row by row does not replace one that was simply on the
// page.
//
// WHAT IT COSTS, and it is the thing that argued for the click:
//
//   A SEARCH NOW SPEAKS TO PEOPLE. It used to be a question asked of
//   relays; every row is now a packet to somebody's node, so the people
//   in your answer learn that somebody looked. Bounded by the search's
//   own cap — peerSearch.SLOTS, 32 — and sent in parallel, so the wall
//   clock is one round trip rather than thirty-two.
//
//   AN UNREACHABLE PEER COSTS NOTHING. The node refuses a post to a key
//   presence does not name, at once and with no wait, so the common case
//   — somebody on a relay this node holds no stream to — answers
//   immediately rather than sitting on peerPost's 8s.
//
// ONE BUBBLE PER ROW, all open. `contactsCardOpen` STOOD HERE and kept
// the single open row; there is nothing left to choose between when every
// row answers for itself.

// Which names in the current answer are worn by more than one row. Built
// in contactsPaintSeen, read one line later — a variable rather than a
// local only because the rows are mapped in an expression.
var contactsSeenCollide = Object.create(null);

// Both of these are `contactsApi.verb` now (AGENT.md, Comms) — the shell
// is the only thing an app speaks to. They stay as two names because they
// answer two shapes and their callers read different halves.
function contactsPost(verb, body) {
  return contactsApi.verb(verb, body);
}

// ONE DOOR, AND THE VERB IS THE ARGUMENT. Same shape as ndPost in
// natterDetails: the path is the same string for every loopback verb
// now, so a caller that had to repeat it was repeating a constant.
// Answers the parsed body, because a refusal from these verbs is a
// `{ ok: false }` rather than a status the caller reads.
function contactsAsk(verb, body) {
  return contactsApi.verb(verb, body).then(function (r) { return r.body; });
}

function contactsStatus(text) {
  var el = document.getElementById('contacts-status');
  if (el) el.textContent = text || '';
}

// The Handle column: their own name, and nothing else on an ordinary
// row. No key endings for people you have already acquired — you did
// that comparing down a telephone and it is finished (Andy).
//
// Two rows are the exception, because on those the handle is not an
// answer. Nobody claimed one, so the cell would be empty; or somebody
// else claimed the same one, which is `ambiguous` — the node's own
// verdict (buildPeople), not a second opinion formed here, so the table
// and the To list can never disagree about which rows read alike. The
// tail comes down with the row for the same reason: six from the end is
// one rule and it lives in hub.js.
function contactsHandleCell(person) {
  var handle = contactsEscapeHtml(person.publicLabel || '');
  var tail = contactsEscapeHtml(person.tail || '');
  if (handle && !person.ambiguous) return handle;
  if (!tail) return handle;
  return (handle ? handle + ' ' : '') + '…' + tail;
}

// One row per key.
//
//   ❌ NO       this node refuses them.
//   ⌛ WAITING   they wrote and nobody has decided yet.
//
// ❌ rather than the 📇 the chat list uses for the same person, and that
// is not an inconsistency (Andy). In chat the rolodex says WHICH app
// refused them, because the answer is somewhere else and you have to be
// sent there. Here you are already in that app: a mark pointing at
// Contacts, drawn in Contacts, points at itself.
//
// Chat's own refusal has no mark here at all. It lives in chat's
// per-peer log file, which api.fs will not let this app read — Contacts
// genuinely cannot know it, and do not "fix" that by widening a scope.
// The two refusals being separate is the point (packet 2).
// A row is what you need to decide whether to look closer, and no more
// (Andy). Everything else — the six facts, the rename, the decisions —
// is a screen of its own now: app/contactsDetails, the first dialog.
//
// What that bought, in the order it matters:
//
//   - the table keeps its shape. The old expansion put a six-fact bubble
//     and a form inside a colspan="4", so the widest thing on the page
//     lived inside the narrowest, and that is what pushed this app off a
//     portrait screen;
//   - the table keeps its place. Expanding a row reflowed everything
//     under it and collapsing changed the page height, so a long list
//     lost your position twice per look;
//   - one person at a time, with their neighbours not listed above and
//     below them while you read their numbers.
// PRESENCE, AND THE JOIN HAPPENS HERE AND ONLY HERE (PRESENCE.md, Stage
// 4). Presence arrives keyed by public key because a key is the only
// thing a relay and this node agree about; whoBook says who that is.
//
// Three marks, and the third is the point of the other two:
//
//   GREEN  a relay we are connected to says this key is present
//   RED    a relay we are connected to says this key is absent
//   WHITE  no relay mentions this key at all
//
// White is NOT a dimmer red. A contact we share no relay with is not
// offline, they are UNSEEN, and painting them red would be this column
// claiming knowledge it does not have. That is also why a removed peer
// goes white rather than red: they have no row anywhere any more, so
// nobody is in a position to say they are absent.
//
// FALSE NEGATIVES ONLY. Anything unknown, stale or unreachable reads as
// white — the mark that promises nothing.
var contactsPresence = Object.create(null);
var contactsPresenceSeen = false;

function contactsPresenceMark(publicKey) {
  // Before the first payload arrives nothing is known about anybody, and
  // a screenful of red on load would be a lie that corrects itself a
  // second later — which is worse than a screenful of white that fills
  // in, because the lie is the one that looks like information.
  if (!contactsPresenceSeen) return contactsIcon.WHITE_CIRCLE;
  var state = contactsPresence[publicKey];
  if (state === true) return contactsIcon.GREEN_CIRCLE;
  if (state === false) return contactsIcon.RED_CIRCLE;
  return contactsIcon.WHITE_CIRCLE;
}

function contactsPresenceTitle(publicKey) {
  if (!contactsPresenceSeen) return 'not known yet';
  var state = contactsPresence[publicKey];
  if (state === true) return 'present — a relay you share is holding their connection';
  if (state === false) return 'absent — a relay you share says they are not connected';
  return 'not known — no relay you are connected to mentions this key';
}

// ── THE SAME DOT, FOR SOMEBODY YOU HAVE NOT ADDED ────────────────────
//
// A search result is not in the book, so it is not in this node's
// presence table either — that table is fed by the relay-presence job,
// which reports the rosters of relays this node HOLDS A STREAM TO.
//
// TWO ANSWERS, AND THE NEARER ONE WINS. If this node's own table has an
// opinion, it is the one to show: it is the same fact `peer.post` uses to
// decide whether a packet can go, so it is what predicts whether the
// bubble below will say anything. If it has none — which is exactly what
// a PARTNER's member looks like, somebody on a relay this node does not
// stream to — the answering relay's word is all there is, and it is
// better than white.
//
// So a green dot beside a name this node cannot reach is not a
// contradiction: it means "the relay that found them says they are
// connected, and I have no way to speak to them myself". That pairing is
// the thing a person needs to see, and it was unreadable while the field
// was being dropped.
function contactsSeenMark(c) {
  var known = contactsPresence[c.publicKey];
  if (contactsPresenceSeen && known === true) return contactsIcon.GREEN_CIRCLE;
  if (contactsPresenceSeen && known === false) return contactsIcon.RED_CIRCLE;
  return c.present ? contactsIcon.GREEN_CIRCLE : contactsIcon.WHITE_CIRCLE;
}

function contactsSeenMarkTitle(c) {
  var known = contactsPresence[c.publicKey];
  if (contactsPresenceSeen && known === true) {
    return 'present — a relay you share is holding their connection';
  }
  if (contactsPresenceSeen && known === false) {
    return 'absent — a relay you share says they are not connected';
  }
  return c.present
    ? 'the relay that found them says they are connected, but you share no relay with them'
    : 'no relay you are connected to mentions this key';
}

function contactsRowHtml(person) {
  var mark = '';
  if (person.blocked) mark = contactsIcon.NO;
  else if (person.held) mark = contactsIcon.WAITING;

  return '<tr class="job-row" data-contact-row="' + contactsEscapeHtml(person.publicKey) + '">' +
    '<td title="' + contactsEscapeHtml(contactsPresenceTitle(person.publicKey)) + '">' +
      contactsPresenceMark(person.publicKey) + '</td>' +
    '<td>' + mark + '</td>' +
    // THE COLUMN FITS THE LABEL, THE RELAY DOES NOT (2026-09-15).
    //
    // Labels are Unicode and permissive now — a real name, with spaces
    // and punctuation, up to 48 graphemes. The relay BOUNDS one so a
    // peer cannot write ten kilobytes into somebody else's ledger, and
    // has no opinion beyond that: how wide a table is belongs to the
    // table. See .label-cell in index.html, and UI_DESIGN_STYLE.md.
    //
    // Both cells, because `myLabel` is the private caption and a person
    // may write anything they like in their own address book.
    '<td class="label-cell">' + contactsHandleCell(person) + '</td>' +
    '<td class="label-cell">' + contactsEscapeHtml(person.myLabel || '') + '</td>' +
    '<td>' + contactsEscapeHtml(person.acquiredVia || '') + '</td>' +
    '</tr>';
}

function contactsRender() {
  var tbody = document.getElementById('contacts-tbody');
  if (!tbody) return;
  // The focus guard that stood here went with the field it guarded. It
  // existed because a repaint arriving while somebody was typing a name
  // would take the name — and the rename input is on the dialog now,
  // inside a pane this table's repaints cannot reach.

  if (!contactsPeople.length) {
    tbody.innerHTML = '<tr><td colspan="5">(nobody yet — add someone by handle below)</td></tr>';
    return;
  }
  tbody.innerHTML = contactsPeople.map(contactsRowHtml).join('');
}

function contactsPaintSelf() {
  var el = document.getElementById('contacts-self');
  if (!el) return;
  el.textContent = contactsSelfTail
    ? 'Being added yourself? Your key ends …' + contactsSelfTail + ' — that is what to tell them.'
    : '';
}

function contactsRefresh() {
  return contactsAsk('peer.list')
    .then(function (data) {
      contactsPeople = (data && data.people) || [];
      contactsSelfTail = (data && data.selfTail) || '';
      contactsRender();
      contactsPaintSelf();
    })
    .catch(function (e) { contactsStatus('could not read the book: ' + e.message); });
}

// ── EVERYBODY VISIBLE AND NOT YET KNOWN ──────────────────────────────
//
// One ask. The node walks every relay this node is on, asks each which
// relays it partners with, reads those censuses too, and subtracts
// everybody already in the book — so this page does not have to know how
// many places the answer came from, and will not have to change when the
// relay starts answering a search instead (PARTNERS.md, tier three).
//
// Reloaded after the book is read rather than beside it, because what
// counts as a candidate depends on who is already a contact.
// ── ASK, DO NOT DOWNLOAD ─────────────────────────────────────────────
//
//   Andy: "This approach will not be sustainable if there’s even just a
//   thousand people in this list... We want the partner-space
//   searchable."
//
// This fetched every census whole and rendered whoever was left after
// subtracting the book. Fine at ten members; at a thousand it is 150 KB
// a relay to draw a list nobody can read to the end of.
//
// The relay matches over rows it already holds and answers with a capped
// list. When a relay holds its partners’ members too (tier two) the same
// request covers partner space and nothing here changes.
function contactsSearchSeen() {
  const input = document.getElementById('contacts-seen-q');
  const q = ((input && input.value) || '').trim();
  if (!q) { contactsSeenNote('type part of a name, or * for anyone'); return; }
  contactsSeenNote('searching...');
  // A NEW QUESTION, SO NO OLD ANSWERS. The cards are about people and the
  // list is about a question; carrying them over would mean a bubble that
  // opens instantly on somebody whose node went down between searches,
  // which is precisely the fact this is here to report.
  contactsCards = Object.create(null);
  return contactsAsk('peer.search', { q: q })
    .then(function (data) {
      contactsSeen = (data && data.matches) || [];
      contactsSeenMore = !!(data && data.more);
      contactsSeenSilent = (data && data.silent) || [];
      contactsPaintSeen();
      // THE LIST FIRST, THE PEOPLE SECOND. Painted before anybody is
      // asked, so the names are on screen while the packets are still
      // out — and each bubble fills itself in as its answer lands.
      contactsAskEveryone();
    })
    .catch(function () {
      contactsSeen = [];
      contactsSeenNote('could not search');
    });
}

function contactsSeenNote(text) {
  const box = document.getElementById('contacts-seen-list');
  if (box) box.innerHTML = '<div class="job-log-empty">' + contactsEscapeHtml(text) + '</div>';
}
function contactsPaintSeen() {
  const box = document.getElementById('contacts-seen-list');
  if (!box) return;

  if (!contactsSeen.length) {
    box.innerHTML = '<div class="job-log-empty">nobody found</div>' +
      (contactsSeenSilent.length
        ? '<div class="job-manifest-note">' + contactsSeenSilent.length +
          ' relay(s) could not search: ' + contactsEscapeHtml(contactsSeenSilent.join(', ')) + '</div>'
        : '');
    return;
  }

  // THE ONE THING WORTH SAYING BEFORE A LIST OF NAMES. A label is not an
  // identity (R1), so two answers can wear one name and something has to
  // tell them apart.
  //
  // WHAT THAT SOMETHING IS HAS CHANGED. It used to be six characters of a
  // key read down a telephone, and this sentence used to ask for them.
  // Now a row can be OPENED and that node says who it is in its own words
  // — which is the thing key endings were standing in for, and the reason
  // UI_DESIGN_STYLE §6 only ever defended them as the answer when there
  // was nothing better.
  //
  // THE ENDING IS STILL THE FALLBACK, and the sentence keeps it, because
  // a node that does not answer has no words to offer and two rows are
  // then still two rows.
  //
  // Shown only when there is a decision to make.
  const ambiguous = contactsSeen.length > 1;

  box.innerHTML =
    (ambiguous
      ? '<div class="job-manifest-note">More than one answer. Each node has been ' +
        'asked who it is and says so below its name — or ask them what their key ' +
        'ends with, which they can read in fine print at the foot of their own ' +
        'screen.</div>'
      : '') +
    // NO "WHERE" COLUMN. Andy: "The user shouldn't worry about relays."
    // The relay is still on the row, as `data-url`, because the confirm is
    // checked against that census and the contact keeps it as a route —
    // but it is the node's business and not a column somebody reads.
    //
    // AND NO "KEY ENDS" COLUMN EITHER, now that a row can be opened.
    //
    //   Andy: "get rid of the keys column (that stuff has to go
    //   everywhere)" — and, on this one: "word."
    //
    // This was the last place in the shell showing a key ending in a
    // column of its own, and it was the one with an argument: picking the
    // right key IS the decision here, so something had to distinguish two
    // rows called john. Something does now, and it is better than six
    // characters — the node's own sentence about itself, which is what
    // this whole arc was for.
    //
    // WHAT SURVIVES is the ending on a row that COLLIDES, beside the name
    // rather than in a column: a node that will not answer leaves two
    // identical rows, and Add writes one of them. Same rule as the
    // enrolment list on the Natter screen (ndTellApart) and the same one
    // the book above already follows (contactsHandleCell) — say it where
    // there is a decision to make, and nowhere else.
    // The dot gets a column of its own and that column has no heading —
    // the same treatment it gets in the book above, and for the same
    // reason: there is no word for it, and a mark sharing a cell with a
    // name pushes every name a glyph to the right or not, depending on
    // the row.
    // FOUR CELLS: the dot, the name, Add, and what they said. Neither the
    // dot nor Add gets a heading — there is no word for either, and the
    // last one needs none because the cell under it is a whole sentence.
    '<table class="job-table"><thead><tr>' +
      '<th></th><th>Name</th><th></th><th></th>' +
    '</tr></thead><tbody>' +
    // Counted over the whole answer, not over the two rows either side:
    // a list is scanned, and a name is ambiguous if anything else in it
    // reads the same wherever that row happens to sort.
    (function () {
      contactsSeenCollide = Object.create(null);
      contactsSeen.forEach(function (c) {
        const l = String(c.publicLabel || '');
        contactsSeenCollide[l] = (contactsSeenCollide[l] || 0) + 1;
      });
      return '';
    })() +
    contactsSeen.map(function (c) {
      // ALREADY KNOWN IS SAID, NOT HIDDEN. A search is a question about
      // who is out there, and dropping the people you have would make
      // the answer depend on your book — which is how somebody ends up
      // typing a name, seeing nothing, and concluding they are gone.
      const known = c.acquiredVia && c.acquiredVia !== 'census';
      // THE ROW IS NOT A CONTROL ANY MORE. It was, while the bubble had
      // to be opened; every row answers for itself now, so there is
      // nothing to press and no chevron promising there is.
      const alike = (contactsSeenCollide[String(c.publicLabel || '')] || 0) > 1;
      return '<tr>' +
        '<td title="' + contactsEscapeHtml(contactsSeenMarkTitle(c)) + '">' +
          contactsSeenMark(c) + '</td>' +
        '<td>' + contactsEscapeHtml(c.publicLabel || '(no label)') +
          (alike
            ? ' <span class="muted" title="more than one answer wears this name">\u2026' +
              contactsEscapeHtml(String(c.tail || '')) + '</span>'
            : '') + '</td>' +
        '<td>' + (known
          ? '<span class="muted">already a contact</span>'
          : '<button type="button" class="cancel-btn contacts-seen-add"' +
            ' data-key="' + contactsEscapeHtml(c.publicKey) + '"' +
            ' data-url="' + contactsEscapeHtml(c.relay) + '">Add</button>') + '</td>' +
        contactsSaidCell(c) +
      '</tr>';
    }).join('') +
    '</tbody></table>' +
    (contactsSeenSilent.length
      ? '<div class="job-manifest-note">' + contactsSeenSilent.length +
        ' relay(s) could not search — they may be running older code: ' +
        contactsEscapeHtml(contactsSeenSilent.join(', ')) + '</div>'
      : '') +
    (contactsSeenMore
      ? '<div class="job-manifest-note">More matched than are shown — type more of the name.</div>'
      : '');
}
// THE PACKET IS ADDRESSED TO THE BOX, NOT TO AN APP, and the empty app
// id is how that is said: packet.js omits the field rather than writing
// `app: ""`, and js/nodeCard.js answers only a packet that carries none.
// A card is a question about the node itself — the same shape a relay is
// asked `answerSelf` — so it belongs to no app on either end.
//
// ANSWERED IN FRONT OF THEIR FRONT DOOR. The far node replies whether or
// not it has ever heard of us, which is the whole reason this is worth
// asking before adding somebody (js/nodeCard.js).
// Everybody in the current answer, in parallel. Asked once each — a key
// already in `contactsCards` is one this search has already spoken to.
function contactsAskEveryone() {
  contactsSeen.forEach(function (c) { contactsAskCard(c.publicKey); });
}

function contactsAskCard(key) {
  if (!key || contactsCards[key]) return;
  contactsCards[key] = 'asking';

  contactsApi.peerPost('', key, { describe: true }).then(function (r) {
    var said = (r && r.body) || null;
    if (r && r.ok && said && said.ok) {
      contactsCards[key] = {
        name: String(said.name || ''),
        description: String(said.description || ''),
      };
    } else {
      // WHY, and it is usually one of two things: their node is not
      // reachable from here — which for somebody found on a PARTNER'S
      // relay is the ordinary case today, since this node holds no stream
      // to a relay it is not a member of — or they answered something
      // else. Both are worth reading before adding a row.
      contactsCards[key] = {
        why: (said && said.error) || (r && r.error) || 'no answer',
      };
    }
    contactsPaintSeen();
  }).catch(function (e) {
    contactsCards[key] = { why: String((e && e.message) || e) };
    contactsPaintSeen();
  });
}

// ── WHAT THEY SAID, IN THE SAME LINE AS THEIR NAME ───────────────────
//
//   Andy: "i'd like the search results in contacts -> Find someone to be
//   each only occupying one line. 1) colored status circle 2) label
//   3) Add Button, if applicable 4) description or error message, where
//   error message must be visually different (preceded by ICON.WARNING
//   and maybe a dark-red background)."
//
// A ROW EXPANSION STOOD HERE and is gone, which puts this back on the
// right side of UI_DESIGN_STYLE's rule about them: a bubble in a
// `colspan` put the widest thing on the page in the narrowest box and
// changed the page height under whoever was reading it. One line per
// person means a list of ten is ten lines, scannable down the left edge,
// with the answer read across.
//
// THREE STATES, AND ONLY ONE OF THEM IS A FAILURE:
//
//   waiting    the packet is out and nothing is back. Muted, no mark —
//              a warning triangle for "not yet" would cry wolf on every
//              search, and it arrives a few hundred milliseconds later.
//   said       their own sentence, at reading size, no mark. The
//              ordinary case earns no decoration.
//   could not  ⚠ and a dark red ground. This is the one that has to be
//              distinguishable at a glance from a description, because
//              both are prose in the same cell and a person scanning ten
//              rows is looking for which ones they can actually act on.
//
// NOT RED TEXT ALONE. `.job-start-error` is the shell's red, and it is
// what a message UNDER a form uses — there it is the only thing in its
// block. Here it would be one cell of prose among nine others and the
// colour alone reads as emphasis rather than as a category, which is why
// Andy asked for the ground and the mark together.
function contactsSaidCell(c) {
  var card = contactsCards[c.publicKey];

  // STILL A BUBBLE, and the cell is only the box it sits in.
  //
  //   Andy: "hmmm the description text should still be in a bubble."
  //
  // What went was the row EXPANSION, not the bubble — those were one
  // thing and never had to be. A sentence somebody wrote about themselves
  // is a reading, and the shell has one ground for a reading inside
  // something else (.stat-tile.nested, .fact-row): a lighter card on the
  // card, rounded the same 10px. Bare text in a table cell reads as a
  // fourth column of data, which is what this stopped being the moment it
  // became a person's own words.
  //
  // EVERY STATE GETS ONE, waiting included. A bubble that appeared only
  // when the answer landed would make every row jump a few hundred
  // milliseconds after a search — which is exactly when somebody is
  // reading them.

  if (card === 'asking') {
    return '<td class="seen-said"><span class="said-bubble muted">asking them\u2026</span></td>';
  }

  if (card && card.why) {
    return '<td class="seen-said"><span class="said-bubble is-error">' +
      contactsIcon.WARNING + ' ' +
      contactsEscapeHtml('could not reach them \u2014 ' + card.why) +
      '</span></td>';
  }

  if (card) {
    // THE NAME THEIR NODE CALLS ITSELF is dropped here and was a second
    // line in the bubble. One line means one thing to read, and the
    // description is the thing — a node name that differs from the label
    // is a curiosity, not a reason to make every row two rows.
    return '<td class="seen-said"><span class="said-bubble' +
      (card.description ? '' : ' muted') + '">' +
      (card.description
        ? contactsEscapeHtml(card.description)
        : 'they have not said anything about themselves') +
      '</span></td>';
  }

  // Nobody has been asked — which happens for a row painted before the
  // packets go out, and for the moment between the two.
  return '<td class="seen-said"></td>';
}

function contactsSeenAdd(button) {
  const key = button.getAttribute('data-key') || '';
  const url = button.getAttribute('data-url') || '';
  if (!key) return;
  contactsStatus('adding…');
  contactsAsk('peer.acquire', { publicKey: key, url: url, via: 'handle' })
    .then(function (row) {
      contactsStatus(row && row.publicLabel
        ? 'added ' + row.publicLabel
        : 'added');
      contactsRefresh();
    })
    .catch(function (e) { contactsStatus('could not add: ' + e.message); });
}

// Every key the mailbox has under that handle. Never one: a handle is a
// caption, and two johns are two keys — the whole reason this asks
// rather than picks.
// contactsFindByHandle STOOD HERE and asked `peer.find`. Its one good
// sentence — ask them what their key ends with — moved into the search
// results above, which is the only place it was ever needed: where more
// than one answer carries the same name.
//
// The verb survives it. `peer.find` is still served by the node
// (server.js) and now has no caller in the tree, which is a thing to
// decide rather than a thing to leave: it asks `urls[0]`, so it cannot
// see a second relay or a partner's members, and anything that wanted it
// should want peer.search instead.

// Factory is the tightest setting that still lets two people who added
// each other talk. A file that is missing, empty or nonsense therefore
// reads as silent — the safe answer is also the default answer, so a
// broken prefs.json cannot quietly open a node up.
//
// When this app has no file of its own, the value is adopted once from
// where it used to live. Without that, a deliberate Hold or Add-them
// would silently revert to Silent on the first load after the move, which
// is a change of behaviour nobody asked for. Read-only and one-way: the
// old file is never written, and chat has already stopped reading its own
// copy, so there is no moment with two live answers.
// ASKED, NOT READ. The setting stopped being this app's file: it is what
// the NODE does about a stranger, and a node-global answer stored inside
// one of its readers was wrong twice over — wrong as a location, and
// wrong as a layer, because api.fs is scoped to app/<name>/ and a jail
// that an app can write is not a jail.
//
// So this app draws the control and nothing else. The node holds the
// value, applies it, and is the only thing that can change it. What the
// radios show is always what the node last said, never what this app
// believes it asked for.
function contactsLoadPrefs() {
  return contactsAsk('contact.senders')
    .then(function (d) {
      var wanted = d && d.policy;
      contactsPrefs = {
        unknown: CONTACTS_UNKNOWN_CHOICES.indexOf(wanted) === -1 ? 'silent' : wanted,
      };
    })
    .catch(function () {
      // A node that will not answer reads as the tightest setting rather
      // than as whatever was on screen before. Being wrong towards
      // `silent` costs a message; being wrong the other way costs a
      // stranger a row in the book.
      contactsPrefs = { unknown: 'silent' };
    });
}

// PAINTED FROM THE ANSWER, not from the press. The node is asked to
// change it and replies with what it will actually do — so a refused or
// unwritable setting shows as unchanged instead of showing a radio that
// lies.
function contactsSavePrefs() {
  return contactsAsk('contact.setSenders', { policy: contactsPrefs.unknown })
    .then(function (d) {
      if (!d || d.ok !== true) throw new Error((d && d.error) || 'refused');
      contactsPrefs.unknown = d.policy;
    })
    .catch(function (e) {
      contactsStatus('could not remember the setting: ' + (e && e.message ? e.message : 'no answer'));
      return contactsLoadPrefs();
    })
    .then(function () { contactsPaintUnknown(); });
}

// The heading carries the current answer, so the fold can be read closed
// and only the question being changed is open.
function contactsPaintUnknown() {
  var box = document.getElementById('contacts-unknown-choices');
  if (!box) return;
  box.innerHTML = CONTACTS_UNKNOWN_CHOICES.map(function (choice) {
    var text = CONTACTS_UNKNOWN_LABELS[choice];
    // The note sits in the same label as the radio, so reading it and
    // choosing it are the same gesture, laid out under the title rather
    // than under the button (rc-choice, in index.html).
    return '<label class="rc-choice">' +
      '<input type="radio" name="contacts-unknown" value="' + choice + '"' +
      (contactsPrefs.unknown === choice ? ' checked' : '') + '>' +
      '<span class="rc-choice-title">' + contactsEscapeHtml(text.title) + '</span>' +
      '<span class="rc-choice-note">' + contactsEscapeHtml(text.note) + '</span>' +
      '</label>';
  }).join('');

  var summary = document.getElementById('contacts-unknown-summary');
  var current = CONTACTS_UNKNOWN_LABELS[contactsPrefs.unknown];
  if (summary) {
    summary.textContent = 'People who write and are not in this book' +
      (current ? ' — ' + current.title : '');
  }
}

// THE WIRE, AND IT IS ALREADY THERE. The node holds one connection per
// relay and publishes what it hears as a permanent `relay-presence` job,
// so the shell's existing jobs channel carries this — no new shell
// surface, no second socket of our own, and nothing added to the bones
// so that a column could work.
//
// PRESENCE.md Stage 3 proposes spirit.core.presence.subscribe() to fold
// several app subscriptions into one EventSource. Contacts is the only
// app that consumes this arc — the document says so — so that fold would
// today have exactly one thing to fold. Left undone deliberately; if a
// second app ever wants presence, do Stage 3 then rather than opening a
// third socket.
// ONCE PER PAGE, NOT ONCE PER MOUNT.
//
// The shell loads an app's script once and mounts it on every entry, and
// activateApp takes mount/render/loadFile/open — there is no unmount
// hook. So a subscription opened in mount() and never closed would be a
// new EventSource every time somebody walked into Contacts, each one
// feeding its own repaint of a table that is drawn once.
//
// Guarded here rather than solved by adding a lifecycle hook to the
// shell: a column does not get to change the app contract. That the
// contract has no unmount is worth raising on its own, away from this.
var contactsWatching = false;

function contactsWatchPresence() {
  if (contactsWatching) return;
  contactsWatching = true;

  function take(job) {
    if (!job || job.type !== 'relay-presence') return;
    var table = (job.data && job.data.presence) || null;
    if (!table) return;
    contactsPresence = table;
    contactsPresenceSeen = true;
    contactsRender();
  }

  spirit.core.jobs.subscribe({
    // The snapshot matters as much as the updates: an app mounted after
    // the job last changed would otherwise sit white until something
    // moved, and "nothing has happened yet" would look identical to
    // "nobody is here".
    onSnapshot: function (jobs) { (jobs || []).forEach(take); },
    onUpdate: take,
  });
}

spirit.shell.activateApp({
  mount: function (container, api) {
    contactsApi = api;

    container.innerHTML =
      // No Key column, and none in the panel either (Andy). Six
      // characters of somebody's key are what two people compare down a
      // phone while one adds the other; once they are in this list that
      // is done, and it is a column nobody reads.
      //
      // The two places a tail still earns its space are both about
      // acquiring: the candidates under Add-someone-by-handle, where
      // picking the right key IS the decision, and the footer, which is
      // your own tail for somebody else to add you by.
      // The mark gets a column of its own, and that column has no
      // heading (Andy): there is no word for it, and a mark sharing a
      // cell with a name pushed every name in the table a glyph to the
      // right or not, depending on the row. Its own column and the
      // handles line up down the page whatever anyone is marked.
      //
      // The dot gets the same treatment, leftmost, and for the same
      // reason — there is no word for it either. What the colour means
      // rides on each cell's title rather than on a heading, so hovering
      // a dot answers the question at the place the question is asked.
      //
      // Handle then Label, in that order, because Handle is theirs and
      // is what somebody told you on the phone, and Label is what you
      // decided afterwards. The bubble under an open row reads the same
      // way for the same reason.
      '<table class="jobs-table"><thead><tr><th></th><th></th><th>Handle</th><th>Label</th><th>How</th></tr></thead>' +
        '<tbody id="contacts-tbody"></tbody></table>' +
      // name= makes the two folds one exclusive group: opening either
      // closes the other, done by the browser with no JS and no state.
      // Named from this app's id prefix rather than its app id, because
      // app ids are folder-derived and have moved before — a group named
      // from one would silently regroup on the next move. See
      // UI_DESIGN_STYLE.md §3.
      // ADD-SOMEONE-BY-HANDLE STOOD HERE, and it asked `peer.find`.
      //
      //   Andy: "this new item should be integrated in: Find someone by
      //   handle. The user shouldn't worry about relays, they just want to
      //   find somebody."
      //
      // Two panels answered what turned out to be one question, and the
      // reason for keeping them apart stopped being true. The old comment
      // said they were different — "is the john I was told about here"
      // versus "who is here" — and that was fair while a search could not
      // rank: a partial query drowned an exact one.
      //
      // It ranks now. An exact handle scores 1.0 and comes first out of a
      // million, so typing the name you were told IS the handle lookup,
      // and typing part of it is the other question. One box answers both.
      //
      // AND peer.find WAS THE WEAKER HALF besides: it asked `urls[0]` —
      // the first row of relays.json, whatever the question — so it could
      // not see a second relay, let alone a partner's members, and the
      // Confirm it offered carried no route for the acquire to use.
      // Under Add-someone, because adding is what you come here to do and
      // this is the standing answer for people you have not. No count of
      // who is waiting: under Hold the hub writes them into the book, so
      // they are rows in the table above — which is more than a number,
      // and something you can act on.
      // ── PEOPLE YOU COULD ADD, WHICH IS WHY YOU CAME ─────────────────
      //
      //   Andy: "this must fit seamlessly into contacts itself, and the
      //   list there must present peers that are not yet in the contacts
      //   list from our bound relay or other relays."
      //
      // Add-by-handle asks you to already know the name. This is the
      // other half: everybody visible from here and not yet known —
      // across every relay this node is on AND their partners, which the
      // node gathers so the page does not have to know how many places it
      // took (peer.candidates).
      //
      // Beside Add-by-handle rather than replacing it, because they
      // answer different questions: one is "is the john I was told about
      // here", this is "who is here".
      '<details class="stat-tile wide" name="contacts-panels" id="contacts-seen-section">' +
        // NOT "on your relays". Andy: "The user shouldn't worry about
        // relays, they just want to find somebody." Which relay somebody
        // is on is the node's problem — it is how the search is answered
        // and where the confirm is checked, and neither is a question a
        // person came here with.
        '<summary id="contacts-seen-summary">Find someone</summary>' +
        '<div class="start-job-form">' +
          '<input type="text" id="contacts-seen-q" placeholder="their name, or part of it">' +
          '<button type="button" id="contacts-seen-go">Search</button>' +
        '</div>' +
        '<div id="contacts-seen-list"></div>' +
      '</details>' +
      '<details class="stat-tile wide" name="contacts-panels" id="contacts-unknown-section">' +
        '<summary id="contacts-unknown-summary">People who write and are not in this book</summary>' +
        '<div id="contacts-unknown-choices"></div>' +
      '</details>' +
      '<div class="job-manifest-note" id="contacts-status"></div>' +
      '<div class="job-manifest-note" id="contacts-self"></div>';

    // Painted when the node answers, not before. The read is a round trip
    // now rather than a file, so painting on the next line would draw
    // `silent` every time and then correct itself.
    contactsLoadPrefs().then(contactsPaintUnknown);

    // A change of policy changes what the next inbox read will even
    // return, so it is sent on the spot. Nothing else has to be told:
    // every reader asks the node, and the node is the one that holds it.
    document.getElementById('contacts-unknown-choices').addEventListener('change', function (event) {
      var choice = event.target && event.target.value;
      if (CONTACTS_UNKNOWN_CHOICES.indexOf(choice) === -1) return;
      contactsPrefs.unknown = choice;
      // The repaint happens inside, from what the node answered rather
      // than from what was clicked.
      contactsSavePrefs();
    });

    // Delegated: the list repaints whole, so a listener bound to a row
    // would go with the next paint.
    document.getElementById('contacts-seen-go').addEventListener('click', contactsSearchSeen);
    document.getElementById('contacts-seen-q').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') contactsSearchSeen();
    });
    document.getElementById('contacts-seen-list').addEventListener('click', function (event) {
      const target = event.target;
      if (!target || !target.closest) return;

      // ADD FIRST. It sits inside the row, so a row handler that ran
      // first would open a bubble every time somebody pressed Add — and
      // the press that writes a contact must not also do something else.
      // Add is the only thing on a result row that does anything now.
      const btn = target.closest('.contacts-seen-add');
      if (btn) { contactsSeenAdd(btn); return; }
    });

    // Confirming is what writes the contact. Delegated, because the rows
    // are painted and repainted.
    // THE ADD-BY-HANDLE CONFIRM STOOD HERE, and it acquired with a key
    // and NO URL — so peer.acquire fell back to `urls[0]` and could only
    // ever confirm somebody on the first relay in the file. A peer found
    // on a second relay, or on a partner's, was unconfirmable by the very
    // panel built for confirming.
    //
    // The seen-list Add above carries the relay the row came from, which
    // is why merging the two panels fixed a bug rather than only removing
    // a box.

    // A row opens the person, and that is all a row does now.
    //
    // callDialog rather than launchApp, because this is a question with
    // an answer. The shell hands the dialog its subject on every call
    // and gives back what it decided, so the code that opens the screen
    // is the code three lines below that acts on it — rather than a hook
    // declared at the bottom of the file, far from the click.
    //
    // The key alone. The dialog re-fetches the row rather than being
    // handed one, because the numbers move while it is open.
    //
    // The answer matters because render() repaints from a list this app
    // fetched and does not fetch again: without re-reading, blocking
    // somebody on their own screen would leave an unmarked row behind
    // you, and the mark is the whole of what a row says about that
    // decision. A dialog that decided nothing answers null, and costs
    // this table nothing.
    document.getElementById('contacts-tbody').addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      var row = target.closest('[data-contact-row]');
      if (!row) return;
      contactsApi.callDialog('app/contactsDetails', { key: row.dataset.contactRow })
        .then(function (result) {
          if (result && result.changed) contactsRefresh();
        });
    });

    contactsRefresh();
    contactsWatchPresence();
  },

  render: function () {
    contactsRender();
  },
});
