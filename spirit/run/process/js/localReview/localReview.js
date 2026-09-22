'use strict';

// spirit/run/process/js/localReview/localReview.js
// A SLOW REVIEW BY A LOCAL MODEL, WHILE ANDY SLEEPS.
//
//   Andy, 2026-09-22: "while i sleep or rest... i'd like to try the best
//   reasoning model to slowly attempt reviews only.... just to see what
//   that brings...."
//
// It costs nothing but electricity: the model is Ollama's, on this box
// (127.0.0.1:11434, pinned to the RTX 5060 Ti). No key, no internet, no
// budget. It reads SpiritOS's own files one at a time and writes what it
// finds, file by file, under design/reviews/local/<run>/ — and does
// nothing else: it changes no code, commits nothing, posts to nobody. In
// the morning the in-studio agent triages the findings and brings Andy
// only what matters (ANDYS_RULES general rule 9).
//
// It talks to Ollama directly, over loopback: a spawned script talking to
// a service, which is what process/ is for (oneDoor.js skips it). No
// timeout of its own — a big model on the CPU is slow, and slow is the
// point.
//
//   node localReview.js [--model gpt-oss:120b] [--fallback gpt-oss:20b]
//                       [--since <commit>] [--run <name>] [--wait <hours>]
//
// Resumable: a file already reviewed in this run is skipped, so a restart
// continues where it stopped. Progress goes to <run>/PROGRESS.md.

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');

const REPO = path.join(__dirname, '..', '..', '..', '..', '..');
const OLLAMA = { host: '127.0.0.1', port: 11434 };

function flags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

// One call to Ollama, with no wait of our own.
function ollama(pathname, body) {
  return new Promise(function (resolve, reject) {
    const payload = body === undefined ? '' : JSON.stringify(body);
    const req = http.request({
      host: OLLAMA.host, port: OLLAMA.port, path: pathname,
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, function (res) {
      const chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch (e) { json = null; }
        if (res.statusCode >= 300) reject(new Error('ollama ' + res.statusCode + ': ' + text.slice(0, 200)));
        else resolve(json);
      });
    });
    req.on('error', reject);
    req.end(payload || undefined);
  });
}

// The best model if it arrives in time, else the fallback. The first night
// started while the 120B model was still downloading, so it waits for it —
// up to `waitHours` — before settling for the smaller one.
async function pickModel(wanted, fallback, waitHours, log) {
  const until = Date.now() + (Number(waitHours) || 0) * 3600 * 1000;
  let said = false;
  for (;;) {
    let have = [];
    try {
      const tags = await ollama('/api/tags');
      have = ((tags && tags.models) || []).map(function (m) { return m.name; });
    } catch (e) { have = []; }
    if (have.indexOf(wanted) !== -1) return wanted;
    if (Date.now() >= until) {
      if (have.indexOf(fallback) !== -1) return fallback;
      throw new Error('neither ' + wanted + ' nor ' + fallback + ' is pulled (have: ' + have.join(', ') + ')');
    }
    if (!said) { log('waiting for ' + wanted + ' (up to ' + waitHours + ' h), then ' + fallback); said = true; }
    await new Promise(function (r) { setTimeout(r, 60000); });
  }
}

// Which files, in which order: those changed since `since` first, then the
// rest of spirit/run/js, smallest first — the most reviewed per hour.
function filesToReview(since) {
  const all = fs.readdirSync(path.join(REPO, 'spirit', 'run', 'js'))
    .filter(function (f) { return f.endsWith('.js'); })
    .map(function (f) { return 'spirit/run/js/' + f; });
  let changed = [];
  if (since) {
    try {
      changed = execFileSync('git', ['diff', '--name-only', since + '..HEAD', '--', 'spirit/run/js'], { cwd: REPO, encoding: 'utf8' })
        .split(/\r?\n/).filter(function (f) { return all.indexOf(f) !== -1; });
    } catch (e) { changed = []; }
  }
  const size = function (f) { return fs.statSync(path.join(REPO, f)).size; };
  const rest = all.filter(function (f) { return changed.indexOf(f) === -1; }).sort(function (a, b) { return size(a) - size(b); });
  return changed.sort(function (a, b) { return size(a) - size(b); }).concat(rest);
}

