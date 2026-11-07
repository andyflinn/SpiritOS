'use strict';
const rollOf = require('./rollOf');

// Cycle A — the owner badge, the mailbox picker, and a verb aimed at a relay.
//
// Three claims are under test, and none of them is chrome:
//
//   1. The owner badge: ownerBadge.probe asks each listed relay for its
//      card (request(url); since goal/G22.6 a card ask through the node's
//      peerPost), and a relay is owned when the owner key its card names
//      is this node's. It signs nothing (DICTIONARY.md, "Owner badge").
//   2. The badge is asked of EVERY listed relay, so a node can own two
//      mailboxes, one, or none, and the answer names which.
//   3. A verb goes to the relay it names, by key, never to the first
//      listed relay out of habit.
//
// The loopback section runs the real hub against two throwaway relays,
// because "the hub sends the invite to the right relay" is not a claim a
// stub can make on the hub's behalf.

const fs = require('fs');
const os = require('os');
const http = require('http');
const path = require('path');
const { URL } = require('url');
const test = require('./testSupport.js');
const { sealFor, openReply } = require('./openReply');
const auth = require('../run/spirit/relayAuth');
const { claimOwner, ownHome } = require('./ownerClaim');
const invites = require('../run/spirit/invites');
// Where this node holds a seat — its own record, written at claim.
const relayKeys = require('../run/spirit/relayKeys');
const ownerBadge = require('../run/spirit/ownerBadge');
const { createRelay } = require('../run/spirit/relay');
const { createHub } = require('../run/spirit/hub');

function tmpHome(tag) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-cycleA-' + tag + '-'));
}

// Since goal/G19.15 the node's relay list is node.db's relays table, keyed by
// relay key: each url is listed under a fake key of its own, with no seat.
function writeRelays(home, rows) {
  rows.forEach(function (r) {
    var u = relayKeys.normalizeUrl(r && r.url);
    if (u) relayKeys.list(home, u, r.label, 'RELAYKEY-' + u);
  });
}

// A mailbox owned by `id`: owner.json names it before the box is built, as
// the install does (goal/G16.8), and the owner then claims with no invite.
function ownedBox(id, name) {
  var home = tmpHome('box');
  // A KEY OF ITS OWN, which a relay needs to be addressable at all: the
  // mint is a post to this box, and a box with no identity cannot sign
  // the answer.
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  ownHome(home, id);
  var box = createRelay(home);
  claimOwner(box, id, name, '10.0.0.1');
  return { home: home, box: box };
}

// WHAT server.js HANDS A LOOPBACK VERB: a readJsonBody, memoised on the
// request, answering a promise. Handlers take this rather than a parsed
// object so that one place decides what a malformed body is.
function askedWith(body) {
  return function () { return Promise.resolve(body); };
}

// `seats` names the urls this node has a row on. A node keeps that record
// itself, so a fixture has to write it (relayKeys.seat, which the hub
// calls when a claim is granted).
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

