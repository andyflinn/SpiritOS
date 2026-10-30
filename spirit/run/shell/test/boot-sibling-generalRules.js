'use strict';

// spirit/run/shell/test/boot-sibling-generalRules.js <file>
// THE GENERAL RULES OF A SHELL APP OR ELEMENT (goal/G41.18), run once per file it judges, the file its argument, as
// ../../test/spirit-child-generalRules.js is for a module (spec: ./boot-sibling-generalRules.md). ITS NAME IS ITS REACH
// (../../test/TEST_SYSTEM.md; Andy: "the NAME of the file should tell testModule.js which folder this it belongs to"): a
// -sibling- test beside shell/boot.js judges every module in shell/ and below that has its own test. Andy: "we may require a
// ./test/shell-child-generalRules.js with a test that catches all violators of this sort of thing, THAT's were a general
// test belongs"; "shell-child-generalRules.js can also run headless chrome test to assert UI standards..."; "who says it
// shouln't check general \"mountability\" of elements and apps?", "mount each element or app all by itself, to \"unit\"
// tests?"; "add that test: shell-child-generalRules.js". Each file is its own test id; a rule a file breaks fails that
// file's test.
//
// HOW: a scratch copy of spirit/run (the tracked files) on a node of its own, on a free port, its DEBUG switched on, so
// neither Andy's node nor an agent's is touched. Headless Chrome, driven over its debugging port with node's own
// WebSocket, opens the node's DEBUG page for the file (goal/G41.19, ../../spirit/test/DEBUG.md; Andy: "wsl's element
// mount tests must be the first user of this DEBUG feature"), /DEBUG/<path>/<module>/headLessBrowser.html: spirit.js
// alone, then the one app or element, mounted by itself into a box of the whole page. What the page reports, and the
// real layout it drew, are judged here.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
// The product test system's own reporter (goal/G40.13): nothing of spirit/run/ reaches into the old test system.
const test = require(path.join(__dirname, '..', '..', 'test', 'testReport.js'));

const RUN = path.join(__dirname, '..', '..');
const REPO = path.join(RUN, '..', '..');
// Its arguments: the file it judges, if any; the verifier's --verify-port <n> is the reporter's, and passed on.
const ARGS = process.argv.slice(2);
const VERIFY = ARGS.indexOf('--verify-port') !== -1 ? ARGS.slice(ARGS.indexOf('--verify-port'), ARGS.indexOf('--verify-port') + 2) : [];
const arg = String(ARGS.filter(function (a) { return VERIFY.indexOf(a) === -1; })[0] || '');
let full = '';
for (const p of [path.resolve(arg), path.join(RUN, arg), path.join(REPO, arg)]) {
  if (arg && fs.existsSync(p) && fs.statSync(p).isFile()) { full = p; break; }
}
const rel = full ? path.relative(RUN, full).split(path.sep).join('/') : arg;
// EVERY TEST NAME STARTS WITH THE PATH (goal/G41.19; Andy: "please start the test descriptions always with the exact URL
// to the server, without \"/DEBUG\" service", and, box v13, "EVERY MOTHERFUCKING TEST NAME in the product three STARTS
// WITH THE MUTHERCUCKING PATH"): each section is named by the address this file's page is opened at, /DEBUG left off.
const ADDRESS = '/DEBUG/' + rel.replace(/\.js$/, '') + '/headLessBrowser.html';
const NAMED = ADDRESS.slice('/DEBUG'.length);
// WHAT IS MOUNTED IS KNOWN BY ITS PATH (goal/G41.19, box v17; Andy: "the test knows bloody fucking well if a scripts is
// an app (from the path pattern), why the fuck would would it need manifests for standard patterns?", "the test knows
// fucking well, which are elements scripts in ./shell/js/"): an app is shell/<app>/<app>.js, an element any script
// under shell/js/. Anything else in its reach is neither, and is not mounted.
function kindOf(file) {
  const f = String(file || '');
  if (/^shell\/js\/.+\.js$/.test(f)) return 'element';
  const m = /^shell\/([^/]+)\/([^/]+)\.js$/.exec(f);
  return m && m[1] === m[2] ? 'app' : '';
}
const WAIT = 20000;

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// The scratch node and headless Chrome, shared with any test that opens a page (test/headLessChrome.js).
const { sleep, until, findChrome, scratchNode, chromePage } = require(path.join(RUN, 'test', 'headLessChrome.js'));

