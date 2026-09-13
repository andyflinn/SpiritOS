'use strict';

// The owner badge, and nothing more: for each URL in app/natter/relays.json,
// does a signed GET /api/relay/status come back 200 with a report?
//
// That is the whole definition (DICTIONARY.md, "Owner badge"; CYCLE-A.md).
// The mailbox already answers "is this key the owner here?" every time the
// owner asks for a census, so the badge gets no endpoint of its own: a
// second, cheaper "am I owner?" route would be a second authority on the
// same fact, and the two would drift.
//
// Nothing here opens a socket. The caller passes a request function — the
// hub passes the one that speaks HTTPS, tests pass one that answers from a
// relay object in the same process.

// Isomorphic, the way kernel.js is: the rules are shared, the filesystem
// and the signing are node-only. Natter runs in the browser and has to
// obey the same "how few mailboxes may this node be left with" rule the
// node side knows, and a rule copied into a second file is a rule that
// will be changed in one of them. Nothing below this line requires
// anything unless it is running under node.
const isNode = typeof process !== 'undefined' && !!process.versions && !!process.versions.node;
const fs = isNode ? require('fs') : null;
const path = isNode ? require('path') : null;
const auth = isNode ? require('./relayAuth') : null;

function normalizeUrl(u) {
  return String(u == null ? '' : u).trim().replace(/\/+$/, '');
}

// WHAT A NODE MUST NOT BE LEFT WITHOUT.
//
//   Andy: "That rule should be: a node keeps at least one working,
//   public relay"
//
// It used to be `count > 1` — pure arithmetic over rows — and that is
// satisfied by a list of two dead loopback lab relays, which is a node
// that cannot claim, cannot send, cannot read, and cannot be reached by
// anybody. Andy's own node was in exactly that shape: two rows, one of
// them a lab relay on 127.0.0.1 that was not running, sitting FIRST so
// every /api/hub verb dialled it.
//
// So the floor is not a number of rows. It is one PUBLIC relay.
//
// ── PUBLIC, AND WHY "WORKING" IS NOT PART OF THIS ────────────────────
//
// Public is a property of the URL and the same one hub.assertRelayUrl
// already enforces on the wire: https, or http only to loopback. A
// loopback relay is a lab fixture — no peer on the internet can reach
// you there, so it is not what keeps a node alive.
//
// "Working" is a live fact — a stream held right now — and it does NOT
// belong in a permission check, for a reason that only shows up in the
// case that matters: if your one public relay is down, a rule demanding
// a working one would refuse every removal, including removing the dead
// lab row that is causing the trouble. It would lock the door of the
// room it just set on fire.
//
// Working belongs in what a screen SHOWS — "your relay is not answering"
// — which is a different job from deciding whether a list may be edited.
//
// `relays` is the list as it stands and `url` the row being considered.
// The question is about what SURVIVES, which a count can never answer:
// removing the only public row from a list of five is still fatal.
function isPublicRelay(url) {
  var target;
  try { target = new URL(String(url || '')); }
  catch (e) { return false; }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') return false;
  var host = String(target.hostname || '').toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') return false;
  // http to a public host is refused on the wire by assertRelayUrl, so a
  // node cannot rely on one and this must not count it either.
  return target.protocol === 'https:';
}

function canRemoveMailbox(relays, url) {
  // A count, from the version before this one. Answered false rather
  // than guessed at: a caller that still passes a number is asking a
  // question this rule no longer knows how to answer, and saying no is
  // the safe half of being wrong.
  if (!Array.isArray(relays)) return false;
  var going = String(url || '');
  return relays.some(function (row) {
    var u = String((row && row.url) || row || '');
    return u !== going && isPublicRelay(u);
  });
}

