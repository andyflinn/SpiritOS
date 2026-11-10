'use strict';
// spirit/run/spirit/app/desk/cacheRules.js
// THE DESK FAMILY'S CACHE RULES, FOR NODE ALONE (goal/G41.28): what a subscribing appServer keeps of the desk's rows, and
// the reads deskClient answers from them. A page loads data.js as a file of the family's folder,
// and Andy, on G41.28: "the file has to fit into MAX_PAYLOAD." The rules are node's only, so they live here: data.js
// requires them in node and exports them as its cache, which appServer's stream listener runs (keep, shed). The branch
// names are data.js's alone: it hands them in (rules({ items, parts, state })).
//
// THE DESK'S ROWS IN A CLIENT'S CACHE (goal/G41.12). Andy, Q2: "it sits at the receiving end of the stream, it owns the
// cache, it knows the default cache limit, IT DOESN't HAVE ASK OR TELL ANYBODY HOW IT's JOB IS DONE". The client's
// appServer keeps the rows the desk sends and hands them here, oldest first; the newest row is the one last touched.
//   keep(rows, row)          row placed last, the row of the same thing it makes old taken out: an item's facts, one
//                            side row (its table, item and own key), a rule
//   shed(rows, limit, bytes) the rows that stay once bytes(rows), the cache file's size, is past limit
// THE SHED ORDER IS ANDY'S (Q2): "FIRST YOU shed the longest untouched goal, lock, stock and barrel / when there is
// only one goal, then you shed the longest untouched item, LOCK, stock and barrel, / when there is only one goal with
// one item you shed the oldest chat line." A goal's own row is no item, so it stays with its goal. Rows of no goal (the
// rules) are never shed.
module.exports = function rules(N) {
  var ITEMS = N.items;
  var PARTS = N.parts;
  var STATE = N.state;
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
    return '';
  }
  function keep(rows, row) {
    var p = place(row);
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
  // asked. D is the client's data set as the desk's translator (spirit.data.desk.data) keeps it.
  function bytes(x) { return Buffer.byteLength(JSON.stringify(x), 'utf8'); }
  function answer(verb, args, D, room) {
    var id = String((args && args.id) || '');
    var row = id ? D.get(ITEMS + '/' + id) : null;
    var whole = id ? D.get(PARTS + '/' + id) : null;
    // The facts come with the push (goal/G33.4, box v46); a part once it was read, or the stream brought it.
    if (verb === 'item.get' && row && typeof row.version === 'number') return { item: JSON.stringify(row), version: row.version, change: Number(D.get(STATE + '/change')) || 0 };
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
};
