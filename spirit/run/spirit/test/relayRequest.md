# spirit/relayRequest.js — its own test

The one outbound door onto a public relay (Andy: *"we have one component that provides signed requests over http in
public. all other components must use that interface. no exception."*), and the owner node's one hop to an app server
on its own box (public-app-server/G17). Owed since the rule *"every production script has its own test"* (goal/G47.1,
box v72). Every socket is local: a planted http server on 127.0.0.1 port 0, and one on the pipe `appClient.pipePathFor`
names on a scratch root. No public host is reached.

- `relayRequest`: method, path and JSON body arrive; the answer is `{ status, text }`; `Host` is the target's own, with
  JSON type and the body's byte length; extra headers ride along; a refusal is an answer, not a throw; a character split
  across chunks arrives whole; an address `assertRelayUrl` refuses (http not loopback, another scheme, a bad URL) is
  refused before any socket opens; no answer rejects; a deadline (default 30 s), not an idle timer, said as
  `relay-did-not-answer`, also for a dribbling relay; an answer past `answerMax`, by default `limits.BODY_MAX` (Andy,
  2026-10-11), refused as `relay-answer-too-large`.
- `pipeRequest`: `{ status, text, type }`, the method upper-cased; only the content type crosses, `Host: localhost`;
  the caller's headers ride along (apiAuth/G1.13); `X-Spirit-Kind: background` comes back as `kind`; never throws:
  `app-not-running`, `app-did-not-answer` (silent or dribbling), `app-answer-too-large` with `bytes` and `max`.
- `relayUpload`: a chunked octet-stream POST, Host the target's, writes arriving whole, no length; a refused address
  said on the stream's `error`, no socket opened.

## What its test must try to break

A second size figure beside `limits.BODY_MAX`; an idle timer standing in for the deadline; the explicit `Host` dropped
in a rewrite; a socket opened to an address the rule refuses; a pipe hop that throws instead of answering `refused`.
