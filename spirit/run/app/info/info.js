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
// ── WHAT THIS SCREEN IS NOT ──────────────────────────────────────────
//
// NOT your name on a relay. A label is not an identity (R1): a relay's
// ledger holds one label per key per mailbox, and Natter is where those
// are set. This name never travels to a relay — it is what this box calls
// itself, and what it was minted with on its first claim.
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
// changes on its own — this app is the only writer of either field — and
// a repaint while somebody is typing takes the cursor out of the box.
// Every app that needed a focus guard needed it because it was being
// ticked; the way not to need one is not to be.

var infoApi = null;

// What the node last told us, so a repaint after a save draws what was
// STORED rather than what was typed. The description is trimmed to fit at
// 128 bytes, and a field that keeps showing the longer version is a field
// lying about what strangers are being told.
var infoCard = null;

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

function infoSaveName() {
  var box = document.getElementById('info-name');
  if (!box) return;

  // ASKED HERE FIRST, and the wire is not troubled when the answer is
  // already known. The node asks the same question of the same rule, so
  // this is a courtesy and never the only check (js/labelRule.js).
  var bad = infoNameProblem(box.value);
  if (bad) { infoSay('info-name-error', bad, true); return; }

  infoApi.verb('node.setName', { name: box.value }).then(function (r) {
    var said = (r && r.body) || {};
    if (!said.ok) { infoSay('info-name-error', said.error || 'could not save', true); return; }
    infoCard.name = said.name;
    infoDraw();
    infoSay('info-name-error', 'saved', false);
  });
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
          'answered to a stranger.</div>' +

        '<div class="start-job-form card">' +
          '<label class="field-label grow">Name' +
            '<input type="text" id="info-name" placeholder="what this node calls itself">' +
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

      // ── THE FOOT, WHICH IS THE PART NOBODY EDITS ────────────────────
      //
      // Fine print at the bottom of the page (§2), which is where the
      // Relay Chat footer puts this node's own key ending for the same
      // reason: it is there to be read out when somebody needs it, not
      // to be looked at.
      '<div class="job-manifest-note" id="info-foot">' +
        '<div>This node\'s key. It is the identity — the name above is only a caption.</div>' +
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

    infoLoad();
  },
});
