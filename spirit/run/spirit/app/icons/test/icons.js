'use strict';

// spirit/run/spirit/app/icons/test/icons.js
// The tests of the Icons app, spirit/app/icons/, and of no other module (spec: ./icons.md; goal/G43.19, box v16). Andy:
// "icons is an app with a face, and an api, no fucking process for some trivial shit like a quickie applet", "for apps
// with only shell:mount:true and node:mount:false or missing, BUT with a api.js and data.js, the node must execute
// spirit/app/<name>/<name>.js with the request, instead of routing it to a server, like a cgi-script, and that process
// lives only as long as the request.", "there's no reason that icons shouldn't publish like any other server."
// A scratch node of the tracked files with Icons switched on, a real Chrome on its face page; neither Andy's node nor an
// agent's is touched. The verbs are read from the app's own api.js and the face is driven by Andy's own words for it
// (G41.27: "[➕] [an icon:paste] [keywords, comma separated][Add]"), so no name the box left open is guessed. What was
// written is read from the disc, what runs from the machine's process list.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
const APP = path.join(RUN, 'spirit', 'app', 'icons');

// The code with its comments blanked, so a word in a comment is no call. Strings are kept whole.
function code(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '/' && n === '*') { while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; } out += '  '; i += 2; continue; }
    if (c === '\'' || c === '"' || c === '`') {
      const q = c; out += c; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') { out += src[i]; i++; } out += src[i]; i++; }
      out += q; i++; continue;
    }
    out += c; i++;
  }
  return out;
}
function read(f) { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return null; } }
function json(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }

// THE RUNS OF ONE APP'S SCRIPT ON THIS SCRATCH NODE: every process whose command line runs spirit/app/<name>/<name>.js of
// the scratch tree (by its path or, run by a relative one, by its working folder). Icons by default.
function iconsProcesses(root, name) {
  const n = name || 'icons';
  const want = new RegExp('spirit[\\\\/]app[\\\\/]' + n + '[\\\\/]' + n + '\\.js');
  const out = [];
  if (process.platform === 'win32') {
    let text = '';
    try { text = execSync('powershell -NoProfile -Command "Get-CimInstance Win32_Process | ForEach-Object { [string]$_.ProcessId + \' \' + $_.CommandLine }"', { encoding: 'utf8', maxBuffer: 1 << 24 }); } catch (e) { text = ''; }
    text.split(/\r?\n/).forEach(function (l) { if (want.test(l) && l.toLowerCase().indexOf(root.toLowerCase()) !== -1) out.push(l.split(' ')[0]); });
    return out;
  }
  let pids = [];
  try { pids = fs.readdirSync('/proc').filter(function (p) { return /^\d+$/.test(p); }); } catch (e) { pids = []; }
  pids.forEach(function (p) {
    let cmd = '';
    let cwd = '';
    try { cmd = fs.readFileSync('/proc/' + p + '/cmdline', 'utf8').split('\0').join(' '); } catch (e) { return; }
    if (!want.test(cmd)) return;
    try { cwd = fs.readlinkSync('/proc/' + p + '/cwd'); } catch (e) { cwd = ''; }
    if (cmd.indexOf(root) !== -1 || cwd.indexOf(root) === 0) out.push(p);
  });
  return out;
}

test.startTest('icons: the Icons app, a face and an api, run by the node per request, with no process of its own (goal/G43.19)');

