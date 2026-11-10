'use strict';
// spirit/run/spirit/element/rotateKey.js
// THE ROTATE KEY DIALOG, AN ELEMENT (goal/G43.24, requirement 8; cycle-10/R13). Its contract and its test: ./test/rotateKey.md
// and ./test/rotateKey.js.
//
//   Andy, 2026-09-26: "so rotation is a crisis.measure and should not be used wastefully", "it must be made available in a
//   portion of the UI with the are-you-sure mechanism", "the place would be the info app", "and from the info-app it should
//   invoke the rotate key dialog." And on G43.24: "it's just a panel that opens exactly overtop of the calling panel,
//   new-shell-style.", "like fstat".
//
//   spirit.elements.rotateKey.create(container) -> { destroy() }; its arming button hears a click elsewhere itself (goal/G43.24),
//   so it is mounted with its container alone
//
// nodeInfo opens it as a layer over Info through panel.js (spirit/element/nodeInfo.js), as file opens fstat. The explanation
// comes first, because pressing a red button twice only protects someone who knows what they are agreeing to. The button is
// the shell's two-press one (armingButton): red when armed, disarmed the moment attention moves. Every create starts
// disarmed and without an old result: two presses must mean two presses in this visit. The rotation is the node family's
// own verb, spirit.node.rotateCipher.
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the arming button.
  var parts = S.require('spirit/element/armingButton.js');

  function create(container) {
    var busy = false;
    var result = null;
    var gone = false;
    function esc(s) { return S.escapeHtml ? S.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s); }
    container.innerHTML = '';
    var body = document.createElement('div');
    body.className = 'stack';
    container.appendChild(body);

    function draw() {
      if (gone) return;
      var done = result && result.ok;
      var failed = result && !result.ok;
      body.innerHTML =
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
              esc(result.at) + ', handed to ' + esc(result.relays) + ' relay(s).</div></div>'
          : '<div class="start-job-form card"><button type="button" data-rotate' + (busy ? ' disabled' : '') + '>Rotate the key</button></div>') +
        '<div class="job-start-error">' + (failed ? esc(result.error || 'refused') : '') + '</div>';
      // THE ARE-YOU-SURE IS THE SHELL'S (goal/G41.9): an armingButton; its second press rotates.
      var b = body.querySelector('[data-rotate]');
      if (b) parts.then(function () {
        if (gone) return;
        S.element.spirit.element.armingButton.attach(b, { label: 'Rotate the key', armedLabel: 'Rotate the key: press again', run: rotate });
      });
    }

    function rotate() {
      busy = true;
      draw();
      S.outcome(Promise.resolve(S.ready).then(function (s) { return s.node.rotateCipher({}); })).then(function (r) {
        busy = false;
        result = r && r.status === 200 && r.body ? r.body : { ok: false, error: (r && r.body && (r.body.error || r.body.code)) || 'no answer' };
        draw();
      });
    }

    draw();
    return { destroy: function () { gone = true; container.innerHTML = ''; } };
  }

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/rotateKey.js', { create: create }); });
}());
