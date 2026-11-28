'use strict';
// spirit/run/spirit/relay/server/script.js
// THE spirit.relay BRANCH'S NODE WORK (goal/G49.25, box v25; Q5, Andy: "WHY THE FUCK WOULD IT NOT???" to "Does a branch's node work
// live at spirit/<branch>/server/script.js"): the relay's answers, each a verb at the one door, /spirit ("the entire set of relay verbs
// moves into spirit.relay.<verb>, with only ONE, SINGLE door"). They are the relay's own routes until this item, moved whole into
// verbs; what a relay is stays in spirit/relay/processor/script.js. On a node nothing (box v25: "spirit.relay will not be exposed").
//
//   verbs(node) -> { <verb>: { reply, handler } }; node is what the relay's server hands its branch (spirit/server/script.js,
//                  startRelay): relay, the processor's relay; the helpers it answers HTTP with; streamSink, spiritErrors and the
//                  stream's numbers. A handler reads its arguments as every handler does (readJsonBody), and an upload's from the
//                  request's headers, its body passed on as it arrives (Q10).
//
// THE NAMES (Q13, Andy: "yes"), and who may call them: a member's stream, post and reply prove their sender by its signature
// (relayAuth); a face's browser is the face's own login (its cookie spirit_face, for that host only); the home node's uploads are
// signed over this relay and the request's id; a verb of the relay's own is today's signed packet, a post addressed to the relay
// (Q11, Andy: "same as today."), its answer sealed back on the member's stream.
require('../../script.js');

const OWN = ['card', 'claim', 'face', 'search', 'rename', 'removePeer', 'invite', 'revoke', 'config', 'debug', 'monitor', 'relayLabel', 'api'];
// THE MEMBER BUNDLE (goal/G49.25, box v25: "The member verbs (card, face, removePeer, rename, search, and post, reply, stream, face
// answer, face stream) sit in one bundle, granted to each key on the relay's member roll as it joins and revoked as it leaves. The
// owner, by the relay's owner key, holds every verb"): the roll is the grant, a key holds the bundle while it is on it. The relay's
// gate (spirit/relay/processor/script.js, granted) reads it; post, reply and stream prove their sender a member by its signature.
const MEMBER = ['card', 'face', 'removePeer', 'rename', 'search', 'post', 'reply', 'stream', 'faceAnswer', 'faceFeed'];

