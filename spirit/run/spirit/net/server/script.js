'use strict';
// spirit/run/spirit/net/server/script.js
// THE net BRANCH'S NODE WORK (goal/G49.25, Q5; Andy: "WHY THE FUCK WOULD IT NOT???" to "Does a branch's node work live at
// spirit/<branch>/server/script.js, handing its verbs' answers to the scan"): the answer the node server held until this item,
// moved whole. serveCommon's scan mounts it under net, the old-shape branch's own word (its api.js beside its data.js), until its
// move (goal/G49.24).
//
//   verbs(node) -> { fetch: { request, reply, handler } }; node is what the node server hands every branch (spirit/server/node/
//                  script.js, branchNode): here its body reader and its refusals. A relay fetches nothing for a page: none there.
//
// Generic outbound-request proxy: knows nothing about any specific service. A browser fetch() straight to another site is
// blocked by CORS whenever that site sends no Access-Control-Allow-Origin header; server-to-server requests are not subject to
// CORS at all. The caller supplies the target url/method/headers/body/timeout and owns all response-shape parsing; this
// forwards and relays back whatever the target returned, or a synthesized {error} on timeout/unreachable.
//
// THE PROXY (2026-09-22; the gate and the keys went with goal/G29.20). design/proxy/THE-PROXY.md ruled a gate (the owner's
// list) and keys from that list; both are gone, with every placeholder fill. What stands of it:
//
//   NO WAIT OF ITS OWN. Andy: "wait times are not the proxies concern." The caller's timeoutMs is honoured when given; when
//   not, the proxy waits as long as the far end takes. http/https.request, which imposes no limit of its own (Node's fetch had
//   a 300-second one that dropped the first Grok review), the same shape as relayRequest.js.
//
//   No size limit either: "size limits would break the proxy facility real quick." AND IT HOLDS NOTHING (goal/G16.6; Andy,
//   2026-10-11: "agreed. no number at all."): the outside reply is handed to the asker as it arrives, unread, undecoded, never
//   collected, so a body of any size costs this node one socket's buffer rather than its length in RAM.
//
//   The status and the content type cross with it, because the caller owns all response-shape parsing.
//
// NO SECRETS AND NO ALLOW LIST HERE (goal/G29.20; Andy, 2026-10-18: "remove all the env logic and allow-list crap from it at
// well"). NEVER THIS MACHINE (Andy, 2026-10-18: "fetch will not be able to reach ports on this machine, and agents may use
// it."): spirit/net/fence/script.js.
require('../../script.js');
const http = require('http');
const https = require('https');
const netFence = spirit.requireScript('spirit/net/fence/script.js');

function verbs(node) {
  if (spirit.IS_RELAY) return {};
  const readJsonBody = node.readJsonBody;
  return {
    // The target's own body and status come back, whatever they are. WIRE: it reaches the internet, so being offline fails it.
    'fetch': { request: { url: '', method: '', headers: {}, body: '', timeoutMs: 0 }, reply: {}, handler: function (req, res) {
      readJsonBody(req).then(function (body) {
        if (!body.url) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'url is required' }));
          return;
        }
        let target = null;
        try { target = new URL(body.url); } catch (err) { target = null; }
        if (!target || (target.protocol !== 'https:' && target.protocol !== 'http:')) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'url must be http or https' }));
          return;
        }
        // A target written as an address is refused here, before anything is sent; a name is checked on the address it
        // resolves to, at connect (netFence.lookup below).
        const targetHost = target.hostname.toLowerCase();
        if (netFence.isThisMachine(targetHost)) {
          res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, code: 'this-machine', error: 'net.fetch does not reach this machine: ' + targetHost }));
          return;
        }
        const method = String(body.method || 'GET').toUpperCase();
        // The caller's headers as given: no placeholder is filled and no list gates them (goal/G29.20).
        const headers = Object.assign({}, body.body !== undefined ? { 'Content-Type': 'application/json' } : {}, body.headers || {});
        const payload = body.body !== undefined ? JSON.stringify(body.body) : null;
        if (payload !== null) headers['Content-Length'] = Buffer.byteLength(payload);
        let answered = false;
        function answer(status, text) {
          if (answered) return;
          answered = true;
          res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(text);
        }
        const lib = target.protocol === 'https:' ? https : http;
        const out = lib.request(target, { method: method, headers: headers, lookup: netFence.lookup }, function (reply) {
          // STRAIGHT THROUGH, HOLDING NOTHING (goal/G16.6).
          if (answered) { reply.resume(); return; }
          answered = true;
          const type = String(reply.headers['content-type'] || 'application/octet-stream');
          res.writeHead(reply.statusCode, { 'Content-Type': type });
          reply.pipe(res);
          // A BREAK MID-BODY CANNOT BE SAID IN THE BODY: the head is written, so the caller sees a short read.
          reply.on('error', function () { try { res.end(); } catch (e) { /* gone */ } });
        });
        // The caller's own patience, when it names one. None otherwise.
        if (typeof body.timeoutMs === 'number' && body.timeoutMs > 0) {
          out.setTimeout(body.timeoutMs, function () {
            answer(502, JSON.stringify({ error: 'proxy request timed out' }));
            out.destroy();
          });
        }
        out.on('error', function (err) {
          // A name that resolved to this machine (goal/G29.20): refused by name, as an address is above.
          if (err && err.code === 'this-machine') { answer(403, JSON.stringify({ ok: false, code: 'this-machine', error: err.message })); return; }
          answer(502, JSON.stringify({ error: 'proxy target unreachable' }));
        });
        // A caller that gives up takes the call down with it.
        req.on('close', function () { if (!answered) out.destroy(); });
        out.end(payload === null ? undefined : payload);
      }).catch(function (e) { node.bodyRefused(req, res, e); });
    } },
  };
}

// What it hands out: an object holding its function (goal/G49.16; Andy: "A FUNCTION MUST ALWAYS BE INSTALLED INSIDE A CONTAINING OBJECT. PERIOD!").
module.exports = { verbs: verbs };
