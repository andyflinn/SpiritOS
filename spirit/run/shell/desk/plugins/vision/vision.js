// spirit/run/shell/desk/plugins/vision/vision.js
// THE VISION PLUGIN'S PRIVATE UI (goal/G27.3): Desk's Vision tab under Apps, in place of the musings tab.
//
// DECIDED BY ANDY, 2026-10-14 to 17, in goal/G27.3's box: a simple standard desk plugin (R2); its items open in the
// standard deskDetails dialog, whose only change is the buttons its plugin refuses (R6); he talks with the agents about
// his vision item by item, and each item's chat is the record (R7). So, top to bottom: what the tab is, an add, the
// goal's items each with Open, then the goal's chat, the face's (ctx.chat).
//
// Loaded once into the Desk page the first time its tab opens (shell/desk/desk.js, deskOpenPlugin); it registers
// window.spirit.deskPlugins.vision = { open(container, ctx) }: ctx.goal its goal, ctx.ask the desk server, ctx.onPublished
// the stream (it subscribes itself), ctx.chat(container) the goal's chat, ctx.callDialog(app, params) the shell's dialog.

(function () {
  var win = typeof window !== 'undefined' ? window : {};
  var held = (win.spirit = win.spirit || {}).deskPlugins = win.spirit.deskPlugins || {};
  var ctx = null;
  var subscribed = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function say(text) { var el = document.getElementById('vision-note'); if (el) el.textContent = String(text || ''); }
  function errText(e) { return (e && e.message) || String(e); }
  function fieldWhy(v) {
    var rules = win.spirit.fieldRules;
    // The label rule, as every title in Desk (fieldRules.js): '' when it may be sent.
    return rules && typeof rules.problem === 'function' ? String(rules.problem(v) || '') : '';
  }
  // The add is on while a title is typed and the label rule takes it.
  function check() {
    var box = document.getElementById('vision-title');
    var b = document.getElementById('vision-add');
    var v = box ? String(box.value || '').trim() : '';
    var w = v ? fieldWhy(v) : '';
    if (b) b.disabled = !v || !!w;
    return w;
  }

  // ITS GOAL'S ITEMS, FROM THE GOAL ITSELF (goal/G27.3). Andy, 2026-10-17: "where is my list of vision items?": a search
  // of every item answers one bucket, which held none of his. The goal's own facts name its open items (blocked), and
  // each is read with item.get, so the list is exact and nothing is cut off. Read again when the stream names one.
  function factsOf(id) {
    return Promise.resolve(ctx.ask('item.get', { id: id })).then(function (r) { try { return JSON.parse(r.item); } catch (e) { return null; } }, function () { return null; });
  }
  function readItems() {
    if (!ctx) return;
    var goal = ctx.goal;
    factsOf(goal).then(function (g) {
      var ids = g && Array.isArray(g.blocked) ? g.blocked : [];
      return Promise.all(ids.map(factsOf));
    }).then(function (all) {
      var rows = (all || []).filter(function (x) { return x && x.goal === goal; });
      var el = document.getElementById('vision-items');
      if (!el) return;
      el.innerHTML = rows.length ? '<table class="jobs-table"><tbody>' + rows.map(function (x) {
        var blocked = (x.blocked || []).length ? ' <span class="job-manifest-note">waits on ' + esc((x.blocked || []).join(', ')) + '</span>' : '';
        return '<tr><td>' + esc(x.title) + ' <span class="job-manifest-note">(' + esc(x.id) + ')</span>' + blocked + '</td>' +
          '<td><button type="button" data-open="' + esc(x.id) + '" style="margin-right:1em">Open</button></td></tr>';
      }).join('') + '</tbody></table>' : '<div class="job-manifest-note">Nothing in the vision yet.</div>';
    }, function () { /* the list stays as it was */ });
  }
  function add() {
    var box = document.getElementById('vision-title');
    var title = box ? String(box.value || '').trim() : '';
    if (!title) return;
    var w = check();
    if (w) { say('Not added: ' + w); return; }
    say('Sent; waiting for the desk.');
    Promise.resolve(ctx.ask('item.add', { goal: ctx.goal, title: title, blocks: '' })).then(function (r) {
      if (box) box.value = '';
      check();
      say('Added ' + ((r && r.id) || 'the item') + '.');
      readItems();
    }, function (e) { say('Not added: ' + errText(e)); });
  }
  // R6: the standard dialog; the list is read again when it closes.
  function openItem(id) {
    if (!ctx || typeof ctx.callDialog !== 'function') return;
    Promise.resolve(ctx.callDialog('shell/deskDetails', { id: id })).then(readItems, readItems);
  }
  function ofMyGoal(obj) {
    if (!ctx || !obj || typeof obj !== 'object') return false;
    var item = obj.item;
    if (typeof item === 'string') { try { item = JSON.parse(item); } catch (e) { item = null; } }
    // goal/G33.4: one row per publish.
    var rows = item ? [item] : [];
    return rows.some(function (x) { return x && (x.id === ctx.goal || x.goal === ctx.goal); });
  }

  held.vision = {
    open: function (container, given) {
      ctx = given;
      // Every block a leading 1em; each button 1em after itself (the desk's UI rules).
      container.innerHTML =
        '<div class="stat-tile wide" style="margin-top:1em"><div class="label">Vision</div>' +
          '<div class="job-manifest-note">Your vision, item by item: add a topic, open it to talk it through with the agents in its chat, ' +
          'block one on another when it must become real first, close or delete what went stale. Its goal stays in design.</div></div>' +
        '<div class="start-job-form card" style="margin-top:1em"><label class="field-label grow">A new topic' +
          '<input type="text" id="vision-title" data-field="label" placeholder="what the vision holds"></label>' +
          '<button type="button" id="vision-add" style="margin-right:1em">Add</button></div>' +
        '<div id="vision-note" class="job-start-error" style="margin-top:1em"></div>' +
        '<div class="stat-tile wide" style="margin-top:1em"><div class="label">The vision</div><div id="vision-items"></div></div>' +
        '<div id="vision-chat"></div>';
      if (!container.visionWired) {
        container.visionWired = true;
        container.addEventListener('input', function (e) { var t = e && e.target; if (t && t.id === 'vision-title') check(); });
        container.addEventListener('keydown', function (e) { var t = e && e.target; if (t && t.id === 'vision-title' && e.key === 'Enter' && !e.repeat) add(); });
        container.addEventListener('click', function (e) {
          var t = e && e.target;
          if (!t) return;
          var id = t.getAttribute ? t.getAttribute('data-open') : null;
          if (id) { openItem(id); return; }
          if (t.id === 'vision-add') add();
        });
      }
      // ITS OWN STREAM (the desk's UI rule): subscribed once; a row of its goal reads its items again.
      if (!subscribed && typeof given.onPublished === 'function') {
        subscribed = true;
        given.onPublished(function (obj) { if (ofMyGoal(obj)) readItems(); });
      }
      if (typeof given.chat === 'function') given.chat(document.getElementById('vision-chat'));
      check();
      readItems();
    },
  };
}());
