'use strict';

// spirit/run/spirit/element/test/introSpector.js
// The tests of spirit/element/introSpector.js, and of no other module (spec: ./introSpector.md; goal/G43.29, box v3): what
// introSpector draws, moved out of shell/introSpector/introSpector.js. The box: "Each works exactly as the old one", "the
// old apps' code moves there". Written from reading the old module (Andy, of it: "this all happens because i want to SEE"):
// one line, [party, self by default] [family] [verb]; the chosen verb's form, one field per key of its request typed by the
// prototype's value, and a call button; the reply, read-only, in CodeMirror. JSON that does not parse is refused with the
// field's name. spirit.element.spirit.element.introSpector.create(container) mounted alone in a box of a real Chrome on a scratch node's
// face page, the party self. The family and the verb are picked by setting each half's value and saying change, as a
// pick in its dropdown does, so what introSpector does with a choice is judged, not the dropdowns' own drawing.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('introSpector.js: see what a party lets you call, an element of spirit/element/ (goal/G43.29)');

(async function () {
  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  try {
    if (!node.up || chrome.error) { test.fail('no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    const made = await chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/element/introSpector.js"); }).then(function () { window.pageErrors = []; window.addEventListener("error", function (e) { window.pageErrors.push(String(e.message)); }); var c = document.createElement("div"); c.id = "box"; c.style.cssText = "position:fixed;left:0;top:0;width:1100px;height:760px;overflow:auto;background:#111;z-index:9"; document.body.appendChild(c); var I = spirit.element.spirit.element.introSpector; if (!I || typeof I.create !== "function") return "spirit.element.spirit.element.introSpector.create is " + typeof (I && I.create); window.made = I.create(c); return "made"; }, function (e) { return String(e && e.message || e); })');
    ok(made === 'made', 'it loads through spirit.require and mounts with spirit.element.spirit.element.introSpector.create(container)', 'it did not mount: ' + short(made));
    if (made !== 'made') return;
    const text = function () { return chrome.evaluate('String((document.getElementById("box") || {}).innerText || "")'); };
    const html = function () { return chrome.evaluate('String((document.getElementById("box") || {}).innerHTML || "")'); };
    const reply = function () { return chrome.evaluate('(function () { var cm = document.querySelector("#box .CodeMirror"); return cm && cm.CodeMirror ? cm.CodeMirror.getValue() : null; }())'); };
    const SEL = 'document.querySelector("#box .api-family-selector")';

    test.subHeading('one line: [party, self by default] [family] [verb]; the form says what to choose');
    ok(await until(function () { return html().then(function (h) { return /self \(this node\)/.test(h); }); }, 10000), 'the party is self (this node) until a pick', 'no self (this node): ' + short(await text()));
    ok(await until(function () { return chrome.evaluate('!!(' + SEL + ' && ' + SEL + '.families)'); }, 10000), 'the family and verb selector stands on the line', 'no family selector: ' + short(await html()));
    ok(await until(function () { return text().then(function (t) { return /choose a family/.test(t); }); }, 10000), 'the form says choose a family', 'the form says: ' + short(await text()));
    ok(await until(function () { return reply().then(function (r) { return r !== null; }); }, 10000), 'the reply is a CodeMirror view', 'no CodeMirror for the reply');
    const tree = JSON.parse(await chrome.evaluate('(function () { var s = ' + SEL + '; return JSON.stringify((s && (s.tree || (s.families && s.families.tree))) || null); }())') || 'null');
    ok(!!tree && !!tree.job && !!tree.job.search, 'self\'s tree is this node\'s, job.search in it', 'the tree: ' + short(tree && Object.keys(tree)));
    if (!tree || !tree.job || !tree.job.search) return;

    const pick = function (family, verb) {
      return chrome.evaluate('(function () { var s = ' + SEL + '; s.families.value = ' + JSON.stringify(family) + '; s.families.dispatchEvent(new Event("change", { bubbles: true })); ' + (verb ? 's.verbs.value = ' + JSON.stringify(verb) + '; s.verbs.dispatchEvent(new Event("change", { bubbles: true })); ' : '') + 'return s.value; }())');
    };
    test.subHeading('a family chosen, then a verb: its form, one field per key of its request, and call');
    await pick('job');
    ok(await until(function () { return text().then(function (t) { return /choose a verb/.test(t); }); }, 5000), 'a family chosen, the form says choose a verb', 'the form says: ' + short(await text()));
    await pick('job', 'search');
    const keys = Object.keys(tree.job.search.request || {});
    ok(await until(function () { return chrome.evaluate('Array.prototype.some.call(document.querySelectorAll("#box button"), function (b) { return String(b.textContent).trim() === "call"; })'); }, 5000), 'job.search chosen: a call button', 'no call button: ' + short(await text()));
    const labels = await text();
    keys.forEach(function (k) { ok(labels.indexOf(k) !== -1, 'a field for its key ' + k, 'no field for ' + k + ': ' + short(labels)); });
    await chrome.evaluate('(function () { var b = Array.prototype.filter.call(document.querySelectorAll("#box button"), function (x) { return String(x.textContent).trim() === "call"; })[0]; b.click(); return true; }())');
    ok(await until(function () { return reply().then(function (r) { return /"items"/.test(String(r)); }); }, 10000), 'call asks job.search of self and shows its reply, the jobs\' items', 'the reply: ' + short(await reply()));
    ok(/\n\s+"/.test(String(await reply())), 'written out as JSON.stringify(answer, null, 2)', 'the reply is not written out: ' + short(await reply()));

    test.subHeading('the attacker: JSON that does not parse is refused with the field\'s name');
    // A verb of this node whose request holds an object, an array or null: a JSON field.
    let jsonCase = null;
    Object.keys(tree).some(function (f) {
      return Object.keys(tree[f] || {}).some(function (v) {
        const req = (tree[f][v] || {}).request;
        if (!req || typeof req !== 'object') return false;
        const k = Object.keys(req).filter(function (x) { return req[x] !== null && typeof req[x] === 'object' || req[x] === null; })[0];
        if (k) jsonCase = { family: f, verb: v, key: k };
        return !!k;
      });
    });
    ok(!!jsonCase, 'the world: a verb with a JSON field, ' + short(jsonCase), 'no verb of this node has a JSON field: not judged');
    if (jsonCase) {
      await pick(jsonCase.family, jsonCase.verb);
      await until(function () { return chrome.evaluate('!!document.getElementById("is-f-' + jsonCase.key + '") || Array.prototype.some.call(document.querySelectorAll("#box textarea"), function (t) { return t.getClientRects().length; })'); }, 5000);
      await chrome.evaluate('(function () { var t = Array.prototype.filter.call(document.querySelectorAll("#box textarea"), function (x) { return x.getClientRects().length; })[0]; if (t) { t.value = "{not json"; t.dispatchEvent(new Event("input", { bubbles: true })); } var b = Array.prototype.filter.call(document.querySelectorAll("#box button"), function (x) { return String(x.textContent).trim() === "call"; })[0]; if (b) b.click(); return !!t && !!b; }())');
      ok(await until(function () { return reply().then(function (r) { return String(r).indexOf(jsonCase.key + ' is not JSON') !== -1; }); }, 5000), 'the reply says ' + jsonCase.key + ' is not JSON, and nothing is called', 'the reply: ' + short(await reply()));
    }

    test.subHeading('destroy');
    const empty = await chrome.evaluate('(function () { window.made.destroy(); return document.getElementById("box").children.length === 0; }())');
    ok(empty === true, 'destroy empties its container', 'destroy left ' + short(await text()));
    ok(JSON.parse(await chrome.evaluate('JSON.stringify(window.pageErrors)')).length === 0, 'and the page threw nothing', 'page errors: ' + short(await chrome.evaluate('JSON.stringify(window.pageErrors)')));
  } finally {
    try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
    try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
