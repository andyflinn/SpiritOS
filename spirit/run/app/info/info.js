// spirit/run/app/info/info.js
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
// ── THE NAME IS THE LABEL, ON EVERY RELAY ────────────────────────────
//
//   Andy: "when I'm on the phone with a friend to connect, i have no idea
//   which 'relay' contains which 'label' of mine. i want this app to
//   distribute my label to ALL relays I'm a member of."
//
// THIS CORRECTS THE FIRST VERSION OF THIS FILE, which said the name here
// was "only a caption" and "never travels to a relay". That was true of
// the code and wrong as a product: a label was set per membership, on
// Natter Details, one relay at a time, and nothing anywhere showed the
// set of them together. A node on three relays could be called three
// things and its owner would find out mid-phone-call, which is the one
// moment it costs something.
//
// R1 IS UNTOUCHED and worth restating so nobody reads this as its repeal:
// a label is still a caption owned by a key, still stored once per
// membership, and two relays may still legally disagree. What changed is
// INTENT — this node keeps one label and tries to wear it everywhere —
// and VISIBILITY: a relay that disagrees is now a marked row instead of
// something nobody can see.
//
// So Save does two things in one gesture. The local write is the INTENT;
// the posts are the attempt. They can come apart — a relay may be down
// for days, or may refuse because a live invite reserves the name — and
// when they do, the table below says which and pressing Save again tries
// again. There is no background job renaming you on relays while you are
// not looking.
//
// NOTHING IS WRITTEN TO NATTER, which could not be done from here anyway
// (api.fs is scoped to this folder). It does not need to be:
// natterCheckBinding already ADOPTS each relay's caption off the census
// on every probe, which is a mechanism that exists because its absence
// once cost a live session — a successful rename looked like theft.
//
// ── WHAT THIS SCREEN IS NOT ──────────────────────────────────────────
//
// NOT the node's key. The key is the identity and cannot be edited, so it
// is at the foot in fine print (UI_DESIGN_STYLE §2) rather than in a
// field: there is nothing to do to it, and §1 says do not build a control
// whose every value would be refused.
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

// What the node last told us, so a repaint after a save draws what was
// STORED rather than what was typed. The description is trimmed to fit at
// 128 bytes, and a field that keeps showing the longer version is a field
// lying about what strangers are being told.
var infoCard = null;

// ── EVERY RELAY THIS NODE HOLDS A ROW ON ─────────────────────────────
//
// From `relay.status`, which probes every configured relay and answers a
// row each: the url, whether this key holds a row there (`claimed`, which
// `owned` implies), what that relay calls this key (`claimedLabel`, read
// off the public census by key, never by name), and the relay's own
// public key on `census.relayKey` — which is the address a rename is
// posted to.
//
// Everything needed is in that ONE call. It is the same probe Natter
// makes, and the reason nothing new had to go on the wire for any of
// this.
var infoRelays = [];

// What the last Save got back from each relay, keyed by url:
//   { ok: true, label }              renamed, or already that
//   { ok: false, why: '…' }          refused, or never answered
//
// Kept separate from the rows rather than merged into them, because the
// rows are what the RELAYS say and this is what HAPPENED. A row repainted
// from a fresh probe must not quietly inherit the verdict of an older
// attempt.
var infoPushed = Object.create(null);

// Is a push in flight? One at a time: a second Save while the first is
// still landing would race two renames at the same relays and report
// whichever finished last.
var infoBusy = false;

// The rule, from the copy the browser has (js/labelRule.js). Same object
// the node checks with, so the message beside the field and the message
// from the verb cannot disagree — and the hop is saved when they would
// have agreed anyway (Andy: "an input field should validate before taxing
// the wire").
function infoRule() {
  return (typeof window !== 'undefined' && window.spiritLabelRule) || null;
}

function infoNameProblem(text) {
  var rule = infoRule();
  return rule ? rule.problem(text) : '';
}

function infoDescribeProblem(text) {
  var rule = infoRule();
  return rule ? rule.describeProblem(text) : '';
}

function infoRemaining(text) {
  var rule = infoRule();
  if (!rule) return null;
  return rule.describeRemaining(text);
}