// GIVEN NO FILE, EVERY FILE IN ITS REACH (goal/G41.19): an item's suite row names no file, so a run of this test alone
// judges every shell module testModule.js gives it, on one scratch node, each file in a run of its own, so each is
// recorded under its own module (test/testReport.js). This run records one line per file, named by its address.
// EVERY FILE THAT PAINTS AN ICON LOADS THE ICON ELEMENT (goal/G41.23; Q1, Andy: "plus the intrinsic apps, plus the
// icons app. all apps that use icons."; "wsl, Go" on: a second rule reads the code, so that it misses none). A bare mount
// draws no data, so most icons are seen only here. AN ICON STANDS ALONE (Andy: "isn't a glyph inside flowing text just
// like another inline character? ... glyphs are legal in labels and description true, and in that context they don't
// need special handling", then "narrow the rules so."): a shell script (no test, no vendor code) whose code, comments
// left out, holds a pictograph (Unicode Extended_Pictographic) alone in a string or alone between two tags, or that
// paints icons it is handed (named below, read by hand), loads shell/js/icon.js. A glyph among words is text. Each is
// its own check, named by its path.
const FROM_DATA = ['shell/boot.js', 'shell/apps/apps.js', 'shell/icons/icons.js', 'shell/contacts/contacts.js', 'shell/js/icons/listElement.js',
  'shell/js/icons/rowElement.js', 'shell/js/iconSelector.js', 'shell/js/workBench.js'];