// THE RELAY'S CARD, as `request(url)` answers it to ownerBadge.probe:
// since goal/G22.6 a card ask on the relay's one door through the node's
// peerPost (hub.relayKeyAsk); GET /api/relay/key is closed. Answered out
// of a relay object in this process as { status, text }, and refused for a
// url with no box. Whether this node holds a seat is not asked of the
// relay: the node keeps its own record of that (relayKeys, written at
// claim).
function rollAnswerer(boxes) {
  return function (url) {
    var box = boxes[url];
    if (!box) return Promise.reject(new Error('connection refused'));
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
  // The node's relay list is node.db's relays table (relayKeys.listed, goal/G19.15); a relays.json found in
  // spirit/state/ is the old store, moved in when it can be read (relayKeys.importOld).
  fs.mkdirSync(path.join(broken, 'spirit', 'state'), { recursive: true });
  fs.writeFileSync(path.join(broken, 'spirit', 'state', 'relays.json'), '{ not json');
  if (ownerBadge.loadRelays(broken).length === 0 && ownerBadge.loadRelays(tmpHome('none')).length === 0) {
    test.check('a broken or missing relays.json is no mailboxes, not a throw');
  } else {
    test.fail('broken natter did not read as empty');
  }
}

test.subHeading('What counts as a badge');

// THE BADGE SIGNS NOTHING (R3, design/cycles/2026-09-15-labels-are-not-identities.md).
//
//   Andy: "i don't understand the ownerbadge concept at all: the relay
//   knows its owner by key, and already filters requests by that."
//
// The question is IS MY KEY THE OWNER'S? The relay's card names its
// owner's key, and `probe` compares: runBadgeProbe below is where the
// badge is asserted. These checks hold that no roll parser and no
// signature is left in ownerBadge.js.
{
  if (typeof ownerBadge.ownedFrom === 'undefined' && typeof ownerBadge.censusFacts === 'undefined' &&
      typeof ownerBadge.claimedLabelFrom === 'undefined') {
    test.check('no roll parser is left in the badge');
  } else {
    test.fail('a roll parser is still exported');
  }

  // AND IT IS UNSIGNED. The point of R3: this question costs no
  // credential at all, so a node may ask it of every relay in its list
  // including ones it has no relationship with.
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'run', 'spirit', 'ownerBadge.js'), 'utf8');
  // Called, not merely named: comment lines are dropped first, so a
  // comment naming statusPath does not count as a call.
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

  return ownerBadge.probe(home, rollAnswerer(boxes), andy.publicKey).then(function (summary) {
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

    // SOMEBODY ELSE'S RELAY ANSWERS PERFECTLY WELL: its card answers 200
    // to anyone, so the row is unbadged because OUR KEY IS NOT THE ONE
    // IT NAMES AS OWNER. Not owned, not claimed, and the card read fine.
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
    return ownerBadge.probe(nodeHome(andy, [urlMine, urlSecond]), rollAnswerer(twoBoxes), andy.publicKey);
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
    return ownerBadge.probe(nodeHome(andy, [urlDown, urlUp]), rollAnswerer(upBoxes), andy.publicKey);
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
      // A relay serves no route here: the node learns the relay's card
      // through its router (cardRouter below, goal/G22.6), and a mint is a
      // post whose answer comes on the owner's stream (routerTo below).
      // Whether this node holds a seat is its own record (relayKeys), so a
      // fixture writes the seat; one that forgets gets `claimed: false`
      // for a reason that has nothing to do with what it is testing.
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

// THE RELAY'S CARD, as the node's router answers it (peerPost.relayKey,
// goal/G22.6): the hub's probe asks this, never a route. Answered out of
// the boxes behind each fake url.
function cardRouter(boxes) {
  return {
    relayKey: function (url) {
      const box = boxes[url];
      if (!box) return Promise.reject(new Error('connection refused'));
      const own = box.ownerPublic();
      return Promise.resolve({
        relayPublicKey: box.relayPublicKey(), relayLabel: box.relayLabel(),
        ownerKey: own.ownerKey, ownerLabel: own.ownerLabel,
      });
    },
  };
}

// THE ROUTER, faked at the seam hub.handlePost uses.
//
// It does the two things peerPost does that this suite depends on: it
// posts to the box the url names, and it hands back the reply that box
// signed. The reply arrives on the owner's stream rather than in the
// post's response, which is why this fake has to hold a sink at all.
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
      box.streamOpen(owner.publicKey, auth.sign(owner.privateKey, auth.streamMessage(owner.publicKey, box.relayPublicKey())), {
          write: function (chunk) {
            const ev = /^event: (.+)$/m.exec(String(chunk));
            const da = /^data: (.+)$/m.exec(String(chunk));
            if (!ev || ev[1] !== 'reply' || !da) return;
            // Opened: a relay seals its answers (cycle 10, R5), so
            // what the hub hands back is the plaintext a node would.
            try {
              const got = openReply(owner, box.relayPublicKey(), JSON.parse(da[1]).text);
              answered = got ? JSON.stringify(got) : '';
            } catch (e) { answered = ''; }
          },
          close: function () {},
        });

      // Sealed when addressed to the relay itself (cycle 10, R9).
      const sending = key === box.relayPublicKey() ? sealFor(owner, box, text) : text;
      const sent = box.routePost(owner.publicKey, key, sending,
        auth.sign(owner.privateKey, auth.postMessage(owner.publicKey, key, sending)));
      if (!sent.ok) return Promise.resolve(sent);
      return Promise.resolve({ ok: true, status: 200, hash: sent.hash, text: answered });
    },
  };
}

// Presence, at the seam handlePost uses to pick a road. On a real node
// this is presenceNode.relaysNaming: the relays whose presence broadcasts
// name the key as present. Here it answers from the boxes themselves.
//
// It is what makes "which relay" a NODE decision rather than a caller's:
// a post names a KEY, and the node finds the relays that carry that key.
function presenceFor(boxes) {
  return {
    relaysNaming: function (key) {
      return Object.keys(boxes).filter(function (url) {
        return boxes[url].relayPublicKey() === key;
      });
    },
    // No stream held: a key nobody names is unreachable (goal/G19.14 asks the router this).
    relaysHeld: function () { return []; },
  };
}

