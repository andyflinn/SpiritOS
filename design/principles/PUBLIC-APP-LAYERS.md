# The layers — a node, its one app, and what it declares

**Drawn 2026-09-24 from `4b51f33`**, during the design sitting recorded in
[`design/shell/PUBLIC-APP-SERVER.md`](../shell/PUBLIC-APP-SERVER.md).
Illustration only: nothing here is built, and the boxes that do not exist
yet are marked.

The argument is in that document. This one is the picture.

**This is overall code and network architecture, not one operator's
notes** — it sits under `principles/` for that reason. Nothing in it is
specific to a person, a domain or a box: every name below is a role, and
the one worked example is marked as one.

---

## 1. The model

One sentence, and the tree already uses the words:
*"an intrinsic app is what this node IS"*
([shell.js:478](../../spirit/run/js/client/shell.js#L478)).

```
a node
  └── serves exactly ONE intrinsic app
        ├── personal node      → the shell      ← an app whose job is to fan out
        ├── public app node    → join           ← an app whose job is one thing   ‹not built›
        └── relay              → relay.html
                                 device.html    ← already two, ad-hoc
```

**The shell is an instance of this, not an exception to it** — and it is
not one yet. `AGENT.md:72`: *"Target: every app will live at
`app/<appName>/<appName>.js` plus sibling manifest. Today nine ids still
live in `index.html`."* The design is shaped by the unification and does
not require that move.

---

## 2. The two layers

```
                    ┌─────────────────────────────────────────────┐
                    │  app-utils-and-dialogs        ‹OPTIONAL›     │
                    │    the look       12px rhythm · two sizes    │
                    │                   :empty collapses          │
                    │    elements       painting only, never      │
                    │                   deciding                  │
                    │    dialogs        AND the rule that         │
                    │                   governs them              │
                    └─────────────────────────────────────────────┘
                                        ▲
                                        │  take it, or don't
                                        │
  ┌───────────────────────────────────────────────────────────────┐
  │  configuration-basics                           ‹REQUIRED›    │
  │    the door      ask(verb, args) → POST /api/spirit           │
  │    the jail      fsPath · canonicalPath · isWithinWritableRoot│
  │    the bounds    measure · ceilings · defaults · the divisor  │
  │    the unit      MemoryMax · Restart · remote reconfiguration │
  │    the contract  app/<name>/<name>.js + sibling manifest      │
  └───────────────────────────────────────────────────────────────┘
```

**Fanning is not in either, and that is the point.** It is the shell
app's own job — which follows from a node serving one intrinsic app. The
sibling layers `shell-basics` / `public-app-basics` dissolved here: what
distinguishes the shell from `join` is how much of the optional layer it
takes, plus what its own app does.

**The dialog rule travels with the dialogs.** One result slot, *"a dialog
can only return"*
([shell.js:1289](../../spirit/run/js/client/shell.js#L1289)). Moving the
painting alone would leave the rule behind with no shell to enforce it;
in the optional layer, taking the dialogs takes the rule.

---

## 3. Siblings — who takes what

```
app/
  ├── shell/          the fanning app   ── both layers, plus dispatch
  │     └── hosts ──→ contacts/ natter/ files/ jobs/ …
  │                   (shell apps: hosted by the shell, not by a node)
  │
  ├── join/           a public app      ── configuration-basics            ‹not built›
  │                                        + as much painting as it wants
  │
  └── device/?        already exists as device.html, owned by nobody
```

`join` is a **sibling** of the shell, not a child of it — Andy,
2026-09-24 — because apps belong to the **node**, and the shell is merely
the one whose job is to fan out to others.

**And an app owns the inside of its own folder.** The platform fixes the
contract — entry point, sibling manifest, which of `api.*` is available —
and fixes nothing below it. `app/<name>/` is already both code and data:
*"Writable roots for saveFile/deleteFile — `app/` (per-app data)…"*
([kernel.js:171](../../spirit/run/js/kernel.js#L171)).

---

## 4. The plugin pattern — mechanism inherited, declaration plugged in

The organising principle, and the tree already proves it **one level
down**: an app is a folder plus a manifest of pure data — `name`,
`description`, `icon`, `hidden`, `intrinsic`, `owner`. No behaviour. What
is missing is the same discipline one level up, for node types.

```
  MECHANISM  (shared, configuration-basics)   ←── DECLARATION  (the type's, DATA ONLY)

  measure · ceilings · defaults               ←── what a megabyte buys me,
  the divisor · the re-cap                        and how greedy I am

  fsPath · canonicalPath                      ←── my writable scope
  isWithinWritableRoot                            (a CLOSED set, validated)
  app-script + manifest locks

  the whole layer                             ←── which app I serve
```

**A declaration is data, never code.** If a type could plug in
*behaviour*, the mechanism forks again — later, and less visibly than the
three forks below did. Because it is data, the set can be **closed**, it
can be **validated at load**, and it can be **asserted** without running
anything.

**And it is the test for "is this reusable or host-specific":**

```
  does the mechanism need to know WHO IS ASKING?
        │
        ├── yes ──→ it belongs to whoever HAS that fact   (a host concern)
        └── no  ──→ configuration-basics
```

Path protection fails that test inside the shell for a precise reason,
and passes on a one-app node — see §6.

---

## 5. Why the layer exists: three forks, all from one cause

Things built for the relay that turned out to be general, because the
relay was the only second citizen. `join` is the third, and surfaced all
of them in one evening.

```
  bash/lib.sh          unit infrastructure     ── named for relays
                       (SPIRIT_UNIT_NAME, SPIRIT_UNIT_TEMPLATE, …)

  relayLimits.js       pure box arithmetic     ── named for relays
                       every "relay" in it is in a COMMENT, none in logic

  ask(verb, args)      the door call           ── owned by nobody
       ├── kernel.js:642            spirit.core.ask
       ├── testSupport.browserAsk   a copy taking its own fetch
       └── device.html:375          raw fetch, bypassing both
```

**And one latent defect from the same root.** The defaults assume *"an
environment where relay is the only server (safety overhead)"* and say so
twice ([relayLimits.js:8](../../spirit/run/js/relayLimits.js#L8), `:25`).
That stopped being true when `lab-install` made a second unit possible.

```
  one box, two units, both taking the default

    unit A   half of total   ──┐
    unit B   half of total   ──┴──→  the WHOLE box, no OS margin

  and the ceiling does not catch it:
    MemoryMax is a CAP, not a CONSUMPTION
    → whichever boots second measures a box that looks empty
```

Not triggered yet only because both units on that box are explicitly
configured.

---

## 6. The one-app node makes enforceable what the shell can only declare

```
  THE SHELL                                  A ONE-APP NODE
  one page, one origin, N apps               one app, and the node knows which

  createScopedFs('natter')                   the same machinery,
    → prefixes app/natter/ in the BROWSER      a narrower root
                                             → app/join/ is a real jail
  the request reaching the node:
    saveFile(body.path, body.content)
    ── a path, and nothing else

  "nothing server-side can verify which
   app is really asking, only whether
   the path itself is allowed"
```

[kernel.js:758](../../spirit/run/js/kernel.js#L758),
[server.js:432](../../spirit/run/js/server.js#L432), and the quotation is
kernel.js's own at `:240`.

So the server enforces *inside `app/`*, **not** *inside
`app/<thisapp>/`*. The public app is not the weaker sibling needing the
shell's protections extended to it — **it is the case where the
protection the shell wants becomes enforceable for free.**

---

## 7. The box — deployment, which is a different axis

```
  one VPS
    ├── spirit-relay.service   --relay   :65430   spirit.<domain>
    ├── spirit-???.service     --<mode>  :65431   join.<domain>        ‹not built›
    └── spirit-lab.service     --relay   :65420   lab.<domain>
          │
          ├── one unit template, __MODE__ the only relay-specific line today
          ├── one ./bash/, already parameterised by SPIRIT_UNIT_NAME …
          ├── one Caddy file each — "a third relay costs a file and nothing else"
          └── resources divided by DECLARED APPETITE, never headcount
                └── adding a unit RE-DIVIDES, and re-caps the others
```

**Publicness lives here, not in the layers** — a Caddy block, a
whitelist, `noindex`, a DNS record. The same app on loopback is the same
app. *(Open: whether that makes "public app server" the wrong name for
the module.)*

**And the owner's diligence is not the mechanism.** Cycle 9's standard
was measured defaults — *"No relay ever runs on an implicit figure"* was
answered by the box, not by the operator. Diligence is for **overriding**,
never for being correct.

---

## 8. The bind — forced, not chosen

```
  1  owner node    exists, has an identity          ← it is the claimant
  2  relay         installed, UNCLAIMED             ← install.js mints the
                   owner invite over SSH              owner invite
  3  owner node    claims → becomeOwner              ← ownerKey is "" until
                   allow.mode = keys                   this instant
  4  owner node    hand-mints ONE seat               ← only an owner may mint
  5  public node   claims it → member                ← a relay routes between
                                                        members
  6  public node   asks its relay for ownerKey       ← nothing to bind to
                   and binds                            before 3
```

[relay.js:1586](../../spirit/run/js/relay.js#L1586),
[:1575](../../spirit/run/js/relay.js#L1575),
[:1763](../../spirit/run/js/relay.js#L1763),
[:1050](../../spirit/run/js/relay.js#L1050).

**Installed together; cannot be initialised together.** 1–3 are a human
with SSH. **A public app server that boots before step 3 waits — it does
not fail.** It has a relay, no owner, and nothing wrong.

And it removes the last hardcoded thing: a public app server cannot be
*configured* with an owner, only *learn* one. No domain and no owner key
in the tree.

---

## 9. What is still open

```
  ?  which part of api.* may a standalone app rely on
       └── the shell hands apps ui.elements, readProject, onFiles, fs …
           (shell.js:1469-1495). A public app server has no shell,
           so it provides a SUBSET — and that subset IS the template.
           The folder layout falls out of it.          ← the first deliverable

  ?  is "public" the architectural axis, or only deployment (§7)

  ?  how remote resource configuration reaches the cap
       └── the figure and the MemoryMax that enforces it have two
           writers, and only one of them is remote

  ?  where "what else this box runs" is read from
       └── declared up front, or observed and re-capped
```

The recommendations for the last two are in
[`PUBLIC-APP-SERVER.md`](../shell/PUBLIC-APP-SERVER.md); neither is
decided.
