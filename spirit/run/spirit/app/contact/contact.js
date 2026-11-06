// spirit/run/spirit/app/contact/contact.js
// CONTACTS, AN ELEMENT (goal/G43.14; Andy: "the new contact app will be exactly the same as the old, merely placed where it
// now belongs."): a tile hands it only its container, as the agent's (goal/G43.13). Its contract and its test:
// ./test/contact.md and ./test/contact.js.
//
//   spirit.elements.contact.create(container, { open }) -> { destroy() }; open, the mounter's panel stack's (goal/G43.18)
//
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
//   peer.acquire    confirm one of those keys (kept)
//   contact.accept .block .unblock .label     what this node keeps
//
// All at one door, /api/spirit, with the verb in the body. `peer.*`
// asks the relay and can fail because this box is offline; `contact.*`
// is this disk and cannot.
//
// No packets. Sharing a contact is a later sitting and a bigger
// question: a card that arrives from somebody else is their six
// characters, not yours.

var contactsEscapeHtml = spirit.escapeHtml;
var contactsApi = null;

// NO CHOICE ABOUT STRANGERS (goal/G43.17): the node ignores them always, and keeps their id only in its log. Andy: "so NO,
// we don't need a "held" "status"".

// ONE SEARCH IN TWO TIERS (goal/G30.19): the book, the shadow and the network in one list, spirit/element/search/contact/listElement.js,
// which Join draws too. Its rows are contactElements and keep themselves current; this app paints no presence. The
// book's contactSelector pane and the Find someone on the network fold (peerFind) stood here and are deleted.
var contactsList = null;
// The "your key ends …" footer went with contact.search's selfTail: no key's tail is shown anywhere (Andy, 2026-10-24,
// goal/G40.1).


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

// The list asked again with what is typed: after an add, or a decision on a contact's own screen.
function contactsRefresh() {
  if (contactsList) contactsList.refresh();
}

// CONTACTS' PRESENCE SUBSCRIPTION STOOD HERE (contactsWatchPresence): contactElement holds the one subscription for
// every contact row on the page (goal/G30.18).

// WHAT IT USES, IT LOADS ITSELF (goal/G41.3; Andy: every app bootstraps its own components, "lazy-load, is a tree...."):
// through spirit.require, the list bringing its own. goal/G41.23: its rows' marks are icons (Andy: "this element will
// replace icons painting all shell elements and apps."), so the icon element comes with the list.
// And the panel stack, for a contact's or a relay's details when the mounter hands none (goal/G43.18).
var contactsParts = Promise.all([spirit.require('spirit/element/search/contact/listElement.js'), spirit.require('spirit/element/icon.js'), spirit.require('spirit/element/panel.js')]);

function contactCreate(container, options) {
    var gone = false;
    // WHERE A ROW'S DETAILS OPEN (goal/G43.18; Andy: "the details of relays and contacts still mount with the green look at the
    // bottom of the contact list instead of taking over the screen new-style...."): over Contacts, in the stack the mounter hands
    // (the app selector's open, so one stack, each ✕ one step back), or in one of its own over its page.
    var o = options || {};
    var stack = null;
    var openOver = typeof o.open === 'function' ? o.open : function (k, spec) { return stack ? stack.open(k, spec) : Promise.resolve(null); };

    container.innerHTML =
      // THE PAGE IS A FLEX COLUMN, AND THE LIST TAKES WHAT IT LEAVES (goal/G40.13, rule/16; as in Apps and Icons, goal/G40.8:
      // space granted top-down): the page is one fill box, the list box another inside it, and the panels below it keep
      // their own height.
      '<div class="fill">' +
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
      '<div id="contacts-book" class="fill"></div>' +
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
      '<div class="job-manifest-note" id="contacts-status"></div>' +
      '</div>';

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
    var book = document.getElementById('contacts-book');
    contactsParts.then(function () {
      if (gone) return;
      if (typeof o.open !== 'function') stack = window.spirit.elements.panel.create(container, container.firstElementChild);
      contactsList = window.spirit.element.search.contact.listElement.create(book, {
        api: contactsApi,
        open: openOver,
        say: contactsStatus,
        empty: 'Nobody matches: the network is searched as you type.',
      });
    }, function () { book.textContent = 'The contacts list could not be loaded.'; });
    return {
      destroy: function () {
        gone = true;
        if (contactsList) contactsList.destroy();
        contactsList = null;
        if (stack) stack.destroy();
        stack = null;
        container.innerHTML = '';
      },
    };
}

(window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
window.spirit.elements.contact = { create: contactCreate };
