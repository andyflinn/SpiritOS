// spirit/run/shell/shared/js/deskData.js
// A DESK COMPONENT'S SHARED PART, SO NOT IN shell/js (goal/G41.11). Andy: "shell/js/ is for core shell elements! ...
// desk components can make their own shared stuff in spirit/run/shell/shared/js".
// THE DESK'S TRANSLATOR (goal/G33.3, goal/G33.4): what the desk's stream means for spirit.data (shell/js/spiritData.js),
// in the page and in node alike. Andy: a desk client keeps what it learned of the current goal "like face-apps do", in
// "an updated shared client block that handles this same for deskClient and the web-UI", so "anything the agent needs is
// already on hand". Two branches, and two values:
//   deskItems   id -> the item's facts, as items.search labels them and the List draws them (the trunk)
//   deskItem    id -> the parts of an item read so far, each on its own: { box, version }, { chat, chatMore },
//               { checks }, { files, filesMore } (a branch). goal/G33.4 (box v46): a part comes when it is needed, by
//               its own read (took), and the side rows the desk pushes keep it current from then on.
//   desk/current  the goal the stream last pushed whole;  desk/change  the newest change number heard
// The rows come as jobs of module process/js/desk: in the page as the desk's publishes, in a server that follows the
// desk's stream (deskClient) through appServer's streamListener (js/appServer.js), which hands each row in exactly so.
// One row each (goal/G33.4): an item's List row, or one side row (a chat line, the box, a check, a file, a claim); a
// bundle of them (goal/G41.11) is taken row by row.
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

  // A GOAL PUSHED (goal/G33.4, the box: "when a goal becomes current, the desk pushes it whole onto every desk client";
  // since box v46 its items' facts alone): what was kept of another goal goes (the group chat stays), and this goal's
  // items' facts are kept. Their parts come when needed (took).
  function rowOf(o, f) {
    if (o.verb === 'goal.whole' && goalOf(f) !== GROUP && goalOf(f) !== D.get('desk/current')) {
      Object.keys(D.branch('deskItems') || {}).concat(Object.keys(D.branch('deskItem') || {})).forEach(function (id) {
        var it = D.get('deskItems/' + id);
        // The group chat stays, and so does what was read of this goal before its rows came (took).
        if (id === GROUP || (it && (goalOf(it) === GROUP || goalOf(it) === goalOf(f)))) return;
        D.del('deskItem/' + id);
        D.del('deskItems/' + id);
      });
      D.set('desk/current', goalOf(f));
    }
    D.set('deskItems/' + f.id, f);
  }

  // ONE SIDE ROW: it keeps current the part of the item it belongs to, once that part was read; a part never read stays
  // unread (goal/G33.4, box v46: "the box and other parts will come when needed and stay").
  function side(o) {
    var id = String(o.id || '');
    var whole = id ? D.get('deskItem/' + id) : null;
    if (!whole) return;
    if (o.table === 'box') {
      if (o.row && typeof whole.box === 'string') keep(id, { box: String(o.row.text || ''), version: Number(o.row.version) || 0 });
      return;
    }
    if (o.table === 'chat') {
      if (o.removed || !o.row || !Array.isArray(whole.chat)) return;
      var lines = (whole.chat || []).slice();
      var at = -1;
      lines.forEach(function (l, i) { if (sameLine(l, o.row)) at = i; });
      if (at === -1) lines.push(o.row); else lines[at] = o.row;
      keep(id, { chat: lines });
      return;
    }
    if (o.table === 'checks') {
      if (!Array.isArray(whole.checks)) return;
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
      if (!Array.isArray(whole.files)) return;
      // A file row is one agent's path: removed names it as holder|path.
      var gone = o.removed ? String(o.at || '') : '';
      var files = (whole.files || []).filter(function (f) {
        return gone ? f.by + '|' + f.path !== gone : !(o.row && f.by === o.row.by && f.path === o.row.path);
      });
      // A FILE ADDED AFTER GO KEEPS ITS MARK (goal/G41.11): the desk marks it late: true (desk.js isLate), and the entry
      // rebuilt here carries it, as item.files answers it.
      if (!o.removed && o.row) {
        var entry = { path: String(o.row.path), by: String(o.row.by), core: o.row.core === true, grant: String(o.row.grant || '') };
        if (o.row.late === true) entry.late = true;
        files.push(entry);
      }
      // Core files first, then by path (desk.js item.files).
      files.sort(function (a, b) { return a.core !== b.core ? (a.core ? -1 : 1) : a.path < b.path ? -1 : a.path > b.path ? 1 : 0; });
      keep(id, { files: files, filesMore: false });
    }
  }
  function published(o) {
    if (!o || typeof o !== 'object') return;
    // A BUNDLE IS ITS ROWS (goal/G41.11): the desk publishes a list together as { change, rows: [...] } (desk.js
    // bundled), and each row of it is taken as the single row it is.
    // THE POSITION MOVES ONLY WITH WHAT LANDED (goal/G41.12): during a push it is held until the push has landed whole
    // (spiritData hold), so a push cut after its first part is asked again from the old position.
    if (typeof o.change === 'number') {
      var top = Math.max(Number(D.get('desk/change')) || 0, typeof D.held === 'function' ? Number(D.held('desk/change')) || 0 : 0);
      if (o.change > top) { if (typeof D.hold === 'function') D.hold('desk/change', o.change); else D.set('desk/change', o.change); }
    }
    if (Array.isArray(o.rows)) { o.rows.forEach(published); return; }
    if (o.table) { side(o); return; }
    var it = facts(o.item);
    if (!it) return;
    if (o.removed) { D.del('deskItems/' + it.id); D.del('deskItem/' + it.id); return; }
    rowOf(o, it);
  }

  // A PART READ WHEN NEEDED (goal/G33.4, box v46): the answer of item.box, item.chat (its newest lines), item.checks or
  // item.files (all of them) for an item of the current goal, kept from now on beside its facts. A read of anything
  // narrower (an older page of chat, files under a folder) is not a part and is not kept.
  // A part is kept only for an item of the goal the stream pushed (or the group chat): what the push does not keep current
  // is never kept, so a client the stream does not reach asks the desk every time and is never stale.
  function took(verb, args, answer) {
    var id = String((args && args.id) || '');
    if (!id || !answer || typeof answer !== 'object') return;
    var row = D.get('deskItems/' + id);
    var current = D.get('desk/current');
    if (!row || !current) return;
    var g = goalOf(row);
    if (g !== current && g !== GROUP) return;
    if (verb === 'item.box' && typeof answer.box === 'string') keep(id, { box: answer.box, version: Number(answer.version) || 0 });
    else if (verb === 'item.chat' && Array.isArray(answer.chat) && !(args && args.before)) keep(id, { chat: answer.chat, chatMore: answer.chatMore === true });
    else if (verb === 'item.checks' && Array.isArray(answer.checks)) keep(id, { checks: answer.checks });
    else if (verb === 'item.files' && Array.isArray(answer.files) && !(args && args.under)) keep(id, { files: answer.files, filesMore: answer.filesMore === true });
  }

  D.translate({
    onJob: function (job) {
      if (job && job.module === 'process/js/desk' && job.app && typeof job.app === 'object') published(job.app);
    },
  });
  (root.spirit = root.spirit || {}).deskData = { published: published, took: took };
}(typeof window !== 'undefined' ? window : globalThis));
