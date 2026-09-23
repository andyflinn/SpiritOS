'use strict';

// spirit/run/process/js/monitorDrill/drillVerify.js
// THE DRILL, PROVEN WITHOUT A SCREEN.
//
//   Andy, 2026-09-23: "you both verify screenless first, that's the
//   procedure."
//
// The Relay Monitor's console is not built. What it will draw is the
// relay's monitor feed — `relay-event` messages, filtered at the relay,
// reaching the OWNER's node — and that feed exists today. So the honest
// order is: prove the data screenless, and leave the UI session nothing
// to get wrong but the drawing.
//
//   node process/js/monitorDrill/drillVerify.js [--seconds 90] [--peer <key>]
//
// It turns monitoring ON through Andy's node (his standing grant: *"you
// are allowed to speak through my personal node when it help our
// cause"*), reads that node's own event stream, counts what arrives by
// identity, and turns monitoring OFF when it stops — including on Ctrl-C,
// because a monitor left on is a relay talking to nobody.
//
// ── WHAT A MATCH PROVES, AND WHAT IT DOES NOT ───────────────────────
//
// A match proves the relay sees each post, attributes it to the right
// identity, and delivers the event to its owner — which is every step the
// console depends on. It does not prove a pane draws them correctly; that
// is the UI session's to show, against the same numbers.
//
// `--peer` asks the relay to filter, which is the other half: the count
// under a filter must equal that identity's line in the drill's tally and
// nothing else.

const http = require('http');

const OWNER_NODE = process.env.SPIRIT_NODE || 'http://127.0.0.1:65432';
const RELAY_KEY = process.env.SPIRIT_RELAY_KEY ||
  'MCowBQYDK2VwAyEAV2NFEWo+LGgWl0WRr6M8gWDiRfdn4tKTKEdkbCAsCR4=';

// The identities in play. Names for the table; keys are what the relay
// routes by and what a filter takes (RELAY-MONITOR.md: filter by
// identity, never by caption).
const KNOWN = {
  'MCowBQYDK2VwAyEAgrEcBu0FkTzmGKs+oBS+OllzvZh+d/0Rr6fO/fXD+0c=': 'andy (control)',
  'MCowBQYDK2VwAyEAMP7RU9Q6++SG+UPagCp1uOYQFtJM/kr1b+76Fj+AtJ0=': 'claude-windows',
  'MCowBQYDK2VwAyEAAJJk0G0jq2/1LToJhzZOZuLKUf2sP+aNrPKFRJo9BXQ=': 'claude-windows-2',
  'MCowBQYDK2VwAyEANrNqPPaIac2/NlIHC7C+LoalDe0ub7RvS7U4c6P+lzQ=': 'wsl-claude',
  'MCowBQYDK2VwAyEAfqga+lduUTeGD//mAlIVzGDbExqsRWNRuo+PRcGFkPw=': 'wsl-claude-2',
};

function name(key) {
  if (!key) return '(none)';
  return KNOWN[key] || ('…' + String(key).slice(-10));
}

function door(pathname, body) {
  const u = new URL(pathname, OWNER_NODE);
  const payload = body === undefined ? null : JSON.stringify(body);
  return new Promise(function (resolve, reject) {
    const req = http.request({
      host: u.hostname, port: u.port, path: u.pathname,
      method: payload ? 'POST' : 'GET',
      headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {},
    }, function (res) {
      const chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        const text = Buffer.concat(chunks).toString('utf8');
        try { resolve(JSON.parse(text)); }
        catch (e) { reject(new Error('the node answered ' + res.statusCode + ': ' + text.slice(0, 160))); }
      });
    });
    req.on('error', function (e) { reject(new Error('no node at ' + OWNER_NODE + ' (' + e.message + ')')); });
    req.end(payload || undefined);
  });
}

