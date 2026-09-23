'use strict';

// spirit/test/measurePlatform.js
// EVERYTHING ONE BOX CAN SAY ABOUT ITSELF, IN ONE COMMAND.
//
//   Andy: "is there one script that runs both in sequence and produces
//   all platform specific measurements?"
//
// There was not. There were two commands and only one of them saved
// anything: `runAll.js` printed 112 suites and forgot it, and
// `measureCapacity.js --save` wrote a platform directory. So a box could
// contribute its capacity and leave no record of whether the code even
// passed on it — which is the more interesting half when the box is one
// nobody has run on before.
//
//   node spirit/test/measurePlatform.js
//   node spirit/test/measurePlatform.js --as ubuntu-24.04-wsl2
//
// Runs the harness, then the capacity measurement, and writes both into
// README/CAPACITY/<platform>/ under ONE date and ONE commit.
//
// ── WHY BOTH, AND WHY TOGETHER ───────────────────────────────────────
//
// A green harness on Ubuntu is a fact about portability; a per-stream
// figure on Ubuntu is a fact about cost. Read separately they are two
// notes. Read together they answer the question somebody actually has
// about a new platform: **does it work here, and what does it cost here.**
//
// AND THEY MUST SHARE A TIMESTAMP. Taken an hour apart, a green harness
// and a capacity figure can describe two different trees while looking
// like one report. This runs them in sequence and stamps them once.
//
// ── WHY IT LIVES UNDER README/CAPACITY/ ──────────────────────────────
//
// Andy suggested README/HARNESS/REPORT for the harness half, and that is
// the better name for it in isolation. It is here instead because two
// agents committed to this path hours ago and one of them was on another
// machine: moving it now would cost more than the name is worth. The
// directory is "what this platform measured", and it holds both.

const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawnSync, execSync } = require('child_process');

const REPO = path.join(__dirname, '..', '..');

// THE SAME SLUG measureCapacity.js COMPUTES. Duplicated in two lines
// rather than shared through a module for two lines — and asserted
// below, so if they ever drift this fails loudly instead of writing a
// report into a directory nobody reads.
//
// `--as ubuntu-24.04-wsl2` when the kernel version is not what a reader
// needs. Passed straight through to the capacity tool so both halves land
// in one directory — the alternative was renaming by hand after every run,
// which is a step that eventually gets skipped and leaves one machine with
// two directories.
function namedAs() {
  const a = process.argv.slice(2);
  const i = a.indexOf('--as');
  return (i !== -1 && a[i + 1] && a[i + 1].charAt(0) !== '-') ? a[i + 1] : '';
}

function platformSlug() {
  return namedAs() || ((process.platform === 'win32' ? 'windows' : 'linux') + '-' +
    String(os.release()).replace(/[^0-9.]/g, '').split('.').slice(0, 2).join('.'));
}

function gitCommit() {
  try {
    return String(execSync('git rev-parse --short HEAD', { cwd: REPO, encoding: 'utf8' })).trim();
  } catch (e) { return 'unknown'; }
}

function run(script, args) {
  const started = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, script)].concat(args || []), {
    cwd: REPO, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  return {
    code: r.status,
    out: String(r.stdout || '') + String(r.stderr || ''),
    seconds: Math.round((Date.now() - started) / 1000),
  };
}

// "112 suites, 2665 green, 0 red, 0 unhappy" — and optionally
// ", 1 not run". Parsed rather than trusted: a harness that changed its
// summary line should produce a report that says so, not one that
// silently records zeroes.
function readHarness(text) {
  const m = /(\d+) suites, (\d+) green, (\d+) red, (\d+) unhappy(?:, (\d+) not run)?/
    .exec(text);
  if (!m) return null;
  return {
    suites: Number(m[1]), green: Number(m[2]), red: Number(m[3]),
    unhappy: Number(m[4]), notRun: Number(m[5] || 0),
  };
}

