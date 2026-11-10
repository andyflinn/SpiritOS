'use strict';

// spirit/run/spirit/app/shell/test/shell.js
// THE SHELL APP, AND A SHELL THAT REPLACES ITSELF (goal/G43.18, box v29, "The shell" and "Join"; spec: ./shell.md). A real
// node on a scratch copy of the tracked files, with a shell-worthy app of the test's own beside the shell app, and real
// clicks in a real Chrome on the page Andy uses at home, /face.html. Neither Andy's node nor an agent's is touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { freePort, until, sleep, chromePage, findChrome } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }

// The test's own shell: it draws one line and nothing else, and knows nothing of Join.
const MARK = 'zz shell drawn';
const ZZ = { identity: { label: 'Zz Shell', icon: '🧪' }, shell: { true: true, mount: true, tile: true } };
const ZZ_JS = '(function () { var b = document.createElement("div"); b.id = "zzShell"; b.textContent = ' + JSON.stringify(MARK) + '; document.body.appendChild(b); }());\n';
function scratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-shellapp-'));
  execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); })
    .forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
  const run = path.join(root, 'spirit', 'run');
  const zz = path.join(run, 'spirit', 'app', 'zzshell');
  fs.mkdirSync(zz, { recursive: true });
  fs.writeFileSync(path.join(zz, 'zzshell.json'), JSON.stringify(ZZ));
  fs.writeFileSync(path.join(zz, 'zzshell.js'), ZZ_JS);
  return { root: root, run: run };
}
async function call(base, verb, args) {
  try {
    const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
    const text = await r.text();
    return { status: r.status, text: text, body: parsed(text) };
  } catch (e) { return { status: 0, text: String(e && e.message), body: null }; }
}
async function boot(run) {
  const port = await freePort();
  const child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: run, stdio: 'ignore' });
  const base = 'http://127.0.0.1:' + port;
  const up = await until(function () { return call(base, 'api').then(function (r) { return r.status === 200; }); }, 60000);
  return { child: child, base: base, up: !!up };
}
function stop(c) { return new Promise(function (r) { if (!c || c.exitCode !== null) return r(); c.once('exit', function () { r(); }); c.kill(); setTimeout(r, 6000); }); }

test.startTest('shell.js: the shell app, and a shell that replaces itself (goal/G43.18)');

(async function () {
  const shellJson = readJson(path.join(RUN, 'spirit', 'app', 'shell', 'shell.json'));
  const SHELL_LABEL = String((shellJson && shellJson.identity && shellJson.identity.label) || '');
  ok(!!SHELL_LABEL, 'the world: the shell app has a label, ' + SHELL_LABEL, 'spirit/app/shell/shell.json gives no label: ' + short(shellJson));
  const LABELS = fs.readdirSync(path.join(RUN, 'spirit', 'app')).map(function (n) { const j = readJson(path.join(RUN, 'spirit', 'app', n, n + '.json')); return j && j.identity && j.identity.label; }).filter(Boolean).concat([ZZ.identity.label]);

  const s = scratch();
  let N = null;
  let c = null;
  try {
    N = await boot(s.run);
    ok(N.up, 'the world: a scratch node comes up', 'the scratch node did not come up: nothing judged');
    if (!N.up) return;
    const where = findChrome();
    if (!where) { test.fail('no Chrome here: nothing judged'); return; }
    c = await chromePage(where);
    if (c.error) { test.fail('Chrome: ' + c.error); return; }
    const open = async function () {
      await c.evaluate('window.__zzOld = true').catch(function () {});
      await c.send('Page.navigate', { url: N.base + '/face.html' });
      const up = await until(function () { return c.evaluate('!window.__zzOld && document.readyState === "complete" && !!window.spirit'); }, 20000);
      await sleep(4000);
      return up;
    };
    const loaded = function () { return c.evaluate('performance.getEntriesByType("resource").map(function (e) { return e.name.replace(/^https?:\\/\\/[^/]+/, ""); })'); };
    const text = function () { return c.evaluate('String(document.body.innerText || "")'); };

    test.subHeading('the box: "spirit/app/shell/ ... is the default for home and face on a first boot" (Q12: no spirit/state/shell.json)');
    ok(await open(), 'the world: the page opens', 'the page did not open: nothing judged');
    const first = await loaded();
    ok(first.some(function (n) { return /^\/spirit\/app\/shell\/shell\.js(\?|$)/.test(n); }), 'with no shell chosen the page loads spirit/app/shell/shell.js', 'it loaded: ' + short(first.filter(function (n) { return /\/app\//.test(n); })));
    ok(first.some(function (n) { return /^\/spirit\/element\/search\/app\.js(\?|$)/.test(n); }) && /\bContacts\b/.test(await text()), '"an app that wraps the app search": the app search is on the page, Contacts listed', 'the app search: ' + short(first.filter(function (n) { return /search/.test(n); })) + ', page: ' + short(await text()));

    // goal/G43.18, Andy: "the shell should exclude itself completely from the app-list, haha..."
    const keys = await c.evaluate('Array.prototype.slice.call(document.querySelectorAll("[data-key]")).filter(function (e) { return e.offsetParent !== null; }).map(function (e) { return e.getAttribute("data-key"); })');
    ok(keys.indexOf('contact') !== -1 && keys.indexOf('shell') === -1 && !new RegExp('(^|\\n)\\s*' + SHELL_LABEL + '\\s*(\\n|$)').test(await text()), 'Andy: "the shell should exclude itself completely from the app-list": Contacts listed, the shell not', 'the list shows: ' + short(keys));

    test.subHeading('the box: "RULE: a shell must be able to replace itself", "boot.js ... then loads the shell the node names"');
    const set = await call(N.base, 'node.shell', { at: 'home', name: 'zzshell' });
    ok(set.status === 200, 'the world: node.shell names zzshell at home', 'node.shell: ' + set.status + ' ' + short(set.text));
    await open();
    const second = await loaded();
    const drawn = await text();
    ok(drawn.indexOf(MARK) !== -1 && second.some(function (n) { return /^\/spirit\/app\/zzshell\/zzshell\.js(\?|$)/.test(n); }), 'the page loads the shell the node names, zzshell, and it draws', 'zzshell: ' + short(second.filter(function (n) { return /\/app\//.test(n); })) + ', page: ' + short(drawn));
    ok(drawn.indexOf(MARK) !== -1 && !second.some(function (n) { return /^\/spirit\/app\/shell\/shell\.js(\?|$)/.test(n); }) && !/\bContacts\b/.test(drawn), 'and nothing of the other shell, nor a desktop of boot.js\'s own', drawn.indexOf(MARK) !== -1 ? 'beside zzshell the page shows: ' + short(drawn) : 'zzshell never drew: nothing judged');

    // Q18, Andy: "join. not the shells job.": zzshell knows nothing of Join, and Join still shows a new node its steps.
    test.subHeading('the box: "Join shows a new user its steps on its own ... neither boot.js nor any shell decides it"');
    const steps = await call(N.base, 'jobs.list', {});
    test.comment('the scratch node is new: its join steps are open (' + short(steps.status) + ')');
    const joined = drawn.indexOf(MARK) !== -1 && await until(function () { return text().then(function (t) { return /\bJoin\b/.test(t); }); }, 10000);
    ok(joined, 'under a shell that knows nothing of it, Join shows itself', drawn.indexOf(MARK) !== -1 ? 'under zzshell no Join in 10 s: ' + short(await text()) : 'zzshell never drew: nothing judged');

    test.subHeading('the box: the two rows of the app detail, "shown only for an app whose <name>.json says shell:true:true"');
    await call(N.base, 'node.shell', { at: 'home', name: 'shell' });
    await open();
    const detail = function (key) {
      return c.evaluate('(function () { return spirit.ready.then(function (s) { return s.app.searchApp({ q: "" }); }).then(function (got) { var it = (got.items || []).filter(function (i) { return i.key === ' + JSON.stringify(key) + '; })[0]; if (!it) return "no row"; var row = Object.assign({ key: it.key }, JSON.parse(it.label || "{}")); return spirit.require("spirit/app/appSelector/detailElement.js").then(function () { var old = document.getElementById("zzDetail"); if (old) old.remove(); var h = document.createElement("div"); h.id = "zzDetail"; document.body.appendChild(h); spirit.element.spirit.app.appSelector.detailElement.create(h, { row: row, panel: true }); return "made"; }); }); }())');
    };
    const inDetail = function () { return c.evaluate('String((document.getElementById("zzDetail") || {}).innerText || "")'); };
    ok((await detail('contact')) === 'made', 'the world: Contacts\' detail is drawn', 'no detail for contact');
    await sleep(2000);
    const plain = await inDetail();
    ok(plain.length > 0 && !/Home shell|Face shell/.test(plain), 'Contacts, shell:true false: no Home shell or Face shell row', 'Contacts\' detail: ' + short(plain));
    ok((await detail('zzshell')) === 'made', 'the world: zzshell\'s detail is drawn', 'no detail for zzshell');
    await sleep(2000);
    const worthy = await inDetail();
    ok(/Home shell/.test(worthy) && /Face shell/.test(worthy), 'zzshell, shell:true true: a Home shell and a Face shell row', 'zzshell\'s detail: ' + short(worthy));
    // "the dropdown first showing the configured home shell": the shell app, by Q12 and as set back above.
    const rowText = function (words) { return c.evaluate('(function () { var d = document.getElementById("zzDetail"); var all = Array.prototype.slice.call(d.querySelectorAll("*")); var r = all.filter(function (e) { return e.children.length && String(e.innerText || "").indexOf(' + JSON.stringify(words) + ') !== -1; }).pop(); r = r && (r.closest(".shell-row-form") || r); if (!r) return ""; var i = r.querySelector("input"); return String(r.innerText || "") + " | " + (i ? i.value : ""); }())'); };
    const homeRow = await rowText('Home shell');
    ok(!!SHELL_LABEL && /Home shell/.test(homeRow) && homeRow.indexOf(SHELL_LABEL) !== -1 && homeRow.indexOf(ZZ.identity.label) === -1, 'its Home shell dropdown first shows the configured home shell, ' + SHELL_LABEL, 'the Home shell row: ' + short(homeRow));

    test.subHeading('the box: "Both dropdowns list only the apps whose <name>.json says shell:true:true"');
    for (const words of ['Home shell', 'Face shell']) {
      const opened = await c.evaluate('(function () { var d = document.getElementById("zzDetail"); var all = Array.prototype.slice.call(d.querySelectorAll("*")); var r = all.filter(function (e) { return e.children.length && String(e.innerText || "").indexOf(' + JSON.stringify(words) + ') !== -1; }).pop(); r = r && (r.closest(".shell-row-form") || r); var i = r && r.querySelector("input"); if (!i) return false; i.focus(); i.click(); i.dispatchEvent(new Event("input", { bubbles: true })); return true; }())');
      await sleep(1500);
      // What the dropdown lists: the labels inside that row, its own field and title aside.
      const seen = parsed(await c.evaluate('JSON.stringify((function () { var want = ' + JSON.stringify(LABELS) + '; var out = []; var d = document.getElementById("zzDetail"); var all = Array.prototype.slice.call(d.querySelectorAll("*")); var r = all.filter(function (e) { return e.children.length && String(e.innerText || "").indexOf(' + JSON.stringify(words) + ') !== -1; }).pop(); r = r && (r.closest(".shell-row-form") || r); Array.prototype.slice.call(r ? r.querySelectorAll("[data-key] td, li") : []).forEach(function (e) { var t = String(e.innerText || "").trim(); if ( e.offsetParent !== null && want.indexOf(t) !== -1 && out.indexOf(t) === -1) out.push(t); }); return out.sort(); }()))')) || [];
      const others = seen.filter(function (l) { return l !== SHELL_LABEL && l !== ZZ.identity.label; });
      // Q28, Andy: "no, the shell icon is now properly missing :)": the shell app leaves itself out here too.
      ok(opened && seen.indexOf(ZZ.identity.label) !== -1 && seen.indexOf(SHELL_LABEL) === -1 && !others.length, words + ': open, it lists ' + ZZ.identity.label + ', not ' + SHELL_LABEL + ' (Q28), and no app that is no shell', words + ': opened ' + opened + ', it lists ' + short(seen));
      await c.evaluate('document.body.click(); true');
    }

    test.subHeading('the box: "[armingButton-\'Set\']" and node.shell');
    const chose = await c.evaluate('(function () { var d = document.getElementById("zzDetail"); var all = Array.prototype.slice.call(d.querySelectorAll("*")); var r = all.filter(function (e) { return e.children.length && String(e.innerText || "").indexOf("Home shell") !== -1; }).pop(); r = r && (r.closest(".shell-row-form") || r); var i = r && r.querySelector("input"); if (!i) return "no field"; i.focus(); i.click(); i.value = "Zz"; i.dispatchEvent(new Event("input", { bubbles: true })); return new Promise(function (res) { setTimeout(function () { var hit = Array.prototype.slice.call(document.querySelectorAll("*")).filter(function (e) { return !e.children.length && e.offsetParent !== null && String(e.innerText || "").trim() === ' + JSON.stringify(ZZ.identity.label) + '; })[0]; if (!hit) return res("no row"); hit.click(); setTimeout(function () { var b = Array.prototype.slice.call(r.querySelectorAll("button")).filter(function (x) { return /^Set\\b/.test(String(x.textContent).trim()); })[0]; if (!b) return res("no Set"); b.click(); setTimeout(function () { var armed = b.hasAttribute("data-armed"); b.click(); res(armed ? "pressed twice" : "not armed"); }, 300); }, 500); }, 1500); }); }())');
    ok(chose === 'pressed twice', 'zzshell chosen in Home shell, Set armed by the first press and pressed again', 'the Home shell row: ' + short(chose));
    ok(await until(function () { return call(N.base, 'node.shell', { at: 'home' }).then(function (a) { return a.body && a.body.name === 'zzshell'; }); }, 6000), 'and the node names zzshell at home', 'node.shell home: ' + short(await call(N.base, 'node.shell', { at: 'home' })));
    ok((await call(N.base, 'node.shell', { at: 'face' })).body.name === 'shell', 'the face shell is its own, still shell', 'node.shell face: ' + short(await call(N.base, 'node.shell', { at: 'face' })));
  } finally {
    try { if (c && c.kid) c.kid.kill(); } catch (e) { /* gone */ }
    if (N) await stop(N.child);
    try { fs.rmSync(s.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
