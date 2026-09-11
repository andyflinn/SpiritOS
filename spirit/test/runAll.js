'use strict';

// spirit/test/runAll.js
// Every suite, one command, one number at the end.
//
// There was no runner. Fifty-two files each had to be named by hand, so
// in practice a change got the four suites somebody remembered and the
// other forty-eight found out weeks later — which is the slow half of
// the development cycle Andy asked to shorten:
//
//   "i, visually can only run 1/1000 of the number of test you can run
//    automatically, but we both can use the same scenario"
//
// The suites are DISCOVERED, not listed. A list is a second place to
// forget something: a new suite nobody added would simply never run, and
// would look exactly like a suite that passes.
//
//   node spirit/test/runAll.js            everything
//   node spirit/test/runAll.js device     only suites whose name matches
//   node spirit/test/runAll.js --serial   one at a time, for a clean log
//
// Suites run several at a time by default because most of them are pure
// in-process work and the wall clock is dominated by the few that open a
// socket. Each is its own process already, so nothing is shared and
// nothing needed changing to allow it.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DIR = __dirname;

// Not suites. Libraries, builders, and the three startTest* files, which
// SPAWN A SERVER AND SIT THERE — they are how a person opens a node by
// hand, and a harness that ran them would simply hang.
const NOT_A_SUITE = [
  'testSupport.js', 'scenario.js', 'world.js', 'runAll.js',
  'labWorld.js', 'labPopulate.js', 'labMaster.js', 'setupRelayFakes.js',
  'relayProbe.js', 'startTestAndy.js', 'startTestBert.js', 'startTestRelay.js',
  // Fails on purpose: it is the worked example of what a failing check
  // looks like, and it would be the one permanent red in every run.
  'testTemplate.js',
];

// Last, always. It reads the other suites off disk to check that every
// visual scenario still points at one that exists, so it should be
// answering for the tree as the run leaves it.
const LAST = 'visualScenarios.js';

const args = process.argv.slice(2);
const serial = args.indexOf('--serial') !== -1;
const filter = args.filter(function (a) { return a.charAt(0) !== '-'; })[0] || '';
const LANES = serial ? 1 : 6;

function discover() {
  const found = fs.readdirSync(DIR).filter(function (f) {
    if (!/\.js$/.test(f)) return false;
    if (NOT_A_SUITE.indexOf(f) !== -1) return false;
    if (f === LAST) return false;
    if (filter && f.toLowerCase().indexOf(filter.toLowerCase()) === -1) return false;
    // A suite is a file that reports. Anything else in here is a module
    // somebody put beside them, and running it proves nothing.
    return /startTest\s*\(/.test(fs.readFileSync(path.join(DIR, f), 'utf8'));
  }).sort();

  if (!filter || LAST.toLowerCase().indexOf(filter.toLowerCase()) !== -1) found.push(LAST);
  return found;
}

function runOne(file) {
  return new Promise(function (done) {
    const started = Date.now();
    const child = spawn(process.execPath, [path.join(DIR, file)], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', function (d) { out += d; });
    child.stderr.on('data', function (d) { out += d; });

    // A suite that hangs is a suite that fails. Left alone one of these
    // waits out a 66-second rendezvous hold and then the next one does
    // too, and the run looks broken rather than red.
    const killer = setTimeout(function () { child.kill(); }, 180000);

    child.on('close', function (code) {
      clearTimeout(killer);
      const m = out.match(/Test completed\.\s+✅:(\d+)(?:\s+❌:(\d+))?/);
      done({
        file: file,
        ms: Date.now() - started,
        ok: m ? Number(m[1]) : 0,
        // -1 for "never reported", which is not zero failures. A suite
        // that crashed before its last line has to read as worse than
        // one that ran and passed, not the same.
        no: m ? Number(m[2] || 0) : -1,
        code: code,
        out: out,
      });
    });
  });
}

async function main() {
  const files = discover();
  if (!files.length) {
    console.log('no suites match ' + JSON.stringify(filter));
    process.exit(1);
  }

  console.log('\n' + files.length + ' suites' + (filter ? ' matching ' + JSON.stringify(filter) : '') +
    (serial ? ', one at a time' : ', ' + LANES + ' at a time') + '\n');

  const results = [];
  let next = 0;

  async function lane() {
    while (next < files.length) {
      const mine = files[next++];
      results.push(await runOne(mine));
    }
  }

  // visualScenarios goes last on its own, after everything else has
  // finished, so it reads a settled tree.
  const body = files.filter(function (f) { return f !== LAST; });
  const tail = files.filter(function (f) { return f === LAST; });

  const lanes = [];
  const all = body;
  next = 0;
  for (let i = 0; i < Math.min(LANES, all.length); i++) {
    lanes.push((async function () {
      while (next < all.length) results.push(await runOne(all[next++]));
    })());
  }
  await Promise.all(lanes);
  for (const f of tail) results.push(await runOne(f));

  // Reported in the order they were discovered, never the order they
  // happened to finish, or the same run reads differently twice.
  const byName = Object.create(null);
  results.forEach(function (r) { byName[r.file] = r; });

  let green = 0, red = 0, unhappy = [];
  files.forEach(function (f) {
    const r = byName[f];
    const broke = r.no !== 0;
    green += r.ok;
    if (r.no > 0) red += r.no;
    if (broke) unhappy.push(r);
    console.log(
      (broke ? 'FAIL  ' : '  ok  ') + f.padEnd(26) +
      String(r.ok).padStart(4) + ' ✅  ' +
      (r.no > 0 ? String(r.no).padStart(2) + ' ❌  ' : r.no < 0 ? ' ? ❌  ' : '       ') +
      String(r.ms).padStart(6) + 'ms'
    );
  });

  // The failing lines themselves, after the table rather than inside it.
  // A run with one red suite should still show its shape at a glance.
  unhappy.forEach(function (r) {
    console.log('\n--- ' + r.file + (r.no < 0 ? ' never reported (exit ' + r.code + ')' : ''));
    const lines = r.out.split('\n').filter(function (l) {
      return /FAILURE|Error:|at .*\.js:\d+/.test(l);
    });
    (lines.length ? lines : r.out.split('\n').slice(-12)).slice(0, 12)
      .forEach(function (l) { console.log('    ' + l.replace(/\s+$/, '')); });
  });

  console.log('\n' + files.length + ' suites, ' + green + ' green, ' + red + ' red, ' +
    unhappy.length + ' unhappy\n');
  process.exit(unhappy.length ? 1 : 0);
}

main();
