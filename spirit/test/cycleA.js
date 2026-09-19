'use strict';
const rollOf = require('./rollOf');

// Cycle A — create-invitation in Relay Chat.
//
// Three claims are under test, and none of them is chrome:
//
//   1. The owner badge is a signed GET /api/relay/status that came back
//      200 with a report. No second endpoint, no cheaper "am I owner?"
//      — the census already answers it (DICTIONARY.md, "Owner badge").
//   2. The badge is asked of EVERY Natter row, so a node can own two
//      mailboxes, one, or none, and the answer names which.
//   3. A mint goes to the mailbox that was chosen. relays.json[0] is a
//      habit, and on a node with two owned mailboxes it is a wrong one.
//
// The last section runs the real hub against two throwaway relays on
// loopback, because "the hub sends the invite to the right URL" is not a
// claim a stub can make on the hub's behalf.

const fs = require('fs');
const os = require('os');
const http = require('http');
const path = require('path');
const { URL } = require('url');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const { claimOwner } = require('./ownerClaim');
const invites = require('../run/js/invites');
// Where this node holds a seat — its own record, written at claim.
const relayKeys = require('../run/js/relayKeys');
const ownerBadge = require('../run/js/ownerBadge');
const { createRelay } = require('../run/js/relay');
const { createHub } = require('../run/js/hub');

function tmpHome(tag) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-cycleA-' + tag + '-'));
}

function writeRelays(home, rows) {
  var dir = path.join(home, 'app', 'natter');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'relays.json'), JSON.stringify(rows, null, 2));
}

// A mailbox owned by `id`: an empty box takes the first claim as owner, so
// after this the key in identity.json is the key in allow.json.
function ownedBox(id, name) {
  var home = tmpHome('box');
  // A KEY OF ITS OWN, which a relay needs to be addressable at all: the
  // mint is a post to this box now, and a box with no identity cannot
  // sign the answer. Before decision 0010's second collapse these fixtures
  // never needed one, because minting arrived through a route.
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  var box = createRelay(home);
  // The first claim takes the owner invite (cycle 3, Part B; ownerClaim.js).
  claimOwner(box, id, name, '10.0.0.1');
  return { home: home, box: box };
}

// WHAT server.js HANDS A LOOPBACK VERB: a readJsonBody, memoised on the
// request, answering a promise. Handlers take this rather than a parsed
// object so that one place decides what a malformed body is.
function askedWith(body) {
  return function () { return Promise.resolve(body); };
}

// `seats` names the urls this node has a row on. It used to be implied —
// the census listed the key, so probe found it — and a node keeps that
// record itself now, so a fixture has to write it (relayKeys.seat, which
// hub.handleClaim calls when a claim is granted).
//
// Left OUT for a relay this node merely lists: that is the case
// `owned:false, claimed:false` exists to describe, and it has to be
// constructible.
function nodeHome(id, urls, seats) {
  var home = tmpHome('node');
  auth.saveIdentity(home, id);
  writeRelays(home, urls.map(function (u, i) {
    return { label: 'mailbox' + (i + 1), url: u };
  }));
  (seats || []).forEach(function (u) { relayKeys.seat(home, u, id.name || 'me'); });
  return home;
}

// Answers a status request out of a relay object in this process. Same
// shape as the wire: the report itself on 200, { error } otherwise.
// THE PUBLIC CENSUS, which is the only thing probe() asks for now.
//
// It answered a SIGNED `GET /api/relay/status` until 2026-09-15 and
// handed back the owner-only report, because that was how the badge was
// decided. R3 deleted that route's only caller: `owner: true|false` is
// on every census row already, unsigned, and `probe` reads it by key.
//
// A stub that still served the old route would keep passing while the
// thing it stands in for had stopped being asked — which is the failure
// mode every stub in this tree is written against.
// ── IT SERVES THE KEY DOOR NOW, NOT THE CENSUS (2026-09-18) ─────────
//
// This answered `/api/relay/who` with `rollOf(box)` — the whole membership —
// because that is how probe used to learn both who runs a box and whether
// this node was on it.
//
// It learns the first from `GET /api/relay/key` (97 fixed bytes, no
// membership term) and the second from its OWN RECORD of where it holds a
// seat (relayKeys, written at claim). So this serves the key door, and
// keeps rejecting everything else — the loud-stub rule below is what made
// this change announce itself instead of passing quietly.
function censusAnswerer(boxes) {
  return function (url, method, pathname) {
    var box = boxes[url];
    if (!box) return Promise.reject(new Error('connection refused'));
    if (pathname.indexOf('/api/relay/key') !== 0) {
      // Nothing else should be asked. Saying so loudly beats a 404 that
      // reads as "that relay is not ours".
      return Promise.reject(new Error('probe asked for ' + pathname));
    }
    var own = box.ownerPublic();
    return Promise.resolve({
      status: 200,
      text: JSON.stringify({
        relayPublicKey: box.relayPublicKey(),
        relayLabel: box.relayLabel(),
        ownerKey: own.ownerKey,
        ownerLabel: own.ownerLabel,
      }),
    });
  };
}