// The owner verb, as a signed post to the relay's own key — the shape
// every owner grant travels in (decision 0010).
function monitor(on, peer) {
  const body = { monitor: { on: !!on, filter: on && peer ? { peer: peer } : null } };
  const packet = JSON.stringify({ app: 'relay', v: 1, body: body });
  return door('/api/spirit', { verb: 'peer.post', to: RELAY_KEY, text: packet }).then(function (out) {
    let back = null;
    try { back = JSON.parse(out.text || 'null'); } catch (e) { back = null; }
    return (back && back.body) || out;
  });
}

function flags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) { out[argv[i].slice(2)] = argv[i + 1]; i += 1; }
  }
  return out;
}

async function main() {
  const f = flags(process.argv.slice(2));
  const seconds = Number(f.seconds) || 90;
  const peer = f.peer || '';

  const on = await monitor(true, peer);
  if (!on || on.monitoring !== true) {
    throw new Error('the relay did not start monitoring: ' + JSON.stringify(on).slice(0, 200));
  }
  console.log('monitoring ON' + (peer ? ' — filtered at the relay to ' + name(peer) : ' — unfiltered') +
    ', listening for ' + seconds + 's on ' + OWNER_NODE);
  console.log('run the drill now, in another window:');
  console.log('  node process/js/monitorDrill/monitorDrill.js --phase 5');
  console.log('');

  const byFrom = Object.create(null);
  const byTo = Object.create(null);
  const kinds = Object.create(null);
  let total = 0;

  const u = new URL('/api/events', OWNER_NODE);
  const req = http.get({ host: u.hostname, port: u.port, path: u.pathname }, function (res) {
    let buf = '';
    res.on('data', function (chunk) {
      buf += chunk.toString('utf8');
      let i;
      while ((i = buf.indexOf('\n\n')) !== -1) {
        const block = buf.slice(0, i); buf = buf.slice(i + 2);
        const da = /data: (.*)/.exec(block);
        if (!da) continue;
        let msg = null;
        try { msg = JSON.parse(da[1]); } catch (e) { continue; }
        // The node forwards a relay's event as it arrives; what identifies
        // it is `kind` plus from/to, which is what a console filters on.
        const ev = msg && (msg.kind || msg.event);
        if (!ev || ['post', 'reply', 'refused'].indexOf(ev) === -1) continue;
        total += 1;
        kinds[ev] = (kinds[ev] || 0) + 1;
        if (msg.from) byFrom[msg.from] = (byFrom[msg.from] || 0) + 1;
        if (msg.to) byTo[msg.to] = (byTo[msg.to] || 0) + 1;
      }
    });
  });
  req.on('error', function (e) { console.error('cannot listen: ' + e.message); });

  const stop = async function () {
    try { req.destroy(); } catch (e) { /* gone */ }
    try { await monitor(false); } catch (e) { /* best effort */ }
    console.log('');
    console.log('SEEN in ' + seconds + 's' + (peer ? ' (relay filtered to ' + name(peer) + ')' : '') + ':');
    console.log('  ' + total + ' event(s)  ' +
      Object.keys(kinds).map(function (k) { return k + ' ' + kinds[k]; }).join(', '));
    console.log('');
    console.log('  from:');
    Object.keys(byFrom).sort(function (a, b) { return byFrom[b] - byFrom[a]; })
      .forEach(function (k) { console.log('    ' + String(byFrom[k]).padStart(4) + '  ' + name(k)); });
    console.log('  to:');
    Object.keys(byTo).sort(function (a, b) { return byTo[b] - byTo[a]; })
      .forEach(function (k) { console.log('    ' + String(byTo[k]).padStart(4) + '  ' + name(k)); });
    console.log('');
    console.log('monitoring OFF. Compare these with the drill\'s tally: they match, or the feed is wrong.');
  };

  process.on('SIGINT', function () { stop().then(function () { process.exit(0); }); });
  setTimeout(function () { stop().then(function () { process.exit(0); }); }, seconds * 1000);
}

main().catch(function (e) {
  console.error('verify failed: ' + String(e && e.message ? e.message : e));
  // A monitor left on is a relay talking to nobody.
  monitor(false).catch(function () {}).then(function () { process.exitCode = 1; });
});
