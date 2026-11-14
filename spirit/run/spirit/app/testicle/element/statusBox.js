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
// the 🛌/🚶‍➡️ icon, from the stream"); WHAT IT IS DOING (Andy: "do that"): while the server classifies or tests, what the
// server says. It draws what testicle's cache manager keeps of the stream (../data.js, monitor), and asks nothing but the
// preferences, once.
// EACH SUITE AS IT REPORTS (box v134-135: "the status box is built inside its own element: it listens to the suite table's row
// changes on the stream, knows which suite is running and for which scripts, and shows \"<x> of <n> reported: <script>
// <success|failure>\""): the stream says what runs (monitor.running: its suite, its scripts, when it started); every suite row
// of that suite and one of those scripts set since the start (its flag cleared by testicle.suite.success) is one reported, the
// newest one named with its outcome.
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26; Andy: "the fucking status box must require the fucking api and make sure the
  // fucking data.js is installed"): the icon element, spirit.data, testicle's interface and testicle's cache manager, its
  // data.js, which the page's one stream feeds. Mounted alone, it gets its data by itself.
  var parts = Promise.all([S.require('spirit/element/icon.js'), S.require('spirit/data.js'), S.require('spirit/app/testicle/api.js'), S.cacheManager('testicle')]);
  parts.catch(function () {});

  // The last change, in words: a test row's key ends in its flip, which says nothing to a reader, so it is left off.
  function lastWords(last) {
    if (!last || !last.key) return '';
    var what = last.table === 'testicle' ? String(last.key).split('|').slice(0, 3).join(' | ') : String(last.key).split('|').join(' | ');
    return String(last.change || 'updated') + ' ' + last.table + ': ' + what;
  }
  function runningOf(m) {
    try { var r = m && m.running ? JSON.parse(m.running) : null; return r && r.suite && Array.isArray(r.scripts) ? r : null; } catch (e) { return null; }
  }
  // "<x> of <n> reported: <script> <success|failure>" for the run going, or '' while none of its scripts has reported.
  function reportedWords(run) {
    var D = S.data.testicle.data;
    var b = S.data.getPath(D.branch('suite')) || {};
    var started = Number(run.started) || 0;
    var done = run.scripts.map(function (s) { return b[s + '|' + run.suite]; }).filter(function (r) {
      return r && !r.test && (r.outcome === 'green' || r.outcome === 'red') && Number(r.changed) >= started;
    });
    if (!done.length) return '';
    var last = done.slice().sort(function (a, c) { return Number(c.changed) - Number(a.changed); })[0];
    return done.length + ' of ' + run.scripts.length + ' reported: ' + last.script + ' ' + (last.outcome === 'green' ? 'success' : 'failure');
  }

  function create(container) {
    var gone = false;
    var release = null;
    var releaseMode = null;
    var releaseSuite = null;
    var shown = null;
    var shownMode = null;
    // A constant height, the message ellipsed and never wrapped; its box keeps what it holds inside (overflow hidden).
    container.innerHTML = '<div class="testicle-status" style="display:flex;align-items:center;height:1.8em;line-height:1.8em;overflow:hidden;white-space:nowrap">' +
      '<span class="testicle-mode" style="flex:none"></span>&nbsp;<span class="testicle-busy" style="flex:none"></span>&nbsp;' +
      '<span class="testicle-last" style="flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis"></span></div>';
    var mode = container.querySelector('.testicle-mode');
    var icon = container.querySelector('.testicle-busy');
    var line = container.querySelector('.testicle-last');
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
      var run = runningOf(m);
      if (run) askRun(run);
      var words = (run && reportedWords(run)) || ((m && typeof m.doing === 'string' && m.doing) ? m.doing : lastWords(m && m.last));
      line.textContent = words;
      line.title = words;
    }
    // A RUN SEEN FOR THE FIRST TIME: its scripts' suite rows asked once (suite.search, each script), so a box mounted while it
    // runs counts the scripts that reported before it was there; the stream brings every one after.
    var asked = '';
    function askRun(run) {
      var id = run.suite + '|' + run.started;
      if (id === asked) return;
      asked = id;
      var name = run.suite.slice(run.suite.lastIndexOf('/') + 1);
      run.scripts.forEach(function (script) {
        Promise.resolve(S.testicle['suite.search']({ script: script, text: name })).then(function (b) {
          if (gone) return;
          var rows = ((b && b.items) || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return null; } }).filter(Boolean);
          S.data.testicle.data.keep('suite', rows);
        }, function () {});
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
      var D = S.data.testicle.data;
      // The mode it stands at, asked once; the stream keeps it after.
      Promise.resolve(S.testicle.preferences({})).then(function (p) { if (!gone) D.preferences.keep(p); }, function () {});
      draw();
      release = D.monitor.watch(draw);
      releaseSuite = D.suite.watch(draw);
      drawMode(D.preferences.get());
      releaseMode = D.preferences.watch(drawMode);
    }, function () {});
    return {
      destroy: function () {
        gone = true;
        [release, releaseMode, releaseSuite].forEach(function (r) { if (typeof r === 'function') r(); });
        release = releaseMode = releaseSuite = null;
        container.innerHTML = '';
      },
    };
  }

  S.require('spirit/element/installSpiritElement.js').then(function () { S.required.spirit.element.installSpiritElement(S, 'spirit/app/testicle/element/statusBox.js', { create: create }); });
}());
