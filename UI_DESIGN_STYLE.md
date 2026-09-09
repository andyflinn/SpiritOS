# UI_DESIGN_STYLE.md — how the spirit shell looks and why

Working notes, not a spec. A rule lands here **after** it has been decided on a real screen; the open questions at the bottom are the ones the tree currently contradicts itself about. If you are about to invent a size, a gap or a control, look here first — and if you invent a new one anyway, write down what it is for.

`AGENT.md` owns the product rules. This file owns the look. Where they overlap (chrome that is not useful), `AGENT.md` wins and this file points at it.

---

## 1. Show only what can do something

Stated in `AGENT.md`; repeated here because it is the rule that decides more layouts than any other. **Prefer not building it over hiding it.** A control whose every value would be refused, a form for a capability this node does not have, a field asking a question already answered — each is a thing to read, decide about and dismiss, and together they are what makes a screen read as a debug console instead of an app.

Where it already applies:

| screen | absent, not disabled |
|---|---|
| Relay Chat, unbound | the To bar, the list, the thread, the composer, the invite slot |
| Relay Chat, no contacts | the thread and the composer — nothing selectable to write to |
| Relay Chat, owns no mailbox | the whole invite panel; not built, not hidden |
| Viewers, unhandled extension | the Open with control, and it collapses its margin too |
| Apps panel, intrinsic app | no name or icon field — a note instead |

State changes bring the chrome back on its own. Nothing is lost, only unasked.

**And nothing holds space for something that is not there.** `min-height: 1em` on an error line reserves a row for a message nobody has written, so the layout will not jump when one arrives — which is this rule broken in CSS, and it was half of 48px of nothing under the Jobs form. Use `:empty { display: none }` instead (`#rc-peer-strip`, `.job-start-error`): the block collapses, its margins go with it, and the panel grows at the moment an error appears, which is the moment you want the eye pulled anyway.

## 2. Two sizes, and fine print lives at the bottom

**Reading size is the titlebar size** (`#app-title`, 16px). Anything that earns a place in the flow is set at it — the file info rows in both launchers, the Apps detail rows, the Groups panel, all through `.file-info-row`.

**Fine print is 12px at 0.75 opacity**, and it belongs at the **foot of a page**, not shrunk in the middle of one. If a line is worth shrinking it is worth moving down. The Relay Chat footer (`#rc-footer`: node label and key ending) is the reference case.

Match the size, **never the weight**: `#app-title` keeps its 600, or the block beneath starts competing with the thing it describes.

## 3. One rhythm, down a page and across a row

**12px** is the spacing scale. It separates sibling blocks down a page (`.code-view`, `.media-view`, `.open-with`, the two folded panels in Relay Chat) *and* the controls across a row (`.start-job-form`, `#rc-claim-fields`). Two gaps that are nearly the same read as a mistake rather than a distinction — this used to be 8px on rows and 12px everywhere else.

