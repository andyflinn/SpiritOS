'use strict';

// spirit/run/spirit/app/icons/nodeIcons.js
// THE ICON SET, ITS NODE HALF (goal/G43.19, box v16). Andy: "icons is an app with a face, and an api, no fucking process for
// some trivial shit like a quickie applet", "the node must execute spirit/app/<name>/<name>.js with the request, instead of
// routing it to a server, like a cgi-script, and that process lives only as long as the request." Its contract and its
// test: ./test/icons.md and ./test/icons.js.
//
// A ONE-SHOT RUN: icons.js requires this in node; the node starts it for one call (appClient.js, a one-shot row), it
// answers that call on the pipe the node names, and the node ends it. It holds nothing between calls but the file.
//
// THE TABLE IS ONE FILE (the box: "./node<Name>.js will maintain the table (run://spirit/state/icons/data/iconSet.json)"):
// { glyph: [keywords] } in the folder the node hands over as --state, never in git. "it is initialized from
// run://spirit/iconSet.json when it does not exist yet": the system set, which only Andy changes, is never written.
// ONLY THIS FILE WRITES IT (the box: "the page writes no file of its own"), whole, through a file beside it renamed over it,
// so a reader never meets half a set.
//
// IT PUBLISHES LIKE ANY OTHER SERVER (the box, 10; Andy: "there's no reason that icons shouldn't publish like any other
// server."): a changed row goes out on the app's one job, spirit.app.icons, before the answer, so every open page hears it
// through data.js: { icons: { row } }, or { icons: { glyph, removed: true } }.

require('../../spirit.js');
const fs = require('fs');
const path = require('path');
const appServer = spirit.require('spirit/appServer.js');
const limits = spirit.require('spirit/limits.js');

const argv = process.argv;
const at = argv.indexOf('--state');
const STATE = at !== -1 ? argv[at + 1] : '';
if (!STATE) { console.error('icons: no --state; the node that starts an app names its state folder'); process.exit(2); }
const SET = path.join(STATE, 'iconSet.json');
const SYSTEM = path.resolve(__dirname, '..', '..', 'iconSet.json');

// The same picture under another spelling: the variation selectors (U+FE0E, U+FE0F) are invisible, so a glyph pasted with
// or without one is the same icon (Andy: "the icon app allowed me to add a duplicate icon.... that shouldn't work").
function bare(g) { return String(g || '').replace(/[︎️]/g, ''); }
function readSet() {
  let text = null;
  try { text = fs.readFileSync(SET, 'utf8'); } catch (e) { text = null; }
  if (text === null) { try { text = fs.readFileSync(SYSTEM, 'utf8'); } catch (e) { text = '{}'; } }
  let set = {};
  try { set = JSON.parse(text); } catch (e) { set = {}; }
  return set && typeof set === 'object' && !Array.isArray(set) ? set : {};
}
function writeSet(set) {
  fs.mkdirSync(STATE, { recursive: true });
  const tmp = SET + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(set, null, 2) + '\n');
  fs.renameSync(tmp, SET);
}
function known(set, glyph) { return Object.keys(set).filter(function (g) { return bare(g) === bare(glyph); })[0] || ''; }
function rowOf(glyph, words) { return { glyph: glyph, keywords: Array.isArray(words) ? words.map(String) : [] }; }
function words(list) { return (Array.isArray(list) ? list : []).map(function (w) { return String(w).trim(); }).filter(Boolean); }
// A row seen by its glyph and keywords, as the shared search reads it.
function itemOf(glyph, keywords) { return { key: glyph, label: JSON.stringify(rowOf(glyph, keywords)) }; }
function matchesText(glyph, keywords, text) {
  if (!text) return true;
  const t = text.toLowerCase();
  return bare(glyph) === bare(text) || keywords.some(function (w) { return String(w).toLowerCase().indexOf(t) !== -1; });
}

