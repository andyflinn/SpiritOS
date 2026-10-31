'use strict';

// spirit/run/process/js/deskAgent/tools.js
// THE MODEL'S TOOLS, FROM THE NODE'S AND THE DESK'S OWN DESCRIPTION OF THEIR VERBS (goal/G14.6, goal/G14.7).
//
//   Andy, 2026-10-10: "now we have a uniform api introspection, now we want a tool that expands Levant's
//   knowledge, our proxy internet call...."; "we decided a while back that the conversion belongs to deskAgent.";
//   "so we build one object for now: it has two main methods: 1 convert node-style introspection to OpenAI style
//   tool description 2 execute tool when model asks"; "so we need to map the tool-name to your verb-call, and that
//   should now be a generic thing."; and on the desk (goal/G14.7): "Levant is restricted by the tools we give him."
//
// ONE OBJECT, TWO METHODS, NO PER-TOOL CODE.
//
//   describe(namespace)  the OpenAI tools of one namespace: its verbs from the verb table (or, where a route holds
//                        no table, the folder's FS.search), each verb's file by FS.loadJsonValue (goal/G30.4). One
//                        tool per verb: name = namespace and verb with every dot written as an underscore (OpenAI
//                        allows letters, digits, underscore and dash in a tool name), description = the file's,
//                        parameters = a JSON Schema object with one property per request key, typed by its example.
//                        Nothing listed, no tools: the model has exactly the tools the owner described.
//   run(call)            one tool call of the model, generic: the name read back to the namespace and verb, that
//                        namespace's route asked with the model's arguments (declared keys only), and the answer
//                        handed back as text the model can read: a page stripped of its tags, scripts and styles,
//                        cut to the room with the cut said; a json answer as json; a refusal (the proxy closed by
//                        the owner, no such item, a rule of the desk) in the answerer's words, so the model says so
//                        instead of guessing. A name describe never listed is refused here and reaches nothing.
//
// THE ROUTES (goal/G14.7): a namespace is reached one way and that way is the route's, not this file's: the node's
// namespaces (net) through the loopback door, the verb and its FS prefixed with the namespace, and its part of the
// flat table from the verb api; the desk through this node's deskClient.desk {name, json}, the verb bare and its FS as
// FS.<name> (a process server's family carries no prefix). A route is {ask(verb, args), verb(stem), fs(name),
// table()?}; a plain {ask} alone is the node's route for every namespace, as goal/G14.6 built it.

function isPlain(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function bytes(s) { return Buffer.byteLength(String(s), 'utf8'); }

function toolName(verb) { return String(verb).replace(/\./g, '_'); }

// A JSON Schema property from a prototype by example, as the node declares its requests.
function propertyOf(example) {
  if (typeof example === 'string') return { type: 'string' };
  if (typeof example === 'number') return { type: 'number' };
  if (typeof example === 'boolean') return { type: 'boolean' };
  if (Array.isArray(example)) return { type: 'array', items: example.length ? propertyOf(example[0]) : {} };
  if (isPlain(example)) return { type: 'object', additionalProperties: true };
  return {};
}

// THE PAGE AS TEXT: scripts and styles out whole, tags out, the few entities a page carries read, whitespace folded.
function textOf(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, '\'')
    .replace(/\s+/g, ' ')
    .trim();
}

// CUT TO THE ROOM, AND SAY SO: the model must know it saw the head of a page, not the page.
function cutTo(text, room) {
  const whole = bytes(text);
  if (whole <= room) return text;
  let cut = Math.max(0, room - 64);
  let head = text.slice(0, cut);
  while (bytes(head) > cut && head.length) head = head.slice(0, -64);
  return head + ' [cut: ' + bytes(head) + ' of ' + whole + ' bytes shown]';
}

// The node's route for a namespace: the loopback ask, the verb and its FS prefixed with the namespace, and the
// namespace's part of the flat verb table (the verb api on the flat apiDoor, goal/G30.6).
function nodeRoute(ask, ns) {
  return {
    ask: ask,
    verb: function (stem) { return ns + '.' + stem; },
    fs: function (name) { return ns + '.FS.' + name; },
    table: function () {
      return ask('api', {}).then(function (r) { return (r && r.body && isPlain(r.body[ns])) ? r.body[ns] : {}; });
    },
  };
}

