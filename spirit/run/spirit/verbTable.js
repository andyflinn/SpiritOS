'use strict';

// spirit/run/spirit/verbTable.js
// What the loopback client door can be asked, and who answers it.
//
//   Andy: "I think the modules handling various requests, should register
//   then as a group of interfaces to the api dispatch, so that the API
//   dispatch can route them based on what the handlers registered... the
//   alterations to the api would be made in a way that no longer needs to
//   touch tedious things like matching every post type with who might
//   handle it?"
//
// ── WHY THIS IS NOT A TABLE IN server.js ─────────────────────────────
//
// It was, for about an hour. `LOOPBACK_VERBS` held one entry and would
// have held nineteen by the time /api/hub folded — nineteen lines whose
// only content is "this verb belongs to that function", which is a fact
// the module implementing it already knows.
//
// That is the same tedium the four post-path doors were: a thing said in
// two places, kept in step by remembering. The shell has had the better
// shape all along — `registerApp`, where an app declares itself and the
// shell enumerates nothing.
//
// So server.js gains ONE line per module rather than one per verb, and a
// verb added later touches only the file that answers it.
//
// ── CLAIM, NOT REGISTER ──────────────────────────────────────────────
//
//   Andy: "claim, not register: i agree."
//
// A namespace is OWNED. `fs.*` is the fs module's and nobody else's, and
// that turns two mistakes into loud ones:
//
//   COLLISION — two modules claiming `fs.save` is a crash at boot, not
//     last-wins. Silent shadowing is real here: `unknownPolicy` appeared
//     twice in one object literal in hub.js and nothing said a word.
//
//   OUT OF NAMESPACE — a module that claims `fs` may not answer
//     `peer.post`. That is what keeps "which side of this node does the
//     verb live on" readable IN THE VERB, and enforced rather than a
//     naming convention somebody follows.
//
// ── CLAIMED AFTER BOOT ───────────────────────────────────────────────
//
//   Andy: "registration after boot. it avoids dependency messes."
//
// The alternative — modules self-registering when required — makes load
// order load-bearing and invisible, which this tree has already been
// bitten by. And `handlePost`'s deps, peerRouter and presence,
// are built at the FOOT of server.js: a module claiming at require time
// would be claiming before the things it needs exist. That is the same
// shape as the ReferenceError that killed the node on its first mint.
//
// So claims happen where the deps do, and the door is only reachable
// after `listen`.

