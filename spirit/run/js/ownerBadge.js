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

// A personal node with no Natter row has no mailbox at all: Relay Chat
// cannot claim, cannot send, cannot read an inbox, and the owner badge
// has nothing to be a badge on. So the last row does not come off. This
// is the count AFTER which a removal is allowed, not before — one row
// left is the floor, not the error.
function canRemoveMailbox(count) {
  return Number(count) > 1;
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
    normalizeUrl: normalizeUrl,
    canRemoveMailbox: canRemoveMailbox,
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
  };
}