// Natter rows, in file order, deduped by URL. A row with no url is not a
// mailbox; a malformed file is no mailboxes, never a throw, because the
// browser asks for this on every claim.
function loadRelays(rootDir) {
  var raw;
  try { raw = fs.readFileSync(path.join(rootDir, 'app', 'natter', 'relays.json'), 'utf8'); }
  catch (e) { return []; }
  var list;
  try { list = JSON.parse(raw); }
  catch (e) { return []; }
  if (!Array.isArray(list)) return [];
  var seen = Object.create(null);
  var rows = [];
  list.forEach(function (row) {
    var url = normalizeUrl(row && row.url);
    if (!url || seen[url]) return;
    seen[url] = true;
    rows.push({ label: (row && row.label) || url, url: url });
  });
  return rows;
}

function configuredUrls(rootDir) {
  return loadRelays(rootDir).map(function (r) { return r.url; });
}

function statusPath(rootDir, name) {
  var q = '/api/relay/status?name=' + encodeURIComponent(name || '');
  var id = auth.loadIdentity(rootDir);
  if (id && id.privateKey) {
    q += '&sig=' + encodeURIComponent(auth.sign(id.privateKey, auth.statusMessage(name || '')));
  }
  return q;
}

// 200 alone is not the badge. A mailbox that answered 200 with an error
// body, or with something that is not a census, has not told us this key
// owns it — so the report is what is checked, not the number.
function readBadge(answer) {
  if (!answer) return { owned: false, status: 0, error: 'no answer' };
  var status = Number(answer.status) || 0;
  var parsed = null;
  try { parsed = JSON.parse(answer.text); }
  catch (e) { parsed = null; }
  if (status === 200 && parsed && !parsed.error && typeof parsed.mode === 'string') {
    return { owned: true, status: status, report: parsed };
  }
  return {
    owned: false,
    status: status,
    error: (parsed && parsed.error) || 'not owner',
  };
}

function summarize(rows) {
  var ownedUrls = rows.filter(function (r) { return r.owned; })
    .map(function (r) { return r.url; });
  // A DIFFERENT QUESTION from owning, and the one a device needs. B2 gave
  // every identity with a row its own slot; this is how a node finds the
  // relays where it HAS a row. Owning implies claiming — the owner holds
  // a peer row from first claim — so the owned ones are in here too.
  var claimedUrls = rows.filter(function (r) { return r.owned || r.claimed; })
    .map(function (r) { return r.url; });
  return {
    rows: rows,
    ownedUrls: ownedUrls,
    claimedUrls: claimedUrls,
    // The picker is a question, not a default. One owned mailbox needs no
    // question; two do, and answering it by taking the first URL is the
    // habit this cycle exists to break.
    mustPick: ownedUrls.length > 1,
  };
}

// request(url, method, pathname) -> Promise<{ status, text }>
// Is one of this relay's rows ours? Asked of the PUBLIC census, which
// hands every label and key to anyone — so this costs no signature, adds
// no endpoint, and tells the relay nothing it did not publish.
//
// Only asked when the owner badge already said no: owning implies a row,
// so the second request is skipped on the mailboxes that matter most.
function claimedFrom(answer, myKey) {
  if (!myKey || !answer) return false;
  var parsed = null;
  try { parsed = JSON.parse(answer.text); }
  catch (e) { return false; }
  var list = (parsed && parsed.peers) || [];
  if (!Array.isArray(list)) return false;
  return list.some(function (p) { return p && p.publicKey === myKey; });
}

