# One object, three densities

Designed 2026-09-16, verified against `967d294`. **Nothing built.** This is
the source material for a future `UI_DESIGN_STYLE.md` §11 — that document is
Andy's, enforced by section number in ~20 tests, and is not amended from
here without his word.

## The gap

`UI_DESIGN_STYLE.md` decides **fragments**: a row (§4), a label (§5), a
control (§9), a machine value (§6). It has no section on an **object**. And:

> The words *"description"* and *"tooltip"* appear **zero times** in it.

Meanwhile `title=` is already used ad-hoc in six apps — presence state,
lapsed invites, show/hide, contact cards — under no rule at all. So the
one area with no standard is the area about to receive the most new
surface, which is the thing worth being nervous about:

> **Andy:** *"I'm just trying to be more and more strict about consistency,
> before the system gets loaded with a million little apps and options."*

## Every object carries two fields, and they have different authors

> **Label is what it calls itself. Description is what you say about it.**

Counted in the tree: 13 of 14 apps carry a description; processes carry one
(`imageCaptionClaude.json` — label, description, `args`); **relays carry
`label` + `url` and nothing else; peers and groups carry none.**

The line is authorship, not importance. Everything with a *manifest*
describes itself, because you wrote the manifest. Everything in a *store*
does not, because the system minted the row.

Which is why the missing field is not simply missing. A peer cannot
describe itself the way a process does — a peer is somebody else. R1
already split that for labels (public label = their word; invite label =
yours), and descriptions generalise it: for a process or app one author
writes both, for a peer or relay the label is theirs and the description is
yours. Same two fields everywhere, asymmetry already decided.

The wire half — a peer's *own* public description, held by its home relay —
is `design/relay/PARTNERS.md`, tier three.

## The three densities

> **Andy:** *"drop-down selectors are for (ideally) icon + label, the Job
> Selector is a wider concept... when it comes to tooltips, object
> descriptions really can haul a lot of cargo."*

| density | carries | example in tree |
|---|---|---|
| **dropdown** | icon + label | `createIconSelector` |
| **selector surface** | icon + label + description + search | Job Selector |
| **tooltip** | description alone | `title=`, six apps, no rule |

The object supplies the same fields everywhere; **where it renders picks
the density.** That is §4's own principle — *style by what a thing IS,
never by a list of the ids that happen to be it* — lifted from rows to
objects.

Job Selector is the worked example, and what it does is two separable moves:

1. **Convention discovers** — it reads no registry, it filters files
   matching `process/<lang>/<name>/<name>.*`
   ([process-browser.js:64](../../spirit/run/app/process-browser/process-browser.js#L64)).
2. **The sidecar describes** — label, description, and the `args` that
   would drive a dialog.

A shell support function needs only the second. Given any list of
`{icon, label, description}` it paints a searchable picker, and it does not
care whether the rows came from disk discovery, `peer.search` across a
partner relay, or a group list.

## Two traps, written down before anything is built on them

**A tooltip does not exist on touch, and §10 aims at a small portrait
screen.** If a description's only home is `title=`, the cargo is invisible
to half the users — and invisible specifically in whichever app loaded the
most of it.

> A description must have a non-hover home. The tooltip is a desktop echo
> of it, never the sole carrier.

**§2 says fine print lives at the bottom**, and the open-questions list
already convicts `.job-manifest-note` of being fine print mid-page. A
tooltip is arguably the *resolution* of that tension rather than a
violation: description as fine print that appears on demand instead of
spending page height. Better decided on purpose than settled by whichever
app does it first.

## What the row may contain is a data rule, not only a presentation one

From tier three, and it belongs here too:

> **What survives being multiplied by 32?**

A boolean earns a seat in a list row; prose does not. Density is not only
how a thing is painted — it is which fields the row is **allowed** to hold.
Everything else arrives by id, on selection.

## Precedent already in the stylesheet

`.icon-selector-rows` is one of exactly **two** elements in the whole
stylesheet that scope their own overflow. The existing icon selector is
already the worked example of *a selector surface owns its scroll*, which
is the rule the standing open question about sideways scrolling is
circling.

## Open

- **Does the dropdown density need description at all, or only on the
  selected row?** Andy: *"display or even tooltip the selected peer"* —
  which suggests the selected row is the one place a compact control shows
  prose.
- **Icon for objects that have none.** Apps and processes declare one;
  peers and relays do not. A peer picker at icon+label has an empty first
  column unless something supplies a default.
- **13px.** Already open in `UI_DESIGN_STYLE.md`; a description line is
  another caller for whatever that resolves to.
