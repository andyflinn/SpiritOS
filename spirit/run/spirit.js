// spirit/run/spirit.js
// THE SPIRIT OBJECT (goal/G32.1): the node api for face apps, one file. The relay serves it as the very first script,
// inline in face.html (serveCommon.inlineSpirit); the home node's index.html loads it; a server process requires it.
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
//     process/js/<name>/<name>.family/api.js), written to this file's standard: module.exports = { verbs: { <verb>:
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
  // post(verb, args) -> {status, text, body}: {verb, ...args} to the node's /api/spirit.
  function post(verb, args) {
    var l = link();
    if (l && typeof l.ask === 'function') return Promise.resolve(l.ask(verb, args || {}));
    if (isNode() && !PORT) return Promise.reject(noNode());
    var payload = { verb: verb };
    Object.keys(args || {}).forEach(function (k) { payload[k] = args[k]; });
    return fetch(door() + '/api/spirit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.text().then(function (x) { return { status: r.status, text: x, body: parse(x) }; }); });
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
  var asking = {};
  function bindOwn(fam) {
    if (self[fam] && typeof self[fam] === 'object' && !Array.isArray(self[fam])) return Promise.resolve(self[fam]);
    if (asking[fam]) return asking[fam];
    asking[fam] = bindOn(post, get, fam).then(function (m) { delete asking[fam]; self[fam] = m; return m; }, function (e) { delete asking[fam]; throw e; });
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
  // <name>/<name>.family/api.js (a server's) or spirit/<name>/api.js (a node family's), binds that family: on the
  // instance as spirit.<name> from this VM's node, or with a key as that peer's family (how, in node, is peerPost's
  // waiting). Any other path is a component, its module.exports: in node required, on a page got and run.
  function interfaceName(p) {
    var m = /(?:^|\/)([^/]+)\/\1\.family\/api\.js$/.exec(p) || /^spirit\/([^/]+)\/api\.js$/.exec(p);
    return m ? m[1] : '';
  }
  function runComponent(source, p) {
    var m = { exports: {} };
    new Function('module', 'exports', String(source) + '\n//# sourceURL=spirit-component/' + p)(m, m.exports);
    return m.exports;
  }
  function requireOne(path, key, how) {
    var p = String(path || '').replace(/^\/+/, '');
    var fam = interfaceName(p);
    if (fam && key) return bindPeer(key, fam, how);
    if (fam) return bindOwn(fam);
    if (isNode()) return new Promise(function (resolve) { resolve(require(require('path').join(__dirname, p))); });
    return get(p).then(function (r) {
      if (!r || r.status !== 200) throw refusal('not-found', p + ' answered ' + (r && r.status));
      return runComponent(text(r.bytes), p);
    });
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

  // ── THE ONE INSTANCE, IN NODE AND ON A PAGE ───────────────────────────────────────────────────────────────────────
  // Andy: "all this module exports is the one and only instance of the spirit object", "on a browser the spirit object
  // gets placed on the window object on nodes js the spirit object is the only export of this file."
  self.isNode = isNode;
  self.isBrowser = isBrowser;
  self.error = error;
  self.formatBytes = formatBytes;
  self.escapeHtml = escapeHtml;
  self.check = check;
  self.rules = Object.keys(RULES);
  self.outcome = outcome;
  self.tree = tree;
  self.require = requireOne;

  // IN NODE: what a script took from kernel.js until now, under the kernel's own names so no call changes
  // (spirit.core.jobs, spirit.core.node, spirit.core.util, spirit.core.fs, spirit.core.const with its VERSION, peerPost).
  // The kernel stays their implementation until it goes (Andy: "we leave kernel.js where it is and get rid of it when we
  // are finished").
  if (isNode()) {
    var kernel = require('./spirit/kernel.js');
    self.core = self.core || {};
    self.core.jobs = kernel.core.jobs;
    self.core.node = kernel.core.node;
    self.core.util = kernel.core.util;
    self.core.fs = kernel.core.fs;
    self.core.const = Object.assign({}, kernel.core.const, { MIME_TYPES: MIME_TYPES });
    // The kernel's peerPost, through this VM's own node unless the caller names one.
    self.peerPost = function (peer, app, body, how) {
      return kernel.peerPost(peer, app, body, Object.assign({ node: PORT ? door() : '' }, how || {}));
    };
    module.exports = self;
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
    }).then(function () { return self; });
    self.ready = started;
    return started;
  };
}(globalThis));
