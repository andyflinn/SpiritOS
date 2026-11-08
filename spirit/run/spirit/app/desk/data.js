// spirit/run/spirit/app/desk/data.js
// WHAT THE DESK KNOWS OF ITS ROWS AT THE RECEIVING END, IN THE DESK'S OWN FOLDER (goal/G41.24; Andy: "where
// clientCacheManager.js must work in both browser and an appServer that subscribes? and deskClient can get it form its own
// disc?"). Two halves: the cache rules, family/cacheRules.js (a node's alone), and the translator. A page loads it from the node that served it (spirit.require); a subscribing appServer
// requires it from its own run root, takes cache from module.exports, and runs the translator into its spirit.data.
// It is read by peers through the family's FS verbs like anything in this folder: rules, never secrets.
//
// THE DESK'S TRANSLATOR (goal/G33.3, goal/G33.4): what the desk's stream means for spirit.data (spirit/data.js),
// in the page and in node alike. Andy: a desk client keeps what it learned of the current goal "like face-apps do", in
// "an updated shared client block that handles this same for deskClient and the web-UI", so "anything the agent needs is
// already on hand". THE BRANCHES ARE THIS FILE'S, AND ONLY THIS FILE NAMES THEM (goal/G41.28; Andy: "the FUCKING desk cache
// is NOT to be found in spirit.data.data.desk", and "doesn't the fucking ... clientCacheManager.js take care of that"):
// every reader, the page, deskDetails and deskClient, asks spirit.data.desk.data (below), never a branch by its name.
//   desk        id -> the item's facts, as items.search labels them and the List draws them (the trunk)
//   deskItem    id -> the parts of an item read so far, each on its own: { box, version }, { chat, chatMore },
//               { checks }, { files, filesMore } (a branch). goal/G33.4 (box v46): a part comes when it is needed, by
//               its own read (took), and the side rows the desk pushes keep it current from then on.
//   deskState/current  the goal the stream last pushed whole;  deskState/change  the newest change number heard
// The rows come as jobs of module spirit/app/desk: in the page as the desk's publishes, in a server that follows the
// desk's stream (deskClient) through appServer's streamListener (spirit/appServer.js), which hands each row in exactly so.
// One row each (goal/G33.4): an item's List row, or one side row (a chat line, the box, a check, a file, a claim); the
// stream's bundles are appServer's, which hands their rows in one by one (goal/G41.12).
// Every event ends in set, merge or del; it asks nothing and keeps nothing of its own.
(function () {
  // THE CACHE RULES ARE NODE'S (goal/G41.28; Andy: "the file has to fit into MAX_PAYLOAD."): keep, shed and the kept
  // reads, in ./cacheRules.js, required in node alone (appServer, deskClient), handed this file's names; a page has none.
  // THE NAMES, here alone.
  var ITEMS = 'desk';
  var PARTS = 'deskItem';
  var STATE = 'deskState';
  var RULES = 'deskRules';
  var DOORS = 'deskDoors';
  var DOOR_RUNS = 'deskDoorRuns';
  var cache = typeof module !== 'undefined' && module && module.exports && typeof require === 'function'
    ? require('./cacheRules.js')({ items: ITEMS, parts: PARTS, state: STATE }) : null;
  // THE TRANSLATOR, ONCE PER DATA SET: spirit.data.makeFamily runs this once, however often the file is loaded.
  var D = typeof window !== 'undefined' ? window.spirit.data : require('../../../spirit/data.js');
  D.makeFamily('desk', function () {
    // THE DESK'S ROWS UNDER THE NODE THAT SERVED THEM (goal/G41.28; Andy, the box: "The RAM-CACHE-is organized BY
    // SERVER-NODE-ID at it's lowest level. IE: spirit.data.<server-public-key-in-base64url>.<api-family>...."): V is the desk
    // family's view of one node. A row from the stream is filed under its job's node (fromNode); every read is of the
    // home node (spirit.data's home(): a page's own node, a process's sender).
    var HOME = D.viewAt(null, 'desk');
    var V = HOME;

    function facts(x) {
      if (typeof x === 'string') { try { x = JSON.parse(x); } catch (e) { x = null; } }
      return x && typeof x === 'object' && x.id ? x : null;
    }
    function keep(id, fields) { if (id) V.merge(PARTS + '/' + id, fields); }
    function sameLine(a, b) { return a && b && a.at === b.at && a.by === b.by && a.text === b.text; }
    function goalOf(f) { return f.goal === '' ? f.id : f.goal; }

    // A GOAL PUSHED (goal/G33.4, the box: "when a goal becomes current, the desk pushes it whole onto every desk client";
    // since box v46 its items' facts alone): it is the current goal from now on, and its items' facts are kept. Their
    // parts come when needed (took). EVERY GOAL IS KEPT (goal/G41.12, box v15: "The cache keeps everything the server
    // sends, every goal, no filtering on the client side"): another goal's rows stay; the cache's limit is the sender's
    // family's cache rules to keep (above, run by appServer).
    function rowOf(o, f) {
      if (o.verb === 'goal.whole') V.set(STATE + '/current', goalOf(f));
      V.set(ITEMS + '/' + f.id, f);
    }

    // ONE SIDE ROW: it keeps current the part of the item it belongs to, once that part was read; a part never read stays
    // unread (goal/G33.4, box v46: "the box and other parts will come when needed and stay"). A box and a chat line are
    // kept unread too (goal/G41.12: the cache keeps everything the server sends): the box is whole in its row, and the
    // chat lines the stream brought are the newest, with chatMore, so older ones are asked for as before. A check or a
    // file alone is no list, so those wait for a read.
    function side(o) {
      var id = String(o.id || '');
      var whole = id ? V.get(PARTS + '/' + id) : null;
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
        var all = V.get(ITEMS) || {};
        Object.keys(all).forEach(function (id) { if (ofGoal(id, g) && !p.ids[id]) V.del(ITEMS + '/' + id); });
        var parts = V.get(PARTS) || {};
        Object.keys(parts).forEach(function (id) { if (ofGoal(id, g)) V.del(PARTS + '/' + id); });
        V.set(STATE + '/replaced' + g, o.change);
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
      var at = Number(V.get(STATE + '/replaced' + goalNumber(o)));
      return at > 0 && typeof o.change === 'number' && o.change < at;
    }
    function published(o) {
      if (!o || typeof o !== 'object') return;
      // The newest change heard, as item.get answers it. No position: the stream keeps its own (appServer, goal/G41.12).
      if (typeof o.change === 'number' && o.change > (Number(V.get(STATE + '/change')) || 0)) V.set(STATE + '/change', o.change);
      // A RULE (goal/G41.2): every active rule comes with the push, then each rule write, kept by its key.
      if (o.rule && o.row && typeof o.row === 'object') { V.set(RULES + '/' + String(o.rule), o.row); return; }
      // A LINE SAID UNDER A RULE (rule.chat) comes without the line: the rule's chat read so far is dropped, so whoever
      // watches it reads it again.
      if (o.verb === 'rule.chat' && o.rule) { V.del(PARTS + '/' + String(o.rule)); return; }
      // A STACK-FRAME DOOR CHANGED (a publish naming plugin stackFrameChecks, { what, id }, carries no row): its run kept is
      // dropped, and for any change but a run the door kept too, so whoever watches them reads them again.
      // DISCREPANCY WITH ANDY's RULES: goal/G43.22, Andy: "the apps and plugin system goes.", "removal of plugin support.".
      // The stackFrameChecks plugin is gone and nothing publishes this any more, yet this branch, the deskDoors and
      // deskDoorRuns branches and the doors/doorRuns reads below still stand for it.
      if (o.plugin === 'stackFrameChecks') {
        var door = o.data && o.data.id ? String(o.data.id) : '';
        if (!door) return;
        V.del(DOOR_RUNS + '/' + door);
        if (o.data.what !== 'run') V.del(DOORS + '/' + door);
        return;
      }
      if (o.replace === true) { replaced(o); return; }
      if (stale(o)) return;
      if (o.table) { side(o); return; }
      var it = facts(o.item);
      if (!it) return;
      if (o.removed) { V.del(ITEMS + '/' + it.id); V.del(PARTS + '/' + it.id); return; }
      rowOf(o, it);
    }

    // A PART READ WHEN NEEDED (goal/G33.4, box v46): the answer of item.box, item.chat (its newest lines), item.checks or
    // item.files (all of them) for an item of the current goal, kept from now on beside its facts. A read of anything
    // narrower (an older page of chat, files under a folder) is not a part and is not kept.
    // A part is kept only for an item of the goal the stream pushed: what the push does not keep current
    // is never kept, so a client the stream does not reach asks the desk every time and is never stale.
    function took(verb, args, answer) {
      var id = String((args && args.id) || '');
      if (!id || !answer || typeof answer !== 'object') return;
      var row = V.get(ITEMS + '/' + id);
      var current = V.get(STATE + '/current');
      if (!row || !current) return;
      var g = goalOf(row);
      if (g !== current) return;
      if (verb === 'item.box' && typeof answer.box === 'string') keep(id, { box: answer.box, version: Number(answer.version) || 0 });
      else if (verb === 'item.chat' && Array.isArray(answer.chat) && !(args && args.before)) keep(id, { chat: answer.chat, chatMore: answer.chatMore === true });
      else if (verb === 'item.checks' && Array.isArray(answer.checks)) keep(id, { checks: answer.checks });
      else if (verb === 'item.files' && Array.isArray(answer.files) && !(args && args.under)) keep(id, { files: answer.files, filesMore: answer.filesMore === true });
    }

    D.addTranslator({
      onJob: function (job) {
        if (!(job && job.module === 'spirit.app.desk' && job.app && typeof job.app === 'object')) return;
        V = D.viewAt(job.fromNode || null, 'desk');
        try { published(job.app); } finally { V = HOME; }
      },
    });
    // THE READS, ANSWERED HERE (goal/G41.28): what the cache holds of the desk, by what it is, never by branch name.
    //   branch     the trunk's whole path, for a list that is a view of it (probabilitySearch's data); rulesBranch the rules'
    //   item(id)   an item's facts;  items()  every item kept, id -> facts
    //   part(id)   the parts of an item read so far;  keepPart(id, fields)  more of them;  forget(id)  one item's
    //   parts dropped;  forgetAll()  every item's parts dropped
    //   current()  the goal last pushed whole;  change()  the newest change number heard;  rule(key)  a rule kept
    //   answer(verb, args, room)  a desk read answered from what is kept, or null
    //   rules.keep(row)  a rule as rule.get answered it;  rules.watch(key, fn)  fn(row) on every change of that rule
    //   parts.watch(id, fn)  fn(parts) on every change of an item's (or a rule's) parts, undefined once dropped
    //   doors.keep(door), doorRuns.keep(id, run)  a stack-frame door and its run state (no reader left; see the
    //   doors.watch(id, fn), doorRuns.watch(id, fn)  DISCREPANCY above): fn(row) on every change, undefined once dropped
    // Each watch answers its release.
    function rowTable(branch) {
      return {
        watch: function (id, fn) { return HOME.watch(branch + '/' + String(id), function (whole, v) { if (typeof fn === 'function') fn(v); }); },
      };
    }
    var rules = rowTable(RULES);
    rules.keep = function (row) { if (row && row.key) V.set(RULES + '/' + String(row.key), row); };
    var doors = rowTable(DOORS);
    doors.keep = function (door) { if (door && door.id) V.set(DOORS + '/' + String(door.id), door); };
    var doorRuns = rowTable(DOOR_RUNS);
    doorRuns.keep = function (id, run) { if (id && run && typeof run === 'object') V.set(DOOR_RUNS + '/' + String(id), run); };
    var deskReads = {
      rules: rules,
      parts: rowTable(PARTS),
      doors: doors,
      doorRuns: doorRuns,
      published: published, took: took,
      // Whole paths, the home node's, asked when a list is made.
      get branch() { return HOME.path(ITEMS); },
      get rulesBranch() { return HOME.path(RULES); },
      item: function (id) { return id ? V.get(ITEMS + '/' + id) || null : null; },
      items: function () { return V.branch(ITEMS); },
      part: function (id) { return id ? V.get(PARTS + '/' + id) || null : null; },
      keepPart: function (id, fields) { keep(String(id || ''), fields); },
      forget: function (id) { if (id) V.del(PARTS + '/' + id); },
      forgetAll: function () { Object.keys(V.branch(PARTS)).forEach(function (id) { V.del(PARTS + '/' + id); }); },
      current: function () { return String(V.get(STATE + '/current') || ''); },
      rule: function (key) { return key ? V.get(RULES + '/' + key) || null : null; },
      change: function () { return Number(V.get(STATE + '/change')) || 0; },
      // A desk read answered from what is kept, as the desk would answer it, or null (cache.answer, on the home node).
      answer: function (verb, args, room) { return cache ? cache.answer(verb, args, HOME, room) : null; },
    };
    return deskReads;
  });
  // In node, for the subscribing appServer and deskClient: the cache rules, as the module's export.
  if (typeof module !== 'undefined' && module && module.exports) module.exports = { cache: cache };
}());
