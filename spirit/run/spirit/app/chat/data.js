// spirit/run/spirit/app/chat/data.js
// WHAT A CLIENT KNOWS OF THE CHATS, IN THE chat BRANCH'S OWN FOLDER (goal/G41.28; the branch is chat since goal/G43.31). Andy: "anything not using the
// new spiritData.js and it's buddies clientCacheManager.js must do so in this item. no exceptions." A page loads it
// through spirit.cacheManager('chat'); it keeps the chats' lines in that page's spirit.data, under the node that
// served them.
//
// THE BRANCH IS THIS FILE'S, AND ONLY THIS FILE NAMES IT: every reader (Chatter's window and its search) asks
// spirit.data.chat.data (below), never a branch by name.
//   lines   peer + newline + sent + ':' + seq -> the line { peer, sent, seq, at, text, receivedAt, re, refused }
//   chats   peer -> that chat's row as chats.search answers it { at, sent, seq, unanswered }
// Every line the server publishes ({ line }, goal/G4.2: each kept line, written or received, and each change of a
// written line's mark) is kept as it came; a reader seats the lines a read or a search answered (keep). It asks nothing.
(function () {
  var LINES = 'lines';
  var CHATS = 'chats';
  function keyOf(peer, sent, seq) { return String(peer) + '\n' + Number(sent) + ':' + Number(seq); }
  function lineOf(peer, l) {
    return { peer: String(peer), sent: Number(l.sent), seq: Number(l.seq), at: String(l.at || ''), text: String(l.text || ''),
      receivedAt: String(l.receivedAt || ''), re: l.re || { writer: '', seq: 0 }, refused: String(l.refused || '') };
  }
  var D = typeof window !== 'undefined' ? window.spirit.data : require('../../../spirit/data.js');
  D.makeFamily('chat', function () {
    var HOME = D.viewAt(null, 'chat');
    function put(V, peer, l) {
      if (!peer || !l || l.seq === undefined || l.sent === undefined) return;
      V.set(LINES + '/' + keyOf(peer, l.sent, l.seq), lineOf(peer, l));
    }
    var heard = [];   // published(fn): the readers told of a line the server published, after it is kept
    D.addTranslator({
      onJob: function (job) {
        var l = job && job.module === 'spirit.app.chat' && job.app && job.app.line;
        if (!l || !l.peer) return;
        var V = D.viewAt(job.fromNode || null, 'chat');
        var fresh = !V.get(LINES + '/' + keyOf(l.peer, l.sent, l.seq));
        put(V, l.peer, l);
        var kept = lineOf(l.peer, l);
        heard.slice().forEach(function (fn) { try { fn(kept.peer, kept, fresh); } catch (e) { /* one reader's fault */ } });
      },
    });
    // THE READS AND THE ONE WRITE:
    //   keep(peer, lines)   lines a read or a search of that chat answered, kept as the server holds them
    //   line(peer, sent, seq)   one line, or null;  lines(peer)  that chat's lines kept, by time, then seq
    //   watch(fn)           fn(peer, line) on every line kept or changed; answers its release
    //   published(fn)       fn(peer, line, fresh) for a line the server published, once kept (an arrival, not a read);
    //                       fresh when it was not kept before (a new line, not a mark changed); answers its release
    //   forgot(fn)          fn() when the cache forgot every line (the stream came back: spirit.data forgets on a reconnect,
    //                       goal/G41.3), so a reader asks again what it shows; answers its release
    //   branch              the lines' whole path, for a list that is a view of it (probabilitySearch's data)
    var chatReads = {
      keep: function (peer, lines) { (lines || []).forEach(function (l) { put(HOME, peer, l); }); },
      // The chats' rows a chats.search answered ({ items: [{ key: peer, label: json }] }), kept by peer; chat(peer) one.
      keepChats: function (answer) {
        ((answer && answer.items) || []).forEach(function (it) {
          var row = null;
          try { row = JSON.parse(it.label || '{}'); } catch (e) { row = null; }
          if (it && it.key && row && typeof row === 'object') HOME.set(CHATS + '/' + it.key, row);
        });
      },
      chat: function (peer) { return peer ? HOME.get(CHATS + '/' + peer) || null : null; },
      line: function (peer, sent, seq) { return HOME.get(LINES + '/' + keyOf(peer, sent, seq)) || null; },
      lines: function (peer) {
        var all = HOME.branch(LINES);
        var pre = String(peer) + '\n';
        return Object.keys(all).filter(function (k) { return k.indexOf(pre) === 0; }).map(function (k) { return all[k]; })
          .sort(function (a, b) { return a.at < b.at ? -1 : a.at > b.at ? 1 : a.seq - b.seq; });
      },
      watch: function (fn) { return HOME.watch(LINES, function (whole, v) { if (v && typeof fn === 'function') fn(v.peer, v); }); },
      forgot: function (fn) { return HOME.watch(LINES, function (whole, v) { if (v === undefined && String(whole) === String(HOME.path(LINES)) && typeof fn === 'function') fn(); }); },
      published: function (fn) {
        if (typeof fn !== 'function') return function () {};
        heard.push(fn);
        return function () { heard = heard.filter(function (x) { return x !== fn; }); };
      },
      get branch() { return HOME.path(LINES); },
      keyOf: keyOf,
    };
    return chatReads;
  });
}());
