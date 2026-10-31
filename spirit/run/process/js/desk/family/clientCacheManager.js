// spirit/run/process/js/desk/family/clientCacheManager.js
// WHAT THE DESK KNOWS OF ITS ROWS AT THE RECEIVING END, IN THE DESK'S OWN FOLDER (goal/G41.24; Andy: "where
// clientCacheManager.js must work in both browser and an appServer that subscribes? and deskClient can get it form its own
// disc?"). Two halves, one file: the cache rules, which were api.js's, and the translator, which was deskData.js in the
// shell's shared folder. A page loads it from the node that served it (spirit.require); a subscribing appServer
// requires it from its own run root, takes cache from module.exports, and runs the translator into its spirit.data.
// It is read by peers through the family's FS verbs like anything in this folder: rules, never secrets.
//
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
  // THE DESK'S ROWS IN A CLIENT'S CACHE (goal/G41.12). Andy, Q2: "it sits at the receiving end of the stream, it owns the
  // cache, it knows the default cache limit, IT DOESN't HAVE ASK OR TELL ANYBODY HOW IT's JOB IS DONE". The client's
  // appServer keeps the rows the desk sends and hands them here, oldest first; the newest row is the one last touched.
  //   keep(rows, row)          row placed last, the row of the same thing it makes old taken out: an item's facts, one
  //                            side row (its table, item and own key), a rule, a plugin's word
  //   shed(rows, limit, bytes) the rows that stay once bytes(rows), the cache file's size, is past limit
  // THE SHED ORDER IS ANDY'S (Q2): "FIRST YOU shed the longest untouched goal, lock, stock and barrel / when there is
  // only one goal, then you shed the longest untouched item, LOCK, stock and barrel, / when there is only one goal with
  // one item you shed the oldest chat line." A goal's own row is no item, so it stays with its goal. Rows of no goal (the
  // rules, a plugin's) are never shed.
  var cache = (function () {
  function place(row) {
    if (row && row.key && typeof row.key.goal === 'number' && !row.table) return { goal: row.key.goal, item: Number(row.key.item) || 0 };
    if (row && row.table && typeof row.goal === 'number') return { goal: row.goal, item: Number(row.item) || 0 };
    var id = row && (row.table ? row.id : row.item && row.item.id);
    var m = /^goal\/G(\d+)(?:\.(\d+))?$/.exec(String(id || ''));
    return m ? { goal: Number(m[1]), item: m[2] ? Number(m[2]) : 0 } : null;
  }
  function sideKey(row) {
    if (row.removed) return String(row.at || '');
    var r = row.row || {};
    if (row.table === 'box') return '';
    if (row.table === 'chat') return String(r.at || '') + '|' + String(r.by || '');
    if (row.table === 'checks') return String(r.number || '');
    if (row.table === 'files') return String(r.by || '') + '|' + String(r.path || '');
    return null;
  }
  function identity(row) {
    if (!row || typeof row !== 'object') return '';
    if (row.table) { var k = sideKey(row); return k === null ? '' : 'side ' + row.table + ' ' + String(row.id || '') + ' ' + k; }
    if (row.item && row.item.id) return 'item ' + row.item.id;
    if (row.rule) return 'rule ' + row.rule;
    if (row.plugin) return 'plugin ' + row.plugin;
    return '';
  }
  // A PUSH GOAL REPLACES (goal/G41.22; Andy, the box: "pushgoal replaces each agent's copy of the current goal whole, no
  // merge: nothing stale survives"; Q1: "nothing drops from the cache, unless the api.js from the server says so"): its
  // end drops every row of that goal it did not bring, so a restart reads none of it back; after it, a row of that goal
  // of an older change is not kept.
  function replacedAt(rows, g) {
    var at = 0;
    rows.forEach(function (r) { var p = place(r); if (r.replace === true && r.end === true && p && p.goal === g && Number(r.change) > at) at = Number(r.change); });
    return at;
  }
  function keep(rows, row) {
    var p = place(row);
    if (row && row.replace === true && row.end === true && p) {
      return rows.filter(function (r) { var q = place(r); return !q || q.goal !== p.goal || (r.replace === true && r.change === row.change && !r.end); }).concat([row]);
    }
    if (p && row.replace !== true && typeof row.change === 'number' && row.change < replacedAt(rows, p.goal)) return rows;
    var id = identity(row);
    return rows.filter(function (r) { return !id || identity(r) !== id; }).concat([row]);
  }
  // Each group's newest row: the one touched last is the one kept longest.
  function touched(rows, groupOf) {
    var at = new Map();
    rows.forEach(function (r, i) { var g = groupOf(r); if (g !== null) at.set(g, i); });
    return at;
  }
  function oldest(at) {
    var pick = null; var low = Infinity;
    at.forEach(function (i, g) { if (i < low) { low = i; pick = g; } });
    return pick;
  }
  function shed(rows, limit, bytes) {
    var kept = rows.slice();
    while (bytes(kept) > limit) {
      var goals = touched(kept, function (r) { var p = place(r); return p ? p.goal : null; });
      if (goals.size >= 2) {
        var g = oldest(goals);
        kept = kept.filter(function (r) { var p = place(r); return !p || p.goal !== g; });
        continue;
      }
      if (goals.size !== 1) break;
      var items = touched(kept, function (r) { var p = place(r); return p && p.item !== 0 ? p.item : null; });
      if (items.size >= 2) {
        var it = oldest(items);
        kept = kept.filter(function (r) { var p = place(r); return !p || p.item !== it; });
        continue;
      }
      var line = -1;
      kept.forEach(function (r, i) { if (line === -1 && r.table === 'chat' && !r.removed && place(r)) line = i; });
      if (line === -1) break;
      kept.splice(line, 1);
    }
    return kept;
  }
  // THE CACHE ANSWERS A READ AS THE DESK WOULD (goal/G41.11's kept reads; box v15: "The client queries its own cache
  // through that api.js"): item.get from an item's facts, item.box, item.checks, item.chat and item.files from the parts
  // kept, each filled to room as the desk fills its answer; null when the cache does not hold it all, so the desk is
  // asked. D is the client's data set as the desk's translator (deskData) keeps it.
  function bytes(x) { return Buffer.byteLength(JSON.stringify(x), 'utf8'); }
  function answer(verb, args, D, room) {
    var id = String((args && args.id) || '');
    var row = id ? D.get('deskItems/' + id) : null;
    var whole = id ? D.get('deskItem/' + id) : null;
    // The facts come with the push (goal/G33.4, box v46); a part once it was read, or the stream brought it.
    if (verb === 'item.get' && row && typeof row.version === 'number') return { item: JSON.stringify(row), version: row.version, change: Number(D.get('desk/change')) || 0 };
    if (!row || !whole) return null;
    if (verb === 'item.box' && typeof whole.box === 'string') return { box: whole.box, version: Number(whole.version) || 0 };
    if (verb === 'item.checks' && Array.isArray(whole.checks)) return { checks: whole.checks };
    if (verb === 'item.chat' && Array.isArray(whole.chat)) {
      // Newest first into one answer, as the desk's item.chat fills its room; more says some were left out.
      var lines = [];
      for (var i = whole.chat.length - 1; i >= 0; i--) {
        if (bytes({ chat: [whole.chat[i]].concat(lines), chatMore: true }) > room) break;
        lines.unshift(whole.chat[i]);
      }
      // Lines the stream brought before any read are the newest only (chatMore kept): older ones are the desk's.
      return { chat: lines, chatMore: lines.length < whole.chat.length || whole.chatMore === true };
    }
    // goal/G33.7 (the approved list: "deskClient's kept file list (filled to one answer)"): as many as fit one answer,
    // in the desk's order, and filesMore when some were left out; the push only ever adds to what is kept.
    if (verb === 'item.files' && Array.isArray(whole.files) && !whole.filesMore) {
      var under = args && typeof args.under === 'string' ? args.under : '';
      var all = whole.files.filter(function (f) { return !under || String(f.path).indexOf(under) === 0; });
      var files = [];
      for (var j = 0; j < all.length; j++) {
        if (bytes({ files: files.concat([all[j]]), filesMore: true }) > room) break;
        files.push(all[j]);
      }
      return { files: files, filesMore: files.length < all.length };
    }
    return null;
  }
  return { keep: keep, shed: shed, answer: answer };
  }());
  // THE TRANSLATOR, ATTACHED TO ONE DATA SET ONCE: attach(root) on the root whose spirit.data it fills. A page attaches
  // as it loads (below); in node the same module is required once and also read for its cache, so whoever holds the
  // data set attaches it (appServer, as it takes the stream's translator): a require before the data set is there
  // attaches nothing, and a second attach of the same set translates nothing twice, from this copy of the file or another
  // (the mark is on the data set, under one shared symbol, and holds the set's spirit.deskData).
  var ATTACHED = typeof Symbol === 'function' ? Symbol.for('spirit.desk.clientCacheManager') : '__deskClientCacheManager';
  function attach(root) {
    var D = ((root || {}).spirit || {}).data;
    if (!D || typeof D.translate !== 'function') return;
    // Attached before: the translator stays as it is, and this root is handed its spirit.deskData again (a root whose
    // spirit object was made anew after the first attach has none).
    if (D[ATTACHED]) { (root.spirit = root.spirit || {}).deskData = D[ATTACHED]; return; }

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
    // family's cache rules to keep (above, run by appServer).
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
    var deskData = { published: published, took: took };
    try { Object.defineProperty(D, ATTACHED, { value: deskData }); } catch (e) { D[ATTACHED] = deskData; }
    (root.spirit = root.spirit || {}).deskData = deskData;
  }
  // In node, for the subscribing appServer and deskClient: the cache rules and attach, as the module's export.
  if (typeof module !== 'undefined' && module && module.exports) module.exports = { cache: cache, attach: attach };
  attach(root);
}(typeof window !== 'undefined' ? window : globalThis));
