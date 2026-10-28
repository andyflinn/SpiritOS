// spirit/run/process/js/desk/: the desk server's family interface, where spirit.familyPath('desk') finds it (goal/G41.12)
// THE desk SERVER'S INTERFACE (goal/G32.3): every verb it serves, each argument with its rule (spirit.js's
// standard, '?' optional). The node answers this text to api {family} without the server hearing of it, and maps it
// to its name: it names no family of its own. WRITTEN BY HAND FROM THE HANDLERS (Andy, 2026-10-22, on the generated
// first cut: "request validation worth a damn?"): an argument is required wherever the door's exact request shape or
// the handler needs it, optional only where the verb's own accepts() lets it be left out; each rule is the tightest
// that every value the handler takes still passes ('text' where '' is a real value, 'id' where it must name something,
// the field rules where the handler applies them). The server checks everything again. A verb added to the server is
// added here, in the same commit. DEBUG and DEPENDENCIES are appServer's, not listed here.
module.exports = {
  verbs: {
    // Only listening or working; the server refuses any other word.
    'agent.state': { word: 'id' },
    block: { id: 'id', blocks: 'id' },
    'block.targets': { id: 'id' },
    'box.release': { id: 'id' },
    'box.take': { id: 'id' },
    // An empty box is a box: text may be ''.
    'box.write': { id: 'id', text: 'text', version: 'number' },
    'chat.add': { id: 'id', text: 'text' },
    // Each filter left '' filters nothing; scope is '', goal or items.
    'chat.search': { id: 'id', text: 'text', by: 'text', since: 'text', before: 'text', scope: 'text' },
    // kind is C, T, G or Q; words and test may be '' (commitCheck sends test '').
    'check.add': { id: 'id', kind: 'id', words: 'text', test: 'text' },
    // check is a check's number, or 'all' for his Grant-All.
    'check.set': { id: 'id', check: 'id', state: 'id' },
    // commit may be '' only for a plain item's build claim. No suites (goal/G40.3): a red claim names the item's suite
    // rows, added with item.suites.add, and is refused while there are none.
    claim: { id: 'id', phase: 'id', commit: 'text' },
    // The handler trims and refuses an empty title; it applies no label rule to a goal's.
    'goal.add': { title: 'id' },
    // The title passes the label rule (fieldWhy); blocks may be left out or '' (the goal).
    'item.add': { goal: 'id', title: 'name', blocks: 'text?' },
    'item.box': { id: 'id' },
    'item.chat': { id: 'id' },
    'item.checks': { id: 'id' },
    // goal/G33.7: each table's search, one component (desk.js tableSearch), ranked by text, bounded, more.
    'item.box.search': { id: 'id', text: 'text' },
    'item.checks.search': { id: 'id', text: 'text' },
    'item.claims.search': { id: 'id', text: 'text' },
    'item.files.search': { id: 'id', text: 'text' },
    'item.suites.search': { id: 'id', text: 'text' },
    'item.delete': { id: 'id' },
    // under '' keeps every path; the door's shape needs it sent.
    'item.files': { id: 'id', under: 'text?' },
    // One row a write (goal/G40.3): one path; no '..'. A path already there (add) or not there (remove) is refused,
    // naming it. A suite is a spirit/test/ .js path, the red writer's. goal/G41.11, for the desk only: item.files.add takes
    // path or paths, a list cut at one answer (the server answers added and more).
    'item.files.add': { id: 'id', path: 'text?', paths: 'list?' },
    'item.files.remove': { id: 'id', path: 'text' },
    'item.suites.add': { id: 'id', path: 'text' },
    'item.suites.remove': { id: 'id', path: 'text' },
    'item.get': { id: 'id' },
    'item.release': { id: 'id' },
    'item.rename': { id: 'id', title: 'text' },
    // tone (goal/G33.11): test or code, the deskClient's file report; '' or left out for a plain status word. Missing
    // here, the spirit object refused every report before it left (found on goal/G40.3).
    'item.status': { id: 'id', word: 'text', tone: 'text?' },
    'item.take': { id: 'id' },
    'agents.search': { text: 'text' },
    'items.search': { text: 'text', currentGoalOnly: 'bool', goalsOnly: 'bool', includeClosed: 'bool' },
    'line.take': { id: 'id' },
    // pass and why only for a verify; red and build send neither.
    'phase.done': { id: 'id', phase: 'id', pass: 'bool?', why: 'text?' },
    'phase.may': { id: 'id' },
    'phase.take': { id: 'id', phase: 'id' },
    // id is '' for start-design with nothing open, which starts a new goal.
    press: { id: 'text', what: 'id' },
    // agent '' is the caller.
    'profile.get': { agent: 'text' },
    // His alone. A name or nick left '' is no name or no nick; a name otherwise passes the label rule.
    'profile.set': { agent: 'id', name: 'name', nick: 'text', included: 'bool?', cap: 'bool?' },
    'rule.add': { type: 'id', label: 'name', text: 'paragraph' },
    'rule.draft': { key: 'id', text: 'paragraph' },
    'rule.get': { key: 'id' },
    'rule.version': { key: 'id', text: 'paragraph', status: 'id' },
    'rules.search': { text: 'text', types: 'list', statuses: 'list' },
    // goal/G33.7: seen per item, the arrival time of the newest thing he looked at under it.
    'seen.get': { id: 'id' },
    'seen.set': { id: 'id', at: 'text' },
    signoff: {},
    // goal/G33.8: appServer's streamPublisher (js/appServer.js): the caller's key subscribes to the desk's rows, sent to
    // its family of that name; unsubscribe stops it. Who may is the node's grant.
    // run and since (goal/G41.12): the subscriber's position, the run of the desk and the number of the last row it took
    // in it; the desk's log hands what came after, or the desk pushes in full.
    subscribe: { family: 'id', run: 'text?', since: 'number?' },    unsubscribe: {},
    // goal/G33.7: the door list as a bounded search, and one door's read (stackFrameChecks.doors went).
    'stackFrameChecks.door': { id: 'id' },
    'stackFrameChecks.doors.search': { text: 'text' },
    // goal/G40.3: a door from its gate and endpoint; its paths and suites one row a write (path: the request path, or the
    // suite's file name of spirit/test), each its own search.
    'stackFrameChecks.make': { gate: 'id', endpoint: 'id' },
    'stackFrameChecks.paths.add': { id: 'id', path: 'text' },
    'stackFrameChecks.paths.remove': { id: 'id', path: 'text' },
    'stackFrameChecks.paths.search': { id: 'id', text: 'text' },
    'stackFrameChecks.suites.add': { id: 'id', path: 'text' },
    'stackFrameChecks.suites.remove': { id: 'id', path: 'text' },
    'stackFrameChecks.suites.search': { id: 'id', text: 'text' },
    'stackFrameChecks.remove': { id: 'id' },
    'stackFrameChecks.run': { id: 'id' },
    'stackFrameChecks.runState': { id: 'id' },
    'stackFrameChecks.update': { id: 'id', gate: 'id', endpoint: 'id' },
    unblock: { id: 'id', blocks: 'id' },
    // why may be '': the desk words a rejection without one.
    'work.open': {},
  },
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
  cache: (function () {
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
      if (row.profile) return 'profile ' + row.profile;
      if (row.seen) return 'seen ' + row.seen;
      return '';
    }
    // A row older than the one it would replace (a lower change: the shared current goal merged after the stream brought
    // newer) is not taken; the rows stay as they were.
    function keep(rows, row) {
      var id = identity(row);
      if (id && typeof row.change === 'number' && rows.some(function (r) { return identity(r) === id && typeof r.change === 'number' && r.change > row.change; })) return rows;
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
  }()),
};
