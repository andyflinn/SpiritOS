'use strict';
// spirit/run/spirit/app/desk/data.js
// WHAT THE DESK KNOWS OF ITS ROWS AT THE RECEIVING END, IN THE DESK'S OWN FOLDER (goal/G41.24; Andy: "where
// clientCacheManager.js must work in both browser and an appServer that subscribes? and deskClient can get it form its own
// disc?"). Two halves: the cache rules, family/cacheRules.js (a node's alone), and the translator. A page loads it from the node that served it (spirit.requireScript); a subscribing appServer
// requires it from its own run root, takes cache from module.exports, and runs the translator into its spirit.required.spirit.data.
// It is read by peers through the family's FS verbs like anything in this folder: rules, never secrets.
//
// THE DESK'S TRANSLATOR (goal/G33.3, goal/G33.4): what the desk's stream means for spirit.required.spirit.data (spirit/data/script.js),
// in the page and in node alike. Andy: a desk client keeps what it learned of the current goal "like face-apps do", in
// "an updated shared client block that handles this same for deskClient and the web-UI", so "anything the agent needs is
// already on hand". THE BRANCHES ARE THIS FILE'S, AND ONLY THIS FILE NAMES THEM (goal/G41.28; Andy: "the FUCKING desk cache
// is NOT to be found in spirit.required.spirit.data.data.desk", and "doesn't the fucking ... clientCacheManager.js take care of that"):
// every reader, the page, deskDetails and deskClient, asks spirit.required.spirit.data.desk.data (below), never a branch by its name.
//   desk        id -> the item's facts, as items.search labels them and the List draws them (the trunk)
//   deskItem    id -> the parts of an item read so far, each on its own: { box, version }, { chat, chatMore },
//               { checks } (a branch). goal/G33.4 (box v46): a part comes when it is needed, by
//               its own read (took), and the side rows the desk pushes keep it current from then on.
//   deskState/current  the goal the stream last pushed whole;  deskState/change  the newest change number heard
// The rows come as jobs of module spirit/app/desk: in the page as the desk's publishes, in a server that follows the
// desk's stream (deskClient) through appServer's listener (spirit/server/app/script.js), which hands each row in exactly so.
// One row each (goal/G33.4): an item's List row, or one side row (a chat line, the box, a check); the
// stream's bundles are appServer's, which hands their rows in one by one (goal/G41.12).
// Every event ends in set, merge or del; it asks nothing and keeps nothing of its own.
(function family() {
  // THE CACHE RULES ARE NODE'S (goal/G41.28; Andy: "the file has to fit into MAX_PAYLOAD."): keep, shed and the kept
  // reads, in ./cacheRules.js, required in node alone (appServer, deskClient), handed this file's names; a page has none.
  // THE NAMES, here alone.
  var ITEMS = 'desk';
  var PARTS = 'deskItem';
  var STATE = 'deskState';
  var DOORS = 'deskDoors';
  var DOOR_RUNS = 'deskDoorRuns';
  var cache = typeof module !== 'undefined' && module && module.exports && typeof require === 'function'
    ? require('../../script.js').requireScript('spirit/app/desk/cacheRules.js').rules({ items: ITEMS, parts: PARTS, state: STATE }) : null;
  // THE TRANSLATOR, ONCE PER DATA SET: spirit.required.spirit.data.makeFamily runs this once, however often the file is loaded.
  var D = typeof require === 'function' ? require('../../script.js').requireScript('spirit/data/script.js') : window.spirit.required.spirit.data;
  // THE DATA SET IT FILES INTO, REQUIRED BY ITSELF (goal/G47.1, box v182: "It is loaded by that path with spirit.requireScript,
  // data.js exactly as api.js"): on a page that has not loaded spirit/data/script.js yet, this file loads it and runs again.
  if (!D) { window.spirit.requireScript('spirit/data/script.js').then(function () { if (window.spirit.required.spirit.data) family(); }); return; }
  D.makeFamily('desk', function () {
    // THE DESK'S ROWS UNDER THE NODE THAT SERVED THEM (goal/G41.28; Andy, the box: "The RAM-CACHE-is organized BY
    // SERVER-NODE-ID at it's lowest level. IE: spirit.required.spirit.data.<server-public-key-in-base64url>.<api-family>...."): V is the desk
    // family's view of one node. A row from the stream is filed under its job's node (fromNode); every read is of the
    // home node (spirit.required.spirit.data's home(): a page's own node, a process's sender).
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
      // The current goal is the current row's alone (goal/G49.8, box v4): a goal.whole row keeps its item's facts and names
      // no current goal, so an old goal's rows replayed from a cache never move it.
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
    }
    function published(o) {
      if (!o || typeof o !== 'object') return;
      // The newest change heard, as item.get answers it. No position: the stream keeps its own (appServer, goal/G41.12).
      if (typeof o.change === 'number' && o.change > (Number(V.get(STATE + '/change')) || 0)) V.set(STATE + '/change', o.change);
      // THE CURRENT SELECTION (goal/G49.8, box v4; Andy: "the \"current\" selection is just another streamed item"): the
      // desk's row {current}, kept by a client's cache and streamed to a page at its connect, names the current goal.
      if (typeof o.current === 'string' && !o.item && !o.table) { if (o.current) V.set(STATE + '/current', o.current); return; }
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
      if (o.table) { side(o); return; }
      var it = facts(o.item);
      if (!it) return;
      if (o.removed) { V.del(ITEMS + '/' + it.id); V.del(PARTS + '/' + it.id); return; }
      rowOf(o, it);
    }

    // A PART READ WHEN NEEDED (goal/G33.4, box v46): the answer of item.box, item.chat (its newest lines) or item.checks
    // for an item of the current goal, kept from now on beside its facts. A read of anything narrower (an older page of
    // chat) is not a part and is not kept.
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
      else if (verb === 'item.chat' && Array.isArray(answer.chat)) keep(id, { chat: answer.chat, chatMore: answer.chatMore === true });
      else if (verb === 'item.checks' && Array.isArray(answer.checks)) keep(id, { checks: answer.checks });
    }

    D.addTranslator({
      onJob: function (job) {
        if (!(job && job.module === 'spirit.app.desk' && job.app && typeof job.app === 'object')) return;
        V = D.viewAt(job.fromNode || null, 'desk');
        try { published(job.app); } finally { V = HOME; }
      },
    });
    // THE READS, ANSWERED HERE (goal/G41.28): what the cache holds of the desk, by what it is, never by branch name.
    //   branch     the trunk's whole path, for a list that is a view of it (probabilitySearch's data)
    //   item(id)   an item's facts;  items()  every item kept, id -> facts
    //   part(id)   the parts of an item read so far;  keepPart(id, fields)  more of them;  forget(id)  one item's
    //   parts dropped;  forgetAll()  every item's parts dropped
    //   current()  the goal last pushed whole;  change()  the newest change number heard
    //   answer(verb, args, room)  a desk read answered from what is kept, or null
    //   parts.watch(id, fn)  fn(parts) on every change of an item's parts, undefined once dropped
    //   doors.keep(door), doorRuns.keep(id, run)  a stack-frame door and its run state (no reader left; see the
    //   doors.watch(id, fn), doorRuns.watch(id, fn)  DISCREPANCY above): fn(row) on every change, undefined once dropped
    // Each watch answers its release.
    function rowTable(branch) {
      return {
        watch: function (id, fn) { return HOME.watch(branch + '/' + String(id), function (whole, v) { if (typeof fn === 'function') fn(v); }); },
      };
    }
    var doors = rowTable(DOORS);
    doors.keep = function (door) { if (door && door.id) V.set(DOORS + '/' + String(door.id), door); };
    var doorRuns = rowTable(DOOR_RUNS);
    doorRuns.keep = function (id, run) { if (id && run && typeof run === 'object') V.set(DOOR_RUNS + '/' + String(id), run); };
    var deskReads = {
      parts: rowTable(PARTS),
      doors: doors,
      doorRuns: doorRuns,
      published: published, took: took,
      // Whole paths, the home node's, asked when a list is made.
      get branch() { return HOME.path(ITEMS); },
      item: function (id) { return id ? V.get(ITEMS + '/' + id) || null : null; },
      items: function () { return V.branch(ITEMS); },
      part: function (id) { return id ? V.get(PARTS + '/' + id) || null : null; },
      keepPart: function (id, fields) { keep(String(id || ''), fields); },
      forget: function (id) { if (id) V.del(PARTS + '/' + id); },
      forgetAll: function () { Object.keys(V.branch(PARTS)).forEach(function (id) { V.del(PARTS + '/' + id); }); },
      current: function () { return String(V.get(STATE + '/current') || ''); },
      change: function () { return Number(V.get(STATE + '/change')) || 0; },
      // A desk read answered from what is kept, as the desk would answer it, or null (cache.answer, on the home node).
      answer: function (verb, args, room) { return cache ? cache.answer(verb, args, HOME, room) : null; },
    };
    return deskReads;
  });
  // In node, for the subscribing appServer and deskClient: the cache rules, as the module's export.
  if (typeof module !== 'undefined' && module && module.exports) module.exports = { cache: cache };
}());