test.startTest('Cycle A — owner badge, mailbox picker, mint goes where it was aimed');

{
  const home = tmpHome('natter');
  writeRelays(home, [
    { label: 'one', url: 'https://one.example/' },
    { label: 'dupe', url: 'https://one.example' },
    { url: 'https://two.example' },
    { label: 'no url at all' },
  ]);

  const rows = ownerBadge.loadRelays(home);
  if (rows.length === 2 && rows[0].url === 'https://one.example' && rows[1].url === 'https://two.example') {
    test.check('Natter rows: trailing slash trimmed, duplicate URL dropped, url-less row skipped');
  } else {
    test.fail('rows: ' + JSON.stringify(rows));
  }

  if (rows[1].label === 'https://two.example') {
    test.check('a row with no label is captioned by its URL');
  } else {
    test.fail('label fallback: ' + JSON.stringify(rows[1]));
  }

  const broken = tmpHome('broken');
  fs.mkdirSync(path.join(broken, 'app', 'natter'), { recursive: true });
  fs.writeFileSync(path.join(broken, 'app', 'natter', 'relays.json'), '{ not json');
  if (ownerBadge.loadRelays(broken).length === 0 && ownerBadge.loadRelays(tmpHome('none')).length === 0) {
    test.check('a broken or missing relays.json is no mailboxes, not a throw');
  } else {
    test.fail('broken natter did not read as empty');
  }
}

test.subHeading('What counts as a badge');

// THE BADGE IS A CENSUS READ NOW, not a signed 200 (R3, 2026-09-15,
// design/cycles/2026-09-15-labels-are-not-identities.md).
//
//   Andy: "i don't understand the ownerbadge concept at all: the relay
//   knows its owner by key, and already filters requests by that."
//
// These four checks used to drive `readBadge`, which parsed the body of
// a signed `GET /api/relay/status` and decided whether it was a real
// report or a 200 from something that answers 200 to everything. That
// route had no caller but this badge, and its signature was the only one
// on this wire that could not expire.
//
// The question survives the mechanism: IS MY KEY THE ONE MARKED OWNER?
// `ownedFrom` answers it off the public census, by key. So the impostor
// cases change shape — there is no status code to lie with any more, and
// what an impostor would have to forge is a peer row carrying somebody
// else's key.
{
  const me = auth.generateIdentity('me');
  const other = auth.generateIdentity('other');
  const census = function (peers) {
    return { status: 200, text: JSON.stringify({ peers: peers }) };
  };
  const row = function (key, owner) {
    return { name: 'x', publicLabel: 'x', publicKey: key, owner: !!owner };
  };

  const good = ownerBadge.ownedFrom(
    census([row(other.publicKey, false), row(me.publicKey, true)]), me.publicKey);
  if (good) {
    test.check('my key carrying owner:true in the census is the badge');
  } else {
    test.fail('an owned row did not read as owned');
  }

  // ON THE ROW, NOT ON THE BOX. Somebody else owning it is the ordinary
  // case for a member, and it must not read as ours.
  if (!ownerBadge.ownedFrom(
    census([row(other.publicKey, true), row(me.publicKey, false)]), me.publicKey)) {
    test.check('and another key owning it is not a badge, however green the box');
  } else {
    test.fail('somebody else\u2019s ownership read as ours');
  }

  // A row of ours with no owner flag is a MEMBER — claimed, not owned.
  // This is the distinction that decides whether an Invite button is
  // drawn, so it is the one worth being exact about.
  if (!ownerBadge.ownedFrom(census([row(me.publicKey, false)]), me.publicKey)) {
    test.check('holding a row is not owning one');
  } else {
    test.fail('a plain member row read as owned');
  }

  // NO KEY, NO ANSWER. A node that has not made an identity cannot own
  // anything, and must not be told it does by a census full of rows.
  if (!ownerBadge.ownedFrom(census([row(me.publicKey, true)]), '')) {
    test.check('and a node with no key of its own owns nothing');
  } else {
    test.fail('a keyless node read as owned');
  }

  // Unreachable, unparseable, or not a census at all. Each used to be a
  // status code; now they are all the same nothing.
  const junk = [null, { status: 200, text: 'OK' },
    { status: 200, text: JSON.stringify({ error: 'no' }) },
    { status: 0, text: '' }];
  if (junk.every(function (a) { return !ownerBadge.ownedFrom(a, me.publicKey); })) {
    test.check('and nothing that is not a census is a badge \u2014 ' + junk.length + ' ways');
  } else {
    test.fail('junk read as a badge');
  }

  // AND IT IS UNSIGNED. The point of R3: this question now costs no
  // credential at all, so a node may ask it of every relay in its list
  // including ones it has no relationship with.
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'run', 'js', 'ownerBadge.js'), 'utf8');
  // Called, not merely named. The tombstone explaining what statusPath
  // was has to stay readable, so a scanner that cannot tell a call from
  // an epitaph would make the history undeletable.
  const live = src.replace(/^\s*\/\/.*$/gm, '');
  const signs = live.indexOf('statusPath(') !== -1 || live.indexOf('auth.sign(') !== -1;
  if (!signs) {
    test.check('and ownerBadge signs nothing at all to ask it');
  } else {
    test.fail('ownerBadge still signs something');
  }
}

