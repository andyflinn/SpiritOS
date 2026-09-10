# Connecting one device per entry on the allowList of a relay

right now there's a path on spirit.andyflinn.com called **/device/**. My question is: **What if, instead, there was a "spiritual" one for every label stored in the allow list?** like spirit-3/andy and spirit-3/bert.... 

## My immediate thoughs....

1. The first rat i smell: it would have be an "escaped" version of every members public key where the "escaped" string of the "spiritual" is compatible with any filing system.

2. Every ID allowed on a public relay would be the option to "hook up" one mobile device of their own to that relay.

3. Every ID allowed on that public relay would get the exact same interface for "Add one of my own devices".

feasibility? thoughts?

---

# Notes on feasibility — Claude, 2026-09-10

Read against the tree at `756013b`. Andy's text above is untouched.

## First, the premise needs correcting — and it changes the shape

> *"every label stored in the allow list"*

**`allow.json` in keys mode holds exactly one row: the owner.**
`ownerName()` is literally `Object.keys(byName)[0]`
([relayAuth.js:315](spirit/run/js/relayAuth.js#L315)), and `inbox()` says it in
prose: *"the allow list, which in keys mode is the owner and nobody else."*

Bert is **not** in the allow list. He is a row in `peers`, keyed by his public
key, with his own key on it. That is the two-rung model the device design
already ran into:

| rung | where it lives | what it can do |
|---|---|---|
| **owner** | the one `allow.json` row | send, read, and the whole console |
| **peer** | a `peers` row + its own key | send, read its own mail, and `help` / `whoami` |

So the idea is not *"one page per allow entry"* — there is only ever one of
those, and it already has `/device`. It is **one page per peer**, which is a
bigger and more interesting thing.

## The shape, in Andy's words

> *"conceptually the `/device/` path must stay, and the feature creates a
> **similar** sandbox for the non-owners?"*

**Yes to the path, and it stays a single one — not `/device/<label>`.** The
identity travels in the POST body beside the password (see below), so there is
one page, one route, and nothing about who is on this relay in the address bar.

A second reason to keep it single, which only shows up in practice: **Chrome
keys saved passwords by ORIGIN, not by path.** `/device` and `/device/bert`
land in the same bucket, so splitting the URL buys the password manager
nothing — and the manager is the whole distribution story.

**But "creates a sandbox" is the part worth restating: it doesn't create one.**

The sandbox is the peer row, and it has existed since peer-by-key:

- `inbox()` hands back only what is addressed to that row — matched on its
  label *and* its key
- `send` proves the signer against that row's key before anything is stamped
- the console partitions on `isOwner`, decided from `allow.json`

So enrolling a device **does not build a new enclosure. It lets a second key
stand in one that was already there.** That is exactly what cycles 1–5 did for
the owner: no new rung, no new authority, one more key on a record that already
described a party.

Which is why the feature is cheap where it is cheap and empty where it is
empty — *same walls, different furniture*. The owner's room has the console in
it. A peer's room has their mail, and two words.

### Is a peer's sandbox *subordinate* to the owner's?

Subordinate **in existence**, not **in access** — and the difference is the
whole safety argument.

| | owner over a peer |
|---|---|
| decides the peer exists at all | **yes** — every peer arrived through a minted invite |
| sees the peer in the census | **yes** — `peers`, `status`, `search` |
| can read the peer's mail | **no** |
| can send as the peer | **no** |
| gates the peer's device enrolment | **no** |

`inbox('bert')` proves against **bert's own peer-row key** (`checkInboxKey`), and
the house key does not verify it. The owner's key opens the owner's mailbox and
the console, and nothing else. So the rooms are **siblings, not nested**: one of
them holds the keys to the building, and still cannot open the other door.

The same for enrolment. Bert's device would be answered by *bert's* personal
node, comparing *bert's* password, during *bert's* listening window. The owner's
window has nothing to do with it. Which is the honest reason this scales at all
— it does not put the owner in the path of everyone else's logins.

And the reassuring corollary: **a peer's device can never become an owner's.**
`isOwner` is decided from `allow.json`, which holds one row, and no enrolment
writes to it except the owner's own. A stolen peer device is bounded by that
peer's row, exactly as a stolen peer key already is. The feature adds keys; it
adds no rungs.

### What the relay is actually providing: a rendezvous

Stated plainly, because it is what makes the whole feature generalise:
**each peer is connecting their own devices to their own personal node.** The
relay is not granting anything.

A personal node is loopback-only and sends no CORS grant, so a browser on a
phone can never reach it — not over the LAN, not from anywhere. That single
fact is the entire reason this dance exists. The relay lends the one thing a
personal node lacks: **a public address both sides can reach.**

What it does in that role is deliberately almost nothing:

- holds a password **it cannot check** in RAM, for at most 25 seconds
- hands it to whoever proves they own that identity
- writes down the answer it is given

Every decision is made at the far end, on the node that owns the password. So
the feature is not *"the relay hands out devices"* — it is *"a node becomes
reachable by its own browser, using a public address it already has a mailbox
at."* Which is exactly why extending it from one identity to all of them costs
so little in principle: the relay is routing, not granting.

**And the same gap repeats one rung down.** A peer's device key would be
installed on the peer row of *one* mailbox. A peer with mailboxes on two relays
enrols twice — the identical fan-out question the owner's version has, with the
identical answer: it does not bite until there is a second relay.

### So the path shape should not be a hierarchy either

If subordination is only about existence, the URL should not imply more:
`/device/<key>` for **everyone, the owner included**. The owner already has a
peer row from first claim, so their page needs no special case — the difference
in what the page can *do* comes from `isOwner` at the relay, not from which
address was visited.

One page, one rule, and the bare `/device` kept only as it is today or retired
once the keyed form exists.

### One word, because it changes what to search for

`DICTIONARY.md`: *"**Allow list** — allow.json — Who **may** claim/send. Not
the same as who has claimed (`mailbox.json`)."*

So the people in this proposal are not "non-owners in the allow list" — in keys
mode the allow list has exactly one name in it, the owner's. They are the
**claimed peers**, in `mailbox.json`. Worth using the narrower word, because
"add a device for everyone in the allow list" describes a feature with one user
and this one has all of them.

## The rat you smelled is the right one (correcting an earlier note here)

> *"an 'escaped' version of every members public key … compatible with any
> filing system"*

An earlier draft of these notes said the URL could just carry the label and no
escaping was needed. **Andy: labels may be duplicate, public keys are unique.**
That is the whole reason the thought went to keys in the first place, and it is
right — the two halves are one problem, not two.

`findByLabel` returns `null` when a label has more than one holder, and
`resolveParty` answers `{ambiguous: true}`. Two johns is two keys and one word.
So `/device/john` has no single answer the moment a second john exists, and the
unique thing — the key — is the only identifier that always resolves.

### Escaping a key is already solved in this tree

`peerFile.js` names a peer's file `peerfile-<hex-of-key>.json`, precisely so a
key can be a filename. Hex is safe in a path and in a URL with no escaping
scheme at all. Base64 is not — SPKI base64 carries `+`, `/` and `=`, and a `/`
inside a path segment is fatal. So if a key goes in a URL, hex is the answer
the codebase already gave, and it costs length: **88 hex characters** for a
44-byte SPKI key.

Never typed, but on a phone it is also never *read* — which matters, because
the one thing a person needs to check before typing a password into a page is
that they are on the right page.

### But the identity does not have to be in the PATH

The owner's `/device` carries no identity at all today. The POST body does:
`{password, devicePublicKey}`, and the personal node decides who it is by
**recognising its own password**. Identity is proved by the secret, not
announced by the URL.

Which means the member version needs one more field in the body, not a new URL
shape — and that field already exists on the page. The username box put there
for Chrome's benefit currently holds the constant `spirit-device`. For members
it becomes the **real** one: the person's label, filled by them, remembered by
their own password manager, alongside their own password.

One URL. No escaping. No key in the address bar.

### The security reason identity has to be in the request at all

Not cosmetic. `devicePending` hands back `{password, devicePublicKey}` — the
password somebody is *trying*. If every member's node polled one shared slot,
every member would read every other member's enrolment password on the way
past.

So the slot must be addressed per identity, and `devicePending` must answer
only the key that owns that identity. That is the same rule as today, one rung
down — and it is why the label cannot simply be left out.

### Where duplicates still bite, and the answer this app already has

With the label in the body rather than the path, ambiguity moves but does not
vanish: two berts polling "bert" is still two keys and one word.

Three ways out, in increasing cost:

1. **Refuse an ambiguous label for enrolment** — `not now`, like every other
   refusal on that route. Cheap, honest, and duplicates are rare on a mailbox
   whose owner mints every invite.
2. **Label plus key tail** — `bert · lcaro=`. This is exactly what Contacts
   already does when a handle is ambiguous, and what `keyTail` exists for: all
   Ed25519 SPKI share the `MCowBQYDK2VwAyEA` prefix, so the tail is where the
   human-usable difference lives. One consistent answer to one recurring
   problem, rather than a second convention.
3. **The full hex key** — unique, unambiguous, unreadable.

(2) is the one that matches how the rest of the system already talks about
people, and it keeps the field autofillable.

## Point 3 is the strongest part — and it hides the catch

> *"the exact same interface"*

The **enrolment** half is already generic. `/device` posts a password and a
public key and prints whatever comes back; nothing on that page is
owner-specific except the `name` returned by the yes, which a
`/device/<label>` route would already know from the URL.

What is **not** generic is what sits behind the enrolment. The console gates on
`isOwner` ([relayConsole.js:67](spirit/run/js/relayConsole.js#L67)):

```
owner :  status  peers  search  invites  key  version  + help  whoami
peer  :  help  whoami
```

**Two words, and one of them tells you your own name.** So bert enrols his
phone, gets the same handsome page, types `help`, and is told he may type
`whoami`. The interface is identical and the thing behind it is empty.

That is the question this design has to answer before any of it is built:
**what is bert's phone FOR?** Not the console — he has nothing to run there.
What he actually wants is his mail: read what was sent to him, send a reply.
That is a chat client, and it is the piece that has been out of scope in every
device cycle so far (`whoBook`/roster on a handheld). Bert's device is only
worth building at the same time as that.

## What it would take, mechanically

Every link is a modification of something that exists — no new invention —
but there are more links than the page suggests.

1. **A second key on a peer row.** Exactly what cycles 1–2 did for the owner,
   one rung down: `peers[bert].devicePublicKey`, and `inbox()` / `send()`
   accepting either key. The gates already learned "either key" for the owner,
   so this is the same edit in the same places.
2. **`devicePending` gated per label.** Today it verifies against the **house**
   key and refuses anyone else — deliberately, because the slot holds a
   password somebody is trying. It would have to become "the key that owns
   *this* label", and it must never hand bert's slot to andy.
3. **A slot per label.** `deviceHandshake.createQueue()` has one `pending`
   ([deviceHandshake.js:15](spirit/run/js/deviceHandshake.js#L15)) and one
   rate bucket of 10/min for the whole box. With members, one person enrolling
   — or one person hammering — blocks everyone.
4. **Bert's node has to poll.** The tick's URL list comes from
   `ownerBadge.probe` → `ownedUrls`, and bert does not *own* spirit-3. He needs
   "relays I hold a claim on", which is a different question than the badge
   currently asks.
5. **`set-device` for a peer row**, signed by bert's peer key rather than the
   house key.

None of that is hard. All of it is surface, and surface on the one box that
faces the internet.

## The part that isn't technical

Today the relay hosts other people's *mail*. This would make it host other
people's *sessions*: their enrolment windows, their pending passwords, their
device keys, their support problems when a phone stops working. `AGENT.md` says
one operator — that stays true, you still run the box — but the box acquires
users in a way it does not have today.

Worth deciding on purpose rather than discovering when the second person asks
why their tablet says `not now`.

## Amendment — the shell has to hand over the address (Andy)

> *"The shell interface must include a link `<a href="https://spirit.andyflinn.com/
> <escaped-user-publickey>/">Install the device here</a>`, opening a new
> window/tab, so the user is easily led to the appropriate path."*

This is a real constraint and it **reopens the path question above**, because
the link and the URL shape are one decision, not two:

| identity lives in | URL | how a person reaches it |
|---|---|---|
| the POST body | `…/device` — short, typeable, memorable | typed, or a link |
| the path | `…/device/<88 hex chars>` | **link only** — nobody types that |

So: if the shell is handing over a link anyway, the length costs nothing, and a
pre-addressed URL removes a field the person would otherwise have to fill in
correctly. That is a genuine argument for the path form, and it is stronger
than the one I made against it — **the objection to a long URL was that nobody
can type it, and a link means nobody has to.**

What it buys, plainly: the person never states who they are. The address does.

### The new tab is properly isolated, and that isolation is load-bearing

Andy: *"an html anchor can target a window, to protect the shell interface, and
the new tab is a normal browser tab with a different CORS context."*

Correct, and stronger than "protection" suggests — the isolation is not a
precaution bolted on, it is **why this page can exist on the relay at all**:

- The tab is a **separate origin**: `https://spirit.andyflinn.com` against the
  shell's `http://localhost:65432`. Same-origin policy already stops each from
  reading the other's DOM or storage.
- On that origin, the page's `fetch('/api/relay/device')` is **same-origin**,
  which is the only reason it works without the relay ever sending
  `Access-Control-Allow-Origin`.
- And it **cannot reach the personal node**. `/api/hub/*` is loopback-bound and
  grants no CORS, so the enrol page — a public page, served to anyone — has no
  path to the password, the whoBook, or anything else at home. It can only
  offer a password and be told yes or no.
- `target="_blank"` implies `noopener` in every current browser (Chrome 88+,
  Firefox 79+, Safari 12.1+), so the new tab holds no handle back. Writing
  `rel="noopener"` is then belt-and-braces rather than a fix — cheap, and worth
  it on this page of all pages.

So the sandbox the browser gives here lines up exactly with the sandbox the
architecture wants: the relay's page speaks to the relay, and to nothing else.

### What the desktop click is actually for (Andy — this supersedes my objection)

An earlier draft of this note called the link a catch: it opens on *this*
computer, so it enrols the desktop rather than the phone. That reading missed
the purpose.

> *"The purpose of this link to a browser tab on **this** computer is this
> only: to implicitly register the **password** with Chrome's/Google's password
> manager, making it easy for me to then switch."*

**Enrolling the desktop is the side effect. The saved credential is the point.**
Submitting the form on the desktop is what makes Chrome store

```
origin    https://spirit.andyflinn.com
username  spirit-device
password  <the 128 characters>
```

and sync it. The handheld never has to receive the password at all — it already
has it, the moment it opens that origin.

And this is exactly **why it has to be a link rather than an address to type**:
the credential is saved against the ORIGIN the browser actually visited. Type it
slightly wrong and Chrome saves it against the wrong origin, where nothing will
ever offer it back. The link is what guarantees the save lands where the phone
will look.

### Which also disposes of the QR idea

The remaining worry about a long per-key path was that nobody can navigate to
88 hex characters on a phone. But Chrome syncs **history** as well as passwords:
after the desktop visit, a few letters in the phone's address bar suggest that
exact URL. Password and address arrive by the same road, and the road is one
Andy already relies on.

So: no QR, no copy-link, no transport step. Two presses on the desktop, then
the phone recognises the site and fills the box.

### The name field: hidden, and holding the public label (Andy)

> *"The content of this field can be the user's public label: it allows me to
> see in the password manager which password to pick for the password field —
> I run multiple accounts within the scope of https://andyflinn.com."*

This is the actual job of that field, and it is not the one an earlier draft
here gave it. The constant `spirit-device` distinguishes this credential from
the other logins on the domain — it does **not** distinguish Andy's accounts
from each other, and Chrome groups credentials across `andyflinn.com` and its
subdomains, so several of them sit in one picker. A constant makes them all
read the same. **The public label is what tells them apart at the moment of
choosing.**

Hidden rather than shown, because it is not a question: the page already knows
who it is for, and a field nobody may edit is not a field.

### These three are one decision, not three

The label in the name field only works if the page knows the label **before**
anything is submitted. That is precisely what the per-key path buys:

```
/device/<hex key>   →  page resolves the label  →  name field filled
                                                →  manager shows "andy"
                                                →  right password, first time
```

In the body form the person types their own label, so it cannot be pre-filled
and cannot be hidden. So: **path form ⇒ pre-filled label ⇒ hidden field ⇒ a
password picker you can read.** Take the path away and all three go.

Resolving the label costs nothing new: `/api/relay/who` is already public and
returns `{ name, publicLabel, publicKey }` for every peer, so the page finds its
own row by matching the key from its URL. No server-side templating, no new
route.

**One thing to verify rather than assume**: password managers are choosier about
hidden username fields than visible ones, and `display:none` is the form that
gets ignored most often. The documented pattern is the `hidden` attribute with
`autocomplete="username"`. Since this whole design rests on the manager
behaving, it is worth one check on the real phone — the same five minutes that
settled Ed25519.

### One wrinkle, and it is an ordering rule

There is **one device slot**, and a successful desktop submission takes it.
Then the phone enrols and displaces the desktop — which is correct and intended
(`deviceDisplace` proves it), but it means:

> **Teach Chrome on the desktop first, then enrol the phone.** Doing the desktop
> step again later kicks the phone out.

Worth one line in the panel, because "I re-copied the password and my phone
stopped working" is otherwise a puzzle with no visible cause.

The desktop submission also needs the listening window open, exactly like any
other enrolment — which is free, since the same panel opened it.

### `/<key>/device` or `/device/<key>`?

Both work. They buy different things, and the choice is really a bet on how
many per-peer pages there will eventually be.

**Identity-first — `/<key>/device`** — the orthogonal one. Its concrete payoff
today is not tidiness, it is **relative links**: from `/<key>/device`, a plain
`<a href="chat">` lands on `/<key>/chat`, and every page in that namespace stays
inside the peer's world without ever writing the key out again. If a handheld
eventually gets chat, a console and settings, that is worth real money.

**Feature-first — `/device/<key>`** — keeps a property this codebase has
deliberately: **the first path segment is a closed, readable set.**
`isRelayPublicPath` is a literal list today, and its value is that you can read
it and know the entire answerable surface of the box. Identity-first opens the
first segment to anything, and moves the closed set one level down. Still
auditable — a strict `^[0-9a-f]{88}$` test cannot collide with `api`, `device`,
`relay.html` or `favicon.svg` — but "what can this host answer?" stops being a
question you settle by reading a list.

Two smaller ones, both mild:

- **Caddy.** It proxies everything today, so this costs nothing now. If path
  rules are ever wanted, `/device/*` is a simpler matcher than `/*/device`.
- **Legibility.** Expanded in an address bar, `…/device/9f3a2b…` says what the
  page is before it says who it is for. `…/9f3a2b…/device` makes you read to the
  end. Minor, but this design is phone-facing and it asks people to check the
  address before typing a password into it.

Nothing else separates them: same origin either way, so the password manager,
`sessionStorage` and CORS behave identically.

**Recommendation: `/device/<key>` unless more per-peer pages are actually
coming.** One page does not need a namespace, and the closed first segment is a
property worth keeping until something needs it spent. The day a second per-peer
page appears, identity-first becomes right — and the move is a redirect, not a
redesign, because nothing else in the system reads these URLs.

### Two details, if the path form wins

**Keep a `/device/` prefix — do not put a key at the root.** `…/<key>/` would
collide with every other route the relay serves (`/api/…`, `/relay.html`,
`/favicon.svg`, `/`), and `isRelayPublicPath` would have to guess whether an
unknown first segment is a key or a typo. `…/device/<key>` keeps the allowlist
a list.

**`rel="noopener"`** — already the default behaviour of `target="_blank"` in
current browsers, so this is belt-and-braces. Written anyway: one attribute,
and the shell is the last page to be casual with.

### Which way to go

If this feature is built at all, **the path form with a link is the better
shape** — for the reason Andy gives: the interface can hand over the whole
address, and an address that names its own subject cannot be filled in wrongly.
The body form only wins while the URL is short enough to type, which is only
true while the owner is the only user.

Neither is urgent. Both stay available.

## The philosophy underneath: a peer builds a different stack on the same kernel

The proposition: a per-peer namespace lets a peer develop *a completely
different application stack* over the same SpiritOS substrate.

That is right, and it splits into two versions with very different prices. One
of them already shipped.

### Version A — same protocol, foreign client. Costs nothing. Already true.

What actually crosses the wire is four signed messages and an envelope:

```
claim\n<name>
send\n<from>\n<to>\n<text>
inbox\n<name>\n<unix-minute>
status\n<name>
```

plus `packet.js`, whose entire design is that **the envelope lives inside
`text`** — so a relay stores and returns it without knowing what it is, and
apps can be renamed or replaced without a relay update or version skew.

That is the whole contract. Anything that can Ed25519-sign those strings and
speak three routes **is** a SpiritOS peer. Not "can talk to one" — *is* one. The
kernel, the shell, `app/<name>/<name>.js`, the whole local arrangement, is a
convenience for building clients, not a condition of being one.

And this is not theory. `device.html` is **215 lines of plain HTML and vanilla
JS**, no kernel, no shell, no build step — and it enrols, signs, sends, and runs
the console. A second, independent client stack already exists in this repo, and
it was written as a side effect of a login form.

So a peer wanting a different stack needs no permission and no namespace. They
need the message formats, which are four one-line functions.

### Version B — the relay hosts the peer's pages under `/<key>/`. Different animal.

Here the namespace is not routing, it is **hosting other people's code**, and
one fact governs everything:

> **A path is not a security boundary. An origin is.**

Origin is scheme + host + port. Path is not in it. So every page served under
`https://relay/<anyone>/…` shares one origin with `/device`, with `/api/relay/*`,
and with every other peer's pages. Which means peer-supplied script could read
another peer's `sessionStorage` — including the device private key — and call
the relay's API as a same-origin caller. The namespace would look like
separation and provide none.

The real fix is well-trodden and it is not paths: **an origin per peer**, i.e.
`<key>.relay-host`, with wildcard DNS and a wildcard or on-demand certificate.
Caddy does this comfortably. But it turns the mailbox into a hosting provider,
with everything that implies — content it did not write, served under its own
name, on a 1 GB box that currently has one operator.

### Which one the philosophy actually wants

Version A, almost certainly. It already delivers the goal — *anyone may build a
different stack on the same substrate* — and it delivers it **more** completely,
because a client built that way is not confined to a namespace on somebody
else's machine. It runs wherever its author wants and speaks the same four
messages.

Version B only becomes interesting if the goal shifts from *"peers may build"*
to *"peers need somewhere to put it"*. That is a hosting product, and it should
be decided as one rather than arrived at by extending a URL.

**Which also settles the URL question above, and lowers its stakes.** Under
Version A the relay serves one enrolment page and nothing else per peer, so
there is no namespace to be orthogonal about — `/device/<key>` is enough, and
`/<key>/device` buys a tidiness with no second page to spend it on.

## Verdict

**Feasible, and the architecture is already shaped for it** — the two-rung
model means a peer device is the owner device one rung down, and the "spiritual
per label" turns out not to need a per-label URL at all: the identity belongs
in the POST body beside the password, where the page already has a field for it.

**But it delivers almost nothing until the handheld can read mail.** Build
bert's enrolment and he gets a two-word console. Build the chat client first
and bert's enrolment becomes obviously worth it — and by then you will also
know whether perception (`whoBook`, captions, marks) syncs to a device or
whether a handheld is permanently the poorer client, which is the same open
question from the 2026-09-10 review.

Cheapest next step if you want to keep the option open: nothing. The label in
the URL and the second-key-on-a-row pattern both stay available, and neither
gets harder by waiting.
