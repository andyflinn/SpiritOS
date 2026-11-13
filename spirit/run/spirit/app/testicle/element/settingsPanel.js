'use strict';
// spirit/run/spirit/app/testicle/element/settingsPanel.js
// THE ⚙ SETTINGS PANEL, AN ELEMENT OF ITS OWN (goal/G47.1, box v134-135: "every part of testicle's face is an element of its
// own, just spirit/app/testicle/element/<element-name>.js", "element/settingsPanel.js (the ⚙ settings panel)"). It was
// configPanel in ../element.js. Its test: ./test/settingsPanel.js.
//
//   spirit.element.spirit.app.testicle.element.settingsPanel.create(container) -> { destroy() }
//
// THE CONFIGURATION PANEL (goal/G47.1, box v79, 2): "this icon will open a panel in the left workbech pane, titled: \"⚙
// Configuration\"", "the one switch it maintains in a rowForm is: interactive | auto where the default will be
// \"interactive\"". The switch is the preference interactive (box v79, 4): asked of the preferences verb once, then followed in
// testicle's branch, which the stream keeps; a press sends the other mode, and what a press did, a refusal, is said below the
// form. NO SAVE (box v80, 2: "the switch is the same style form the app uses for toggles (rowFormToggle); a change is sent to
// the server at once, and the server streams it back, which sets the switch"): on is interactive, off auto.
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the toggle row and testicle's interface.
  var parts = Promise.all(['spirit/element/search/app/rowFormToggle.js', 'spirit/app/testicle/api.js'].map(function (p) { return S.require(p); }));
  // A NODE WITH NO TESTICLE refuses its interface: the panel says so; the refusal is never left unhandled.
  parts.catch(function () {});

  function words(on) { return on ? 'interactive' : 'auto'; }

  function create(container) {
    var gone = false;
    var release = null;
    var toggle = null;
    var shown = null;
    // Its box keeps what it holds inside (overflow not visible).
    container.innerHTML = '<div class="testicle-config" style="height:100%;overflow:auto"><div class="testicle-title">⚙ Configuration</div><div class="testicle-config-form"></div>' +
      '<div class="testicle-config-said"></div></div>';
    var said = container.querySelector('.testicle-config-said');
    function draw(p) {
      if (gone || !toggle || !p || typeof p.interactive !== 'boolean') return;
      shown = p.interactive;
      toggle.set(shown, words(shown));
    }
    parts.then(function () {
      if (gone) return;
      toggle = S.element.spirit.element.search.app.rowFormToggle.create(container.querySelector('.testicle-config-form'), { on: true, words: '',
        press: function () {
          if (gone || typeof shown !== 'boolean') return;
          said.textContent = '';
          Promise.resolve(S.testicle.preferences({ interactive: !shown })).then(null, function (e) {
            if (!gone) said.textContent = String((e && e.message) || e || 'preferences failed');
          });
        } });
      return Promise.resolve(S.cacheManager('testicle')).then(function () {
        if (gone) return;
        var P = S.data.testicle.data.preferences;
        draw(P.get());
        release = P.watch(draw);
        // What it stands at before anything streamed: asked once, kept in the branch the switch follows.
        return Promise.resolve(S.testicle.preferences({})).then(function (p) { if (!gone) P.keep(p); });
      });
    }).then(null, function (e) { if (!gone) said.textContent = String((e && e.message) || e || 'preferences failed'); });
    return {
      destroy: function () {
        gone = true;
        if (typeof release === 'function') release();
        release = null;
        container.innerHTML = '';
      },
    };
  }

  S.require('spirit/element/installSpiritElement.js').then(function () { S.required.spirit.element.installSpiritElement(S, 'spirit/app/testicle/element/settingsPanel.js', { create: create }); });
}());