test.subHeading('One badge per Natter row');

const andy = auth.generateIdentity('andy');
const stranger = auth.generateIdentity('mallory');
const mine = ownedBox(andy, 'andy');
const theirs = ownedBox(stranger, 'mallory');
const urlMine = 'https://mine.example';
const urlTheirs = 'https://theirs.example';

function runBadgeProbe() {
  const home = nodeHome(andy, [urlMine, urlTheirs]);
  const boxes = {};
  boxes[urlMine] = mine.box;
  boxes[urlTheirs] = theirs.box;

  return ownerBadge.probe(home, censusAnswerer(boxes), andy.publicKey).then(function (summary) {
    if (summary.ownedUrls.length === 1 && summary.ownedUrls[0] === urlMine) {
      test.check('the badge lands only on the mailbox this key owns');
    } else {
      test.fail('ownedUrls: ' + JSON.stringify(summary.ownedUrls));
    }

    if (!summary.mustPick) {
      test.check('one owned mailbox asks the human nothing');
    } else {
      test.fail('mustPick with one owned row');
    }

    // SOMEBODY ELSE'S RELAY ANSWERS PERFECTLY WELL. It used to come back
    // 403 — the owner-only route refusing us — and the row was unbadged
    // because the request failed. Since R3 the request is the public
    // census, which answers 200 to anyone, so the row is unbadged
    // because OUR KEY IS NOT THE ONE MARKED OWNER.
    //
    // The better assertion, and the one that survives the relay being
    // reachable: not owned, not claimed, and the census read fine.
    const foreign = summary.rows.filter(function (r) { return r.url === urlTheirs; })[0];
    if (foreign && !foreign.owned && !foreign.claimed && foreign.status === 200) {
      test.check("someone else's relay answers us, and is still unbadged");
    } else {
      test.fail('foreign row: ' + JSON.stringify(foreign));
    }

    // Two owned mailboxes is the case the picker exists for.
    const second = ownedBox(andy, 'andy');
    const urlSecond = 'https://second.example';
    const twoBoxes = {};
    twoBoxes[urlMine] = mine.box;
    twoBoxes[urlSecond] = second.box;
    return ownerBadge.probe(nodeHome(andy, [urlMine, urlSecond]), censusAnswerer(twoBoxes), andy.publicKey);
  }).then(function (summary) {
    if (summary.ownedUrls.length === 2 && summary.mustPick) {
      test.check('two owned mailboxes must be picked between, never defaulted');
    } else {
      test.fail('two owned: ' + JSON.stringify(summary));
    }

    // A mailbox that is down is unbadged, and takes nothing else down.
    const urlUp = 'https://up.example';
    const urlDown = 'https://down.example';
    const upBoxes = {};
    upBoxes[urlUp] = mine.box;
    return ownerBadge.probe(nodeHome(andy, [urlDown, urlUp]), censusAnswerer(upBoxes), andy.publicKey);
  }).then(function (summary) {
    const down = summary.rows[0];
    if (summary.ownedUrls.length === 1 && down && !down.owned && down.status === 0) {
      test.check('an unreachable mailbox loses its badge without hiding the others');
    } else {
      test.fail('mixed: ' + JSON.stringify(summary));
    }
  });
}

