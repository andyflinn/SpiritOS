'use strict';
// spirit/run/spirit/relay/api.js
// THE relay FAMILY ON THE SPIRIT OBJECT (goal/G32.1): the relays this node is a member of. Written to spirit.js's standard: every verb the
// node mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked
// async call, spirit.relay.<verb>(args). A verb added to the family is added here, in the same commit.
// It names no family of its own: the node maps it (goal/G32.3), answering this text to api {family}.
// ITS COMPANION data.js, REQUIRED HERE AND NOWHERE ELSE (goal/G47.1; Andy's rule: "every api.js requires it's companion
// data.js, and is the only script to require that data.js"): whoever requires this branch has its data with it, on a page
// (spirit.js runs this file there, with no require of its own, and waits for what it asks) and in node.
if (typeof require === 'function') require('../spirit.js').require('spirit/relay/data.js'); else window.spirit.require('spirit/relay/data.js');
module.exports = {
  verbs: {
    claim: { url: 'spirit.type.string.URL', name: 'spirit.type.string.label', invite: 'spirit.type.string.word?', inviteLabel: 'spirit.type.string.label?' },
    partnerCheck: { publicKey: 'spirit.type.string.IDNew', url: 'spirit.type.string.URL' },
    get: { key: 'spirit.type.string.relay' },
    remove: { key: 'spirit.type.string.URL' },
    add: { url: 'spirit.type.string.URL', label: 'spirit.type.string.label?' },
    face: { url: 'spirit.type.string.URL', name: 'spirit.type.string.label' },
    // link: the caller's link the relay mails, its code and key added (goal/G40.10; Andy: "{email, URL, card}").
    join: { url: 'spirit.type.string.URL', email: 'spirit.type.string.email', code: 'spirit.type.string.word?', link: 'spirit.type.string.URL?' },
    // Leaving a relay (goal/G40.10; Andy: "add the leave verb to node"): the seat given up, the relay kept on the list.
    leave: { key: 'spirit.type.string.URL' },
  },
  // HIS RELAYS AS A SCREEN WANTS THEM (puppets/G2), moved here from the old kernel (goal/G40.8: no kernel on a face).
  // status(name): the relays this node keeps, listed by contact.search (goal/G40.11: relay.search went, a relay is a
  // row of the one table), then each relay got, put back into the shape the screens were written against,
  // { status, text, body: { name, rows, ownedUrls, claimedUrls, mustPick, relayStatus, more } }; a refused search
  // answers its own status and body. The search is asked of the one spirit object (Andy: every module "reaches
  // everything through it"), since a family's call reaches its own verbs only.
  names: function (call) {
    function said(e) { return { status: (e && e.status) || 0, text: '', body: (e && e.body) || { ok: false, error: String((e && e.message) || e) } }; }
    function listed() {
      var one = typeof spirit !== 'undefined' ? spirit : (typeof window !== 'undefined' ? window.spirit : null);
      if (!one) return Promise.reject(new Error('no spirit object'));
      // On a page through spirit.ready, where any family named stands, bound when first called (goal/G43.27, Q1: no api at
      // load); in node, the instance itself.
      return Promise.resolve(one.ready || one).then(function (s) {
        if (!s || !s.contact || typeof s.contact.search !== 'function') throw new Error('no contact family on the spirit object');
        return s.contact.search({ q: '*', relay: true, keep: true });
      });
    }
    return {
      // Each relay got is kept by the family's own cache manager (goal/G41.28), spirit.data.relay.data.
      status: function (name) {
        var one = typeof spirit !== 'undefined' ? spirit : (typeof window !== 'undefined' ? window.spirit : null);
        return listed().then(function (s) {
          if (!s || !s.ok) return { status: 200, text: JSON.stringify(s || {}), body: s };
          return Promise.all([one.require('spirit/relay/data.js')].concat((s.items || []).map(function (i) {
            return call('get', { key: i.key }).then(function (g) { return g; }, function () { return null; });
          }))).then(function (got) {
            var gets = got.slice(1);
            gets.forEach(function (g) { one.data.relay.data.keep(g); });
            var rows = [];
            var relayStatus = {};
            gets.forEach(function (g) {
              if (!g || !g.ok) return;
              rows.push(g.relay);
              if (g.report) relayStatus[g.key] = g.report;
            });
            var ownedUrls = rows.filter(function (r) { return r.owned; }).map(function (r) { return r.url; });
            var body = {
              name: name || '',
              rows: rows,
              ownedUrls: ownedUrls,
              claimedUrls: rows.filter(function (r) { return r.owned || r.claimed; }).map(function (r) { return r.url; }),
              // One fact about this node, never a row: it owns more than one relay and has to pick which one it is
              // known by (ownerBadge.summarize).
              mustPick: ownedUrls.length > 1,
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
