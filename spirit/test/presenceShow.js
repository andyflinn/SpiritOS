'use strict';

// spirit/test/presenceShow.js
// A test whose assertion is a person looking at a screen.
//
// Andy: "i want to visualy see the dots appearing and disappearing in
// contacts, while you manipulate things. be slow enough for me to follow
// aor query me for what i see? another test approach."
//
// It is a different approach, and it is worth having for one reason: the
// fast suites prove the node's presence table is right, and presenceWire
// proves the socket is real, and NEITHER of them can tell you the dot is
// on the screen. Everything between the job payload and the pixel — the
// join to whoBook, the repaint, the colour actually chosen — has no
// automated witness and would not until somebody wrote a browser driver.
//
// So the witness is Andy. The script moves the world one step at a time,
// waits long enough to be followed, then asks what he sees and writes
// the answer down beside what the scenario said to expect.
//
//   node spirit/test/presenceShow.js                   presence-colours
//   node spirit/test/presenceShow.js buddies           a named scenario
//   node spirit/test/presenceShow.js --pace 15         slower
//   node spirit/test/presenceShow.js --dry             read the script only
//
// WHAT IT DOES NOT DO: build the world. `labPopulate.js` does that, it
// takes about a minute, and doing it from here would mean a wrong answer
// at step 6 costs a rebuild. Run that first; this drives what is there.
//
// It also never touches the live relay. Every step is against the lab
// relay on loopback, because a demonstration that edits spirit.andyflinn.com
// is a demonstration you cannot run twice in an afternoon.

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const scenarioGrammar = require('./scenario');
// READ ONLY, and the same rule labPopulate carries at the top of itself:
// the key in spirit/run/relay-state/identity.json owns
// spirit.andyflinn.com. This file signs with it and never writes it.
const auth = require('../run/js/relayAuth');

const MASTER = 'http://127.0.0.1:65420';
const WORK_URL = 'http://127.0.0.1:65432';
const SCENARIOS = path.join(__dirname, 'visual');
const NAME_PREFIX = 'lab-';
const NODE_PREFIX = 'lw-';
const WORK_RUN = path.join(__dirname, '..', 'run');
const LAB_RELAY_ID = 'lw-relay';

const args = process.argv.slice(2);
const dry = args.indexOf('--dry') !== -1;
// Preflight and stop. Useful before committing to the sequence, and the
// only way to ask "is this ready" without the asking itself stopping
// somebody's node.
const checkOnly = args.indexOf('--check') !== -1;
const paceAt = args.indexOf('--pace');
const PACE = paceAt === -1 ? 9 : Math.max(2, Number(args[paceAt + 1]) || 9);
const wanted = args.filter(function (a) {
  return a.charAt(0) !== '-' && a !== String(PACE);
})[0] || 'presence-colours';

const rl = (dry || checkOnly)
  ? null
  : readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  if (!rl) return Promise.resolve('(dry run)');
  return new Promise(function (resolve) {
    rl.question('\n    ' + question + '\n    > ', function (answer) {
      resolve(String(answer || '').trim());
    });
  });
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function post(url, body) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, error: String(e.message || e) };
  }
}

async function nodes() {
  try {
    const res = await fetch(MASTER + '/api/nodes');
    const body = await res.json();
    return (body && body.nodes) || [];
  } catch (e) { return []; }
}

// The lab relay's own URL, from labMaster's table rather than a
// constant — it is a port in a range, and a constant here would be a
// second place for it to be wrong.
async function labRelayUrl() {
  const table = await nodes();
  const row = table.filter(function (n) { return n.id === LAB_RELAY_ID; })[0];
  return row ? 'http://127.0.0.1:' + row.port : null;
}

async function rosterOf(url) {
  try {
    const res = await fetch(url + '/api/relay/who');
    const body = await res.json();
    return Array.isArray(body) ? body : ((body && body.peers) || []);
  } catch (e) { return []; }
}

// THE STEP THAT MAKES WHITE HAPPEN WHILE SOMEBODY IS WATCHING.
//
// labPopulate performs the scenario's `then` removals when it builds the
// world, which leaves the right picture on screen and shows none of the
// change. Andy asked to see dots appear and disappear, so this does the
// removal live — the same call, signed the same way, at a moment he is
// looking at.
//
// By KEY, never by label: a label can be worn by two people and this is
// the one verb that destroys something.
async function removeFromLab(label) {
  const url = await labRelayUrl();
  if (!url) return 'no lab relay in labMaster\'s table — nothing to remove from';

  const me = auth.loadIdentity(WORK_RUN);
  if (!me || !me.privateKey) return 'your node has no identity, so nothing can be signed';

  const row = (await rosterOf(url)).filter(function (p) {
    return (p.publicLabel || p.name) === label;
  })[0];
  if (!row) return label + ' has no row on the lab relay already — nothing to remove';

  const done = await post(url + '/api/relay/remove-peer', {
    name: me.name,
    key: row.publicKey,
    sig: auth.sign(me.privateKey, auth.removePeerMessage(row.publicKey)),
  });
  return done.ok
    ? 'removed ' + label + " from the lab relay — they stay in your contacts"
    : 'could not remove ' + label + ': ' + (done.error || done.status);
}