// One peerPost, driven the way the loopback client layer drives it.
function hubPost(hub, to, body, deps) {
  const res = fakeRes();
  hub.handlePost({}, res, function () {
    // THE CALLER COMPOSES THE PAYLOAD, as the client layer does:
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

  // ── A VERB NAMES A RELAY KEY, NOT A URL ─────────────────────────
  //
  //   Andy: "I am aiming to close all post-path doors on node"
  //
  // The hub has no invite or remove-peer door: a verb for a relay is one
  // packet body posted through hub.handlePost to the relay's key. A post
  // names a KEY, and two relays owned by one person have two different
  // keys, so there is no "which url" to guess; a key no relay carries is
  // unreachable, as for any peer. "A delivered refusal is not a delivery"
  // is the client layer's (spirit/test/clientLayer.js).

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
    // Since goal/G19.14 the router answers what presence knows: peerPost holds the streams.
    deps = { router: Object.assign(routerTo(boxes, owner), presenceFor(boxes), cardRouter(boxes)) };

    return hubPost(hub, second.box.relayPublicKey(),
      { invite: { label: 'saint', days: 7, token: '' } }, deps);
  }).then(function (res) {
    const token = (res.body && res.body.invite && res.body.invite.token) || '';
    if (res.status === 200 && token) {
      test.check('an invite posted to the second relay by key is minted');
    } else {
      test.fail('mint on second: ' + res.status + ' ' + res.text);
    }

    // THE WHOLE POINT: the row exists on the box that was addressed, and
    // not on the one that merely happens to be listed first.
    const onSecond = invites.load(second.home).some(function (row) { return row.token === token; });
    const onFirst = invites.load(first.home).some(function (row) { return row.token === token; });
    if (token && onSecond && !onFirst) {
      test.check('and the row is on the relay that was named, not on relays.json[0]');
    } else {
      test.fail('token landed wrong: onFirst=' + onFirst + ' onSecond=' + onSecond);
    }

    // A KEY NOTHING CARRIES: the ordinary question every post asks, is
    // this peer reachable?
    return hubPost(hub, 'MCowBQYDK2VwAyEAnobody-carries-this-key=',
      { invite: { label: 'saint', days: 7, token: '' } }, deps);
  }).then(function (res) {
    if (res.status === 503 && /not reachable/.test(res.text)) {
      test.check('a verb aimed at a key no relay carries is unreachable, not guessed at');
    } else {
      test.fail('unaimed: ' + res.status + ' ' + res.text);
    }

    // ── REMOVING A PEER IS A PACKET TO THE RELAY ────────────────────
    //
    //   Andy: "api/hub/remove-peer must be the interface"
    //
    // There is no remove-peer door on the node: relay.removePeer is
    // reached by a packet addressed to the relay's key, like any verb the
    // relay answers.
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
    // so the answer asks for a pick. THE THIRD ARGUMENT IS readJsonBody:
    // the name arrives in the body like every other loopback verb's
    // argument, handed the same shape server.js hands it, so a change to
    // how the body is read fails here rather than being swallowed.
    const res2 = fakeRes();
    hub.handleStatus({}, res2, askedWith({ name: 'andy' }), deps);
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
    // broke — the rows would still be right and the title blank.
    if (data.name === 'andy') {
      test.check('and it echoes the label it was asked with, read out of the body');
    } else {
      test.fail('echoed name: ' + JSON.stringify(data.name));
    }
    servers.forEach(function (s) { s.server.close(); });
  });
}



// B2: a node that is a member, not the owner, still sees its row: a
// panel shows for every relay it either owns or is bound to.
//
// A row opens with `owned || claimed`, so handleStatus must compute
// `claimed` for this node's key: claimed is owned, or seated (relayKeys).
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
    // claim writes through the hub and this fixture writes by hand.
    const hub = createHub(nodeHome(guest, [server.url], [server.url]));
    const res = fakeRes();
    const cards = {};
    cards[server.url] = lab.box;
    hub.handleStatus({}, res, askedWith({ name: 'bert' }), { router: cardRouter(cards) });
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

    // The flag a row opens a panel on.
    if (row.claimed === true) {
      test.check('and the row says he is ON it — which is what opens the panel');
    } else {
      test.fail('claimed was ' + JSON.stringify(row.claimed) + ': ' + res.text);
    }

    // WHAT THE PANEL SHOWS once it opens: who runs the box and what it
    // calls YOU — off the relay's card and this node's own seat record,
    // neither with a membership term in it. No member count: the relay
    // serves no membership fact, to anybody.
    const facts = row.roll || {};
    if (facts.owner === 'andy' && facts.myLabel === 'bert') {
      test.check('and the panel can say who runs it and what it calls you');
    } else {
      test.fail('roll: ' + JSON.stringify(facts));
    }

    // The fact an owner never needs. One browser now serves every relay
    // this node holds, and nothing says two mailboxes gave it the same
    // name — so "who am I here" has a per-relay answer, and this is it.
    if (facts.myLabel === 'bert') {
      test.check('and what YOU are called on that particular mailbox');
    } else {
      test.fail('myLabel: ' + JSON.stringify(facts.myLabel));
    }

    // Sent, not merely computed: handleStatus hands claimedUrls to the
    // browser beside ownedUrls.
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
    const cards = {};
    cards[server.url] = lab.box;
    hub.handleStatus({}, res, askedWith({ name: 'mallory' }), { router: cardRouter(cards) });
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
