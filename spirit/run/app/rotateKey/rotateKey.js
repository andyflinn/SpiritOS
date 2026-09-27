// spirit/run/app/rotateKey/rotateKey.js
// THE ROTATE-KEY DIALOG — cycle-10/R13.
//
//   Andy, 2026-09-26: "so rotation is a crisis.measure and should not be
//   used wastefully", "it must be made available in a portion of the UI
//   with the are-you-sure mechanism", "the place would be the info app",
//   "and from the info-app it should invoke the rotate key dialog." And
//   retitling the requirement: "Get the damn rotate-button into the info
//   app".
//
// The explanation comes first, because pressing a red button twice only
// protects someone who knows what they are agreeing to. The button is the
// shell's two-press one: red when armed, and disarmed the moment attention
// moves (armUntilElsewhere), so a confirmation can never land on a question
// he has forgotten being asked.

var rkApi = null;
var rkArmed = false;
var rkBusy = false;
var rkResult = null;

function rkEsc(s) { return rkApi.escapeHtml(String(s == null ? '' : s)); }

function rkDisarm() { rkArmed = false; rkDraw(); }

function rkDraw() {
  var el = document.getElementById('rk-body');
  if (!el) return;
  var done = rkResult && rkResult.ok;
  var failed = rkResult && !rkResult.ok;
  el.innerHTML =
    '<div class="stat-tile wide">' +
      '<div class="label">Rotate this node\'s cipher key</div>' +
      '<div><b>When to use it:</b> you believe this node\'s cipher key has been copied or seen, ' +
        'for example because the box was broken into or a backup of its home went somewhere it should not.</div>' +
      '<div><b>What it does:</b> makes a new cipher key and throws the old one away. Your identity stays the ' +
        'same; only the key others seal to changes. The new card goes to every relay you are on at once, and ' +
        'peers pick it up the next time they post to you.</div>' +
      '<div><b>What it costs:</b> anything already sealed to the old key and still on its way cannot be ' +
        'opened. Peers who are offline catch up when they next post.</div>' +
      '<div><b>What it does not do:</b> protect what was sent before. Whoever holds the old key can still ' +
        'read anything they captured with it.</div>' +
      '<div class="job-manifest-note">It is a crisis measure, not a routine one.</div>' +
    '</div>' +
    (done
      ? '<div class="stat-tile wide"><div class="label">Rotated</div><div>This node\'s card is now number ' +
          rkEsc(rkResult.at) + ', handed to ' + rkEsc(rkResult.relays) + ' relay(s).</div></div>'
      : '<div class="start-job-form card"><button type="button" id="rk-rotate"' +
          (rkArmed ? ' data-armed="yes"' : '') + (rkBusy ? ' disabled' : '') + '>' +
          (rkArmed ? 'Rotate the key: press again' : 'Rotate the key') + '</button></div>') +
    '<div class="job-start-error">' + (failed ? rkEsc(rkResult.error || 'refused') : '') + '</div>';
}

function rkRotate() {
  rkBusy = true;
  rkDraw();
  rkApi.verb('node.rotateCipher', {}).then(function (r) {
    rkBusy = false;
    rkResult = (r && r.body) || { ok: false, error: 'no answer' };
    rkDraw();
  }, function (e) {
    rkBusy = false;
    rkResult = { ok: false, error: e.message };
    rkDraw();
  });
}

spirit.shell.activateApp({
  mount: function (container, api) {
    rkApi = api;
    container.innerHTML = '<div id="rk-body" class="stack"></div>';
    // Delegated, because the body is repainted when the button arms.
    document.getElementById('rk-body').addEventListener('click', function (event) {
      if (!event.target || event.target.id !== 'rk-rotate' || rkBusy) return;
      if (!rkArmed) {
        rkArmed = true;
        rkApi.armUntilElsewhere(rkDisarm);
        rkDraw();
        return;
      }
      rkArmed = false;
      rkRotate();
    });
  },

  // Every open starts disarmed and without an old result: two presses must
  // mean two presses in THIS visit.
  open: function () {
    rkArmed = false;
    rkBusy = false;
    rkResult = null;
    rkDraw();
  },
});
