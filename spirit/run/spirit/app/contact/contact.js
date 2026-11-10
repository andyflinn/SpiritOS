'use strict';
// spirit/run/spirit/app/contact/contact.js
// CONTACTS, AN ELEMENT (goal/G43.14; Andy: "the new contact app will be exactly the same as the old, merely placed where it
// now belongs."). Its contract and its test: ./test/contact.md and ./test/contact.js.
//
//   spirit.elements.contact.create(container, { open }) -> { destroy() }; open, the mounter's panel stack's (goal/G43.18)
//
// What it draws: the one contact list (spirit/element/search/contact/listElement.js, below), which does its own asking
// and whose rows open a person's or a relay's details, and the Add a relay fold, whose one call is relay.add. Nothing
// else here calls the node.

var contactsEscapeHtml = spirit.escapeHtml;

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

// THE ROWS ARE THE LIST'S (goal/G30.19): the table of cells this app once drew (its Handle, Label, Key and mark columns,
// contactsHandleCell, contactsNameCell) is gone; a row and its details are spirit/element/search/contact/'s.
// CONTACTS' OWN PRESENCE TABLE AND ITS PAINTING STOOD HERE (contactsPresence, contactsPresenceMark,
// contactsPaintPresence and their helpers). A row's dot is its contactElement's now (goal/G30.18, G30.19): it listens to
// the spirit.contact job itself, green, red or white with the same meaning.

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

    // THE ONE LIST (goal/G30.19). A row opens the person (search/contact/detailElement.js) or the relay (search/contact/relayPanel.js) by its
    // row element's open, in the stack above.
    var book = document.getElementById('contacts-book');
    contactsParts.then(function () {
      if (gone) return;
      if (typeof o.open !== 'function') stack = window.spirit.element.spirit.element.panel.create(container, container.firstElementChild);
      contactsList = window.spirit.element.spirit.element.search.contact.listElement.create(book, {
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

window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/contact/contact.js', { create: contactCreate }); });