A row of controls is `.start-job-form`: gapped, wrapping, `align-items: flex-end` so a caption-over-input pair lines its input up with the button beside it. A form does not lay itself out; if a screen needs a row, it uses that class (Natter's Add line, the Jobs start form, the Relay Chat composer and To bar, the AI chat form).

**Space belongs to the block that follows it.** A block carries the gap *above* itself, never below — then a block that is not on the page contributes nothing, and there is no trailing margin left hanging where it used to be.

Said once, for every kind of block:

```css
#app-content > .app-pane > * + *,
.stack > * + *,
.job-log-row > td > * { margin-top: 12px; }
```

This was seven selectors naming which *kinds* of block space themselves from which — panel after panel, table after panel, fold after table. That list is quadratic in block types and its omissions are silent: two blocks simply sit flush and the page reads a little cramped. `> * + *` names no types, so a new sort of block is spaced the day it is added, by nobody. Put it on containers that hold **blocks** — never on a panel's contents, where a `.file-info-row` sits 4px under the row above it and is not a block. Stats needs no exception: it renders one child, so this never matches there.

**`.app-pane` is the wrapper the rule reaches through.** Every app is mounted into its own div under `#app-content` (`switchTo`, shell.js), and while that div was anonymous the rule landed on *it* — one 12px above the whole app and none between its blocks. The pane itself takes no margin: it is not a block, it is the box the blocks are in.

**`.stack` is any other box that holds blocks.** Both launchers write their whole page into a wrapper (`#cv-body`, `#mv-body`) so a later `loadFile` can replace it — and while those wrappers said nothing, the rule stopped at the pane's only child: the path bubble and the facts bubble under it sat flush, and so did the annotation cards. Same failure `.app-pane` had, one level deeper. Say what a box **is** and the rule finds it; name boxes in a list and the list goes stale (§4).

It also retires two hacks that existed only because space was carried downward: `.open-with:empty`, which had to cancel a margin on a block that renders as nothing, and the 12px that sat on the panel *above* Relay Chat's invite slot because the slot is empty for a node that owns no mailbox. The same idea applies across a row: a control takes the gap to its left, so a control that is not drawn takes no space with it.

A block that can still be empty **collapses to nothing** (`#rc-peer-strip:empty { display: none }`), which is the row version of the same rule.

### Who supplies the first gap is the container

The rule above spaces every block *after* the first. What sits above the first one is the box it is in, and **the answer depends on the box** — which is the single thing this file failed to say, and it was rediscovered three times in one sitting:

| box | above the first block | so |
|---|---|---|
| `#app-content` | 16px of padding | that padding **is** the gap. A margin as well is 28px where 16 was meant. |
| a `.stat-tile` panel | 12px of padding | same. A form that opens its panel takes none: `.start-job-form:first-child { margin-top: 0 }` |
| `.job-log-row > td` | 6px of cell padding | not a gap. There the first block **does** bring its own — hence `> *`, not `> * + *`. |
| a `<details>` | its `<summary>` | the summary is the first child and belongs against the top edge, so the rhythm starts at the body: `> * + *`. |

Written as one sentence: **a container with real padding has already left the room; one without it has not.** Guessing wrong is invisible in code review and obvious on screen, which is why it cost three passes.

### The two halves, stated so they can be checked

**Down a page: a fold carries its own leading space, always.** Every `<details>` panel brings the 12px above it and never relies on the block before it to leave room. Folds are the case that keeps breaking — they appear and disappear with state, so the one above may not be there — and it is why Natter's mint bubble arrived with no gap.

**Across a row: leading space goes on the left, except for the first element on the line.** Which is what `gap` on the flex container already does, and `gap` is the mechanism — not `margin-left` with a `:first-child` exception. That literal reading breaks twice: `.start-job-form` wraps (§10), so the first element on the *second* visual line is not `:first-child` and would be indented; and `display: none` does not change `:first-child`, so hiding the first control would indent the whole row, which §1 does constantly. Use `margin-left` only where there is no flex row to put a gap on.

**Every sitting that touches an app checks both**, along with whatever else has been decided since. A rule nobody re-reads is how the mint bubble lost its space in the first place — the statement was already here.

Two standing exceptions, both decided:

- **Stats is not an accordion app.** It is a living, ticking, output-only panel and reads as one; spacing rules written for folds that come and go do not get applied to it.
- **A settings panel keeps its `> details + details` rule while it holds one question.** `#rc-settings-panel` has a single item today and the rule matches no pair — it is not orphaned, it is waiting. A second configuration item is expected (a sound on incoming, for one), and this is the shape that makes it cost nothing. Same for the other settings panels.

### A form is one wrapping row, and the button ends it

**The button goes at the end of the last field, on its line — never stacked underneath.** A form and the one button that spends it are one gesture; a button floating below three stacked fields reads as belonging to the panel, while a button at the end of the last field reads as finishing the form. On a portrait screen (§10) the stacked version also costs a whole row of height to say one thing twice.

The row is `.start-job-form` — 12px gaps, `align-items: flex-end` so a button lines up with the input rather than with the caption above it, and **wrapping**, which is what makes the whole thing work: fields share a line while there is room and stack themselves when there is not. Natter's mint is the reference case (Andy).

**How many fields share a line is not a rule — it is a consequence.** Nothing counts inputs. Each control declares the width below which it stops being readable, and the row wraps when it cannot honour them all. `.start-job-form input` floors at 140px; `.icon-selector` floors at 260px, which is its longest line of names plus the glyph column, and its dropdown floors independently because the list is pinned to the field's edges and would otherwise inherit any squeeze.

So: **a control that needs width says so itself.** That is the whole mechanism, and it is why Groups' create form can be name + icon + Create on a desktop and three stacked blocks on a phone with no app knowing anything about either.

`.field-label.grow` gives one field the slack. Opt-in, because a row of several fields is usually meant to share it evenly rather than have one swallow it.

Where it applies: the Apps panel's Custom name and Custom icon with their Reset, the Groups create form and row panel, Natter's mint and add-relay rows, Contacts' add-by-handle, and the contact row's "Your name for them" beside Block/Unblock.

**Not for a destructive button.** Groups' Delete stays on its own line rather than riding beside the icon picker — it is the row's verb, not the field's, and a button that erases something should not sit a thumb-width from a control you are adjusting.

**Not for an answer.** A minted token, a validation error — these are things to read when they appear, not controls on the line. They go under the row.

### A reading is a card, and so is a form beside it

A handful of short facts read as **one thing**, not as a list of rows, wherever a row has already supplied the heading — a mailbox report in Natter, a contact's row, an app's defaults. `spirit.shell.factRow([[label, value], …])` builds it; it lives in the shell because it had been copied into three apps and the fourth was about to be.

It sits in a bubble of its own, on the same card-inside-a-card ground `.stat-tile.nested` uses, so a reading is visibly not the controls beside it. **Caption above value, caption the small bold half, both centred on each other** — you scan the captions to find the one you want, then read the value at reading size.

That is deliberately **the opposite way round from `.stat-tile`**, where a 22px figure sits over a 12px caption. There the number is what is being read and the caption only names it. Here the caption is how you find your way and the value is the answer. Two inversions of the same two elements, and the difference is which half you came looking for.

**A form is a card too — but only where it shares the panel with something else.** `.start-job-form.card`, asked for rather than automatic. "Any form inside a panel" cannot tell a panel that *holds* a form alongside a reading from a panel that *is* the form, and the second is two boxes around one object (Jobs, the Groups create form, Contacts' add-by-handle were all that). Marked in the markup because a `card` class is greppable and a descendant selector is not.

### A viewer steps out of its own way, and nothing else does

Three callers pass `{replace: true}` to `launchApp`, and every one is a launcher finishing with the file it was showing:

| where | you leave for |
|---|---|
| Open with | another handler for the same file |
| Open ⟨app⟩ | the app whose source you were reading |
| Start Job | the job the form on that script just started |

So Back returns to whatever opened the launcher — Processes, or Files — rather than to a file you are done with. **Everything else pushes**, and a group screen pushing is exactly what makes Back *into* it mean going back to where you were. A test counts the three across `shell.js` and `index.html`, so a fourth has to be a decision rather than a habit.

### Opening one fold closes its siblings

**One panel open at a time.** This is already the house rule for every row expander — Apps, Groups, Jobs, Natter's relay rows and Contacts' own rows all say *"opening one closes any other"* — and folds now say it too. It is the same argument as the spacing above: a portrait screen has one screenful, and a fold left open behind you is chrome you are not using (§1).

**Use `<details name="…">`.** The browser does it: same `name` on siblings and it closes the others itself. No JS, no state, no listener per app. On anything too old to know the attribute the folds stay independent, which is exactly today's behaviour — the fallback is the status quo, so it cannot break a screen.

**Names are the app's id prefix, not its app id.** App ids are folder-derived and have moved before (`app-manager` → `app/apps`; `APP_ID_RENAMES` carries the overrides). A fold group named from one would silently regroup on the next folder move, and nothing asserts which folds are a group. The `rc-` / `contacts-` / `natter-` prefixes are hand-written, stable, and already name every element in their app:

| app | fold group |
|---|---|
| Relay Chat | `rc-settings`, and `rc-settings-question` for the folds inside it |
| Contacts | `contacts-panels` |
| Natter | `natter-panels` |
| Apps | `app-manager-panels` |
| Groups | `group-manager-panels` |

**One group per level.** A nested fold needs its own name or opening the child closes the parent it lives in.

Two things this rule does not do:

- **A tree is not an accordion.** `app/files/files.js` builds a `<details>` per folder. Exclusive folders would mean never having two open, and every step down would collapse the path you came by. The tree is already delicate about open state — it tracks `isOpen` by hand, because a rebuilt `<details>` is a closed one.
- **The shell does not stamp `name` automatically.** It knows whose container it is mounting, so it is tempting — but the tree's folder folds live in that same container, and "direct children only" stops being true the day someone wraps their panels in a div. One attribute, written where the fold is written.

## 4. One row type, one voice

The same kind of information looks the same wherever it appears. `.file-info-row` is label-plus-value on one line, and it serves the launchers, Apps and Groups alike; changing it changes all three on purpose.

**Style by what a thing IS, never by a list of the ids that happen to be it.** An id list is correct on the day it is written and silently wrong afterwards, because panels move between apps and nothing tells the stylesheet. Both times this bit, the symptom was a screen quietly missing something rather than an error:

- `#rc-invite-panel > summary, #rc-add-panel > summary, …` — three of the four had left Relay Chat (invite to Natter, the other two to Contacts), so **Contacts' folds had no pointer cursor at all**: a fold that did not look clickable. It is `details.stat-tile > summary` now.
- `#rc-unknown-choices { margin-top: 12px }` stayed behind when its panel moved, pointing at an element that no longer existed, while the panel's new home had no leading space.

The same argument retires a *name* that belongs to one app: `.natter-facts` became `.fact-row` when Contacts and Apps wanted it. The shape was never Natter's, so neither was the name.

**A mark says who refused somebody**, and there are three answers plus two states that are not refusals:

| mark | means | where |
|---|---|---|
| `📇 ROLODEX` | the node refuses them | Relay Chat only |
| `❌ NO` | *chat* refuses them, in Relay Chat — *the node* refuses them, in Contacts | both, differently |
| `⌛ WAITING` | they wrote, nobody has decided | both |
| `× ` | — | retired |
| `•` | unread, and only on a row that is none of the above | Relay Chat |

The `❌` split is the one that looks wrong and is not. In chat the rolodex says **which app** refused them, because the answer is somewhere else and you have to be sent there. In Contacts you are already in that app: a mark pointing at Contacts, drawn in Contacts, points at itself. Contacts can never show chat's refusal at all — that flag lives in chat's per-peer log, which `api.fs` will not let Contacts read, and the two refusals being separate is the point (packet 2).

`⌛` replaced a hand-typed `×`, the only character ever used as a mark. A cross reads as **no**, one column from the `❌` that is one — which is exactly how a waiting row got read as blocked on a live node. Nothing about waiting is a refusal: nobody has said no, and nobody has said yes.

Before adding a class, check whether one of these already says it:

| class | what it is for |
|---|---|
| `.stat-tile` / `.stat-tile.wide` | a panel: rounded, padded, faintly lighter than the page |
| `.stat-tile .value` / `.label` | a figure (22px) and its caption (12px) |
| `.file-info-row` + `.file-info-label` | label and value on one line, reading size |
| `.start-job-form` | a row of inputs with a button on the end |
| `.field-label` | a caption wrapping its own input |
| `.job-log-panel` / `.job-log-entry` / `.job-log-time` | a scrolling log |
| `.job-log-empty` | "nothing here yet", italic and dimmed |
| `.job-manifest-note` | fine print (see the open question below) |
| `.cancel-btn` | a secondary button; also every filter button in Relay Chat |
| `<details class="stat-tile wide">` | a rare job folded away — Invite, Add someone by handle |

## 5. A label people scan must hold still

A number that changes on its own does not belong in text somebody reads to find something. The unread count lives in Relay Chat's own heading; the browser tab says **`spirit - <node> - <screen>`** and nothing else, because a wall of tabs is scanned to answer "which node is this".

The same reason keeps the key ending out of the title and in the footer: somebody is reading it aloud down a phone.

## 6. Human-facing machine values

A key is 48 characters and all Ed25519 keys share the prefix `MCowBQYDK2VwAyEA` — so a fragment shown to a person is taken from the **end**, six characters, and the same six in the same words on both screens ("ends …mjowM=" beside "key ends mjowM="). Never show a prefix, never abbreviate in the middle.

## 7. Test the relationship, not the number

CSS regressions are invisible until somebody looks. Where a rule is a *relationship* — an info row is the size of the titlebar; Open with sits the same distance below the bubble as the preview does below it — assert that, not the pixel value. Changing both deliberately then stays green; changing one does not. See `spirit/test/natterIntrinsic.js`.

**A source check must not be able to match its own comment.** Four of these in one sitting: a fold count that found the sentence in `files.js` explaining why a rebuilt `<details>` comes back closed; a "chat never calls `/api/hub/peer`" check that found the comment saying it does not; a "Last log is gone" check that found the comment naming the column it removed. Every one is a check that can fail — or pass — for a reason nobody meant.

The fix is to match where the thing is **built**, not where it is discussed: a quoted opening (`/['"]<details/`), a quoted path (`"'/api/hub/peer'"`), a header cell (`<th>Last log</th>`) rather than the prose. And prove it: a check nobody has watched fail is a check nobody knows the meaning of. Every claim in this file that could be asserted was, and several were confirmed by breaking the thing on purpose and watching the message.

**Two ways to ship a silently wrong program that `node --check` accepts.** Both cost real time in one sitting:

- A shell heredoc turned a regex backreference `\1` into a literal **0x01 control byte**. The regex stayed valid — it simply matched `app/foo/.js` instead of `app/<name>/<name>.js`. Found by reading, not by any test.
- `io.open(path, 'w')` **truncates before it writes**, so a write that fails partway — a Unicode error, an exception building the content — leaves an empty file. That emptied a 2400-line test file. Build the content first, write to a temp file, then rename.

The rule that follows: when a script writes source, write it to a temp path and `os.replace`, and keep regexes out of heredocs entirely.

Two harness facts worth keeping, both found by writing such a check:

- A manifest-declared app **never reaches `switchTo`** in node — `launchApp` injects a `<script>` and returns — so a test that needs a mounted app registers a static one.
- A regex written into a test through a shell heredoc can have its escapes eaten (`\n` becoming a real newline inside the pattern). Where the markup is built by concatenation across many lines, `indexOf` ordering says the same thing and cannot be mangled.
- **A stub must be shaped like the thing it stands for.** Natter's mint stub answered the panel for `parentNode`, so every lookup worked whichever way the code asked. When the fields and the button moved into a row, the browser stopped finding the answer span and the test went on passing — a mint succeeded and said nothing. A stub that is more permissive than the DOM does not merely fail to catch a bug; it hides one.
- **An id is only unique if nothing else claims it.** Apps stay mounted, so every visited app's markup is in the document at once and `getElementById` answers with whichever came first. Both launchers drew `<div id="open-with">`; opening a text file and then an image wrote the image viewer's handlers into the text viewer's pane, silently. A check now reads every id built in `index.html` and requires each to be built once.

## 8. Reach for what the server already answered

The shell does not invent restrictions the server does not impose (`AGENT.md`, and the memory of the Open-with folder rule that refused a perfectly readable file). If chrome needs a verdict — is this writable? — publish the verdict from the enforcing function rather than mirroring its constants in the browser.

## 9. One shape for every control

Buttons, inputs, selects and text areas an app puts on the page share one rule set (`#app-content input, select, button, textarea:not(.code-view)`): **rounded box, 10px radius — the same roundness as the `.stat-tile` they sit in — dark fill, 1px translucent border, reading-size text, 44px minimum height.** Buttons drop the border and take the accent fill.

Two of those numbers are doing double duty, which is why they are not free to drift:

- **16px** is the reading size of §2 *and* the threshold under which iOS zooms the whole page when a field takes focus — leaving a portrait phone scrolled sideways in a layout nobody asked for.
- **44px** is the smallest comfortable touch target on a phone.

A form does not style its own controls. `#process-search`, `.field-label`, `#job-manifest-form` and the Relay Chat rows each carried a private copy of the same six declarations, at 6px padding and 6px radius, drifting one edit at a time; now they declare only what is particular to them (a width, a margin, `flex: 1`).

The titlebar keeps small buttons (`.cancel-btn` outside `#app-content`, e.g. the viewer's bail-out): chrome you press once is not a field you fill in.

`select` also gets `color-scheme: dark` and opaque `option` colours globally, because a native dropdown paints its popup with the control's own colours — a translucent background reads fine closed and is unreadable open.

## 10. Aiming at a small portrait screen

Not finished, but it is the target, and it decides the numbers above. What already holds: controls are thumb-sized, `.start-job-form` wraps so an input takes the width and its button drops beneath it (two full-width targets instead of one squeezed pair), `.rc-wide` takes the page width rather than the width of its longest option, and the desktop shrinks its icons under 480px.

---

## Open questions — the tree disagrees with itself

- **Is 13px still a size?** It is the de-facto body size (`.stat-tile .rows`, `.jobs-table`, `.code-view`, `.process-entry`, `.annotation-raw summary`) but §2 says reading size is 16. Either 13 is a third tier with a job, or those are all waiting to grow.
- **`.job-manifest-note`** is fine print at 12px sitting *mid-page* in the text launcher, which §2 forbids. It moves to the foot or it stops being a note.
- **Files' own detail panel** shows Name/Path/MIME through `.label`/`.rows` at 12 and 13px — the same information as `.file-info-row`, in a different shape, and now also unlike the `.fact-row` every other panel reads with. Andy: Files waits until more useless information is culled from its interface (§1), because there is no point laying out what should not be there.
- **22px figures** (`.stat-tile .value`) are a third size that probably earns its place — a number read as a figure is not prose. It now has a sibling to be distinguished from: `.fact-value` is 16px with its caption *above* it, `.stat-tile .value` is 22px with its caption *below*. Both are defensible and the difference is which half you came looking for, but neither is written as a rule.
- **Wide content on a narrow screen.** `.jobs-table` will overflow a portrait phone rather than scrolling inside its own container, and the thread, the Files tree and the code view have not been looked at on one at all. §10 is a target, not a claim. Culling columns helps and is not the fix: Apps went five to three and Jobs six to five, both with nothing lost, and both tables are still fixed-width.
- **What else is a column nobody can act on?** Apps shed Id and Source, Jobs shed Last log — each was on screen twice or unreadable where it stood. Processes and Stats have not been asked the same question.
- **`<details>` markers**: Invite and Add someone by handle now both show the default triangle, after the invite line stopped being shrunk. Whether folded panels show a marker at all is unstated.