function main() {
  const commit = gitCommit();
  const slug = platformSlug();
  const at = new Date().toISOString();

  console.log('measuring ' + slug + ' at ' + commit);
  console.log('this runs the whole harness and then the capacity tool — a few minutes\n');

  console.log('1/2  the harness');
  const harnessRun = run('runAll.js');
  const harness = readHarness(harnessRun.out);
  if (harness) {
    console.log('     ' + harness.suites + ' suites, ' + harness.green + ' green, ' +
      harness.red + ' red, ' + harness.unhappy + ' unhappy  (' + harnessRun.seconds + 's)');
  } else {
    console.log('     COULD NOT READ THE SUMMARY LINE — the harness may have changed its');
    console.log('     output, or crashed. The raw text is kept in harness.txt.');
  }

  console.log('');
  // ── REPEATED, BECAUSE ONE SAMPLE IS NOT A FIGURE ──────────────────
  //
  //   Andy, 2026-09-23: "publish the median and how many runs it's over
  //   AND the spread.... that's honest."
  //
  // WHY, MEASURED. wsl-claude ran this tool three times at one commit on
  // one box and got 48,916 / 44,524 / 42,691 bytes a held connection — a
  // 14% spread — then corrected himself for having reported a single
  // sample as a rate. The figure the README published was 42,691: the
  // LOWEST of the three, and therefore the most flattering, which is the
  // opposite of the standard applied to every other number on that page.
  //
  // DEFAULT ONE, so nothing changes for a quick look and a single run is
  // reported honestly as a single run. `--runs 3` is what a published
  // figure should be taken from.
  const dir = path.join(REPO, 'README', 'CAPACITY', slug);
  const RUNS = Math.max(1, Number(flags(process.argv.slice(2)).runs) || 1);
  const samples = [];
  console.log('2/2  capacity' + (RUNS > 1 ? ' (' + RUNS + ' runs)' : ''));
  let capRun = null;
  for (let i = 0; i < RUNS; i += 1) {
    if (RUNS > 1) console.log('     run ' + (i + 1) + ' of ' + RUNS);
    capRun = run('measureCapacity.js',
      namedAs() ? ['--save', '--as', namedAs()] : ['--save']);
    if (capRun.code === 0) {
      try {
        samples.push(JSON.parse(fs.readFileSync(path.join(dir, 'capacity.json'), 'utf8')));
      } catch (e) { /* the check below reports a missing drop */ }
    }
  }
  if (capRun.code !== 0) {
    console.log('     the capacity tool failed:');
    console.log(capRun.out.split(/\r?\n/).slice(-8).join('\n'));
    process.exit(1);
  }

  if (!fs.existsSync(path.join(dir, 'capacity.json'))) {
    console.log('     capacity.json is not where this script expected it:');
    console.log('     ' + dir);
    console.log('     the two scripts name the platform differently — fix that before trusting this.');
    process.exit(1);
  }
  const cap = JSON.parse(fs.readFileSync(path.join(dir, 'capacity.json'), 'utf8'));

  // ── THE MEDIAN, THE COUNT, AND THE SPREAD ────────────────────────
  //
  // Andy: "publish the median and how many runs it's over AND the
  // spread.... that's honest."
  //
  // THE MEDIAN, not the mean: one run that paged badly drags a mean and
  // leaves a median alone, and the thing being measured is a typical run
  // rather than an average of typical and pathological.
  //
  // WRITTEN EVEN WHEN RUNS IS ONE. A drop that says `runs: 1, spread: 0`
  // is telling the truth about how much is known, and a reader can see
  // that a figure came from a single sample. Silence would let a single
  // sample be read as a settled number, which is what happened.
  //
  // The figures that vary are the measured ones. `perMemberRowBytes` is
  // a SQLite row and came back identical to the byte across platforms,
  // so it is included for completeness rather than because it moves.
  const VARIES = ['perStreamProcessBytes', 'relayAtRestRss', 'nodeAtRestRss',
    'bareNodeRss', 'perMemberRowBytes'];
  if (samples.length) {
    const stats = {};
    VARIES.forEach(function (key) {
      const vals = samples.map(function (x) { return Number(x[key]) || 0; })
        .filter(function (v) { return v > 0; }).sort(function (a, b) { return a - b; });
      if (!vals.length) return;
      const mid = vals.length % 2
        ? vals[(vals.length - 1) / 2]
        : Math.round((vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2);
      cap[key] = mid;
      stats[key] = {
        runs: vals.length,
        median: mid,
        low: vals[0],
        high: vals[vals.length - 1],
        spreadPct: vals[0] > 0
          ? Math.round(((vals[vals.length - 1] - vals[0]) / vals[0]) * 1000) / 10
          : 0,
      };
    });
    cap.runs = samples.length;
    cap.spread = stats;
    fs.writeFileSync(path.join(dir, 'capacity.json'), JSON.stringify(cap, null, 2));
    if (samples.length > 1) {
      console.log('     median of ' + samples.length + ' runs; per-stream spread ' +
        (stats.perStreamProcessBytes ? stats.perStreamProcessBytes.spreadPct + '%' : 'n/a'));
    }
  }
  console.log('     ' + Math.round(cap.perStreamProcessBytes / 1024) + ' KB per stream, ' +
    cap.perReachablePeerBytes + ' B a reachable peer  (' + capRun.seconds + 's)');

  // THE HARNESS OUTPUT IS KEPT WHOLE, not just its summary. A run with a
  // red suite on a new platform is the most useful thing this whole
  // exercise can produce, and a count of "1 red" without the line that
  // failed would waste it.
  fs.writeFileSync(path.join(dir, 'harness.txt'), harnessRun.out);
  fs.writeFileSync(path.join(dir, 'harness.json'), JSON.stringify({
    measuredAt: at,
    commit: commit,
    platform: process.platform,
    release: os.release(),
    node: process.version,
    seconds: harnessRun.seconds,
    exitCode: harnessRun.code,
    summary: harness,
    summaryParsed: !!harness,
  }, null, 2) + '\n');

  const green = harness && harness.red === 0 && harness.unhappy === 0;
  const lines = [
    '# ' + slug,
    '',
    '**Measured ' + at.slice(0, 10) + ', against `' + commit + '`.**',
    '',
    '| | |',
    '|---|---|',
    '| platform | ' + process.platform + ' ' + os.release() + ' |',
    '| node | ' + process.version + ' |',
    '| harness | ' + (harness
      ? (green ? '**' + harness.green + ' green, 0 red**' : '**' + harness.red +
          ' red, ' + harness.unhappy + ' unhappy** — see `harness.txt`') +
        ' across ' + harness.suites + ' suites, ' + harnessRun.seconds + 's'
      : '**summary unreadable** — see `harness.txt`') + ' |',
    '| per stream, process | **' + Math.round(cap.perStreamProcessBytes / 1024) + ' KB** |',
    '| a reachable peer | **' + cap.perReachablePeerBytes + ' B** |',
    '| bare node / relay at rest | ' + Math.round(cap.bareNodeRss / 1048576) + ' MB / ' +
      Math.round(cap.relayAtRestRss / 1048576) + ' MB |',
    '',
    'Both halves were taken in one run, so they describe the same tree.',
    '',
    '- [`capacity.md`](capacity.md) — what this box holds, and how it was measured',
    '- [`harness.txt`](harness.txt) — the whole harness output, kept because a red',
    '  suite on a new platform is the most useful thing here',
    '',
    '*The kernel-per-stream figure in `capacity.json` is not used and should not be:',
    'see [the conventions](../README.md).*',
    '',
  ];
  fs.writeFileSync(path.join(dir, 'platform.md'), lines.join('\n'));

  console.log('');
  console.log('written: README/CAPACITY/' + slug + '/platform.md');
  console.log('         README/CAPACITY/' + slug + '/harness.json, harness.txt');
  console.log('         README/CAPACITY/' + slug + '/capacity.json, capacity.md');
  console.log('');
  if (!green) {
    console.log('NOTE: the harness was not clean on this box. That is worth reporting —');
    console.log('      harness.txt has the failing lines.');
  }
  console.log('Commit the directory by name. Never `git add -A` in this repo.');
}

main();
