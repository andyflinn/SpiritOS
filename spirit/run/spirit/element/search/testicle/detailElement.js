'use strict';
// spirit/run/spirit/element/search/testicle/detailElement.js
// ONE TEST'S DETAIL, AN ELEMENT (goal/G47.1, the search cycle): its history of flips, what testicle's face shows in a closable
// tab when a test row of the testicle search is clicked (the box: "The testicle detail is a history of flips, and opens in a
// closable tab when a test row is clicked").
//
//   spirit.element.spirit.element.search.testicle.detailElement.create(container, { script, suite, test }) -> { destroy() }
//
// The box: "testicle.search answers the current rows by default; given a valid test title, {script, suite, test, text}, it
// answers every row matching that script, suite and title, current or not, newest first. A test's history in its detail
// comes from that, no new verb." The title line is the test's title in full; below it every row, the newest flip first,
// each drawn by ./rowElement.js with the date it flipped. It asks again whenever testicle publishes a row of this test.
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): its row, testicle's interface and its cache manager.
  var parts = Promise.all(['spirit/element/search/testicle/rowElement.js', 'spirit/app/testicle/api.js']
    .map(function (p) { return S.require(p); }).concat([S.cacheManager('testicle')]));

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
    container.innerHTML = '<div class="testicle-history fill"><div class="testicle-title" data-history="title"></div>' +
      '<table class="testicle-flips" data-history="rows"><thead><tr><th>Flipped</th><th>Result</th><th>Severity</th><th>Title</th><th>Script</th><th>Suite</th></tr></thead><tbody></tbody></table></div>';
    container.querySelector('[data-history="title"]').textContent = test;
    var body = container.querySelector('tbody');

    var drawn = [];
    function draw(rows) {
      if (gone) return;
      drawn.forEach(function (el) { if (el && typeof el.destroy === 'function') el.destroy(); });
      drawn = [];
      body.innerHTML = rows.map(function (r) {
        var el = S.element.spirit.element.search.testicle.rowElement.create(r);
        drawn.push(el);
        var when = r.flipped ? new Date(Number(r.flipped)).toISOString().replace('T', ' ').slice(0, 19) : '';
        return '<tr data-key="' + esc(r.key) + '"><td data-field="flipped">' + esc(when) + '</td>' +
          el.cells().map(function (c) { return '<td data-field="' + esc(c.name) + '">' + c.html + '</td>'; }).join('') + '</tr>';
      }).join('') || '<tr><td colspan="6">' + esc('No row of this test.') + '</td></tr>';
    }
    function ask() {
      return Promise.resolve(S.testicle['testicle.search']({ script: script, suite: suite, test: test, text: '' }))
        .then(function (b) { draw(rowsOf(b)); }, function (e) { if (!gone) body.innerHTML = '<tr><td colspan="6">' + esc((e && e.message) || e) + '</td></tr>'; });
    }

    parts.then(function () {
      if (gone) return;
      ask();
      // A row of this test written anywhere: its history asked again.
      release = S.data.testicle.data.testicle.watch(function (key) { if (String(key || '').indexOf(script + '|' + suite + '|' + test + '|') === 0) ask(); });
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

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/search/testicle/detailElement.js', { create: create }); });
}());
