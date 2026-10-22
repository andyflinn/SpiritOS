'use strict';

// spirit/test/deskAgentFileSearch.js
// goal/G23.6. Red on today's code; claude-windows wrote it and builds it (one agent). The item's box is the record:
//   file.search finds files at the repo root of his clone by a name pattern (like cw's Glob) and by text inside them
//   (like cw's Grep), never under .git.
//   An answer that would not fit in one answer is cut at the last whole result and says so.
//
// THE SHAPE CHOSEN (this suite fixes it):
//   request {pattern, text, path}: pattern a glob matched against the whole repository path ("**" any folders, "*"
//   anything within one name, "?" one character; '' = every file); text a regular expression searched in each line of
//   the files ('' = a name search only); path a folder to search under ('' = the repo root).
//   name search reply {files: [repository paths], cut}; text search reply {matches: [{path, line, text}], cut}; paths
//   with forward slashes, line from 1; cut true when the answer stopped at the last whole result that fits, else false.
//   file.search.json describes it, request {pattern, text, path}.
//
// WHAT IS ASSERTED
//   1. file.search.json: request pattern, text, path; its description names all three. deskAgent's own
//      FS.search of its family folder lists file.search.json (goal/G30.4).
//   2. a name search: '**/*.js' gives every .js file of the clone, none under .git, in repository paths; with path
//      'spirit/run' only those under it.
//   3. a text search: 'NEEDLE' gives each matching line with its path and line number, none under .git; a regular
//      expression is honoured; pattern narrows the files searched.
//   4. path '.git' finds nothing there (an empty answer or a refusal).
//   5. a search with thousands of matches answers under ANSWER_MAX, cut true, every match whole.
//   6. the tool is offered (deskAgent_file_search in a chat request's tools) and answered while Levant is
//      disconnected: the model's call comes back with the files.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G23.6: ';
const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'deskAgent');
const AGENT = path.join(DIR, 'deskAgent.js');
const FAMILY = path.join(DIR, 'deskAgent.family'); // the verb files, <module>.family since goal/G30.4
const NODE_NAME = 'ollama agent node';
const CONFIGURATION = { persona: 'Levant', preamble: 'you are Levant', model: 'plain-x', answerTokens: 100, bytesPerToken: 4 };
const ANSWER_MAX = appClient.ANSWER_MAX;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
function bytes(s) { return Buffer.byteLength(String(s), 'utf8'); }
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (await fn()) return true; await sleep(50); } return fn(); }
function sorted(a) { return (Array.isArray(a) ? a.slice() : []).sort(); }
function same(a, b) { return JSON.stringify(sorted(a)) === JSON.stringify(sorted(b)); }

test.startTest('goal/G23.6: Levant searches his clone by name and by text, at the repo root');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskunslothfilesearch-'));

// THE STAND-IN CLONE (VALUES.root = clone).
const clone = path.join(scratch, 'clone');
const FILES = {
  'README.md': 'hello world\n',
  'spirit/a.js': 'const x = 1;\n// NEEDLE here\n',
  'spirit/run/b.js': 'line1\nline2 NEEDLE\n',
  'spirit/run/deep/c.txt': 'NEEDLE in text\n',
  'docs/d.js': 'no match here\n',
  '.git/hooks/e.js': 'NEEDLE in git\n',
  '.git/config': 'NEEDLE config\n',
};
const MANY_LINES = 3000;
function plant() {
  Object.keys(FILES).forEach(function (rel) { const f = path.join(clone, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, FILES[rel]); });
  const many = []; for (let i = 1; i <= MANY_LINES; i++) many.push('MANY match number ' + i);
  fs.mkdirSync(path.join(clone, 'many'), { recursive: true });
  fs.writeFileSync(path.join(clone, 'many', 'big.txt'), many.join('\n') + '\n');
}

// ── THE STAND-IN MODEL: asks file.search once when offered it, then answers ──
const chats = [];
const model = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let body = null; try { body = raw ? JSON.parse(raw) : null; } catch (e) { body = null; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const p = new URL(req.url, 'http://x').pathname;
    if (p === '/v1/models') return res.end(JSON.stringify({ object: 'list', data: [{ id: 'plain-x', object: 'model' }] }));
    if (p === '/v1/chat/completions' && req.method === 'POST') {
      chats.push(body);
      const offered = Array.isArray(body && body.tools) && body.tools.some(function (t) { return t.function && t.function.name === 'deskAgent_file_search'; });
      const toolDone = ((body && body.messages) || []).some(function (m) { return m.role === 'tool'; });
      const message = offered && !toolDone
        ? { role: 'assistant', content: '', tool_calls: [{ id: 'search-1', type: 'function', function: { name: 'deskAgent_file_search', arguments: JSON.stringify({ pattern: '**/*.js', text: '', path: '' }) } }] }
        : { role: 'assistant', content: 'searched' };
      return res.end(JSON.stringify({ choices: [{ index: 0, finish_reason: message.tool_calls ? 'tool_calls' : 'stop', message: message }] }));
    }
    res.end(JSON.stringify({ ok: true }));
  });
});

// ── THE FAKE NODE: deskAgent's own verbs handed to its pipe; the desk holds nothing ──
let client = null;
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    function answer(status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
    { const na = test.nodeApi(b); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
    if (b.verb === 'jobs.update') return answer(200, { ok: true });
    // A server's verb by name on the flat apiDoor (goal/G30.6), folded to {server: {verb: args}}.
    { const na = test.nodeApi(b); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
    const ask = test.foldAsk(b);
    if (ask && ask.deskClient && ask.deskClient.next) return setTimeout(function () { answer(200, { lines: [] }); }, 100);
    if (ask && ask.deskClient) return answer(200, { change: 1 });
    if (ask && ask.deskAgent && client) return client.ask({ deskAgent: ask.deskAgent }).then(function (r) { answer(r.status || 200, r.body || {}); }, function (e) { answer(500, { ok: false, error: String(e) }); });
    answer(404, { ok: false, code: 'no-such-verb' });
  });
});

const state = path.join(scratch, 'relay-state', 'process', 'deskAgent');
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'deskAgent', 'win32', 'process') : path.join(scratch, 'door.sock');
let kid = null;
const out = { stderr: '', code: null };
const ask = function (verb, a) { const q = {}; q[verb] = a || {}; return client.ask({ deskAgent: q }).then(function (r) { return { status: r.status, body: r.body || {} }; }, function (e) { return { status: 0, body: { ok: false, error: String(e) } }; }); };
const search = function (a) { return ask('file.search', a); };
function underGit(list) { return (list || []).some(function (p) { return /(^|\/)\.git(\/|$)/.test(String(p)); }); }
function pathsOf(matches) { return (matches || []).map(function (m) { return m.path; }); }

async function suite() {
  test.subHeading('1. the verb file and introspection');
  let file = null;
  try { file = JSON.parse(fs.readFileSync(path.join(FAMILY, 'file.search.json'), 'utf8')); } catch (e) { file = null; }
  const req = (file && file.request) || {};
  const desc = String((file && file.description) || '');
  if (JSON.stringify(Object.keys(req).sort()) === JSON.stringify(['path', 'pattern', 'text']) && /pattern/.test(desc) && /text/.test(desc) && /path/.test(desc)) test.check('file.search.json: request pattern, text, path, each named in the description');
  else test.fail(OWED + 'file.search.json reads ' + short(file));

  plant();
  fs.mkdirSync(state, { recursive: true });
  for (const s of [node, model]) await new Promise(function (r) { s.listen(0, '127.0.0.1', r); });
  fs.writeFileSync(path.join(scratch, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.address().port }));
  fs.writeFileSync(path.join(state, 'configuration.json'), JSON.stringify(CONFIGURATION, null, 1));
  client = appClient.createAppClient({ rootDir: scratch, log: function () {} });
  client.register('deskAgent', pipe);
  kid = spawn(process.execPath, [AGENT, JSON.stringify({ root: clone }), '--pipe', pipe, '--state', state, '--node', JSON.stringify({ name: NODE_NAME, publicKey: 'K' })],
    { cwd: scratch, stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'test-deskAgent', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.address().port + '/api/spirit' }) });
  kid.stderr.on('data', function (c) { out.stderr += c; });
  kid.on('exit', function (code) { out.code = code === null ? 'signal' : code; });
  let up = false;
  for (let i = 0; i < 60 && !up && out.code === null; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.deskAgent && r.body.deskAgent.ok !== false); } catch (e) { /* not yet */ } }
  if (!up) { test.fail('the world: deskAgent did not start: ' + short(out.stderr)); return; }
  const st = (await ask('state', {})).body;
  if (st.connected === false) test.check('the world: Levant is disconnected (no recommended model)');
  else test.fail('the world: Levant is connected: ' + short(st));
  // Its family folder's listing names the verb file (FS.search, goal/G30.4).
  const intro = (await ask('FS.search', { q: '' })).body;
  const listed = (intro.items || []).map(function (i) { return i.key; });
  if (listed.indexOf('file.search.json') !== -1) test.check('deskAgent\'s FS.search lists file.search.json');
  else test.fail(OWED + 'FS.search lists ' + short(listed));

  test.subHeading('2. a search by name');
  const n1 = await search({ pattern: '**/*.js', text: '', path: '' });
  const want1 = ['docs/d.js', 'spirit/a.js', 'spirit/run/b.js'];
  if (same(n1.body.files, want1) && n1.body.cut === false) test.check('**/*.js gives ' + want1.join(', ') + ', none under .git, cut false');
  else test.fail(OWED + '**/*.js answered ' + n1.status + ' ' + short(n1.body));
  const n2 = await search({ pattern: '**/*.js', text: '', path: 'spirit/run' });
  if (same(n2.body.files, ['spirit/run/b.js'])) test.check('with path spirit/run: only spirit/run/b.js, still a repository path');
  else test.fail(OWED + '**/*.js under spirit/run answered ' + n2.status + ' ' + short(n2.body));
  const n3 = await search({ pattern: 'spirit/*/deep/*.txt', text: '', path: '' });
  if (same(n3.body.files, ['spirit/run/deep/c.txt'])) test.check('spirit/*/deep/*.txt gives spirit/run/deep/c.txt');
  else test.fail(OWED + 'spirit/*/deep/*.txt answered ' + short(n3.body));
  const all = await search({ pattern: '', text: '', path: '' });
  if (Array.isArray(all.body.files) && all.body.files.length === 6 && !underGit(all.body.files) && all.body.files.indexOf('many/big.txt') !== -1) test.check('pattern \'\' gives every file of the clone (6), none under .git');
  else test.fail(OWED + 'pattern \'\' answered ' + short(all.body));

  test.subHeading('3. a search by text');
  const t1 = await search({ pattern: '', text: 'NEEDLE', path: '' });
  const want3 = [{ path: 'spirit/a.js', line: 2, text: '// NEEDLE here' }, { path: 'spirit/run/b.js', line: 2, text: 'line2 NEEDLE' }, { path: 'spirit/run/deep/c.txt', line: 1, text: 'NEEDLE in text' }];
  const got3 = (t1.body.matches || []).map(function (m) { return JSON.stringify({ path: m.path, line: m.line, text: m.text }); });
  if (same(got3, want3.map(function (m) { return JSON.stringify(m); })) && t1.body.cut === false) test.check('NEEDLE gives each matching line with path and line number, none under .git');
  else test.fail(OWED + 'NEEDLE answered ' + t1.status + ' ' + short(t1.body));
  const t2 = await search({ pattern: '', text: 'line\\d NEEDLE', path: '' });
  if (same(pathsOf(t2.body.matches), ['spirit/run/b.js'])) test.check('a regular expression is honoured: line\\d NEEDLE gives spirit/run/b.js');
  else test.fail(OWED + 'line\\d NEEDLE answered ' + short(t2.body));
  const t3 = await search({ pattern: '**/*.txt', text: 'NEEDLE', path: '' });
  if (same(pathsOf(t3.body.matches), ['spirit/run/deep/c.txt'])) test.check('pattern narrows the files searched: **/*.txt with NEEDLE gives spirit/run/deep/c.txt');
  else test.fail(OWED + '**/*.txt with NEEDLE answered ' + short(t3.body));

  test.subHeading('4. never under .git');
  const g = await search({ pattern: '', text: 'NEEDLE', path: '.git' });
  const gHits = (g.body.files || []).concat(pathsOf(g.body.matches));
  if (g.body.code !== 'no-such-verb' && (g.body.ok === false || g.status >= 400 || Array.isArray(g.body.matches)) && !gHits.length && !/NEEDLE in git|NEEDLE config/.test(JSON.stringify(g.body))) test.check('path .git finds nothing there: ' + short(g.body));
  else test.fail(OWED + 'path .git answered ' + g.status + ' ' + short(g.body));

  test.subHeading('5. a huge answer is cut at the last whole result, and says so');
  const big = await search({ pattern: 'many/**', text: 'MANY', path: '' });
  const size = bytes(JSON.stringify(big.body));
  const ms = big.body.matches || [];
  const whole = ms.length > 0 && ms.every(function (m, k) { return m.path === 'many/big.txt' && m.line === k + 1 && m.text === 'MANY match number ' + (k + 1); });
  if (size <= ANSWER_MAX && big.body.cut === true && whole && ms.length < MANY_LINES) test.check(ms.length + ' of ' + MANY_LINES + ' matches in ' + size + ' bytes (under ' + ANSWER_MAX + '), cut true, every match whole');
  else test.fail(OWED + 'the huge search answered ' + big.status + ', ' + size + ' bytes, ' + ms.length + ' matches, cut ' + short(big.body.cut) + ' ' + short(JSON.stringify(big.body).slice(0, 200)));

  test.subHeading('6. the model is offered it, and it is answered while he is disconnected');
  await ask('connection.set', { name: 'plain', url: 'http://127.0.0.1:' + model.address().port + '/v1', key: 'k' });
  await until(async function () { const m = (await ask('models.search', { text: '', marks: [] })).body; return ((m && m.models) || []).some(function (x) { return x.id === 'plain-x'; }); }, 6000);
  await ask('model.load', { id: 'plain-x', quant: '' });
  await sleep(200);
  const sent = (await ask('chat.send', { lines: [{ role: 'user', text: 'find the js files' }] })).body;
  await until(async function () { const a = sent.id ? (await ask('chat.answer', { id: sent.id })).body : {}; return a.done === true; }, 10000);
  const names = chats.length && Array.isArray(chats[0].tools) ? chats[0].tools.map(function (t) { return t.function && t.function.name; }) : [];
  if (names.indexOf('deskAgent_file_search') !== -1) test.check('deskAgent_file_search is in the tools offered');
  else test.fail(OWED + 'the tools offered are ' + short(names));
  const after = chats.filter(function (c) { return ((c && c.messages) || []).some(function (m) { return m.role === 'tool'; }); })[0];
  const result = after ? String(((after.messages || []).filter(function (m) { return m.role === 'tool'; })[0] || {}).content || '') : '';
  if (/spirit\/run\/b\.js/.test(result) && !/disconnected/.test(result)) test.check('the model\'s file search ran while disconnected and handed back the files');
  else test.fail(OWED + 'the model\'s file search came back as ' + short(result || '(no tool message)'));
}

suite().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  if (kid && out.code === null) await new Promise(function (r) { kid.once('exit', r); try { kid.kill(); } catch (e) { r(); } setTimeout(r, 3000); });
  try { node.close(); model.close(); } catch (e) { /* closed */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