// A long file is read in slices, each with its line numbers, so a finding
// can name a line. ~45 KB a slice keeps a 120B model inside its context.
function slices(text, max) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let cur = [];
  let size = 0;
  let start = 1;
  lines.forEach(function (l, i) {
    if (size + l.length > max && cur.length) {
      out.push({ from: start, to: i, body: cur.join('\n') });
      cur = []; size = 0; start = i + 1;
    }
    cur.push(String(i + 1).padStart(5) + '  ' + l);
    size += l.length + 8;
  });
  if (cur.length) out.push({ from: start, to: lines.length, body: cur.join('\n') });
  return out;
}

const BRIEF = [
  'You are reviewing one file of SpiritOS, a personal node-and-relay system, for Claude, the in-studio engineer.',
  'The system rules are in AGENT.md, given below; a decision recorded in the code comments with a date and a quote is settled — do not propose its opposite.',
  'Report only real findings, most severe first, as a numbered list. For each: [REGRESSION] something that is broken or unsafe, or [DESIGN] a better shape;',
  'where: file:line; why: two or three lines; fix: one line. Mark anything you could not verify from this text UNVERIFIED.',
  'If you find nothing that matters, answer exactly: NOTHING FOUND. No preamble, no summary of the file.',
].join(' ');

async function main() {
  const f = flags(process.argv.slice(2));
  const run = f.run || new Date().toISOString().slice(0, 10) + '-night';
  const outDir = path.join(REPO, 'design', 'reviews', 'local', run);
  fs.mkdirSync(outDir, { recursive: true });
  const progress = path.join(outDir, 'PROGRESS.md');
  const log = function (line) {
    fs.appendFileSync(progress, '- ' + new Date().toISOString().slice(11, 19) + ' ' + line + '\n');
    console.log(line);
  };

  const model = await pickModel(f.model || 'gpt-oss:120b', f.fallback || 'gpt-oss:20b', f.wait || 3, log);
  const agent = fs.readFileSync(path.join(REPO, 'AGENT.md'), 'utf8');
  const files = filesToReview(f.since || '');
  log('run ' + run + ': ' + files.length + ' files, model ' + model);

  for (const file of files) {
    const target = path.join(outDir, file.replace(/[\\/]/g, '__') + '.md');
    if (fs.existsSync(target)) continue;
    const text = fs.readFileSync(path.join(REPO, file), 'utf8');
    const parts = slices(text, 45000);
    const found = [];
    const started = Date.now();
    let tokensOut = 0;
    for (let i = 0; i < parts.length; i += 1) {
      const p = parts[i];
      // One slice failing is noted and the night goes on: an unattended run
      // that stops at the first error reviews nothing after it.
      let res = null;
      try {
        res = await ollama('/api/chat', {
        model: model,
        stream: false,
        think: 'high',
        options: { num_ctx: 65536 },
        messages: [
          { role: 'system', content: BRIEF + '\n\n--- AGENT.md ---\n' + agent },
          { role: 'user', content: 'File ' + file + ', lines ' + p.from + '-' + p.to +
            (parts.length > 1 ? ' (slice ' + (i + 1) + ' of ' + parts.length + ')' : '') + ':\n\n' + p.body },
        ],
        });
      } catch (e) {
        log(file + ' slice ' + (i + 1) + ' failed: ' + String(e && e.message || e));
        res = { message: { content: '(this slice failed: ' + String(e && e.message || e) + ')' } };
      }
      tokensOut += Number(res && res.eval_count) || 0;
      found.push('## Lines ' + p.from + '–' + p.to + '\n\n' + String((res && res.message && res.message.content) || '(no answer)').trim());
    }
    const minutes = ((Date.now() - started) / 60000).toFixed(1);
    fs.writeFileSync(target, '# ' + file + '\n\nModel ' + model + ', ' + parts.length + ' slice(s), ' + minutes + ' min, ' +
      tokensOut + ' tokens out.\n\n' + found.join('\n\n') + '\n');
    log(file + ' — ' + minutes + ' min, ' + parts.length + ' slice(s)');
  }
  log('done');
}

main().catch(function (e) {
  console.error(String(e && e.message || e));
  process.exitCode = 1;
});
