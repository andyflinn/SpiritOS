// spirit/run/spirit/relay/api.js
// THE relay FAMILY ON THE SPIRIT OBJECT (goal/G32.1): the relays this node is a member of. Written to spirit.js's standard: every verb the
// node mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked
// async call, spirit.relay.<verb>(args). A verb added to the family is added here, in the same commit.
// It names no family of its own: the node maps it (goal/G32.3), answering this text to api {family}.
module.exports = {
  verbs: {
    claim: { url: 'url', name: 'name', invite: 'text?', inviteLabel: 'name?' },
    partnerCheck: { publicKey: 'key', url: 'url' },
    search: { q: 'text?', name: 'text?' },
    get: { key: 'text' },
    remove: { key: 'text' },
    add: { url: 'url', label: 'name?' },
    face: { url: 'url', name: 'name' },
    join: { url: 'url', email: 'text', code: 'text?' },
    record: { relay: 'text', from: 'number?', to: 'number?' },
  },
  // HIS RELAYS AS A SCREEN WANTS THEM (puppets/G2), moved here from kernel.js (goal/G40.8: no kernel on a face).
  // status(name): the search with '*', then each relay got, put back into the shape the screens were written against,
  // { status, text, body: { name, rows, ownedUrls, claimedUrls, mustPick, relayStatus, more } }; a refused search
  // answers its own status and body.
  names: function (call) {
    function said(e) { return { status: (e && e.status) || 0, text: '', body: (e && e.body) || { ok: false, error: String((e && e.message) || e) } }; }
    return {
      status: function (name) {
        return call('search', { q: '*', name: name || '' }).then(function (s) {
          if (!s || !s.ok) return { status: 200, text: JSON.stringify(s || {}), body: s };
          return Promise.all((s.items || []).map(function (i) {
            return call('get', { key: i.key }).then(function (g) { return g; }, function () { return null; });
          })).then(function (gets) {
            var rows = [];
            var relayStatus = {};
            gets.forEach(function (g) {
              if (!g || !g.ok) return;
              rows.push(g.relay);
              if (g.report) relayStatus[g.key] = g.report;
            });
            var body = {
              name: s.name,
              rows: rows,
              ownedUrls: rows.filter(function (r) { return r.owned; }).map(function (r) { return r.url; }),
              claimedUrls: rows.filter(function (r) { return r.owned || r.claimed; }).map(function (r) { return r.url; }),
              mustPick: !!s.mustPick,
              relayStatus: relayStatus,
              more: !!s.more,
            };
            return { status: 200, text: JSON.stringify(body), body: body };
          });
        }, said);
      },
    };
  },
};
