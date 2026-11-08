// spirit/run/spirit/spirit.js (goal/G43.18: moved from the run root, served at /spirit.js as before)
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
//   - The rest comes from the api.js every family folder holds (spirit/fs/api.js, spirit/contact/api.js ...; a server's in
//     its family folder, familyPath(name)), written to this file's standard: module.exports = { verbs: { <verb>:
//     { <argument>: '<rule>' } }, functions: { <verb>: '<its function>' }, names(call, tools) }. One member per family: spirit.fs.load({path}),
//     spirit.contact.label({...}) ..., every verb an async function answering the reply's body; a dotted verb is also
//     there in camel case (spirit.chatClerver.lineWrite for line.write).
//   - WHERE A MEMBER COMES FROM (goal/G32.3). Andy, 2026-10-22: "the api.js files should not assume the namespace they
//     will occupy in the spirit object, that mapping belongs to the node". The names are the families the verb api
//     answers; each family's interface is api {family}, the text of its api.js as the node reads it, run here as a
//     module and bound under the name the node gave. No path of the page's own, and no api.js names itself.
//
// THE CHECK IS COMPLETE (Andy: "the pages check must be complete"): before a call goes out, every argument is checked
// against its verb's declaration: no argument the verb does not name (no-such-argument), every required one present,
// each by its rule (bad-request). A malformed call never leaves. The node stays the gate and checks everything again.
// A reply that is not 2xx refuses, with its status and the node's own code.
//
// THE RULES (the standard a family's api.js writes to; '?' after a rule makes the argument optional):
//   text        any string                      flag      '' or 'yes'
//   name        a label by fieldRules.js        number    a finite number
//   description a description by fieldRules    bool      true or false
//   paragraph   a paragraph by fieldRules       object    a plain object
//   key         a peer's public key             list      an array
//   path        a path inside the node's run folder, relative, no '..'
//   url         an http or https address        id        a non-empty string
//
// WHERE IT RUNS: on the face its calls go through window.spirit.transport (the sealed link to the home node); at home
// through the node's own door (POST /api/spirit); in node through the node's loopback door at the url it is given.
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

  // ── THE CHECKS ──────────────────────────────────────────────────────────────────────────────────────────────────
  // The field rules are fieldRules.js beside this file, the one definition both sides of the wire use.
  function fieldRules() {
    if ((root.spirit || {}).fieldRules) return (root.spirit || {}).fieldRules;
    if (isNode()) { try { return require('./fieldRules.js'); } catch (e) { return null; } }
    return null;
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
    name: function (v) {
      if (typeof v !== 'string') return 'a text';
      var R = fieldRules();
      return R && R.normalize(v) ? (R.problem(v) || '') : '';
    },
    description: function (v) {
      if (typeof v !== 'string') return 'a text';
      var R = fieldRules();
      return R && typeof R.describeProblem === 'function' ? (R.describeProblem(v) || '') : '';
    },
    paragraph: function (v) {
      if (typeof v !== 'string') return 'a text';
      var R = fieldRules();
      return R && typeof R.paragraphProblem === 'function' ? (R.paragraphProblem(v) || '') : '';
    },
  };
  function refusal(code, why, extra) {
    var e = new Error(why);
    e.code = code;
    if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
    return e;
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
      var rule = RULES[optional ? raw.slice(0, -1) : raw];
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
  // "we need to move run://spirit.js to run://spirit/spirit.js"). In node only.
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
  // post(verb, args) -> {status, text, body}: { call: verb, args } to the node's /api/spirit, the name and the arguments
  // apart (goal/G41.15; the box: "ONE ENVELOPE for every call to a node's door"), so an argument named verb is the
  // verb's own. post(verb, args, {stream: true, headers}) answers the response itself, read as it comes: the events
  // family's subscribe (below).
  function post(verb, args, how) {
    var l = link();
    if (l && typeof l.ask === 'function') return Promise.resolve(l.ask(verb, args || {}));
    if (isNode() && !PORT) return Promise.reject(noNode());
    var payload = { call: String(verb), args: args || {} };
    var headers = { 'Content-Type': 'application/json' };
    Object.keys((how && how.headers) || {}).forEach(function (k) { headers[k] = how.headers[k]; });
    var asked = fetch(door() + '/api/spirit', { method: 'POST', headers: headers, body: JSON.stringify(payload) });
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
  // A family's interface, the text api {family} answered, run as a module: its module.exports is the definition.
  function loadInterface(source, name) {
    var m = { exports: {} };
    new Function('module', 'exports', String(source) + '\n//# sourceURL=spirit-interface/' + name + '/api.js')(m, m.exports);
    return m.exports;
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
  // One member per family, each verb a checked async call; then the family's own names (the kernel's, for fs).
  // The name is the one the node gives the family (its api answer), never one the family's api.js claims.
  function member(ask, getFile, fam, def) {
    var out = {};
    // ONE SEARCH ON THE WIRE AT A TIME (goal/G43.27; Andy: "a search over the wire should always be \"serialized\" having two
    // of those in flight at the some time is ridiculous.", "put that throttle on spirit.js"): per family and the node or peer
    // it asks (this member), a search verb (search, or a name ending in .search) waits until the one before it has its
    // answer; the same search asked again while it is on the wire gets that one answer. Every caller is served the same way,
    // the search element's lists, the finder, a family's own names, with no code of its own.
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
      if (!spec) return Promise.reject(refusal('no-such-verb', 'the ' + fam + ' family has no verb ' + verb));
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
      // A family may name the function that implements a verb (def.functions; goal/G43.7): the verb stays as it is on the wire.
      var named = def.functions && def.functions[verb];
      if (named) { out[named] = function (args) { return call(verb, args); }; return; }
      out[verb] = function (args) { return call(verb, args); };
      // line.write is spirit.chatClerver.lineWrite as well.
      var camel = verb.replace(/\.([a-zA-Z0-9])/g, function (m, c) { return c.toUpperCase(); });
      if (camel !== verb && !(camel in out)) out[camel] = out[verb];
    });
    // NO FS SET (goal/G43.20): a family's files are spirit.fs's, by the path its id names.
    // EVERY SERVER'S DEBUG (desk/G2.5, appServer's own verb), bound by hand (goal/G43.15): {} reads it, {on} sets it, and it
    // answers {debug}. A family's api.js does not list it, so serverDEBUG would find no such function without this.
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
    if (typeof def.names === 'function') {
      var extra = def.names(call, { file: function (p) { return getFile(p); }, text: text, refusal: refusal, check: check });
      Object.keys(extra || {}).forEach(function (k) { if (!(k in out)) out[k] = extra[k]; });
    }
    return out;
  }
  // ── THE ONE INSTANCE BINDS ITS FAMILIES ON ITSELF (goal/G40.6) ──────────────────────────────────────────────────────
  // Andy: "every javascript VM has ONE, one and only spirit object"; "What is createSpirit, it is completely
  // unnecessary"; "every loaded/required module then simply inserts its api functions into the one spirit object".
  // Nothing here makes a second object. A node family's api.js, run here, inserts its verbs on the instance as
  // spirit.<family>; a peer's family is held under that peer's key and answered by spirit.require.
  //
  // A family's interface asked by ask, and made a member over ask and getFile, or refused no-interface.
  function bindOn(ask, getFile, fam) {
    return Promise.resolve(ask('api', { family: fam })).then(function (got) {
      if (!got || got.status !== 200 || !got.body || typeof got.body.interface !== 'string') throw refusal('no-interface', 'no interface for the family ' + fam);
      var def = loadInterface(got.body.interface, fam);
      if (!def || !def.verbs) throw refusal('no-interface', 'the interface of ' + fam + ' names no verbs');
      return member(ask, getFile, fam, def);
    });
  }
  // This VM's node's family, on the instance as spirit.<family>. Two callers at once ask once; a refusal is asked
  // again next time.
  // A family whose name is already on the instance (spirit.jobs, holding this process's job in node; spirit.events, the
  // one stream) is extended, not replaced, and what it holds stays: a verb of the same name does not overwrite it.
  var asking = {};
  var bound = {};
  function bindOwn(fam) {
    if (bound[fam]) return Promise.resolve(self[fam]);
    if (asking[fam]) return asking[fam];
    asking[fam] = bindOn(post, get, fam).then(function (m) {
      delete asking[fam];
      var held = self[fam] && typeof self[fam] === 'object' && !Array.isArray(self[fam]) ? self[fam] : null;
      if (held) Object.keys(m).forEach(function (k) { if (!(k in held)) held[k] = m[k]; });
      self[fam] = held || m;
      bound[fam] = true;
      return self[fam];
    }, function (e) { delete asking[fam]; throw e; });
    return asking[fam];
  }
  // A PEER'S FAMILY (goal/G33.4, box v38), held under its key. Its calls are packed as the far node's apiDoor takes them
  // ('api', {api: {family}}, {family: {verb: args}}) and sent by spirit.peerPost; the apiDoor answers the body alone: ok
  // false is a refusal, 409, or 0 when the post never reached the peer or nothing answered.
  function peerAsk(key, how) {
    return function (verb, args) {
      var n = String(verb || '');
      var body;
      if (n === 'api') body = args && args.family ? { api: { family: String(args.family) } } : 'api';
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

  // spirit.tree() -> the node's api answer as it stands: every family and verb this caller may call.
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

  // ── spirit.require(path, key, how) (goal/G40.1, goal/G40.6) ─────────────────────────────────────────────────────────
  // Andy: "the dynamic loading must be in spirit.js, because it belongs there, and so that any component touched later,
  // can load its needed components there."; "the loaders name should be spirit.require()"; the key "a second argument
  // in spirit.require(), by default it's null (owner node) otherwise it's a peer ID". The one async loader, the same on a
  // page and in node. path is from the run root. A path in the node's own naming of an interface,
  // familyPath(name) (a server's) or spirit/<name>/api.js (a node family's), binds that family: on the
  // instance as spirit.<name> from this VM's node, or with a key as that peer's family (how, in node, is peerPost's
  // waiting). Any other path is a component: in node required, answering its module.exports; on a page got and run as a
  // plain script (a stylesheet put on as a style), answering an empty object.
  // THE ONE FAMILY PATH (goal/G41.12, box v15: "One function finds a family path ... and every caller uses it"; Andy,
  // Q3, on holding it here, since this file runs on a page where appServer.js cannot load: "sure"). A family's path is its
  // own api.js (goal/G43.20, the box: "a family is found as spirit/<name>/api.js or spirit/app/<name>/api.js ... nothing
  // falls back"): a system family's spirit/<name>/api.js, or in node, when that is not there and the app has one, an app's
  // spirit/app/<name>/api.js. On a page the path only names the family (interfaceName); the node finds its folder.
  // appServer.js hands out this same function. No other file writes the path.
  function familyPath(name) {
    var n = String(name || '');
    if (isNode()) {
      var fs = require('fs');
      var p = require('path');
      if (!fs.existsSync(p.join(RUN_ROOT, 'spirit', n, 'api.js')) && fs.existsSync(p.join(RUN_ROOT, 'spirit', 'app', n, 'api.js'))) return 'spirit/app/' + n + '/api.js';
    }
    return 'spirit/' + n + '/api.js';
  }
  // A FAMILY'S data.js, FOUND BY ITS NAME (goal/G41.28; Andy: "the shell can introspect to find and download their
  // clientCacheManagers."): data.js in the family's own folder, a node family's (spirit/<name>/) or an app's
  // (spirit/app/<name>/, asked last, in node). cacheManager(name) loads it once through the one loader, the data set first;
  // it stands at spirit.data.<name>. A family with none answers not-found.
  function managerPaths(name) {
    var n = String(name || '');
    return ['spirit/' + n + '/data.js', 'spirit/app/' + n + '/data.js'];
  }
  // ON A PAGE, FOUND BY THE FOLDER SHAPE AND LOADED BY A GET (goal/G43.27, requirement 6; Andy: "spirit.js can be fixed,
  // no? it knows the difference between an app and a system branch?"): an app's data.js is spirit/app/<name>/data.js when the app holds an api.js, a
  // node family's spirit/<name>/data.js, and the page tells an app by the node's app list it holds (spirit.data.app, the
  // app family's own manager, spirit/app/data.js). No family folder is asked. The one loader GETs that path, so a manager of
  // any size travels, on loopback and through the face alike. In node, its own disk.
  // Asked as a file runs, it is part of that file's tree: the file's require answers once it has, and a family with
  // none fails no tree.
  var MANAGER = 'data.js';
  var managers = Object.create(null);
  // THE NODE'S APPS, ASKED ONCE AND THEN FOLLOWED (goal/G43.27; Andy: "do it."): asked with app.search (the function
  // spirit.app.searchApp, spirit/app/api.js; each item's label is its row, spirit/app.js rowOf), so nothing waits for the
  // stream, which a page opens only once it is up. From then on the app family's cache, fed by the node's streamed apps job,
  // is followed: a new app with an api.js reaches the finder with no reload. An answer with no app in it is asked again.
  var appsAsked = null;
  function appRows() {
    if (!appsAsked) {
      appsAsked = Promise.resolve(self.ready).then(function (s) {
        return s && s.app && typeof s.app.searchApp === 'function' ? s.app.searchApp({ q: '' }) : null;
      }).then(function (b) {
        var rows = {};
        ((b && b.items) || []).forEach(function (i) {
          var r = null;
          try { r = JSON.parse(i.label); } catch (e) { r = null; }
          if (r && r.key) rows[r.key] = r;
        });
        if (!Object.keys(rows).length) appsAsked = null;
        return rows;
      }, function () { appsAsked = null; return {}; });
      // The streamed list, loaded beside the ask and never waited for.
      cacheManager('app').then(null, function () { /* the asked rows stand */ });
    }
    return appsAsked.then(function (asked) {
      var A = self.data && self.data.app && self.data.app.data;
      var live = A ? A.rows() : null;
      return live && Object.keys(live).length ? live : asked;
    });
  }
  function cacheManager(name) {
    var n = String(name || '');
    if (!/^[A-Za-z]\w*$/.test(n)) return Promise.reject(refusal('not-found', 'no family ' + name));
    if (!managers[n]) {
      if (isNode()) {
        var at = managerPaths(n).filter(function (p) { return require('fs').existsSync(require('path').join(RUN_ROOT, p)); })[0];
        managers[n] = at ? requireOne(at) : Promise.reject(refusal('not-found', 'the family ' + n + ' has no ' + MANAGER));
      } else {
        // ANDY'S RULES FOR THE FINDER (goal/G43.27): "less path elements get priority", "the target needs an api.js", and
        // "duplicate <name>/api.js raise a red" (the tree's test). So spirit/<name>/ is the place, and spirit/app/<name>/ only
        // for an app whose row says it holds an api.js (spirit/app.js, api): contact, a face beside the contact family, has
        // none and leaves the name to spirit/contact/ (wsl found it at verify).
        managers[n] = (n === 'app' ? Promise.resolve('spirit/app/' + MANAGER) : appRows().then(function (rows) {
          var row = rows && Object.prototype.hasOwnProperty.call(rows, n) ? rows[n] : null;
          return row && row.api === true ? 'spirit/app/' + n + '/' + MANAGER : 'spirit/' + n + '/' + MANAGER;
        })).then(function (p) {
          return requireOne('spirit/data.js').then(function () { return requireOne(p); });
        });
      }
      managers[n].then(null, function () { /* asked again next time */ delete managers[n]; });
    }
    if (collecting) collecting.push(managers[n].then(null, function () {}));
    return managers[n];
  }
  function interfaceName(p) {
    // An app's family sits at the top of its folder, spirit/app/<name>/api.js (goal/G43.27).
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
  function requireOne(path, key, how) {
    var p = String(path || '').replace(/^\/+/, '');
    var fam = interfaceName(p);
    if (fam && key) return bindPeer(key, fam, how);
    if (fam) return bindOwn(fam);
    if (requiredOnce[p]) { if (collecting) collecting.push(requiredOnce[p]); return requiredOnce[p]; }
    // A script the page loaded by its own tag (the home shell's index.html) has run: it counts as required.
    if (!isNode() && loadedByTag(p)) { requiredOnce[p] = Promise.resolve({}); if (collecting) collecting.push(requiredOnce[p]); return requiredOnce[p]; }
    var answer = isNode() ? new Promise(function (resolve) { resolve(require(require('path').join(RUN_ROOT, p))); }) : get(p).then(function (r) {
      if (!r || r.status !== 200) throw refusal('not-found', p + ' answered ' + (r && r.status));
      var outer = collecting;
      var tree = collecting = [];
      // ON A PAGE A FILE RUNS AS A PLAIN SCRIPT (goal/G41.7; Andy: "script IS what codeMirror Is, use the require
      // interfaces that exists in spirit.js or boot.js, NOTHING HAND-ROLLED"): every shell element puts itself into
      // window.spirit as it runs, so none is handed a module box, and a file written for both node and a page
      // (CodeMirror's) takes its page branch. A stylesheet goes on the page as a style. The answer is an empty object.
      try { inject(p, text(r.bytes)); } finally { collecting = outer; }
      return Promise.all(tree).then(function () { return {}; });
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
  self.error = error;
  self.formatBytes = formatBytes;
  self.escapeHtml = escapeHtml;
  self.check = check;
  self.rules = Object.keys(RULES);
  self.outcome = outcome;
  self.tree = tree;
  self.require = requireOne;
  self.familyPath = familyPath;
  self.cacheManager = cacheManager;

  self.MIME_TYPES = MIME_TYPES;
  self.VERSION = VERSION;
  self.DEFAULT_SPIRIT_PORT = DEFAULT_SPIRIT_PORT;
  self.debug = debug;

  // ── THE ONE STREAM OF THIS VM: spirit.events.subscribe(handlers) (goal/G40.6) ──────────────────────────────────────
  // Andy: "two verbs on events - publish - subscribe". The node's events family is its one dispatcher; this is its
  // subscribe, moved here from kernel.js's page stream. ONE STREAM PER PAGE (goal/G30.16; Andy: "the home page should
  // need one stream only."): every subscriber shares it, and one that comes later is handed the jobs as they stand and
  // told the stream is up. It comes back by itself (Andy, 2026-09-30: "this should work without a hickup."): an end or an
  // error is said (onConnection false), it opens again, and the first open after being down is said (onReconnect).
  // handlers: onSnapshot(jobs), onUpdate(job), onDelete(id), onPacket(message), onRelayEvent(row), onContactRename(row),
  // onConnection(up), onReconnect(). On a face the events come down the face's own link (window.spirit.transport.events).
  // Answers the unsubscribe; the stream closes when nobody is left.
  var streamSubs = [];
  var streamReader = null;
  var streamOpening = false;
  var streamUp = false;
  var streamDown = false;
  var streamWaiting = false;
  var streamJobs = new Map();
  function tellStream(name, arg) {
    streamSubs.slice().forEach(function (h) {
      if (typeof h[name] === 'function') { try { h[name](arg); } catch (e) { /* one subscriber's fault */ } }
    });
  }
  // The events one response carries, kind and data, to each(kind, data); answers when the stream ends.
  function readEvents(reader, each) {
    var dec = new TextDecoder();
    var buf = '';
    return new Promise(function (resolve, reject) {
      function pump() {
        reader.read().then(function (chunk) {
          if (chunk.done) { resolve(); return; }
          buf += dec.decode(chunk.value, { stream: true });
          var i;
          while ((i = buf.indexOf('\n\n')) !== -1) {
            var block = buf.slice(0, i); buf = buf.slice(i + 2);
            var ev = /(?:^|\n)event: (.*)/.exec(block); var da = /(?:^|\n)data: (.*)/.exec(block);
            if (!ev || !da) continue;
            var data; try { data = JSON.parse(da[1]); } catch (e) { continue; }
            each(ev[1], data);
          }
          pump();
        }, reject);
      }
      pump();
    });
  }
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
  function openStream() {
    streamOpening = true;
    var lost = function () {
      streamReader = null;
      streamOpening = false;
      if (!streamDown) tellStream('onConnection', false);
      streamUp = false;
      streamDown = true;
      if (streamSubs.length) setTimeout(function () { if (!streamReader && !streamOpening && streamSubs.length) openStream(); }, 2000);
    };
    // A PROCESS IS NOT A PAGE (goal/G43.3, as peerPost says it below; goal/G16.9): it witnesses the packets and takes none, or
    // it would eat the waiting lines of its node's owner.
    post('events.subscribe', {}, isNode() ? { stream: true, headers: { 'X-Spirit-Reader': 'server' } } : { stream: true }).then(function (r) {
      if (!r || !r.ok || !r.body) throw refusal('no-stream', 'the node answered ' + (r && r.status));
      streamReader = r.body.getReader();
      streamOpening = false;
      streamUp = true;
      tellStream('onConnection', true);
      if (streamDown) tellStream('onReconnect');
      streamDown = false;
      return readEvents(streamReader, onStreamEvent);
    }).then(lost, lost);
  }
  function subscribeEvents(handlers) {
    var h = handlers || {};
    var l = link();
    if (l && typeof l.events === 'function') return l.events(h);
    streamSubs.push(h);
    // OPENED ONCE THE PAGE HAS PARSED: every subscriber its scripts make (the shell, the page's mirror) is then in
    // place before the first event, so none of them misses the file tree a connecting page is handed.
    var doc = root.document;
    if (!streamReader && !streamOpening && !streamWaiting) {
      if (doc && doc.readyState === 'loading') {
        streamWaiting = true;
        doc.addEventListener('DOMContentLoaded', function () { streamWaiting = false; if (streamSubs.length && !streamReader && !streamOpening) openStream(); });
      } else openStream();
    } else if (streamReader) {
      if (h.onSnapshot) { try { h.onSnapshot(Array.from(streamJobs.values())); } catch (e) { /* one subscriber's fault */ } }
      if (streamUp && h.onConnection) { try { h.onConnection(true); } catch (e) { /* one subscriber's fault */ } }
    }
    return function unsubscribe() {
      streamSubs = streamSubs.filter(function (x) { return x !== h; });
      if (!streamSubs.length && streamReader) { var r = streamReader; streamReader = null; r.cancel().catch(function () { /* gone */ }); }
    };
  }
  self.events = { subscribe: subscribeEvents };

  // IN NODE, spirit.js's OWN, AND NO KERNEL (goal/G40.6). Andy: "WHY THE FUCK WOULD we pass spirit.js if not for the
  // fucking servers to use it?", and "Fix that SHIT. in this item, here. NOW." What a server process took from kernel.js
  // through spirit.core is spirit.js's own now, on its one post: the node's facts, this process's job, peerPost.
  if (isNode()) {
    // THE NODE'S FACTS (goal/G19.10; Andy: "they should have that stuff passed with the spirit object"): its port, and what
    // the node hands every server it starts as --node {name, publicKey, ownerKey}, all public; '' when not given.
    var facts = {};
    try { var at = process.argv.indexOf('--node'); facts = at !== -1 ? (JSON.parse(String(process.argv[at + 1] || '')) || {}) : {}; } catch (e) { facts = {}; }
    var str = function (v) { return typeof v === 'string' ? v : ''; };
    self.node = { port: PORT, name: str(facts.name), key: str(facts.publicKey), ownerKey: str(facts.ownerKey) };

    // THIS PROCESS'S JOB (goal/G29.15), REPORTED BY THE ONE PATH TO PUBLISH (goal/G40.6; Andy, 2026-10-25: "ONE path for
    // everybody to publish events"): a process the node started as a job publishes on it by events.publish with its own id
    // (SPIRIT_JOB_ID), one post; the node changes the job and every subscriber hears it.
    //   spirit.events.publish(obj)   the object as the job's app, every page hears it; over PAYLOAD_MAX it is not sent,
    //                  and the pages hear that one was dropped, with its size (fileTransfer goal/G1.4)
    //   spirit.jobs.start(name), progress(done, total, text), end(result)   one job at a time: a start while one is open
    //                  refuses job-open; each resolves once the node has it, so awaited calls arrive in order
    //   spirit.jobs.report(patch), log(text), complete(data), fail(error)   the job's own state, and its three common forms
    var JOB = String(process.env.SPIRIT_JOB_ID || '');
    var PAYLOAD_MAX = require('./limits.js').PAYLOAD_MAX;
    var openJob = null;
    var jobs = self.jobs = self.jobs && typeof self.jobs === 'object' ? self.jobs : {};
    var bytesOf = function (o) { try { return new TextEncoder().encode(JSON.stringify(o)).length; } catch (e) { return -1; } };
    jobs.report = function (patch) {
      if (!JOB) return Promise.reject(refusal('no-job', 'this process was not started by a node as a job (SPIRIT_JOB_ID is unset)'));
      return post('events.publish', Object.assign({ id: JOB }, patch)).then(function (r) { return r && r.body; });
    };
    jobs.log = function (message) { return jobs.report({ logMessage: message }); };
    jobs.complete = function (data) { return jobs.report({ status: 'completed', data: data }); };
    jobs.fail = function (e) { return jobs.report({ status: 'failed', data: { error: String(e) } }); };
    self.events.publish = function (obj) {
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
      if (size > PAYLOAD_MAX) return Promise.resolve(self.events.publish(one));
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
      if (result instanceof Error) one.error = String(result.message || result);
      else if (result !== undefined) one.result = result;
      return jobs.cycle(one);
    };

    // ASK A PEER AND AWAIT THE ANSWER (fileTransfer goal/G1.3), as it has always worked (Andy: "peer post will work the way
    // they ALWAY WORKED"), moved here from kernel.js unchanged in what it does: the node's events subscribed as a server
    // (it is handed no backlog and marks nothing taken), then one post of peer.post, then the answer-post whose re
    // matches that post's hash. The stream opens BEFORE the post, so an answer quicker than the post's own reply is kept.
    // how: waitMs (30 s by default), patienceMs, kind. Resolves the answer's body; {ok: false, code: 'not-posted'} for a
    // post the node refused, {ok: false, code: 'no-answer'} after waitMs of silence. It never rejects.
    // By its run-root path, as this file loads every other part (goal/G43.18: it sits in spirit/ now, beside client/).
    var packet = require(require('path').join(RUN_ROOT, 'spirit', 'client', 'packet.js'));
    self.peerPost = function (peer, app, body, how) {
      var o = how && typeof how === 'object' ? how : {};
      var waitMs = Number(o.waitMs) > 0 ? Number(o.waitMs) : 30000;
      if (!PORT) return Promise.resolve({ ok: false, code: 'not-posted', error: 'no node: spirit/state/environment.json names no port' });
      var made = packet.encode(app, body);
      if (!made || !made.ok) return Promise.resolve({ ok: false, code: 'not-posted', error: (made && made.error) || 'the ask could not be encoded' });
      return post('events.subscribe', {}, { stream: true, headers: { 'X-Spirit-Reader': 'server' } }).then(function (r) {
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
    // THE CACHE COMES WITH THE CLIENT (goal/G41.3, Q2), in a process as on a page: spirit.data, filled by each type's
    // translator, which its type loads; a process follows a stream only through appServer's streamListener.
    // Through the one loader, as every component is; in a process its require runs at once, so spirit.data is there now.
    module.exports = self;
    requireOne('spirit/data.js');
    return;
  }

  // ON A PAGE: spirit.peerPost is the home node's peer.post, the body in its packet envelope (spirit/client/packet.js),
  // as the node's own peerPost sends it (goal/G43.24: it sent {app, body} unwrapped, so elements wrapped it themselves).
  // It resolves what a process's peerPost resolves, the answer's body decoded, {ok: false, code, error} for a post that did
  // not get through; never rejects. how.answer true resolves the node's whole answer read as a page needs it instead,
  // { ok, status, body, card, from, error }: card is the node's VERIFIED card of the peer (spirit/peerPost.js, answer.card), ok
  // only when it reached and the peer did not refuse. A page hears no answer-post: the node's own peerPost waits on the
  // node's server stream, which a page does not hold, so peer.post's reply is the answer.
  // spirit.start() runs once the page can reach its node (the face shell after its link is up; index.html at load). It asks
  // no api (goal/G43.27, Q1): spirit.ready answers the instance, on which any family named stands, bound when first called.
  self.peerPost = function (peer, app, body, how) {
    var whole = !!(how && how.answer === true);
    // What it needs, it requires itself: packet.js on a page wants the limits before it (spirit/limits.js).
    return Promise.resolve(requireOne('spirit/limits.js')).then(function () { return requireOne('spirit/client/packet.js'); }).then(function () {
      var made = self.packet.encode(app, body);
      if (!made || !made.ok) return whole ? { ok: false, body: null, card: null, from: '', error: (made && made.error) || 'the ask could not be encoded' }
        : { ok: false, code: 'not-posted', error: (made && made.error) || 'the ask could not be encoded' };
      return post('peer.post', { to: String(peer), text: made.text }).then(function (r) {
        var said = (r && r.body) || {};
        var text = typeof said.text === 'string' ? said.text : '';
        var decoded = text ? self.packet.decode(text) : null;
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
  // A FAMILY THAT BINDS WHEN FIRST CALLED (goal/G43.27). spirit.<family> stands as an object at once: what it already holds
  // (spirit.events' stream, spirit.jobs in node) answers as it is, and any other name is a call waiting for the family: called,
  // it binds the family once (bindOwn: one api call), then calls the bound function of that name, a dotted path included
  // (spirit.<family>.a.b). Once bound, the bound functions are on the object itself. Nothing is then-able, so a
  // family handed to Promise.resolve stays a family.
  function lazyCall(fam, path) {
    var fn = function () {
      var args = arguments;
      return bindOwn(fam).then(function (m) {
        var at = m;
        var owner = m;
        for (var i = 0; i < path.length; i++) { owner = at; at = at ? at[path[i]] : undefined; }
        if (typeof at !== 'function') throw refusal('no-such-verb', 'the ' + fam + ' family has no ' + path.join('.'));
        return at.apply(owner, args);
      });
    };
    if (typeof Proxy !== 'function') return fn;
    return new Proxy(fn, {
      get: function (target, prop) {
        if (typeof prop !== 'string' || prop === 'then' || prop in target) return target[prop];
        return lazyCall(fam, path.concat(prop));
      },
    });
  }
  function lazyFamily(fam) {
    if (bound[fam] || typeof Proxy !== 'function') return;
    var held = self[fam] && typeof self[fam] === 'object' && !Array.isArray(self[fam]) ? self[fam] : {};
    self[fam] = new Proxy(held, {
      get: function (target, prop) {
        if (typeof prop !== 'string' || prop === 'then' || prop in target || bound[fam]) return target[prop];
        return lazyCall(fam, [prop]);
      },
    });
  }
  // WHAT spirit.ready ANSWERS: the one instance, seen so that a family is there the moment it is named (goal/G43.27, Q1;
  // Andy: "shouldn't it work without making a call, since the elements will trigger the necessary calls?", "Q1: clear").
  // A name the instance does not hold, read off it, stands there as a family waiting for its first call (lazyFamily), so an
  // app switched on after the page loaded is reached with no reload. The cost wsl named: a misspelt family fails when it is
  // called, not at load. Everything the instance holds answers as it is; window.spirit itself stays the plain instance.
  var FAMILY_NAME = /^[a-z][A-Za-z0-9]*$/;
  var view = typeof Proxy !== 'function' ? self : new Proxy(self, {
    get: function (target, prop) {
      if (typeof prop === 'string' && prop !== 'then' && !(prop in target) && FAMILY_NAME.test(prop)) lazyFamily(prop);
      return target[prop];
    },
  });
  // ON A PAGE, ready IS THERE FROM THE START: an element that runs before start() (one required as face.html loads) waits on
  // it, and it answers once start() has. In node there is no start, and no ready.
  var readyNow = null;
  if (isBrowser()) self.ready = new Promise(function (resolve) { readyNow = resolve; });
  self.start = function () {
    if (started) return started;
    // NO API CALL AT LOAD (goal/G43.27, Q1, above; before it, "lazy-load, is a tree....", G41.3, and "AGAIN, when i say
    // lazy-load you found a way to fuck it up"): the node's api is never asked whole. A family binds the first time
    // something calls it (lazyFamily), as a file loads the first time it is required: one api call, for that family only.
    started = Promise.resolve().then(function () {
      // THE CACHE COMES WITH THE CLIENT (goal/G41.3, Q2): every streamed dataset is kept, each family through its own
      // data.js (goal/G41.28). Asked once the page is parsed, so a page that loads it by tag keeps the one
      // cache it made.
      // No element comes with it (goal/G41.19; Andy: no preloading elements): the files row element is loaded by
      // whoever draws with the file tree, the face's boot for its home among them.
      return parsed().then(function () { return requireOne('spirit/data.js'); });
    }).then(function () {
      // THE PAGE KNOWS ITS NODE (goal/G41.28; Andy, Q10: "Shall spirit.js ask node.card once as a page loads and keep the
      // key as spirit.node.key, so a page files its own node's rows under it?" "yes."): asked once, kept on spirit.node as a
      // process has it, and handed to the data set, which files the page's stream under it from then on.
      return Promise.resolve(view.node.card()).then(function (c) {
        var key = c && typeof c.publicKey === 'string' ? c.publicKey : '';
        if (!key) return;
        self.node.key = key;
        if (self.data && typeof self.data.homeNode === 'function') self.data.homeNode(key);
      }, function () { /* the page files nothing until its node is known */ });
    }).then(function () { return view; });
    if (readyNow) readyNow(started);
    self.ready = started;
    return started;
  };

  // ── THE RELAY LOGIN, spirit.login (goal/G43.18, box v29, "The relay login") ───────────────────────────────────────
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
    self.login = {
      state: function () { return relayCall('state'); },
      login: function (text) { return relayCall('login', { text: String(text == null ? '' : text) }); },
      logout: function () { return relayCall('logout'); },
    };
  }

  // ── THE LINK HOME, spirit.link (goal/G43.18, Q22, Andy: "ok." to "the link home moves into spirit.js, and boot.js keeps
  // only the stream and loading the shell") ─────────────────────────────────────────────────────────────────────────
  // On a face, once logged in: the home node's keys (faceHome answers { keys: 1 }), one key of this page's own, kept in
  // memory and lost with the session (goal/G30.11), and every request to the home node through the relay's /face/call,
  // sealed when this browser can seal (shell/seal.js, the node's own seal in WebCrypto). It is spirit.transport's ask and
  // file, so every call of the spirit object goes through it; boot.js reads its key for the face stream.
  //   spirit.link: { sealed, key, node, ask(verb, args), file(path, onPiece), call(request), onDown(fn) }
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
    var BODY_MAX = (self.limits && self.limits.BODY_MAX) || 23552;
    var bytes = new TextEncoder().encode(t);
    if (bytes.length <= BODY_MAX - 1024) return once(t);
    var b64 = self.seal.toB64(bytes);
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
        return self.seal.open(faceLink.key.privateKey, faceLink.key.publicKey, faceLink.node.publicKey, faceLink.key.publicKey, l);
      }).then(function (got) {
        if (!got) throw new Error('an answer did not open');
        if (!head) head = JSON.parse(got.text);
        else parts.push(self.seal.fromB64(got.text));
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
      ? self.seal.seal(faceLink.node.sealKey, faceLink.key.publicKey, faceLink.node.publicKey, JSON.stringify(request)).then(function (s) { s.k = faceLink.key.publicKey; return s; })
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
    return self.seal.seal(faceLink.node.sealKey, faceLink.key.publicKey, faceLink.node.publicKey, JSON.stringify(request)).then(function (s) {
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
          return self.seal.open(faceLink.key.privateKey, faceLink.key.publicKey, faceLink.node.publicKey, faceLink.key.publicKey, l);
        }).then(function (got) {
          if (!got) throw new Error('an answer did not open');
          if (!head) { head = JSON.parse(got.text); return; }
          var piece = self.seal.fromB64(got.text);
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
      var part = { id: id, n: n, of: of, size: bytes.length, path: String(args.path), bytes: self.seal.toB64(bytes.subarray(n * UPLOAD_PART, (n + 1) * UPLOAD_PART)) };
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
    if (String(verb) === 'fs.save' && args && typeof args.content === 'string' && new TextEncoder().encode(args.content).length > UPLOAD_PART) {
      return uploadSave(args).then(asAnswer);
    }
    return linkCall({ call: String(verb), args: args || {} }).then(asAnswer);
  }
  // Made once, logged in: the home node's keys, then this page's own key when the browser can seal.
  function makeLink() {
    return requireOne('shell/seal.js').then(function () { return linkCall({ keys: 1 }); }).then(function (r) {
      var keys = null;
      try { keys = JSON.parse(linkText(r.bytes)); } catch (e) { keys = null; }
      if (r.status !== 200 || !keys || !keys.publicKey) throw refusal('no-home', 'the home node did not answer', { status: r.status });
      faceLink.node = { publicKey: keys.publicKey, sealKey: keys.sealKey || '' };
      // The tab says whose face this is (goal/G30.15).
      if (keys.name && root.document) root.document.title = String(keys.name);
      return self.seal && faceLink.node.sealKey ? self.seal.supported() : false;
    }).then(function (can) {
      if (!can) return null;
      return self.seal.newKey().then(function (key) { faceLink.key = key; faceLink.sealed = true; });
    }).then(function () {
      self.link = {
        get sealed() { return faceLink.sealed; }, get key() { return faceLink.key; }, get node() { return faceLink.node; },
        ask: linkAsk, file: linkFile, call: linkCall,
        onDown: function (fn) { if (typeof fn === 'function') faceLink.downs.push(fn); },
      };
      self.transport = { ask: linkAsk, file: linkFile };
      return self.link;
    });
  }

  // ── THE FACE PAGE (goal/G40.6; goal/G43.18, box v29) ─────────────────────────────────────────────────────────────
  // Andy: "face.html loads spirit.js FIRST, in it's spirit.js that fetches that fetches all other scripts". face.html says
  // what it is (data-spirit="face") and holds spirit.js alone. On loopback it is the home node's own page: boot.js comes
  // from the node. On a relay, logged out, spirit.login draws the one field and nothing else is loaded; logged in, the link
  // home is made, and boot.js, the sheets and every other part of the shell come from the home node over it (box v29: "The
  // relay serves a logged-out face one plain page ... with spirit.js and seal.js only"). spirit.face says where the page
  // stands, { home, loggedIn, name }; spirit.booted answers once boot.js runs.
  var FACE = ['shell/boot.js'];
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
      self.login.login(typed).then(function (s) {
        if (s && s.loggedIn) { root.location.reload(); return; }
        input.value = '';
        line.textContent = /@/.test(typed) ? 'If that address is this face\'s, a mail with a token is on its way: paste the token here.' : 'That token did not log you in.';
      }, function (err) { line.textContent = 'Not logged in: ' + ((err && err.message) || err); });
    });
    input.focus();
  }
  function startFace() {
    if (isLoopback()) {
      self.face = { home: true, loggedIn: true, name: '' };
      // THE GHOST AT HOME (Q26, Andy: "the ghost one for loopback, the face one for the face."): the tab's icon, /favicon.svg.
      var icon = root.document && root.document.querySelector('link[rel="icon"]');
      if (icon) icon.setAttribute('href', '/favicon.svg');
      return boot(FACE);
    }
    return self.login.state().then(function (s) {
      self.face = { home: false, loggedIn: !!(s && s.loggedIn), name: String((s && s.face) || '') };
      if (s && s.face && root.document) root.document.title = String(s.face);
      if (!self.face.loggedIn) { drawLogin(''); return null; }
      return makeLink().then(function () { return boot(FACE); });
    }, function (e) { drawLogin('The relay did not answer: ' + ((e && e.message) || e)); return null; });
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
    var go = function () { self.booted = startFace(); };
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', go); else go();
  }
}(globalThis));
