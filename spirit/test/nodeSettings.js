'use strict';

// spirit/test/nodeSettings.js
// THE OWNER'S OWN BOUND, READ AND OBEYED, NEVER WRITTEN (R31).
//
//   Andy: "the node owner must be able to cap the shadow-roll by disc
//   space" — "a ceiling like available-ram, taken from the
//   startup-configuration, MUST be a constant to the governor."

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const settings = require('../run/js/nodeSettings');
const hub = require('../run/js/hub');

function home(json) {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-nodesettings-'));
  fs.mkdirSync(path.join(h, 'relay-state'), { recursive: true });
  if (json !== undefined) {
    fs.writeFileSync(path.join(h, 'relay-state', 'node.json'),
      typeof json === 'string' ? json : JSON.stringify(json));
  }
  return h;
}

test.startTest('nodeSettings — the owner\'s bound on their own node');

test.subHeading('No file means the defaults, and no file is written');

{
  const H = home();
  const s = settings.load(H);
  if (s.cacheMaxMB === settings.DEFAULT_CACHE_MAX_MB && s.problems.length === 0) {
    test.check('an unconfigured node takes the 20 MB default, with nothing to complain about');
  } else {
    test.fail('defaults: ' + JSON.stringify(s));
  }
  // A node that has never been configured should not grow a file saying
  // so — and the programme writing the owner's bound is exactly what 0015
  // forbids.
  if (!fs.existsSync(settings.filePath(H))) {
    test.check('and reading the settings did not create node.json');
  } else {
    test.fail('node.json appeared without the owner writing it');
  }
}

test.subHeading('The owner\'s number is obeyed');

{
  const H = home({ cacheMaxMB: 5 });
  if (settings.load(H).cacheMaxMB === 5 && settings.cacheMaxBytes(H) === 5 * 1024 * 1024) {
    test.check('a cap the owner wrote in megabytes is the cap, in bytes, the store enforces');
  } else {
    test.fail('owner value: ' + JSON.stringify(settings.load(H)));
  }

  // AND IT REACHES THE SHADOW, which is the only reason it exists.
  const S = hub.shadow(H);
  if (S.maxBytes === 5 * 1024 * 1024) {
    test.check('and the shadow opened for that home is held to it');
  } else {
    test.fail('shadow maxBytes: ' + S.maxBytes);
  }
}

test.subHeading('A number that cannot work is said, not swallowed');

{
  // TOO SMALL IS RAISED TO THE FLOOR, AND SAID. The owner asked for small;
  // they get the smallest that still works, and are told why.
  const tiny = settings.load(home({ cacheMaxMB: 0.01 }));
  if (tiny.cacheMaxMB === settings.MIN_CACHE_MAX_MB && tiny.problems.length === 1) {
    test.check('a cap below the floor is raised to ' + settings.MIN_CACHE_MAX_MB +
      ' MB, and the reason is reported');
  } else {
    test.fail('tiny: ' + JSON.stringify(tiny));
  }

  // NONSENSE FALLS BACK, AND SAYS SO. A number the owner typed that the
  // node quietly ignored would be worse than no setting at all.
  const nonsense = settings.load(home({ cacheMaxMB: 'lots' }));
  if (nonsense.cacheMaxMB === settings.DEFAULT_CACHE_MAX_MB && nonsense.problems.length === 1) {
    test.check('a value that is not a number falls back to the default and says so');
  } else {
    test.fail('nonsense: ' + JSON.stringify(nonsense));
  }

  const broken = settings.load(home('{ this is not json'));
  if (broken.cacheMaxMB === settings.DEFAULT_CACHE_MAX_MB && broken.problems.length === 1) {
    test.check('and a file that is not JSON boots on the defaults rather than refusing to start');
  } else {
    test.fail('broken: ' + JSON.stringify(broken));
  }
}

test.subHeading('Read once — a constant to the programme');

{
  // Andy's rule for any owner-configured bound. Editing the file under a
  // running node changes nothing until it restarts, which is the
  // behaviour an owner can predict.
  const H = home({ cacheMaxMB: 7 });
  settings.load(H);
  fs.writeFileSync(settings.filePath(H), JSON.stringify({ cacheMaxMB: 9 }));
  if (settings.load(H).cacheMaxMB === 7) {
    test.check('a change to the file while the node runs waits for the next start');
  } else {
    test.fail('re-read mid-run: ' + settings.load(H).cacheMaxMB);
  }
}


test.subHeading('How many remembered strangers one search reads (R39)');

{
  //   Andy: "cap at 1000 rows compared. (or a tunable value with default)"
  if (settings.searchMemoryRows(home()) === 1000 && settings.DEFAULT_SEARCH_MEMORY_ROWS === 1000) {
    test.check('an unconfigured node compares the newest 1000 remembered strangers');
  } else {
    test.fail('default: ' + settings.searchMemoryRows(home()));
  }
  const tuned = home({ searchMemoryRows: 250 });
  const off = home({ searchMemoryRows: 0 });
  if (settings.searchMemoryRows(tuned) === 250 && settings.searchMemoryRows(off) === 0) {
    test.check("the owner's number is obeyed, and 0 is a real answer — no strangers from memory");
  } else {
    test.fail('tuned: ' + settings.searchMemoryRows(tuned) + ', off: ' + settings.searchMemoryRows(off));
  }
  const bad = home({ searchMemoryRows: 'lots' });
  const half = home({ searchMemoryRows: 2.5 });
  if (settings.searchMemoryRows(bad) === 1000 && settings.load(bad).problems.length === 1 &&
      settings.searchMemoryRows(half) === 1000) {
    test.check('anything but a whole count falls back to 1000, and says so');
  } else {
    test.fail('bad: ' + JSON.stringify(settings.load(bad)) + ', half: ' + settings.searchMemoryRows(half));
  }
}

test.reportSuccessFailureCount();