// WHAT A MEMBER MAY SAY ABOUT A MAILBOX IT DOES NOT OWN.
//
// The census is already fetched to answer claimedFrom above, and was
// then thrown away — so a member's panel had nothing to show but the
// 403 from the owner-only status call, and opened onto the words "not
// the owner". An error is the wrong thing to put in front of somebody in
// the ordinary case of being a member.
//
// Only what /api/relay/who already hands to anyone who asks. No second
// call, no signature, and nothing here the mailbox did not publish —
// which is also why there is no question about a member reading it.
//
// Deliberately NOT the peer list itself: a wall of 48-character keys is
// machine detail wearing a person's clothes (UI_DESIGN_STYLE.md §6), and
// the count is what a person is actually asking.
function censusFacts(answer, myKey) {
  var parsed = null;
  try { parsed = JSON.parse(answer && answer.text); }
  catch (e) { return null; }
  var list = (parsed && parsed.peers) || [];
  if (!Array.isArray(list)) return null;

  var owner = '';
  var mine = '';
  list.forEach(function (p) {
    if (!p) return;
    if (p.owner) owner = p.publicLabel || p.name || '';
    // YOUR OWN LABEL ON THIS BOX, which is the fact that only exists
    // once a node is on more than one. Nothing says two mailboxes gave
    // you the same name, and with one browser now serving every relay
    // this node holds, "who am I here" is a question with a per-relay
    // answer.
    if (p.publicKey === myKey) mine = p.publicLabel || p.name || '';
  });

  return { owner: owner, peers: list.length, myLabel: mine };
}

function probe(rootDir, name, request, myKey) {
  var relays = loadRelays(rootDir);
  var query = statusPath(rootDir, name);
  return Promise.all(relays.map(function (relay) {
    return Promise.resolve()
      .then(function () { return request(relay.url, 'GET', query); })
      .then(function (answer) {
        var badge = readBadge(answer);
        badge.url = relay.url;
        badge.label = relay.label;
        if (badge.owned || !myKey) return badge;
        return Promise.resolve()
          .then(function () { return request(relay.url, 'GET', '/api/relay/who'); })
          .then(function (census) {
            badge.claimed = claimedFrom(census, myKey);
            // Kept only for a row this node is actually on. A mailbox it
            // merely lists tells it nothing, and a panel is not offered
            // for one.
            if (badge.claimed) badge.census = censusFacts(census, myKey);
            return badge;
          })
          .catch(function () { return badge; });
      })
      .catch(function (err) {
        // A mailbox that is down is not a mailbox we own. It says so on
        // the row rather than failing the whole probe: one unreachable
        // URL must not hide the badge on the others.
        return {
          url: relay.url,
          label: relay.label,
          owned: false,
          status: 0,
          error: String((err && err.message) || err),
        };
      });
  })).then(summarize);
}

// Which mailbox a mint goes to. `wanted` is the URL the human picked; it
// is honoured only if it is one this node actually lists, so a page (or a
// stale tab) cannot aim an owner-signed mint at a URL that is not in
// Natter. With nothing wanted there is a default only when there is no
// choice to make — never relays.json[0] out of habit.
function chooseUrl(urls, wanted) {
  var w = normalizeUrl(wanted);
  if (w) {
    if (urls.indexOf(w) === -1) {
      return { ok: false, status: 403, error: 'url not in app/natter/relays.json' };
    }
    return { ok: true, url: w };
  }
  if (urls.length === 1) return { ok: true, url: urls[0] };
  if (urls.length === 0) {
    return { ok: false, status: 503, error: 'no relay url in app/natter/relays.json' };
  }
  return { ok: false, status: 400, error: 'pick a mailbox url' };
}

// The node side gets everything. The browser gets the rules it has to
// obey and nothing that would need a filesystem — Natter reads
// window.spiritOwnerBadge, and if this script never loaded it finds no
// helper and draws no Remove at all, which is the safe way to be wrong.
if (isNode) {
  module.exports = {
    censusFacts: censusFacts,
    normalizeUrl: normalizeUrl,
    canRemoveMailbox: canRemoveMailbox,
    isPublicRelay: isPublicRelay,
    loadRelays: loadRelays,
    configuredUrls: configuredUrls,
    statusPath: statusPath,
    readBadge: readBadge,
    summarize: summarize,
    probe: probe,
    chooseUrl: chooseUrl,
  };
} else if (typeof window !== 'undefined') {
  window.spiritOwnerBadge = {
    normalizeUrl: normalizeUrl,
    canRemoveMailbox: canRemoveMailbox,
    isPublicRelay: isPublicRelay,
  };
}