function runChooseUrl() {
  test.subHeading('Which mailbox a mint is aimed at');

  const a = 'https://a.example';
  const b = 'https://b.example';

  const picked = ownerBadge.chooseUrl([a, b], b);
  if (picked.ok && picked.url === b) {
    test.check('the URL the human picked is the one used');
  } else {
    test.fail('picked: ' + JSON.stringify(picked));
  }

  if (ownerBadge.chooseUrl([a, b], 'https://b.example/').url === b) {
    test.check('a trailing slash still matches the row it names');
  } else {
    test.fail('slash form did not match');
  }

  // The page asks; the node decides. A URL this node does not list is not
  // somewhere an owner-signed mint may be sent, however it got into the
  // request.
  const foreign = ownerBadge.chooseUrl([a, b], 'https://evil.example');
  if (!foreign.ok && foreign.status === 403) {
    test.check('a URL that is not in Natter cannot be minted on');
  } else {
    test.fail('foreign url: ' + JSON.stringify(foreign));
  }

  const only = ownerBadge.chooseUrl([a], '');
  if (only.ok && only.url === a) {
    test.check('with one mailbox configured there is nothing to ask');
  } else {
    test.fail('single: ' + JSON.stringify(only));
  }

  const ambiguous = ownerBadge.chooseUrl([a, b], '');
  if (!ambiguous.ok && ambiguous.status === 400) {
    test.check('with two configured and none chosen, the mint is refused rather than aimed at the first');
  } else {
    test.fail('ambiguous: ' + JSON.stringify(ambiguous));
  }

  const none = ownerBadge.chooseUrl([], '');
  if (!none.ok && none.status === 503) {
    test.check('no mailbox configured is 503, as it was before');
  } else {
    test.fail('none: ' + JSON.stringify(none));
  }
}

// ---------------------------------------------------------------------
// The real hub, over loopback, against two mailboxes it owns.
// ---------------------------------------------------------------------

function relayServer(box) {
  return new Promise(function (resolve) {
    const server = http.createServer(function (req, res) {
      const url = new URL(req.url, 'http://127.0.0.1');
      function reply(result, payload) {
        res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result.ok ? payload : { error: result.error }));
      }
      // A `/api/relay/status` branch stood here, serving the owner-only
      // report to a signed GET. R3 deleted that route on 2026-09-15 along
      // with the badge that was its only caller, so a fake still offering
      // it would be a fake more capable than the thing it stands in for.
      //
      // WHO THIS BOX IS, which probe() reads to answer "do I own this".
      // "Do I have a row here" is no longer asked of the relay at all —
      // the node keeps its own record of where it holds a seat
      // (relayKeys, written at claim), so a fixture says so by writing
      // the seat rather than by being listed in an answer.
      //
      // THE CENSUS BRANCH STOOD HERE and served `rollOf(box)`. It was added
      // because the fake did not serve it at first, so claimedFrom() saw
      // a 404 in every test and answered false — a suite cannot notice a
      // flag that is false because the question was never asked. The same
      // hazard now lives at the seat: a fixture that forgets to write one
      // gets `claimed: false` for a reason that has nothing to do with
      // what it is testing.
      //
      // Same shape as the wire (server.js): the key door, four fields.
      if (req.method === 'GET' && url.pathname === '/api/relay/key') {
        var own = box.ownerPublic();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          relayPublicKey: box.relayPublicKey(),
          relayLabel: box.relayLabel(),
          ownerKey: own.ownerKey,
          ownerLabel: own.ownerLabel,
        }));
        return;
      }
      // /api/relay/invite STOOD HERE and is gone from the wire entirely
      // (decision 0010). A mint is a post now, and a post does not come
      // back in the HTTP response — the relay answers on the owner's
      // stream. So the seam this suite fakes moved from the transport to
      // the router: see routerTo() below.
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end('{"error":"no such route"}');
    });
    server.listen(0, '127.0.0.1', function () {
      resolve({ server: server, url: 'http://127.0.0.1:' + server.address().port });
    });
  });
}

