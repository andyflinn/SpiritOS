# spirit/relayUrl.js — its own test

Which address a relay may be reached at (goal/G22.4): https, or http to loopback for lab relays. It sends nothing. Owed
since the rule *"every production script has its own test"* (goal/G47.1, box v71, 10).

- `isLoopbackHost`: `localhost` (any case), `127.0.0.1` and `::1` are loopback; any other host, an empty one and none
  are not.
- `assertRelayUrl`: an https url is taken and answered as a `URL`; http to loopback is taken; http to any other host is
  refused ("relay url must be https"); another protocol is refused, even to loopback; what is no url is refused as "bad
  relay url".

## What its test must try to break

A public relay taken over plain http; a host that only starts with `localhost` or `127.0.0` taken as loopback; a
`ws:` or `file:` url let through because its host is loopback.
