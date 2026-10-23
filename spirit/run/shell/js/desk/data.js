// spirit/run/shell/js/desk/data.js
// THE DESK'S TRANSLATOR (goal/G33.3, goal/G33.4): what the desk's stream means for spirit.data (shell/js/spiritData.js),
// in the page and in node alike. Andy: a desk client keeps what it learned of the current goal "like face-apps do", in
// "an updated shared client block that handles this same for deskClient and the web-UI", so "anything the agent needs is
// already on hand". Two branches, and two values:
//   deskItems   id -> the item's facts, as items.search labels them and the List draws them (the trunk)
//   deskItem    id -> { box, version, chat, chatMore, checks, files, filesMore }: an item kept whole (a branch)
//   desk/current  the goal the stream last pushed whole;  desk/change  the newest change number heard
// The rows come as jobs of module process/js/desk: in the page as the desk's publishes, in a server that follows the
// desk's stream (deskClient) through appServer's streamListener (js/appServer.js), which hands each row in exactly so.
// One row each (goal/G33.4): an item's List row, or one side row (a chat line, the box, a check, a file, a claim).
// Every event ends in set, merge or del; it asks nothing and keeps nothing of its own.
(function (root) {
  var D = (root.spirit || {}).data;
  if (!D || typeof D.translate !== 'function') return;

  function facts(x) {
    if (typeof x === 'string') { try { x = JSON.parse(x); } catch (e) { x = null; } }
    return x && typeof x === 'object' && x.id ? x : null;
  }
  function keep(id, fields) { if (id) D.merge('deskItem/' + id, fields); }
  function sameLine(a, b) { return a && b && a.at === b.at && a.by === b.by && a.text === b.text; }
  function goalOf(f) { return f.goal === '' ? f.id : f.goal; }
  var GROUP = 'goal/G0';

  // A GOAL PUSHED WHOLE (goal/G33.4, the box: "when a goal becomes current, the desk pushes it whole onto every desk
  // client"): what was kept of another goal goes (the group chat stays), and every item of this goal is kept whole from
  // its List row on, since every side row of it follows; an item added to it later is new, so nothing of it is missed.
  function rowOf(o, f) {
    if (o.verb === 'goal.whole' && goalOf(f) !== GROUP && goalOf(f) !== D.get('desk/current')) {
      Object.keys(D.branch('deskItems') || {}).concat(Object.keys(D.branch('deskItem') || {})).forEach(function (id) {
        var it = D.get('deskItems/' + id);
        if (id === GROUP || (it && goalOf(it) === GROUP)) return;
        D.del('deskItem/' + id);
        D.del('deskItems/' + id);
      });
      D.set('desk/current', goalOf(f));
    }
    D.set('deskItems/' + f.id, f);
    var g = goalOf(f);
    if (!D.get('deskItem/' + f.id) && (g === D.get('desk/current') || (g === GROUP && o.verb === 'goal.whole'))) {
      D.set('deskItem/' + f.id, { box: '', version: 0, chat: [], chatMore: false, checks: [], files: [], filesMore: false });
    }
  }

  // ONE SIDE ROW of an item kept whole; an item nobody keeps whole stays a row.
  function side(o) {
    var id = String(o.id || '');
    var whole = id ? D.get('deskItem/' + id) : null;
    if (!whole) return;
    if (o.table === 'box') {
      if (o.row) keep(id, { box: String(o.row.text || ''), version: Number(o.row.version) || 0 });
      return;
    }
    if (o.table === 'chat') {
      if (o.removed || !o.row) return;
      var lines = (whole.chat || []).slice();
      var at = -1;
      lines.forEach(function (l, i) { if (sameLine(l, o.row)) at = i; });
      if (at === -1) lines.push(o.row); else lines[at] = o.row;
      keep(id, { chat: lines });
      return;
    }
    if (o.table === 'checks') {
      // The panel holds the open and the decided ones, never the answered or cleared (desk.js shownChecks).
      var number = o.removed ? String(o.at || '') : String((o.row && o.row.number) || '');
      var checks = (whole.checks || []).filter(function (c) { return c.number !== number; });
      if (!o.removed && o.row && o.row.state !== 'answered' && o.row.state !== 'cleared') {
        var all = (whole.checks || []).slice();
        var was = -1;
        all.forEach(function (c, i) { if (c.number === number) was = i; });
        if (was === -1) all.push(o.row); else all[was] = o.row;
        checks = all;
      }
      keep(id, { checks: checks });
      return;
    }
    if (o.table === 'files') {
      // A file row is one agent's path: removed names it as holder|path.
      var gone = o.removed ? String(o.at || '') : '';
      var files = (whole.files || []).filter(function (f) {
        return gone ? f.by + '|' + f.path !== gone : !(o.row && f.by === o.row.by && f.path === o.row.path);
      });
      if (!o.removed && o.row) files.push({ path: String(o.row.path), by: String(o.row.by), core: o.row.core === true, grant: String(o.row.grant || '') });
      // Core files first, then by path (desk.js item.files).
      files.sort(function (a, b) { return a.core !== b.core ? (a.core ? -1 : 1) : a.path < b.path ? -1 : a.path > b.path ? 1 : 0; });
      keep(id, { files: files, filesMore: false });
    }
  }
  function published(o) {
    if (!o || typeof o !== 'object') return;
    if (typeof o.change === 'number' && o.change > (Number(D.get('desk/change')) || 0)) D.set('desk/change', o.change);
    if (o.table) { side(o); return; }
    var it = facts(o.item);
    if (!it) return;
    if (o.removed) { D.del('deskItems/' + it.id); D.del('deskItem/' + it.id); return; }
    rowOf(o, it);
  }

  D.translate({
    onJob: function (job) {
      if (job && job.module === 'process/js/desk' && job.app && typeof job.app === 'object') published(job.app);
    },
  });
  (root.spirit = root.spirit || {}).deskData = { published: published };
}(typeof window !== 'undefined' ? window : globalThis));
