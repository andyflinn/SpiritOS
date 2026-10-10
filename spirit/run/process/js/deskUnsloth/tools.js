'use strict';

// spirit/run/process/js/deskUnsloth/tools.js
// THE MODEL'S TOOLS, FROM THE NODE'S OWN DESCRIPTION OF ITS VERBS (goal/G14.6).
//
//   Andy, 2026-10-10: "now we have a uniform api introspection, now we want a tool that expands Levant's
//   knowledge, our proxy internet call...."; "we decided a while back that the conversion belongs to deskUnsloth.";
//   "so we build one object for now: it has two main methods: 1 convert node-style introspection to OpenAI style
//   tool description 2 execute tool when model asks"; "so we need to map the tool-name to your verb-call, and that
//   should now be a generic thing."
//
// ONE OBJECT, TWO METHODS, NO PER-TOOL CODE.
//
//   describe(namespace)  the OpenAI tools of one namespace: ns.AGENTS.introspect lists the verbs the owner
//                        described with a file (introSpector.js, goal/G10.5), ns.AGENTS.<verb> gives each file
//                        with request and reply filled in from the declaration as prototypes by example. One tool
//                        per verb: name = the verb with its dot written as an underscore (OpenAI allows letters,
//                        digits, underscore and dash in a tool name), description = the file's, parameters = a
//                        JSON Schema object with one property per request key, typed by its example. Nothing
//                        listed, no tools: the model has exactly the tools the owner described.
//   run(call)            one tool call of the model, generic: the name read back to the verb, the node asked that
//                        verb with the model's arguments (declared keys only), and the answer handed back as text
//                        the model can read: a page stripped of its tags, scripts and styles, cut to the room with
//                        the cut said; a refusal (the proxy closed by the owner, a bad url, no such verb) in the
//                        node's words, so the model says so instead of guessing. A name describe never listed is
//                        refused here and never reaches the node.
//
// The node is reached through the `ask` the caller hands in (spirit.core.ask on the process's own node), so this
// file knows no port and no door; a test hands a fake.

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

function createTools(opts) {
  const o = opts || {};
  const ask = o.ask;
  // The room may follow the studio (contextLimit "auto", goal/G14.6), so a function is taken as well as a number.
  const room = function () {
    const r = typeof o.room === 'function' ? o.room() : o.room;
    return Number(r) > 0 ? Number(r) : 4096;
  };
  if (typeof ask !== 'function') throw new Error('tools: an ask of the node is required');
  let known = Object.create(null);   // tool name -> { verb, request }

  function describe(namespace) {
    const ns = String(namespace || '');
    return ask(ns + '.AGENTS.introspect', {}).then(function (r) {
      const items = r && r.body && Array.isArray(r.body.items) ? r.body.items : [];
      const listed = Object.create(null);
      return items.reduce(function (chain, item) {
        return chain.then(function (tools) {
          const verb = String((item && item.key) || '');
          if (!verb || verb.indexOf(ns + '.') !== 0) return tools;
          const stem = verb.slice(ns.length + 1);
          return ask(ns + '.AGENTS.' + stem, {}).then(function (f) {
            const file = f && isPlain(f.body) ? f.body : {};
            const description = String(file.description || item.label || '');
            const request = isPlain(file.request) ? file.request : {};
            const properties = {};
            Object.keys(request).forEach(function (k) { properties[k] = propertyOf(request[k]); });
            const name = toolName(verb);
            listed[name] = { verb: verb, request: request };
            tools.push({ type: 'function', function: { name: name, description: description, parameters: { type: 'object', properties: properties, required: [] } } });
            return tools;
          }, function () { return tools; });
        });
      }, Promise.resolve([])).then(function (tools) {
        known = listed;
        return tools;
      });
    });
  }

  function argumentsOf(call) {
    const raw = call && call.function && call.function.arguments;
    if (isPlain(raw)) return raw;
    try { const parsed = JSON.parse(String(raw || '{}')); return isPlain(parsed) ? parsed : {}; } catch (e) { return {}; }
  }

  function run(call) {
    const id = String((call && call.id) || '');
    const name = String((call && call.function && call.function.name) || '');
    const k = known[name];
    if (!k) return Promise.resolve({ id: id, name: name, text: name + ' is not a tool this node described (not listed)' });
    const given = argumentsOf(call);
    const args = {};
    Object.keys(k.request).forEach(function (key) { if (key in given) args[key] = given[key]; });
    return ask(k.verb, args).then(function (r) {
      const body = r && r.body;
      let text;
      if (!r || r.status >= 400 || (isPlain(body) && (body.ok === false || typeof body.error === 'string'))) {
        text = 'the node refused: ' + ((isPlain(body) && (body.error || body.code)) || ('status ' + (r && r.status)));
      } else if (isPlain(body) || Array.isArray(body)) {
        text = JSON.stringify(body);
      } else {
        text = textOf(r && r.text || '');
      }
      return { id: id, name: name, text: cutTo(text, room()) };
    }, function (e) {
      return { id: id, name: name, text: 'the node could not be asked: ' + ((e && e.message) || e) };
    });
  }

  return { describe: describe, run: run, toolName: toolName, textOf: textOf, cutTo: cutTo };
}

module.exports = { createTools: createTools, toolName: toolName, textOf: textOf, cutTo: cutTo, propertyOf: propertyOf };
