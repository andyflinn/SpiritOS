// spirit/run/shell/info/info.js
// WHAT THIS NODE SAYS ABOUT ITSELF — the screen for the owner.
//
//   Andy: "i want an intrinsic app info, in which, for now the user can
//   maintain both fields in this file, more to come."
//
// The two fields are `name` and `description` in relay-state/identity.json,
// and they are the ONLY two things this node answers to a stranger who
// asks (js/nodeCard.js). That is what makes them one screen rather than a
// row in a settings list: a person editing them is deciding what somebody
// they have never met reads about them.
//
// "More to come" is why this is its own app and not two fields bolted
// onto another one.
//
// ── THE NAME STAYS HERE ──────────────────────────────────────────────
//
// The relay table is dropped (goal/G41.6; Andy, 2026-10-27): no list of the relays and the name each calls this
// node, no push of a saved name to every relay, no rename from here. A relay's name for this node is
// Natter's to show and change, one relay at a time.
//
// ── TWO ELEMENTS, TWO FORMS, ONE BUTTON ──────────────────────────────
//
// The name and the description are the shell elements changeMyLabel and changeMyDescription (goal/G41.6, Andy's Q1):
// each holds its field rule, its check as typed, its byte limit and its save. Info reads node.card and sets each to
// what the node stored. Below them the email form and the face form (joinForm, faceForm), over the relays this node
// holds a seat on; then the Rotate key button.
//
// ── WHAT THIS SCREEN IS NOT ──────────────────────────────────────────
//
// NOT the node's key, which is not shown at all (goal/G40.10, box v15; Andy:
// "remove ANY indication of keys from all user interfaces, like that footer
// on the info app").
//
// ── NO TICK ──────────────────────────────────────────────────────────
//
// `render` is left undefined, so the shell never repaints this screen on
// the job tick. Two reasons, and the second is the real one: nothing here
// changes without this screen asking for it, and a repaint while somebody
// is typing takes the cursor out of the box. Every app that needed a
// focus guard needed it because it was being ticked; the way not to need
// one is not to be.

var infoApi = null;

// WHAT IT USES, IT LOADS ITSELF (goal/G41.3, goal/G41.6; Andy: every app bootstraps its own components, "lazy-load, is
// a tree...."): its two field elements and the two forms, through spirit.require.
var infoParts = Promise.all(['shell/js/changeMyLabel.js', 'shell/js/changeMyDescription.js', 'shell/js/joinForm.js',
  'shell/js/faceForm.js'].map(function (p) { return spirit.require(p); }));

// ── EVERY RELAY THIS NODE HOLDS A SEAT ON ────────────────────────────
//
// From spirit.relay.status (the relay family's api.js, goal/G40.11): a row per relay this node lists, with whether
// this key holds a row there (`claimed`, which `owned` implies) and the relay's own public key on `roll.relayKey`.
// Only those rows are offered to the two forms: a relay this node merely LISTS has no seat to apply on.
var infoRelays = [];
function infoSeats() {
  return infoRelays.filter(function (row) {
    return row && (row.claimed || row.owned) && row.roll && row.roll.relayKey;
  });
}

// THE TWO FORMS, EACH THE SAME EVERYWHERE (goal/G40.10, box v19): the email form above the face form, each with its
// own relay dropdown over the relays this node holds a seat on; the face form offers only those with a verified email.
// relay.face is {url, name}; the relay pairs the name with the verified email it holds for this node (box v30).
function infoDrawForms(container) {
  return infoParts.then(function () {
    var el = (window.spirit && window.spirit.elements) || {};
    var escape = infoApi && infoApi.escapeHtml;
    if (el.joinForm) el.joinForm.mount(container.querySelector('[data-info="email"]'), { relays: infoSeats(), pick: 'seated', escape: escape });
    if (el.faceForm) el.faceForm.mount(container.querySelector('[data-info="face"]'), { relays: infoSeats(), reload: function () { return infoLoadRelays(container); }, escape: escape });
  }, function () { /* a form missing is not drawn */ });
}