function fakeRes() {
  const out = { status: 0, text: '', finished: false };
  out.writeHead = function (status) { out.status = status; };
  out.end = function (text) {
    out.text = String(text == null ? '' : text);
    out.finished = true;
    if (out.done) out.done(out);
  };
  out.wait = function () {
    return new Promise(function (resolve) {
      if (out.finished) { resolve(out); return; }
      out.done = resolve;
    });
  };
  return out;
}

// THE ROUTER, faked at the seam hub.handleInvite actually uses now.
//
// It does the two things peerPost does that this suite depends on: it
// posts to the box the url names, and it hands back the reply that box
// signed. The reply arrives on the owner's stream rather than in the
// post's response — which is the one real consequence of the collapse,
// and the reason this fake has to hold a sink at all.
//
// Kept deliberately thin: what is under test is that the hub picks the
// right mailbox, so this proves nothing about the transport and does not
// pretend to. routerPost.js and relayMonitor.js do that.
function routerTo(boxes, owner) {
  return {
    post: function (url, key, text) {
      const box = boxes[url];
      if (!box) return Promise.resolve({ ok: false, status: 502, error: 'no such relay' });

      let answered = '';
      box.streamOpen(owner.publicKey,
        auth.sign(owner.privateKey, auth.streamMessage(owner.publicKey)), {
          write: function (chunk) {
            const ev = /^event: (.+)$/m.exec(String(chunk));
            const da = /^data: (.+)$/m.exec(String(chunk));
            if (!ev || ev[1] !== 'reply' || !da) return;
            try { answered = JSON.parse(da[1]).text || ''; } catch (e) { answered = ''; }
          },
          close: function () {},
        });

      const sent = box.routePost(owner.publicKey, key, text,
        auth.sign(owner.privateKey, auth.postMessage(owner.publicKey, key, text)));
      if (!sent.ok) return Promise.resolve(sent);
      return Promise.resolve({ ok: true, status: 200, hash: sent.hash, text: answered });
    },
  };
}

// Presence, at the seam handlePost uses to pick a road. On a real node
// this is built from the rosters relays push; here it answers from the
// boxes themselves, which is the same question asked of a fixture.
//
// It is what makes "which relay" a NODE decision rather than a caller's:
// a post names a KEY, and the node finds the relays that say they carry
// that key. That is why the relay had to start naming itself in every
// member's roster (relay.streamRoster).
function presenceFor(boxes) {
  return {
    relaysNaming: function (key) {
      return Object.keys(boxes).filter(function (url) {
        return boxes[url].relayPublicKey() === key;
      });
    },
  };
}

// One peerPost, driven the way the loopback client layer drives it.
function hubPost(hub, to, body, deps) {
  const res = fakeRes();
  hub.handlePost({}, res, function () {
    // THE CALLER COMPOSES THE PAYLOAD, as the client layer now does:
    // a relay-directed call is a system payload with no app in it.
    return Promise.resolve({ to: to, text: JSON.stringify({ v: 1, body: body }) });
  }, deps);
  return res.wait().then(function (r) {
    let settle = {};
    try { settle = JSON.parse(r.text); } catch (e) { settle = {}; }
    let answer = null;
    try { answer = JSON.parse(settle.text || 'null'); } catch (e) { answer = null; }
    return {
      status: r.status,
      text: r.text,
      hash: settle.hash || '',
      // What the far end SAID, out of the envelope it said it in.
      body: (answer && answer.body) || null,
    };
  });
}

