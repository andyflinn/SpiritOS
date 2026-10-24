'use strict';

// spirit/test/stackFrameViolators.js
// A DOOR'S RUN SAYS WHO GOES AROUND THE GATE, ONE LINE EACH (goal/G22.3).
//
// Andy, 2026-10-13, on the Stacks tab's run dialog: "much better, gimme that when i press run:", and the lines he wants,
// one per distinct violator, e.g. "hub.js:300 sealedClaim (from handleClaim) ---> GET /api/relay/key, bypassing
// createPeerPost". The stackFrameChecks plugin turns a run's raw paths (oneDoorStacks.js's verdict.paths) into those
// lines with its formatter, violators.js beside its server half, and the run dialog shows them.
//
// Fed the paths the tree measured on 2026-10-13 for two doors gated by peerPost.js::createPeerPost: the relay
// (node:http+https+fetch on /api/relay/) and the request library (relayRequest.js). The expected lines are Andy's,
// except two where his hand-written sample has no rule behind it (said at each).

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const PLUGIN_DIR = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'plugins', 'js', 'stackFrameChecks');
const FORMATTER = path.join(PLUGIN_DIR, 'violators.js');
const SERVER_HALF = path.join(PLUGIN_DIR, 'stackFrameChecks.js');
// The run's view: since goal/G27.2 (D1) the door's own dialog, shell/stackFrameCheckDetail, no longer the Stacks pane.
const UI = path.join(__dirname, '..', 'run', 'shell', 'stackFrameCheckDetail', 'stackFrameCheckDetail.js');
const REPO = path.join(__dirname, '..', '..');

test.startTest('Stack-frame checks: a run\'s paths as one line per violator');

let format = null;
try { format = require(FORMATTER).violators; } catch (e) { format = null; }

const H = 'spirit/run/spirit/hub.js';
const S = 'spirit/run/spirit/server.js';
const RR = 'spirit/run/spirit/relayRequest.js:108 in relayRequest < spirit/run/spirit/relayRequest.js:92:relayRequest < ';
const CLAIM_UP = H + ':973:guarded in createHub < ' + H + ':1024:withClaimRelay in createHub < ' + H + ':1073 in handleClaim in createHub < ' +
  H + ':1072:handleClaim in createHub < ' + S + ':2079:handler < ' + S + ':1069 < ' + S + ':1046 < ' + S + ':2260';
const SEALED = H + ':300 in sealedClaim < ' + H + ':300:sealedClaim < ' + H + ':1079 in handleClaim in createHub < ' + CLAIM_UP;
const CLAIM = H + ':1084 in handleClaim in createHub < ' + H + ':1082 in handleClaim in createHub < ' + CLAIM_UP;
const BADGE = function (caller, serverLine) {
  return H + ':2784 in relaySummary in createHub < spirit/run/spirit/ownerBadge.js:369 in probe < spirit/run/spirit/ownerBadge.js:367:probe < ' +
    H + ':2783:relaySummary in createHub < ' + H + ':' + caller + ' in createHub < ' + S + ':' + serverLine + ' < ' + S + ':1796 in proxyVerb < ' +
    S + ':1794 in proxyVerb < ' + S + ':1069 < ' + S + ':1046 < ' + S + ':2260';
};
const PARTNER = H + ':2651 in handlePartnerCheck in createHub < ' + H + ':2618:handlePartnerCheck in createHub < ' + S + ':2087:handler < ' +
  S + ':1069 < ' + S + ':1046 < ' + S + ':2260';
const OFFBOARD = 'spirit/run/process/js/desk/offboard.js:78:main < spirit/run/process/js/desk/offboard.js:67:main < ' +
  'spirit/run/process/js/desk/offboard.js:62:main < spirit/run/process/js/desk/offboard.js:87 < spirit/run/process/js/desk/offboard.js:41:ask';
const A = 'spirit/run/spirit/appClient.js';

