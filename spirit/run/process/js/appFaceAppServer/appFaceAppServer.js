'use strict';

// spirit/run/process/js/appFaceAppServer/appFaceAppServer.js
// THE FACE OWNER'S ANSWER TO A VISITOR — goal/G13.2.
//
// Run by the face owner, the DNS-segment owner, on his node. The appFaceApp server on the same
// box hands it a visitor's request as one verb, serve, and it answers that itself: nothing is
// passed through a pipe to anything any more. Andy, 2026-10-10 (goal/G13): "we can in fact. KILL
// faceProof completely and just let appFaceAppServer respond to that json request. DONE." and
// "yes, appFaceAppServer loses its pass-through over the pipe and gains the one answer; nothing
// else about it moves". So: a json ask on /api/spirit, the way kernel.js's spirit.core.ask posts
// one, is answered with the proof, typed json; any other request is 404 by name.
//
// Through appServer (apiAuth/G1.1, Andy: "gruesome! fixed in this cycle, thanks!"): api, DEBUG,
// DEPENDENCIES and every shared gate apply. No grant names it (Andy: "appFaceAppServer needs no
// grant. it is run by the owner").

const appServer = require('../../../js/appServer.js');

const JSON_TYPE = 'application/json; charset=utf-8';

function serve(a) {
  const method = String(a.method || '').toUpperCase();
  const pathname = String(a.path || '').split('?')[0];
  const isAsk = method === 'POST' && pathname === '/api/spirit' && /^application\/json/i.test(String(a.type || ''));
  if (isAsk) {
    let ask = null;
    try { ask = JSON.parse(String(a.body || '')); } catch (e) { ask = null; }
    if (!ask || typeof ask.verb !== 'string' || !ask.verb) {
      return { status: 400, type: JSON_TYPE, body: JSON.stringify({ ok: false, code: 'bad-request', error: 'a json ask names a verb' }) };
    }
    // THE PROOF: the ask reached the owner of the name, and this is its answer.
    return { status: 200, type: JSON_TYPE, body: JSON.stringify({ ok: true, app: 'appFaceAppServer', verb: ask.verb, host: String(a.host || '') }) };
  }
  return { status: 404, type: JSON_TYPE, body: JSON.stringify({ ok: false, code: 'no-such-route', error: 'nothing is served here but a json ask on /api/spirit', path: pathname }) };
}

appServer.serve({
  serve: {
    request: { host: '', method: '', path: '', body: '', type: '' },
    reply: { status: 0, body: '', type: '' },
    handler: serve,
  },
}, { dependencies: [] });