function runHubOnLoopback() {
  test.subHeading('A verb addressed to a relay key lands on that relay');

  // ── THE DOORS ARE GONE, AND SO IS "WHICH URL" ────────────────────
  //
  //   Andy: "I am aiming to close all post-path doors on node"
  //
  // This section drove hub.handleInvite and hub.handleRemovePeer, and
  // asserted that each picked the right mailbox out of relays.json by
  // url. Both functions are deleted: what they did was build one packet
  // body and hand it to router.post, which is what a peerPost IS.
  //
  // TWO OF THE OLD CLAIMS DISSOLVED RATHER THAN MOVED, and that is worth
  // saying plainly rather than quietly dropping them:
  //
  //   "two mailboxes and no choice is refused, not guessed" — there is
  //     no choice to fail to make. A post names a KEY, and two relays
  //     owned by one person have two different keys. Ambiguity was a
  //     property of aiming by url.
  //
  //   "a mint aimed off the Natter list never leaves the node" — aiming
  //     at a key nothing carries is now the same refusal as aiming at a
  //     peer who is not there: unreachable. Below.
  //
  // And one MOVED: "a delivered refusal is not a delivery" is the client
  // layer's now, because that is where the two failures meet — see
  // spirit/test/clientLayer.js. It was hub.askRelay's, and askRelay went
  // with the doors it served.

  const owner = auth.generateIdentity('andy');
  const first = ownedBox(owner, 'andy');
  const second = ownedBox(owner, 'andy');
  let servers;
  let hub;
  let deps;

  return Promise.all([relayServer(first.box), relayServer(second.box)]).then(function (s) {
    servers = s;
    hub = createHub(nodeHome(owner, [servers[0].url, servers[1].url]));

    const boxes = {};
    boxes[servers[0].url] = first.box;
    boxes[servers[1].url] = second.box;
    deps = { router: routerTo(boxes, owner), presence: presenceFor(boxes) };

    return hubPost(hub, second.box.relayPublicKey(),
      { invite: { label: 'saint', days: 7, token: '' } }, deps);
  }).then(function (res) {
    const token = (res.body && res.body.invite && res.body.invite.token) || '';
    if (res.status === 200 && token) {
      test.check('an invite posted to the second relay by key is minted');
    } else {
      test.fail('mint on second: ' + res.status + ' ' + res.text);
    }

    // THE WHOLE POINT, unchanged in substance: the row exists on the box
    // that was addressed, and not on the one that merely happens to be
    // first in relays.json.
    const onSecond = invites.load(second.home).some(function (row) { return row.token === token; });
    const onFirst = invites.load(first.home).some(function (row) { return row.token === token; });
    if (token && onSecond && !onFirst) {
      test.check('and the row is on the relay that was named, not on relays.json[0]');
    } else {
      test.fail('token landed wrong: onFirst=' + onFirst + ' onSecond=' + onSecond);
    }

    // A KEY NOTHING CARRIES. This replaces both of the old refusals —
    // the unaimed one and the off-the-list one — because addressing a
    // key makes them the same question, and it is the ordinary one every
    // post already asks: is this peer reachable?
    return hubPost(hub, 'MCowBQYDK2VwAyEAnobody-carries-this-key=',
      { invite: { label: 'saint', days: 7, token: '' } }, deps);
  }).then(function (res) {
    if (res.status === 503 && /not reachable/.test(res.text)) {
      test.check('a verb aimed at a key no relay carries is unreachable, not guessed at');
    } else {
      test.fail('unaimed: ' + res.status + ' ' + res.text);
    }

    // ── THE VERB THAT HAD NO DOOR, AND NOW NEEDS NONE ───────────────
    //
    //   Andy: "api/hub/remove-peer must be the interface"
    //
    // relay.removePeer worked, was signed and was thorough, and nothing
    // under run/ could reach it — a verb with no interface, which is as
    // much an impurity as a wrong one and harder to see.
    //
    // It got a door, and the door is now gone too. That is not the gap
    // reopening: it is the gap becoming impossible. A verb the relay
    // answers is reachable because the browser can address the relay,
    // and there is no longer a place for a door to be missing from.
    const victim = auth.generateIdentity('victim');
    const minted = second.box.mint('andy', 'victim', 7);
    second.box.claim('victim', auth.sign(victim.privateKey, auth.claimMessage('victim')),
      victim.publicKey, '10.0.0.9', minted.invite.token, 'victim');

    const before = rollOf(second.box).some(function (r) { return r.publicKey === victim.publicKey; });
    return hubPost(hub, second.box.relayPublicKey(),
      { removePeer: { key: victim.publicKey } }, deps)
      .then(function (r) {
        const gone = !rollOf(second.box).some(function (x) { return x.publicKey === victim.publicKey; });
        const said = r.body || {};
        if (before && gone && said.removed && said.removed.key === victim.publicKey) {
          test.check('removing a peer travels as a packet and forgets them on the relay it named');
        } else {
          test.fail('remove: ' + r.status + ' ' + r.text + ' gone=' + gone);
        }
      });
  }).then(function () {
    // And the badge itself, over the same loopback: both mailboxes owned,
    // so Relay Chat shows the panel and the picker. A READ, and reads did
    // not move — you cannot post to an address you are still asking for.
    // THE THIRD ARGUMENT IS readJsonBody, not a URL. It was a URL until
    // `relay.status` folded onto /api/spirit on 2026-09-15, and the name
    // now arrives in the body like every other loopback verb's argument.
    // Handed the same shape server.js hands it, so a change to how the
    // body is read fails here rather than being swallowed.
    const res2 = fakeRes();
    hub.handleStatus({}, res2, askedWith({ name: 'andy' }));
    return res2.wait();
  }).then(function (res) {
    let data = {};
    try { data = JSON.parse(res.text); } catch (e) { data = {}; }
    if (res.status === 200 && data.ownedUrls && data.ownedUrls.length === 2 && data.mustPick) {
      test.check('relay.status badges both mailboxes and asks for a pick');
    } else {
      test.fail('hub status: ' + res.status + ' ' + res.text);
    }
    // And the label came back off the BODY. It is echoed rather than
    // used, which is exactly why it would go unnoticed if the read
    // broke — the rows would still be right and Natter would draw a
    // blank title.
    if (data.name === 'andy') {
      test.check('and it echoes the label it was asked with, read out of the body');
    } else {
      test.fail('echoed name: ' + JSON.stringify(data.name));
    }
    servers.forEach(function (s) { s.server.close(); });
  });
}



