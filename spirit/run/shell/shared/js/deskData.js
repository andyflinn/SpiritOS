// spirit/run/shell/shared/js/deskData.js
// A DESK COMPONENT'S SHARED PART, SO NOT IN shell/js (goal/G41.11). Andy: "shell/js/ is for core shell elements! ...
// desk components can make their own shared stuff in spirit/run/shell/shared/js".
// THE DESK'S TRANSLATOR (goal/G33.3, goal/G33.4): what the desk's stream means for spirit.data (shell/shared/js/spiritData.js),
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
// One row each (goal/G33.4): an item's List row, or one side row (a chat line, the box, a check, a file, a claim); the
// stream's bundles are appServer's, which hands their rows in one by one (goal/G41.12).
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
  // since box v46 its items' facts alone): it is the current goal from now on, and its items' facts are kept. Their
  // parts come when needed (took). EVERY GOAL IS KEPT (goal/G41.12, box v15: "The cache keeps everything the server
  // sends, every goal, no filtering on the client side"): another goal's rows stay; the cache's limit is the sender's
  // family api.js's to keep (appServer).
  function rowOf(o, f) {
    if (o.verb === 'goal.whole' && goalOf(f) !== GROUP) D.set('desk/current', goalOf(f));
    D.set('deskItems/' + f.id, f);
  }

  // ONE SIDE ROW: it keeps current the part of the item it belongs to, once that part was read; a part never read stays
  // unread (goal/G33.4, box v46: "the box and other parts will come when needed and stay"). A box and a chat line are
  // kept unread too (goal/G41.12: the cache keeps everything the server sends): the box is whole in its row, and the
  // chat lines the stream brought are the newest, with chatMore, so older ones are asked for as before. A check or a
  // file alone is no list, so those wait for a read.
  function side(o) {
    var id = String(o.id || '');
    var whole = id ? D.get('deskItem/' + id) : null;
    if (!whole && id && o.row && !o.removed && o.table === 'box') { keep(id, { box: String(o.row.text || ''), version: Number(o.row.version) || 0 }); return; }
    if (!whole && id && o.row && !o.removed && o.table === 'chat') { keep(id, { chat: [o.row], chatMore: true }); return; }
    if (!whole) return;
    if (o.table === 'box') {
      if (o.row) keep(id, { box: String(o.row.text || ''), version: Number(o.row.version) || 0 });
      return;
    }
    if (o.table === 'chat') {
      if (o.removed || !o.row) return;
      if (!Array.isArray(whole.chat)) { keep(id, { chat: [o.row], chatMore: true }); return; }
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
  // A PUSH GOAL REPLACES THE COPY (goal/G41.22; Andy, the box: "pushgoal replaces each agent's copy of the current goal
  // whole, no merge: nothing stale survives", "it moves each agent's read pointer to the newest change"). Its rows come
  // under one change, marked replace, its end last: once it has landed, an item of that goal it did not carry is gone,
  // and every part kept of the goal's items (box, chat, checks, files) goes too, so each is read afresh. From then on a
  // row of that goal of an older change undoes nothing (desk/replaced/<goal>, the push's change).
  var pushing = {};
  function goalNumber(o) {
    if (typeof o.goal === 'number') return o.goal;
    if (o.key && typeof o.key.goal === 'number') return o.key.goal;
    var m = /^goal\/G(\d+)/.exec(String(o.id || (o.item && o.item.id) || ''));
    return m ? Number(m[1]) : -1;
  }
  function ofGoal(id, g) { var m = /^goal\/G(\d+)(?:\.\d+)?$/.exec(String(id)); return !!m && Number(m[1]) === g; }
  function replaced(o) {
    var g = goalNumber(o);
    if (o.end === true) {
      var p = pushing[g];
      delete pushing[g];
      if (!p || p.change !== o.change) return;
      var all = D.get('deskItems') || {};
      Object.keys(all).forEach(function (id) { if (ofGoal(id, g) && !p.ids[id]) D.del('deskItems/' + id); });
      var parts = D.get('deskItem') || {};
      Object.keys(parts).forEach(function (id) { if (ofGoal(id, g)) D.del('deskItem/' + id); });
      D.set('desk/replaced' + g, o.change);
      return;
    }
    if (!pushing[g] || pushing[g].change !== o.change) pushing[g] = { change: o.change, ids: {} };
    // His lines the push hands again are the deskClient's to wake on (its onRow); its copy keeps no part of them.
    if (o.table) return;
    var it = facts(o.item);
    if (!it) return;
    pushing[g].ids[it.id] = true;
    rowOf(o, it);
  }
  function stale(o) {
    var at = Number(D.get('desk/replaced' + goalNumber(o)));
    return at > 0 && typeof o.change === 'number' && o.change < at;
  }
  function published(o) {
    if (!o || typeof o !== 'object') return;
    // The newest change heard, as item.get answers it. No position: the stream keeps its own (appServer, goal/G41.12).
    if (typeof o.change === 'number' && o.change > (Number(D.get('desk/change')) || 0)) D.set('desk/change', o.change);
    // A RULE (goal/G41.2): every active rule comes with the push, then each rule write, kept by its key.
    if (o.rule && o.row && typeof o.row === 'object') { D.set('deskRules/' + String(o.rule), o.row); return; }
    if (o.replace === true) { replaced(o); return; }
    if (stale(o)) return;
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