function verbs(node) {
  if (!spirit.IS_RELAY) return {};
  const relay = node.relay;
  const readJsonBody = node.readJsonBody;
  const spiritErrors = node.spiritErrors;
  function json(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
  }
  function badBody(res) { res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Invalid JSON body'); }

  // A POST'S ANSWER, A WHITELIST, AND IT STAYS ONE. What a refusal carries is part of the protocol, so it is named here rather than
  // being whatever relay.js happened to put on the object: the alternative leaks internals to anybody who can provoke an error.
  // busy and retryAfterMs: the target is fine and occupied (0016), distinct from "peer not reachable". tooLittleTime: what was
  // offered was too little to attempt anything with. code, by the catalogue (R36 phase B), beside the sentence and never instead.
  function writePosted(res, result) {
    json(res, result.status, result.ok ? result : {
      error: result.error,
      inFlight: !!result.inFlight,
      busy: !!result.busy,
      retryAfterMs: typeof result.retryAfterMs === 'number' ? result.retryAfterMs : 0,
      tooLittleTime: !!result.tooLittleTime,
      code: spiritErrors.classify(result.status, result.error, result).code,
    });
  }
  // A POST, TO A MEMBER OR TO THIS RELAY ITSELF. budgetMs is how long the ASKER is still willing to wait, a remaining duration and
  // never a deadline; informational, the relay grants min(asked, its own ceiling), and a number, zero too, is a declaration (0017).
  // A post answered on itself (R13; goal/G22.6: a card ask, a claim, a stranger's post to a member) stays open until relay.js's held
  // promise settles, with the reply packet or with 504 "no answer yet"; it never rejects. THE ADDRESS IT CAME FROM is read by
  // relay.js only for a sender it does not hold (goal/G22.6).
  function posted(req, res, to) {
    readJsonBody(req).then(function (b) {
      const body = b || {};
      const budgetMs = typeof body.budgetMs === 'number' && isFinite(body.budgetMs) ? Math.max(0, body.budgetMs) : undefined;
      const result = relay.routePost(body.from, to === undefined ? body.to : to, body.text, body.sig, budgetMs, node.clientKeyFor(req));
      if (result && result.held && typeof result.held.then === 'function') { result.held.then(function (r) { writePosted(res, r); }); return; }
      writePosted(res, result);
    }).catch(function () { badBody(res); });
  }

  // ── A MEMBER'S FACE (goal/G30.9) ──
  // The relay serves <face>.<its face domain> while that member has a verified email, a face name and his home node present
  // (relay.faceAt). The login is the relay's (relay.faceLogin), a session in its memory carried by the cookie spirit_face, HttpOnly,
  // for that host only. ONLY THE FACE'S OWN PAGE CALLS (goal/G41.30, RC2; Andy, Q3: "yes."): Origin equal to the face's own host,
  // the session's name the face's, and Content-Type application/json, since all faces are same-site.
  function faceCookie(req) {
    const m = /(?:^|;\s*)spirit_face=([A-Za-z0-9_-]+)/.exec(String(req.headers.cookie || ''));
    return m ? m[1] : '';
  }
  function faceSetCookie(res, sid) {
    res.setHeader('Set-Cookie', 'spirit_face=' + sid + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=' + (7 * 24 * 60 * 60));
  }
  function hostOf(req) { return String(req.headers.host || '').toLowerCase(); }
  function facePostProblem(req, host) {
    let origin = '';
    try { origin = new URL(String(req.headers.origin || '')).host.toLowerCase(); } catch (e) { origin = ''; }
    if (!origin || origin !== host) return 'this post did not come from the page of this face';
    if (String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json') return 'a post here is application/json';
    return '';
  }
  // The face this request's host names, answered with its refusal when it is none or offline; null when it may go on.
  function faceOf(req, res) {
    const at = relay.faceAt(req.headers.host || '');
    if (!at.face) { json(res, 404, { ok: false, error: 'No such face.' }); return null; }
    if (!at.ok) { json(res, at.status || 404, { ok: false, error: at.status === 503 ? 'This face is offline: its home node is not connected.' : 'No such face.' }); return null; }
    const problem = facePostProblem(req, hostOf(req));
    if (problem) { json(res, 403, { ok: false, error: problem }); return null; }
    return at;
  }
  // THE FACE REACHES ITS HOME NODE (goal/G30.14), by its login: a call or a file is a stream event to the home node, and this
  // response waits for the home node's upload. The session is this face's: another member's login is no login here (RC2).
  function faceAsk(req, res, ask) {
    const at = faceOf(req, res);
    if (!at) return;
    const sid = faceCookie(req);
    const session = relay.faceSession(sid);
    if (session.ok && session.name !== at.name) { json(res, 403, { ok: false, error: 'this login is not this face\'s' }); return; }
    readJsonBody(req).then(function (args) {
      const said = relay.faceCall(sid, ask(args || {}), res);
      if (!said.ok && !res.headersSent) json(res, said.status || 502, { ok: false, error: said.error });
    }, function () { json(res, 400, { ok: false, error: 'the body is not json' }); });
  }
  // THE HOME NODE ANSWERS ITS FACE (goal/G30.14; Q10, Andy: "i agree with your recommendation."): the raw upload is piped into the
  // face's waiting response, or into its open stream, as it arrives, never held. Who it is, the signature over this relay and the id,
  // and the id are headers, so the body is never read here.
  function upload(answer) {
    return function (req, res) {
      const from = String(req.headers['x-spirit-from'] || '');
      const sig = String(req.headers['x-spirit-sig'] || '');
      const said = answer
        ? relay.faceAnswer(from, String(req.headers['x-spirit-id'] || ''), sig, req, { status: req.headers['x-spirit-status'], type: req.headers['x-spirit-type'] })
        : relay.faceFeed(from, sig, req);
      if (!said.ok) {
        json(res, said.status, { error: said.error, code: spiritErrors.classify(said.status, said.error, said).code });
        req.resume();
        return;
      }
      req.on('end', function () { json(res, 200, { ok: true }); });
    };
  }

  const out = {
    // A member posts to a member, or to this relay. A post carries no hints (goal/G47.1, box v69): the arguments are checked by
    // spirit/relay/script.js, which names none.
    'post': { reply: {}, handler: function (req, res) { posted(req, res); } },
    'reply': { reply: {}, handler: function (req, res) {
      readJsonBody(req).then(function (b) {
        const body = b || {};
        const result = relay.routeReply(body.from, body.hash, body.text, body.sig);
        json(res, result.status, result.ok ? result : { error: result.error, code: spiritErrors.classify(result.status, result.error, result).code });
      }).catch(function () { badBody(res); });
    } },
    // ONE HELD CONNECTION PER IDENTITY, carrying who is reachable. Its sink is no response: relay.js and presence.js hold it and
    // neither knows what http is (streamSink.js says why its head is written lazily, and why it cuts a reader that stopped, R35).
    // The sink is declared after the teardown it may call, so a stream cut for not reading is torn down by the cut.
    'stream': { reply: {}, handler: function (req, res) {
      readJsonBody(req).then(function (b) {
        const body = b || {};
        let torndown = false;
        let heartbeat = null;
        let live = false;
        const sink = node.streamSink.createStreamSink(res, { onStall: function () { if (live) teardown(); } });
        const opened = relay.streamOpen(String(body.key || ''), String(body.sig || ''), sink);
        if (!opened || !opened.ok) {
          // SAY HOW LONG (RFC 9110 Retry-After, in seconds): a 429 is the connect allowance, a 503 the full fixed allowance (cycle 8).
          if (opened && opened.status === 429) { try { res.setHeader('Retry-After', String(Math.ceil(60 / relay.presence.perMin) + 5)); } catch (e) { /* sent */ } }
          if (opened && opened.status === 503) { try { res.setHeader('Retry-After', String(node.FULL_RETRY_S)); } catch (e) { /* sent */ } }
          // A NODE THAT IS NOT A MEMBER IS TOLD WHY (goal/G19.1): code not-a-sender, as on a post and a reply.
          if (opened && opened.status === 403 && spiritErrors.classify(403, opened.error).code === 'not-a-sender') {
            json(res, 403, { error: opened.error, code: spiritErrors.classify(403, opened.error).code });
            return;
          }
          node.nodeRefusal(res, opened && opened.status);
          return;
        }
        live = true;
        heartbeat = setInterval(function () { try { sink.write(':\n\n'); } catch (e) { /* teardown follows */ } }, 20000);
        // Bound to 'error' as well as 'close', and once-guarded: a socket that dies without a clean close would leave a peer
        // reading as PRESENT forever. Which close it was is asked of the sink.
        function teardown() {
          if (torndown) return;
          torndown = true;
          clearInterval(heartbeat);
          relay.streamClose(String(body.key || ''), sink, sink.stalled() ? 'stalled' : undefined);
        }
        req.on('close', teardown);
        req.on('error', teardown);
      }).catch(function () { badBody(res); });
    } },
    'faceAnswer': { reply: {}, handler: upload(true) },
    'faceFeed': { reply: {}, handler: upload(false) },
    // The face's request, whole, as it came: sealed, a { get } for a file, or a piece of a large one (goal/G33.1); the relay reads none.
    'faceCall': { reply: {}, handler: function (req, res) { faceAsk(req, res, function (a) { return a.request && typeof a.request === 'object' ? a.request : {}; }); } },
    // The face's own stream of live updates. here is the face's Connect here press (goal/G30.12): it moves the stream from another
    // device; key is the face's sealing key (goal/G30.11), handed to the home node in face-open.
    'faceEvents': { reply: {}, handler: function (req, res) {
      const at = faceOf(req, res);
      if (!at) return;
      readJsonBody(req).then(function (b) {
        const body = b || {};
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' });
        const said = relay.faceOpen(faceCookie(req), res, { here: body.here === true, key: String(body.key || '') });
        if (!said.ok) res.end(JSON.stringify({ type: 'refused', status: said.status, code: said.code || '', error: said.error }) + '\n');
      }).catch(function () { badBody(res); });
    } },
    'faceState': { reply: {}, handler: function (req, res) {
      const at = faceOf(req, res);
      if (!at) return;
      const s = relay.faceSession(faceCookie(req));
      json(res, 200, { ok: true, face: at.name, loggedIn: !!(s.ok && s.name === at.name) });
    } },
    'faceLogin': { reply: {}, handler: function (req, res) {
      const at = faceOf(req, res);
      if (!at) return;
      readJsonBody(req).then(function (b) {
        const said = relay.faceLogin(at.name, String((b && b.text) || ''));
        if (said.loggedIn) faceSetCookie(res, said.session);
        json(res, 200, { ok: true, loggedIn: !!said.loggedIn });
      }).catch(function () { json(res, 400, { ok: false, error: 'the body is not json' }); });
    } },
    'faceLogout': { reply: {}, handler: function (req, res) {
      const at = faceOf(req, res);
      if (!at) return;
      relay.faceLogout(faceCookie(req));
      res.setHeader('Set-Cookie', 'spirit_face=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
      json(res, 200, { ok: true, loggedIn: false });
    } },
  };
  // ITS OWN VERBS, today's signed packet addressed to this relay (Q11): the post's own path, to '' (this box), its text naming the verb.
  OWN.forEach(function (v) { out[v] = { reply: {}, handler: function (req, res) { posted(req, res, ''); } }; });
  return out;
}

// What it hands out: an object holding its function (goal/G49.16; Andy: "A FUNCTION MUST ALWAYS BE INSTALLED INSIDE A CONTAINING OBJECT. PERIOD!").
module.exports = { verbs: verbs, OWN: OWN, MEMBER: MEMBER };
