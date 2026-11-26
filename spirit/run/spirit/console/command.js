'use strict';
// spirit/run/spirit/console/command.js
// THE CONSOLE'S COMMAND PROCESSOR (goal/G48.2, the box: "the script run://spirit/console/command.js will be the consoles
// command processor"). It is handed one line and answers what to print; the console's state, its path and its history, it
// keeps itself in spirit/state/console/node.json (the box: "the state of the console is kept in
// run://spirit/state/console/node.json ... the current navigation path of the console and a 256 rolling command history";
// Andy: "console can read state itself, it's an intrinsic part of SpiritOS."). Anything else of the tree it reaches only
// through the node's verbs (Andy: "the only way it can access files inside of run:// is through the node api's"): whether
// a path is there, it asks the node's fs stat.
//
//   run(line) -> Promise<{ ok, out, path, exit?, printed? }>   out what to print (a refusal as JSON), path the path after
//                                             the line ('' at the root); exit the code to end with when it is not 0 or 1
//                                             (a wait timed out), printed() to call once out is printed (a wait's pointer)
//   state()   -> { path, history }            as the state file holds it now
//
/// ITS COMMANDS: path (goal/G48.2, the box, ### behavior), and api (goal/G48.3, below run's helpers).
// path:
//   path          shows the path stored in state
//   path <        to the parent; refused at the root
//   path <<       to the root, where the prompt is "spirit: "; refused at the root
//   path <name>   a name or a dot sequence, always the state's path plus the asked one, refused (path kept) unless that is
//                 a folder inside run://spirit/
// Each line that moved the path is logged as if typed at the root, "path app.agent" (the box: "logs the command as path
// app.agent"); the root itself as "path <<". The newest 256 are kept.
require('../script.js');
const fs = require('fs');
const path = require('path');

const RUN = path.resolve(__dirname, '..', '..');
const STATE = path.join(RUN, 'spirit', 'state', 'console', 'node.json');
const HISTORY_MAX = 256;
const NAME = /^[A-Za-z0-9_-]+$/;

// THE WAIT'S STATE BESIDE THE PATH AND THE HISTORY (goal/G48.6, the box: "the console's state keeps path, history, waits,
// the timeout and the log's read-pointer"): waits the configured wait-rows as stored, timeout in seconds, since the time
// (at) of the last log row read, '' before the first wait.
const WAIT_TIMEOUT_DEFAULT = 600;
function state() {
  let s = null;
  try { s = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) { s = null; }
  const p = s && typeof s.path === 'string' ? s.path : '';
  const h = s && Array.isArray(s.history) ? s.history.filter(function (l) { return typeof l === 'string'; }) : [];
  const w = s && Array.isArray(s.waits) ? s.waits.filter(function (l) { return typeof l === 'string' && l; }) : [];
  const t = s && Number.isInteger(s.timeout) && s.timeout > 0 ? s.timeout : WAIT_TIMEOUT_DEFAULT;
  const since = s && typeof s.since === 'string' ? s.since : '';
  return { path: p, history: h.slice(-HISTORY_MAX), waits: w, timeout: t, since: since };
}
function save(s) {
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify({ path: s.path, history: s.history.slice(-HISTORY_MAX), waits: s.waits || [],
    timeout: s.timeout || WAIT_TIMEOUT_DEFAULT, since: s.since || '' }, null, 2));
}
function shown(p) { return p ? 'spirit.' + p : 'spirit'; }

// Whether spirit/<the path's folders> is there, as the node's fs stat answers.
function there(p) {
  return spirit.requireScript('spirit/fs/script.js').then(function (f) { return f.stat({ path: spirit.slashedPath('spirit.' + p) }); })
    .then(function () { return true; }, function () { return false; });
}

