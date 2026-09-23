'use strict';

// spirit/run/process/js/localResearch/localResearch.js
// THE LOCAL MODEL READS A CORPUS. IT DOES NOT DO MARKET RESEARCH.
//
//   Andy, 2026-09-23: "before we all sign off we setup local AI to do
//   things like market research. like (are the bitcoiners and crypto-bros
//   looking for an szstem on a usb-stick that has their wallet and UI all
//   in one?"
//
// ── THE REFRAME THIS FILE IS BUILT ON ────────────────────────────────
//
// Asked that question directly, a local model answers it fluently, from
// training data of unknown age, with no sources, and no way to tell the
// answer from an invention. That is the exact failure this project spent
// 2026-09-23 removing from its capacity figures — and it is worse here,
// because a wrong capacity number gets caught by a re-measurement and a
// wrong market claim gets caught by nobody.
//
// So the job is not "research". It is EXTRACTION FROM A CORPUS WE
// FETCHED: four hundred posts and sixty READMEs on disc, one question,
// and every finding carrying the words it came from. That is the profile
// the first evaluation said this model is good at — Andy's own framing,
// 2026-09-23: "smaller scope, much lower reasoning".
//
//   design/reviews/local/LOCAL-MODEL-REVIEW.md — why open-ended review
//   failed, and what was left over.
//
// ── THE CITATION IS ENFORCED HERE, NOT ASKED FOR IN THE PROMPT ───────
//
// A model told "always quote your source" quotes its source most of the
// time. Most of the time is the problem: one fabricated quote among
// ninety real ones is indistinguishable from the rest, and it is the one
// that gets repeated into a positioning document.
//
// So every quote the model returns is CHECKED against the document it
// claims to come from, mechanically, and dropped if it is not there. The
// model is not trusted to cite; it is allowed to propose, and the runner
// verifies. That is today's lesson applied one layer out: do not trust
// the reporter, assert the join.
//
// ── WHAT IT DOES NOT DO ──────────────────────────────────────────────
//
// It does not fetch. Fetching is deterministic, reproducible and
// auditable, and belongs in a script somebody can read and re-run — not
// inside an unattended model job. This reads whatever corpus is already
// on disc and says how many documents it found, so an empty corpus is a
// visible fact rather than a quiet zero.
//
// It writes nothing outside its output directory, commits nothing, posts
// to nobody, and reaches no network but the loopback Ollama.
//
//   node process/js/localResearch/localResearch.js \
//     --corpus marketing/research/corpus/2026-09-23-usb-wallet \
//     --question "Are people asking for a portable all-in-one wallet plus UI on a USB stick?" \
//     --model gpt-oss:20b

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const REPO = path.resolve(__dirname, '..', '..', '..', '..', '..');
const OLLAMA = { host: '127.0.0.1', port: 11434 };

// Long enough that a model with something to say is not truncated, short
// enough that a model with nothing to say cannot fill a night with prose.
const SLICE = 40000;

function flags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

function log(line) {
  console.log(new Date().toISOString().slice(11, 19) + '  ' + line);
}