const DOORS = [
  {
    name: 'the relay door, peerPost.js::createPeerPost -> node:http+https+fetch on /api/relay/',
    door: { gate: 'spirit/run/spirit/peerPost.js::createPeerPost', endpoint: 'node:http+https+fetch', paths: ['/api/relay/'] },
    paths: [
      'GET /api/relay/key from ' + RR + SEALED,
      'POST /api/relay/claim from ' + RR + CLAIM,
      'GET /api/relay/key from ' + RR + BADGE('2864:relayGet', '2094'),
      'GET /api/relay/key from ' + OFFBOARD,
      'GET /api/relay/key from ' + RR + BADGE('2817:relaySearch', '2093'),
      'GET /api/relay/key from ' + RR + PARTNER,
    ],
    want: [
      'hub.js:300 sealedClaim (from handleClaim) ---> GET /api/relay/key, bypassing createPeerPost',
      'hub.js:1084 handleClaim ---> POST /api/relay/claim, bypassing createPeerPost',
      'hub.js:2784 relaySummary (from relayGet, via ownerBadge probe) ---> GET /api/relay/key, bypassing createPeerPost',
      'hub.js:2784 relaySummary (from relaySearch, via ownerBadge probe) ---> GET /api/relay/key, bypassing createPeerPost',
      'offboard.js:78 main ---> GET /api/relay/key by plain fetch, bypassing createPeerPost and relayRequest',
      'hub.js:2651 handlePartnerCheck ---> GET /api/relay/key, bypassing createPeerPost',
    ],
  },
  {
    name: 'the request-library door, peerPost.js::createPeerPost -> relayRequest.js',
    door: { gate: 'spirit/run/spirit/peerPost.js::createPeerPost', endpoint: 'spirit/run/spirit/relayRequest.js' },
    paths: [
      'assertRelayUrl from ' + H + ':1019:withClaimRelay in createHub < ' + H + ':1073 in handleClaim in createHub < ' + H + ':1072:handleClaim in createHub < ' +
        S + ':2079:handler < ' + S + ':1069 < ' + S + ':1046 < ' + S + ':2260',
      'relayRequest from ' + SEALED,
      'relayRequest from ' + CLAIM,
      'pipeRequest from ' + A + ':126:knock in createAppClient < ' + A + ':153 in ask in createAppClient < ' + A + ':151:ask in createAppClient < ' +
        'spirit/run/spirit/apiDoor.js:77:answer < ' + S + ':1890 in handler < ' + S + ':1880:handler < ' + S + ':1069 < ' + S + ':1046 < ' + S + ':2260',
      'pipeRequest from ' + A + ':126:knock in createAppClient < ' + A + ':164:ask in createAppClient',
      'relayRequest from ' + BADGE('2864:relayGet', '2094'),
      'assertRelayUrl from ' + H + ':1774 in handleContact in createHub < ' + H + ':1737:handleContact in createHub < ' + S + ':2179:handler < ' +
        S + ':1069 < ' + S + ':1046 < ' + S + ':2260',
      'pipeRequest from ' + A + ':126:knock in createAppClient < ' + A + ':164:ask in createAppClient < spirit/run/spirit/apiDoor.js:77:answer < ' +
        S + ':1890 in handler < ' + S + ':1880:handler < ' + S + ':1069 < ' + S + ':1046 < ' + S + ':2260',
      'pipeRequest from ' + A + ':126:knock in createAppClient < ' + A + ':153 in ask in createAppClient < ' + A + ':151:ask in createAppClient < ' +
        S + ':1834:tree < spirit/run/spirit/apiAuth.js:89:grant in createApiAuth < ' + S + ':1851 in authVerb < ' + S + ':1850 in authVerb < ' +
        S + ':1069 < ' + S + ':1046 < ' + S + ':2260',
      'relayRequest from ' + BADGE('2817:relaySearch', '2093'),
      'relayRequest from ' + PARTNER,
    ],
    want: [
      // Andy wrote "withClaimRelay (handleClaim)" and "sealedClaim (from handleClaim)" for the same shape (a function
      // of hub.js called from one in handleClaim): one rule gives both "from".
      'hub.js:1019 withClaimRelay (from handleClaim) ---> relayRequest.js assertRelayUrl, bypassing createPeerPost',
      'hub.js:300 sealedClaim (from handleClaim) ---> relayRequest.js relayRequest, bypassing createPeerPost',
      'hub.js:1084 handleClaim ---> relayRequest.js relayRequest, bypassing createPeerPost',
      // Andy wrote "appClient.js:126 knock" bare; knock is called by ask in its own file, as sealedClaim by handleClaim,
      // so the same rule says it.
      'appClient.js:126 knock (from ask) ---> relayRequest.js pipeRequest, bypassing createPeerPost',
      'hub.js:2784 relaySummary (from relayGet, via ownerBadge probe) ---> relayRequest.js relayRequest, bypassing createPeerPost',
      'hub.js:2784 relaySummary (from relaySearch, via ownerBadge probe) ---> relayRequest.js relayRequest, bypassing createPeerPost',
      'hub.js:1774 handleContact ---> relayRequest.js assertRelayUrl, bypassing createPeerPost',
      'hub.js:2651 handlePartnerCheck ---> relayRequest.js relayRequest, bypassing createPeerPost',
    ],
  },
];

