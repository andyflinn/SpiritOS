# spirit/ownerBadge.js — its own test

The owner badge and the relay list's rules: which relays this node lists (the node's own state since goal/G16.3,
in the one table since goal/G40.11), which may come off it, and per listed relay whether its card names this node's
key as owner. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). The rules are
pure; the list lives in a scratch home of its own; probe's request is planted.

- `normalizeUrl` trims the url and its trailing slashes.
- `isPublicRelay`: https to a host that is not loopback (Andy: *"a node keeps at least one working, public relay"*);
  http, loopback, another scheme and no url are not.
- `KEPT_RELAY` is noderoutes.net, seeded with its key, and the only seed (goal/G19.15: *"we only list noderoutes.net"*).
- `removalRefusal`: noderoutes.net never (*"we'll remove the option to delete noderoutes.net"*); an owned or seated
  relay never, in Andy's sentences (goal/G30.7); a row only if another public row survives; a count in place of the
  list is refused.
- `ownedBy`: owned only when the stated owner is this node's key (goal/G19.8).
- `summarize`: owned urls, claimed urls (owning implies claiming), `mustPick` only for two owned or more.
- `chooseUrl`: the url picked if listed (403 otherwise), the one url when there is no choice, 503 for none, and 400
  `pick a relay url` rather than the first out of habit.
- `ensureRelays`, `addRelay`, `removeRelay`, `configuredUrls`, `loadRelays`: a fresh home gets noderoutes.net alone,
  once however often booted; a claim appends its relay under the key it learned; a url never met, with no key, is not
  listed; removal refuses noderoutes.net (409), owned and seated relays (409), an unknown url (404), no url (400), and
  takes any other off; a list that cannot be read is no relays, never a throw.
- `probe`: one card ask per listed relay, signing nothing; a card naming this node's key is owned and claimed, its roll
  from the card; another owner and no seat is `no row here`; a relay that is down is its own row, status 0, never a
  failed probe; a seat held makes it claimed; no key of its own owns nothing.

## What its test must try to break

The floor counted in rows (two dead lab relays pass); noderoutes.net, an owned or a seated relay removed; the first
relay chosen out of habit; one unreachable relay failing the whole probe.

Not reached: `relay.refused` on a probe row. `relayKeys.listed` answers no `refused` field, so no list this test can
build carries one.