// A REFUSAL, PRINTED AS JSON (the box v12: "errors are return in JSON.stringify(error,null,2) format."): the node's own
// refusal shape, { ok: false, code, error }, and the path left as it was.
function refused(s, code, why) { return { ok: false, out: JSON.stringify({ ok: false, code: code, error: why }, null, 2), path: s.path }; }
// EVERY SUCCESSFUL COMMAND LOGGED (Andy: "a successfully run command must be logged in state and be available for re-use
// with the up-key on the keyboad, the up key isn't for navigation only, it's for every command that is successful."), as
// if typed from the root: a command run at a path is logged with that path ahead of it, "node card", "app.desk api"; a
// refused one is not logged.
function logged(s, line) {
  const l = String(line || '').trim();
  s.history.push(s.path ? s.path + ' ' + l : l);
  save(s);
}
function moved(s, to) {
  s.path = to;
  s.history.push(to ? 'path ' + to : 'path <<');
  save(s);
  return { ok: true, out: shown(to), path: to };
}

function pathCommand(s, arg) {
  if (!arg) return Promise.resolve({ ok: true, out: shown(s.path), path: s.path });
  if (arg === '<' || arg === '<<') {
    if (!s.path) return Promise.resolve(refused(s, 'at-the-root', 'already at the root: spirit'));
    return Promise.resolve(moved(s, arg === '<<' ? '' : s.path.split('.').slice(0, -1).join('.')));
  }
  const asked = arg.split('.');
  if (!asked.every(function (n) { return NAME.test(n); })) return Promise.resolve(refused(s, 'no-such-path', 'no such path: ' + arg));
  const to = (s.path ? s.path + '.' : '') + asked.join('.');
  return there(to).then(function (yes) { return yes ? moved(s, to) : refused(s, 'no-such-path', 'no such path: ' + shown(to)); });
}

// THE api COMMAND (goal/G48.3, the box: "if I'm at a branch folder, this command without arguments lists all verbs, in
// simple json format, sorted by name", "if there's no branch's api.js it returns a json error", "if the api command names
// a verb: it returns that verbs command-line-format in json, human and machine readable, with a field \"usage\" at the very
// bottom"; Andy: "the console command: \"api search\" will return a JSON.stringify(search,null,2) desription"). The branch
// at the path is spirit/<its folders>/api.js, asked whether it is there through the node's fs stat and loaded through
// spirit.requireScript; its verbs are its own verbs table. One verb is its <verb>.json as the node's fs load serves it, with usage
/// added last: the line a person types, each argument a placeholder named by its rule in the branch's own verbs table, an
// optional one in brackets.
function apiFile(p) { return spirit.slashedPath('spirit.' + p) + '/api.js'; }
// THE BRANCH'S api.js AT A PATH, or null: its verbs, and the functions it may name for them (spirit.js, def.functions).
function apiAt(p) {
  if (!p) return Promise.resolve(null);
  const file = apiFile(p);
  return spirit.requireScript('spirit/fs/script.js').then(function (f) { return f.stat({ path: file }); }).then(function () {
    spirit.requireScript(file);
    const at = file.replace(/\.js$/, '').split('/').reduce(function (o, k) { return o && o[k]; }, spirit.required);
    return at && at.verbs && typeof at.verbs === 'object' ? at : null;
  }, function () { return null; });
}
// EVERY SERVER'S AUTO-VERBS (wsl, on goal/G48.8: "the console lists only api.js verbs, so the auto-verb remote cannot be
// called from it"): remote and DEBUG, which spirit.js binds by hand on every branch and no api.js lists (spirit/server/app/script.js
// serves them on every app server, goal/G47.5 and desk/G2.5), offered beside the api.js verbs of an app's branch when the
// app has a server, and only then (wsl's rule 8 of app-child-general: "the auto-verbs only where the manifest says
// node.mount"): its spirit/app/<name>/<name>.json, read through the node's fs as everything of the tree is.
const AUTO_VERBS = { remote: { id: 'spirit/type/string/ID/script.js?' }, DEBUG: { on: 'spirit/type/boolean/script.js?' } };
function served(p) {
  const m = /^app\.([A-Za-z0-9_-]+)$/.exec(p);
  if (!m) return Promise.resolve(false);
  // Its folder by spirit.slashedPath of the whole path (goal/G49.19), its manifest its own name's .json.
  const file = spirit.slashedPath('spirit.' + p) + '/' + m[1] + '.json';
  return spirit.requireScript('spirit/fs/script.js').then(function (f) { return f.load({ path: file }); }).then(function (r) {
    let manifest = null;
    try { manifest = JSON.parse(String((r && r.text) || '')); } catch (e) { manifest = null; }
    return !!(manifest && manifest.node && manifest.node.mount === true);
  }, function () { return false; });
}
function verbsAt(p) {
  return apiAt(p).then(function (at) {
    if (!at) return null;
    return served(p).then(function (yes) { return yes ? Object.assign({}, AUTO_VERBS, at.verbs) : at.verbs; });
  });
}
function usageOf(verb, request) {
  return [verb].concat(Object.keys(request || {}).map(function (k) {
    const rule = String(request[k]);
    const one = k + '=<' + rule.replace(/\?$/, '') + '>';
    return /\?$/.test(rule) ? '[' + one + ']' : one;
  })).join(' ');
}
function apiCommand(s, verb, line) {
  return verbsAt(s.path).then(function (verbs) {
    if (!verbs) return refused(s, 'no-branch', 'no branch here: ' + shown(s.path) + ' has no api.js');
    if (!verb) { logged(s, line); return { ok: true, out: JSON.stringify(Object.keys(verbs).sort(), null, 2), path: s.path }; }
    if (!Object.prototype.hasOwnProperty.call(verbs, verb)) return refused(s, 'no-such-verb', 'no such verb at ' + shown(s.path) + ': ' + verb);
    const file = spirit.slashedPath('spirit.' + s.path) + '/' + verb + '.json';
    return spirit.requireScript('spirit/fs/script.js').then(function (f) { return f.load({ path: file }); }).then(function (r) {
      const j = JSON.parse(String((r && r.text) || ''));
      const out = Object.assign({}, j, { usage: usageOf(verb, verbs[verb]) });
      logged(s, line);
      return { ok: true, out: JSON.stringify(out, null, 2), path: s.path };
    }, function () { return refused(s, 'no-such-verb', 'no description of ' + verb + ' at ' + shown(s.path)); });
  });
}

