// spirit/run/face/spirit.js
// THE SPIRIT OBJECT (goal/G32.1): the node api for face apps, one file. The relay serves it as the very first script,
// inline in face.html (serveCommon.inlineSpirit); the home node's index.html loads it; a server process requires it.
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
    if (typeof require === 'function') { try { return require('../js/fieldRules.js'); } catch (e) { return null; } }
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

  // ── THE TRANSPORTS ───────────────────────────────────────────────────────────────────────────────────────────────
  function parse(text) { try { return JSON.parse(text); } catch (e) { return null; } }
  // On the face: the sealed link; at home: the node's own door. A file, as text, the same two ways.
  function pageTransport() {
    var t = function () { return (root.spirit || {}).transport || null; };
    return {
      ask: function (verb, args) {
        if (t() && typeof t().ask === 'function') return Promise.resolve(t().ask(verb, args));
        var payload = { verb: verb };
        Object.keys(args || {}).forEach(function (k) { payload[k] = args[k]; });
        return fetch('/api/spirit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          .then(function (r) { return r.text().then(function (x) { return { status: r.status, text: x, body: parse(x) }; }); });
      },
      file: function (path) {
        if (t() && typeof t().file === 'function') {
          return Promise.resolve(t().file(path, function () {})).then(function (r) { return { status: r.status, type: r.type || '', bytes: r.bytes }; });
        }
        return fetch('/' + String(path).replace(/^\/+/, '')).then(function (r) {
          return r.arrayBuffer().then(function (b) { return { status: r.status, type: r.headers.get('Content-Type') || '', bytes: new Uint8Array(b) }; });
        });
      },
    };
  }
  function text(bytes) {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes);
    return Buffer.from(bytes).toString('utf8');
  }
  // A family's interface, the text api {family} answered, run as a module: its module.exports is the definition.
  function loadInterface(source, name) {
    var m = { exports: {} };
    new Function('module', 'exports', String(source) + '\n//# sourceURL=spirit-interface/' + name + '/api.js')(m, m.exports);
    return m.exports;
  }
  // In node: the loopback door at the url the node hands its servers.
  function nodeTransport(base) {
    return {
      ask: function (verb, args) {
        var payload = { verb: verb };
        Object.keys(args || {}).forEach(function (k) { payload[k] = args[k]; });
        return fetch(String(base || '') + '/api/spirit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          .then(function (r) { return r.text().then(function (x) { return { status: r.status, text: x, body: parse(x) }; }); });
      },
      file: function (path) {
        return this.ask('fs.load', { path: path }).then(function (r) {
          var t = r && r.body && typeof r.body.text === 'string' ? r.body.text : null;
          return { status: r ? r.status : 0, type: '', bytes: t === null ? new Uint8Array(0) : new Uint8Array(Buffer.from(t, 'utf8')) };
        });
      },
    };
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
  function member(transport, fam, def) {
    var out = {};
    function call(verb, args) {
      var spec = def.verbs[verb];
      var name = fam + '.' + verb;
      if (!spec) return Promise.reject(refusal('no-such-verb', 'the ' + fam + ' family has no verb ' + verb));
      var bad = check(name, spec, args);
      if (bad) return Promise.reject(bad);
      return Promise.resolve(transport.ask(name, args || {})).then(function (r) {
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
        return Promise.resolve(transport.ask(name, args || {})).then(function (r) {
          if (r && r.status >= 200 && r.status < 300) return r.body !== undefined && r.body !== null ? r.body : {};
          var b = (r && r.body) || {};
          throw refusal(String(b.code || 'refused'), saidWhy(r, r && r.status), { status: r && r.status, body: b });
        });
      };
    });
    if (typeof def.names === 'function') {
      var extra = def.names(call, { file: function (p) { return transport.file(p); }, text: text, refusal: refusal, check: check });
      Object.keys(extra || {}).forEach(function (k) { if (!(k in out)) out[k] = extra[k]; });
    }
    return out;
  }
  // spirit.call('family.verb', args) -> the member call of that name (goal/G32.3), for a caller that names its verb at run
  // time; a family or verb the object does not hold is refused no-such-verb, as the node would.
  function byName(spirit) {
    return function (name, args) {
      var n = String(name || '');
      var dot = n.indexOf('.');
      var fam = dot > 0 ? spirit[n.slice(0, dot)] : null;
      var rest = n.slice(dot + 1);
      var fn = fam && typeof fam === 'object' ? (fam[rest] || (rest.indexOf('FS.') === 0 && fam.FS ? fam.FS[rest.slice(3)] : null)) : null;
      if (typeof fn !== 'function') return Promise.reject(refusal('no-such-verb', 'the node serves no verb ' + n));
      return fn(args);
    };
  }
  // spirit.tree() -> the node's api answer as it stands: every family and verb this caller may call.
  function tree(t) {
    return function () {
      return Promise.resolve(t.ask('api', {})).then(function (r) {
        if (r && r.status >= 200 && r.status < 300) return r.body || {};
        throw refusal('refused', 'the node answered ' + (r && r.status), { status: r && r.status });
      });
    };
  }
  // createSpirit(transport) -> Promise<spirit>. transport: ask(verb, args), file(path). The names from api, each
  // family's interface from api {family}, bound under the node's name.
  function createSpirit(transport) {
    var t = transport || (typeof window === 'undefined' ? nodeTransport('') : pageTransport());
    var spirit = { error: error, formatBytes: formatBytes, escapeHtml: escapeHtml, check: check, rules: Object.keys(RULES), tree: tree(t) };
    spirit.call = byName(spirit);
    return Promise.resolve(t.ask('api', {})).then(function (r) {
      var names = r && r.status === 200 && isPlain(r.body) ? Object.keys(r.body) : [];
      return Promise.all(names.map(function (name) {
        return Promise.resolve(t.ask('api', { family: name })).then(function (got) {
          if (!got || got.status !== 200 || !got.body || typeof got.body.interface !== 'string') return;
          var def = loadInterface(got.body.interface, name);
          if (def && def.verbs) spirit[name] = member(t, name, def);
        }).then(null, function () { /* a family without an interface is not on the object */ });
      }));
    }).then(function () { return spirit; });
  }

  // assemble(transport, { <family>: def }) -> the members at once, for a caller that holds the families already (a suite).
  function assemble(transport, defs) {
    var spirit = { error: error, formatBytes: formatBytes, escapeHtml: escapeHtml, check: check, rules: Object.keys(RULES), tree: tree(transport) };
    spirit.call = byName(spirit);
    Object.keys(defs || {}).forEach(function (name) { if (defs[name] && defs[name].verbs) spirit[name] = member(transport, name, defs[name]); });
    return spirit;
  }

  // A SERVER'S SPIRIT OBJECT (goal/G32.3): forNode(url) -> Promise<spirit> on the node's loopback door at url, made once
  // per url; one made while the node answered nothing (no family on it) is made again at the next call.
  // forNode(url, family): the object on the node's loopback door at url, made once per url; a family it does not hold
  // yet is asked for by name, api {family}, and bound under that name once it answers.
  var made = {};
  function forNode(url, family) {
    var u = String(url || '');
    if (!made[u]) {
      // No family up front: a server binds only those it calls, each when it first calls it, so nothing is asked of the
      // node before a server's first call.
      var t = nodeTransport(u);
      var bare = assemble(t, {});
      bare.__transport = t;
      made[u] = Promise.resolve(bare);
    }
    if (!family) return made[u];
    return made[u].then(function (s) {
      if (s[family]) return s;
      return Promise.resolve(s.__transport.ask('api', { family: family })).then(function (got) {
        if (got && got.status === 200 && got.body && typeof got.body.interface === 'string') {
          var def = loadInterface(got.body.interface, family);
          if (def && def.verbs) s[family] = member(s.__transport, family, def);
        }
        return s;
      }, function () { return s; });
    });
  }
  // outcome(call) -> Promise<{status, body}>: a call's answer as the status it came with, for code that tells the
  // node's refusals apart by status; 0 when the node did not answer at all.
  function outcome(call) {
    return Promise.resolve(call).then(function (body) { return { status: 200, body: body }; },
      function (e) {
        // A call the check refused never left: the caller's fault, as the node would answer it.
        var local = e && !e.status && ['no-such-argument', 'bad-request', 'no-such-verb'].indexOf(e.code) !== -1;
        return { status: (e && e.status) || (local ? 400 : 0), body: (e && e.body) || (local ? { ok: false, code: e.code, error: e.message } : null) };
      });
  }

  var api = { createSpirit: createSpirit, assemble: assemble, check: check, rules: RULES, pageTransport: pageTransport, nodeTransport: nodeTransport,
    loadInterface: loadInterface, forNode: forNode, outcome: outcome, error: error, formatBytes: formatBytes, escapeHtml: escapeHtml };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }

  // ── IN A PAGE ────────────────────────────────────────────────────────────────────────────────────────────────────
  // window.spirit gets the helpers at once and its families on spirit.start(), which the page calls once it can reach
  // its node (the face shell after its link is up; index.html at load). spirit.ready answers when they are there.
  var s = root.spirit = root.spirit || {};
  s.error = s.error || error;
  s.formatBytes = s.formatBytes || formatBytes;
  s.escapeHtml = s.escapeHtml || escapeHtml;
  s.spiritObject = api;
  var started = null;
  s.start = function () {
    if (started) return started;
    started = createSpirit(pageTransport()).then(function (made) {
      // The families, and tree(); the helpers are on the page's spirit already.
      Object.keys(made).forEach(function (k) { if (k === 'tree' || (made[k] && typeof made[k] === 'object' && !Array.isArray(made[k]))) root.spirit[k] = made[k]; });
      return root.spirit;
    });
    s.ready = started;
    return started;
  };
}(typeof window !== 'undefined' ? window : globalThis));