(async function () {
  test.subHeading('the box: "a face-only app get\'s api.js, data.js, node<Name>.js, browser<Name>.js" (Q5, Q6)');
  ['api.js', 'data.js', 'icons.js', 'nodeIcons.js', 'browserIcons.js'].forEach(function (f) {
    ok(fs.existsSync(path.join(APP, f)), 'spirit/app/icons/' + f + ' is there', 'spirit/app/icons/' + f + ' is not there');
  });
  ok(!fs.existsSync(path.join(APP, 'api')), 'api.js at the app\'s top, no api/ folder (Q5)', 'spirit/app/icons/api/ stands');
  const own = json(path.join(APP, 'icons.json')) || {};
  ok(!(own.node && own.node.mount === true) && !!(own.shell && own.shell.mount === true), 'the box, 1: "icons.json keeps node mount false and shell mount true"', 'icons.json says ' + short({ node: own.node, shell: own.shell }));
  const main = code(read(path.join(APP, 'icons.js')) || '');
  ok(/require\(\s*['"]\.\/nodeIcons\.js['"]\s*\)/.test(main), 'the box, 7: icons.js, run in node, does require(\'./nodeIcons.js\')', 'icons.js requires no ./nodeIcons.js');
  ['icons.js', 'browserIcons.js'].forEach(function (f) {
    const c = code(read(path.join(APP, f)) || '');
    ok(c !== '' && !/activateApp/.test(c), f + ' mounts no longer through spirit.shell.activateApp', f + ' still calls activateApp, or is not there');
    ok(c !== '' && !/\bfs\s*\.\s*(saveFile|save|deleteFile|delete)\b|\.saveFile\s*\(/.test(c), 'the box: "the page writes no file of its own": ' + f + ' calls no fs save or delete', f + ' still writes through the fs family, or is not there');
  });
  let verbs = [];
  try { verbs = Object.keys(require(path.join(APP, 'api.js')).verbs || {}); } catch (e) { verbs = []; }
  ok(verbs.length >= 1, 'the world: api.js names its verbs: ' + verbs.join(', '), 'api.js names no verbs, so no call is judged');

  // Desk switched on beside it: a permanent server, so the process list is shown to find a running app script.
  const node = await scratchNode({ servers: ['icons', 'desk'] });
  const chrome = await chromePage(findChrome());
  let other = null;
  try {
    if (!node.up || chrome.error) { test.fail('no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    if (!node.root) { test.fail('the scratch node is shared, so its disc cannot be read: nothing judged'); return; }
    const run = path.join(node.root, 'spirit', 'run');
    const SET = path.join(run, 'spirit', 'state', 'icons', 'data', 'iconSet.json');
    const SYSTEM = path.join(run, 'spirit', 'iconSet.json');
    const system = json(SYSTEM) || {};
    const systemText = read(SYSTEM);
    // GLYPHS THE SYSTEM SET DOES NOT HOLD (cw found it: the set starts as the system set, so a glyph of it is a duplicate,
    // refused by Andy's rule, and nothing would be written). Compared without the invisible variation selectors.
    const bare = function (g) { return String(g || '').replace(/[\uFE0E\uFE0F]/g, ''); };
    const known = Object.keys(system).map(bare);
    // Single pictures, one code point each, taken in order from the pictograph blocks.
    const CANDIDATES = [];
    for (let cp = 0x1F300; cp <= 0x1FAFF && CANDIDATES.length < 2000; cp++) { const g = String.fromCodePoint(cp); if (/\p{Extended_Pictographic}/u.test(g)) CANDIDATES.push(g); }
    const fresh = CANDIDATES.filter(function (g) { return known.indexOf(bare(g)) === -1; });
    ok(fresh.length >= 7, 'the world: seven glyphs the system set does not hold: ' + fresh.slice(0, 7).join(' '), 'only ' + fresh.length + ' candidate glyphs are not in spirit/iconSet.json: nothing to add');
    if (fresh.length < 7) return;
    const [G1, G2, ...REST] = fresh;
    const ask = async function (call, args) {
      const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) });
      const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch (e) { b = null; }
      return { status: r.status, body: b, text: t };
    };
    const none = function () { return iconsProcesses(node.root).length === 0; };

    test.subHeading('the box, 1: "icons has no running process"; 8: the api tree asks it, and its run ends');
    ok(await until(function () { return Promise.resolve(iconsProcesses(node.root, 'desk').length === 1); }, 15000), 'the world: the process list finds the permanent desk.js running, once', 'the process list finds ' + short(iconsProcesses(node.root, 'desk')) + ' of desk.js, so it cannot judge a run');
    ok(none(), 'switched on and idle, no process runs icons.js', 'icons.js runs while idle: ' + short(iconsProcesses(node.root)));
    const tree = await ask('api', {});
    const branch = tree.body && tree.body.icons;
    ok(tree.status === 200 && !!branch, 'the api tree holds the icons branch, answered from icons.js', 'the tree: ' + tree.status + ' ' + short(tree.body && Object.keys(tree.body)));
    verbs.forEach(function (v) { ok(JSON.stringify(branch || '').indexOf(v) !== -1, 'its branch names ' + v, 'its branch does not name ' + v + ': ' + short(branch)); });
    ok(await until(function () { return Promise.resolve(none()); }, 3000), 'and once the tree is answered no icons.js runs', 'icons.js still runs after the tree: ' + short(iconsProcesses(node.root)));

    test.subHeading('the box, 10: "The node keeps one job for the app, module spirit.app.icons, open while the app is switched on"');
    const job = await ask('jobs.get', { key: 'spirit.app.icons' });
    const j0 = (job.body && job.body.job) || null;
    ok(!!j0 && !/end|exit|stop|cancel|fail/i.test(String(j0.status || '')), 'spirit.app.icons is a job, open', 'jobs.get spirit.app.icons: ' + short(job.body));

    test.subHeading('the face, by its tile (the box: "its tile opens no face"), and Andy\'s add row: "[➕] [an icon:paste] [keywords, comma separated][Add]"');
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    const open = async function (page) {
      const made = await page.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/app/appSelector.js"); }).then(function () { var old = document.getElementById("faces"); if (old) old.remove(); var c = document.createElement("div"); c.id = "faces"; c.style.cssText = "position:fixed;left:0;top:0;width:1200px;height:800px;display:flex;flex-direction:column;background:#111;z-index:9"; document.body.appendChild(c); window.fsel = spirit.elements.appSelector.create(c, { face: "tiles" }); if (window.fsel.parentNode !== c) c.appendChild(window.fsel); return "made"; }, function (e) { return String(e && e.message || e); })');
      if (made !== 'made') return 'appSelector: ' + made;
      const tile = 'Array.prototype.filter.call(document.querySelectorAll("#faces .app-icon"), function (t) { return t.offsetParent !== null && String(t.textContent).indexOf("Icons") !== -1; })[0]';
      if (!await until(function () { return page.evaluate('!!' + tile); }, 10000)) return 'no Icons tile';
      await page.evaluate('(function () { window.pageErrors = []; window.addEventListener("error", function (e) { window.pageErrors.push(String(e.message)); }); ' + tile + '.click(); return true; }())');
      return 'opened';
    };
    const LAYER = 'Array.prototype.filter.call(document.querySelectorAll("#faces .app-container"), function (c) { return c.offsetParent !== null; })[0]';
    const field = function (which) { return '(function () { var l = ' + LAYER + '; if (!l) return null; return Array.prototype.filter.call(l.querySelectorAll("input"), function (i) { var p = String(i.placeholder || ""); return i.getClientRects().length && (' + (which === 'glyph' ? '/icon/i.test(p) && !/keyword/i.test(p)' : '/keywords, comma separated/i.test(p)') + '); })[0] || null; }())'; };
    const ADD = '(function () { var l = ' + LAYER + '; if (!l) return null; return Array.prototype.filter.call(l.querySelectorAll("button"), function (b) { return b.getClientRects().length && String(b.textContent).trim() === "Add"; })[0] || null; }())';
    const layerText = function (page) { return page.evaluate('(function () { var l = ' + LAYER + '; return l ? String(l.innerText) : ""; }())'); };
    const opened = await open(chrome);
    ok(opened === 'opened', 'the world: the Icons tile is there and pressed', 'the Icons tile: ' + opened);
    const drew = await until(function () { return chrome.evaluate('!!' + field('glyph') + ' && !!' + field('keywords') + ' && !!' + ADD); }, 10000);
    ok(drew, 'its tile opens its face: an icon to paste, its keywords, comma separated, and Add', 'no add row in the layer; page errors ' + short(await chrome.evaluate('JSON.stringify(window.pageErrors || [])')) + '; the layer: ' + short(await layerText(chrome)));
    if (!drew) return;
    ok((await layerText(chrome)).indexOf('➕') !== -1 || await chrome.evaluate('(function () { var l = ' + LAYER + '; return !!l && l.innerHTML.indexOf("➕") !== -1; }())'), 'its add row shows ➕', 'no ➕ in the layer');
    const sample = Object.keys(system)[0];
    ok(!!sample && await until(function () { return layerText(chrome).then(function (t) { return t.indexOf(sample) !== -1; }); }, 8000), 'with no set of its own, the list shows the system set, ' + sample + ' among it (the box: "initialized from run://spirit/iconSet.json")', 'the list does not show ' + sample + ': ' + short(await layerText(chrome)));
    ok(!fs.existsSync(SET), 'the world: no spirit/state/icons/data/iconSet.json yet', 'spirit/state/icons/data/iconSet.json was there before any change');

    // Every call the page makes from here on, written down.
    await chrome.evaluate('(function () { window.__posts = []; var f = window.fetch; window.fetch = function (u, o) { if (/\\/api\\//.test(String(u)) && o && o.body) window.__posts.push(String(o.body).slice(0, 200)); return f.apply(this, arguments); }; return true; }())');
    const add = function (page, glyph, words) { return page.evaluate('(function () { var g = ' + field('glyph') + ', k = ' + field('keywords') + ', b = ' + ADD + '; if (!g || !k || !b) return false; g.value = ' + JSON.stringify(glyph) + '; g.dispatchEvent(new Event("input", { bubbles: true })); k.value = ' + JSON.stringify(words) + '; k.dispatchEvent(new Event("input", { bubbles: true })); b.click(); return true; }())'); };

    test.subHeading('Andy (G41.27): an Add with no icon says "paste an icon first", and writes nothing');
    await add(chrome, '', 'nothing');
    ok(await until(function () { return layerText(chrome).then(function (t) { return t.indexOf('paste an icon first') !== -1; }); }, 3000), 'it says paste an icon first', 'an empty Add said: ' + short(await layerText(chrome)));
    await sleep(800);
    ok(!fs.existsSync(SET), 'and nothing is written', 'an empty Add wrote ' + short(read(SET)));

    test.subHeading('the box: "only ./nodeIcons.js writes the table", initialized from spirit/iconSet.json, "the page asks icons through its api branch"');
    await add(chrome, G1, 'flamingo, bird');
    const wrote = await until(function () { return Promise.resolve(((json(SET) || {})[G1] || []).join(',') === 'flamingo,bird'); }, 10000);
    ok(wrote, 'an Add writes ' + G1 + ' with its keywords into spirit/state/icons/data/iconSet.json', 'after the Add the set holds ' + short(read(SET)));
    const set1 = json(SET) || {};
    const lost = Object.keys(system).filter(function (g) { return !(g in set1); });
    ok(wrote && !lost.length, 'the set began as the system set: every one of its ' + Object.keys(system).length + ' icons is in it', lost.length + ' system icons are not: ' + short(lost));
    ok(read(SYSTEM) === systemText, 'spirit/iconSet.json itself is not written', 'spirit/iconSet.json changed');
    const posts = JSON.parse(await chrome.evaluate('JSON.stringify(window.__posts || [])'));
    ok(posts.some(function (p) { return /"call"\s*:\s*"icons\./.test(p); }), 'the page asked icons.<verb>, its own branch', 'the page asked no icons verb: ' + short(posts));
    ok(!posts.some(function (p) { return /"call"\s*:\s*"fs\.(save|saveFile|delete|deleteFile)/.test(p); }), 'and wrote no file through the fs family', 'the page wrote through fs: ' + short(posts.filter(function (p) { return /"fs\./.test(p); })));
    ok(await until(function () { return layerText(chrome).then(function (t) { return t.indexOf(G1) !== -1; }); }, 8000), 'the list shows ' + G1 + ', no reload', 'the list never showed ' + G1);
    ok(await until(function () { return Promise.resolve(none()); }, 3000), 'and its run ended: no icons.js runs', 'icons.js still runs after the Add: ' + short(iconsProcesses(node.root)));

    test.subHeading('the box, 10: "a run publishes before it ends and data.js on every open page follows that one job"');
    other = await chromePage(findChrome());
    if (other.error) { test.fail('no second Chrome: the other page is not judged. ' + short(other.error)); other = null; }
    if (other) {
      await other.send('Page.navigate', { url: node.base + '/face.html' });
      await until(function () { return other.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
      const o2 = await open(other);
      const listed = o2 === 'opened' && await until(function () { return layerText(other).then(function (t) { return t.indexOf(G1) !== -1; }); }, 10000);
      ok(listed, 'the world: a second page shows the set, ' + G1 + ' in it', 'the second page: ' + o2 + ' ' + short(await layerText(other)));
      await add(chrome, G2, 'giraffe');
      ok(await until(function () { return layerText(other).then(function (t) { return t.indexOf(G2) !== -1; }); }, 10000), 'the other page shows ' + G2 + ', added on the first, with no reload and no search of its own', 'the other page never showed ' + G2 + ': ' + short(await layerText(other)));
    }
    const job2 = await ask('jobs.get', { key: 'spirit.app.icons' });
    const j2 = (job2.body && job2.body.job) || null;
    ok(!!j2 && !/end|exit|stop|cancel|fail/i.test(String(j2.status || '')), 'after the runs it is the same job, spirit.app.icons, still open', 'jobs.get spirit.app.icons after the runs: ' + short(job2.body));

    test.subHeading('the attacker: a duplicate, five Adds at once, a page writing the table itself');
    const before = read(SET);
    await add(chrome, G1, 'pink');
    await sleep(2000);
    ok(read(SET) === before, 'an icon already in the set is not added again, and the set is not written (Andy: "that shouldn\'t work")', 'a second ' + G1 + ' changed the set: ' + short(((json(SET) || {})[G1])));
    // The box, 9: "one run per app at a time: calls to the same one-shot app wait their turn, so two saves never write iconSet.json at once."
    const five = REST.slice(0, 5);
    let most = 0;
    const watching = (async function () { const end = Date.now() + 12000; while (Date.now() < end) { most = Math.max(most, iconsProcesses(node.root).length); await sleep(15); } }());
    await chrome.evaluate('(function () { var g = ' + field('glyph') + ', k = ' + field('keywords') + ', b = ' + ADD + '; ' + JSON.stringify(five) + '.forEach(function (x, i) { g.value = x; g.dispatchEvent(new Event("input", { bubbles: true })); k.value = "five" + i; k.dispatchEvent(new Event("input", { bubbles: true })); b.click(); }); return true; }())');
    const allFive = await until(function () { const s = json(SET) || {}; return Promise.resolve(five.every(function (x) { return x in s; })); }, 12000);
    await watching;
    const s5 = json(SET);
    ok(allFive, 'five Adds at once: all five are in the set, none lost to another\'s write', 'after five Adds at once the set holds ' + short(five.filter(function (x) { return s5 && x in s5; })));
    ok(!!s5 && G1 in s5 && G2 in s5, 'and what was there stays, the file whole JSON', 'after five at once the set is ' + short(read(SET)));
    ok(most >= 1, 'the world: a run of icons.js was seen while they were answered', 'no run of icons.js was ever seen, so "one at a time" judged nothing');
    ok(most <= 1, 'never two runs of icons.js at once (the box, 9)', most + ' runs of icons.js at once');
    const forged = await chrome.evaluate('window.spirit.ready.then(function (s) { return s.fs.saveFile("spirit/state/icons/data/iconSet.json", "{}"); }).then(function (r) { return JSON.stringify(r); }, function (e) { return "refused: " + String(e && e.message || e); })');
    await sleep(800);
    ok(G1 in (json(SET) || {}), 'a page writing spirit/state/icons/data/iconSet.json itself is refused, and the set stands', 'the page\'s own write answered ' + short(forged) + ' and the set is ' + short(read(SET)));

    test.subHeading('the box, 4: "Switched off, its row goes, and a call to it answers app-not-served"');
    const off = await ask('app.active', { key: 'icons', active: false });
    ok(off.status === 200, 'the world: Icons switched off', 'app.active icons false: ' + short(off));
    await sleep(1500);
    const asked = verbs.length ? await ask('icons.' + verbs[0], {}) : { text: '' };
    ok(/app-not-served/.test(asked.text), 'icons.' + (verbs[0] || '<verb>') + ' answers app-not-served', 'switched off, icons.' + (verbs[0] || '<verb>') + ' answered ' + asked.status + ' ' + short(asked.text));
    const tOff = await ask('api', {});
    ok(tOff.status === 200 && !(tOff.body && tOff.body.icons), 'the api tree holds no icons branch', 'switched off, the tree still holds icons: ' + short(tOff.body && tOff.body.icons));
    const jOff = await ask('jobs.get', { key: 'spirit.app.icons' });
    const jo = (jOff.body && jOff.body.job) || null;
    ok(!jo || /end|exit|stop|cancel|off/i.test(String(jo.status || '')), 'its job is no longer open', 'switched off, spirit.app.icons is ' + short(jOff.body));
    ok(none(), 'and nothing runs icons.js', 'switched off, icons.js runs: ' + short(iconsProcesses(node.root)));
    const on = await ask('app.active', { key: 'icons', active: true });
    ok(on.status === 200, 'the world: Icons switched on again', 'app.active icons true: ' + short(on));
    const back = await until(function () { return ask('api', {}).then(function (t) { return t.status === 200 && !!(t.body && t.body.icons); }); }, 10000);
    ok(back, 'switched on again, its branch is back, no restart of the node', 'switched on again, the tree holds no icons');
  } finally {
    [chrome, other].forEach(function (c) {
      if (!c) return;
      try { if (c.sock) c.sock.close(); } catch (e) { /* gone */ }
      try { if (c.kid) c.kid.kill(); } catch (e) { /* gone */ }
    });
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
