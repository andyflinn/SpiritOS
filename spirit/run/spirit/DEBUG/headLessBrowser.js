// spirit/run/spirit/DEBUG/headLessBrowser.js
// THE BARE MOUNT PAGE OF ONE MODULE (goal/G41.19, ../test/DEBUG.md), replacing shell/mount.html. Andy: "the response will
// be the most minimal web page, NO COMMENTS, NOTHING with a script tag <script src="/spirit.js"> and the most minimal
// mount for armingButton.js". Its first user is the shell's general rules (shell/test/boot-sibling-generalRules.md).
//
// The page loads /spirit.js, then the module through spirit.require, alone (rule/26). An app (it calls
// spirit.shell.activateApp, or activateLogin, the face's login app) is mounted into the box with an api as the face
// gives one (shell/boot.js apiFor). An element
// is created with the box alone, no options (box v23: "no manifests at this point, because special cases can be handled
// by the elements own test script"): the one element with a create that the file's own code put on spirit.elements,
// known by the script running as it is set, so the elements its parts register are not taken for it; none, or more than
// one, fails and says what it found. /shell.css is the shell's one sheet, a link and not a script. What happened is on
// window.spiritMount: { state: loading | mounted | failed, error, box, destroy }.
'use strict';

// The page's script, as the page carries it: no comments, nothing named but what it mounts.
function mountScript(file) {
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
    '  armUntilElsewhere: function () {}, isVisible: function () { return true; }, refresh: function () {},\n' +
    '  onJobs: function () { return function () {}; }, onFiles: function () { return function () {}; }, onRelayEvent: function () { return function () {}; },\n' +
    '  ui: { elements: E }\n' +
    '};\n' +
    'var app = null;\n' +
    '(spirit.shell = spirit.shell || {}).activateApp = function (behavior) { app = behavior; };\n' +
    'spirit.shell.activateLogin = function (behavior) { app = behavior; };\n' +
    'Promise.resolve(spirit.start()).then(function () { return spirit.require(file); }).then(function () {\n' +
    '  if (app && typeof app.mount === "function") {\n' +
    '    app.mount(box, api);\n' +
    '    if (typeof app.render === "function") app.render();\n' +
    '    report.state = "mounted";\n' +
    '    return;\n' +
    '  }\n' +
    '  var made = own.filter(function (k) { return E[k] && typeof E[k].create === "function"; });\n' +
    '  if (made.length !== 1) throw new Error(file + (made.length ? " registers more than one element: " + made.join(", ") : " registers no element with a create" + (own.length ? "; it registers " + own.join(", ") : "")));\n' +
    '  return Promise.resolve(E[made[0]].create(box)).then(function (m) {\n' +
    '    if (m && typeof m.destroy === "function") report.destroy = function () { return m.destroy(); };\n' +
    '    report.state = "mounted";\n' +
    '  });\n' +
    '}).then(null, failed);\n' +
    '}());';
}

function make(o) {
  if (o.ext !== 'html') return Promise.resolve(null);
  const name = o.module.slice(o.module.lastIndexOf('/') + 1);
  const body = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>' + name + '</title>\n' +
    '<link rel="stylesheet" href="/shell.css" />\n' +
    '<style>html, body { height: 100%; margin: 0; } body { display: flex; flex-direction: column; }</style>\n' +
    '</head>\n<body>\n<div id="mount-box" class="fill"></div>\n<script src="/spirit.js"></script>\n<script>\n' + mountScript(o.module + '.js') + '\n</script>\n</body>\n</html>\n';
  return Promise.resolve({ type: 'text/html; charset=utf-8', body: body });
}

module.exports = { make: make };
