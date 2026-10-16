'use strict';

// spirit/test/deskAgentToolsMore.js
// goal/G24.4. Red on today's code; claude-windows wrote it and builds it (one agent). The item's box is the record,
// with Andy's ruling on the shape:
//   introspect lists names only (labels no longer carry descriptions), so a family always fits one answer;
//   deskAgent may withhold verbs after reading the list, then asks AGENTS.<verb> for each kept verb's details;
//   no paging; a listing that still says more fails loudly in a census.
//
// WHERE, READ AT 1a77dee0: introSpector.js's AGENTS.introspect offers each verb file's description as its label, in
// one answer cut by the bucket (more true past it); tools.js describe(ns) asks AGENTS.introspect once, then
// AGENTS.<verb> for every listed verb, and has no way to withhold one.
//
// THE WITHHOLD HOOK PROPOSED (this suite fixes it): createTools({..., withhold: ['<namespace>.<verb>', ...]}): a verb
// named there is not offered, and its AGENTS.<verb> is never asked.
//
// WHAT IS ASSERTED
//   1. a scratch family of 40 verbs with 400-byte descriptions (together far past one answer): AGENTS.introspect lists
//      every name, more false, and no label carries its verb's description.
//   2. tools.js describe over that family offers every verb, each with its description (from AGENTS.<verb>).
//   3. withhold: with withhold ['scratch.v07', 'scratch.v33'] those two are not offered and their AGENTS.<verb> is
//      never asked; the other 38 are offered.
//   4. the census: every real family (process/js/<server>/ and js/<namespace>/ with an AGENTS.md): its listing says
//      more false and lists every verb file.
// rule/11: through testSupport only; reads files and a scratch folder, starts nothing.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G24.4: ';
const RUN = path.join(__dirname, '..', 'run');
const TOOLS = path.join(RUN, 'process', 'js', 'deskAgent', 'tools.js');
const introSpector = require('../run/js/introSpector.js');
const ANSWER_MAX = require('../run/js/appClient.js').ANSWER_MAX;

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function verbFiles(dir, manifest) {
  let names = [];
  try { names = fs.readdirSync(dir); } catch (e) { return []; }
  return names.filter(function (n) {
    if (!/\.json$/.test(n) || n === manifest) return false;
    if (!/^[a-z_][A-Za-z0-9_.-]{0,63}$/.test(n.slice(0, -5))) return false;
    try { const p = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8')); return p && typeof p === 'object' && !Array.isArray(p) && typeof p.description === 'string'; } catch (e) { return false; }
  }).map(function (n) { return n.slice(0, -5); }).sort();
}
async function introspect(made, prefix) {
  const h = made.verbs[prefix + 'AGENTS.introspect'];
  if (!h) return null;
  const r = await h.handler({});
  return { items: (r && r.items) || [], keys: ((r && r.items) || []).map(function (i) { return i.key; }), more: !!(r && r.more) };
}
function routeOver(made, asks) {
  return {
    ask: function (verb) {
      asks.push(verb);
      const h = made.verbs[verb];
      let body = null;
      try { body = h ? h.handler({}) : { ok: false, code: 'no-such-verb' }; } catch (e) { body = { ok: false, code: 'refused' }; }
      return Promise.resolve(body).then(function (b) { return { status: b && b.ok === false ? 404 : 200, body: b, text: JSON.stringify(b) }; });
    },
    verb: function (stem) { return stem; },
    family: function (name) { return 'AGENTS.' + name; },
  };
}

test.startTest('goal/G24.4: a family\'s listing is names only and always whole; deskAgent offers every verb it keeps');

async function suite() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-toolsmore-'));
  try {
    const STEMS = [];
    const DESC = {};
    fs.writeFileSync(path.join(scratch, 'AGENTS.md'), '# scratch\n');
    for (let i = 1; i <= 40; i++) {
      const stem = 'v' + String(i).padStart(2, '0');
      STEMS.push(stem);
      let d = 'Verb ' + stem + ' does its own thing, described at length. ';
      while (d.length < 400) d += 'More words about ' + stem + '. ';
      DESC[stem] = d.slice(0, 400);
      fs.writeFileSync(path.join(scratch, stem + '.json'), JSON.stringify({ description: DESC[stem], request: { id: '' } }));
    }
    const made = introSpector.family(scratch, { declared: STEMS, manifest: 'scratch.json' });
    const total = STEMS.reduce(function (s, v) { return s + Buffer.byteLength(DESC[v]); }, 0);

    test.subHeading('1. the listing is names only, whole, more false');
    if (total > ANSWER_MAX) test.check('the world: 40 descriptions of 400 bytes, ' + total + ' bytes together, past one answer (' + ANSWER_MAX + ')');
    else test.fail('the world: the descriptions are only ' + total + ' bytes');
    const got = await introspect(made, '');
    const missing = STEMS.filter(function (s) { return got.keys.indexOf(s) === -1; });
    if (!missing.length && got.more === false) test.check('AGENTS.introspect lists all 40 names, more false');
    else test.fail(OWED + 'AGENTS.introspect listed ' + got.keys.length + ' of 40, more ' + got.more + '; missing ' + short(missing));
    const carrying = got.items.filter(function (i) { return DESC[i.key] && String(i.label || '').indexOf(DESC[i.key].slice(0, 40)) !== -1; }).map(function (i) { return i.key; });
    if (got.items.length && !carrying.length) test.check('no label carries its verb\'s description');
    else test.fail(OWED + carrying.length + ' label(s) carry the description, e.g. ' + short(got.items[0]));

    test.subHeading('2. deskAgent offers every verb with its description');
    const mod = require(TOOLS);
    const asks = [];
    const tools = mod.createTools({ routes: { scratch: routeOver(made, asks) }, room: 4000 });
    const described = await tools.describe('scratch');
    const byName = {};
    (described || []).forEach(function (t) { byName[t.function.name] = t.function; });
    const notOffered = STEMS.filter(function (s) { return !byName['scratch_' + s]; });
    const wrongDesc = STEMS.filter(function (s) { return byName['scratch_' + s] && byName['scratch_' + s].description !== DESC[s]; });
    if (!notOffered.length && !wrongDesc.length) test.check('describe(scratch) offers all 40, each with its description');
    else test.fail(OWED + 'describe(scratch) does not offer ' + notOffered.length + ' (' + short(notOffered) + '); wrong description on ' + short(wrongDesc));

    test.subHeading('3. withhold: a withheld verb is not offered and never asked');
    const asks2 = [];
    let tools2 = null;
    try { tools2 = mod.createTools({ routes: { scratch: routeOver(made, asks2) }, room: 4000, withhold: ['scratch.v07', 'scratch.v33'] }); } catch (e) { tools2 = null; }
    const described2 = tools2 ? await tools2.describe('scratch') : [];
    const names2 = (described2 || []).map(function (t) { return t.function.name; });
    const kept = STEMS.filter(function (s) { return s !== 'v07' && s !== 'v33'; });
    const keptMissing = kept.filter(function (s) { return names2.indexOf('scratch_' + s) === -1; });
    if (names2.indexOf('scratch_v07') === -1 && names2.indexOf('scratch_v33') === -1 && asks2.indexOf('AGENTS.v07') === -1 && asks2.indexOf('AGENTS.v33') === -1 && !keptMissing.length && names2.length === 38) test.check('v07 and v33 are withheld and never asked; the other 38 are offered');
    else test.fail(OWED + 'with withhold [scratch.v07, scratch.v33]: v07 offered ' + (names2.indexOf('scratch_v07') !== -1) + ', asked ' + (asks2.indexOf('AGENTS.v07') !== -1) + '; v33 offered ' + (names2.indexOf('scratch_v33') !== -1) + ', asked ' + (asks2.indexOf('AGENTS.v33') !== -1) + '; ' + names2.length + ' offered, kept ones missing ' + short(keptMissing));
  } finally {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }

  test.subHeading('4. the census: no real family\'s listing says more');
  const folders = [];
  fs.readdirSync(path.join(RUN, 'process', 'js')).forEach(function (n) {
    const dir = path.join(RUN, 'process', 'js', n);
    if (fs.existsSync(path.join(dir, 'AGENTS.md'))) folders.push({ name: 'process/js/' + n, dir: dir, manifest: n + '.json', prefix: '' });
  });
  fs.readdirSync(path.join(RUN, 'js')).forEach(function (n) {
    const dir = path.join(RUN, 'js', n);
    if (fs.statSync(dir).isDirectory() && fs.existsSync(path.join(dir, 'AGENTS.md'))) folders.push({ name: 'js/' + n, dir: dir, manifest: '', prefix: n + '.' });
  });
  if (folders.some(function (f) { return f.name === 'process/js/desk'; }) && folders.length > 3) test.check('the world: ' + folders.length + ' families found');
  else test.fail('the world: the families found are ' + short(folders.map(function (f) { return f.name; })));
  for (const f of folders) {
    const stems = verbFiles(f.dir, f.manifest);
    if (!stems.length) continue;
    const made = introSpector.family(f.dir, { declared: stems, manifest: f.manifest, prefix: f.prefix });
    const got = await introspect(made, f.prefix);
    const missing = stems.filter(function (s) { return !got || got.keys.indexOf(f.prefix + s) === -1; });
    if (got && got.more === false && !missing.length) test.check(f.name + ': ' + stems.length + ' verbs listed, more false');
    else test.fail('CENSUS: ' + f.name + ' lists ' + (got ? got.keys.length : 0) + ' of ' + stems.length + ' verbs with more ' + (got && got.more) + ': a listing must fit one answer; missing ' + short(missing));
  }
}

suite().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