// One call to Ollama, with no wait of our own. Lifted from
// localReview.js deliberately rather than shared: these two jobs must be
// able to run on different models, different context sizes and different
// nights without either one's change reaching the other. Twenty lines of
// duplication is cheaper than an unattended job breaking because its
// sibling was tuned.
function ollama(pathname, body) {
  return new Promise(function (resolve, reject) {
    const payload = body === undefined ? '' : JSON.stringify(body);
    const req = http.request({
      host: OLLAMA.host, port: OLLAMA.port, path: pathname,
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
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

// ── THE BRIEF ────────────────────────────────────────────────────────
//
// It asks for JSON and for verbatim quotes, and it says plainly that
// nothing else survives. The model is told the rule even though the rule
// is enforced below, because a model that knows the shape produces fewer
// findings that have to be thrown away — but the enforcement is what the
// output rests on.
const BRIEF = [
  'You are reading ONE document from a corpus somebody fetched. You are not',
  'answering from memory and you have no knowledge of this subject beyond the',
  'document in front of you.',
  '',
  'Answer ONLY with JSON: {"findings":[{"quote":"...","says":"..."}]}',
  '',
  'RULES, and the first is the only one that matters:',
  '1. `quote` MUST be copied VERBATIM from the document, character for character.',
  '   Anything that is not an exact substring of the document is discarded',
  '   automatically and your finding is lost. Do not paraphrase inside `quote`.',
  '2. `says` is one short sentence: what that quote tells us about the question.',
  '3. If the document says NOTHING about the question, answer {"findings":[]}.',
  '   An empty answer is a correct and useful answer. Do not reach.',
  '4. Never infer what people "probably" want. Report only what this document',
  '   states. Somebody else decides what it means.',
].join('\n');

// Each corpus file begins with a SOURCE line written by whatever fetched
// it. A document that cannot say where it came from is not evidence, so
// it is skipped and counted rather than read.
function sourceOf(text) {
  const m = /^\s*SOURCE:\s*(\S+)/i.exec(text);
  return m ? m[1] : '';
}

function slices(text, size) {
  const out = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out.length ? out : [''];
}

// ── THE ENFORCEMENT ──────────────────────────────────────────────────
//
// Whitespace is normalised on both sides before comparing, because a
// model that reflows a line has not invented it — and nothing else is
// forgiven. No fuzzy matching, no similarity threshold: a quote is in the
// document or the finding does not exist.
function normalise(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function verified(findings, documentText) {
  const hay = normalise(documentText);
  const kept = [];
  let dropped = 0;
  (Array.isArray(findings) ? findings : []).forEach(function (f) {
    const q = f && f.quote;
    if (!q || normalise(q).length < 12) { dropped += 1; return; }
    if (hay.indexOf(normalise(q)) === -1) { dropped += 1; return; }
    kept.push({ quote: String(q).trim(), says: String((f && f.says) || '').trim() });
  });
  return { kept: kept, dropped: dropped };
}

function parseFindings(raw) {
  const text = String(raw || '');
  // A model asked for JSON sometimes wraps it in prose or a fence. Take
  // the outermost object and try that; a parse failure is zero findings,
  // never a guess at what was meant.
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a === -1 || b <= a) return [];
  try { return (JSON.parse(text.slice(a, b + 1)) || {}).findings || []; }
  catch (e) { return []; }
}

async function main() {
  const f = flags(process.argv.slice(2));
  const question = f.question || '';
  const model = f.model || 'gpt-oss:20b';
  if (!question) {
    console.log('need --question "the one thing this run is asking"');
    process.exitCode = 1;
    return;
  }
  if (!f.corpus) {
    console.log('need --corpus <dir of fetched documents, each starting with a SOURCE: line>');
    process.exitCode = 1;
    return;
  }

  const corpusDir = path.resolve(REPO, f.corpus);
  let names = [];
  try {
    names = fs.readdirSync(corpusDir).filter(function (n) {
      return !n.startsWith('.') && fs.statSync(path.join(corpusDir, n)).isFile();
    }).sort();
  } catch (e) {
    console.log('no corpus at ' + corpusDir + ' — fetch one first. This job does not fetch.');
    process.exitCode = 1;
    return;
  }

  const run = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const outDir = path.join(REPO, 'marketing', 'research', 'runs', run);
  fs.mkdirSync(outDir, { recursive: true });

  log('run ' + run + ': ' + names.length + ' document(s), model ' + model);
  log('question: ' + question);

  const all = [];
  let noSource = 0;
  let droppedTotal = 0;
  const started = Date.now();

  for (const name of names) {
    const text = fs.readFileSync(path.join(corpusDir, name), 'utf8');
    const source = sourceOf(text);
    if (!source) { noSource += 1; log('skipped ' + name + ' — no SOURCE line'); continue; }

    for (const part of slices(text, SLICE)) {
      let res = null;
      try {
        res = await ollama('/api/chat', {
          model: model,
          stream: false,
          options: { num_ctx: 32768, temperature: 0 },
          messages: [
            { role: 'system', content: BRIEF },
            { role: 'user', content: 'QUESTION: ' + question + '\n\nDOCUMENT:\n\n' + part },
          ],
        });
      } catch (e) {
        // One document failing is noted and the night goes on.
        log(name + ' failed: ' + String((e && e.message) || e));
        continue;
      }
      const v = verified(parseFindings(res && res.message && res.message.content), part);
      droppedTotal += v.dropped;
      v.kept.forEach(function (k) { all.push({ source: source, file: name, quote: k.quote, says: k.says }); });
    }
  }

  const minutes = ((Date.now() - started) / 60000).toFixed(1);

  const lines = [];
  lines.push('# ' + question);
  lines.push('');
  lines.push('**Run ' + run + '**, model `' + model + '`, ' + names.length + ' document(s), ' +
    minutes + ' min. **' + all.length + ' verified finding(s)**; ' + droppedTotal +
    ' discarded for quoting text that is not in the document; ' + noSource +
    ' document(s) skipped for carrying no SOURCE line.');
  lines.push('');
  lines.push('Every quote below was checked character-for-character against the document it ' +
    'came from. A model that invents one loses it here rather than in a positioning ' +
    'document three weeks later. **Nothing in this file is a conclusion** — it is what ' +
    'the corpus says, and what it means is somebody else\'s call.');
  lines.push('');
  if (!all.length) {
    lines.push('**Nothing survived verification.** That is a real result and worth the row in ' +
      'MODEL-HISTORY: either the corpus does not discuss this, or the model could not find ' +
      'it without inventing. The two are told apart by reading three documents by hand.');
  }
  all.forEach(function (x) {
    lines.push('- > ' + x.quote.replace(/\n/g, ' '));
    lines.push('  ' + (x.says || '') + '  \n  — ' + x.source + ' (`' + x.file + '`)');
    lines.push('');
  });

  const target = path.join(outDir, 'findings.md');
  fs.writeFileSync(target, lines.join('\n') + '\n');
  log('done — ' + all.length + ' kept, ' + droppedTotal + ' discarded, written to ' +
    path.relative(REPO, target));
  log('append a row to design/reviews/local/MODEL-HISTORY.md before this is read as a result');
}

main().catch(function (e) {
  console.error(String((e && e.message) || e));
  process.exitCode = 1;
});
