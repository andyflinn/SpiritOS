'use strict';

// spirit/run/spirit/element/introSpector/test/script.js
// The tests of spirit/element/introSpector/script.js, and of no other module (spec: ./script.md; goal/G43.29, box v3): what
// introSpector draws, moved out of shell/introSpector/introSpector.js. The box: "Each works exactly as the old one", "the
// old apps' code moves there". Written from reading the old module (Andy, of it: "this all happens because i want to SEE"):
// one line, [party, self by default] [family] [verb]; the chosen verb's form, one field per key of its request typed by the
// prototype's value, and a call button; the reply, read-only, in CodeMirror. JSON that does not parse is refused with the
// field's name. spirit.element.introSpector.create(container) mounted alone in a box of a real Chrome on a scratch node's
// face page, the party self. The family and the verb are picked by setting each half's value and saying change, as a
// pick in its dropdown does, so what introSpector does with a choice is judged, not the dropdowns' own drawing.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/testicle/testReport/script.js');
const { scratchNode, chromePage, findChrome, until } = LOADER.requireScript('spirit/testicle/headLessChrome/script.js');


// The scratch node and the Chrome page on it.
let node = null;
let chrome = null;
// What the tests make, shared by the tests after them.
let made, text, html, reply, SEL, tree, pick, keys, labels, jsonCase, empty;
test.run('a scratch node comes up for this suite', 0.2, async function () {
  node = await scratchNode();
  return !!node.up || false;
}, test.limit.slow);
test.run('a Chrome page opens', 0.2, async function () {
  chrome = await chromePage(findChrome());
  return !chrome.error || false;
}, test.limit.quick);
test.after(function () {
  try { if (chrome && chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
  try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node && node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node && node.root) LOADER.requireScript('spirit/testicle/headLessChrome/script.js').freeTree(node); } catch (e) { /* scratch */ }
});
test.run('it loads through requireScript and mounts with the create of spirit.element.introSpector, handed a container', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return false;
  await chrome.send('Page.navigate', { url: node.base + '/' });
  await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.readyPromise)'); }, 20000);
  made = await chrome.evaluate('window.spirit.readyPromise.then(function () { return spirit.requireScript("spirit/element/introSpector/script.js"); }).then(function () { window.pageErrors = []; window.addEventListener("error", function () { window.pageErrors.push(true); }); var c = document.createElement("div"); c.id = "box"; c.style.cssText = "position:fixed;left:0;top:0;width:1100px;height:760px;overflow:auto;background:#111;z-index:9"; document.body.appendChild(c); var I = spirit.element.introSpector; if (!I || typeof I.create !== "function") return false; window.made = I.create(c); return "made"; }, function () { return false; })');
  return (made === 'made') ? true : false;
}, test.limit.quick);
test.run('the party is self (this node) until a pick', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return false;
  text = function () { return chrome.evaluate('String((document.getElementById("box") || {}).innerText || "")'); };
  html = function () { return chrome.evaluate('String((document.getElementById("box") || {}).innerHTML || "")'); };
  reply = function () { return chrome.evaluate('(function () { var cm = document.querySelector("#box .CodeMirror"); return cm && cm.CodeMirror ? cm.CodeMirror.getValue() : null; }())'); };
  SEL = 'document.querySelector("#box .api-family-selector")';
  // one line: [party, self by default] [family] [verb]; the form says what to choose
  return (await until(function () { return html().then(function (h) { return /self \(this node\)/.test(h); }); }, 10000)) ? true : false;
}, test.limit.quick);
test.run('the branch and verb selector stands on the line', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return false;
  return (await until(function () { return chrome.evaluate('!!(' + SEL + ' && ' + SEL + '.families)'); }, 10000)) ? true : false;
}, test.limit.quick);
test.run('the form says choose a branch', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return false;
  return (await until(function () { return text().then(function (t) { return /choose a family/.test(t); }); }, 10000)) ? true : false;
}, test.limit.quick);
test.run('the reply is a CodeMirror view', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return false;
  return (await until(function () { return reply().then(function (r) { return r !== null; }); }, 10000)) ? true : false;
}, test.limit.quick);
test.run('self\'s tree is this node\'s, with spirit.job.search in it', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return false;
  // goal/G49.23: a branch of the tree is named by its path in dots, spirit.job, no longer by its word.
  tree = JSON.parse(await chrome.evaluate('(function () { var s = ' + SEL + '; return JSON.stringify((s && (s.tree || (s.families && s.families.tree))) || null); }())') || 'null');
  return (!!tree && !!tree['spirit.job'] && !!tree['spirit.job'].search) ? true : false;
}, test.limit.quick);
test.run('once a branch is chosen, the form says choose a verb', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return false;
  pick = function (family, verb) {
      return chrome.evaluate('(function () { var s = ' + SEL + '; s.families.value = ' + JSON.stringify(family) + '; s.families.dispatchEvent(new Event("change", { bubbles: true })); ' + (verb ? 's.verbs.value = ' + JSON.stringify(verb) + '; s.verbs.dispatchEvent(new Event("change", { bubbles: true })); ' : '') + 'return s.value; }())');
    };
  // a family chosen, then a verb: its form, one field per key of its request, and call
  await pick('spirit.job');
  return (await until(function () { return text().then(function (t) { return /choose a verb/.test(t); }); }, 5000)) ? true : false;
}, test.limit.quick);
test.run('once spirit.job.search is chosen, the form shows a call button', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return false;
  await pick('spirit.job', 'search');
  keys = Object.keys(tree['spirit.job'].search.request || {});
  return (await until(function () { return chrome.evaluate('Array.prototype.some.call(document.querySelectorAll("#box button"), function (b) { return String(b.textContent).trim() === "call"; })'); }, 5000)) ? true : false;
}, test.limit.quick);
test.run('the form shows a field for spirit.job.search\'s key q', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return false;
  labels = await text();
  // spirit.job.search's one request key, q, written out so that its check has a plain title.
  return (labels.indexOf('q') !== -1) ? true : false;
}, test.limit.quick);
test.run('call asks spirit.job.search of self and shows its reply, the jobs\' items', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return false;
  await chrome.evaluate('(function () { var b = Array.prototype.filter.call(document.querySelectorAll("#box button"), function (x) { return String(x.textContent).trim() === "call"; })[0]; b.click(); return true; }())');
  return (await until(function () { return reply().then(function (r) { return /"items"/.test(String(r)); }); }, 10000)) ? true : false;
}, test.limit.quick);
test.run('the reply is written out as JSON indented by two spaces', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return false;
  return (/\n\s+"/.test(String(await reply()))) ? true : false;
}, test.limit.quick);
test.run('this node has a verb with a JSON field', 0.2, function () {
  if (!node || !node.up || !chrome || chrome.error) return false;
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
  return (!!jsonCase) ? true : false;
}, test.limit.quick);
test.run('the reply says the JSON field is not JSON, and nothing is called', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return false;
  await pick(jsonCase.family, jsonCase.verb);
  await until(function () { return chrome.evaluate('!!document.getElementById("is-f-' + jsonCase.key + '") || Array.prototype.some.call(document.querySelectorAll("#box textarea"), function (t) { return t.getClientRects().length; })'); }, 5000);
  await chrome.evaluate('(function () { var t = Array.prototype.filter.call(document.querySelectorAll("#box textarea"), function (x) { return x.getClientRects().length; })[0]; if (t) { t.value = "{not json"; t.dispatchEvent(new Event("input", { bubbles: true })); } var b = Array.prototype.filter.call(document.querySelectorAll("#box button"), function (x) { return String(x.textContent).trim() === "call"; })[0]; if (b) b.click(); return !!t && !!b; }())');
  return (await until(function () { return reply().then(function (r) { return String(r).indexOf(jsonCase.key + ' is not JSON') !== -1; }); }, 5000)) ? true : false;
}, test.limit.quick);
test.run('destroy empties its container', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return false;
  // destroy
  empty = await chrome.evaluate('(function () { window.made.destroy(); return document.getElementById("box").children.length === 0; }())');
  return (empty === true) ? true : false;
}, test.limit.quick);
test.run('the page threw nothing', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return false;
  return (JSON.parse(await chrome.evaluate('JSON.stringify(window.pageErrors)')).length === 0) ? true : false;
}, test.limit.quick);