// B2, and the half of it that never reached the browser.
//
// Andy: "now that we've got the one-device-for-all going, it would be
// nice if the natter app would show a dropdown panel for every relay it
// either owns or is bound to. this has not happened yet."
//
// It had not, and the reason was one argument. Natter decides whether a
// row opens with `owned || claimed`, and `claimed` is computed by
// ownerBadge.probe ONLY when it is handed a key to look for:
//
//     if (badge.owned || !myKey) return badge;
//
// handleStatus called it with three arguments, so every row came back
// with `claimed` undefined and `owned || claimed` quietly became
// `owned`. A peer saw no panel on any mailbox, and an owner saw panels
// everywhere — which is exactly the shape of "it works for me".
//
// The device timer in the same file already carried the fix AND the
// lesson — "the whole feature stopped at the owner for want of one
// word" — so this is the same omission, made twice, caught once.
function boundNodeSeesItsRow() {
  test.subHeading('A node that owns no mailbox still knows which ones it is on');

  const owner = auth.generateIdentity('andy');
  const guest = auth.generateIdentity('bert');
  const lab = ownedBox(owner, 'andy');

  // bert joins the way anyone joins a keys-mode box: the owner mints,
  // bert redeems. He owns nothing afterwards and has a row.
  const minted = lab.box.mint('andy', 'bert', 7);
  const joined = lab.box.claim('bert',
    auth.sign(guest.privateKey, auth.claimMessage('bert')),
    guest.publicKey, '10.0.0.7', minted.ok && minted.invite.token, 'bert');
  if (!joined.ok) {
    test.fail('bert could not join: ' + JSON.stringify(joined));
    return Promise.resolve();
  }

  let server;
  return relayServer(lab.box).then(function (s) {
    server = s;
    // Bert joined by `lab.box.claim(...)` above — the RELAY's half of a
    // bind. The node's half is its own record of the seat, which a real
    // claim writes through hub.handleClaim and this fixture writes by
    // hand for the same reason labWorld does (2026-09-18).
    const hub = createHub(nodeHome(guest, [server.url], [server.url]));
    const res = fakeRes();
    hub.handleStatus({}, res, askedWith({ name: 'bert' }));
    return res.wait();
  }).then(function (res) {
    let body = null;
    try { body = JSON.parse(res.text); } catch (e) { body = null; }
    const row = (body && body.rows && body.rows[0]) || {};

    // NOT the owner. If this ever goes true the test below stops meaning
    // anything, because owning implies a row and the flag would be set
    // for the wrong reason.
    if (row.owned === false) {
      test.check('bert owns nothing, so no star and no mint');
    } else {
      test.fail('bert came back owning something: ' + res.text);
    }

    // The flag Natter opens a panel on.
    if (row.claimed === true) {
      test.check('and the row says he is ON it — which is what opens the panel');
    } else {
      test.fail('claimed was ' + JSON.stringify(row.claimed) + ': ' + res.text);
    }

    // WHAT THE PANEL ACTUALLY SHOWS once it opens. Without this the row
    // opens onto the 403 from the owner-only status call — the words
    // "not the owner" — which is the app telling somebody off for the
    // ordinary case of being a member.
    //
    // ── "AND HOW MANY ARE ON IT" IS GONE (2026-09-18) ──────────────
    //
    // This asserted `facts.peers === 2` as well. The count came from the
    // census, and a count of the membership is a membership fact: the
    // relay does not serve one, to anybody, and no screen in run/ ever
    // read it. It was in the badge because censusFacts had the list in
    // hand and reducing it was free.
    //
    // What the panel can still say is who runs the box and what it calls
    // YOU — both off GET /api/relay/key and this node's own seat record,
    // neither with a membership term in it.
    const facts = row.census || {};
    if (facts.owner === 'andy' && facts.myLabel === 'bert') {
      test.check('and the panel can say who runs it and what it calls you');
    } else {
      test.fail('census: ' + JSON.stringify(facts));
    }

    // The fact an owner never needs. One browser now serves every relay
    // this node holds, and nothing says two mailboxes gave it the same
    // name — so "who am I here" has a per-relay answer, and this is it.
    if (facts.myLabel === 'bert') {
      test.check('and what YOU are called on that particular mailbox');
    } else {
      test.fail('myLabel: ' + JSON.stringify(facts.myLabel));
    }

    // Sent, not merely computed. summarize() has always produced this
    // and handleStatus has always dropped it, so the browser had to
    // infer the set and could not.
    if (Array.isArray(body.claimedUrls) && body.claimedUrls.indexOf(server.url) !== -1 &&
        (body.ownedUrls || []).length === 0) {
      test.check('and claimedUrls reaches the browser, with ownedUrls empty beside it');
    } else {
      test.fail('urls: ' + JSON.stringify({ claimed: body.claimedUrls, owned: body.ownedUrls }));
    }

    server.server.close();
  }).catch(function (err) {
    if (server) server.server.close();
    throw err;
  });
}