function createVerbTable() {
  var owner = Object.create(null);   // namespace -> { by, wire }
  var answer = Object.create(null);  // 'ns.verb' -> handler

  var NAMESPACE_RE = /^[a-z][a-z0-9]*$/;
  var VERB_RE = /^[a-z][a-z0-9]*\.[a-z][a-zA-Z0-9]*$/;

  // ── WIRE OR NOT, AND WHY IT IS ON THE NAMESPACE ─────────────────────
  //
  //   Andy: "wire or not is the most important distingtion, wire requires
  //   that the local box be online, others who knows."
  //
  // It is not a maintainer's fact, which is what it was mistaken for
  // once. It is the client's failure contract:
  //
  //   wire   can answer "not reachable right now", and yields a hash
  //   local  cannot be unreachable, and has no hash to give
  //
  // A caller must handle those differently, so it has to be answerable
  // from the verb alone — permanently, rather than by somebody
  // remembering. Hence: a namespace is uniformly one or the other, and
  // this refuses a claim that does not say which.
  //
  // The GROUPING is by subject, because that is what a client
  // understands (Andy: "from the clients views understandable
  // distinctions") — `peer.*`, `contact.*`, `device.*`. Uniformity is
  // what lets both be true at once: `peer.post` and `contact.block` are
  // in different groups for a reason a client feels, not because one of
  // them writes a file.
  //
  // `by` is the claimant's own name, and it is not decoration: when a
  // collision is reported, "fs.save is claimed by jobs and by fs" names
  // the two files to look in.
  function claim(namespace, by, group, opts) {
    var ns = String(namespace || '');
    if (!NAMESPACE_RE.test(ns)) {
      throw new Error('verbTable: bad namespace ' + JSON.stringify(namespace));
    }
    if (owner[ns]) {
      throw new Error('verbTable: namespace ' + ns + ' already claimed by ' + owner[ns].by);
    }
    if (!group || typeof group !== 'object') {
      throw new Error('verbTable: ' + ns + ' claimed nothing');
    }
    if (!opts || typeof opts.wire !== 'boolean') {
      throw new Error('verbTable: ' + ns + ' must say wire: true or false — ' +
        'a caller has to know whether being offline can fail it');
    }

    Object.keys(group).forEach(function (verb) {
      if (!VERB_RE.test(verb)) {
        throw new Error('verbTable: ' + by + ' offered a malformed verb ' + JSON.stringify(verb));
      }
      if (verb.slice(0, ns.length + 1) !== ns + '.') {
        throw new Error('verbTable: ' + by + ' claimed ' + ns +
          ' but offered ' + verb + ' — a module answers in its own namespace');
      }
      if (typeof group[verb] !== 'function') {
        throw new Error('verbTable: ' + verb + ' is not a function');
      }
      // Cannot happen while namespaces are exclusive, and asserted
      // anyway: it is the check that stops being redundant the day
      // somebody adds a second way to claim.
      if (answer[verb]) {
        throw new Error('verbTable: ' + verb + ' already answered by ' + owner[ns].by);
      }
      answer[verb] = group[verb];
    });

    owner[ns] = { by: String(by || ns), wire: !!opts.wire };
    return true;
  }

  // ── THE UPPERCASE SET IS THE SYSTEM'S (goal/G10.5) ──────────────────
  //
  //   Andy, 2026-10-09: "so the introSpector could still insist on
  //   lower-case verbs to be registered, and then STILL add the uppercase
  //   set"; "that is a decision. make it so."
  //
  // claim() above refuses an uppercase verb from a module (VERB_RE), and
  // that is now the rule's reason: an uppercase verb is always the system's,
  // told apart by the name alone. This is the one way such a verb reaches
  // the table, and only the system family of a namespace already claimed:
  // since goal/G30.4 the owner's ns.FS.<name>, which introSpector supplies
  // for every family folder (the AGENTS family that stood here is gone).
  // mount below calls it; a module has no business to.
  var FAMILY_RE = /^[a-z][a-z0-9]*\.FS\.[a-zA-Z]+$/;
  function reserve(namespace, group) {
    var ns = String(namespace || '');
    if (!owner[ns]) {
      throw new Error('verbTable: ' + ns + ' is not claimed, so it carries no family');
    }
    if (!group || typeof group !== 'object') {
      throw new Error('verbTable: ' + ns + ' reserved nothing');
    }
    Object.keys(group).forEach(function (verb) {
      if (!FAMILY_RE.test(verb) || verb.slice(0, ns.length + 1) !== ns + '.') {
        throw new Error('verbTable: ' + verb + ' is not of the system families of ' + ns);
      }
      if (typeof group[verb] !== 'function') {
        throw new Error('verbTable: ' + verb + ' is not a function');
      }
      if (answer[verb]) {
        throw new Error('verbTable: ' + verb + ' already answered');
      }
      answer[verb] = group[verb];
    });
    return true;
  }

  // Null for anything unclaimed, so the door reports "no such verb"
  // rather than this deciding what a refusal looks like. A table says
  // who answers; it does not speak HTTP.
  function handlerFor(verb) {
    var name = String(verb || '');
    return Object.prototype.hasOwnProperty.call(answer, name) ? answer[name] : null;
  }

  // Everything claimed, sorted. For a test to assert against, and for a
  // client to be told what this node can do — which is the beginning of
  // the answer to "what is the API", asked of the node rather than of a
  // document that goes stale.
  function verbs() {
    return Object.keys(answer).sort();
  }

  // WHETHER BEING OFFLINE CAN FAIL IT. Answerable from the verb alone,
  // which is the point of refusing a claim that will not say.
  function needsWire(verb) {
    var ns = String(verb || '').split('.')[0];
    return owner[ns] ? owner[ns].wire : null;
  }

  function namespaces() {
    return Object.keys(owner).sort().map(function (ns) {
      return { namespace: ns, by: owner[ns].by, wire: owner[ns].wire };
    });
  }

  // ── THE MOUNTER (goal/G30.4) ─────────────────────────────────────────
  //
  //   Andy, 2026-10-20: "a module shouldn't know who mounted it, and what it's name/address is in the mounters
  //   name-Space.... this is similar to a git-project-folder, it has no need to know it's name in the parent
  //   directory." And on claim, which stood in introSpector: "it does NOT belong in introSpector. a namespace
  //   container is not known by the namespace."
  //
  // mount(family, dir, declarations, opts): a module hands its verbs BARE, {stat: {request, reply, handler}}, and its
  // folder; the table gives them the family name (family.stat), puts the folder's FS verbs beside them through
  // introSpector.family, and keeps their shapes for tree(). The handlers are the (req, res) functions the loopback door
  // calls, unchanged.
  var shapes = Object.create(null);  // family -> {verb: {request, reply}}
  var folders = Object.create(null); // family -> the folder it was mounted with, where its api.js is (goal/G32.3)
  function mount(family, dir, declarations, opts) {
    var ns = String(family || '');
    if (!declarations || typeof declarations !== 'object') throw new Error('verbTable: ' + ns + ' declared nothing');
    var group = {};
    var prefixed = {};
    var shape = {};
    Object.keys(declarations).forEach(function (v) {
      var d = declarations[v];
      if (!d || typeof d !== 'object' || typeof d.handler !== 'function' || !d.request || typeof d.request !== 'object' || !('reply' in d)) {
        throw new Error('verbTable: verb "' + v + '" of ' + ns + ' needs request (an object), reply and handler');
      }
      group[ns + '.' + v] = d.handler;
      prefixed[ns + '.' + v] = d;
      shape[v] = { request: d.request, reply: d.reply };
    });
    claim(ns, (opts && opts.by) || ns, group, opts);
    var made = require('./introSpector').family(String(dir || ''), { declared: Object.keys(declarations), prefix: ns + '.', declarations: prefixed });
    made.stale.forEach(function (file) {
      console.error('verbTable: ' + file + ' in the folder of ' + ns + ' names a verb it does not declare');
    });
    var reserved = {};
    Object.keys(made.verbs).forEach(function (name) {
      reserved[name] = asDoorHandler(name, made.verbs[name]);
      shape[name.slice(ns.length + 1)] = { request: made.verbs[name].request, reply: made.verbs[name].reply };
    });
    if (Object.keys(reserved).length) reserve(ns, reserved);
    shapes[ns] = shape;
    if (dir) folders[ns] = String(dir);
    return true;
  }

  // What this table mounted, {family: {verb: {request, reply}}}: the node's own half of the flat table.
  function tree() {
    var out = {};
    Object.keys(shapes).sort().forEach(function (ns) { out[ns] = Object.assign({}, shapes[ns]); });
    return out;
  }

  // ── ONE CALL, IN-PROCESS (goal/G30.4) ────────────────────────────────
  //
  // The handler a loopback call reaches, called without the network: the body in as a request stream, the answer
  // caught off the response. This was puppetMode's private shim; a granted peer call runs the same way now (Andy:
  // "1 handler, grant-system covers all"), so it lives with the handlers. A handler can fail twice, at once or later
  // in the promise it returns; both resolve as handler-failed, once.
  function call(verb, args) {
    return new Promise(function (resolve) {
      var handler = handlerFor(verb);
      if (!handler) { resolve({ ok: false, status: 400, code: 'no-such-verb', error: 'no such verb', verb: verb }); return; }
      // The handler reads the call's args as its body, as behind the door (goal/G41.15); the name is not among them.
      var text = JSON.stringify(args && typeof args === 'object' && !Array.isArray(args) ? args : {});
      var req = require('stream').Readable.from([text]);
      req.headers = { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(text, 'utf8')) };
      var status = 200;
      var res = {
        writeHead: function (code) { status = Number(code) || 200; return res; },
        setHeader: function () {},
        write: function () { return true; },
        end: function (body) {
          var parsed = null;
          try { parsed = JSON.parse(String(body || '')); } catch (e) { parsed = null; }
          resolve({ ok: status < 400, status: status, body: parsed, text: parsed ? undefined : String(body || '') });
        },
      };
      var failed = function () { resolve({ ok: false, status: 500, code: 'handler-failed', error: 'the handler failed', verb: verb }); };
      var ran = null;
      try { ran = handler(req, res); } catch (e) { failed(); return; }
      if (ran && typeof ran.then === 'function') ran.then(null, failed);
    });
  }

  // ── THE ONE DOOR TO THE FLAT TABLE (goal/G30.4) ──────────────────────
  //
  // door(apps) answers what apiDoor and /api/spirit ask: 'api' is one flat object, this node's families and its apps'
  // side by side (Andy: "the apiDoor only responds with it's flat list of families. it doesn't include the
  // app-client branch at all anymore"); {family: {verb: {args}}} runs a node family through call and hands anything
  // else to the apps. It gates nothing: the gate is apiDoor's.
  // opts.owner(), when given, is the caller the owner's own calls carry ({owner: true, key, label}): a server tracks
  // his records by key like anybody's (apiAuth/G1.13). Without it, {owner: true}.
  function door(apps, opts) {
    var ownerOf = opts && typeof opts.owner === 'function' ? opts.owner : function () { return { owner: true }; };
    // A FAMILY'S INTERFACE (goal/G32.3; the verb change Andy approved, 2026-10-22: "verb change approved."). api {family}
    // answers {family, interface}, the text of the family's api.js, read from the folder the node mounted it with, or for
    // a served app from the folder opts.familyDir(name) names (its family folder, spirit.familyPath). The node maps the name; the file names
    // none, and the server never hears of the read.
    var familyDirOf = opts && typeof opts.familyDir === 'function' ? opts.familyDir : function () { return ''; };
    function interfaceOf(name) {
      var fam = String(name || '');
      var served = apps && typeof apps.apps === 'function' && apps.apps().indexOf(fam) !== -1;
      var dir = folders[fam] || (served ? familyDirOf(fam) : '');
      var text = null;
      if (dir) { try { text = require('fs').readFileSync(require('path').join(dir, 'api.js'), 'utf8'); } catch (e) { text = null; } }
      if (text === null) return Promise.resolve({ status: 404, body: { ok: false, code: 'no-interface', error: 'no interface for the family ' + fam } });
      return Promise.resolve({ status: 200, body: { family: fam, interface: text } });
    }
    function asksInterface(body) {
      return !!body && typeof body === 'object' && !Array.isArray(body) && Object.keys(body).length === 1 && body.api && typeof body.api === 'object' && typeof body.api.family === 'string';
    }
    var d = {
      ask: function (body, caller) {
        if (asksInterface(body)) return interfaceOf(body.api.family);
        if (body === 'api') {
          return Promise.resolve(apps && typeof apps.ask === 'function' ? apps.ask('api', caller) : { status: 200, body: {} }).then(function (r) {
            var flat = Object.assign({}, (r && r.body && typeof r.body === 'object') ? r.body : {});
            var own = tree();
            Object.keys(own).forEach(function (ns) { flat[ns] = own[ns]; });
            return { status: 200, body: flat };
          });
        }
        var isObj = body && typeof body === 'object' && !Array.isArray(body);
        var ns = isObj && Object.keys(body).length === 1 ? Object.keys(body)[0] : '';
        if (ns && owner[ns]) {
          var inner = body[ns];
          if (!inner || typeof inner !== 'object' || Array.isArray(inner) || Object.keys(inner).length !== 1) {
            return Promise.resolve({ status: 400, body: { ok: false, code: 'bad-request', error: 'one verb, as {family: {verb: {args}}}' } });
          }
          var v = Object.keys(inner)[0];
          return call(ns + '.' + v, inner[v]).then(function (a) {
            return { status: a.status, body: a.body !== null && a.body !== undefined ? a.body : { ok: a.ok, code: a.code, error: a.error || a.text } };
          });
        }
        return Promise.resolve(apps && typeof apps.ask === 'function' ? apps.ask(body, caller) : { status: 404, body: { ok: false, code: 'app-not-served' } });
      },
    };
    // ── THE DOOR'S OWN FRONT (goal/G30.5) ───────────────────────────────
    //
    //   Andy, 2026-10-20: "the api query belongs to the apiDoor", and on the door that sat behind the jobs api verb alone:
    //   "why do you think i want a uniform, orthogonal api implementation?"
    //
    // The loopback door (/api/spirit) asks this for the handler of a verb, as it asked the table. A node family verb
    // keeps its own (req, res) handler, unchanged; 'api' answers the flat table; 'family.verb' (the family is the part
    // before the first dot) goes through ask as {family: {verb: args}}, args the call's own (goal/G41.15). The caller is the
    // owner: the loopback door is the owner's own machine.
    d.handlerFor = function (verb) {
      var name = String(verb || '');
      var own = handlerFor(name);
      if (own) return own;
      var dot = name.indexOf('.');
      if (name !== 'api' && (dot < 1 || dot === name.length - 1)) return null;
      // A family nobody serves is no verb at all: the door refuses it, as it refused any unclaimed verb.
      if (name !== 'api' && apps && typeof apps.apps === 'function' && apps.apps().indexOf(name.slice(0, dot)) === -1) return null;
      return function (rq, rs) {
        return readBody(rq).then(function (body) {
          // The call's args, as the door handed them on (goal/G41.15): read as they came, never sifted.
          var args = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
          var asked = name;
          if (name === 'api' && typeof args.family === 'string') asked = { api: { family: args.family } };
          else if (name !== 'api') {
            asked = {};
            asked[name.slice(0, dot)] = {};
            asked[name.slice(0, dot)][name.slice(dot + 1)] = args;
          }
          return d.ask(asked, ownerOf());
        }).then(function (a) {
          rs.writeHead((a && a.status) || 500, { 'Content-Type': 'application/json; charset=utf-8' });
          rs.end(JSON.stringify(a && a.body !== undefined ? a.body : { ok: false, code: 'handler-failed' }));
        });
      };
    };
    // ── THE DOOR'S IN-PROCESS CALL (goal/G30.6) ────────────────────────────
    //
    //   Andy, 2026-10-20: "jobs is for launching and tracking appServer processes and other local (transient)
    //   processes, it is NOT meant to be some kind of api-hub."
    //
    // What the owner door (puppetDoor) runs: one verb by name, as /api/spirit takes it, answered {ok, status, body}.
    // A node family verb through the table's call, 'api' the flat table, family.verb through ask; a family nobody
    // serves is no-such-verb, as the loopback door says it.
    // AN APP GETS THE CALL'S ARGUMENTS AS THEY CAME (goal/G41.15): the name travels apart, { call, args }, so an
    // argument named verb is the verb's own and nothing is sifted out.
    d.call = function (verb, args) {
      var name = String(verb || '');
      if (handlerFor(name)) return call(name, args);
      var dot = name.indexOf('.');
      if (name !== 'api' && !d.handlerFor(name)) return Promise.resolve({ ok: false, status: 400, code: 'no-such-verb', error: 'no such verb', verb: name });
      var asked = name;
      if (name === 'api' && args && typeof args.family === 'string') asked = { api: { family: args.family } };
      else if (name !== 'api') {
        var given = args && typeof args === 'object' && !Array.isArray(args) ? args : {};
        asked = {};
        asked[name.slice(0, dot)] = {};
        asked[name.slice(0, dot)][name.slice(dot + 1)] = given;
      }
      return Promise.resolve(d.ask(asked, ownerOf())).then(function (a) {
        var status = (a && a.status) || 500;
        return { ok: status < 400, status: status, body: a ? a.body : null };
      });
    };
    return d;
  }

  return {
    claim: claim,
    reserve: reserve,
    mount: mount,
    call: call,
    tree: tree,
    door: door,
    handlerFor: handlerFor,
    verbs: verbs,
    needsWire: needsWire,
    namespaces: namespaces,
  };
}

