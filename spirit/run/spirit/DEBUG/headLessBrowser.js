'use strict';
require('../spirit.js');
// spirit/run/spirit/DEBUG/headLessBrowser.js
// THE BARE MOUNT PAGE OF ONE MODULE (goal/G41.19, ../test/DEBUG.md), replacing shell/mount.html. Andy: "the response will
// be the most minimal web page, NO COMMENTS, NOTHING with a script tag <script src="/spirit.js"> and the most minimal
// mount for armingButton.js". Its first user is the shell's general rules (spirit/test/spirit-sibling-generalRules.md).
//
// The page loads /spirit.js, then the module through spirit.require, alone (rule/26). An app (it calls
// spirit.shell.activateApp) is mounted into the box with an api as the face
// gives one (shell/boot.js apiFor). An element
// is created with the box alone, no options (box v23: "no manifests at this point, because special cases can be handled
// by the elements own test script"): the element that stands at spirit.element.<the file's path> once it is required,
// put there by its own installSpiritElement call (goal/G43.32; Andy: "element scripts installed by the above logic place
// their element-factory at spirit.element.<path-of-fucking-element-script>"); none there fails and says where it looked.
// /shell.css is the shell's one sheet, a link and not a script. What happened is on
// window.spiritMount: { state: loading | mounted | failed, error, box, destroy }.
'use strict';

// The page's script, as the page carries it: no comments, nothing named but what it mounts.
function mountScript(file) {
  return '(function () {\n' +
    'var box = document.getElementById("mount-box");\n' +
    'var report = window.spiritMount = { state: "loading", error: "", box: box, destroy: null };\n' +
    'function failed(e) { report.state = "failed"; report.error = String((e && e.message) || e || "failed"); }\n' +
    'var file = ' + JSON.stringify(file) + ';\n' +
    'function placed() { return file.replace(/\\.js$/, "").split("/").reduce(function (o, k) { return o == null ? undefined : o[k]; }, window.spirit.element); }\n' +
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
    '  ui: { element: window.spirit.element }\n' +
    '};\n' +
    'var app = null;\n' +
    '(spirit.shell = spirit.shell || {}).activateApp = function (behavior) { app = behavior; };\n' +
    'Promise.resolve(spirit.start()).then(function () { return spirit.require(file); }).then(function () {\n' +
    '  if (app && typeof app.mount === "function") {\n' +
    '    app.mount(box, api);\n' +
    '    if (typeof app.render === "function") app.render();\n' +
    '    report.state = "mounted";\n' +
    '    return;\n' +
    '  }\n' +
    '  var el = placed();\n' +
    '  if (!el || typeof el.create !== "function") throw new Error(file + " places no element with a create at spirit.element." + file.replace(/\\.js$/, "").split("/").join("."));\n' +
    '  return Promise.resolve(el.create(box)).then(function (m) {\n' +
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