// A stranger — no row, no ownership — must come back with neither. The
// check above passes just as well if `claimed` were hardcoded true, and
// this is the half that says it is not.
function aStrangerIsOnNothing() {
  const owner = auth.generateIdentity('andy');
  const nobody = auth.generateIdentity('mallory');
  const lab = ownedBox(owner, 'andy');

  let server;
  return relayServer(lab.box).then(function (s) {
    server = s;
    const hub = createHub(nodeHome(nobody, [server.url]));
    const res = fakeRes();
    hub.handleStatus({}, res, askedWith({ name: 'mallory' }));
    return res.wait();
  }).then(function (res) {
    let body = null;
    try { body = JSON.parse(res.text); } catch (e) { body = null; }
    const row = (body && body.rows && body.rows[0]) || {};
    if (!row.owned && !row.claimed && (body.claimedUrls || []).length === 0) {
      test.check('and somebody with no row on it is neither owner nor member');
    } else {
      test.fail('a stranger was let in: ' + res.text);
    }
    server.server.close();
  }).catch(function (err) {
    if (server) server.server.close();
    throw err;
  });
}

runBadgeProbe()
  .then(runChooseUrl)
  .then(runHubOnLoopback)
  .then(boundNodeSeesItsRow)
  .then(aStrangerIsOnNothing)
  .then(function () {
    test.reportSuccessFailureCount();
  })
  .catch(function (err) {
    test.fail('cycle A threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });
