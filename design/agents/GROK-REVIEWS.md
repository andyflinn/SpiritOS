# Grok reviews — through the node, on a budget Andy grants

**What it is.** A review with Grok is agent work. Grok's findings go to the
in-studio agent, who triages them and works out their consequences; Andy
receives only the decisions, bundled, in plain English
(`ANDYS_RULES_FOR_AGENTS.md`, general rule 9). The paste-and-carry between
two chat windows goes away.

> **Andy, 2026-09-22:** *"to me it feels like grok review is for agents, you
> compute the fallout and present me with decisions."* — *"I have to approve
> a limited message exchange with grok, because that hits my wallet."* —
> *"It's good discipline for me to make targeted, goal oriented use of my
> external-AI budget."*

## Decided

1. **A thread per review, with a goal and a cap Andy grants in words.**
   Nothing reaches his wallet without it. The cap is a number of messages;
   it is checked before every call, and raising it records his words beside
   the new number. A call Grok refuses does not count.
2. **The node makes the call and holds the key.** Andy: *"this is where the
   env-variable proxy-call in node should come in"* — *"may as well excercise
   that aspect of the SpiritOS"*. The script asks its node's loopback door
   (`net.fetch`) and names the key as `${ENV:GROK_API_KEY}`; the node fills it
   in from its own environment, and only for `api.x.ai`
   (`js/envSecrets.js`, by name, host and method). The script never holds
   the key; `oneDoor.js` counts it as a granted exception, like `agents.js`.
3. **Grok remembers the thread; the record is ours.** The Responses API keeps
   a conversation for 30 days and continues it from the last reply's id, so a
   review's rounds share one memory and earlier rounds are billed at the
   cached rate. Andy: *"ID good enough."* Each thread is kept under
   `design/reviews/grok/<thread>/` — every message sent and received, the
   grants in his words, and the **exact** cost of each message
   (`usage.cost_in_usd_ticks`).
4. **Pay per use.** API billing is prepaid credits, separate from any Grok
   subscription. Andy started with a $5 budget. ~~Prepaid (not invoiced) is a
   hard ceiling.~~ **Corrected 2026-09-22:** it was not — the account had
   **auto top-up** on, and the first review bought $5 twice (14:15 and 14:22).
   Andy turned it off the same afternoon, so now the prepaid balance IS the
   ceiling: what is left is the most that can be lost.
5. **The first review cost ~25x its estimate.** $6.92 for one message: the web
   tool re-read the growing context on every step, 4.49M input tokens
   (`design/reviews/grok/gap-cycle-8/thread.json`). An estimate that prices
   the reading list once is wrong for an agentic tool loop.
6. **Never Andy's vault.** A file under `spirit/run/brains/` is refused by
   path before it is read. His brain is his data, behind a stricter fence
   (`AGENT.md`).
7. **How it reads and thinks.** Andy: *"we do need high reasoning for a good
   review, and a good prompt"* — *"we go with the model you suggested"*:
   `grok-4.7`, reasoning `high`. Grok reads the tree itself from GitHub at a
   **pinned, pushed commit**, in the order `OPENING.md` gives (beside the
   script), and its web tool is fenced to `github.com` and
   `raw.githubusercontent.com`. That also takes a review past the node's
   17 KB body limit. The opening says Grok answers **Claude, not Andy**.
8. **Never a button, never a timer.** There is no launcher manifest beside the
   script: a paid call is an agent's act on Andy's grant.

## Decided, not built

- **An intrinsic app maintains the allowlist.** Andy: *"a instrinisc app will
  maintain the allow list associated with that part of SpiritOS services."*
  The list — a secret's name, the hosts it may reach, and for a key that can
  write, the methods — is a constant in `js/envSecrets.js` until then, marked
  as a seam. It needs a new persist shape and
  an owner screen: a UI session, and a review.

## How it is used

```
node spirit/run/process/js/grokReview/grokReview.js models
node …/grokReview.js balance
node …/grokReview.js start  <thread> --cap N --grant "<Andy's words>" --goal "<goal>"
                            --commit <pushed hash> [--since <hash>] [--pieces a,b,c] [--model m] [--reasoning high]
node …/grokReview.js send   <thread>          (first: OPENING.md, filled)
node …/grokReview.js send   <thread> <file.md | "text"> [--attach path ...]
node …/grokReview.js grant  <thread> --cap N --grant "<Andy's words>"
node …/grokReview.js status [thread]
```

The node it asks is `GROK_NODE` (or `AGENTS_NODE`, or `127.0.0.1:65432`), and
that node must have been **started after** `GROK_API_KEY` was set — a node
started before has no key, leaves the placeholder literal, and Grok answers
401, which the script explains.

**Verify:** `spirit/test/grokReview.js` (cap, grants, chaining, exact cost,
refused calls, vault refused, only the placeholder leaves the script) and
`spirit/test/serverSurface.js` (a real node withholds the Grok key from any
host but `api.x.ai`; falsified by widening its hosts).

## Open

- **A design sitting for the proxy system, soon.** Andy, 2026-09-22: *"and
  please note that a design session for the proxy system must come soon."*
  `net.fetch` with its `${ENV:NAME}` substitution was built as a generic
  outbound proxy for apps and now carries a second secret; what it should be
  — who may ask it, for which hosts, how the intrinsic app keeps the
  allowlist, what a call costs and who sees that — is that sitting's.
  **Found for it, 2026-09-22:** the node's door refuses any body over
  17,408 bytes (`refuseTooBig`), and `net.fetch` is behind that door, so one
  proxied call carries at most ~17 KB. This review's code diff is 98 KB
  (27,190 tokens) — nine pieces. Either the proxy gets its own bound, or a
  review sends summaries and the changed functions, not whole diffs.
- **What is free** (asked through the node, 2026-09-22): the key's own status
  (`GET /v1/api-key` — active, not blocked, all models and endpoints), the
  price list (`GET /v1/language-models`), and exact token counts
  (`POST /v1/tokenize-text`), so a message's cost is known before it is
  sent. The remaining balance needs a management key: Andy made one
  read-only at xAI and pinned to his address (`GROK_MANAGEMENT_KEY`), and the
  node sends it GET-only to `management-api.x.ai`.
  `balance` read $5.00 on 2026-09-22.
- Which model a review uses. Default `grok-4.7`, the newest `models` listed on
  2026-09-22 (the first live call, free, through the node); `--model` overrides
  it per thread.
