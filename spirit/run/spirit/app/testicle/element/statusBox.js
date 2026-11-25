'use strict';
// spirit/run/spirit/app/testicle/element/statusBox.js
// THE STATUS BOX, AN ELEMENT OF ITS OWN (goal/G47.1, box v134-135: "every part of testicle's face is an element of its own,
// just spirit/app/testicle/element/<element-name>.js", "element/statusBox.js (the monitor row with its status box)"). It was
// monitorRow in ../element.js. Its test: ./test/statusBox.js.
//
//   spirit.required.spirit.app.testicle.element.statusBox.create(container) -> { destroy() }
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
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26; Andy: "the fucking status box must require the fucking api and make sure the
  // fucking data.js is installed"): the icon element, spirit.required.spirit.data, testicle's interface and testicle's cache manager, its
  // data.js, which the page's one stream feeds. Mounted alone, it gets its data by itself.
  var parts = Promise.all([keepAnswer('spirit/element/icon/script.js'), keepAnswer('spirit/data/script.js'), keepAnswer('spirit/app/testicle/api.js'), keepAnswer('spirit/app/testicle/words.js')]);
  // Its words testicle's own (goal/G47.1; ../words.js): every line it shows worded there, none here.
  function W() { return ANSWER['spirit/app/testicle/words.js']; }
  parts.catch(function () {});

  function runningOf(m) {
    try { var r = m && m.running ? JSON.parse(m.running) : null; return r && typeof r === 'object' && (r.suite || r.classifier) ? r : null; } catch (e) { return null; }
  }
  // The two rows for the run going, each [number, words] with its number apart, or two empty rows when none is.
  function rowsOf(m) {
    var run = runningOf(m);
    // IDLE, THE TWO LEADERS OF THE REDS (goal/G48.4, Andy: "when idle, the status bar could show the most relevant information
    // regarding these priorities", then "go!"): row 1 the test red for the most scripts, row 2 the script with the most reds,
    // each with its count, as the stream keeps them (../data.js, monitor.leaders); empty when nothing is red.
    if (!run) {
      var l = m && m.leaders;
      var t = l && l.test, s = l && l.script;
      return [t ? W().leadTest(t.n, t.test, t.suite) : ['', ''], s ? W().leadScript(s.n, s.script) : ['', '']];
    }
    var owed = m.owed && typeof m.owed.suites === 'number' ? m.owed.suites : 0;
    if (run.classifier) return [W().counted(owed, run.classifier), run.script ? W().classified(Number(run.classified) || 0, Number(run.total) || 0, run.script) : ['', '']];
    return [W().counted(owed, run.suite), W().counted(Number(run.tested) || 0, run.script || '')];
  }

  var ROW = 'display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3em';
  // THE NUMBERS AND THE ICONS SIZED (goal/G47.4, Andy: "the icons must be of size 2em. the two numbers, starting the two rows
  // must be fixed width, 6em, right aligned, and invisible when zero.", then "a width of 4em for the two numbers is likely
  // enough"): each row's number in a box of its own, 4em wide,
  // right aligned, hidden (its room kept) when it is zero; the icons at 2em.
  var NUM = 'display:inline-block;width:4em;text-align:right';
  // EACH ICON CENTRED IN THE BUBBLE'S HEIGHT (Andy: "the two icons should be vertically centered"): a flex box of the
  // block's full height, its icon in the middle, not on a text line's baseline.
  var ICON = 'display:inline-flex;align-items:center;height:100%';
  var ROW_HTML = '<span class="testicle-row" style="' + ROW + '"><span class="testicle-num" style="' + NUM + '"></span><span class="testicle-words"></span></span>';
  function create(container) {
    var gone = false;
    var release = null;
    var releaseMode = null;
    var shown = null;
    var shownMode = null;
    // Its box keeps what it holds inside (overflow hidden); each row one line, ellipsed, never wrapped. THE WHOLE BLOCK IN A
    // BUBBLE (goal/G47.4, Andy: "the whole status block in a bubble, the icons vertically centered in that bubble."): the
    // shared .shell-bubble, its two rows' height plus its padding and border, the icons centred in it.
    container.innerHTML = '<div class="testicle-status shell-bubble" style="display:flex;align-items:center;height:calc(2.6em + 0.6em + 2px);overflow:hidden;white-space:nowrap">' +
      '<span class="testicle-icons" style="display:inline-flex;align-items:center;flex:none;font-size:2em;line-height:1;align-self:stretch"><span class="testicle-mode" style="' + ICON + '"></span>&nbsp;<span class="testicle-busy" style="' + ICON + '"></span>&nbsp;</span>' +
      '<span class="testicle-rows" style="display:inline-flex;flex-direction:column;flex:1;min-width:0;overflow:hidden">' +
      ROW_HTML + ROW_HTML + '</span>' +
      // THE NUMBER OF REDS IN A LARGE RED BOX AT THE RIGHT EDGE (goal/G48.4, Andy: "the number of reds, and displaying it in a
      // large, RED box at the right windows edge of the status bar"): the count the stream keeps (../data.js, monitor.reds),
      // invisible at zero as the bar's other numbers are, its room kept. DOUBLE LARGE, 3EM WIDE (Andy: "the box is at the right
      // window edge or the status bar, double large, like the icons on the right side of the status bar, fixed width 3em").
      '<span class="testicle-reds" data-reds="" style="flex:none;align-self:stretch;display:inline-flex;align-items:center;justify-content:center;' +
      'width:3em;overflow:hidden;font-size:2em;font-weight:bold;line-height:1;color:#fff;background:#d00;border-radius:0.2em;visibility:hidden"></span></div>';
    var redBox = container.querySelector('.testicle-reds');
    var mode = container.querySelector('.testicle-mode');
    var icon = container.querySelector('.testicle-busy');
    var rows = container.querySelectorAll('.testicle-row');
    // Through the icon element, as every pictograph is drawn (spirit/element/icon/script.js; the general rules).
    function paint(box, glyph) {
      var I = ANSWER['spirit/element/icon/script.js'];
      if (!I) return false;
      box.innerHTML = '';
      I.create(box, { glyph: glyph });
      return true;
    }
    function draw() {
      if (gone) return;
      var m = ANSWER['spirit/data/script.js'].testicle.data.monitor.get();
      var busy = !!(m && m.busy);
      var glyph = busy ? '🚶‍➡️' : '🛌';
      if (glyph !== shown && paint(icon, glyph)) shown = glyph;
      icon.title = busy ? 'working' : 'idle';
      var reds = m && typeof m.reds === 'number' ? m.reds : 0;
      if (redBox.getAttribute('data-reds') !== String(reds)) {
        redBox.setAttribute('data-reds', String(reds));
        redBox.textContent = String(reds);
        redBox.title = reds + ' red';
        redBox.style.visibility = reds ? '' : 'hidden';
      }
      var words = rowsOf(m || {});
      [0, 1].forEach(function (i) {
        var num = rows[i].querySelector('.testicle-num'), say = rows[i].querySelector('.testicle-words'), w = words[i];
        if (num.textContent !== w[0]) num.textContent = w[0];
        num.style.visibility = /^0\D*$/.test(w[0]) ? 'hidden' : '';
        if (say.textContent !== w[1]) say.textContent = w[1];
        rows[i].title = w[0] + w[1];
      });
    }
    function drawMode(p) {
      if (gone || !p || typeof p.interactive !== 'boolean') return;
      var glyph = p.interactive ? '🖖' : '🤖';
      if (glyph !== shownMode && paint(mode, glyph)) shownMode = glyph;
      mode.title = p.interactive ? 'interactive' : 'auto';
    }
    parts.then(function () {
      if (gone) return;
      var D = ANSWER['spirit/data/script.js'].testicle.data;
      // The mode it stands at, asked once; the stream keeps it after.
      Promise.resolve(ANSWER['spirit/app/testicle/api.js'].preferences({})).then(function (p) { if (!gone) D.preferences.keep(p); }, function () {});
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

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