// A pictograph, its variation selectors and joiners with it, alone in quotes or alone between > and <.
const ALONE = /(['"`]|>)\s*(?:\p{Extended_Pictographic}[\uFE0F\u200D\u{1F3FB}-\u{1F3FF}]*)+\s*(['"`]|<)/u;
// A glyph alone in a string that is drawn only among words, read by hand: a status or a mark put before a name
// (Andy: "glyphs are legal in labels and description true").
const TEXT_ONLY = {
  'shell/jobsDetails/jobsDetails.js': 'its status glyph is drawn before the job\'s type and its status word',
  'shell/js/contactDetails/contactDetails.js': 'its blocked and held marks are drawn before the person\'s name',
  'shell/js/contacts/listElement.js': 'its filter icons are drawn before their words by the search element\'s chips',
};
function painters() {
  const tracked = require('child_process').execFileSync('git', ['ls-files', 'shell'], { cwd: RUN, encoding: 'utf8' }).split('\n');
  return tracked.filter(function (f) {
    if (!/\.js$/.test(f) || /\/test\/|node_modules|codeMirror/.test(f) || f === 'shell/js/icon.js' || !fs.existsSync(path.join(RUN, f))) return false;
    if (FROM_DATA.indexOf(f) !== -1) return true;
    if (TEXT_ONLY[f]) return false;
    const code = fs.readFileSync(path.join(RUN, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
    return ALONE.test(code);
  });
}
function iconsLoaded() {
  test.subHeading('every shell file that paints an icon loads the icon element');
  const files = painters();
  test.comment(files.length + ' shell files paint icons: ' + files.join(', '));
  test.comment('glyphs among words only, read by hand: ' + Object.keys(TEXT_ONLY).map(function (f) { return f + ' (' + TEXT_ONLY[f] + ')'; }).join('; '));
  files.forEach(function (f) {
    const src = fs.readFileSync(path.join(RUN, f), 'utf8');
    ok(src.indexOf('shell/js/icon.js') !== -1, f + ': it paints icons and loads shell/js/icon.js', f + ': it paints icons and never loads shell/js/icon.js');
  });
}

async function every() {
  iconsLoaded();
  const reach = require(path.join(RUN, 'test', 'testModule.js')).testsFor('').filter(function (t) { return t.test === 'shell/test/boot-sibling-generalRules.js' && t.file; }).map(function (t) { return t.file; });
  const files = reach.filter(kindOf);
  test.comment('every app and element in its reach: ' + files.length + ' of ' + reach.length + '; not mounted, being neither: ' + reach.filter(function (f) { return !kindOf(f); }).join(', '));
  if (!files.length) { test.fail('testModule.js gives it no file to judge'); return; }
  const node = await scratchNode();
  try {
    if (!node.up || !node.debug) { test.fail('the scratch node did not come up with its DEBUG on: every file would blame the wrong thing'); return; }
    for (const f of files) {
      const out = await new Promise(function (resolve) {
        const kid = spawn(process.execPath, [__filename, f].concat(VERIFY), { cwd: RUN, env: Object.assign({}, process.env, { SPIRIT_MOUNT_BASE: node.base }), stdio: ['ignore', 'pipe', 'pipe'] });
        let text = '';
        kid.stdout.on('data', function (d) { text += d; });
        kid.stderr.on('data', function (d) { text += d; });
        kid.on('close', function () { resolve(text); });
      });
      const greens = Number((/✅:(\d+)/.exec(out) || [])[1] || 0);
      const reds = Number((/❌:(\d+)/.exec(out) || [])[1] || 0);
      const first = (/FAILURE #[\d.]+: ([^\n]*)/.exec(out) || [])[1] || '';
      const at = '/' + f.replace(/\.js$/, '') + '/headLessBrowser.html';
      test.subHeading(at);
      ok(reds === 0 && greens > 0, at + ': ' + greens + ' green', at + ': ' + reds + ' red, ' + greens + ' green; first: ' + first.slice(0, 200));
    }
  } finally {
    try { node.child.kill(); } catch (e) { /* gone */ }
    await sleep(300);
    try { fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}

test.startTest((full ? NAMED : 'every shell module') + ': the general rules of a shell app or element');

(async function () {
  if (!arg) return every();
  if (!full) { test.fail('no shell app or element to judge: ' + JSON.stringify(arg)); return; }
  if (!kindOf(rel)) { test.subHeading(NAMED); test.check(rel + ' is neither an app (shell/<app>/<app>.js) nor an element (under shell/js/): not mounted'); return; }
  const chrome = findChrome();
  if (!chrome) { test.fail('no Chrome on this machine (set SPIRIT_CHROME to its path): the UI rules cannot be judged'); return; }
  const node = await scratchNode();
  let page = null;
  try {
    if (!node.up) { test.fail('the scratch node did not come up: every rule here would blame the wrong thing'); return; }
    if (!node.debug) { test.fail('the scratch node\'s DEBUG could not be switched on (node.debug)'); return; }
    page = await chromePage(chrome);
    if (page.error) { test.fail(page.error); return; }

    test.subHeading(NAMED + ': ' + 'it loads by itself');
    // THE BARE MOUNT PAGE: spirit.js alone, then this one file, mounted by itself (rule/26: "every element loads its own
    // parts via spirit.require; nothing is preloaded"). The node's DEBUG page for it, made from its address.
    const address = ADDRESS;
    const mountPage = await fetch(node.base + address);
    ok(mountPage.status === 200, 'the node answers its DEBUG page for it, ' + address, address + ' answered ' + mountPage.status);
    if (mountPage.status !== 200) return;
    await page.send('Page.navigate', { url: node.base + address });
    let report = null;
    await until(function () {
      return page.evaluate('JSON.stringify(window.spiritMount ? { state: window.spiritMount.state, error: String(window.spiritMount.error || "") } : null)').then(function (s) {
        report = s ? JSON.parse(s) : null; return !!report && report.state !== 'loading';
      });
    }, WAIT);
    await sleep(500);
    const thrown = page.heard.filter(function (m) { return m.method === 'Runtime.exceptionThrown'; }).map(function (m) { return (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text; });
    // A file asked for and not there is missing; the door's answers (a refusal answers 404 too) and the browser's own
    // favicon ask are not files the page asked for.
    const notFile = function (url) { return /\/api\/|\/favicon\.ico$/.test(String(url || '')); };
    const errors = page.heard.filter(function (m) { return (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') || (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !notFile(m.params.entry.url)); })
      .map(function (m) { return m.params.entry ? m.params.entry.text : (m.params.args || []).map(function (a) { return a.value || a.description; }).join(' '); });
    const missing = page.heard.filter(function (m) { return m.method === 'Network.responseReceived' && m.params.response.status >= 400 && !notFile(m.params.response.url); }).map(function (m) { return m.params.response.status + ' ' + m.params.response.url.replace(node.base, ''); })
      .concat(page.heard.filter(function (m) { return m.method === 'Network.loadingFailed' && !m.params.canceled; }).map(function (m) { return 'failed ' + m.params.errorText; }));
    ok(report && report.state === 'mounted', 'it mounts by itself on a bare page: spirit.js, then this file alone', 'the page said: ' + short(report));
    ok(!thrown.length, 'nothing it runs throws', 'thrown: ' + short(thrown));
    ok(!missing.length, 'every file it asks for is there', 'missing: ' + short(missing));
    ok(!errors.length, 'and it says no error on the console', 'console: ' + short(errors));
    if (!report || report.state !== 'mounted') return;

    // EVERY BOX INSIDE IT BOUNDED, TALL AND WIDE (goal/G41.19, box v23; rule/16; Andy: "list-in-a-sized-box
    // (anything-in-a-sized-box) are really a test of the container", "any container that mounts unknown stuff inside it
    // should be bounded in vertically and horizontally"). Judged by the layout itself, so the page names no element:
    // every box it drew that scrolls (overflow auto or scroll, either way), shown, is given a child far taller than it,
    // then one far wider, and must keep its height and its width, inside the mount box. A box only as tall or as wide as
    // its content, anywhere above it, lets it grow. A dropdown's list is hidden until it opens, and is not asked. It is
    // judged as drawn, and again after each tool and tab button it draws is pressed in turn. EACH BOX IS ITS OWN CHECK,
    // named by this file's path and the box's id chain (Andy: "only if the test is properly named can the problem be
    // diagnosed quickly").
    const PROBE = '(function () { var box = window.spiritMount.box; var out = [];' +
      ' function chain(el) { var parts = []; for (var n = el; n && n !== box; n = n.parentNode) { if (n.id || n === el) parts.unshift(n.tagName.toLowerCase() + (n.id ? "#" + n.id : "")); } return parts.join(" > "); }' +
      ' function grows(el, prop, kid) { var before = el.getBoundingClientRect()[prop]; el.appendChild(kid); var after = el.getBoundingClientRect(); var bx = box.getBoundingClientRect();' +
      '  var r = { kept: Math.abs(after[prop] - before) <= 1, inside: after.bottom <= bx.bottom + 1 && after.right <= bx.right + 1, spilt: box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1 }; el.removeChild(kid); return r; }' +
      ' Array.prototype.forEach.call(box.querySelectorAll("*"), function (el) { var cs = getComputedStyle(el); if (!/auto|scroll/.test(cs.overflowY + cs.overflowX) || !el.getClientRects().length) return;' +
      '  var tall = document.createElement("div"); tall.style.cssText = "height:5000px;width:1px;flex:none";' +
      '  var wide = document.createElement("div"); wide.style.cssText = "width:5000px;min-width:5000px;height:1px;flex:none";' +
      '  var t = grows(el, "height", tall), w = grows(el, "width", wide);' +
      '  out.push({ box: chain(el), tall: t, wide: w }); }); return out; }())';
    // EVERY ICON THROUGH THE ICON ELEMENT (goal/G41.23; Andy, goal/G41.21: "this element will replace icons painting all
    // shell elements and apps."; box v5: "new-face apps will be updated to use the new \"icon\" element."; Q1: "all apps
    // that use icons."): every glyph it draws that is a pictograph (Unicode Extended_Pictographic, as its icons are) and
    // stands alone, its element's whole text, lies inside an element of the class the icon element carries. A glyph among
    // words is a character of the text (Andy: "glyphs are legal in labels and description true, and in that context they
    // don't need special handling"; "narrow the rules so."). The class is read from an icon made after the mount, so
    // nothing is preloaded (rule/26). Judged as drawn, and after each press, as the boxes are.
    const ICONS = '(function () { var box = window.spiritMount.box; var mark = window.spiritIconMark || ""; var out = [];' +
      ' var walk = document.createTreeWalker(box, NodeFilter.SHOW_TEXT); var n;' +
      ' while ((n = walk.nextNode())) { var g = n.textContent.match(/\\p{Extended_Pictographic}/gu); if (!g) continue; var el = n.parentElement;' +
      '  if (!el || el.textContent.replace(/[\\p{Extended_Pictographic}\\uFE0F\\u200D\\u{1F3FB}-\\u{1F3FF}\\s]/gu, "") !== "") continue;' +
      '  var inIcon = !!mark && !!el && !!el.closest("." + mark); if (inIcon || !el.getClientRects().length) continue;' +
      '  var parts = []; for (var e = el; e && e !== box; e = e.parentNode) { if (e.id || e === el) parts.unshift(e.tagName.toLowerCase() + (e.id ? "#" + e.id : "")); }' +
      '  out.push(g.join("") + " in " + parts.join(" > ")); } return out; }())';
    await page.evaluate('Promise.resolve().then(function () { return spirit.require("shell/js/icon.js"); }).then(function () { var p = document.createElement("div"); var i = spirit.elements.icon.create(p, { glyph: "A" }); window.spiritIconMark = String(i && i.className || "").trim().split(/\\s+/)[0] || ""; }, function () { window.spiritIconMark = ""; })');
    const iconMark = await page.evaluate('window.spiritIconMark || ""');
    const loose = {};
    const iconProbe = async function () { const s = await page.evaluate('JSON.stringify(' + ICONS + ')'); (s ? JSON.parse(s) : []).forEach(function (x) { loose[x] = true; }); };
    await iconProbe();
    const seen = {};
    const bounded = function (p) { return p.tall.kept && p.tall.inside && !p.tall.spilt && p.wide.kept && p.wide.inside && !p.wide.spilt; };
    const probe = async function () { const s = await page.evaluate('JSON.stringify(' + PROBE + ')'); (s ? JSON.parse(s) : []).forEach(function (p) { if (!seen[p.box] || bounded(seen[p.box])) seen[p.box] = p; }); };
    await probe();
    const count = await page.evaluate('window.spiritMount.box.querySelectorAll("[data-tool],[data-tab]").length');
    for (let i = 0; i < count; i++) {
      await page.evaluate('(function () { var b = window.spiritMount.box.querySelectorAll("[data-tool],[data-tab]")[' + i + ']; if (b) b.click(); }())');
      await sleep(400);
      await probe();
      await iconProbe();
    }
    test.comment('pressed ' + count + ' tool and tab buttons; ' + Object.keys(seen).length + ' scrolling boxes');
    Object.keys(seen).forEach(function (k) {
      const p = seen[k];
      test.subHeading(NAMED + ': sized box ' + k);
      const why = [];
      if (!p.tall.kept) why.push('it grows taller with its content');
      if (!p.wide.kept) why.push('it grows wider with its content');
      if (!p.tall.inside || !p.wide.inside) why.push('it reaches past the mount box');
      if (p.tall.spilt || p.wide.spilt) why.push('the mount box overflows');
      ok(!why.length, k + ' keeps its height and its width when given far more than it holds', k + ': ' + why.join('; '));
    });
    test.subHeading(NAMED + ': ' + 'every icon it paints is the icon element');
    const looseList = Object.keys(loose);
    ok(!!iconMark && !looseList.length, 'every pictograph it draws lies inside the icon element (class ' + iconMark + ')',
      iconMark ? looseList.length + ' drawn outside the icon element: ' + short(looseList.slice(0, 5)) : 'no icon element to paint through: shell/js/icon.js made no element with a class');
    test.subHeading(NAMED + ': ' + 'its box never grows');
    const spills = await page.evaluate('(function () { var b = window.spiritMount.box; return b.scrollHeight > b.clientHeight + 1 || document.documentElement.scrollWidth > document.documentElement.clientWidth + 1; }())');
    ok(spills === false, 'it never grows its box, and the page never scrolls sideways', 'its box overflows, or the page scrolls sideways');

    test.subHeading(NAMED + ': ' + 'destroy leaves its box empty');
    const destroyed = await page.evaluate('(function () { var m = window.spiritMount; if (typeof m.destroy !== "function") return "none"; m.destroy(); return m.box.childElementCount === 0 ? "empty" : "left"; }())');
    ok(destroyed === 'empty' || destroyed === 'none', destroyed === 'none' ? 'it has no destroy of its own (an app is closed by the face)' : 'destroyed, its box is empty', 'after destroy its box still holds what it drew');
  } finally {
    if (page && page.sock) try { page.sock.close(); } catch (e) { /* gone */ }
    if (page && page.kid) try { page.kid.kill(); } catch (e) { /* gone */ }
    if (!node.shared) try { node.child.kill(); } catch (e) { /* gone */ }
    await sleep(300);
    [node.shared ? '' : node.root, page && page.profile].forEach(function (d) { if (d) try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* scratch */ } });
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