// It reaches the network, so the fields are drawn from the local card first and this fills the forms when it lands:
// a relay on another continent must not hold up a text box on this machine. A failure means no seat to offer.
function infoLoadRelays(container) {
  return spirit.relay.status('').then(function (r) {
    var said = (r && r.body) || {};
    infoRelays = Array.isArray(said.rows) ? said.rows : [];
  }, function () { infoRelays = []; }).then(function () { return infoDrawForms(container); });
}

spirit.shell.activateApp({
  mount: function (container, api) {
    infoApi = api;

    container.innerHTML =
      '<div class="stat-tile wide stack">' +
        '<div class="label">What this node says about itself</div>' +
        // The one thing worth saying before two boxes: these are answered to anybody who asks, which is not obvious
        // from a form and is the whole reason to think before typing in one.
        '<div class="job-manifest-note">Anybody who asks this node is told these two ' +
          'things, whether or not you have ever met. Nothing else about this box is ' +
          'answered to a stranger.</div>' +
        '<div data-info="name"></div>' +
        '<div data-info="description"></div>' +
        '<div data-info="said" class="job-start-error"></div>' +
      '</div>' +
      // ── A FACE NAME ON ONE RELAY (goal/G30.1) ──────────────────────
      //
      //   Andy, 2026-10-19: "for this a little section in the info-app will be enough." and "this UI section in info
      //   will have to address ONE relay specifically."
      //
      // The email form stands above it (goal/G40.10, box v15).
      '<div class="stat-tile wide" data-info="email"></div>' +
      '<div class="stat-tile wide" data-info="face"></div>' +
      // NO FOOT (goal/G40.10, box v15; Andy: "fine-print at the bottom. nobody read that shit, and it doesn't help
      // anybody."): no key is shown in any face app.
      // ── ROTATE THE CIPHER KEY (cycle-10/R13) ──────────────────────
      //
      //   Andy: "the place would be the info app", "and from the info-app it should invoke the rotate key dialog."
      //
      // A button that OPENS the dialog. The explanation and the two-press confirmation live there, never here, so
      // nothing on this screen can rotate a key by itself.
      '<div class="start-job-form card">' +
        '<button type="button" data-info="rotate">Rotate this node\x27s cipher key</button>' +
      '</div>';

    container.querySelector('[data-info="rotate"]').addEventListener('click', function () {
      infoApi.callDialog('shell/rotateKey', {});
    });

    // THE ONE TABLE ON THE STREAM (goal/G40.11): the shadow job hands each row as it changed; the relays are read again
    // when a relay's row changed what it says of the relay (kept, seated, owned, blocked), and not for its presence.
    var rowsHeard = Object.create(null);
    var rowsStop = null;
    var rowsTake = function (job) {
      var row = job && job.type === 'shadow' && job.data && job.data.row;
      if (!row || row.relay !== true) return;
      if (container.isConnected === false) { if (rowsStop) rowsStop(); return; }
      var said = [row.keep, row.seated, row.mine, row.blocked, !!row.gone].join();
      if (rowsHeard[row.publicKey] === said) return;
      rowsHeard[row.publicKey] = said;
      infoLoadRelays(container);
    };
    if (window.spirit && window.spirit.events && typeof window.spirit.events.subscribe === 'function') {
      rowsStop = window.spirit.events.subscribe({ onUpdate: rowsTake });
    }

    // TWO CALLS, NOT ONE AWAITING THE OTHER. The card is a file on this disk and lands at once; the relays are a
    // probe of every configured mailbox and take as long as the slowest of them.
    var fields = infoParts.then(function () {
      var el = window.spirit.elements;
      var name = el.changeMyLabel.create(container.querySelector('[data-info="name"]'), { api: api });
      var description = el.changeMyDescription.create(container.querySelector('[data-info="description"]'), { api: api });
      return Promise.resolve(api.verb('node.card', {})).then(function (r) {
        var card = r && r.body;
        var said = container.querySelector('[data-info="said"]');
        if (!card || !card.ok) { if (said) said.textContent = (card && card.error) || 'node.card did not answer'; return; }
        name.set(card.name);
        description.set(card.description);
      });
    }, function () {
      var said = container.querySelector('[data-info="said"]');
      if (said) said.textContent = 'Info could not be loaded.';
    });
    return Promise.all([fields, infoLoadRelays(container)]);
  },
});
