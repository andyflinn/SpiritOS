'use strict';

// spirit/test/deskAgentFileRange.js
// goal/G23.3. Red on today's code; claude-windows wrote it and builds it (one agent). The item's box is the record:
//   Levant could not read any file bigger than one answer of his process (deskAgent.js is 88 KB; a 13.8 KB test
//   file was refused). His file read is deskAgent's own file.load verb.
//   file.load takes an optional offset (the first line, from 1) and limit (how many lines).
//   Each answer carries the lines asked for, numbered, plus the file's total line count, so he knows how far he is.
//   A read that would not fit in one answer is cut at the last whole line that fits, and the answer says where it
//   stopped. A file small enough is still read whole when no range is given. The tool's description tells the model
//   to read a large file part by part.
//
// THE SHAPE CHOSEN (the box leaves the names to the build; this suite fixes them):
//   request {path, offset, limit}: offset the first line, from 1; limit how many lines. Either one makes a ranged read.
//   ranged reply {path, text, lines, next}: text the lines asked for, each `<number>\t<line>`, joined by "\n";
//   lines the file's total line count; next the line to ask for next, 0 when the read reached the end.
//   unranged reply, file small enough: {path, text}, the text as it is on disc (today's shape).
//   Lines are the text split at "\n"; the suite's file has no newline at its end, so its count is unambiguous.
//
// WHAT IS ASSERTED
//   1. file.load.json: its request has offset and limit, its description names offset and limit; and deskAgent's
//      FS.loadJsonValue of file.load.json (what tools.js reads into the model's tool, goal/G30.4) carries the same.
//   2. a small file with no range reads whole as {path, text}, the text exact.
//   3. offset 5, limit 3 on the small file: lines 5..7 numbered, lines = its count, next = 8.
//   4. a file about 3 x ANSWER_MAX in many lines, read from offset 1 with a limit past its end and then from each
//      next until next is 0: every answer under ANSWER_MAX, more than one part, each line numbered in order, every
//      part giving the total, and the parts, numbers stripped, give back the file exactly.
// NOT ASSERTED: what a large file read with no range answers.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G23.3: ';
const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'deskAgent');
const AGENT = path.join(DIR, 'deskAgent.js');
const FAMILY = path.join(DIR, 'deskAgent.family'); // the verb files, <module>.family since goal/G30.4
const NODE_NAME = 'ollama agent node';
const CONFIGURATION = { persona: 'Levant', preamble: 'you are Levant', model: 'fake/Levant-GGUF', answerTokens: 100, bytesPerToken: 4 };
const ANSWER_MAX = appClient.ANSWER_MAX;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function bytes(s) { return Buffer.byteLength(String(s), 'utf8'); }

test.startTest('goal/G23.3: Levant reads a file of any size, part by part, in numbered lines');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskunslothfilerange-'));

// THE FILES, inside the clone root (VALUES.root = scratch). Neither ends in a newline.
const SMALL_LINES = []; for (let i = 1; i <= 10; i++) SMALL_LINES.push('small line ' + i + (i % 3 ? '' : '\twith a tab'));
const SMALL = SMALL_LINES.join('\n');
const BIG_LINES = [];
for (let i = 1; bytes(BIG_LINES.join('\n')) < 3 * ANSWER_MAX; i++) BIG_LINES.push(i % 50 === 0 ? '' : 'line ' + i + ' of the big file, "quoted" words and a backslash \\ here ' + 'x'.repeat(i % 40));
const BIG = BIG_LINES.join('\n');

// ── THE FAKE NODE: jobs.update and an empty desk; file.load needs nothing of it ──
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
    answer(404, { ok: false, code: 'no-such-verb' });
  });
});

const state = path.join(scratch, 'relay-state', 'process', 'deskAgent');
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'deskAgent', 'win32', 'process') : path.join(scratch, 'door.sock');
let kid = null;
let client = null;
const out = { stderr: '', code: null };
function load(a) { return client.ask({ deskAgent: { 'file.load': a } }).then(function (r) { return { status: r.status, body: r.body || {} }; }, function (e) { return { status: 0, body: { ok: false, error: String(e) } }; }); }

// The numbered lines of one ranged answer: [{n, text}], or null when a line is not `<number>\t<text>`.
function numbered(text) {
  const rows = String(text).split('\n');
  const outRows = [];
  for (const r of rows) {
    const m = /^(\d+)\t([\s\S]*)$/.exec(r);
    if (!m) return null;
    outRows.push({ n: Number(m[1]), text: m[2] });
  }
  return outRows;
}

async function suite() {
  test.subHeading('1. the tool tells the model to read a large file part by part');
  let file = null;
  try { file = JSON.parse(fs.readFileSync(path.join(FAMILY, 'file.load.json'), 'utf8')); } catch (e) { file = null; }
  const req = (file && file.request) || {};
  const desc = String((file && file.description) || '');
  if ('offset' in req && 'limit' in req && /offset/.test(desc) && /limit/.test(desc)) test.check('file.load.json: request has offset and limit, the description names them');
  else test.fail(OWED + 'file.load.json reads ' + short(file));

  fs.mkdirSync(state, { recursive: true });
  fs.mkdirSync(path.join(scratch, 'files'), { recursive: true });
  fs.writeFileSync(path.join(scratch, 'files', 'small.txt'), SMALL);
  fs.writeFileSync(path.join(scratch, 'files', 'big.txt'), BIG);
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  fs.writeFileSync(path.join(scratch, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.address().port }));
  fs.writeFileSync(path.join(state, 'configuration.json'), JSON.stringify(CONFIGURATION, null, 1));
  kid = spawn(process.execPath, [AGENT, JSON.stringify({ root: scratch }), '--pipe', pipe, '--state', state, '--node', JSON.stringify({ name: NODE_NAME, publicKey: 'K' })],
    { cwd: scratch, stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'test-deskAgent', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.address().port + '/api/spirit' }) });
  kid.stderr.on('data', function (c) { out.stderr += c; });
  kid.on('exit', function (code) { out.code = code === null ? 'signal' : code; });
  client = appClient.createAppClient({ rootDir: scratch, log: function () {} });
  client.register('deskAgent', pipe);
  let up = false;
  for (let i = 0; i < 60 && !up && out.code === null; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.deskAgent && r.body.deskAgent.ok !== false); } catch (e) { /* not yet */ } }
  if (!up) { test.fail('the world: deskAgent did not start: ' + short(out.stderr)); return; }
  test.check('the world: the big file is ' + bytes(BIG) + ' bytes in ' + BIG_LINES.length + ' lines; one answer is ' + ANSWER_MAX);

  // The verb file through the family's FS (goal/G30.4: AGENTS.file.load is gone), as tools.js reads it.
  const intro = ((await client.ask({ deskAgent: { 'FS.loadJsonValue': { path: 'file.load.json' } } })).body || {}).value || {};
  const ireq = intro.request || {};
  if ('offset' in ireq && 'limit' in ireq && /offset/.test(String(intro.description || '')) && /limit/.test(String(intro.description || ''))) test.check('FS.loadJsonValue of file.load.json, what the model\'s tool is made from, carries offset and limit');
  else test.fail(OWED + 'FS.loadJsonValue of file.load.json answers ' + short(intro));

  test.subHeading('2. a small file with no range reads whole, as today');
  const whole = await load({ path: 'files/small.txt' });
  if (whole.body.text === SMALL && whole.body.path === 'files/small.txt') test.check('{path, text}, the text exact');
  else test.fail('a small file with no range answered ' + whole.status + ' ' + short(whole.body));

  test.subHeading('3. offset and limit: the lines asked for, numbered, with the total and the next');
  const r3 = await load({ path: 'files/small.txt', offset: 5, limit: 3 });
  const rows3 = r3.body.ok === false ? null : numbered(r3.body.text);
  const want3 = [5, 6, 7].map(function (n) { return { n: n, text: SMALL_LINES[n - 1] }; });
  if (rows3 && JSON.stringify(rows3) === JSON.stringify(want3)) test.check('offset 5, limit 3: lines 5 to 7, each `<number>\\t<line>`');
  else test.fail(OWED + 'offset 5, limit 3 answered ' + r3.status + ' ' + short(r3.body));
  if (r3.body.lines === SMALL_LINES.length && r3.body.next === 8) test.check('lines ' + SMALL_LINES.length + ' (the file\'s count), next 8');
  else test.fail(OWED + 'offset 5, limit 3: lines ' + short(r3.body.lines) + ', next ' + short(r3.body.next) + ' (want ' + SMALL_LINES.length + ', 8)');
  const r3b = await load({ path: 'files/small.txt', offset: 9, limit: 5 });
  const rows3b = r3b.body.ok === false ? null : numbered(r3b.body.text);
  if (rows3b && rows3b.length === 2 && rows3b[1].n === 10 && r3b.body.next === 0) test.check('a range past the end gives the last lines and next 0');
  else test.fail(OWED + 'offset 9, limit 5 answered ' + short(r3b.body));

  test.subHeading('4. a file several answers long, read whole in parts');
  const parts = [];
  let offset = 1;
  let problem = '';
  for (let i = 0; i < 60 && offset > 0; i++) {
    const r = await load({ path: 'files/big.txt', offset: offset, limit: 1000000 });
    if (r.body.ok === false || typeof r.body.text !== 'string') { problem = 'offset ' + offset + ' answered ' + r.status + ' ' + short(r.body); break; }
    const size = bytes(JSON.stringify(r.body));
    if (size > ANSWER_MAX) { problem = 'offset ' + offset + ': an answer of ' + size + ' bytes, over ' + ANSWER_MAX; break; }
    const rows = numbered(r.body.text);
    if (!rows || !rows.length) { problem = 'offset ' + offset + ': the text is not numbered lines: ' + short(r.body.text); break; }
    if (rows.some(function (row, k) { return row.n !== offset + k; })) { problem = 'offset ' + offset + ': the numbers are not ' + offset + ' onwards'; break; }
    if (r.body.lines !== BIG_LINES.length) { problem = 'offset ' + offset + ': lines ' + short(r.body.lines) + ', the file has ' + BIG_LINES.length; break; }
    const last = rows[rows.length - 1].n;
    const want = last >= BIG_LINES.length ? 0 : last + 1;
    if (r.body.next !== want) { problem = 'offset ' + offset + ': next ' + short(r.body.next) + ', want ' + want; break; }
    parts.push(rows);
    offset = r.body.next;
  }
  if (problem) test.fail(OWED + problem);
  else {
    test.check('read in ' + parts.length + ' parts, each under ' + ANSWER_MAX + ' bytes, numbered in order, each giving the total ' + BIG_LINES.length + ', the last next 0');
    if (parts.length > 1) test.check('more than one part: each read cut at a line that fits');
    else test.fail(OWED + 'the big file came in one part');
    const back = [].concat.apply([], parts).map(function (row) { return row.text; }).join('\n');
    if (back === BIG) test.check('the parts, numbers stripped, give back the file exactly');
    else test.fail(OWED + 'the parts give back ' + bytes(back) + ' bytes, the file is ' + bytes(BIG));
  }
}

suite().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  if (kid && out.code === null) await new Promise(function (r) { kid.once('exit', r); try { kid.kill(); } catch (e) { r(); } setTimeout(r, 3000); });
  try { node.close(); } catch (e) { /* closed */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