// ── the counted wait ──────────────────────────────────────────────────
//
// A bare sleep looks identical to a hang, and this one is deliberately
// long enough to be followed — which is long enough to be mistaken for
// a crash. Counting out loud costs nothing and removes the doubt.
async function hold(seconds, why) {
  process.stdout.write('    ' + why + ' ');
  for (let left = seconds; left > 0; left--) {
    process.stdout.write(left + (left > 1 ? '·' : ''));
    await sleep(1000);
  }
  process.stdout.write(' now\n');
}

function heading(text) {
  console.log('\n' + '─'.repeat(72));
  console.log('  ' + text);
  console.log('─'.repeat(72));
}

// ── the steps ─────────────────────────────────────────────────────────
//
// Built from the scenario rather than written out, so the demonstration
// and the suites are looking at the same world — and so a colour the
// scenario stops claiming stops being asked about here.
function stepsFor(s) {
  const steps = [];

  steps.push({
    do: null,
    settle: 3,
    ask: 'Open Contacts. How many rows have a coloured dot on the LEFT, and what colours?',
    expect: 'A dot on every row. Mostly green — every lab peer whose node is up.',
  });

  // GREEN -> RED, by stopping a node. The only way red is produced: the
  // relay still holds a row for them and says they are absent.
  const victim = s.peers.filter(function (p) { return p.running; })[0];
  if (victim) {
    steps.push({
      do: async function () {
        const r = await post(MASTER + '/api/nodes/' + NODE_PREFIX + NAME_PREFIX + victim.name + '/stop');
        return r.ok ? 'stopped ' + victim.name + "'s node" : 'could not stop it: ' + (r.error || r.status);
      },
      settle: PACE,
      ask: 'What colour is ' + NAME_PREFIX + victim.name + "'s dot now?",
      expect: 'RED. Their node is down, but the relay still holds their row — so a relay ' +
        'you share SAYS they are absent. That is what red means, and it is not the same as white.',
    });

    steps.push({
      do: async function () {
        const r = await post(MASTER + '/api/nodes/' + NODE_PREFIX + NAME_PREFIX + victim.name + '/start');
        return r.ok ? 'started ' + victim.name + "'s node again" : 'could not start it: ' + (r.error || r.status);
      },
      // Longer: a node has to boot, read relays.json and get a stream
      // open before the relay has anything new to say about it.
      settle: PACE + 6,
      ask: 'And now? Did it come back on its own, without you reloading anything?',
      expect: 'GREEN again, with no reload. The dot follows the connection, and the ' +
        'connection is the presence — there is nothing to announce and nothing to expire.',
    });
  }

  // RED -> WHITE, by taking the row away while he watches. The third
  // colour, and the only one that needs somebody to LEAVE.
  //
  // Whoever the scenario removes is already gone by the time the world
  // is built, so this picks somebody who still has a row — otherwise the
  // step would announce a change and produce none, which is the worst
  // thing a demonstration can do.
  const leaver = s.peers.filter(function (p) {
    return p.running && !s.then.some(function (t) { return t.remove === p.name; });
  })[0] || s.peers.filter(function (p) { return p.running; })[0];

  if (leaver) {
    steps.push({
      do: null,
      settle: 3,
      ask: 'Before the next one: what colour is ' + NAME_PREFIX + leaver.name + ' right now?',
      expect: 'GREEN — their node is up and they have a row on the lab relay.',
    });
    steps.push({
      do: function () { return removeFromLab(NAME_PREFIX + leaver.name); },
      settle: PACE,
      ask: 'Watch ' + NAME_PREFIX + leaver.name + '. What colour did they go, and are they still listed?',
      expect: 'WHITE, and still listed — not red. Their node never stopped: it is still ' +
        'running and still connected. What changed is that no relay you share has a row ' +
        'for them any more, so nobody is in a position to say anything about them. ' +
        'White is "unseen", never "offline" — and a red here would be the column ' +
        'claiming knowledge it does not have.',
    });
    steps.push({
      do: null,
      settle: 2,
      ask: 'Look at labMaster too — is ' + NODE_PREFIX + NAME_PREFIX + leaver.name + ' still running?',
      expect: 'Yes, still up. That is the whole point of the previous answer: a node ' +
        'that is perfectly healthy reads as white the moment you stop sharing a relay ' +
        'with it. Rebuild the world to put them back.',
    });
  }

  steps.push({
    do: null,
    settle: 2,
    ask: 'Last one: hover a dot. Does the tooltip say something that matches its colour?',
    expect: 'present / absent / not known — the words, so the colour is never the only ' +
      'thing carrying the meaning.',
  });

  return steps;
}