const OPS = ['search', 'get', 'add', 'set', 'delete'];
function bad(why) { const e = new Error('bad-request'); e.refusal = 'bad-request'; e.extra = { why: why }; return e; }
function accepts(a) {
  if (!a || typeof a !== 'object' || Array.isArray(a) || OPS.indexOf(a.op) === -1) return false;
  const allowed = ['op', 'glyph', 'keywords', 'text'];
  if (Object.keys(a).some(function (k) { return allowed.indexOf(k) === -1; })) return false;
  if ('glyph' in a && typeof a.glyph !== 'string') return false;
  if ('text' in a && typeof a.text !== 'string') return false;
  if ('keywords' in a && !(Array.isArray(a.keywords) && a.keywords.every(function (w) { return typeof w === 'string'; }))) return false;
  if ((a.op === 'get' || a.op === 'delete' || a.op === 'add' || a.op === 'set') && !String(a.glyph || '').trim()) return false;
  return true;
}

function handle(a) {
  const set = readSet();
  if (a.op === 'search') {
    // NO LIST, A SEARCH (Andy's rule): every icon that matches, cut to one answer, with more past it.
    const text = String(a.text || '').trim();
    const items = [];
    let size = 64;
    let more = false;
    const room = limits.ANSWER_MAX - 512;
    Object.keys(set).forEach(function (g) {
      if (more) return;
      const kw = Array.isArray(set[g]) ? set[g] : [];
      if (!matchesText(g, kw, text)) return;
      const item = itemOf(g, kw);
      const n = Buffer.byteLength(JSON.stringify(item)) + 1;
      if (size + n > room) { more = true; return; }
      size += n;
      items.push(item);
    });
    return Promise.resolve({ items: items, more: more });
  }
  const glyph = String(a.glyph).trim();
  const have = known(set, glyph);
  if (a.op === 'get') return Promise.resolve(have ? { row: rowOf(have, set[have]) } : { row: null });
  if (a.op === 'add') {
    // A DUPLICATE IS NOT ADDED (Andy: "that shouldn't work"), and the set is not written: the answer names the icon there.
    if (have) return Promise.resolve({ added: false, known: have, row: rowOf(have, set[have]) });
    // A NEW ICON GOES ON TOP, where the add row is: a search with no words answers the set from its first icon, cut to one
    // answer, so an icon written last would never be among what a page that opens later is first shown.
    const next = {};
    next[glyph] = words(a.keywords);
    Object.keys(set).forEach(function (g) { next[g] = set[g]; });
    writeSet(next);
    return publish({ icons: { row: rowOf(glyph, next[glyph]) } }).then(function () { return { added: true, row: rowOf(glyph, next[glyph]) }; });
  }
  if (a.op === 'set') {
    if (!have) return Promise.resolve({ changed: false });
    set[have] = words(a.keywords);
    writeSet(set);
    return publish({ icons: { row: rowOf(have, set[have]) } }).then(function () { return { changed: true, row: rowOf(have, set[have]) }; });
  }
  // delete
  if (!have) return Promise.resolve({ deleted: false });
  delete set[have];
  writeSet(set);
  return publish({ icons: { glyph: have, removed: true } }).then(function () { return { deleted: true, glyph: have }; });
}
// THE PUBLISH IS ON THE NODE BEFORE THE ANSWER: a one-shot run is ended once it has answered, and spirit.event.publish
// posts without waiting, so its post would die with the run. The same post, event.publish with this job's id and the row
// as its app (spirit.js), awaited: spirit.job.report({ app }). One that cannot reach the node leaves the answer standing:
// the file is written, the next search reads it.
function publish(row) { return Promise.resolve(spirit.job.report({ app: row })).then(function () {}, function () {}); }

appServer.serve({
  icon: {
    request: { op: '', glyph: '', keywords: [''], text: '' },
    reply: {},
    accepts: accepts,
    handler: function (a) {
      if (!accepts(a)) throw bad('op one of ' + OPS.join(', ') + '; a glyph for get, add, set and delete');
      return handle(a);
    },
  },
}, {});
