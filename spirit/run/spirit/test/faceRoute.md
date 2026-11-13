# spirit/faceRoute.js — its own test

Where a face name lives (public-app-server/G17, the route). Andy, 2026-09-27: the owner node answers where a name lives,
*"like an HTTP redirect then the node gives the puppet a signed reply, allowing the appFaceApp to cache that route in RAM
for future use"*, and *"at restart, the dance starts anew"*. Three pure pieces. Owed since the rule *"every production
script has its own test"* (goal/G47.1, box v72). A planted clock; routes signed in process with real Ed25519 keys.

- `nameOf(host, faceDomain)`: the one label under the face domain; case, a port, a trailing dot change nothing. Two
  labels (a wildcard certificate covers one), the bare face domain, another domain, a lookalike suffix, no host or
  domain, and a label the host parser refuses are no name.
- `faceLabel` (goal/G30.1): andy and Andy are one name; a single DNS label of a-z, 0-9 and hyphen, at most 63; 64, a
  hyphen at either end, a dot, an underscore, a space or nothing is null.
- `ROUTE_MS` an hour, `NONE_MS` a minute.
- `createRouteCache`: only the owner's answer to this question counts (another key, another `re`, no question, no
  owner key: nothing taken). `none` kept a minute, `mine` an hour, `owner` (the slot owner's key, on the owner's word)
  an hour and refused with no key. A signed `to` route is taken and looked up with the route; never kept past an hour
  from now; refused when expired, signed by another key, changed after signing, handed to another face (the face's key
  is signed in), or signed without the `face-route` prefix. An unknown kind or no name is not taken. `storeAs` keeps it
  under the host; `drop` forgets; a new cache holds nothing.

## What its test must try to break

A route taken from any key or as an answer to another question; a signed route held past its hour; a route usable by a
face it was not given to; a 64-character label; a "no such route" kept as long as a route.
