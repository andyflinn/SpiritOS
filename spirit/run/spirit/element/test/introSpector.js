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

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// The scratch node and the Chrome page on it.
let node = null;
let chrome = null;
// What the tests make, shared by the tests after them.
let made, text, html, reply, SEL, tree, pick, keys, labels, jsonCase, empty;
test.run('the world: a scratch node comes up', 0.2, async function () {
  node = await scratchNode();
  return !!node.up || 'the scratch node did not come up';
}, 5000);
test.run('the world: a Chrome page opens', 0.2, async function () {
  chrome = await chromePage(findChrome());
  return !chrome.error || 'no Chrome: ' + short(chrome.error);
}, 2000);
test.after(function () {
  try { if (chrome && chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
  try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node && node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node && node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});
test.run('it loads through spirit.require and mounts with spirit.element.spirit.element.introSpector.create(container)', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: nothing judged';
  await chrome.send('Page.navigate', { url: node.base + '/face.html' });
  await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
  made = await chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/element/introSpector.js"); }).then(function () { window.pageErrors = []; window.addEventListener("error", function (e) { window.pageErrors.push(String(e.message)); }); var c = document.createElement("div"); c.id = "box"; c.style.cssText = "position:fixed;left:0;top:0;width:1100px;height:760px;overflow:auto;background:#111;z-index:9"; document.body.appendChild(c); var I = spirit.element.spirit.element.introSpector; if (!I || typeof I.create !== "function") return "spirit.element.spirit.element.introSpector.create is " + typeof (I && I.create); window.made = I.create(c); return "made"; }, function (e) { return String(e && e.message || e); })');
  return (made === 'made') ? true : 'it did not mount: ' + short(made);
}, 2000);
test.run('the party is self (this node) until a pick', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: nothing judged';
  text = function () { return chrome.evaluate('String((document.getElementById("box") || {}).innerText || "")'); };
  html = function () { return chrome.evaluate('String((document.getElementById("box") || {}).innerHTML || "")'); };
  reply = function () { return chrome.evaluate('(function () { var cm = document.querySelector("#box .CodeMirror"); return cm && cm.CodeMirror ? cm.CodeMirror.getValue() : null; }())'); };
  SEL = 'document.querySelector("#box .api-family-selector")';
  // one line: [party, self by default] [family] [verb]; the form says what to choose
  return (await until(function () { return html().then(function (h) { return /self \(this node\)/.test(h); }); }, 10000)) ? true : 'no self (this node): ' + short(await text());
}, 1000);
test.run('the family and verb selector stands on the line', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: nothing judged';
  return (await until(function () { return chrome.evaluate('!!(' + SEL + ' && ' + SEL + '.families)'); }, 10000)) ? true : 'no family selector: ' + short(await html());
}, 1000);
test.run('the form says choose a family', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: nothing judged';
  return (await until(function () { return text().then(function (t) { return /choose a family/.test(t); }); }, 10000)) ? true : 'the form says: ' + short(await text());
}, 1000);
test.run('the reply is a CodeMirror view', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: nothing judged';
  return (await until(function () { return reply().then(function (r) { return r !== null; }); }, 10000)) ? true : 'no CodeMirror for the reply';
}, 1000);
test.run('self\'s tree is this node\'s, job.search in it', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: nothing judged';
  tree = JSON.parse(await chrome.evaluate('(function () { var s = ' + SEL + '; return JSON.stringify((s && (s.tree || (s.families && s.families.tree))) || null); }())') || 'null');
  return (!!tree && !!tree.job && !!tree.job.search) ? true : 'the tree: ' + short(tree && Object.keys(tree));
}, 1000);
test.run('a family chosen, the form says choose a verb', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: nothing judged';
  pick = function (family, verb) {
      return chrome.evaluate('(function () { var s = ' + SEL + '; s.families.value = ' + JSON.stringify(family) + '; s.families.dispatchEvent(new Event("change", { bubbles: true })); ' + (verb ? 's.verbs.value = ' + JSON.stringify(verb) + '; s.verbs.dispatchEvent(new Event("change", { bubbles: true })); ' : '') + 'return s.value; }())');
    };
  // a family chosen, then a verb: its form, one field per key of its request, and call
  await pick('job');
  return (await until(function () { return text().then(function (t) { return /choose a verb/.test(t); }); }, 5000)) ? true : 'the form says: ' + short(await text());
}, 1000);
test.run('job.search chosen: a call button', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: nothing judged';
  await pick('job', 'search');
  keys = Object.keys(tree.job.search.request || {});
  return (await until(function () { return chrome.evaluate('Array.prototype.some.call(document.querySelectorAll("#box button"), function (b) { return String(b.textContent).trim() === "call"; })'); }, 5000)) ? true : 'no call button: ' + short(await text());
}, 1000);
test.run('a field for its key q', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: nothing judged';
  labels = await text();
  // job.search's one request key, q, written out so that its check has a plain title.
  return (labels.indexOf('q') !== -1) ? true : 'no field for q: ' + short(labels) + '; its keys: ' + short(keys);
}, 1000);
test.run('call asks job.search of self and shows its reply, the jobs\' items', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: nothing judged';
  await chrome.evaluate('(function () { var b = Array.prototype.filter.call(document.querySelectorAll("#box button"), function (x) { return String(x.textContent).trim() === "call"; })[0]; b.click(); return true; }())');
  return (await until(function () { return reply().then(function (r) { return /"items"/.test(String(r)); }); }, 10000)) ? true : 'the reply: ' + short(await reply());
}, 1000);
test.run('written out as JSON.stringify(answer, null, 2)', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: nothing judged';
  return (/\n\s+"/.test(String(await reply()))) ? true : 'the reply is not written out: ' + short(await reply());
}, 1000);
test.run('the world: a verb with a JSON field', 0.2, function () {
  if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: nothing judged';
  // the attacker: JSON that does not parse is refused with the field's name
  // A verb of this node whose request holds an object, an array or null: a JSON field.
  jsonCase = null;
  Object.keys(tree).some(function (f) {
      return Object.keys(tree[f] || {}).some(function (v) {
        const req = (tree[f][v] || {}).request;
        if (!req || typeof req !== 'object') return false;
        const k = Object.keys(req).filter(function (x) { return req[x] !== null && typeof req[x] === 'object' || req[x] === null; })[0];
        if (k) jsonCase = { family: f, verb: v, key: k };
        return !!k;
      });
    });
  return (!!jsonCase) ? true : 'no verb of this node has a JSON field: not judged';
}, 1000);
test.run('the reply says the JSON field is not JSON, and nothing is called', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: nothing judged';
  await pick(jsonCase.family, jsonCase.verb);
  await until(function () { return chrome.evaluate('!!document.getElementById("is-f-' + jsonCase.key + '") || Array.prototype.some.call(document.querySelectorAll("#box textarea"), function (t) { return t.getClientRects().length; })'); }, 5000);
  await chrome.evaluate('(function () { var t = Array.prototype.filter.call(document.querySelectorAll("#box textarea"), function (x) { return x.getClientRects().length; })[0]; if (t) { t.value = "{not json"; t.dispatchEvent(new Event("input", { bubbles: true })); } var b = Array.prototype.filter.call(document.querySelectorAll("#box button"), function (x) { return String(x.textContent).trim() === "call"; })[0]; if (b) b.click(); return !!t && !!b; }())');
  return (await until(function () { return reply().then(function (r) { return String(r).indexOf(jsonCase.key + ' is not JSON') !== -1; }); }, 5000)) ? true : 'the reply, wanting ' + jsonCase.key + ' is not JSON: ' + short(await reply());
}, 1000);
test.run('destroy empties its container', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: nothing judged';
  // destroy
  empty = await chrome.evaluate('(function () { window.made.destroy(); return document.getElementById("box").children.length === 0; }())');
  return (empty === true) ? true : 'destroy left ' + short(await text());
}, 1000);
test.run('and the page threw nothing', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: nothing judged';
  return (JSON.parse(await chrome.evaluate('JSON.stringify(window.pageErrors)')).length === 0) ? true : 'page errors: ' + short(await chrome.evaluate('JSON.stringify(window.pageErrors)'));
}, 1000);
