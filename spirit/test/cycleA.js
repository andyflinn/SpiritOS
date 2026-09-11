'use strict';

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
const invites = require('../run/js/invites');
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
  var box = createRelay(home);
  box.claim(name, auth.sign(id.privateKey, auth.claimMessage(name)), id.publicKey, '10.0.0.1');
  return { home: home, box: box };
}

function nodeHome(id, urls) {
  var home = tmpHome('node');
  auth.saveIdentity(home, id);
  writeRelays(home, urls.map(function (u, i) {
    return { label: 'mailbox' + (i + 1), url: u };
  }));
  return home;
}

// Answers a status request out of a relay object in this process. Same
// shape as the wire: the report itself on 200, { error } otherwise.
function statusAnswerer(boxes) {
  return function (url, method, pathname) {
    var box = boxes[url];
    if (!box) return Promise.reject(new Error('connection refused'));
    var q = new URL('http://x' + pathname);
    var r = box.status(q.searchParams.get('name') || '', q.searchParams.get('sig') || '');
    return Promise.resolve({
      status: r.status,
      text: JSON.stringify(r.ok ? r.report : { error: r.error }),
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

{
  const good = ownerBadge.readBadge({ status: 200, text: JSON.stringify({ mode: 'keys', owner: 'andy', peers: [] }) });
  if (good.owned && good.report && good.report.owner === 'andy') {
    test.check('signed 200 with a report is the badge, and the report comes back with it');
  } else {
    test.fail('good: ' + JSON.stringify(good));
  }

  // 200 is not the badge. A mailbox behind something that answers 200 to
  // everything must not hand this node an Invite button.
  const emptyBody = ownerBadge.readBadge({ status: 200, text: 'OK' });
  const errorBody = ownerBadge.readBadge({ status: 200, text: JSON.stringify({ error: 'not the owner' }) });
  if (!emptyBody.owned && !errorBody.owned) {
    test.check('200 without a census report is not a badge');
  } else {
    test.fail('200 impostors: ' + JSON.stringify([emptyBody, errorBody]));
  }

  const refused = ownerBadge.readBadge({ status: 403, text: JSON.stringify({ error: 'not the owner' }) });
  if (!refused.owned && refused.status === 403 && refused.error === 'not the owner') {
    test.check("403 keeps the relay's own reason on the row");
  } else {
    test.fail('refused: ' + JSON.stringify(refused));
  }

  if (!ownerBadge.readBadge(null).owned) {
    test.check('no answer at all is not a badge');
  } else {
    test.fail('null answer read as owned');
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

  return ownerBadge.probe(home, 'andy', statusAnswerer(boxes)).then(function (summary) {
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

    const foreign = summary.rows.filter(function (r) { return r.url === urlTheirs; })[0];
    if (foreign && !foreign.owned && foreign.status === 403) {
      test.check("someone else's mailbox is on the list, unbadged");
    } else {
      test.fail('foreign row: ' + JSON.stringify(foreign));
    }

    // Two owned mailboxes is the case the picker exists for.
    const second = ownedBox(andy, 'andy');
    const urlSecond = 'https://second.example';
    const twoBoxes = {};
    twoBoxes[urlMine] = mine.box;
    twoBoxes[urlSecond] = second.box;
    return ownerBadge.probe(nodeHome(andy, [urlMine, urlSecond]), 'andy', statusAnswerer(twoBoxes));
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
    return ownerBadge.probe(nodeHome(andy, [urlDown, urlUp]), 'andy', statusAnswerer(upBoxes));
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
      if (req.method === 'GET' && url.pathname === '/api/relay/status') {
        const r = box.status(url.searchParams.get('name') || '', url.searchParams.get('sig') || '');
        reply(r, r.report);
        return;
      }
      // THE PUBLIC CENSUS, which probe() reads to answer "do I have a
      // row here". The fake did not serve it, so claimedFrom() saw a 404
      // in every test and answered false — and a suite cannot notice a
      // flag that is false because the question was never asked.
      //
      // Same shape as the wire (server.js, handleRelayWho): peers, and
      // the mailbox's own key beside them.
      if (req.method === 'GET' && url.pathname === '/api/relay/who') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          peers: box.who(),
          mailboxPublicKey: box.mailboxPublicKey(),
        }));
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/relay/invite') {
        let raw = '';
        req.on('data', function (c) { raw += c; });
        req.on('end', function () {
          let body = {};
          try { body = JSON.parse(raw); } catch (e) { body = {}; }
          const r = box.mint(body.name, body.label, body.days, body.sig);
          reply(r, r.invite);
        });
        return;
      }
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

function hubInvite(hub, body) {
  const res = fakeRes();
  hub.handleInvite({}, res, function () { return Promise.resolve(body); });
  return res.wait();
}

function runHubOnLoopback() {
  test.subHeading('The hub sends the mint to the mailbox that was chosen');

  const owner = auth.generateIdentity('andy');
  const first = ownedBox(owner, 'andy');
  const second = ownedBox(owner, 'andy');
  let servers;
  let hub;

  return Promise.all([relayServer(first.box), relayServer(second.box)]).then(function (s) {
    servers = s;
    hub = createHub(nodeHome(owner, [servers[0].url, servers[1].url]));
    return hubInvite(hub, { name: 'andy', label: 'saint', days: 7, url: servers[1].url });
  }).then(function (res) {
    let token = '';
    try { token = JSON.parse(res.text).token || ''; } catch (e) { token = ''; }
    if (res.status === 201 && token) {
      test.check('an invite aimed at the second mailbox is minted');
    } else {
      test.fail('mint on second: ' + res.status + ' ' + res.text);
    }

    // The whole point of the cycle: the token exists on the mailbox that
    // was named, and does not exist on the one that merely happens to be
    // first in relays.json.
    const onSecond = invites.load(second.home).some(function (row) { return row.token === token; });
    const onFirst = invites.load(first.home).some(function (row) { return row.token === token; });
    if (token && onSecond && !onFirst) {
      test.check('the row is on the chosen mailbox and not on relays.json[0]');
    } else {
      test.fail('token landed wrong: onFirst=' + onFirst + ' onSecond=' + onSecond);
    }

    return hubInvite(hub, { name: 'andy', label: 'saint', days: 7 });
  }).then(function (res) {
    if (res.status === 400 && /pick a mailbox/.test(res.text)) {
      test.check('two mailboxes and no choice is refused, not guessed');
    } else {
      test.fail('unaimed mint: ' + res.status + ' ' + res.text);
    }

    return hubInvite(hub, { name: 'andy', label: 'saint', days: 7, url: 'https://evil.example' });
  }).then(function (res) {
    if (res.status === 403) {
      test.check('a mint aimed off the Natter list never leaves the node');
    } else {
      test.fail('foreign mint: ' + res.status + ' ' + res.text);
    }

    // And the badge itself, over the same loopback: both mailboxes owned,
    // so Relay Chat shows the panel and the picker.
    const res2 = fakeRes();
    hub.handleStatus({}, res2, new URL('http://127.0.0.1/api/hub/status?name=andy'));
    return res2.wait();
  }).then(function (res) {
    let data = {};
    try { data = JSON.parse(res.text); } catch (e) { data = {}; }
    if (res.status === 200 && data.ownedUrls && data.ownedUrls.length === 2 && data.mustPick) {
      test.check('GET /api/hub/status badges both mailboxes and asks for a pick');
    } else {
      test.fail('hub status: ' + res.status + ' ' + res.text);
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
  const minted = lab.box.mint('andy', 'bert', 7,
    auth.sign(owner.privateKey, invites.mintMessage('bert', 7)));
  const joined = lab.box.claim('bert',
    auth.sign(guest.privateKey, auth.claimMessage('bert')),
    guest.publicKey, '10.0.0.7', minted.ok && minted.invite.token);
  if (!joined.ok) {
    test.fail('bert could not join: ' + JSON.stringify(joined));
    return Promise.resolve();
  }

  let server;
  return relayServer(lab.box).then(function (s) {
    server = s;
    const hub = createHub(nodeHome(guest, [server.url]));
    const res = fakeRes();
    hub.handleStatus({}, res, new URL('http://x/api/hub/status?name=bert'));
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
    // All three come from the PUBLIC census, which was already fetched
    // to decide `claimed` and was being thrown away.
    const facts = row.census || {};
    if (facts.owner === 'andy' && facts.peers === 2) {
      test.check('and the panel can say who runs it and how many are on it');
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
    hub.handleStatus({}, res, new URL('http://x/api/hub/status?name=mallory'));
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
