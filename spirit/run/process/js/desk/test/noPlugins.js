'use strict';

// spirit/run/process/js/desk/test/noPlugins.js
// THE DESK WITHOUT APPS, PLUGINS AND TEAM CHAT (goal/G43.22; spec: ./noPlugins.md). Andy, the box: "the apps and plugin system
// goes.", "there will only be goals, items and rules left, plus the verifier stuff can stay for now.", Q5: "G0 goes, from ui
// and server, kept in database.", "take out your search of the items text", "take out the chat-search do, it's not actually
// usable.", "publishData summary is no longer needed", and Q4: "just stash that test.js and test.json in spirit/test/". The
// tree read as it is, and a desk server started on a scratch state folder, asked through its own pipe; Andy's desk is not
// touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../../..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const appClient = require(path.join(RUN, 'spirit', 'appClient.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, ''); } catch (e) { return ''; } }
function tracked(dir) { return execSync('git ls-files -- "' + dir + '"', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean); }
const DESK = path.join(RUN, 'process', 'js', 'desk');
const SHELL = path.join(RUN, 'shell');
const TESTS = path.join(REPO, 'spirit', 'test');

test.startTest('noPlugins.js: the desk keeps goals, items and rules; apps, plugins and the team chat go (goal/G43.22)');

(async function () {
  test.subHeading('Andy: "removal of plugin folders."');
  for (const dir of ['spirit/run/process/js/desk/plugins', 'spirit/run/shell/desk/plugins', 'spirit/run/shell/stackFrameCheckDetail']) {
    const left = tracked(dir);
    ok(!left.length && !fs.existsSync(path.join(REPO, dir)), dir + '/ is gone', dir + '/ still holds ' + short(left.length ? left : 'files on the disk'));
  }

  test.subHeading('Andy: "removal of plugin support.", and "G0 goes, from ui and server"');
  const desk = code(path.join(DESK, 'desk.js'));
  ok(!!desk && !/plugins|PLUGIN/.test(desk), 'desk.js mounts no plugin and asks none for a refusal', 'desk.js still names plugins');
  ok(!!desk && !/goal\/G0['"]/.test(desk), 'desk.js knows no team chat goal, goal/G0', 'desk.js still names goal/G0');
  const page = code(path.join(SHELL, 'desk', 'desk.js'));
  ok(!!page && !/goal\/G0['"]/.test(page) && !/data-tab="apps"/.test(page) && !/plugin/i.test(page), 'the desk page draws no Apps tab, no plugin tab and no team chat', 'shell/desk/desk.js still names Apps, a plugin or goal/G0');
  const cache = code(path.join(DESK, 'data.js'));
  ok(!!cache && !/goal\/G0['"]/.test(cache), 'the desk page cache treats no goal/G0 apart', 'process/js/desk/data.js still names goal/G0');
  const client = code(path.join(RUN, 'process', 'js', 'deskClient', 'deskClient.js'));
  ok(!!client && !/goal\/G0['"]/.test(client), 'deskClient wakes nobody on a team chat line', 'deskClient.js still names goal/G0');

  // A desk server of the tree, on a scratch state folder: what its api serves, and what a fresh one holds.
  // A unix socket's path is short (108 bytes): a long temp folder would leave the desk unable to listen.
  const scratch = fs.mkdtempSync(path.join(process.platform === 'win32' ? os.tmpdir() : '/tmp', 'spn-'));
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  const pipe = appClient.pipePathFor(scratch, 'desk', process.platform, 'process');
  // The node makes the folder of a server's door before it starts it; so does the test.
  if (process.platform !== 'win32') fs.mkdirSync(path.dirname(pipe), { recursive: true });
  let kid = null;
  try {
    kid = spawn(process.execPath, [path.join(DESK, 'desk.js'), '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    const client2 = appClient.createAppClient({ rootDir: scratch });
    if (typeof client2.register === 'function') client2.register('desk', pipe);
    const ask = function (body) { return client2.ask(body).then(function (r) { return r || {}; }, function () { return {}; }); };
    let api = {};
    const until = Date.now() + 15000;
    // Asked until the desk listens: before that the client answers app-not-running for it.
    while (Date.now() < until) { const r = await ask('api'); const b = r && r.body && (r.body.desk || r.body); if (b && typeof b === 'object' && b.ok !== false && Object.keys(b).length) { api = b; break; } await new Promise(function (r2) { setTimeout(r2, 200); }); }
    const verbs = Object.keys(api.desk || api);
    ok(verbs.length > 5 && verbs.indexOf('item.get') !== -1, 'the world: a scratch desk answers api, ' + verbs.length + ' verbs', 'no desk answered api: nothing judged. ' + short(api));
    const plug = verbs.filter(function (v) { return /^(stackFrameChecks|vision|fallout)\./.test(v); });
    ok(verbs.length > 5 && !plug.length, 'its api serves no verb of a plugin', 'its api still serves ' + short(plug));
    const g0 = await ask({ desk: { 'item.get': { id: 'goal/G0' } } });
    const held = !!(g0.body && g0.body.item);
    ok(verbs.length > 5 && !held, 'a fresh desk holds no goal/G0', 'a fresh desk holds goal/G0: ' + short(g0.body));
  } finally {
    try { if (kid) kid.kill(); } catch (e) { /* gone */ }
    await new Promise(function (r) { setTimeout(r, 300); });
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }

  test.subHeading('Andy: "the verifier stuff can stay for now", the Stacks verdicts not');
  const verifyApi = code(path.join(RUN, 'process', 'js', 'deskVerify', 'family', 'api.js'));
  ok(!!verifyApi && !/door\.record/.test(verifyApi), 'deskVerify records no Stacks door verdict', 'deskVerify\'s api still has door.record');

  test.subHeading('Andy: "take out your search of the items text", "take out the chat-search do"');
  const details = code(path.join(SHELL, 'deskDetails', 'deskDetails.js'));
  ok(!!details && !/data-box-find/.test(details), 'the item detail has no find field over its box', 'shell/deskDetails/deskDetails.js still draws data-box-find');
  ok(!!details && !/dd-chat-find|ddMountChatFind/.test(details), 'the item detail has no chat search', 'shell/deskDetails/deskDetails.js still draws its chat search');

  test.subHeading('Andy: "publishData summary is no longer needed, i only check on github."');
  const pub = code(path.join(RUN, 'spirit', 'app', 'publishData', 'publishData.js'));
  ok(!!pub && !/chat\.add/.test(pub), 'publishData posts nothing to the desk', 'publishData.js still posts a chat.add');

  test.subHeading('Andy: "just stash that test.js and test.json in spirit/test/"');
  ok(fs.existsSync(path.join(TESTS, 'stackFrameList.json')), 'the door list stackFrameList.json is kept in spirit/test/', 'no spirit/test/stackFrameList.json');
  ok(fs.existsSync(path.join(TESTS, 'violators.js')), 'the formatter violators.js is kept in spirit/test/', 'no spirit/test/violators.js');
  // Where the stack-frame tool reads the list: its own line, worked out from where the tool stands.
  const line = (/const\s+LIST_HOME\s*=\s*([^;]+);/.exec(code(path.join(TESTS, 'tools', 'wirePaths.js'))) || [])[1];
  let at = '';
  try { at = line ? new Function('path', 'REPO', 'return ' + line)(path, REPO) : ''; } catch (e) { at = 'threw ' + e.message; }
  ok(path.resolve(String(at)) === path.join(TESTS, 'stackFrameList.json'), 'tools/wirePaths.js reads the list kept in spirit/test/', 'tools/wirePaths.js reads ' + short(at));
  const viol = code(path.join(TESTS, 'stackFrameViolators.js'));
  ok(!!viol && !/plugins|stackFrameCheckDetail/.test(viol), 'stackFrameViolators.js reads nothing from what goes', 'spirit/test/stackFrameViolators.js still reads the plugin folder or shell/stackFrameCheckDetail/');
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