// A REFUSAL IS RED AND A CONFIRMATION IS NOT, and the shell has exactly
// two classes for that: `.job-start-error` is the red one and
// `.job-manifest-note` is fine print. Both collapse when empty (§1), so
// clearing a message takes its space with it rather than leaving a row
// held open for something nobody has written.
function infoSay(id, text, isError) {
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = text || '';
  el.className = isError ? 'job-start-error' : 'job-manifest-note';
}

// THE COUNTDOWN IS IN BYTES, because the cap is. An emoji costs four of
// them and a letter costs one, so a counter that counted characters would
// truncate somebody mid-sentence with no warning — and the trim happens
// at the node, silently, which is exactly the surprise this exists to
// prevent.
function infoCount() {
  var el = document.getElementById('info-description-count');
  var box = document.getElementById('info-description');
  if (!el || !box) return;
  var left = infoRemaining(box.value);
  if (left === null) { el.textContent = ''; return; }
  if (left >= 0) {
    el.textContent = left + ' left';
    el.className = 'job-manifest-note';
  } else {
    // Red, because past here the node stops keeping what is typed. It is
    // not a refusal — prose slightly too long is trimmed rather than
    // rejected — which is precisely why it has to be visible.
    el.textContent = Math.abs(left) + ' too many — the node keeps the first ' +
      ((infoCard && infoCard.descriptionMax) || 128);
    el.className = 'job-start-error';
  }
}

function infoDraw() {
  if (!infoCard) return;
  var name = document.getElementById('info-name');
  var description = document.getElementById('info-description');
  if (name) name.value = infoCard.name;
  if (description) description.value = infoCard.description;

  var key = document.getElementById('info-key');
  if (key) key.textContent = infoCard.publicKey;
  infoCount();
  infoDrawRelays();
}

// Which rows may be renamed: the ones this key actually holds a seat on,
// and that told us the relay's key. A relay this node merely LISTS has no
// row to rename, and one that did not answer has not said what its key is
// — `censusFacts` returns nothing when the census could not be read.
function infoSeats() {
  return infoRelays.filter(function (row) {
    return row && (row.claimed || row.owned) && row.census && row.census.relayKey;
  });
}

// ── THE TABLE THAT IS THE WHOLE POINT ────────────────────────────────
//
//   Andy: "i have no idea which 'relay' contains which 'label' of mine."
//
// So it is a list of relays and what each one calls you, and a row that
// disagrees with the name above is MARKED. Nothing else: the relay's own
// caption is how a person knows which box this is, and every other fact
// about a membership belongs to Natter's screen for it.
function infoDrawRelays() {
  var box = document.getElementById('info-relays');
  if (!box) return;

  var escape = infoApi && infoApi.escapeHtml
    ? infoApi.escapeHtml
    : function (s) { return String(s); };

  if (!infoRelays.length) {
    // Absent rather than an empty table (§1): a node on no relay has
    // nothing to distribute to, and a heading over nothing is a thing to
    // read and dismiss.
    box.innerHTML = '';
    return;
  }

  var wanted = (infoCard && infoCard.name) || '';
  box.innerHTML =
    '<div class="label">What each relay calls you</div>' +
    '<table class="jobs-table"><thead><tr>' +
      '<th>Relay</th><th>Calls you</th><th></th>' +
    '</tr></thead><tbody>' +
    infoRelays.map(function (row) {
      var seat = !!(row.claimed || row.owned);
      var calls = seat ? (row.claimedLabel || '') : '';
      var pushed = infoPushed[row.url];

      // WHAT TO SAY IN THE LAST COLUMN, in the order a person needs it:
      // what just happened to this relay, then whether it agrees, then
      // why it is not in the conversation at all.
      var note = '';
      if (pushed && !pushed.ok) note = pushed.why;
      else if (!seat) note = 'no seat here';
      else if (!row.census || !row.census.relayKey) note = 'has not said what its key is';
      else if (wanted && calls && calls !== wanted) note = 'out of step';
      else if (!calls) note = 'enrolled, but unnamed';

      return '<tr>' +
        '<td>' + escape(row.label || row.url) + '</td>' +
        '<td>' + escape(calls || '—') + '</td>' +
        '<td>' + escape(note) + '</td>' +
        '</tr>';
    }).join('') +
    '</tbody></table>';
}

function infoLoad() {
  return infoApi.verb('node.card', {}).then(function (r) {
    if (!r || !r.body || !r.body.ok) {
      infoSay('info-name-error', (r && r.body && r.body.error) || 'this node has no key yet', true);
      return;
    }
    infoCard = r.body;
    infoDraw();
  });
}