// THE BODY THE DOOR ALREADY READ: the loopback door peeks the verb through serveCommon.readJsonBody, which keeps its
// promise on the request, so the same call here answers at once. A second reader on the stream would wait for an end
// that has already passed (found on a planted node, 2026-10-09: every family ask hung and the client saw no answer).
// Moved here from introSpector with mount (goal/G30.4).
function readBody(rq) {
  return require('./serveCommon').readJsonBody(rq);
}

// A system family verb (FS) as the loopback door calls one: the body in, the verb's own fields alone to the handler, its
// answer out as JSON; a refusal the catalogue knows by its code and status.
function asDoorHandler(name, decl) {
  return function (rq, rs) {
    function send(status, body) {
      rs.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      rs.end(JSON.stringify(body));
    }
    return readBody(rq).then(function (body) {
      var args = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
      return Promise.resolve().then(function () { return decl.handler(args); });
    }).then(function (reply) {
      send(200, reply);
    }, function (e) {
      var errors = require('./spiritErrors');
      var known = e && typeof e.refusal === 'string' ? errors.byCode(e.refusal) : null;
      if (known) return send(known.status, Object.assign({ ok: false, code: e.refusal, error: known.text, verb: name }, e.extra && typeof e.extra === 'object' ? { extra: e.extra } : {}));
      // A body refused for its size says too big (goal/G33.10), never handler-failed or bad JSON.
      if (e && e.statusCode === 413) return send(413, { ok: false, code: 'too-big', error: 'too big: more than ' + require('./limits').BODY_MAX + ' bytes', verb: name });
      if (e instanceof SyntaxError) return send(400, { ok: false, code: 'bad-request', error: 'Invalid JSON body', verb: name });
      send(500, { ok: false, code: 'handler-failed', error: 'the handler failed', verb: name });
    });
  };
}

module.exports = { createVerbTable: createVerbTable };
