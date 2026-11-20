'use strict';
// spirit/run/spirit/app/testicle/element/statusBox.js
// THE STATUS BOX, AN ELEMENT OF ITS OWN (goal/G47.1, box v134-135: "every part of testicle's face is an element of its own,
// just spirit/app/testicle/element/<element-name>.js", "element/statusBox.js (the monitor row with its status box)"). It was
// monitorRow in ../element.js. Its test: ./test/statusBox.js.
//
//   spirit.element.spirit.app.testicle.element.statusBox.create(container) -> { destroy() }
//
// THE MONITOR ROW (goal/G47.1, the box: "testicle's face has a monitor row above the workbench. It shows first the busy status
// in icon form, 🛌 idle (sleeping), 🚶‍➡️ working, as the server streams it ...; then the last change", "The row has a constant
// height, and the message is ellipsed, never wrapped"); THE MODE AHEAD OF IT (box v80, 2: "🤖 auto / 🖖 interactive, ahead of
// the 🛌/🚶‍➡️ icon, from the stream"). It draws what testicle's cache manager keeps of the stream (../data.js, monitor), and asks nothing but the
// preferences, once.
// THE STATUS BAR (goal/G47.4, the box, ### status bar): the status icons in an inline block on the left edge, then a block of
// two rows on top of each other, so the icons get the extra height. Row 1 "<suites owed>: <suite file name>", row 2 "<tests
// reported>: <script file name>", counting up; while the classifier runs, row 1 names its file and row 2 reads "<n> of
// <total>: <script>". The numbers are related info, "watching water boil": suites owed is testicle's count of suites marked
// needs running, in this run or not. No test titles and no results; both rows empty when no run is active. It replaces the
// last-change line, the doing text, "<x> of <n> reported" and the ⏳ count (wsl's red: "The ⏳ count goes; suites owed
// replaces it").
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26; Andy: "the fucking status box must require the fucking api and make sure the
  // fucking data.js is installed"): the icon element, spirit.data, testicle's interface and testicle's cache manager, its
  // data.js, which the page's one stream feeds. Mounted alone, it gets its data by itself.
  var parts = Promise.all([S.require('spirit/element/icon.js'), S.require('spirit/data.js'), S.require('spirit/app/testicle/api.js'), S.require('spirit/app/testicle/words.js')]);
  // Its words testicle's own (goal/G47.1; ../words.js): every line it shows worded there, none here.
  function W() { return S.required.spirit.app.testicle.words; }
  parts.catch(function () {});

  function runningOf(m) {
    try { var r = m && m.running ? JSON.parse(m.running) : null; return r && typeof r === 'object' && (r.suite || r.classifier) ? r : null; } catch (e) { return null; }
  }
  // The two rows' words for the run going, or two empty rows when none is.
  function rowsOf(m) {
    var run = runningOf(m);
    if (!run) return ['', ''];
    var owed = m.owed && typeof m.owed.suites === 'number' ? m.owed.suites : 0;
    if (run.classifier) return [W().counted(owed, run.classifier), run.script ? W().classified(Number(run.classified) || 0, Number(run.total) || 0, run.script) : ''];
    return [W().counted(owed, run.suite), W().counted(Number(run.tested) || 0, run.script || '')];
  }

  var ROW = 'display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3em';
  function create(container) {
    var gone = false;
    var release = null;
    var releaseMode = null;
    var shown = null;
    var shownMode = null;
    // Its box keeps what it holds inside (overflow hidden); each row one line, ellipsed, never wrapped.
    container.innerHTML = '<div class="testicle-status" style="display:flex;align-items:center;height:2.6em;overflow:hidden;white-space:nowrap">' +
      '<span class="testicle-icons" style="display:inline-flex;align-items:center;flex:none"><span class="testicle-mode"></span>&nbsp;<span class="testicle-busy"></span>&nbsp;</span>' +
      '<span class="testicle-rows" style="display:inline-flex;flex-direction:column;flex:1;min-width:0;overflow:hidden">' +
      '<span class="testicle-row" style="' + ROW + '"></span><span class="testicle-row" style="' + ROW + '"></span></span></div>';
    var mode = container.querySelector('.testicle-mode');
    var icon = container.querySelector('.testicle-busy');
    var rows = container.querySelectorAll('.testicle-row');
    // Through the icon element, as every pictograph is drawn (spirit/element/icon.js; the general rules).
    function paint(box, glyph) {
      var I = S.element && S.element.spirit && S.element.spirit.element.icon;
      if (!I) return false;
      box.innerHTML = '';
      I.create(box, { glyph: glyph });
      return true;
    }
    function draw() {
      if (gone) return;
      var m = S.data.testicle.data.monitor.get();
      var busy = !!(m && m.busy);
      var glyph = busy ? '🚶‍➡️' : '🛌';
      if (glyph !== shown && paint(icon, glyph)) shown = glyph;
      icon.title = busy ? 'working' : 'idle';
      var words = rowsOf(m || {});
      [0, 1].forEach(function (i) { if (rows[i].textContent !== words[i]) { rows[i].textContent = words[i]; rows[i].title = words[i]; } });
    }
    function drawMode(p) {
      if (gone || !p || typeof p.interactive !== 'boolean') return;
      var glyph = p.interactive ? '🖖' : '🤖';
      if (glyph !== shownMode && paint(mode, glyph)) shownMode = glyph;
      mode.title = p.interactive ? 'interactive' : 'auto';
    }
    parts.then(function () {
      if (gone) return;
      var D = S.data.testicle.data;
      // The mode it stands at, asked once; the stream keeps it after.
      Promise.resolve(S.testicle.preferences({})).then(function (p) { if (!gone) D.preferences.keep(p); }, function () {});
      draw();
      release = D.monitor.watch(draw);
      drawMode(D.preferences.get());
      releaseMode = D.preferences.watch(drawMode);
    }, function () {});
    return {
      destroy: function () {
        gone = true;
        [release, releaseMode].forEach(function (r) { if (typeof r === 'function') r(); });
        release = releaseMode = null;
        container.innerHTML = '';
      },
    };
  }

  S.require('spirit/element/installSpiritElement.js').then(function () { S.required.spirit.element.installSpiritElement(S, 'spirit/app/testicle/element/statusBox.js', { create: create }); });
}());