// ASKED OF EVERY RELAY, which is one call: `relay.status` probes them all
// and answers a row each. It reaches the network, so the screen is drawn
// from the local card first and this fills the table when it lands — a
// relay on another continent must not hold up a text box on this machine.
//
// A FAILURE HERE IS NOT AN ERROR ON THE NAME. It means the table cannot
// be drawn yet, and saying so beside the field would blame the field.
function infoLoadRelays() {
  return infoApi.verb('relay.status', {}).then(function (r) {
    var said = (r && r.body) || {};
    infoRelays = Array.isArray(said.rows) ? said.rows : [];
    infoDrawRelays();
  }).catch(function () {
    infoRelays = [];
    infoDrawRelays();
  });
}

// ── ONE NAME, SENT EVERYWHERE ────────────────────────────────────────
//
// A rename is an ordinary packet addressed to the relay's own key — the
// same call natterDetails made one relay at a time, and the same verb the
// relay has always answered (relay.renameSelf). What is new here is only
// that it is said to all of them at once.
//
// EVERY RELAY IS ASKED INDEPENDENTLY and one refusal costs the others
// nothing. That is not politeness, it is the only workable rule: a relay
// may be down for days, and an all-or-nothing save would mean nobody can
// ever change their name while one box is offline.
function infoPush(label) {
  var seats = infoSeats();
  if (!seats.length) return Promise.resolve(0);

  return Promise.all(seats.map(function (row) {
    return infoApi.peerPost('relay', row.census.relayKey, { rename: { label: label } })
      .then(function (r) {
        var said = (r && r.body) || {};
        if (r && r.ok && said.ok) {
          infoPushed[row.url] = { ok: true, label: said.label };
          return true;
        }
        // WHY, not just no. "name reserved by a live invite" and "that
        // peer is not reachable right now" are different problems with
        // different answers, and a row that said only "failed" would
        // send somebody to the wrong one.
        infoPushed[row.url] = {
          ok: false,
          why: said.error || (r && r.error) || 'no answer',
        };
        return false;
      })
      .catch(function (e) {
        infoPushed[row.url] = { ok: false, why: String((e && e.message) || e) };
        return false;
      });
  })).then(function (results) {
    return results.filter(Boolean).length;
  });
}

// SAVE IS ONE GESTURE AND TWO ACTS. The local write is the INTENT — what
// this node means to be called, and what nodeCard answers to a stranger
// — and the posts are the attempt. The local write goes FIRST and stands
// even when every relay refuses: otherwise a node with one unreachable
// relay could never record what it wants to be called.
function infoSaveName() {
  var box = document.getElementById('info-name');
  if (!box || infoBusy) return Promise.resolve();

  // ASKED HERE FIRST, and the wire is not troubled when the answer is
  // already known. The node asks the same question of the same rule, so
  // this is a courtesy and never the only check (js/labelRule.js).
  var bad = infoNameProblem(box.value);
  if (bad) { infoSay('info-name-error', bad, true); return Promise.resolve(); }

  infoBusy = true;
  return infoApi.verb('node.setName', { name: box.value }).then(function (r) {
    var said = (r && r.body) || {};
    if (!said.ok) {
      infoSay('info-name-error', said.error || 'could not save', true);
      return null;
    }
    infoCard.name = said.name;
    infoDraw();

    var seats = infoSeats().length;
    if (!seats) { infoSay('info-name-error', 'saved', false); return null; }

    infoSay('info-name-error', 'saved — telling ' + seats + ' relay(s)…', false);
    return infoPush(said.name).then(function (took) {
      // RE-ASKED, NOT ASSUMED. The table must show what the RELAYS say,
      // and this is the moment believing our own copy would be worst: a
      // relay can refuse, and a row already painted with the new name
      // would be showing a label nobody answers to.
      return infoLoadRelays().then(function () {
        infoSay('info-name-error',
          took === seats
            ? 'saved, and ' + seats + ' relay(s) agree'
            : 'saved here — ' + (seats - took) + ' of ' + seats +
              ' relay(s) did not take it',
          took !== seats);
      });
    });
  }).then(function () { infoBusy = false; })
    .catch(function () { infoBusy = false; });
}

