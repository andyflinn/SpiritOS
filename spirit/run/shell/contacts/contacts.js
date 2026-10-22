// The address book, which used to be three panels inside Relay Chat
// (packet 2, ARCHITECTURAL-CONCERNS.md). contactBook is still the store and
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

// ONE SEARCH IN TWO TIERS (goal/G30.19): the book, the shadow and the network in one list, shell/js/contacts/listElement.js,
// which Join draws too. Its rows are contactElements and keep themselves current; this app paints no presence. The
// book's contactSelector pane and the Find someone on the network fold (peerFind) stood here and are deleted.
var contactsList = null;
var contactsSelfTail = '';


// THE NODE THROUGH THE SPIRIT OBJECT (goal/G32.2): contactsPost and contactsAsk, the two wrappers over
// contactsApi.verb that stood here, are gone; each call is spirit.<family>.<verb>(args), answering the reply's body.

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
// WHAT TO CALL THIS KEY, in one cell.
//
//   Andy: "what is the 'Handle' column for? it has to go."
//
// contactsHandleCell STOOD HERE and drew their relay caption; the column
// beside it drew mine. Two columns for one question, and each of them
// blank half the time.
//
// `caption` is the node's answer (contactBook.labelForKey): my label for them
// if I set one, theirs otherwise — so this is never empty for a row that
// has a name anywhere.
//
// AND THE ENDING WHERE TWO ROWS READ ALIKE, which is the only part of the
// old pair worth keeping. `ambiguous` is the node's own verdict
// (buildPeople), not a second opinion formed here, so the table and the To
// list can never disagree about which rows need it.
// contactsNameCell STOOD HERE: the name cell is the node's label now
// (contact.search, puppets/G2).

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
// CONTACTS' OWN PRESENCE TABLE AND ITS PAINTING STOOD HERE (contactsPresence, contactsPresenceMark,
// contactsPaintPresence and their helpers). A row's dot is its contactElement's now (goal/G30.18, G30.19): it listens to
// the relay-presence job itself, green, red or white with the same meaning.

function contactsPaintSelf() {
  var el = document.getElementById('contacts-self');
  if (!el) return;
  el.textContent = contactsSelfTail
    ? 'Being added yourself? Your key ends …' + contactsSelfTail + ' — that is what to tell them.'
    : '';
}

// The list asked again with what is typed: after an add, or a decision on a contact's own screen.
function contactsRefresh() {
  if (contactsList) contactsList.refresh();
}

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
  return spirit.ready.then(function (s) { return s.contact.senders(); })
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
  return spirit.ready.then(function (s) { return s.contact.setSenders({ policy: contactsPrefs.unknown }); })
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

// CONTACTS' PRESENCE SUBSCRIPTION STOOD HERE (contactsWatchPresence): contactElement holds the one subscription for
// every contact row on the page (goal/G30.18).

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
      // FOUR CELLS: three marks and a name.
      //
      //   Andy: "what is the 'Handle' column for? it has to go." — "the
      //   how column can go, too."
      //
      // HANDLE AND LABEL WERE ONE QUESTION. Handle was their caption on a
      // relay, Label was mine for them, and every row showed both — so a
      // person with no private caption had a name in one column and a
      // blank in the next, and a person with one had their name twice.
      // `caption` is the node's own answer (contactBook.labelForKey): what to
      // call this key, mine if I set one and theirs otherwise. One column,
      // never blank.
      //
      // HOW went because it is provenance, and provenance is a fact about
      // the past that never changes and is read once, if ever. It is on
      // the contact's own screen, where somebody asking "how did this row
      // get here" is already standing.
      //
      // The three marks keep no heading: there is no word for a presence
      // dot, a lock or a hold, and a one-word heading over a glyph is a
      // word read on every pass to learn nothing. What each means rides on
      // its own cell's title, where the question is actually asked.
      // THE BOOK'S OWN SEARCH, on top. Andy: "the search box below searches
      // all available relays. the box on top, should not." It searches only
      // this node's book, and what it finds is added to the table.
      // THE ONE LIST (goal/G30.19): the book, the shadow and the network, with a filter instead of two folds.
      '<div id="contacts-book" class="stat-tile wide"></div>' +
      // ADD A RELAY, moved here from Natter (goal/G30.7; Andy, 2026-10-20: "putting the add-relay into contacts, in a
      // folding-panel, right below \"Find someone on the network\""). relay.add lists it on its card's answer; the label
      // is this node's private caption, never on the wire.
      '<details class="stat-tile wide" name="contacts-panels" id="contacts-relay-add-section">' +
        '<summary id="contacts-relay-add-summary">Add a relay</summary>' +
        '<div class="start-job-form">' +
          '<label class="field-label">Private label<input type="text" id="contacts-relay-label" placeholder="only you see this"></label>' +
          '<label class="field-label">URL<input type="text" id="contacts-relay-url" placeholder="https://example.com"></label>' +
          '<button type="button" id="contacts-relay-add">Add</button>' +
        '</div>' +
        '<div class="job-manifest-note" id="contacts-relay-add-out"></div>' +
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

    // ADD A RELAY (goal/G30.7, from Natter): relay.add asks the relay for its card and lists it; the node notes it as a
    // relay peer, so the list above finds it. The rule on the address is the wire's (hub.assertRelayUrl), asked here so
    // a typo costs no round trip.
    document.getElementById('contacts-relay-add').addEventListener('click', function () {
      var out = document.getElementById('contacts-relay-add-out');
      var label = String(document.getElementById('contacts-relay-label').value || '').trim();
      var url = String(document.getElementById('contacts-relay-url').value || '').trim().replace(/\/+$/, '');
      if (!label || !url) { out.textContent = 'both a label and a URL are required'; return; }
      var ok = false;
      try {
        var target = new URL(url);
        var host = String(target.hostname || '').toLowerCase();
        ok = target.protocol === 'https:' || (target.protocol === 'http:' && (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]'));
      } catch (e) { ok = false; }
      if (!ok) { out.textContent = 'a relay must be https — http is allowed only to 127.0.0.1'; return; }
      out.textContent = 'adding ' + url + '…';
      spirit.ready.then(function (s) { return s.relay.add({ url: url, label: label }); }).then(function (said) {
        out.textContent = said && said.ok ? 'added ' + url : 'not added: ' + ((said && said.error) || 'no answer');
      }, function (e) { out.textContent = 'not added: ' + ((e && e.message) || 'no answer'); });
    });

    // THE ONE LIST (goal/G30.19). A row opens the person (contactsDetails) or the relay (natterDetails) by its element's
    // open; a dialog that changed something asks the list again.
    contactsList = window.spirit.elements.contactList.create(document.getElementById('contacts-book'), {
      api: contactsApi,
      say: contactsStatus,
      selfTail: function (tail) { contactsSelfTail = tail; contactsPaintSelf(); },
      empty: 'Nobody matches: the network is searched as you type.',
    });
  },

  render: function () {},
});
