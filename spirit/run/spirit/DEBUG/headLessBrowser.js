// spirit/run/spirit/DEBUG/headLessBrowser.js
// THE BARE MOUNT PAGE OF ONE MODULE (goal/G41.19, ../test/DEBUG.md), replacing shell/mount.html. Andy: "the response will
// be the most minimal web page, NO COMMENTS, NOTHING with a script tag <script src="/spirit.js"> and the most minimal
// mount for armingButton.js, configured, if neccessary, and depending on test type by a file
// ./shell/js/test/armingButton-headLessBrowser.json". Its first user is the shell's general rules
// (shell/test/boot-sibling-generalRules.md).
//
// The page loads /spirit.js, then the module through spirit.require, alone (rule/26). An app (it calls
// spirit.shell.activateApp) is mounted into the box with an api as the face gives one (shell/boot.js apiFor). An element
// mounts by itself, with no file (Andy, box v17: "a mount test or any other test type only needs a manifest for special
// cases"): the page creates the one element with a create that the file's own code put on spirit.elements, known by the
// script running as it is set, so the elements its parts register are not taken for it; none, or more than one, fails
// and says what it found. A special case is made as its JSON says, { create, options }, written into the page: JSON
// holds no function, so in the options { "answers": X } is a function answering X, and { "page": "api" } is the page's
// api. /shell.css is the shell's one
// sheet, a link and not a script. What happened is on window.spiritMount: { state: loading | mounted | failed, error,
// box, destroy }.
'use strict';

const fs = require('fs');
const path = require('path');

// The page's script, as the page carries it: no comments, nothing named but what it mounts.
function mountScript(file, needs, how) {
  return '(function () {\n' +
    'var box = document.getElementById("mount-box");\n' +
    'var report = window.spiritMount = { state: "loading", error: "", box: box, destroy: null };\n' +
    'function failed(e) { report.state = "failed"; report.error = String((e && e.message) || e || "failed"); }\n' +
    'var file = ' + JSON.stringify(file) + ';\n' +
    'var own = [];\n' +
    'var plain = (window.spirit = window.spirit || {}).elements || {};\n' +
    'function running() { var s = document.currentScript; var m = s && /\\/\\/# sourceURL=(\\S+)\\s*$/.exec(s.textContent || ""); return m ? m[1] : ""; }\n' +
    'function noted(k) { if (running() === file && own.indexOf(k) === -1) own.push(k); }\n' +
    'var E = window.spirit.elements = new Proxy(plain, {\n' +
    '  set: function (t, k, v) { noted(k); t[k] = v; return true; },\n' +
    '  defineProperty: function (t, k, d) { noted(k); Object.defineProperty(t, k, d); return true; }\n' +
    '});\n' +
    'function ask(verb, args) {\n' +
    '  var name = String(verb); var dot = name.indexOf(".");\n' +
    '  var fam = dot > 0 ? spirit[name.slice(0, dot)] : null;\n' +
    '  var fn = fam && typeof fam[name.slice(dot + 1)] === "function" ? fam[name.slice(dot + 1)] : null;\n' +
    '  if (!fn) return Promise.resolve({ status: 400, text: "", body: { ok: false, code: "no-such-verb", error: "no verb " + name } });\n' +
    '  return spirit.outcome(fn(args || {})).then(function (o) { return { status: o.status, text: o.body == null ? "" : JSON.stringify(o.body), body: o.body }; });\n' +
    '}\n' +
    'var api = {\n' +
    '  escapeHtml: spirit.escapeHtml, verb: ask,\n' +
    '  launchApp: function () {}, callDialog: function () { return Promise.resolve(); }, closeDialog: function () {},\n' +
    '  setScreenTitle: function () {}, setScreenMark: function () {}, addTitlebarLink: function () {},\n' +
    '  armUntilElsewhere: function () {}, isVisible: function () { return true; },\n' +
    '  onJobs: function () { return function () {}; }, onFiles: function () { return function () {}; }, onRelayEvent: function () { return function () {}; },\n' +
    '  ui: { elements: E }\n' +
    '};\n' +
    'var app = null;\n' +
    '(spirit.shell = spirit.shell || {}).activateApp = function (behavior) { app = behavior; };\n' +
    'var needs = ' + JSON.stringify(needs) + ';\n' +
    'var how = ' + how + ';\n' +
    'function made(v) {\n' +
    '  if (Array.isArray(v)) return v.map(made);\n' +
    '  if (!v || typeof v !== "object") return v;\n' +
    '  var keys = Object.keys(v);\n' +
    '  if (keys.length === 1 && keys[0] === "answers") { var x = v.answers; return function () { return Promise.resolve(x); }; }\n' +
    '  if (keys.length === 1 && keys[0] === "page" && v.page === "api") return api;\n' +
    '  var out = {}; keys.forEach(function (k) { out[k] = made(v[k]); }); return out;\n' +
    '}\n' +
    'Promise.resolve(spirit.start()).then(function () { return spirit.require(file); }).then(function () {\n' +
    '  if (app && typeof app.mount === "function") {\n' +
    '    app.mount(box, api);\n' +
    '    if (typeof app.render === "function") app.render();\n' +
    '    report.state = "mounted";\n' +
    '    return;\n' +
    '  }\n' +
    '  var el = null; var options = {};\n' +
    '  if (how) {\n' +
    '    el = how.create ? E[how.create] : null;\n' +
    '    if (!el || typeof el.create !== "function") throw new Error(needs + " names no element to create: " + how.create);\n' +
    '    options = made(how.options || {});\n' +
    '  } else {\n' +
    '    var made2 = own.filter(function (k) { return E[k] && typeof E[k].create === "function"; });\n' +
    '    if (made2.length !== 1) throw new Error(file + (made2.length ? " registers more than one element: " + made2.join(", ") : " registers no element with a create" + (own.length ? "; it registers " + own.join(", ") : "")));\n' +
    '    el = E[made2[0]];\n' +
    '  }\n' +
    '  return Promise.resolve(el.create(box, options)).then(function (m) {\n' +
    '    if (m && typeof m.destroy === "function") report.destroy = function () { return m.destroy(); };\n' +
    '    report.state = "mounted";\n' +
    '  });\n' +
    '}).then(null, failed);\n' +
    '}());';
}

// A module's special needs for this generator sit beside its tests: <folder>/test/<module>-headLessBrowser.json.
function make(o) {
  const slash = o.module.lastIndexOf('/');
  const folder = slash === -1 ? '' : o.module.slice(0, slash);
  const name = o.module.slice(slash + 1);
  const needs = (folder ? folder + '/' : '') + 'test/' + name + '-headLessBrowser.json';
  if (o.ext !== 'html') return Promise.resolve(null);
  let how = 'null';
  try { how = JSON.stringify(JSON.parse(fs.readFileSync(path.join(o.run, needs), 'utf8'))); } catch (e) { how = 'null'; }
  // Nothing the JSON holds can end the page's script: its "<" is written as the escape, inside its strings.
  const script = mountScript(o.module + '.js', needs, how.replace(/</g, '\\u003c'));
  const body = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>' + name + '</title>\n' +
    '<link rel="stylesheet" href="/shell.css" />\n' +
    '<style>html, body { height: 100%; margin: 0; } body { display: flex; flex-direction: column; }</style>\n' +
    '</head>\n<body>\n<div id="mount-box" class="fill"></div>\n<script src="/spirit.js"></script>\n<script>\n' + script + '\n</script>\n</body>\n</html>\n';
  return Promise.resolve({ type: 'text/html; charset=utf-8', body: body });
}

module.exports = { make: make };