// A LINE IN WORDS (goal/G48.3, the box, ## typing values: "a value with a space in it is put in double quotes"): split at
// the spaces outside double quotes; a word or a value wholly in quotes (text="hello all") has them taken off, while a
// value with quotes inside it, JSON like debug={"on":true}, keeps them. null when a quote is left open.
function wordsOf(line) {
  const text = String(line || '');
  const out = [];
  let word = '';
  let open = false;
  // A DOUBLE QUOTE OR A BACKSLASH IN A VALUE (Andy: "cw, fix the console. push it"): typed \" and \\, each kept as itself
  // and toggling nothing; held as a mark while the line is split and a value's outer quotes come off, then put back.
  for (let i = 0; i < text.length; i++) {
    const c = text.charAt(i);
    const next = text.charAt(i + 1);
    if (c === '\\' && (next === '"' || next === '\\')) { word += next === '"' ? ESC_QUOTE : ESC_SLASH; i++; continue; }
    if (c === '"') open = !open;
    if (!open && /\s/.test(c)) { if (word) out.push(word); word = ''; continue; }
    word += c;
  }
  if (open) return null;
  if (word) out.push(word);
  return out.map(function (w) {
    const eq = w.indexOf('=');
    const name = eq > 0 && w.charAt(0) !== '"' ? w.slice(0, eq + 1) : '';
    const value = w.slice(name.length);
    return (name + (/^"[^"]*"$/.test(value) ? value.slice(1, -1) : value)).split(ESC_QUOTE).join('"').split(ESC_SLASH).join('\\');
  });
}
const ESC_QUOTE = '\u0000q';
const ESC_SLASH = '\u0000s';
// A VALUE AS ITS ARGUMENT'S RULE SAYS (the box: "a value is read as its argument's rule in the verb's own file says: a number
// argument as a number, a yes/no argument as true or false, a list or object argument as JSON"); anything else as typed.
// The rules are type paths since goal/G48.4 (each argument of its api.js names its type by its full path, spirit.type.<...>):
// spirit.type.number.* a number, spirit.type.boolean true or false, spirit.type.object.* JSON. A list is spirit.type.string.json,
// a string of JSON, so it goes as typed.
function valueOf(rule, text) {
  const r = String(rule || '').replace(/\?$/, '');
  if (r.indexOf('spirit/type/number/') === 0) return text.trim() === '' ? text : Number(text);
  if (r === 'spirit/type/boolean/script.js') return text === 'true' ? true : text === 'false' ? false : text;
  if (r.indexOf('spirit/type/object/') === 0) { try { return JSON.parse(text); } catch (e) { return text; } }
  return text;
}
// EXECUTING A VERB (the box, ## executing verbs: "at a branch, a line typed as its usage shows ... executes that verb, and
// the console shows the json it returns, as JSON.stringify(answer,null,2)", "a verb the node refuses shows that refusal as
// a json error"): the branch bound through spirit.requireScript, the verb asked with the arguments typed name=value.
function verbCommand(s, verbs, words, line) {
  const verb = words[0];
  const rules = verbs[verb] || {};
  const args = {};
  for (let i = 1; i < words.length; i++) {
    const eq = words[i].indexOf('=');
    if (eq < 1) return Promise.resolve(refused(s, 'bad-argument', 'not name=value: ' + words[i]));
    const name = words[i].slice(0, eq);
    if (!Object.prototype.hasOwnProperty.call(rules, name)) return Promise.resolve(refused(s, 'no-such-argument', verb + ' has no argument ' + name));
    args[name] = valueOf(rules[name], words[i].slice(eq + 1));
  }
  // THE FUNCTION THAT IMPLEMENTS THE VERB (goal/G43.7; Andy: "spirit.required.spirit.app.api.searchApp() which IMPLEMENTS the verb search, but
  // isn't the verb itself."): the name the branch's api.js gives it (functions), else the verb itself, as spirit.js binds it.
  return apiAt(s.path).then(function (at) {
    const named = at && at.functions && typeof at.functions[verb] === 'string' ? at.functions[verb] : verb;
    return Promise.resolve(spirit.requireScript(apiFile(s.path))).then(function (branch) { return branch[named](args); });
  }).then(function (answer) {
    logged(s, line);
    return { ok: true, out: JSON.stringify(answer === undefined ? null : answer, null, 2), path: s.path };
  }, function (e) {
    const body = e && e.body && typeof e.body === 'object' && !Array.isArray(e.body) && Object.keys(e.body).length ? e.body : { ok: false, code: (e && e.code) || 'refused', error: (e && e.message) || String(e) };
    return { ok: false, out: JSON.stringify(body, null, 2), path: s.path };
  });
}

// ── THE WAIT (goal/G48.6, the box v10) ──────────────────────────────────────────────────────────────────────────────
// Andy: "an array of wait events will be maintained in spirit/state/console/node.json, with the following special console
// commands: wait, wait add <event-description>, wait remove <event-description-string>"; "console MUST ALSO NOT BE APP
// SPECIFIC IN ANY WAY". It reads node.db's log through its one reader, arrivals of spirit/trafficLog/script.js (delivered inbound
// rows only, so an agent's own calls never wake it), opens each row's envelope with envelopeOf of spirit/arrivals/script.js and a
// listener's bundle with unpack of spirit/streamBundle/script.js (goal/G48.7), and calls no verb of any branch.
//   wait                       blocks until a wait-row matches or the timeout passes: a match prints one JSON line per row
//                              with its wait-row and ends 0, a timeout says nothing came and ends WAIT_TIMED_OUT, no
//                              wait-row is refused; one wait at a time on a node
//   wait add api=<branch>.<verb> [<field>=<value> ...]    a wait-row, stored as typed
//   wait remove <the stored string>                       takes it out
//   wait list                  the configured wait-rows
//   wait timeout <seconds>     the timeout, kept in state
const WAIT_TIMED_OUT = 3;
const WAIT_POLL_MS = 500;
const WAIT_READ_MAX = 500;
const WAIT_LOCK = path.join(RUN, 'spirit', 'state', 'console', 'wait.pid');

// A wait-row as words: { branch, verb, filters: [[field, value]] }, or null when it is no api=<branch>.<verb> first.
function waitRowOf(text) {
  const words = wordsOf(text);
  if (!words || !words.length) return null;
  const m = /^api=([A-Za-z]\w*)\.(\S+)$/.exec(words[0]);
  if (!m) return null;
  const filters = [];
  for (let i = 1; i < words.length; i++) {
    const eq = words[i].indexOf('=');
    if (eq < 1) return null;
    filters.push([words[i].slice(0, eq), words[i].slice(eq + 1)]);
  }
  return { branch: m[1], verb: m[2], filters: filters };
}
// A field of an object by its name, a dotted name reaching inside.
function fieldOf(o, name) { return String(name).split('.').reduce(function (v, k) { return v !== null && typeof v === 'object' ? v[k] : undefined; }, o); }
function matches(o, filters) {
  return filters.every(function (f) { const v = fieldOf(o, f[0]); return v !== undefined && v !== null && String(typeof v === 'object' ? JSON.stringify(v) : v) === f[1]; });
}
// What of one log row a wait-row matches: the call's arguments, or for a listener's bundle each entry's row.
function matchesOf(row, rows) {
  const env = spirit.requireScript('spirit/arrivals/script.js').envelopeOf(String(row.payload || ''));
  if (!env || !env.body || typeof env.body !== 'object') return [];
  const out = [];
  rows.forEach(function (text) {
    const w = waitRowOf(text);
    const call = w && env.body[w.branch] && typeof env.body[w.branch] === 'object' ? env.body[w.branch][w.verb] : undefined;
    if (call === undefined) return;
    const args = call && typeof call === 'object' ? call : {};
    const base = { wait: text, at: row.at, peer: row.peer || '', app: env.app, api: w.branch + '.' + w.verb };
    if (w.verb === 'listener' && typeof args.json === 'string') {
      (spirit.requireScript('spirit/streamBundle/script.js').unpack(args.json) || []).forEach(function (e) {
        if (matches(e.row || {}, w.filters)) out.push(Object.assign({ entry: e }, base));
      });
    } else if (matches(args, w.filters)) out.push(Object.assign({ args: args }, base));
  });
  return out;
}
function liveLock() {
  let pid = 0;
  try { pid = Number(fs.readFileSync(WAIT_LOCK, 'utf8')); } catch (e) { pid = 0; }
  if (!(pid > 0) || pid === process.pid) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return false; }
}
function waitCommand(s, words, line) {
  const sub = words[0] || '';
  if (sub === 'list' && words.length === 1) { logged(s, line); return Promise.resolve({ ok: true, out: JSON.stringify(s.waits, null, 2), path: s.path }); }
  if (sub === 'timeout') {
    const n = Number(words[1]);
    if (words.length !== 2 || !Number.isInteger(n) || n <= 0) return Promise.resolve(refused(s, 'bad-argument', 'wait timeout <seconds>, a whole number above 0'));
    s.timeout = n; logged(s, line);
    return Promise.resolve({ ok: true, out: JSON.stringify({ timeout: n }, null, 2), path: s.path });
  }
  if (sub === 'add' || sub === 'remove') {
    const text = words.slice(1).join(' ');
    if (sub === 'add') {
      if (!waitRowOf(text)) return Promise.resolve(refused(s, 'bad-argument', 'wait add api=<branch>.<verb> [<field>=<value> ...]'));
      if (s.waits.indexOf(text) !== -1) return Promise.resolve(refused(s, 'already-there', 'already a wait-row: ' + text));
      s.waits.push(text);
    } else {
      const at = s.waits.indexOf(text);
      if (at === -1) return Promise.resolve(refused(s, 'no-such-wait', 'no such wait-row: ' + text));
      s.waits.splice(at, 1);
    }
    logged(s, line);
    return Promise.resolve({ ok: true, out: JSON.stringify(s.waits, null, 2), path: s.path });
  }
  if (sub) return Promise.resolve(refused(s, 'no-such-command', 'no such command: wait ' + words.join(' ')));
  if (!s.waits.length) return Promise.resolve(refused(s, 'no-waits', 'no wait-row is configured: wait add api=<branch>.<verb> first'));
  if (liveLock()) return Promise.resolve(refused(s, 'already-waiting', 'a wait already runs on this node'));
  fs.mkdirSync(path.dirname(WAIT_LOCK), { recursive: true });
  fs.writeFileSync(WAIT_LOCK, String(process.pid));
  const unlock = function () { try { if (Number(fs.readFileSync(WAIT_LOCK, 'utf8')) === process.pid) fs.unlinkSync(WAIT_LOCK); } catch (e) { /* gone */ } };
  process.once('exit', unlock);
  const log = spirit.requireScript('spirit/trafficLog/script.js').createTrafficLog({ rootDir: RUN });
  // THE FIRST WAIT STARTS AT THE NEWEST ROW (the box): with no pointer, now.
  if (!s.since) { s.since = new Date().toISOString(); save(s); }
  const deadline = Date.now() + s.timeout * 1000;
  const notes = [];
  // Rows shed under the pointer (the box: "when the pointer is older than the oldest row left, the wait says rows were shed").
  const oldest = (log.arrivals({ limit: 1 }) || [])[0];
  if (oldest && Date.parse(oldest.at) > Date.parse(s.since)) notes.push({ shed: true, since: s.since, oldest: oldest.at });
  // A WAIT WRITES ITS POINTER ALONE (the wait-rows changed while it ran stay as they were changed): the state is read
  // again when the pointer is written, and only since, and the history line once something matched, change in it.
  const movePointer = function (since, withLine) {
    const now = state();
    now.since = since;
    if (withLine) logged(now, line); else save(now);
  };
  return new Promise(function (resolve) {
    function look() {
      let rows = [];
      try { rows = log.arrivals({ since: s.since, limit: WAIT_READ_MAX }) || []; } catch (e) { rows = []; }
      // The wait-rows as they stand now, so one added or removed while this wait runs counts from its next look.
      const waits = state().waits;
      let found = [];
      rows.forEach(function (row) { found = found.concat(matchesOf(row, waits)); });
      // The pointer moves to the last row read, matched or not, and is written once what matched is printed.
      if (rows.length) {
        const out = notes.concat(found).map(function (o) { return JSON.stringify(o); }).join('\n');
        s.since = rows[rows.length - 1].at;
        const since = s.since;
        if (found.length) { unlock(); resolve({ ok: true, out: out, path: s.path, printed: function () { movePointer(since, true); } }); return; }
        movePointer(since, false);
        if (rows.length >= WAIT_READ_MAX) { setImmediate(look); return; }
      }
      if (Date.now() >= deadline) {
        unlock();
        resolve({ ok: false, exit: WAIT_TIMED_OUT, out: notes.concat([{ timeout: s.timeout, nothing: true }]).map(function (o) { return JSON.stringify(o); }).join('\n'), path: s.path });
        return;
      }
      setTimeout(look, WAIT_POLL_MS);
    }
    look();
  });
}

function run(line) {
  const words = wordsOf(line);
  const s = state();
  if (words === null) return Promise.resolve(refused(s, 'open-quote', 'a quote is left open: ' + String(line).trim()));
  if (!words.length) return Promise.resolve({ ok: true, out: '', path: s.path });
  if (words[0] === 'path' && words.length <= 2) return pathCommand(s, words[1] || '');
  if (words[0] === 'api' && words.length <= 2) return apiCommand(s, words[1] || '', line);
  if (words[0] === 'wait') return waitCommand(s, words.slice(1), line);
  // A verb of the branch at the path, typed with its arguments.
  return verbsAt(s.path).then(function (verbs) {
    if (verbs && Object.prototype.hasOwnProperty.call(verbs, words[0])) return verbCommand(s, verbs, words, line);
    return refused(s, 'no-such-command', 'no such command: ' + words.join(' '));
  });
}

module.exports = { run: run, state: state, verbsAt: verbsAt, HISTORY_MAX: HISTORY_MAX };
