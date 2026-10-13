// spirit/run/shell/desk/plugins/stackFrameChecks/stackFrameChecks.js
// THE STACK-FRAME CHECKS PLUGIN'S PRIVATE UI (goal/G22.3): its companion dialog, opened in Desk from its goal's label.
//
//   Andy, 2026-10-13, in the item's box: "It has a companion dialog where the gate and endpoint functions are entered.",
//   "its dialog takes a gate and an endpoint and makes the goal/G22.2-type item", and "In the main list, a button
//   replacing the label of each plugin's private goal, which opens the plugin's private UI."
//
// Loaded once into the Desk page (shell/desk/desk.js, deskOpenPlugin), it registers itself on
// window.spiritDeskPlugins.stackFrameChecks = { open(container, ctx) }. ctx.goal is its goal's id, ctx.ask the page's
// call to the desk server, ctx.onPublished the desk server's stream. The server half is
// process/js/desk/plugins/js/stackFrameChecks/: its verb stackFrameChecks.make does the work and refuses what is wrong;
// this page only spares the wire.
//
// rule/12: the gate and the endpoint are labels (data-field="label"), checked as typed with the rule the node uses
// (window.spiritFieldRules), bytes left shown beside each, Make off while the rule says no.

(function () {
  var win = typeof window !== 'undefined' ? window : {};
  var held = win.spiritDeskPlugins = win.spiritDeskPlugins || {};
  var ctx = null;
  var subscribed = false;
  var note = '';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function rule() { return win.spiritFieldRules || null; }
  function value(id) { var el = document.getElementById(id); return el ? String(el.value || '') : ''; }
  // What the rule says of one field: '' when it may be sent.
  function why(id) {
    var r = rule();
    var v = value(id);
    if (!r || !v.trim()) return '';
    var problem = r.problem(v);
    if (!problem) return '';
    var bytes = r.byteLength(r.normalize(v));
    return problem + (bytes > r.MAX_BYTES ? ': ' + (bytes - r.MAX_BYTES) + ' bytes over, the limit is ' + r.MAX_BYTES : '');
  }
  // Both fields, every time one is typed in: what is left or what is wrong beside each, Make off while either is wrong.
  function check() {
    var r = rule();
    var wrong = false;
    ['sfc-gate', 'sfc-endpoint'].forEach(function (id) {
      var left = document.getElementById(id + '-left');
      var w = why(id);
      if (w) wrong = true;
      if (!left) return;
      left.textContent = w || (r ? (r.MAX_BYTES - r.byteLength(r.normalize(value(id)))) + ' bytes left' : '');
      left.className = w ? 'job-start-error' : 'job-manifest-note';
    });
    var make = document.getElementById('sfc-make');
    if (make) make.disabled = wrong;
  }
  function say(text) {
    note = String(text || '');
    var el = document.getElementById('sfc-note');
    if (el) el.textContent = note;
  }
  // Its goal's items, read from the desk server's own search; repainted when the stream names an item of its goal.
  function readItems() {
    if (!ctx) return;
    var goal = ctx.goal;
    Promise.resolve(ctx.ask('items.search', { text: '', currentGoalOnly: false, goalsOnly: false, includeClosed: false })).then(function (r) {
      var rows = ((r && r.items) || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return null; } })
        .filter(function (x) { return x && x.goal === goal; });
      var el = document.getElementById('sfc-items');
      if (!el) return;
      el.innerHTML = rows.length ? '<table class="jobs-table"><tbody>' + rows.map(function (x) {
        return '<tr><td>' + esc(x.title) + ' <span class="job-manifest-note">(' + esc(x.id) + ')</span></td><td>' + esc(x.status) + '</td></tr>';
      }).join('') + '</tbody></table>' : '<div class="job-manifest-note">No items yet.</div>';
    }, function () { /* the list stays as it was */ });
  }
  function ofMyGoal(obj) {
    if (!ctx || !obj || typeof obj !== 'object') return false;
    var item = obj.item;
    if (typeof item === 'string') { try { item = JSON.parse(item); } catch (e) { item = null; } }
    var rows = (Array.isArray(obj.rows) ? obj.rows : []).concat(item ? [item] : []);
    return rows.some(function (x) { return x && (x.id === ctx.goal || x.goal === ctx.goal); });
  }
  function make() {
    var gate = value('sfc-gate').trim();
    var endpoint = value('sfc-endpoint').trim();
    if (!gate || !endpoint) { say('Not sent: a gate and an endpoint are both needed.'); return; }
    var wrong = why('sfc-gate') || why('sfc-endpoint');
    if (wrong) { say('Not sent: ' + wrong); return; }
    say('Sent; waiting for the desk.');
    Promise.resolve(ctx.ask('stackFrameChecks.make', { gate: gate, endpoint: endpoint })).then(function (r) {
      ['sfc-gate', 'sfc-endpoint'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
      check();
      say('Made ' + ((r && r.id) || 'the item') + ': nobody but ' + gate + ' reaches ' + endpoint + '.');
      readItems();
    }, function (e) { say('Not made: ' + ((e && e.message) || e)); });
  }

  held.stackFrameChecks = {
    open: function (container, given) {
      ctx = given;
      note = '';
      // Every block carries a leading 1em; each button in a row 1em after itself (the desk's UI rules).
      container.innerHTML =
        '<div class="stat-tile wide" style="margin-top:1em"><div class="label">Stack-frame checks</div>' +
          '<div class="job-manifest-note">Name a gate and an endpoint: the plugin makes the item "Nobody but &lt;gate&gt; reaches ' +
          '&lt;endpoint&gt;" in its goal, whose box states the rule every production stack reaching the endpoint passes through ' +
          'the gate. Its red goes into stackFrameTestItems.js, its row into the BOTTOMS of the stack-frame test.</div></div>' +
        '<div class="start-job-form card" style="margin-top:1em">' +
          '<label class="field-label grow">Gate<input type="text" id="sfc-gate" data-field="label" placeholder="the function every stack passes through, e.g. peerPost"></label>' +
          '<span id="sfc-gate-left" class="job-manifest-note"></span>' +
          '<label class="field-label grow">Endpoint<input type="text" id="sfc-endpoint" data-field="label" placeholder="the function it stands in front of, e.g. presenceNode"></label>' +
          '<span id="sfc-endpoint-left" class="job-manifest-note"></span>' +
          '<button type="button" id="sfc-make" style="margin-right:1em">Make the item</button>' +
        '</div>' +
        '<div id="sfc-note" class="job-start-error" style="margin-top:1em"></div>' +
        '<div class="stat-tile wide" style="margin-top:1em"><div class="label">Its items</div><div id="sfc-items"></div></div>';
      // One listener of each on the container, which is repainted at every open: wired once.
      if (!container.sfcWired) {
        container.sfcWired = true;
        container.addEventListener('input', function (e) {
          var t = e && e.target;
          if (t && t.getAttribute && t.getAttribute('data-field') === 'label' && /^sfc-/.test(String(t.id))) check();
        });
        container.addEventListener('click', function (e) {
          var t = e && e.target;
          if (t && t.id === 'sfc-make') make();
        });
      }
      // ITS OWN STREAM (the desk's UI rule): subscribed once, for whichever goal it was last opened on.
      if (!subscribed && typeof given.onPublished === 'function') {
        subscribed = true;
        given.onPublished(function (obj) { if (ofMyGoal(obj)) readItems(); });
      }
      check();
      readItems();
    },
  };
}());