function createTools(opts) {
  const o = opts || {};
  const routes = isPlain(o.routes) ? o.routes : {};
  const ask = typeof o.ask === 'function' ? o.ask : null;
  // The room follows the studio's context (goal/G14.6, goal/G10.7), so a function is taken as well as a number.
  const room = function () {
    const r = typeof o.room === 'function' ? o.room() : o.room;
    return Number(r) > 0 ? Number(r) : 4096;
  };
  if (!ask && !Object.keys(routes).length) throw new Error('tools: an ask of the node or a route is required');
  // The verbs never offered, each '<namespace>.<verb>' (goal/G24.4); none unless the caller names them.
  const withhold = Array.isArray(o.withhold) ? o.withhold.map(String) : [];
  let known = Object.create(null);   // tool name -> { route, stem, request }

  function routeOf(ns) {
    if (routes[ns] && typeof routes[ns].ask === 'function') return routes[ns];
    return ask ? nodeRoute(ask, ns) : null;
  }

  function describe(namespace) {
    const ns = String(namespace || '');
    const route = routeOf(ns);
    if (!route) return Promise.resolve([]);
    // THE VERBS, THEN THEIR FILES (goal/G30.4; Andy, 2026-10-20: "once it has the verb table there's no real reason to
    // 'introspect', the allowed verbs are known, and their verb.json file can be fetched directly from that"). A route
    // that holds the table names the verbs from it, with their request shapes; one that can only ask verbs (the desk,
    // reached through deskClient) names them from the family folder through FS.search. Each verb's file is read by
    // FS.loadJsonValue; a verb with no file is not offered, so the file stays the allow mark.
    const tableOf = typeof route.table === 'function' ? route.table() : Promise.resolve(null);
    return tableOf.then(function (table) {
      if (table) {
        return { table: table, stems: Object.keys(table).filter(function (v) { return !/^FS\./.test(v) && v !== 'DEBUG'; }) };
      }
      return route.ask(route.fs('search'), { q: '' }).then(function (r) {
        const items = r && r.body && Array.isArray(r.body.items) ? r.body.items : [];
        return { table: {}, stems: items.map(function (i) { return String((i && i.key) || ''); }).filter(function (k) { return /\.json$/.test(k); }).map(function (k) { return k.slice(0, -5); }) };
      });
    }).then(function (found) {
      const listed = Object.create(null);
      return found.stems.reduce(function (chain, stem) {
        return chain.then(function (tools) {
          if (!stem) return tools;
          // WITHHELD BEFORE ITS DETAILS ARE ASKED (goal/G24.4). Andy: "first get the list of verbs ... for the allowed
          // ones it gets the description". A verb named in withhold ('<namespace>.<verb>') is not offered, and its
          // file is never read.
          if (withhold.indexOf(ns + '.' + stem) !== -1) return tools;
          return route.ask(route.fs('loadJsonValue'), { path: stem + '.json' }).then(function (f) {
            const file = f && f.body && isPlain(f.body.value) ? f.body.value : null;
            if (!file || typeof file.description !== 'string') return tools;
            const description = file.description;
            const shape = isPlain(found.table[stem]) ? found.table[stem] : {};
            const request = isPlain(file.request) ? file.request : (isPlain(shape.request) ? shape.request : {});
            const properties = {};
            Object.keys(request).forEach(function (k) { properties[k] = propertyOf(request[k]); });
            const name = toolName(ns + '.' + stem);
            listed[name] = { route: route, stem: stem, request: request };
            // EVERY KEY REQUIRED (goal/G19.7): a process server's request is exact (appServer.matches), so a key the
            // model leaves out is a refused call; the schema says what the verb takes.
            tools.push({ type: 'function', function: { name: name, description: description, parameters: { type: 'object', properties: properties, required: Object.keys(properties) } } });
            return tools;
          }, function () { return tools; });
        });
      }, Promise.resolve([])).then(function (tools) {
        // What was known of other namespaces stays; this namespace's set is replaced.
        Object.keys(known).forEach(function (n) { if (n.indexOf(toolName(ns) + '_') === 0) delete known[n]; });
        Object.keys(listed).forEach(function (n) { known[n] = listed[n]; });
        return tools;
      });
    });
  }

  function argumentsOf(call) {
    const raw = call && call.function && call.function.arguments;
    if (isPlain(raw)) return raw;
    try { const parsed = JSON.parse(String(raw || '{}')); return isPlain(parsed) ? parsed : {}; } catch (e) { return {}; }
  }

  // `roomNow`, when given, is the room this result has in the call (goal/G19.7: results counted against the prompt
  // room); the configured room otherwise.
  function run(call, roomNow) {
    const id = String((call && call.id) || '');
    const name = String((call && call.function && call.function.name) || '');
    const k = known[name];
    if (!k) return Promise.resolve({ id: id, name: name, text: name + ' is not a tool this node described (not listed)' });
    const given = argumentsOf(call);
    const args = {};
    Object.keys(k.request).forEach(function (key) { if (key in given) args[key] = given[key]; });
    return k.route.ask(k.route.verb(k.stem), args).then(function (r) {
      const body = r && r.body;
      let text;
      // A REFUSAL IS A STATUS OR ok false (goal/G19.7): an error field in a JSON that was fetched is the data's own.
      if (!r || r.status >= 400 || (isPlain(body) && body.ok === false)) {
        const why = isPlain(body) && isPlain(body.extra) && body.extra.why ? ' (' + body.extra.why + ')' : '';
        text = 'the node refused: ' + ((isPlain(body) && (body.error || body.code)) || ('status ' + (r && r.status))) + why;
      } else if (isPlain(body) || Array.isArray(body)) {
        text = JSON.stringify(body);
      } else {
        text = textOf(r && r.text || '');
      }
      return { id: id, name: name, text: cutTo(text, Number(roomNow) > 0 ? Math.min(Number(roomNow), room()) : room()) };
    }, function (e) {
      return { id: id, name: name, text: 'the node could not be asked: ' + ((e && e.message) || e) };
    });
  }

  return { describe: describe, run: run, toolName: toolName, textOf: textOf, cutTo: cutTo };
}

module.exports = { createTools: createTools, nodeRoute: nodeRoute, toolName: toolName, textOf: textOf, cutTo: cutTo, propertyOf: propertyOf };
