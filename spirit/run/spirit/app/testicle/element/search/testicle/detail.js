'use strict';
// spirit/run/spirit/app/testicle/element/search/testicle/detail.js
// ONE TEST'S DETAIL, AN ELEMENT (goal/G47.1, the search cycle): its history of flips, what testicle's face shows in a closable
// tab when a test row of the testicle search is clicked (the box: "The testicle detail is a history of flips, and opens in a
// closable tab when a test row is clicked").
//
//   spirit.element.spirit.app.testicle.element.search.testicle.detail.create(container, { script, suite, test }) -> { destroy() }
//
// The box: "testicle.search answers the current rows by default; given a valid test title, {script, suite, test, text}, it
// answers every row matching that script, suite and title, current or not, newest first. A test's history in its detail
// comes from that, no new verb." The title line is the test's title in full, on top in a row form with its run button;
// below it every row, the newest flip first, each drawn by ./row.js with the date it flipped, its title and file names left
// out. It asks again whenever testicle publishes a row of this test. Between the title and the rows (goal/G47.4): the
// title's rename form (testicle.title), the full script path and the full suite path.
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): its row, testicle's interface and its cache manager.
  var parts = Promise.all(['spirit/app/testicle/element/search/testicle/row.js', 'spirit/app/testicle/api.js', 'spirit/element/rowForm.js', 'spirit/element/fieldInput.js']
    .map(function (p) { return S.require(p); }).concat([S.require('spirit/app/testicle/api.js')]));
  // A NODE WITH NO TESTICLE refuses its interface: create says the history could not be loaded; the refusal is never left unhandled.
  parts.catch(function () {});

  function esc(s) { return S.escapeHtml(String(s == null ? '' : s)); }
  function rowsOf(body) {
    return ((body && body.items) || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return null; } }).filter(Boolean);
  }

  function create(container, options) {
    var o = options || {};
    var script = String(o.script || '');
    var suite = String(o.suite || '');
    var test = String(o.test || '');
    var gone = false;
    var release = null;
    // ITS PATHS AND ITS 🏃 (goal/G47.1, box v130: "the testicle detail has a 🏃 run button for its script and suite; a press
    // stops the running suite and runs it first, as a top-10 fix does; the detail shows its full script and suite path"; Andy:
    // "the testicle detail doesn't show the full script name"): the script's and the suite's path in full under the title, and
    // the busy button the script tab's rows have, asking testicle.run for this script and suite.
    // FOUR ROWS, THEN THE LIST (goal/G47.4; Andy: "script, suite, title are all common to all rows in the list. so - row 1:
    // Title Bubble: presented as Row Form with a run button on the right side, like the ones in app for one-shot jobs - row 2:
    // rowForm for title change - row 3: script file name - fow 4: suite file name then the list"): row 1 the run form, its icon
    // 🏃 (a pictograph only in the icon element, the general rules), the title its line and run its button, as the app's task
    // row (spirit/element/monitor/task.js) has its name and Run; row 2 the title form, an input bounded by the description
    // rule ("new titles and the corresponding ui INPUT must be bounded by DESCRIPTION_MAX_BYTES"), its press asking
    // testicle.title; what a press refused is said below the bubbles.
    // THE SCRIPT AND THE SUITE EACH A ROW ON TOP, AND NONE OF THE THREE AS A COLUMN (Andy: "the list does NOT need to have a
    // description/title column, that repeats the above information EVERY single time....", then "give a row on top to the full
    // script filename", "give a row on top to the full suite filename", "and eliminate those columns, too."): every row is this
    // test of this script and suite, so the history keeps the flip, the result and the severity.
    container.innerHTML = '<div class="testicle-history fill" style="overflow:auto"><div data-history="runForm"></div>' +
      '<div data-history="titleForm"></div><div class="testicle-path shell-bubble" data-history="script"></div>' +
      '<div class="testicle-path shell-bubble" data-history="suite"></div><div class="testicle-said" data-history="said"></div>' +
      '<table class="testicle-flips" data-history="rows"><thead><tr><th>Flipped</th><th>Result</th><th>Severity</th></tr></thead><tbody></tbody></table></div>';
    container.querySelector('[data-history="script"]').textContent = script;
    container.querySelector('[data-history="suite"]').textContent = suite;
    // The title's line, put into row 1 once the row form is loaded.
    var titleLine = document.createElement('span');
    titleLine.className = 'testicle-title';
    titleLine.setAttribute('data-history', 'title');
    titleLine.textContent = test;
    var body = container.querySelector('tbody');

    var drawn = [];
    function draw(rows) {
      if (gone) return;
      drawn.forEach(function (el) { if (el && typeof el.destroy === 'function') el.destroy(); });
      drawn = [];
      body.innerHTML = rows.map(function (r) {
        var el = S.element.spirit.app.testicle.element.search.testicle.row.create(r);
        drawn.push(el);
        var when = r.flipped ? new Date(Number(r.flipped)).toISOString().replace('T', ' ').slice(0, 19) : '';
        return '<tr data-key="' + esc(r.key) + '"><td data-field="flipped">' + esc(when) + '</td>' +
          el.cells().filter(function (c) { return c.name !== 'test' && c.name !== 'script' && c.name !== 'suite'; }).map(function (c) { return '<td data-field="' + esc(c.name) + '">' + c.html + '</td>'; }).join('') + '</tr>';
      }).join('') || '<tr><td colspan="3">' + esc('No row of this test.') + '</td></tr>';
    }
    // ITS ROWS ARE THE BRANCH'S (goal/G47.1, the box: "Every element of testicle's face updates itself in response to the
    // server stream"): the history is asked once and kept in testicle's branch; what is drawn is every row of this test the
    // branch holds, newest flip first, drawn again on every change the stream brings.
    var prefix = script + '|' + suite + '|' + test + '|';
    function fromBranch() {
      var D = S.data.testicle.data;
      var b = S.data.getPath(D.branch('testicle'));
      return Object.keys(b || {}).filter(function (k) { return k.indexOf(prefix) === 0; }).map(function (k) { return b[k]; })
        .sort(function (a, c) { return Number(c.flipped) - Number(a.flipped); });
    }
    function ask() {
      return Promise.resolve(S.testicle['testicle.search']({ script: script, suite: suite, test: test, text: '' }))
        .then(function (b) { S.data.testicle.data.keep('testicle', rowsOf(b)); draw(fromBranch()); }, function (e) { if (!gone) body.innerHTML = '<tr><td colspan="3">' + esc((e && e.message) || e) + '</td></tr>'; });
    }

    function said(text) { var el = container.querySelector('[data-history="said"]'); if (el) el.textContent = text || ''; }
    function forms() {
      var RF = S.element.spirit.element.rowForm;
      var run = RF.create(container.querySelector('[data-history="runForm"]'), { icon: '🏃‍♂️', button: 'run',
        press: function () { return script && suite ? S.testicle.run({ script: script, suite: suite }) : undefined; } });
      run.button.title = 'run this suite now';
      run.span.appendChild(titleLine);
      var named = RF.create(container.querySelector('[data-history="titleForm"]'), { icon: '✏️', button: 'rename', press: rename });
      var input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('data-history', 'newTitle');
      input.value = test;
      named.span.appendChild(input);
      S.required.spirit.element.fieldInput.attach(input, 'description');
      function rename() {
        var to = input.value;
        said('');
        return Promise.resolve(S.testicle['testicle.title']({ script: script, suite: suite, oldTitle: test, title: to })).then(function () {
          if (gone) return;
          test = S.fieldRules ? S.fieldRules.normalize(to) : String(to).trim();
          prefix = script + '|' + suite + '|' + test + '|';
          input.value = test;
          titleLine.textContent = test;
          ask();
        }, function (e) { if (!gone) said((e && e.message) || String(e)); });
      }
    }

    parts.then(function () {
      if (gone) return;
      ask();
      forms();
      release = S.data.testicle.data.testicle.watch(function () { draw(fromBranch()); });
    }, function () { container.textContent = 'The history could not be loaded.'; });

    return {
      destroy: function () {
        gone = true;
        if (typeof release === 'function') release();
        release = null;
        drawn.forEach(function (el) { if (el && typeof el.destroy === 'function') el.destroy(); });
        drawn = [];
        container.innerHTML = '';
      },
    };
  }

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/testicle/element/search/testicle/detail.js', { create: create }); });
}());
