# spirit/relay/api.js — its own test

The relay family: the relays this node is a member of, and his relays as a screen wants them (`names`, puppets/G2). Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). The file is run as spirit.js runs the text `api {family}` answers (`loadInterface`: its text with
`module` and `exports` alone), every call checked by spirit.js's own check (`spirit.check`, its rules `spirit.rules`).
`server.js` is read as text only, for the table `loopbackVerbs.mount('relay', ...)` mounts.

- It runs with nothing but `module` and `exports`, and exports its table of verbs and its `names` and nothing else: it names
  no family of its own (goal/G32.3: the node maps it).
- Every argument's rule is one of spirit.js's standard rules, `?` optional.
- **"Every verb the node mounts for this family, each argument with its rule"** (its own header): it declares exactly
  the verbs server.js mounts for the family, and each verb exactly the arguments its handler's `request` carries.
- `claim`, `partnerCheck`, `get`, `remove`, `add`, `face` and `record` each take what their handler reads, the
  address an http or https one.
- **goal/G40.10** (Andy: *"{email, URL, card}"*): `join` takes the relay's address and an email; a `code`, and the
  `link` the relay mails, an address, may be given. `leave` (*"add the leave verb to node"*) names the relay by its
  key alone.
- **goal/G40.11**: it has no `search`; a relay is a row of the one table.
- **`names(call).status(name)`**, with a planted spirit object as the global: it lists the relays with
  `contact.search({ q: '*', relay: 'yes', keep: 'yes' })`, asked of the one spirit object (Andy: every module *"reaches
  everything through it"*); gets each relay listed by its key through the family's own call and asks it nothing else;
  hands each answer to the relay family's cache manager to keep (goal/G41.28); answers `{ status: 200, text, body }`,
  `body` `{ name, rows, ownedUrls, claimedUrls, mustPick, relayStatus, more }`: rows the relays got (a refused or
  not-ok get left out), the owned urls, the owned and claimed ones, each report by key, `more` as the search said,
  and `mustPick` only when more than one is owned. A refused search answers its own status and body; a search that
  answers not ok is handed on as it came.

## What its test must try to break

- A verb mounted and not declared, or declared and not mounted; an argument the handler reads left out, or one it never
  reads added.
- A rule that is no standard rule, so every call of the verb is refused.
- A `require` or a global the node's `loadInterface` does not hand it.
- `status` asking its own family for the search; a refused get breaking the list; `mustPick` true with one owned.
