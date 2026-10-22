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
//     process/js/<name>/<name>.family/api.js), written to this file's standard: { family, verbs: { <verb>: { <argument>:
//     '<rule>' } }, names(call, tools) }. One member per family: spirit.fs.load({path}), spirit.contact.label({...}) ...,
//     every verb an async function answering the reply's body.
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
// WHERE IT RUNS: on the face its calls go through window.spiritTransport (the sealed link to the home node); at home
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
    if (root.spiritFieldRules) return root.spiritFieldRules;
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
    var t = function () { return root.spiritTransport || null; };
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
      family: function (name) { return pageFamily(this, name); },
      families: function () { return this.ask('api', {}).then(function (r) { return r && r.status === 200 && isPlain(r.body) ? Object.keys(r.body) : []; }); },
    };
  }
  function text(bytes) {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes);
    return Buffer.from(bytes).toString('utf8');
  }
  // A family's api.js run in the page: it registers itself on root.spiritFamilies. The node's families first, then a
  // server's family folder.
  function pageFamily(transport, name) {
    var tried = ['js/' + name + '/api.js', 'process/js/' + name + '/' + name + '.family/api.js'];
    function next(i) {
      if (i >= tried.length) return Promise.resolve(null);
      return transport.file(tried[i]).then(function (r) {
        if (!r || r.status !== 200) return next(i + 1);
        var s = document.createElement('script');
        s.textContent = text(r.bytes) + '\n//# sourceURL=' + tried[i];
        document.head.appendChild(s);
        return (root.spiritFamilies || {})[name] || null;
      }, function () { return next(i + 1); });
    }
    return next(0);
  }
  // In node: the loopback door at the url the node hands its servers, and the family files from the run folder.
  function nodeTransport(base) {
    var runDir = require('path').join(__dirname, '..');
    var fsMod = require('fs');
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
      family: function (name) {
        var tried = [['js', name, 'api.js'], ['process', 'js', name, name + '.family', 'api.js']];
        for (var i = 0; i < tried.length; i++) {
          var full = require('path').join.apply(null, [runDir].concat(tried[i]));
          if (fsMod.existsSync(full)) return Promise.resolve(require(full));
        }
        return Promise.resolve(null);
      },
      families: function () { return this.ask('api', {}).then(function (r) { return r && r.status === 200 && isPlain(r.body) ? Object.keys(r.body) : []; }); },
    };
  }

  // The verbs introSpector gives every family for its own folder, the same everywhere.
  var FOLDER = {
    loadFile: { path: 'path' }, saveFile: { path: 'path', content: 'text' }, deleteFile: { path: 'path' }, statFile: { path: 'path' },
    fileExists: { path: 'path' }, loadJsonValue: { path: 'path' }, saveJsonValue: { path: 'path', value: 'object' },
    getAnnotations: { path: 'path' }, annotateFile: { path: 'path', payload: 'object' }, search: { q: 'text?' },
  };

  // ── THE ASSEMBLING ───────────────────────────────────────────────────────────────────────────────────────────────
  // One member per family, each verb a checked async call; then the family's own names (the kernel's, for fs).
  function member(transport, def) {
    var out = {};
    var fam = String(def.family);
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
        throw refusal(String(b.code || 'refused'), String(b.error || b.code || ('the node answered ' + status)), { status: status, body: b });
      });
    }
    Object.keys(def.verbs || {}).forEach(function (verb) { out[verb] = function (args) { return call(verb, args); }; });
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
          throw refusal(String(b.code || 'refused'), String(b.error || b.code || ('the node answered ' + (r && r.status))), { status: r && r.status, body: b });
        });
      };
    });
    if (typeof def.names === 'function') {
      var extra = def.names(call, { file: function (p) { return transport.file(p); }, text: text, refusal: refusal, check: check });
      Object.keys(extra || {}).forEach(function (k) { if (!(k in out)) out[k] = extra[k]; });
    }
    return out;
  }
  // createSpirit(transport) -> Promise<spirit>. transport: ask(verb, args), file(path), family(name), families().
  function createSpirit(transport) {
    var t = transport || (typeof window === 'undefined' ? nodeTransport('') : pageTransport());
    var spirit = { error: error, formatBytes: formatBytes, escapeHtml: escapeHtml, check: check, rules: Object.keys(RULES) };
    return Promise.resolve(t.families()).then(function (names) {
      return Promise.all((names || []).map(function (name) {
        return Promise.resolve(t.family(name)).then(function (def) {
          if (def && def.verbs && String(def.family) === name) spirit[name] = member(t, def);
        }, function () { /* a family without its api.js is not on the object */ });
      }));
    }).then(function () { return spirit; });
  }

  var api = { createSpirit: createSpirit, check: check, rules: RULES, pageTransport: pageTransport, nodeTransport: nodeTransport,
    error: error, formatBytes: formatBytes, escapeHtml: escapeHtml };
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
      Object.keys(made).forEach(function (k) { if (made[k] && typeof made[k] === 'object' && !Array.isArray(made[k])) root.spirit[k] = made[k]; });
      return root.spirit;
    });
    s.ready = started;
    return started;
  };
}(typeof window !== 'undefined' ? window : globalThis));