function infoSaveDescription() {
  var box = document.getElementById('info-description');
  if (!box) return;

  var bad = infoDescribeProblem(box.value);
  if (bad) { infoSay('info-description-error', bad, true); return; }

  infoApi.verb('node.setDescription', { description: box.value }).then(function (r) {
    var said = (r && r.body) || {};
    if (!said.ok) {
      infoSay('info-description-error', said.error || 'could not save', true);
      return;
    }
    // WHAT WAS STORED, not what was typed. If the node trimmed it, the
    // field shows the trim — the person finds out here, looking at it,
    // rather than the next time somebody else reads their card.
    var trimmed = said.description !== box.value;
    infoCard.description = said.description;
    infoDraw();
    infoSay('info-description-error',
      trimmed ? 'saved, trimmed to fit' : 'saved', false);
  });
}

// Return saves, in both boxes. The button at the end of the row is the
// same gesture (§3) — this is for the hand that never leaves the keyboard,
// and it is what every other single-field form in the shell already does.
function infoOnKey(event, save) {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  save();
}

spirit.shell.activateApp({
  mount: function (container, api) {
    infoApi = api;

    container.innerHTML =
      '<div class="stat-tile wide">' +
        '<div class="label">What this node says about itself</div>' +
        // The one thing worth saying before two boxes: these are answered
        // to anybody who asks, which is not obvious from a form and is
        // the whole reason to think before typing in one.
        '<div class="job-manifest-note">Anybody who asks this node is told these two ' +
          'things, whether or not you have ever met. Nothing else about this box is ' +
          'answered to a stranger. Your name is also what every relay you are on is ' +
          'asked to call you, so saving it here sends it to all of them.</div>' +

        '<div class="start-job-form card">' +
          '<label class="field-label grow">Name' +
            '<input type="text" id="info-name" placeholder="what people see, everywhere">' +
          '</label>' +
          '<button type="button" id="info-name-save">Save</button>' +
        '</div>' +
        '<div id="info-name-error" class="job-start-error"></div>' +

        '<div class="start-job-form card">' +
          '<label class="field-label grow">Description' +
            '<input type="text" id="info-description" ' +
              'placeholder="a sentence somebody who has just found you would want to read">' +
          '</label>' +
          '<button type="button" id="info-description-save">Save</button>' +
        '</div>' +
        '<div id="info-description-count" class="job-manifest-note"></div>' +
        '<div id="info-description-error" class="job-start-error"></div>' +
      '</div>' +

      // ── AND WHO IS WEARING IT ───────────────────────────────────────
      //
      // Its own panel, below the form and never inside it: this is a
      // READING, not a control (§3), and it answers a different question
      // from the boxes above — not "what do I want to be called" but
      // "what am I actually called, out there". Empty until the probe
      // lands, and empty for good on a node that is on no relay, which is
      // a panel that draws nothing rather than a heading over nothing.
      '<div class="stat-tile wide" id="info-relays"></div>' +

      // ── THE FOOT, WHICH IS THE PART NOBODY EDITS ────────────────────
      //
      // Fine print at the bottom of the page (§2), which is where the
      // Relay Chat footer puts this node's own key ending for the same
      // reason: it is there to be read out when somebody needs it, not
      // to be looked at.
      '<div class="job-manifest-note" id="info-foot">' +
        '<div>This node\'s key. It is the identity — the name above is a caption ' +
          'it wears, and a caption can be changed while this cannot.</div>' +
        '<div id="info-key"></div>' +
      '</div>';

    document.getElementById('info-name-save')
      .addEventListener('click', infoSaveName);
    document.getElementById('info-description-save')
      .addEventListener('click', infoSaveDescription);

    document.getElementById('info-name')
      .addEventListener('keydown', function (e) { infoOnKey(e, infoSaveName); });

    var description = document.getElementById('info-description');
    description.addEventListener('keydown', function (e) { infoOnKey(e, infoSaveDescription); });
    // While the cursor is in the box, not after it leaves: the number is
    // only useful to somebody deciding what to cut.
    description.addEventListener('input', infoCount);

    // TWO CALLS, NOT ONE AWAITING THE OTHER. The card is a file on this
    // disk and lands at once; the relay table is a probe of every
    // configured mailbox and takes as long as the slowest of them. A
    // screen that waited for the second to draw the first would open
    // blank because a box in another country is slow.
    infoLoad();
    infoLoadRelays();
  },
});