// THE SOURCE THE PATHS WERE MEASURED AGAINST. The formatter reads a violator's own source line to say "by plain
// fetch"; these paths were measured on 2026-10-13, and goal/G22.6 has since moved every one of these callers onto
// peerPost — offboard.js:78 no longer fetches. So the formatter is handed a root holding the tree as it is, with
// offboard.js as it stood when measured (its line 78, the plain fetch), rather than reading lines that moved.
const MEASURED_ROOT = (function () {
  const os = require('os');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-violators-'));
  ['spirit/run/spirit/hub.js', 'spirit/run/spirit/server.js', 'spirit/run/spirit/ownerBadge.js',
    'spirit/run/spirit/relayRequest.js', 'spirit/run/spirit/appClient.js'].forEach(function (rel) {
    try {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.copyFileSync(path.join(REPO, rel), path.join(root, rel));
    } catch (e) { /* a file the tree no longer has reads as empty, as the formatter's own fallback does */ }
  });
  const offboard = new Array(77).fill('');
  offboard.push("  try { relayKey = await (await fetch(url.replace(/\\/+$/, '') + '/api/relay/key')).json(); } catch (e) { relayKey = null; }");
  const at = path.join(root, 'spirit/run/process/js/desk/offboard.js');
  fs.mkdirSync(path.dirname(at), { recursive: true });
  fs.writeFileSync(at, offboard.join('\n'));
  return root;
}());

DOORS.forEach(function (d) {
  test.subHeading(d.name);
  let got = [];
  if (typeof format === 'function') {
    try { got = format(d.door, d.paths, { root: MEASURED_ROOT }); } catch (e) { got = ['(threw: ' + ((e && e.message) || e) + ')']; }
  }
  got = Array.isArray(got) ? got.map(String) : [];
  d.want.forEach(function (line) {
    if (got.indexOf(line) !== -1) test.check('it says: ' + line);
    else test.fail('it says: ' + line, 'OWED by goal/G22.3: it said ' + JSON.stringify(got));
  });
  const extra = got.filter(function (l) { return d.want.indexOf(l) === -1; });
  const twice = got.filter(function (l, i) { return got.indexOf(l) !== i; });
  const title = 'and nothing else: one line per distinct violator, ' + d.want.length + ' from ' + d.paths.length + ' paths';
  if (got.length && !extra.length && !twice.length) test.check(title);
  else test.fail(title, 'OWED by goal/G22.3: lines beyond these, or one said twice: ' + JSON.stringify(extra.concat(twice)) + (got.length ? '' : ' (no lines at all)'));
});

test.subHeading('the run dialog shows them');
(function () {
  let server = '';
  let ui = '';
  try { server = fs.readFileSync(SERVER_HALF, 'utf8'); } catch (e) { server = ''; }
  try { ui = fs.readFileSync(UI, 'utf8'); } catch (e) { ui = ''; }
  const t1 = 'the server half formats a run\'s paths with violators.js and its runState verdict carries violators';
  if (/require\('\.\/violators\.js'\)/.test(server) && /violators: \[''\]/.test(server)) test.check(t1);
  else test.fail(t1, 'OWED by goal/G22.3: the server half does not require ./violators.js, or its runState verdict declares no violators');
  const t2 = 'the run dialog draws the violators, the raw paths folded under a details of their own';
  if (/v\.violators/.test(ui) && /<details/.test(ui)) test.check(t2);
  else test.fail(t2, 'OWED by goal/G22.3: the run dialog does not draw v.violators with the raw paths folded away');
})();

test.reportSuccessFailureCount();
