'use strict';
// spirit/run/spirit/script.js (goal/G43.18: moved from the run root, served at /spirit.js as before)
// THE SPIRIT OBJECT (goal/G32.1): the node api for face apps, one file. face.html loads it first, by a script tag, from
// the relay or the home node (goal/G41.19); the home node's index.html loads it; a server process requires it.
// THE ONE DOOR (goal/G40.1; at the run root until goal/G43.18, in spirit/ since, line 1). Every script that is not the
// node or a relay server installs it first, as the global spirit, "and then use[s] that object properly" (Andy). The node and the relay require it first too (server.js, relayServer.js): they are its embodiments.
// Andy: "a spirit face-app needs a damn spirit object, that packages all neccessary loopback calls on the home node into
// something easy to use", and "the whole node api (not appServer API's) must be provided in JavaScript form, as an
// asyncFunction set."
//
// WHAT IT IS
//   - The core: the transport, the checks, the helpers (error, formatBytes, escapeHtml) and the assembling.
//   - The rest comes from the api.js every branch folder holds (spirit/fs/script.js, spirit/contact/api.js ...; a server's in
//     its app folder, spirit/app/<name>/api.js), written to this file's standard: module.exports = { verbs: { <verb>:
//     { <argument>: '<rule>' } }, functions: { <verb>: '<its function>' }, names(call, tools) }. One member per branch: spirit.required.spirit.fs.api.load({path}),
//     spirit.required.spirit.contact.api.label({...}) ..., every verb an async function answering the reply's body; a dotted verb is also
//     there in camel case (spirit.required.spirit.app.chat.api.lineWrite for line.write).
//   - WHERE A MEMBER COMES FROM (goal/G32.3). Andy, 2026-10-22: "the api.js files should not assume the namespace they
//     will occupy in the spirit object, that mapping belongs to the node". The names are the branches the verb api
//     answers; each branch's interface is api {branch}, the text of its api.js as the node reads it, run here as a
//     module and bound under the name the node gave. No path of the page's own, and no api.js names itself.
//
// THE CHECK IS COMPLETE (Andy: "the pages check must be complete"): before a call goes out, every argument is checked
// against its verb's declaration: no argument the verb does not name (no-such-argument), every required one present,
// each by its rule (bad-request). A malformed call never leaves. The node stays the gate and checks everything again.
// A reply that is not 2xx refuses, with its status and the node's own code.
//
// THE RULES (the standard a branch's api.js writes to; '?' after a rule makes the argument optional):
//   text        any string                      flag      '' or 'yes'
//   name        a label, by its type            number    a finite number
//   description a description, by its type     bool      true or false
//   paragraph   a paragraph, by its type        object    a plain object
//   key         a peer's public key             list      an array
//   path        a path inside the node's run folder, relative, no '..'
//   url         an http or https address        id        a non-empty string
//
// WHERE IT RUNS: on the face its calls go through window.spirit.transport (the sealed link to the home node); at home
// through the node's own door (POST /spirit); in node through the node's loopback door at the url it is given.
(function (root) {
  'use strict';

  // ── WHERE IT RUNS, TOLD HERE AND NOWHERE ELSE (goal/G40.6) ─────────────────────────────────────────────────────────
  // Andy: spirit.js is "the one and only place that can tell face from node isBrowser() isNode()". Every branch below
  // asks these two, and no other file asks at all.
  function isNode() { return typeof module === 'object' && !!module && !!module.exports && typeof process === 'object' && !!(process && process.versions && process.versions.node); }
  function isBrowser() { return !isNode() && typeof window === 'object' && root === window; }
  // THEN, IN A BROWSER, LOOPBACK OR NOT (Andy, 2026-10-25: "spirit.js is loaded, it then check node/browser, then if
  // browser it check loopback/not-loopback, then decides what more to fetch"): a loopback page is on its home node; any
  // other is a face reached through a relay.
  function isLoopback() { var h = isBrowser() && root.location ? String(root.location.hostname || '') : ''; return h === '127.0.0.1' || h === 'localhost' || h === '::1' || h === '[::1]'; }

  // ── THE GLOBAL, FIRST (goal/G40.6) ───────────────────────────────────────────────────────────────────────────────
  // Rule one: every module and page loads spirit.js first, and spirit is a plain global before anything else is loaded;
  // everything below fills this one object.
  var self = root.spirit = root.spirit && typeof root.spirit === 'object' ? root.spirit : {};

  // ── THE HELPERS, the object's own (the kernel's, answering the same) ──────────────────────────────────────────────
  function error(str) {
    if (typeof console !== 'undefined') console.error('ERROR: ' + str);
    return { error: { string: str } };
  }
  function formatBytes(bytes, decimals) {
    if (bytes === 0) return '0 Bytes';
    var dm = decimals === undefined ? 2 : (decimals < 0 ? 0 : decimals);
    var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    var i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(dm)) + ' ' + sizes[i];
  }
  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // A TEXT TIDIED BEFORE IT IS STORED (goal/G49.13; Andy: "place additional string utilities ... inside of spirit/script.js
  // beside spirit.escapeHtml() normalizeString(str)"; moved from the old rules file, which goes): one way of writing each letter (NFC),
  // runs of white space one space, the ends trimmed. "  Andy   Flinn " is "Andy Flinn". Not a string: ''.
  function normalizeString(str) {
    if (typeof str !== 'string') return '';
    return (str.normalize ? str.normalize('NFC') : str).replace(/\s+/g, ' ').trim();
  }
  // A paragraph keeps its line breaks: NFC, and every \r\n a \n. Not a string: ''.
  function normalizeParagraph(str) {
    if (typeof str !== 'string') return '';
    return (str.normalize ? str.normalize('NFC') : str).replace(/\r\n/g, '\n');
  }

  // ── THE CHECKS ──────────────────────────────────────────────────────────────────────────────────────────────────
  // name, description and paragraph are their types' isValid (goal/G49.13: the old rules
  // file goes), each type named by its full path.
  function byType(file, v) {
    if (typeof v !== 'string') return 'a text';
    var rule = typeRule(file);
    return rule ? rule(v) : '';
  }
  function isPlain(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  // A peer's public key: an Ed25519 key in its SPKI form, base64, as every key on this network is written.
  var KEY = /^MCowBQYDK2VwAyEA[A-Za-z0-9+/]{43}=$/;
  var RULES = {
    text: function (v) { return typeof v === 'string' ? '' : 'a text'; },
    id: function (v) { return typeof v === 'string' && v.length > 0 ? '' : 'a non-empty text'; },
    flag: function (v) { return v === '' || v === 'yes' ? '' : '\'\' or \'yes\''; },
    number: function (v) { return typeof v === 'number' && isFinite(v) ? '' : 'a number'; },
    bool: function (v) { return typeof v === 'boolean' ? '' : 'true or false'; },
    object: function (v) { return isPlain(v) ? '' : 'an object'; },
    list: function (v) { return Array.isArray(v) ? '' : 'a list'; },
    key: function (v) { return typeof v === 'string' && KEY.test(v) ? '' : 'a peer\'s public key'; },
    url: function (v) { return typeof v === 'string' && /^https?:\/\/[^\s]+$/.test(v) ? '' : 'an http or https address'; },
    path: function (v) {
      if (typeof v !== 'string' || !v) return 'a path';
      var p = v.replace(/\\/g, '/');
      if (p.charAt(0) === '/' || /^[A-Za-z]:/.test(p) || p.indexOf('\0') !== -1) return 'a path inside the run folder';
      return p.split('/').indexOf('..') !== -1 ? 'a path without ..' : '';
    },
    name: function (v) { return normalizeString(v) ? byType('spirit/type/string/label/script.js', v) : (typeof v === 'string' ? '' : 'a text'); },
    description: function (v) { return byType('spirit/type/string/description/script.js', v); },
    paragraph: function (v) { return byType('spirit/type/string/paragraph/script.js', v); },
  };
  function refusal(code, why, extra) {
    var e = new Error(why);
    e.code = code;
    if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
    return e;
  }
  // A RULE THAT NAMES A TYPE (goal/G48.4, the box: "a type identifier is ALWAYS spirit.type.*"; wsl's red: "an argument's
  // rule is spirit.type.<...>, a trailing ? making it optional, and its type file spirit/type/<...>.js is there"): the type
  // file's isValid asked, '' when it answers true, its error's words when it throws. On the node the file is required; on a
  // page it is what spirit.required holds, and a type not loaded there yet is left to the node, which checks every call again.
  // null for a rule that is not a type's.
  // A TYPE IS NAMED BY ITS FILE'S FULL PATH, spirit/type/string/label/script.js (goal/G49.13; Andy: "FIX THE FUCKING
  // DYNAMICALLY CREATED spirit/type/* SHIT!!!!!!!!!!!!!"): the rule is that path, handed to the loader as it is, never made from a
  // dotted name. On the node it is required; on a page it is what the loader placed for that path, if it has loaded.
  function typeRule(raw) {
    if (!/^spirit\/type\/[A-Za-z0-9\/]+\/script\.js$/.test(raw)) return null;
    var T = null;
    if (isNode()) {
      try { T = requireOne(raw); } catch (e) { return null; }
      if (T && typeof T.then === 'function') { T.then(null, function () { /* not there: no rule */ }); return null; }
    } else {
      var keys = placeKeys(raw);
      T = required;
      for (var i = 0; i < keys.length && T; i += 1) T = T[keys[i]];
      if (!T || typeof T.isValid !== 'function') return function () { return ''; };
    }
    if (!T) return null;
    return function (v) { try { return T.isValid(v) === true ? '' : 'a valid ' + raw; } catch (e) { return (e && e.message) || ('a valid ' + raw); } };
  }
  // Every argument checked against the verb's declaration; the first fault refuses the whole call.
  function check(name, spec, args) {
    var a = args === undefined ? {} : args;
    if (!isPlain(a)) return refusal('bad-request', name + ': its arguments are an object');
    var keys = Object.keys(a);
    for (var i = 0; i < keys.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(spec, keys[i])) return refusal('no-such-argument', name + ' takes no argument ' + keys[i], { argument: keys[i] });
    }
    var names = Object.keys(spec);
    for (var j = 0; j < names.length; j++) {
      var arg = names[j];
      var raw = String(spec[arg]);
      var optional = raw.charAt(raw.length - 1) === '?';
      var bare = optional ? raw.slice(0, -1) : raw;
      var rule = typeRule(bare) || RULES[bare];
      if (!rule) return refusal('bad-request', name + ': no rule ' + raw + ' for ' + arg);
      if (a[arg] === undefined) {
        if (optional) continue;
        return refusal('bad-request', name + ' needs ' + arg, { argument: arg });
      }
      var why = rule(a[arg]);
      if (why) return refusal('bad-request', name + ': ' + arg + ' must be ' + why, { argument: arg });
    }
    return null;
  }

  // ── ONE POST AND ONE GET (goal/G40.6) ────────────────────────────────────────────────────────────────────────────
  // Andy: "there's one post function and one get. that's it". Nothing else in spirit.js reaches the node: every member
  // packages its arguments and calls one of the two.
  //
  // THIS VM'S NODE (Andy's ruling, goal/G40.6): in the browser the node is the first page's; a node.js process reaches
  // 127.0.0.1, at the port spirit reads from spirit/state/environment.json as it is required.
  // On a page the page's own origin, or the
  // face's link to its home node when one is set; in node 127.0.0.1 and the PORT read below as this file is required.
  // No port, no node: never a default.
  // THE RUN ROOT, the folder every run path starts at: one up from this file, since it moved into spirit/ (goal/G43.18; Andy:
  // "we need to move run://spirit.js to run://spirit/script.js"). In node only.
  var RUN_ROOT = isNode() ? require('path').join(__dirname, '..') : '';
  var PORT = 0;
  if (isNode()) {
    try { PORT = Number(JSON.parse(require('fs').readFileSync(require('path').join(RUN_ROOT, 'spirit', 'state', 'environment.json'), 'utf8')).PORT) || 0; } catch (e) { PORT = 0; }
  }
  function parse(text) { try { return JSON.parse(text); } catch (e) { return null; } }
  function noNode() { return refusal('no-node', 'this VM has no node: spirit/state/environment.json names no port'); }
  function door() { return isNode() ? 'http://127.0.0.1:' + PORT : ''; }
  // The face's link to its home node (window.spirit.transport), on a page only.
  function link() { return isBrowser() && self.transport && typeof self.transport === 'object' ? self.transport : null; }
  // post(verb, args) -> {status, text, body}: { call: verb, args } to the node's /spirit, the name and the arguments
  // apart (goal/G41.15; the box: "ONE ENVELOPE for every call to a node's door"), so an argument named verb is the
  // verb's own. post(verb, args, {stream: true, headers}) answers the response itself, read as it comes: the events
  // branch's subscribe (below).
  function post(verb, args, how) {
    var l = link();
    if (l && typeof l.ask === 'function') return Promise.resolve(l.ask(verb, args || {}));
    if (isNode() && !PORT) return Promise.reject(noNode());
    var payload = { call: String(verb), args: args || {} };
    var headers = { 'Content-Type': 'application/json' };
    Object.keys((how && how.headers) || {}).forEach(function (k) { headers[k] = how.headers[k]; });
    var asked = fetch(door() + '/spirit', { method: 'POST', headers: headers, body: JSON.stringify(payload), signal: (how && how.signal) || undefined });
    if (how && how.stream) return asked;
    return asked.then(function (r) { return r.text().then(function (x) { return { status: r.status, text: x, body: parse(x) }; }); });
  }
  // get(path) -> {status, type, bytes}: a file of the node's run root, by its path.
  function get(path) {
    var p = String(path || '').replace(/^\/+/, '');
    var l = link();
    if (l && typeof l.file === 'function') return Promise.resolve(l.file(p, function () {})).then(function (r) { return { status: r.status, type: r.type || '', bytes: r.bytes }; });
    if (isNode() && !PORT) return Promise.reject(noNode());
    return fetch(door() + '/' + p).then(function (r) {
      return r.arrayBuffer().then(function (b) { return { status: r.status, type: (r.headers && r.headers.get('Content-Type')) || '', bytes: new Uint8Array(b) }; });
    });
  }
  function text(bytes) {
    return new TextDecoder().decode(bytes);
  }
  // A branch's interface, the text api {branch} answered, run as a module: its module.exports is the definition. What it
  // requires as it runs is its tree, as a page script's is (requireOne): its companion data.js (goal/G47.1; Andy's rule:
  // "every api.js requires it's companion data.js, and is the only script to require that data.js"). It answers once those have; one that fails leaves the interface standing.
  function loadInterface(source, name) {
    var m = { exports: {} };
    var outer = collecting;
    var tree = collecting = [];
    try { new Function('module', 'exports', String(source) + '\n//# sourceURL=spirit-interface/' + name + '/api.js')(m, m.exports); } finally { collecting = outer; }
    return Promise.all(tree.map(function (p) { return Promise.resolve(p).then(null, function () {}); })).then(function () { return m.exports; });
  }


  // WHY A CALL WAS REFUSED, IN THE ANSWER'S OWN WORDS (goal/G33.1). Andy: on the face every icon add said "not saved:
  // refused". The relay refuses with {ok: false, error} and no code, and a timeout answers plain text; the words are kept
  // here (the error, else the text, cut to a line), and only an answer with none says its status.
  function saidWhy(r, status) {
    var b = (r && r.body) || {};
    if (b.error) return String(b.error);
    var t = r && typeof r.text === 'string' ? r.text.trim() : '';
    if (t && !/^[{[]/.test(t)) return t.split('\n')[0].slice(0, 200);
    return String(b.code || ('the node answered ' + status));
  }

  // ── THE ASSEMBLING ───────────────────────────────────────────────────────────────────────────────────────────────
  // One member per branch, each verb a checked async call; then the branch's own names (the kernel's, for fs).
  // The name is the one the node gives the branch (its api answer), never one the branch's api.js claims.
  function member(ask, getFile, fam, def) {
    var out = {};
    // ONE SEARCH ON THE WIRE AT A TIME (goal/G43.27; Andy: "a search over the wire should always be \"serialized\" having two
    // of those in flight at the some time is ridiculous.", "put that throttle on spirit.js"): per branch and the node or peer
    // it asks (this member), a search verb (search, or a name ending in .search) waits until the one before it has its
    // answer; the same search asked again while it is on the wire gets that one answer. Every caller is served the same way,
    // the search element's lists, the finder, a branch's own names, with no code of its own.
    var searchTail = Promise.resolve();
    var searchOut = Object.create(null);
    function isSearch(verb) { return verb === 'search' || /\.search$/.test(verb); }
    function serialized(verb, args, send) {
      var key = verb + '\n' + JSON.stringify(args || {});
      if (searchOut[key]) return searchOut[key];
      var turn = searchTail.then(send, send);
      var mine = searchOut[key] = turn.then(function (v) { delete searchOut[key]; return v; }, function (e) { delete searchOut[key]; throw e; });
      searchTail = turn.then(function () {}, function () {});
      return mine;
    }
    function call(verb, args) {
      var spec = def.verbs[verb];
      var name = fam + '.' + verb;
      if (!spec) return Promise.reject(refusal('no-such-verb', 'the ' + fam + ' branch has no verb ' + verb));
      var bad = check(name, spec, args);
      if (bad) return Promise.reject(bad);
      var send = function () { return ask(name, args || {}); };
      return Promise.resolve(isSearch(verb) ? serialized(verb, args, send) : send()).then(function (r) {
        var status = r && r.status;
        if (status >= 200 && status < 300) return r.body !== undefined && r.body !== null ? r.body : {};
        var b = (r && r.body) || {};
        throw refusal(String(b.code || 'refused'), saidWhy(r, status), { status: status, body: b });
      });
    }
    Object.keys(def.verbs || {}).forEach(function (verb) {
      // A branch may name the function that implements a verb (def.functions; goal/G43.7): the verb stays as it is on the wire.
      var named = def.functions && def.functions[verb];
      if (named) { out[named] = function (args) { return call(verb, args); }; return; }
      out[verb] = function (args) { return call(verb, args); };
      // line.write is spirit.required.spirit.app.chat.api.lineWrite as well.
      var camel = verb.replace(/\.([a-zA-Z0-9])/g, function (m, c) { return c.toUpperCase(); });
      if (camel !== verb && !(camel in out)) out[camel] = out[verb];
    });
    // NO FS SET (goal/G43.20): a branch's files are spirit.fs's, by the path its id names.
    // EVERY SERVER'S DEBUG (desk/G2.5, appServer's own verb), bound by hand (goal/G43.15): {} reads it, {on} sets it, and it
    // answers {debug}. A branch's api.js does not list it, so serverDEBUG would find no such function without this.
    if (!out.DEBUG) out.DEBUG = function (args) {
      var a = args || {};
      var keys = Object.keys(a);
      if (keys.some(function (k) { return k !== 'on'; }) || ('on' in a && typeof a.on !== 'boolean')) return Promise.reject(refusal('no-such-argument', 'DEBUG takes {} or {on}'));
      return Promise.resolve(ask(fam + '.DEBUG', a)).then(function (r) {
        if (r && r.status >= 200 && r.status < 300) return r.body !== undefined && r.body !== null ? r.body : {};
        var b = (r && r.body) || {};
        throw refusal(String(b.code || 'refused'), saidWhy(r, r && r.status), { status: r && r.status, body: b });
      });
    };
    // EVERY SERVER'S remote (goal/G47.5, box v12: "it created an auto-verb called \"remote\""), bound by hand as DEBUG is:
    // {} answers { current, items, more }, { id } switches and answers { current }. No api.js lists it, so the title bar's
    // Remote dropdown and appServer's background check would find no such function without this.
    if (!out.remote) out.remote = function (args) {
      var a = args || {};
      var keys = Object.keys(a);
      if (keys.some(function (k) { return k !== 'id'; }) || ('id' in a && (typeof a.id !== 'string' || !a.id))) return Promise.reject(refusal('no-such-argument', 'remote takes {} or {id}'));
      return Promise.resolve(ask(fam + '.remote', a)).then(function (r) {
        if (r && r.status >= 200 && r.status < 300) return r.body !== undefined && r.body !== null ? r.body : {};
        var b = (r && r.body) || {};
        throw refusal(String(b.code || 'refused'), saidWhy(r, r && r.status), { status: r && r.status, body: b });
      });
    };
    // EVERY SERVER'S listener (goal/G47.5; Andy: "they're both auto-verbs. MUST BE.", "PLEASE call the damn thing jus
    // \"listener\""), bound by hand as remote is: { json } is one bundle of a stream's deliveries. A server delivers to a
    // subscriber's branch through this binding (appServer's deliver); with no api.js listing it, a desk subscribed to its
    // sibling's desk was never sent a row.
    // subscribe { branch, run?, since? } and unsubscribe {}, the publisher's two, are bound beside it the same way.
    var autoVerb = function (verb, fits, says) {
      return function (args) {
        var a = args || {};
        if (!fits(a)) return Promise.reject(refusal('no-such-argument', says));
        return Promise.resolve(ask(fam + '.' + verb, a)).then(function (r) {
          if (r && r.status >= 200 && r.status < 300) return r.body !== undefined && r.body !== null ? r.body : {};
          var b = (r && r.body) || {};
          throw refusal(String(b.code || 'refused'), saidWhy(r, r && r.status), { status: r && r.status, body: b });
        });
      };
    };
    if (!out.listener) out.listener = autoVerb('listener', function (a) { return Object.keys(a).length === 1 && typeof a.json === 'string'; }, 'listener takes {json}');
    if (!out.subscribe) out.subscribe = autoVerb('subscribe', function (a) {
      return typeof a.branch === 'string' && (a.run === undefined || typeof a.run === 'string') && (a.since === undefined || typeof a.since === 'number') &&
        Object.keys(a).every(function (k) { return k === 'branch' || k === 'run' || k === 'since'; });
    }, 'subscribe takes {branch, run?, since?}');
    if (!out.unsubscribe) out.unsubscribe = autoVerb('unsubscribe', function (a) { return Object.keys(a).length === 0; }, 'unsubscribe takes {}');
    if (typeof def.names === 'function') {
      var extra = def.names(call, { file: function (p) { return getFile(p); }, text: text, refusal: refusal, check: check });
      Object.keys(extra || {}).forEach(function (k) { if (!(k in out)) out[k] = extra[k]; });
    }
    return out;
  }
  // ── THE ONE INSTANCE BINDS ITS BRANCHES ON ITSELF (goal/G40.6) ──────────────────────────────────────────────────────
  // Andy: "every javascript VM has ONE, one and only spirit object"; "What is createSpirit, it is completely
  // unnecessary"; "every loaded/required module then simply inserts its api functions into the one spirit object".
  // Nothing here makes a second object. A node branch's api.js, run here, inserts its verbs on the instance as
  // spirit.<branch>; a peer's branch is held under that peer's key and answered by spirit.requireScript.
  //
  // A branch's interface asked by ask, and made a member over ask and getFile, or refused no-interface.
  var interfaceDefs = Object.create(null);
  // A BRANCH IS BOUND FROM THE CALLER'S OWN COPY OF ITS api.js, A PEER'S TOO (goal/G43.32; Andy: "ALL, DO IT! WITH CODE FROM
  // THE OWN NODE!"): in node the file on its own disc, required as it is; on a page what its own node answers for it. Only
  // the calls go where ask sends them, to this node or to a peer; nothing a peer hands over is run here.
  function ownInterface(fam) {
    if (isNode()) {
      // The path it was asked by (goal/G49.6; Andy: "ASKING FOR THE API BY FUCKING NAME MUST BE FUCKING FORBIDDEN"): never
      // one made from its name.
      var p = pathOf[fam];
      if (!p || !nodeFiles().statFile(p)) return Promise.reject(refusal('no-interface', 'no interface for the branch ' + fam));
      var file = require('path').join(RUN_ROOT, p);
      if (!Object.prototype.hasOwnProperty.call(nodeOnce, p)) { nodeOnce[p] = require(file); placeAt(required, p, nodeOnce[p]); }
      return Promise.resolve(nodeOnce[p]);
    }
    return Promise.resolve(post('api', { branch: fam })).then(function (got) {
      if (!got || got.status !== 200 || !got.body || typeof got.body.interface !== 'string') throw refusal('no-interface', 'no interface for the branch ' + fam);
      return loadInterface(got.body.interface, fam);
    });
  }
  // A BRANCH'S NODE HALF (goal/G49.2; Andy: "the architechture in the old kernel.js was exactly that it would insert different
  // versions of spirit.fs functions depending on isNode() and isBrowser()"): an api.js that names one (node: '<its path>')
  // has its verbs answered in a node process by that file's answer(verb, args), as { status, body }, the node's own answer;
  // a verb it leaves undefined goes to the node as before. On a page, and for a peer, the calls go where they always went.
  function nodeHalf(def) {
    if (!isNode() || !def || typeof def.node !== 'string') return null;
    var half = null;
    try { half = require(require('path').join(RUN_ROOT, def.node)); } catch (e) { half = null; }
    return half && typeof half.answer === 'function' ? half : null;
  }
  function bindOn(ask, getFile, fam, own) {
    return ownInterface(fam).then(function (def) {
      // The api.js, kept for its place at spirit.required.<its path> (goal/G43.32; requireOne).
      if (def) interfaceDefs[fam] = def;
      if (!def || !def.verbs) throw refusal('no-interface', 'the interface of ' + fam + ' names no verbs');
      // Only this process's own branch: a peer's calls always go to the peer.
      var half = own ? nodeHalf(def) : null;
      // Bound calls go to a node: in node with no port there is none to send them to, so a branch with no node half is not
      // bound (no default port).
      if (isNode() && !PORT && !half) throw noNode();
      var through = !half ? ask : function (name, args) {
        var a = half.answer(name.slice(fam.length + 1), args || {});
        if (a !== undefined) return Promise.resolve(a);
        if (!PORT) return Promise.reject(noNode());
        return ask(name, args);
      };
      return member(through, getFile, fam, def);
    });
  }
  // This VM's node's branch. Two callers at once ask once; a refusal is asked again next time.
  // ONE PLACE FOR A BRANCH (goal/G49.6; Andy: "I WANT THAT FUCKING TRUNK OF THE spirit NAMESPACE FUCKING CLEARED OUT!!!", and of
  // G40.6 beside G43.32/G49.5, "AND WHICH FUCKING RULING DO YOU THINK APPLIES??????": the later, "spirit.requireScript() places the
  // loaded script at the exact same path"): the branch's functions are kept here, never on spirit.<branch>, and its api.js
  // carries them at spirit.required.<its path> (requireOne, below), the one place a caller reaches them.
  var asking = {};
  var bound = {};
  var members = Object.create(null);
  // Where a branch's api.js stands, as a require of it named it; else in node its file on disc, and on a page an app of the
  // page's app list at spirit/app/<name>/api.js, any other at spirit/<name>/api.js.
  var pathOf = Object.create(null);
  // The api.js path a branch was asked by, the one place it stands (goal/G49.6: a branch is asked by its path alone).
  function apiPathOf(fam) { return pathOf[fam]; }
  // The branch's functions onto its api.js object (the module in node, the interface the node handed over on a page), the
  // names it holds already kept as they are; it stands at spirit.required.<its path>, and is what a caller is answered.
  function carried(fam, m) {
    var p = apiPathOf(fam);
    var def = (isNode() && nodeOnce[p]) || interfaceDefs[fam] || null;
    if (!p || !def || typeof def !== 'object') return m;
    // A new object, the api.js's own names and the functions beside them: the module itself stays as its file wrote it, so a
    // plain require of the api.js answers its table alone.
    var api = {};
    Object.keys(def).forEach(function (k) { api[k] = def[k]; });
    Object.keys(m).forEach(function (k) { if (!(k in api)) api[k] = m[k]; });
    standAt(required, p, api);
    return api;
  }
  // The branch's place set to its object, whatever stood there (its module, placed as the require ran), the folder levels kept.
  function standAt(rootObj, p, value) {
    var keys = placeKeys(p);
    var o = rootObj;
    for (var i = 0; i < keys.length - 1; i += 1) {
      if (o[keys[i]] == null || (typeof o[keys[i]] !== 'object' && typeof o[keys[i]] !== 'function')) o[keys[i]] = holder();
      o = o[keys[i]];
    }
    o[keys[keys.length - 1]] = value;
  }
  function bindOwn(fam) {
    if (bound[fam]) return Promise.resolve(members[fam]);
    if (asking[fam]) return asking[fam];
    asking[fam] = bindOn(post, get, fam, true).then(function (m) {
      delete asking[fam];
      members[fam] = carried(fam, m);
      bound[fam] = true;
      return members[fam];
    }, function (e) { delete asking[fam]; throw e; });
    return asking[fam];
  }
  // A PEER'S BRANCH (goal/G33.4, box v38), held under its key. Its calls are packed as the far node's apiDoor takes them
  // ('api', {api: {branch}}, {branch: {verb: args}}) and sent by spirit.peerPost; the apiDoor answers the body alone: ok
  // false is a refusal, 409, or 0 when the post never reached the peer or nothing answered.
  function peerAsk(key, how) {
    return function (verb, args) {
      var n = String(verb || '');
      var body;
      if (n === 'api') body = args && args.branch ? { api: { branch: String(args.branch) } } : 'api';
      else {
        var dot = n.indexOf('.');
        body = {};
        body[n.slice(0, dot)] = {};
        body[n.slice(0, dot)][n.slice(dot + 1)] = args || {};
      }
      return Promise.resolve(self.peerPost(key, 'api', body, how)).then(function (got) {
        var refused = !!got && typeof got === 'object' && got.ok === false;
        var unreached = refused && (got.code === 'not-posted' || got.code === 'no-answer');
        return { status: unreached ? 0 : refused ? 409 : 200, body: got, text: '' };
      });
    };
  }
  function noFile() { return Promise.resolve({ status: 404, type: '', bytes: new Uint8Array(0) }); }
  var peers = {};
  function bindPeer(key, fam, how) {
    var k = String(key);
    var held = (peers[k] = peers[k] || {});
    if (held[fam]) return held[fam];
    held[fam] = bindOn(peerAsk(k, how), noFile, fam).then(null, function (e) { delete held[fam]; throw e; });
    return held[fam];
  }

  // spirit.apiTree() -> the node's api answer as it stands: every branch and verb this caller may call.
  function tree() {
    return post('api', {}).then(function (r) {
      if (r && r.status >= 200 && r.status < 300) return r.body || {};
      throw refusal('refused', 'the node answered ' + (r && r.status), { status: r && r.status });
    });
  }
  // outcome(call) -> Promise<{status, body}>: a call's answer as the status it came with, for code that tells the
  // node's refusals apart by status; 0 when the node did not answer at all.
  function outcome(c) {
    return Promise.resolve(c).then(function (body) { return { status: 200, body: body }; },
      function (e) {
        // A call the check refused never left: the caller's fault, as the node would answer it.
        var local = e && !e.status && ['no-such-argument', 'bad-request', 'no-such-verb'].indexOf(e.code) !== -1;
        return { status: (e && e.status) || (local ? 400 : 0), body: (e && e.body) || (local ? { ok: false, code: e.code, error: e.message } : null) };
      });
  }

  // ── spirit.requireScript(path, key, how) (goal/G40.1, goal/G40.6) ─────────────────────────────────────────────────────────
  // Andy: "the dynamic loading must be in spirit.js, because it belongs there, and so that any component touched later,
  // can load its needed components there."; "the loaders name should be spirit.requireScript()"; the key "a second argument
  // in spirit.requireScript(), by default it's null (owner node) otherwise it's a peer ID". The one async loader, the same on a
  // page and in node. path is from the run root. A branch's api.js, spirit/<name>/api.js (a node branch's) or
  // spirit/app/<name>/api.js (an app's), binds that branch and places it at spirit.required.<its path>, from this VM's node,
  // or with a key as that peer's branch (how, in node, is peerPost's waiting). Any other path is a component: in node
  // required, answering its module.exports; on a page got and run as a plain script (a stylesheet put on as a style),
  // answering an empty object.
  // A BRANCH IS ASKED BY ITS PATH ALONE (goal/G49.6; Andy: "ASKING FOR THE API BY FUCKING NAME MUST BE FUCKING FORBIDDEN",
  // "spirit.branchPath() must die."): no function makes a branch's path from its name; asked by its name, a page placed it at
  // a guessed place, and the app's own elements, asking by its path, found nothing there.
  // The fs branch's node processor, the one place in node that reads the disc for spirit.fs (goal/G49.2).
  function nodeFiles() { return require(require('path').join(RUN_ROOT, 'spirit', 'fs', 'fileSystem', 'script.js')); }
  function interfaceName(p) {
    // An app's branch sits at the top of its folder, spirit/app/<name>/api.js (goal/G43.27).
    var m = /^spirit\/app\/([^/]+)\/api\.js$/.exec(p) || /^spirit\/([^/]+)\/api\.js$/.exec(p);
    return m ? m[1] : '';
  }
  // A COMPONENT IS REQUIRED ONCE, AND ITS TREE WITH IT (goal/G41.3). Andy: "spirit.js require() require implementation
  // MUST, like a node.js require, de-dupe the require, it a script was already loaded", and "lazy-load, is a tree....".
  // A path required twice is fetched and run once, every caller getting the same answer; a script the boot loaded counts
  // as required. What a component requires while it runs is its tree: its own require answers once those have.
  var requiredOnce = Object.create(null);
  var collecting = null;
  function loadedByTag(p) {
    try { return !!(typeof document !== 'undefined' && document.querySelector && document.querySelector('script[src="/' + p + '"]')); } catch (e) { return false; }
  }
  // The page's own tags have all run once it is parsed.
  function parsed() {
    if (typeof document === 'undefined' || document.readyState !== 'loading') return Promise.resolve();
    return new Promise(function (resolve) { document.addEventListener('DOMContentLoaded', function () { resolve(); }, { once: true }); });
  }
  // EVERY SCRIPT REQUIRED STANDS AT spirit.required.<its path> (goal/G43.32). Andy: "spirit.requireScript() both on the node, AND
  // on the browser should simply install every script required, at the following point: spirit.required.<path.of.fucking.
  // script>. - no name collisions - easily checkable if script is already loaded." One key per folder of its run-root path,
  // its name without .js the last: spirit/relayUrl/script.js at spirit.required.spirit.relayUrl. On the node it is the module's
  // exports; on a page, where a script installs itself as it runs, an empty object marks it loaded.
  var required = Object.create(null);
  self.required = required;
  // A folder's place made before its file is required holds only what was placed under it; the file's answer takes the
  // place and keeps those (no name collision: x.js and x/y.js both stand, whichever comes first).
  var holders = typeof WeakSet === 'function' ? new WeakSet() : null;
  function isHolder(o) { return !!(holders && o && typeof o === 'object' && holders.has(o)); }
  function holder() { var h = {}; if (holders) holders.add(h); return h; }
  // Its first levels made here, so a reader asking spirit.required.spirit.element.<x> before any helper ran reads undefined
  // instead of throwing (goal/G43.32). Holders, as any folder's place: spirit/app/script.js takes spirit.required.spirit.app
  // and keeps the spirit/app/ scripts placed under it.
  required.spirit = holder();
  required.spirit.element = holder();
  required.spirit.app = holder();
  // THE ELEMENTS STAND HERE TOO (goal/G49.5; Andy, of his G43.32 Q5: "that ruling is reversed, since the element factory is
  // fine where it is loaded"): an element's factory is at spirit.required.<its path>, put there by
  // spirit/element/installSpiritElement/script.js as the script runs; there is no spirit.element.
  // A PATH'S PLACE, ITS KEYS (goal/G49.9, box v5; Andy: "every single script into it's own named folder, is exactly so that
  // anything exposed by the script has a private (own) contained inside of the spirit object"): one key per folder, the
  // file's name without .js the last, and a folder's script.js at its folder's own name: spirit/element/busyButton/script.js
  // at spirit.required.spirit.element.busyButton, the folder's other scripts under it.
  function placeKeys(p) {
    var keys = String(p).replace(/^\/+/, '').replace(/\.js$/, '').split('/').filter(Boolean);
    if (keys.length > 1 && keys[keys.length - 1] === 'script') keys.pop();
    return keys;
  }
  function placeAt(rootObj, p, value) {
    var keys = placeKeys(p);
    var o = rootObj;
    for (var i = 0; i < keys.length - 1; i += 1) {
      var k = keys[i];
      if (o[k] == null || (typeof o[k] !== 'object' && typeof o[k] !== 'function')) o[k] = holder();
      o = o[k];
    }
    var last = keys[keys.length - 1];
    var was = o[last];
    if (was === value) return value;
    if (was === undefined || isHolder(was)) {
      if (isHolder(was) && value && (typeof value === 'object' || typeof value === 'function')) {
        Object.keys(was).forEach(function (k) { if (!(k in value)) value[k] = was[k]; });
      }
      o[last] = value;
    }
    return o[last];
  }
  // ON A PAGE, WHAT A SCRIPT PLACED FOR ITSELF IS ITS ANSWER (goal/G43.32; Andy, goal/G49.4: "have i NOT fucking specified, that
  // on both, browser and node, spirit.requireScript() places the loaded script at the exact same motherfucking location/path in the
  // spirit object??????", "FUCKING FIX THAT!!"): a page script has no module box, so it stands at spirit.required.<its path>
  // by placing itself there as it runs (spirit/data/script.js does); the loader answers that object, as in node it answers the
  // module's exports. A script that placed nothing gets an empty object there, which says it is loaded.
  function keptAt(p) {
    var keys = placeKeys(p);
    var o = required;
    for (var i = 0; i < keys.length && o; i += 1) o = o[keys[i]];
    if (o && (typeof o === 'object' || typeof o === 'function') && !isHolder(o)) return o;
    return placeAt(required, p, {});
  }
  // THE NODE'S MODULES, KEPT AT ONCE (Andy: "box that spirit.require() on the node is just a path-translating wrapper."):
  // a script's module.exports, the same one every time, no promise. An interface is still bound by asking a node.
  var nodeOnce = Object.create(null);
  // A BRANCH OF THE NEW SHAPE IS NAMED BY ITS PATH (goal/G49.15; Andy: "THE NAME ON THE MOTHERCUKING WIRE IS \"spirit.fs\"",
  // "BRANCHES ARE NAMED BY THEIR FUCKING PATH AND BY NOTHING ELSE"): spirit/fs/script.js is the branch spirit.fs, its folder's
  // path in dots, and a call to it is spirit.fs.<verb>. Which script.js is a branch's is said by what it hands out: an object
  // holding verbs. On the node that is known before it is bound; on a page, once the file has run.
  function branchNameOf(p) {
    var m = /^spirit\/(.+)\/script\.js$/.exec(p);
    return m ? 'spirit.' + m[1].split('/').join('.') : '';
  }
  function isInterface(v) { return !!v && typeof v === 'object' && !!v.verbs && typeof v.verbs === 'object'; }
  function nodeBranchName(p) {
    var name = branchNameOf(p);
    if (!name || !isNode() || !nodeFiles().statFile(p)) return '';
    if (!Object.prototype.hasOwnProperty.call(nodeOnce, p)) {
      var mod = require(require('path').join(RUN_ROOT, p));
      if (!placeable(mod)) return '';
      nodeOnce[p] = mod;
      placeAt(required, p, mod);
    }
    return isInterface(nodeOnce[p]) ? name : '';
  }
  function requireOne(path, key, how) {
    var p = String(path || '').replace(/^\/+/, '');
    var fam = interfaceName(p) || nodeBranchName(p);
    // A BRANCH'S api.js STANDS AT spirit.required.spirit.<branch-path>.api (goal/G43.32; Andy: "i agree: thing
    // spirit.required.spirit.<branch-path>.api is where it should land"): on the node it is the file as it is, loaded and
    // placed at once, before the branch is bound, so an app server checks its calls by it without asking a node.
    if (fam && isNode() && !Object.prototype.hasOwnProperty.call(nodeOnce, p)) {
      var apiFile = require('path').join(RUN_ROOT, p);
      if (nodeFiles().statFile(p)) { nodeOnce[p] = require(apiFile); placeAt(required, p, nodeOnce[p]); }
    }
    if (fam && key) { pathOf[fam] = pathOf[fam] || p; return bindPeer(key, fam, how); }
    // On a page the api.js the node handed over stands at its place once its branch is bound.
    // Asked while a file runs, it is part of that file's tree, its companion data.js with it (goal/G47.1, Andy's rule: "every
    // api.js requires it's companion data.js"): the file's require answers once the branch is bound; a branch that cannot be
    // bound fails no tree.
    if (fam) {
      pathOf[fam] = pathOf[fam] || p;
      // ASKED BY ITS PATH, IT STANDS AT ITS PATH (goal/G49.6; Andy: "the fucking api should ALWAYS be at the same place"),
      // whatever bound it first.
      var bindsTo = bindOwn(fam).then(function (m) { if (m && required !== m) standAt(required, p, m); return m; });
      if (collecting) collecting.push(bindsTo.then(null, function () {}));
      return bindsTo;
    }
    if (isNode()) {
      if (Object.prototype.hasOwnProperty.call(nodeOnce, p)) return nodeOnce[p];
      var file = require('path').join(RUN_ROOT, p);
      // A script that is not there refuses not-found, as it always has (spirit.js's own test); one that is answers at once.
      if (!require('fs').existsSync(file)) return Promise.reject(refusal('not-found', p + ' is not there'));
      var mod = require(file);
      // A SCRIPT ANSWERS AN OBJECT OR A FUNCTION, OR FAILS (goal/G49.9; Andy: "of course spirit.requireScript must allways
      // return either an object or a function... or fail/throw."), so its folder's other scripts can stand under it.
      if (!placeable(mod)) return Promise.reject(refusal('not-placeable', p + ' exposes ' + typeof mod + ': a script exposes an object'));
      nodeOnce[p] = mod;
      placeAt(required, p, mod);
      return mod;
    }
    if (requiredOnce[p]) { if (collecting) collecting.push(requiredOnce[p]); return requiredOnce[p]; }
    // A script the page loaded by its own tag (the home shell's index.html) has run: it counts as required.
    if (loadedByTag(p)) { requiredOnce[p] = Promise.resolve(keptAt(p)); if (collecting) collecting.push(requiredOnce[p]); return requiredOnce[p]; }
    var answer = get(p).then(function (r) {
      if (!r || r.status !== 200) throw refusal('not-found', p + ' answered ' + (r && r.status));
      var outer = collecting;
      var tree = collecting = [];
      // ON A PAGE A FILE RUNS AS A PLAIN SCRIPT (goal/G41.7; Andy: "script IS what codeMirror Is, use the require
      // interfaces that exists in spirit.js or boot.js, NOTHING HAND-ROLLED"): every shell element puts itself into
      // window.spirit as it runs, so none is handed a module box, and a file written for both node and a page
      // (CodeMirror's) takes its page branch. A stylesheet goes on the page as a style.
      // SPIRIT'S OWN SCRIPTS GET A MODULE BOX ON A PAGE TOO (goal/G49.9, box v5; Andy: "can spirit.js opaquely hide
      // installSpiritElement behind spirit.requireScript when isBrowser?"): a script sets module.exports as it runs, the same
      // line as in node, and the loader places it at the script's place and answers with it. A vendored script gets no box,
      // so a file written for both (CodeMirror's) still takes its page branch (G41.7).
      var box = null;
      try { box = injectBoxed(p, text(r.bytes)); } finally { collecting = outer; }
      if (box && box.set) {
        if (!placeable(box.exports)) throw refusal('not-placeable', p + ' exposes ' + typeof box.exports + ': a script exposes an object');
        placeAt(required, p, box.exports);
      }
      // A NEW-SHAPE BRANCH'S script.js (goal/G49.15), once it has run: bound by its path's name, as an api.js is.
      var named = box && box.set && isInterface(box.exports) ? branchNameOf(p) : '';
      if (named) {
        pathOf[named] = pathOf[named] || p;
        return Promise.all(tree).then(function () {
          if (key) return bindPeer(key, named, how);
          return bindOwn(named).then(function (m) { if (m && required !== m) standAt(required, p, m); return m; });
        });
      }
      return Promise.all(tree).then(function () { return keptAt(p); });
    });
    requiredOnce[p] = answer;
    // A refused require is not kept: it may be asked again.
    answer.then(null, function () { if (requiredOnce[p] === answer) delete requiredOnce[p]; });
    if (collecting) collecting.push(answer);
    return answer;
  }

  // THE MIME TYPES (goal/G40.1), the spirit object's own table. Andy: "MIME types can easily be added to spirit.js", and
  // "kernel can keep its MIME table, that will go when kernel goes."
  var MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.py': 'text/x-python'
  };

  // THE VERSION, THE NODE'S DEFAULT PORT AND THE DEBUG SWITCH (goal/G40.6). Andy: "the version string goes into
  // spirit.js, same for the MIME table, same for the DEBUG switch, same for the nodes default port, all go to spirit.js."
  var VERSION = '0.0.1';
  var DEFAULT_SPIRIT_PORT = 65432;
  // DEBUG (desk/G2.5): one switch per process, off at start. Andy: "DEBUG is Off by default, returned and set by owner-only
  // api". Since goal/G43.15 the node keeps an app's across restarts (Q2: "i think we should persist it, always."), and hands it
  // back as --debug (appServer.js).
  var DEBUG = false;
  function debug(on) { if (typeof on === 'boolean') DEBUG = on; return DEBUG; }

  // ── THE ONE INSTANCE, IN NODE AND ON A PAGE ───────────────────────────────────────────────────────────────────────
  // Andy: "all this module exports is the one and only instance of the spirit object", "on a browser the spirit object
  // gets placed on the window object on nodes js the spirit object is the only export of this file."
  self.isNode = isNode;
  self.isBrowser = isBrowser;
  self.isLoopback = isLoopback;
  self.logError = error;
  self.formatBytes = formatBytes;
  self.escapeHtml = escapeHtml;
  self.normalizeString = normalizeString;
  self.normalizeParagraph = normalizeParagraph;
  self.checkArgs = check;
  self.ruleNames = Object.keys(RULES);
  self.callOutcome = outcome;
  self.apiTree = tree;
  self.requireScript = requireOne;

  self.MIME_TYPES = MIME_TYPES;
  self.VERSION = VERSION;
  self.DEFAULT_SPIRIT_PORT = DEFAULT_SPIRIT_PORT;
  self.debugLog = debug;

  // ── THE ONE STREAM OF THIS VM: spirit.eventStream.subscribe(handlers) (goal/G40.6) ──────────────────────────────────────
  // Andy: "two verbs on events - publish - subscribe". The node's events branch is its one dispatcher; this is its
  // subscribe, moved here from the old kernel's page stream. ONE STREAM PER PAGE (goal/G30.16; Andy: "the home page should
  // need one stream only."): every subscriber shares it, and one that comes later is handed the jobs as they stand and
  // told the stream is up. It comes back by itself (Andy, 2026-09-30: "this should work without a hickup."): an end or an
  // error is said (onConnection false), it opens again, and the first open after being down is said (onReconnect).
  // handlers: onSnapshot(jobs), onUpdate(job), onDelete(id), onPacket(message), onRelayEvent(row), onContactRename(row),
  // onConnection(up), onReconnect(). On a face the events come down the face's own link (window.spirit.transport.events),
  // which reads its stream through readStream below, as this one does.
  // Answers the unsubscribe; the stream closes when nobody is left.
  var streamSubs = [];
  var streamHandle = null;
  var streamUp = false;
  var streamWaiting = false;
  var streamJobs = new Map();
  function tellStream(name, arg) {
    streamSubs.slice().forEach(function (h) {
      if (typeof h[name] === 'function') { try { h[name](arg); } catch (e) { /* one subscriber's fault */ } }
    });
  }

  // ── ONE READER FOR EVERY STREAM A PAGE HAS: readStream(o) (goal/G47.1, the box, "Reload Problems with the face") ──────
  // The box: "5 seconds without a spirit event, the stream resets", "one place only manages the stream, the right one
  // before the preferred one: spirit.js", and spirit/shell/boot/script.js "keeps no stream loop of its own and opens the face's
  // stream through spirit.js, handing only the face's address and its line format". So the node's own stream (below) and a
  // face's (boot.js) are both read here, and nowhere else: open, read, the silence rule, the cancel, the open again.
  //   o.open(signal)  -> a fetch's promise, the stream's response; the signal cancels it
  //   o.url()         or the stream's address, asked at each open, fetched here (a face's: boot.js hands only that)
  //   o.lines         true: the units are lines (a face's); else server-sent events, a unit each block ending in a blank line
  //   o.unit(text)    each unit in order; one answering a promise is waited for before the next (a face's sealed lines)
  //   o.onUp(again)   the response stands; again is true when a stream stood before it
  //   o.onDown()      the stream is gone, said once until it stands again
  //   o.retryMs       the wait before opening again after an end or an error (2 s by default)
  //   o.any           read the body whatever the status (a face's stream says its refusal in it)
  // Answers { stop(), again(ms) }: stop ends it for good, again(ms) drops the stream now and opens one after ms.
  // THE SILENCE RULE (the box): every byte that comes in, a beat as well, stamps the time; a check each second, and after
  // SILENT_MS of nothing the stream is cancelled first, so the dead one holds no connection, said down, and opened again at
  // once. A unit that throws is that unit's fault: the reading goes on (a throw inside the read once ended it silently,
  // the stream open and nothing read, nothing asked again).
  var SILENT_MS = 5000;
  function readStream(o) {
    var stopped = false;
    var now = null;   // the attempt standing: { ctrl, reader }
    var last = 0;
    var up = false;
    var stood = false;
    var told = false;
    var retry = null;
    // The timers of the world it runs in (a page, a process, a suite's bare window, which may have none: then no check).
    var every = typeof root.setInterval === 'function' ? root.setInterval.bind(root) : (typeof setInterval === 'function' ? setInterval : null);
    var check = every ? every(function () { if (!stopped && now && Date.now() - last >= SILENT_MS) end(now, 0); }, 1000) : null;
    if (check && typeof check.unref === 'function') check.unref();
    function say(name, arg) { if (typeof o[name] === 'function') { try { o[name](arg); } catch (e) { /* the caller's fault */ } } }
    function end(t, wait) {
      if (t !== now) return;
      now = null;
      try { if (t.ctrl) t.ctrl.abort(); } catch (e) { /* gone */ }
      if (t.reader) { try { t.reader.cancel().catch(function () { /* gone */ }); } catch (e) { /* gone */ } }
      if (up || !told) { told = true; say('onDown'); }
      up = false;
      if (stopped) return;
      retry = setTimeout(function () { retry = null; open(); }, wait == null ? (o.retryMs || 2000) : wait);
    }
    function units(t) {
      var sep = o.lines ? '\n' : '\n\n';
      var dec = new TextDecoder();
      var buf = '';
      var chain = Promise.resolve();
      function hand(u) {
        if (!o.lines) { try { o.unit(u); } catch (e) { /* that unit's fault */ } return; }
        chain = chain.then(function () { return o.unit(u); }).then(null, function () { /* that unit's fault */ });
      }
      return new Promise(function (resolve, reject) {
        function pump() {
          t.reader.read().then(function (chunk) {
            if (t !== now) { resolve(); return; }
            if (chunk.done) { chain.then(resolve); return; }
            last = Date.now();
            buf += dec.decode(chunk.value, { stream: true });
            var i;
            while ((i = buf.indexOf(sep)) !== -1) {
              var u = buf.slice(0, i);
              buf = buf.slice(i + sep.length);
              if (u) hand(u);
            }
            pump();
          }).then(null, reject);
        }
        pump();
      });
    }
    function open() {
      if (stopped || now) return;
      var t = now = { ctrl: typeof AbortController === 'function' ? new AbortController() : null, reader: null };
      last = Date.now();
      var signal = t.ctrl ? t.ctrl.signal : undefined;
      Promise.resolve().then(function () {
        return typeof o.url === 'function' ? fetch(o.url(), { credentials: 'same-origin', signal: signal }) : o.open(signal);
      }).then(function (r) {
        if (t !== now) { try { if (r && r.body) r.body.cancel(); } catch (e) { /* gone */ } return; }
        // o.any: the body is read whatever the status, for a stream that says its refusal in it (a face's: the relay's
        // refused line).
        if (!r || !r.body || (!r.ok && !o.any)) throw refusal('no-stream', 'the stream was answered ' + (r && r.status));
        t.reader = r.body.getReader();
        last = Date.now();
        up = true;
        told = false;
        say('onUp', stood);
        stood = true;
        return units(t);
      }).then(function () { end(t); }, function () { end(t); });
    }
    open();
    return {
      stop: function () {
        stopped = true;
        if (check) { if (typeof root.clearInterval === 'function') root.clearInterval(check); else clearInterval(check); }
        if (retry) { clearTimeout(retry); retry = null; }
        var t = now;
        now = null;
        if (t) { try { if (t.ctrl) t.ctrl.abort(); } catch (e) { /* gone */ } if (t.reader) { try { t.reader.cancel().catch(function () { /* gone */ }); } catch (e) { /* gone */ } } }
      },
      again: function (ms) { if (stopped) return; if (now) end(now, ms); else if (!retry) retry = setTimeout(function () { retry = null; open(); }, ms || 0); },
    };
  }
  self.readStream = readStream;
  function onStreamEvent(kind, data) {
    if (kind === 'snapshot') {
      var jobs = (data && data.jobs) || [];
      streamJobs.clear();
      jobs.forEach(function (j) { if (j && j.id) streamJobs.set(j.id, j); });
      tellStream('onSnapshot', jobs);
    } else if (kind === 'job-updated') {
      if (data && data.id) streamJobs.set(data.id, data);
      tellStream('onUpdate', data);
    } else if (kind === 'job-deleted') {
      streamJobs.delete(data);
      tellStream('onDelete', data);
    } else if (kind === 'packet') tellStream('onPacket', data);
    else if (kind === 'relay-event') tellStream('onRelayEvent', data);
    else if (kind === 'contact.rename') tellStream('onContactRename', data);
  }
  // The node's own stream, through the one reader: its events are server-sent, a block each.
  function openStream() {
    // A PROCESS IS NOT A PAGE (goal/G43.3, as peerPost says it below; goal/G16.9): it witnesses the packets and takes none, or
    // it would eat the waiting lines of its node's owner.
    var headers = isNode() ? { 'X-Spirit-Reader': 'server' } : {};
    streamHandle = readStream({
      open: function (signal) { return post('event.subscribe', {}, { stream: true, headers: headers, signal: signal }); },
      unit: function (block) {
        var ev = /(?:^|\n)event: (.*)/.exec(block);
        var da = /(?:^|\n)data: (.*)/.exec(block);
        if (!ev || !da) return;
        var data;
        try { data = JSON.parse(da[1]); } catch (e) { return; }
        onStreamEvent(ev[1], data);
      },
      onUp: function (again) { streamUp = true; tellStream('onConnection', true); if (again) tellStream('onReconnect'); },
      onDown: function () { streamUp = false; tellStream('onConnection', false); },
    });
  }
  function subscribeEvents(handlers) {
    var h = handlers || {};
    var l = link();
    if (l && typeof l.events === 'function') return l.events(h);
    streamSubs.push(h);
    // OPENED ONCE THE PAGE HAS PARSED: every subscriber its scripts make (the shell, the page's mirror) is then in
    // place before the first event, so none of them misses the file tree a connecting page is handed.
    var doc = root.document;
    if (!streamHandle && !streamWaiting) {
      if (doc && doc.readyState === 'loading') {
        streamWaiting = true;
        doc.addEventListener('DOMContentLoaded', function () { streamWaiting = false; if (streamSubs.length && !streamHandle) openStream(); });
      } else openStream();
    } else if (streamHandle && streamUp) {
      if (h.onSnapshot) { try { h.onSnapshot(Array.from(streamJobs.values())); } catch (e) { /* one subscriber's fault */ } }
      if (h.onConnection) { try { h.onConnection(true); } catch (e) { /* one subscriber's fault */ } }
    }
    return function unsubscribe() {
      streamSubs = streamSubs.filter(function (x) { return x !== h; });
      if (!streamSubs.length && streamHandle) { var s = streamHandle; streamHandle = null; streamUp = false; s.stop(); }
    };
  }
  self.eventStream = { subscribe: subscribeEvents };

  // IN NODE, spirit.js's OWN, AND NO KERNEL (goal/G40.6). Andy: "WHY THE FUCK WOULD we pass spirit.js if not for the
  // fucking servers to use it?", and "Fix that SHIT. in this item, here. NOW." What a server process took from the old kernel
  // through spirit.core is spirit.js's own now, on its one post: the node's facts, this process's job, peerPost.
  if (isNode()) {
    // THE NODE'S FACTS (goal/G19.10; Andy: "they should have that stuff passed with the spirit object"): its port, and what
    // the node hands every server it starts as --node {name, publicKey, ownerKey}, all public; '' when not given.
    var facts = {};
    try { var at = process.argv.indexOf('--node'); facts = at !== -1 ? (JSON.parse(String(process.argv[at + 1] || '')) || {}) : {}; } catch (e) { facts = {}; }
    var str = function (v) { return typeof v === 'string' ? v : ''; };
    self.nodeFacts = { port: PORT, name: str(facts.name), key: str(facts.publicKey), ownerKey: str(facts.ownerKey) };

    // THIS PROCESS'S JOB (goal/G29.15), REPORTED BY THE ONE PATH TO PUBLISH (goal/G40.6; Andy, 2026-10-25: "ONE path for
    // everybody to publish events"): a process the node started as a job publishes on it by event.publish with its own id
    // (SPIRIT_JOB_ID), one post; the node changes the job and every subscriber hears it.
    //   spirit.eventStream.publish(obj)   the object as the job's app, every page hears it; over PAYLOAD_MAX it is not sent,
    //                  and the pages hear that one was dropped, with its size (fileTransfer goal/G1.4)
    //   spirit.processJob.start(name), progress(done, total, text), end(result)   one job at a time: a start while one is open
    //                  refuses job-open; each resolves once the node has it, so awaited calls arrive in order
    //   spirit.processJob.report(patch), log(text), complete(data), fail(error)   the job's own state, and its three common forms
    var JOB = String(process.env.SPIRIT_JOB_ID || '');
    var PAYLOAD_MAX = require('./limits/script.js').PAYLOAD_MAX;
    var openJob = null;
    var jobs = self.processJob = self.processJob && typeof self.processJob === 'object' ? self.processJob : {};
    var bytesOf = function (o) { try { return new TextEncoder().encode(JSON.stringify(o)).length; } catch (e) { return -1; } };
    jobs.report = function (patch) {
      if (!JOB) return Promise.reject(refusal('no-job', 'this process was not started by a node as a job (SPIRIT_JOB_ID is unset)'));
      return post('event.publish', Object.assign({ id: JOB }, patch)).then(function (r) { return r && r.body; });
    };
    jobs.log = function (message) { return jobs.report({ logMessage: message }); };
    jobs.complete = function (data) { return jobs.report({ status: 'completed', data: data }); };
    jobs.fail = function (e) { return jobs.report({ status: 'failed', data: { error: String(e) } }); };
    self.eventStream.publish = function (obj) {
      if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return false;
      var size = bytesOf(obj);
      if (size < 0) return false;
      var send = function (o) { Promise.resolve(jobs.report({ app: o })).catch(function () { /* not started by a node */ }); };
      if (size > PAYLOAD_MAX) {
        process.stderr.write('publish-too-large: ' + size + ' bytes, the limit is ' + PAYLOAD_MAX + '\n');
        send({ dropped: { bytes: size, max: PAYLOAD_MAX } });
        return false;
      }
      send(obj);
      return true;
    };
    jobs.cycle = function (job) {
      var one = { job: job };
      var size = bytesOf(one);
      if (size < 0) return Promise.resolve(false);
      if (size > PAYLOAD_MAX) return Promise.resolve(self.eventStream.publish(one));
      return jobs.report({ app: one }).then(function () { return true; }, function () { return false; });
    };
    jobs.start = function (name) {
      if (openJob !== null) return Promise.reject(refusal('job-open', 'a job is open: ' + openJob + '; end it before starting ' + String(name || '')));
      openJob = String(name || '');
      return jobs.cycle({ state: 'start', name: openJob });
    };
    jobs.progress = function (done, total, text) {
      return jobs.cycle({ state: 'progress', name: openJob === null ? '' : openJob, done: Number(done) || 0, total: Number(total) || 0, text: String(text || '') });
    };
    jobs.end = function (result) {
      var one = { state: 'end', name: openJob === null ? '' : openJob };
      openJob = null;
      if (result instanceof Error) one.logError = String(result.message || result);
      else if (result !== undefined) one.result = result;
      return jobs.cycle(one);
    };

    // ASK A PEER AND AWAIT THE ANSWER (fileTransfer goal/G1.3), as it has always worked (Andy: "peer post will work the way
    // they ALWAY WORKED"), moved here from the old kernel unchanged in what it does: the node's events subscribed as a server
    // (it is handed no backlog and marks nothing taken), then one post of peer.post, then the answer-post whose re
    // matches that post's hash. The stream opens BEFORE the post, so an answer quicker than the post's own reply is kept.
    // how: waitMs (30 s by default), patienceMs, kind. Resolves the answer's body; {ok: false, code: 'not-posted'} for a
    // post the node refused, {ok: false, code: 'no-answer'} after waitMs of silence. It never rejects.
    // By its run-root path, as this file loads every other part (goal/G43.18: it sits in spirit/ now, beside client/).
    // Loaded at its first use, not while this file loads (goal/G43.32): packet.js takes the spirit object first, so a
    // require of it from here, mid-load, would hand it this file half made.
    var packet = null;
    self.peerPost = function (peer, app, body, how) {
      var o = how && typeof how === 'object' ? how : {};
      var waitMs = Number(o.waitMs) > 0 ? Number(o.waitMs) : 30000;
      if (!PORT) return Promise.resolve({ ok: false, code: 'not-posted', error: 'no node: spirit/state/environment.json names no port' });
      if (!packet) packet = requireOne('spirit/client/packet.js');
      var made = packet.encode(app, body);
      if (!made || !made.ok) return Promise.resolve({ ok: false, code: 'not-posted', error: (made && made.error) || 'the ask could not be encoded' });
      return post('event.subscribe', {}, { stream: true, headers: { 'X-Spirit-Reader': 'server' } }).then(function (r) {
        var reader = r.body.getReader();
        var dec = new TextDecoder();
        var buf = '';
        var want = '';
        var early = [];
        return new Promise(function (resolve) {
          var timer = setTimeout(function () { finish({ ok: false, code: 'no-answer', error: 'no answer within ' + waitMs + ' ms' }); }, waitMs);
          function finish(v) {
            clearTimeout(timer);
            reader.cancel().catch(function () { /* stream gone */ });
            resolve(v);
          }
          function take(msg) {
            if (msg.from !== peer) return;
            var got = null;
            try { got = packet.decode(msg.text); } catch (e) { return; }
            if (!got || !got.re) return;
            if (!want) { early.push(got); return; }
            if (got.re === want) finish(got.body);
          }
          function pump() {
            reader.read().then(function (chunk) {
              if (chunk.done) { finish({ ok: false, code: 'no-answer', error: 'the node closed its stream before the answer came' }); return; }
              buf += dec.decode(chunk.value, { stream: true });
              var i;
              while ((i = buf.indexOf('\n\n')) !== -1) {
                var block = buf.slice(0, i); buf = buf.slice(i + 2);
                var ev = /event: (.*)/.exec(block); var da = /data: (.*)/.exec(block);
                if (!ev || ev[1] !== 'packet' || !da) continue;
                var msg; try { msg = JSON.parse(da[1]); } catch (e) { continue; }
                take(msg);
              }
              pump();
            }, function (e) { finish({ ok: false, code: 'no-answer', error: 'the node stream: ' + ((e && e.message) || e) }); });
          }
          pump();
          var args = { to: peer, text: made.text };
          if (o.kind) args.kind = o.kind;
          // PATIENCE RIDES TOO (goal/G2.6): the node holds a busy post and retries it with backoff for this long.
          if (Number(o.patienceMs) > 0) args.patienceMs = Number(o.patienceMs);
          post('peer.post', args).then(function (res) {
            var b = res.body;
            if (res.status !== 200 || !b || b.ok !== true || !b.hash) { finish({ ok: false, code: 'not-posted', error: (b && b.error) || ('the node answered ' + res.status) }); return; }
            want = b.hash;
            var hit = early.filter(function (g) { return g.re === want; })[0];
            if (hit) finish(hit.body);
          }, function (e) { finish({ ok: false, code: 'not-posted', error: (e && e.message) || String(e) }); });
        });
      }, function (e) {
        return { ok: false, code: 'not-posted', error: 'the node stream could not open: ' + ((e && e.message) || e) };
      });
    };
    // THE CACHE COMES WITH THE CLIENT (goal/G41.3, Q2), in a process as on a page: spirit.required.spirit.data, filled by each type's
    // translator, which its type loads; a process follows a stream only through appServer's listener.
    // Through the one loader, as every component is; in a process its require runs at once, so spirit.required.spirit.data is there now.
    module.exports = self;
    requireOne('spirit/data/script.js');
    return;
  }

  // ON A PAGE: spirit.peerPost is the home node's peer.post, the body in its packet envelope (spirit/client/packet.js),
  // as the node's own peerPost sends it (goal/G43.24: it sent {app, body} unwrapped, so elements wrapped it themselves).
  // It resolves what a process's peerPost resolves, the answer's body decoded, {ok: false, code, error} for a post that did
  // not get through; never rejects. how.answer true resolves the node's whole answer read as a page needs it instead,
  // { ok, status, body, card, from, error }: card is the node's VERIFIED card of the peer (spirit/peer/post/script.js, answer.card), ok
  // only when it reached and the peer did not refuse. A page hears no answer-post: the node's own peerPost waits on the
  // node's server stream, which a page does not hold, so peer.post's reply is the answer.
  // spirit.startPage() runs once the page can reach its node (the face shell after its link is up; index.html at load). It asks
  // no api (goal/G43.27, Q1): spirit.readyPromise answers the instance, on which any branch named stands, bound when first called.
  self.peerPost = function (peer, app, body, how) {
    var whole = !!(how && how.answer === true);
    // What it needs, it requires itself: packet.js on a page wants the limits before it (spirit/limits/script.js).
    return Promise.resolve(requireOne('spirit/limits/script.js')).then(function () { return requireOne('spirit/client/packet.js'); }).then(function () {
      var made = self.required.spirit.client.packet.encode(app, body);
      if (!made || !made.ok) return whole ? { ok: false, body: null, card: null, from: '', error: (made && made.error) || 'the ask could not be encoded' }
        : { ok: false, code: 'not-posted', error: (made && made.error) || 'the ask could not be encoded' };
      return post('peer.post', { to: String(peer), text: made.text }).then(function (r) {
        var said = (r && r.body) || {};
        var text = typeof said.text === 'string' ? said.text : '';
        var decoded = text ? self.required.spirit.client.packet.decode(text) : null;
        var got = decoded ? decoded.body : null;
        if (whole) {
          var yes = !got || got.ok === undefined || !!got.ok;
          return { ok: r.status === 200 && !!said.ok && yes, status: r.status, body: got, card: said.card || null, from: said.from || '', error: said.error || '' };
        }
        if (r.status !== 200 || !said.ok) return { ok: false, code: 'not-posted', error: said.error || ('peer.post answered ' + r.status) };
        return got;
      });
    }, function (e) {
      return whole ? { ok: false, body: null, card: null, from: '', error: String((e && e.message) || e) } : { ok: false, code: 'not-posted', error: String((e && e.message) || e) };
    });
  };
  var started = null;
  // WHAT spirit.readyPromise ANSWERS: the one instance, as it is (goal/G49.6; Andy: "ASKING FOR THE API BY FUCKING NAME MUST BE
  // FUCKING FORBIDDEN", "all, finish it!"): it hands out no branch by a name; a branch is required by its api.js path.
  // ON A PAGE, ready IS THERE FROM THE START: an element that runs before start() (one required as face.html loads) waits on
  // it, and it answers once start() has. In node there is no start, and no ready.
  var readyNow = null;
  if (isBrowser()) self.readyPromise = new Promise(function (resolve) { readyNow = resolve; });
  self.startPage = function () {
    if (started) return started;
    // NO API CALL AT LOAD (goal/G43.27, Q1, above; before it, "lazy-load, is a tree....", G41.3, and "AGAIN, when i say
    // lazy-load you found a way to fuck it up"): the node's api is never asked whole. A branch binds the first time
    // its api.js is required by its path, as a file loads the first time it is required: one api call, for that branch only.
    started = Promise.resolve().then(function () {
      // THE CACHE COMES WITH THE CLIENT (goal/G41.3, Q2): every streamed dataset is kept, each branch through its own
      // data.js (goal/G41.28). Asked once the page is parsed, so a page that loads it by tag keeps the one
      // cache it made.
      // No element comes with it (goal/G41.19; Andy: no preloading elements): the files row element is loaded by
      // whoever draws with the file tree, the face's boot for its home among them.
      return parsed().then(function () { return requireOne('spirit/data/script.js'); });
    }).then(function () {
      // THE PAGE KNOWS ITS NODE (goal/G41.28; Andy, Q10: "Shall spirit.js ask node.card once as a page loads and keep the
      // key as spirit.nodeFacts.key, so a page files its own node's rows under it?" "yes."): asked once, kept on spirit.nodeFacts as a
      // process has it, and handed to the data set, which files the page's stream under it from then on.
      return Promise.resolve(requireOne('spirit/node/api.js')).then(function (n) { return n.card(); }).then(function (c) {
        var key = c && typeof c.publicKey === 'string' ? c.publicKey : '';
        if (!key) return;
        (self.nodeFacts = self.nodeFacts && typeof self.nodeFacts === 'object' ? self.nodeFacts : {}).key = key;
        if (self.required.spirit.data && typeof self.required.spirit.data.homeNode === 'function') self.required.spirit.data.homeNode(key);
      }, function () { /* the page files nothing until its node is known */ });
    }).then(function () { return self; });
    if (readyNow) readyNow(started);
    self.readyPromise = started;
    return started;
  };

  // ── THE RELAY LOGIN, spirit.faceLogin (goal/G43.18, box v29, "The relay login") ───────────────────────────────────────
  // Andy: "the login app should belong to the relay only, and not really be an "app"", and "spirit.login": no app, no shell.
  // The relay's own three calls on /face/api, { call, args } as every call (goal/G41.15), each answering the relay's body:
  //   state() -> { ok, face, loggedIn }   login(text) -> { ok, loggedIn }   logout() -> { ok, loggedIn: false }
  // text is the member's verified email, or the token the relay mailed to it (goal/G41.29: no link in the mail).
  function relayCall(verb, args) {
    return fetch('/face/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ call: String(verb), args: args || {} }) })
      .then(function (r) {
        if (!r.ok) throw refusal('relay-refused', '/face/api ' + verb + ' answered ' + r.status, { status: r.status });
        return r.json();
      });
  }
  if (isBrowser()) {
    self.faceLogin = {
      state: function () { return relayCall('state'); },
      login: function (text) { return relayCall('login', { text: String(text == null ? '' : text) }); },
      logout: function () { return relayCall('logout'); },
    };
  }

  // ── THE LINK HOME, spirit.faceLink (goal/G43.18, Q22, Andy: "ok." to "the link home moves into spirit.js, and boot.js keeps
  // only the stream and loading the shell") ─────────────────────────────────────────────────────────────────────────
  // On a face, once logged in: the home node's keys (faceHome answers { keys: 1 }), one key of this page's own, kept in
  // memory and lost with the session (goal/G30.11), and every request to the home node through the relay's /face/call,
  // sealed when this browser can seal (shell/seal.js, the node's own seal in WebCrypto). It is spirit.transport's ask and
  // file, so every call of the spirit object goes through it; boot.js reads its key for the face stream.
  //   spirit.faceLink: { sealed, key, node, ask(verb, args), file(path, onPiece), call(request), onDown(fn) }
  // Moved from boot.js as it was (goal/G30.11, G30.16, G33.1, G33.10).
  var faceLink = { sealed: false, key: null, node: null, downs: [] };
  function linkText(bytes) { return new TextDecoder().decode(bytes); }
  function linkLines(t) { return String(t || '').split('\n').filter(Boolean); }
  function randomId() {
    var idBytes = new Uint8Array(12);
    root.crypto.getRandomValues(idBytes);
    return Array.prototype.map.call(idBytes, function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join('');
  }
  // A REQUEST TOO LARGE FOR ONE TRIP GOES IN PIECES (goal/G33.1): the relay takes one request up to BODY_MAX; a larger one
  // goes as { piece: { id, n, of, text } }, text a run of base64 of its bytes, each piece its own call; the home node
  // (faceHome.js) answers 202 to each but the last, whose answer is this call's. The relay reads none of them.
  function postCall(t) {
    var once = function (x) { return fetch('/face/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: x }); };
    var BODY_MAX = (self.required.spirit.limits && self.required.spirit.limits.BODY_MAX) || 23552;
    var bytes = new TextEncoder().encode(t);
    if (bytes.length <= BODY_MAX - 1024) return once(t);
    var b64 = self.required.shell.seal.toB64(bytes);
    var size = BODY_MAX - 1024;
    var of = Math.ceil(b64.length / size);
    var id = randomId();
    function next(n) {
      return once(JSON.stringify({ piece: { id: id, n: n, of: of, text: b64.slice(n * size, (n + 1) * size) } })).then(function (r) {
        if (n === of - 1 || r.status !== 202) return r;
        return next(n + 1);
      });
    }
    return next(0);
  }
  function linkDown() { faceLink.downs.slice().forEach(function (fn) { try { fn(); } catch (e) { /* one reader's fault */ } }); }
  function openAll(lines) {
    var head = null;
    var parts = [];
    return lines.reduce(function (chain, l) {
      return chain.then(function () {
        return self.required.shell.seal.open(faceLink.key.privateKey, faceLink.key.publicKey, faceLink.node.publicKey, faceLink.key.publicKey, l);
      }).then(function (got) {
        if (!got) throw new Error('an answer did not open');
        if (!head) head = JSON.parse(got.text);
        else parts.push(self.required.shell.seal.fromB64(got.text));
      });
    }, Promise.resolve()).then(function () { return { head: head, parts: parts }; });
  }
  function joined(parts) {
    var size = parts.reduce(function (n, p) { return n + p.length; }, 0);
    var all = new Uint8Array(size);
    var at = 0;
    parts.forEach(function (p) { all.set(p, at); at += p.length; });
    return all;
  }
  // One request to the home node through the relay: { status, type, bytes }. Sealed when this page can seal.
  function linkCall(request) {
    var sending = faceLink.sealed
      ? self.required.shell.seal.seal(faceLink.node.sealKey, faceLink.key.publicKey, faceLink.node.publicKey, JSON.stringify(request)).then(function (s) { s.k = faceLink.key.publicKey; return s; })
      : Promise.resolve(request);
    return sending.then(function (body) { return postCall(JSON.stringify(body)); }).then(function (r) {
      if (r.status === 503 || r.status === 504) linkDown();
      if (!faceLink.sealed || r.status !== 200) {
        return r.arrayBuffer().then(function (b) { return { status: r.status, type: r.headers.get('Content-Type') || '', bytes: new Uint8Array(b) }; });
      }
      return r.text().then(function (t) { return openAll(linkLines(t)); }).then(function (o) {
        return { status: (o.head && o.head.status) || 502, type: (o.head && o.head.type) || '', bytes: joined(o.parts) };
      });
    });
  }
  // A FILE OF THE HOME NODE, PIECE BY PIECE (goal/G30.16): each line opened as it arrives and its bytes handed to onPiece,
  // so a viewer can show it before the last piece is in. -> { status, type, bytes }
  function linkFile(p, onPiece) {
    var each = typeof onPiece === 'function' ? onPiece : function () {};
    var request = { get: String(p || '').replace(/^\/+/, '') };
    if (!faceLink.sealed) return linkCall(request).then(function (r) { if (r.status === 200) each(r.bytes); return r; });
    return self.required.shell.seal.seal(faceLink.node.sealKey, faceLink.key.publicKey, faceLink.node.publicKey, JSON.stringify(request)).then(function (s) {
      s.k = faceLink.key.publicKey;
      return fetch('/face/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(s) });
    }).then(function (r) {
      if (r.status !== 200 || !r.body || typeof r.body.getReader !== 'function') {
        return linkCall(request).then(function (whole) { if (whole.status === 200) each(whole.bytes); return whole; });
      }
      var reader = r.body.getReader();
      var decoder = new TextDecoder();
      var held = '';
      var head = null;
      var parts = [];
      var chain = Promise.resolve();
      function open(l) {
        chain = chain.then(function () {
          return self.required.shell.seal.open(faceLink.key.privateKey, faceLink.key.publicKey, faceLink.node.publicKey, faceLink.key.publicKey, l);
        }).then(function (got) {
          if (!got) throw new Error('an answer did not open');
          if (!head) { head = JSON.parse(got.text); return; }
          var piece = self.required.shell.seal.fromB64(got.text);
          parts.push(piece);
          if ((head.status || 0) === 200) each(piece);
        });
      }
      function pump() {
        return reader.read().then(function (step) {
          if (step.done) { if (held) open(held); return chain; }
          held += decoder.decode(step.value, { stream: true });
          var cut = held.split('\n');
          held = cut.pop();
          cut.filter(Boolean).forEach(open);
          return pump();
        });
      }
      return pump().then(function () { return { status: (head && head.status) || 502, type: (head && head.type) || '', bytes: joined(parts) }; });
    });
  }
  // A SAVE LARGER THAN ONE TRIP GOES IN PARTS (goal/G33.10): { upload: { id, n, of, size, path, bytes } }, each part sealed on
  // its own and sent as its own call; the home node appends each and answers 202 to each but the last.
  var UPLOAD_PART = 8192;
  function uploadSave(args) {
    var bytes = new TextEncoder().encode(String(args.content));
    var of = Math.max(1, Math.ceil(bytes.length / UPLOAD_PART));
    var id = randomId();
    function next(n) {
      var part = { id: id, n: n, of: of, size: bytes.length, path: String(args.path), bytes: self.required.shell.seal.toB64(bytes.subarray(n * UPLOAD_PART, (n + 1) * UPLOAD_PART)) };
      return linkCall({ upload: part }).then(function (r) {
        if (n === of - 1 || r.status !== 202) return r;
        return next(n + 1);
      });
    }
    return next(0);
  }
  function asAnswer(r) {
    var t = linkText(r.bytes);
    var body = null;
    try { body = JSON.parse(t); } catch (e) { body = null; }
    return { status: r.status, text: t, body: body };
  }
  // A verb of the home node: { status, text, body }. The name and the arguments apart (goal/G41.15).
  function linkAsk(verb, args) {
    if (String(verb) === 'spirit.fs.save' && args && typeof args.content === 'string' && new TextEncoder().encode(args.content).length > UPLOAD_PART) {
      return uploadSave(args).then(asAnswer);
    }
    return linkCall({ call: String(verb), args: args || {} }).then(asAnswer);
  }
  // Made once, logged in: the home node's keys, then this page's own key when the browser can seal.
  function makeLink() {
    return requireOne('spirit/shell/seal/script.js').then(function () { return linkCall({ keys: 1 }); }).then(function (r) {
      var keys = null;
      try { keys = JSON.parse(linkText(r.bytes)); } catch (e) { keys = null; }
      if (r.status !== 200 || !keys || !keys.publicKey) throw refusal('no-home', 'the home node did not answer', { status: r.status });
      faceLink.node = { publicKey: keys.publicKey, sealKey: keys.sealKey || '' };
      // The tab says whose face this is (goal/G30.15).
      if (keys.name && root.document) root.document.title = String(keys.name);
      return (self.required.shell || {}).seal && faceLink.node.sealKey ? self.required.shell.seal.supported() : false;
    }).then(function (can) {
      if (!can) return null;
      return self.required.shell.seal.newKey().then(function (key) { faceLink.key = key; faceLink.sealed = true; });
    }).then(function () {
      self.faceLink = {
        get sealed() { return faceLink.sealed; }, get key() { return faceLink.key; }, get node() { return faceLink.node; },
        ask: linkAsk, file: linkFile, call: linkCall,
        onDown: function (fn) { if (typeof fn === 'function') faceLink.downs.push(fn); },
      };
      self.transport = { ask: linkAsk, file: linkFile };
      return self.faceLink;
    });
  }

  // ── THE FACE PAGE (goal/G40.6; goal/G43.18, box v29) ─────────────────────────────────────────────────────────────
  // Andy: "face.html loads spirit.js FIRST, in it's spirit.js that fetches that fetches all other scripts". face.html says
  // what it is (data-spirit="face") and holds spirit.js alone. On loopback it is the home node's own page: boot.js comes
  // from the node. On a relay, logged out, spirit.faceLogin draws the one field and nothing else is loaded; logged in, the link
  // home is made, and boot.js, the sheets and every other part of the shell come from the home node over it (box v29: "The
  // relay serves a logged-out face one plain page ... with spirit.js and seal.js only"). spirit.faceState says where the page
  // stands, { home, loggedIn, name }; spirit.faceBooted answers once boot.js runs.
  var FACE = ['spirit/shell/boot/script.js'];
  // THE ONE FIELD (box v29: "draws the one field when logged out"; Andy: "i don't care if the face-login is totally plain, it
  // only serves one single-field form...."): the email or the mailed token, Log in, and a line for what the relay said.
  function drawLogin(said) {
    var d = root.document;
    d.body.innerHTML = '';
    var form = d.createElement('form');
    var input = d.createElement('input');
    input.type = 'text';
    input.placeholder = 'your email, or the token from the mail';
    input.autocomplete = 'off';
    var button = d.createElement('button');
    button.type = 'submit';
    button.textContent = 'Log in';
    var line = d.createElement('div');
    line.textContent = said || '';
    form.appendChild(input);
    form.appendChild(button);
    d.body.appendChild(form);
    d.body.appendChild(line);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var typed = input.value;
      line.textContent = '…';
      self.faceLogin.login(typed).then(function (s) {
        if (s && s.loggedIn) { root.location.reload(); return; }
        input.value = '';
        line.textContent = /@/.test(typed) ? 'If that address is this face\'s, a mail with a token is on its way: paste the token here.' : 'That token did not log you in.';
      }, function (err) { line.textContent = 'Not logged in: ' + ((err && err.message) || err); });
    });
    input.focus();
  }
  function startFace() {
    if (isLoopback()) {
      self.faceState = { home: true, loggedIn: true, name: '' };
      // THE GHOST AT HOME (Q26, Andy: "the ghost one for loopback, the face one for the face."): the tab's icon, at its own path.
      var icon = root.document && root.document.querySelector('link[rel="icon"]');
      if (icon) icon.setAttribute('href', '/spirit/shell/ghost.svg');
      return boot(FACE);
    }
    return self.faceLogin.state().then(function (s) {
      self.faceState = { home: false, loggedIn: !!(s && s.loggedIn), name: String((s && s.face) || '') };
      if (s && s.face && root.document) root.document.title = String(s.face);
      if (!self.faceState.loggedIn) { drawLogin(''); return null; }
      return makeLink().then(function () { return boot(FACE); });
    }, function (e) { drawLogin('The relay did not answer: ' + ((e && e.message) || e)); return null; });
  }
  // What a script may expose: an object, so its folder's other scripts can stand under it. A function is refused, as a bare
  // string is (goal/G49.16; Andy: "A FUNCTION MUST ALWAYS BE INSTALLED INSIDE A CONTAINING OBJECT. PERIOD!"): a function at a
  // folder's path would take that folder's scripts as its properties, and its own name, length and prototype cannot be overwritten.
  function placeable(v) { return !!v && typeof v === 'object'; }
  // A page script run in a module box: { set, exports }, set true when it put anything into module.exports. A stylesheet is
  // injected as it is and answers null. No vendored script comes this way: face.html loads codeMirror by its own tags (goal/G49.15).
  var boxes = 0;
  function injectBoxed(p, src) {
    if (/\.css$/.test(p) || !/\.js$/.test(p)) { inject(p, src); return null; }
    var id = 'b' + (boxes += 1);
    var start = {};
    var box = { exports: start };
    var slot = self.moduleBoxes = self.moduleBoxes || {};
    slot[id] = box;
    try {
      inject(p, '(function (module, exports) {' + src + '\n}(window.spirit.moduleBoxes.' + id + ', window.spirit.moduleBoxes.' + id + '.exports));');
    } finally { delete slot[id]; }
    var set = box.exports !== start || Object.keys(start).length > 0;
    return { set: set, exports: box.exports };
  }
  function inject(p, src) {
    if (/\.css$/.test(p)) {
      var style = root.document.createElement('style');
      style.textContent = src;
      root.document.head.appendChild(style);
      return;
    }
    var el = root.document.createElement('script');
    el.textContent = src + '\n//# sourceURL=' + p;
    root.document.body.appendChild(el);
  }
  function boot(list) {
    return list.reduce(function (chain, p) {
      return chain.then(function () { return get(p); }).then(function (r) {
        if (!r || r.status !== 200) throw refusal('not-found', p + ' answered ' + (r && r.status));
        inject(p, text(r.bytes));
        // What the boot loaded counts as required (goal/G41.3): requiring it again runs nothing.
        requiredOnce[p] = Promise.resolve({});
      });
    }, Promise.resolve());
  }
  var doc = root.document;
  if (doc && doc.documentElement && doc.documentElement.getAttribute('data-spirit') === 'face') {
    var go = function () { self.faceBooted = startFace(); };
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', go); else go();
  }
}(globalThis));
