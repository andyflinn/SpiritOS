// spirit/run/shell/js/desk/data.js
// THE DESK'S TRANSLATOR (goal/G33.3): what the desk's changes mean for spirit.data (shell/js/spiritData.js), in the page
// and in node alike. Andy: a desk client keeps what it learned of the current goal "like face-apps do", in "an updated
// shared client block that handles this same for deskClient and the web-UI", so "anything the agent needs is already on
// hand". Two branches:
//   deskItems   id -> the item's facts, as items.search labels them and the List draws them (the trunk)
//   deskItem    id -> { box, version, chat, chatMore, checks, files, filesMore }: an item kept whole (a branch)
// In the page the desk's publishes come as jobs of module process/js/desk, the published object their app; deskClient
// hands it the desk's changes answer (spirit.deskData.takeChanges), whose rows are the touched items' facts and whose
// held is its agent's held item. Every event ends in set or merge; it asks nothing.
(function (root) {
  var D = (root.spirit || {}).data;
  if (!D || typeof D.translate !== 'function') return;

  function facts(x) {
    if (typeof x === 'string') { try { x = JSON.parse(x); } catch (e) { x = null; } }
    return x && typeof x === 'object' && x.id ? x : null;
  }
  function row(f) { if (f) D.set('deskItems/' + f.id, f); }
  // An item kept whole is only ever added to: what a publish brings is merged into what is kept.
  function keep(id, fields) { if (id) D.merge('deskItem/' + id, fields); }
  function sameLine(a, b) { return a && b && a.at === b.at && a.by === b.by && a.text === b.text; }

  // ONE PUBLISHED CHANGE: {change, verb, item, rows, box, version, chat, checks}, as the desk publishes it.
  function published(o) {
    if (!o || typeof o !== 'object') return;
    var it = facts(o.item);
    (Array.isArray(o.rows) ? o.rows : []).forEach(function (r) { row(facts(r)); });
    if (it) row(it);
    var id = it ? it.id : '';
    if (!id || !D.get('deskItem/' + id)) return;    // an item nobody keeps whole stays a row
    var add = {};
    if (typeof o.box === 'string') { add.box = o.box; add.version = Number(o.version) || 0; }
    if (Array.isArray(o.checks)) add.checks = o.checks;
    // A publish carries no file list: a changed one is dropped, and the next open asks it again.
    if (o.verb === 'item.files.add') { add.files = undefined; add.filesMore = undefined; }
    if (o.chat && typeof o.chat === 'object') {
      var lines = (D.get('deskItem/' + id).chat || []).slice();
      if (!lines.some(function (l) { return sameLine(l, o.chat); })) lines.push(o.chat);
      add.chat = lines;
    }
    if (Object.keys(add).length) keep(id, add);
  }

  // THE CHANGES ANSWER (goal/G33.3, Andy: "A it is then"): the touched items' facts as rows, and the held item's
  // panels when a record touched it; its chat lines come in the records themselves.
  function takeChanges(answer) {
    var a = answer && typeof answer === 'object' ? answer : {};
    (Array.isArray(a.rows) ? a.rows : []).forEach(function (r) { row(facts(r)); });
    var h = a.held && typeof a.held === 'object' && a.held.id ? a.held : null;
    if (h) {
      var add = {};
      ['box', 'version', 'checks', 'files', 'filesMore', 'chat', 'chatMore'].forEach(function (k) { if (k in h) add[k] = h[k]; });
      keep(h.id, add);
    }
    (Array.isArray(a.records) ? a.records : []).forEach(function (r) {
      if (!r || r.verb !== 'chat.add') return;
      var b = null;
      try { b = JSON.parse(r.body); } catch (e) { b = null; }
      if (!b || !b.id || !D.get('deskItem/' + b.id)) return;
      var line = { by: String(r.by || ''), at: String(r.at || ''), text: String(b.text || ''), taken: '', key: String(r.key || '') };
      var lines = (D.get('deskItem/' + b.id).chat || []).slice();
      if (!lines.some(function (l) { return sameLine(l, line); })) { lines.push(line); keep(b.id, { chat: lines }); }
    });
  }

  D.translate({
    onJob: function (job) {
      if (job && job.module === 'process/js/desk' && job.app && typeof job.app === 'object') published(job.app);
    },
  });
  (root.spirit = root.spirit || {}).deskData = { takeChanges: takeChanges, published: published };
}(typeof window !== 'undefined' ? window : globalThis));