async function preflight(s) {
  heading('Before we start');

  const table = await nodes();
  if (!table.length) {
    console.log('  labMaster is not answering on 65420.');
    console.log('  Start it:   node spirit/test/labMaster/labMaster.js');
    return false;
  }

  const work = table.filter(function (n) { return n.id === 'work'; })[0];
  const labs = table.filter(function (n) { return n.id.indexOf(NODE_PREFIX) === 0; });
  const up = labs.filter(function (n) { return n.running; });

  console.log('  labMaster : up, ' + table.length + ' node(s) in the table');
  console.log('  your node : ' + (work && work.running ? 'running on 65432' : 'NOT RUNNING'));
  console.log('  lab nodes : ' + labs.length + ' built, ' + up.length + ' running');

  if (!labs.length) {
    console.log('');
    console.log('  There is no lab world to look at. Build it first:');
    console.log('    node spirit/test/labPopulate.js ' + wanted);
    return false;
  }
  if (!work || !work.running) {
    console.log('');
    console.log('  Your own node has to be up — it is the one drawing the dots.');
    return false;
  }

  // Presence reaches the shell as a job. If the job is not there, the
  // column will be white for everybody and the demonstration would be a
  // twenty-minute way to discover the node is running old code.
  try {
    const res = await fetch(WORK_URL + '/api/jobs');
    const jobs = await res.json();
    const job = (jobs || []).filter(function (j) { return j.type === 'relay-presence'; })[0];
    if (!job) {
      console.log('');
      console.log('  Your node publishes no relay-presence job, so every dot would be white.');
      console.log('  Restart it on this code and try again.');
      return false;
    }
    const known = Object.keys((job.data && job.data.presence) || {}).length;
    console.log('  presence  : the job is live and knows ' + known + ' key(s)');
  } catch (e) {
    console.log('  presence  : could not ask your node (' + e.message + ')');
    return false;
  }

  return true;
}

async function main() {
  let doc = null;
  try { doc = JSON.parse(fs.readFileSync(path.join(SCENARIOS, wanted + '.visual.json'), 'utf8')); }
  catch (e) { doc = null; }
  if (!doc) {
    console.log('No scenario called "' + wanted + '".');
    if (rl) rl.close();
    return;
  }
  const wrong = scenarioGrammar.problems(doc);
  if (wrong.length) {
    console.log('That scenario does not read: ' + wrong.join('; '));
    if (rl) rl.close();
    return;
  }
  const s = scenarioGrammar.normalize(doc);

  heading(s.title);
  console.log('  ' + s.why);
  console.log('');
  s.peers.forEach(function (p) {
    console.log('  ' + NAME_PREFIX + p.name + (p.expect ? ' — ' + p.expect : ''));
  });

  const steps = stepsFor(s);

  if (dry && !checkOnly) {
    heading('The script, unrun (' + steps.length + ' steps, about ' +
      Math.round(steps.reduce(function (t, x) { return t + x.settle; }, 0) / 60) + ' minutes of waiting)');
    steps.forEach(function (step, i) {
      console.log('\n  ' + (i + 1) + '. ' + step.ask);
      console.log('     expecting: ' + step.expect);
    });
    console.log('');
    return;
  }

  const ready = await preflight(s);
  if (checkOnly) {
    console.log('');
    console.log(ready ? '  Ready. Run it without --check to start.' : '  Not ready yet.');
    console.log('');
    return;
  }
  if (!ready) { rl.close(); return; }

  console.log('');
  console.log('  Open http://localhost:65432 and go to Contacts. Leave it open —');
  console.log('  nothing below asks you to reload, and a dot that only moves on a');
  console.log('  reload has not proved anything.');
  await ask('Ready? (enter)');

  const seen = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    heading('Step ' + (i + 1) + ' of ' + steps.length);

    if (step.do) {
      const said = await step.do();
      console.log('  doing     : ' + said);
    } else {
      console.log('  doing     : nothing — just look');
    }

    await hold(step.settle, 'settling');
    const answer = await ask(step.ask);
    console.log('\n  expected  : ' + step.expect);

    // ASKED AFTER THE EXPECTATION IS SHOWN, and about agreement rather
    // than about the thing itself. Andy has already said what he saw
    // without being led; this only records whether the two match, which
    // is a judgement he is better placed to make than a regex over his
    // sentence would be.
    const agree = await ask('Does that match what you saw? (y / n / note)');
    seen.push({ n: i + 1, ask: step.ask, answer: answer, expect: step.expect, agree: agree });
  }

  heading('What you saw');
  let bad = 0;
  seen.forEach(function (row) {
    const good = /^y/i.test(row.agree);
    if (!good) bad++;
    console.log('  ' + (good ? '✅' : '❌') + '  ' + row.n + '. ' + row.ask);
    console.log('      you said : ' + (row.answer || '(nothing)'));
    if (!good) console.log('      expected : ' + row.expect);
    if (row.agree && !/^[yn]$/i.test(row.agree)) console.log('      note     : ' + row.agree);
  });

  console.log('');
  console.log('  ' + (seen.length - bad) + ' of ' + seen.length + ' matched' +
    (bad ? ' — ' + bad + ' did not' : ''));
  console.log('');
  rl.close();
}

main().catch(function (e) {
  console.error(String((e && e.stack) || e));
  if (rl) rl.close();
  process.exit(1);
});
