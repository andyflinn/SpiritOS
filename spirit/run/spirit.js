// spirit/run/spirit.js
// THE SPIRIT OBJECT (goal/G32.1): the node api for face apps, one file. face.html loads it first, by a script tag, from
// the relay or the home node (goal/G41.19); the home node's index.html loads it; a server process requires it.
// AT THE RUN ROOT, THE ONE DOOR (goal/G40.1). Andy: spirit.js sits in "the run-root, the nodes root of its own fs
// scope", and every script that is not the node or a relay server installs it first, as the global spirit, "and then
// use[s] that object properly". The node and the relay build spirit themselves (kernel.js): they are its embodiments.
// Andy: "a spirit face-app needs a damn spirit object, that packages all neccessary loopback calls on the home node into
// something easy to use", and "the whole node api (not appServer API's) must be provided in JavaScript form, as an
// asyncFunction set."
//
// WHAT IT IS
//   - The core: the transport, the checks, the helpers (error, formatBytes, escapeHtml) and the assembling.
//   - The rest comes from the api.js every family folder holds (js/fs/api.js, js/contact/api.js ...; a server's in
//     its family folder, familyPath(name)), written to this file's standard: module.exports = { verbs: { <verb>:
//     { <argument>: '<rule>' } }, names(call, tools) }. One member per family: spirit.fs.load({path}),
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
//   name        a label by js/fieldRules.js     number    a finite number
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
  // The field rules are js/fieldRules.js, the one definition both sides of the wire use.
  function fieldRules() {
    if ((root.spirit || {}).fieldRules) return (root.spirit || {}).fieldRules;
    if (isNode()) { try { return require('./spirit/fieldRules.js'); } catch (e) { return null; } }
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
  // THIS VM'S NODE (Andy: "in the browser the node address is implicit from the first page get. for node.js processes,
  // the host is always 127.0.0.1 and the port is fetched from \relay-state\environment.json"; "anytime a node.js process
  // requires(spirit) spirit itself fetches the port from environment.json"). On a page the page's own origin, or the
  // face's link to its home node when one is set; in node 127.0.0.1 and the PORT read below as this file is required.
  // No port, no node: never a default.
  var PORT = 0;
  if (isNode()) {
    try { PORT = Number(JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'relay-state', 'environment.json'), 'utf8')).PORT) || 0; } catch (e) { PORT = 0; }
  }
  function parse(text) { try { return JSON.parse(text); } catch (e) { return null; } }
  function noNode() { return refusal('no-node', 'this VM has no node: relay-state/environment.json names no port'); }
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

  // The verbs introSpector gives every family for its own folder, the same everywhere.
  var FOLDER = {
    loadFile: { path: 'path' }, saveFile: { path: 'path', content: 'text' }, deleteFile: { path: 'path' }, statFile: { path: 'path' },
    fileExists: { path: 'path' }, loadJsonValue: { path: 'path' }, saveJsonValue: { path: 'path', value: 'object' },
    getAnnotations: { path: 'path' }, annotateFile: { path: 'path', payload: 'object' }, search: { q: 'text?' },
  };

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
    function call(verb, args) {
      var spec = def.verbs[verb];
      var name = fam + '.' + verb;
      if (!spec) return Promise.reject(refusal('no-such-verb', 'the ' + fam + ' family has no verb ' + verb));
      var bad = check(name, spec, args);
      if (bad) return Promise.reject(bad);
      return Promise.resolve(ask(name, args || {})).then(function (r) {
        var status = r && r.status;
        if (status >= 200 && status < 300) return r.body !== undefined && r.body !== null ? r.body : {};
        var b = (r && r.body) || {};
        throw refusal(String(b.code || 'refused'), saidWhy(r, status), { status: status, body: b });
      });
    }
    Object.keys(def.verbs || {}).forEach(function (verb) {
      out[verb] = function (args) { return call(verb, args); };
      // line.write is spirit.chatClerver.lineWrite as well.
      var camel = verb.replace(/\.([a-zA-Z0-9])/g, function (m, c) { return c.toUpperCase(); });
      if (camel !== verb && !(camel in out)) out[camel] = out[verb];
    });
    // EVERY FAMILY'S OWN FOLDER (introSpector.js): the same FS verbs on each, spirit.<family>.FS.loadFile({path}) ...
    out.FS = {};
    Object.keys(FOLDER).forEach(function (v) {
      out.FS[v] = function (args) {
        var name = fam + '.FS.' + v;
        var bad = check(name, FOLDER[v], args);
        if (bad) return Promise.reject(bad);
        return Promise.resolve(ask(name, args || {})).then(function (r) {
          if (r && r.status >= 200 && r.status < 300) return r.body !== undefined && r.body !== null ? r.body : {};
          var b = (r && r.body) || {};
          throw refusal(String(b.code || 'refused'), saidWhy(r, r && r.status), { status: r && r.status, body: b });
        });
      };
    });
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
  // Q3, on holding it here, since this file runs on a page where appServer.js cannot load: "sure"). A server's family
  // folder is process/js/<name>/family/; appServer.js hands out this same function. No other file writes the path.
  function familyPath(name) { return 'process/js/' + String(name || '') + '/family/api.js'; }
  function interfaceName(p) {
    var m = /^process\/js\/([^/]+)\/family\/api\.js$/.exec(p) || /^spirit\/([^/]+)\/api\.js$/.exec(p);
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
    var answer = isNode() ? new Promise(function (resolve) { resolve(require(require('path').join(__dirname, p))); }) : get(p).then(function (r) {
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
  // DEBUG (desk/G2.5): one switch per process, off at start, never persisted. Andy: "DEBUG is Off by default, returned
  // and set by owner-only api", "DEBUG is not persisted. it lives in RAM only".
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
    post('events.subscribe', {}, { stream: true }).then(function (r) {
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
    var PAYLOAD_MAX = require('./spirit/limits.js').PAYLOAD_MAX;
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
    var packet = require('./spirit/client/packet.js');
    self.peerPost = function (peer, app, body, how) {
      var o = how && typeof how === 'object' ? how : {};
      var waitMs = Number(o.waitMs) > 0 ? Number(o.waitMs) : 30000;
      if (!PORT) return Promise.resolve({ ok: false, code: 'not-posted', error: 'no node: relay-state/environment.json names no port' });
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
    requireOne('shell/shared/js/spiritData.js').then(null, function () { /* a run tree without the cache runs uncached */ });
    return;
  }

  // ON A PAGE: spirit.peerPost is the home node's peer.post, answered as peer.post answers it (the page hears no
  // answer-post: the node's own peerPost waits on the node's server stream, which a page does not hold).
  // spirit.start() binds every family the node names on window.spirit, once, when the page can reach its node (the face
  // shell after its link is up; index.html at load); spirit.ready answers when they are there.
  self.peerPost = function (peer, app, body) {
    return post('peer.post', { to: String(peer), text: JSON.stringify({ app: app, body: body }) }).then(function (r) { return r && r.body; });
  };
  var started = null;
  self.start = function () {
    if (started) return started;
    started = tree().then(function (names) {
      return Promise.all(Object.keys(names || {}).map(function (fam) { return bindOwn(fam).then(null, function () { /* a family without an interface is not on the object */ }); }));
    }).then(function () {
      // THE CACHE COMES WITH THE CLIENT (goal/G41.3, Q2): every streamed dataset is kept, each type through its own row
      // element, which takes its type's stream itself (goal/G41.16: no data script). A page without it still runs,
      // uncached. Asked once the page is parsed, so a page that loads it by tag keeps the one cache it made.
      // No element comes with it (goal/G41.19; Andy: no preloading elements): the files row element is loaded by
      // whoever draws with the file tree, the face's boot for its home among them.
      return parsed().then(function () { return requireOne('shell/shared/js/spiritData.js'); }).then(null, function () { /* no cache served here */ });
    }).then(function () { return self; });
    self.ready = started;
    return started;
  };

  // ON A FACE, spirit.js LOADS THE FACE (goal/G40.6). Andy: "face.html loads spirit.js FIRST, in it's spirit.js that
  // fetches that fetches all other scripts". face.html says what it is (data-spirit="face" on its html element) and
  // holds spirit.js alone; spirit.js gets the face shell once the page's body is there, and spirit.booted answers when it
  // runs. The seal is not loaded here: a face needs it only once it is logged in and links to its home node, and the
  // home node itself never does.
  var FACE = ['shell/boot.js'];
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
    var go = function () { self.booted = boot(FACE); };
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', go); else go();
  }
}(globalThis));
