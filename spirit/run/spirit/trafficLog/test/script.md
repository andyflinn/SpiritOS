# spirit/trafficLog/script.js

What this node sent and what it received: one row per packet, in node.db's `traffic` table
(which `spirit/nodeStore/script.js` owns). Personal nodes only. The payload is kept whole and never read. Its test is
`./script.js`, on scratch node homes under the OS temp folder: rows written through `note()` and `taken()` and read
back through the log's own readers, the store closed and opened again.

## Requirements

### The module

- It exports `createTrafficLog(opts)`, `opts` `{ rootDir, relayMode, now }`; the log it answers has `note`, `read`,
  `size`, `arrivals`, `untaken`, `byHash` and `taken`. It has no `ownerEvents`: owner events are kept nowhere
  (goal/G47.1, Q16).

### No store, and a broken one

- A home with no node.db reads as no history: `read()` `[]`, `size()` 0, `arrivals()`, `untaken()` `[]`, `byHash()` null, `taken()` 0.
- No reader, nor `taken()`, brings node.db into existence; the first `note()` does.
- A node.db that is not a database reads as no history, and `note()` on it does not throw (a witness must not break
  the delivery it witnesses).

### The gate

- In relay mode `note()` answers null, writes nothing and makes no node.db.
- With no `rootDir`, or no entry, `note()` answers null and writes nothing.

### A row

- `note(entry)` answers the row it wrote, and `read()` hands back that same row.
- `at` an ISO time; `dir` `'in'` or else `'out'`; `kind` `'reply'` or else `'request'`; `peer`, `relay`,
  `hash`, `outcome` as text, `''` when not given.
- `status`, `ms`, `waitMs`, `attempts` kept as numbers when given (anything not a number is 0), `code` as text when
  given; each left out when not given.
- The payload, when it is text, is kept byte for byte and `bytes` is its UTF-8 byte length, not its character count. A
  payload that is not text is not kept, and the row has no `bytes`.
- The payload is never read: a row carries no `app` field, neither from the entry nor from inside the payload.
- No row is written with the kind `'owner'`: an entry naming it is a request. No row takes an owner event's facts
  (`event`, `label`, `invite`, `key`, `why`, `owner`, `revoked`, `invitesRevoked`, `expiresAt`, `cause`).

### The stamp

- `at` is unique and increasing: rows written in one millisecond get the next millisecond each; a clock going backwards
  never makes `at` go backwards.
- A new log on the same home starts after the highest `at` already written, so a restart reuses no position.
- `read()` hands every row back in the order written.
- Rows outlive the store being closed and the log made again.

### arrivals(opts)

- Delivered inbound rows only (`dir: 'in'`, `outcome: 'delivered'`), oldest first: nothing sent, ignored nor refused.
- `since` (an ISO time) is a position: rows after it, not the one at it; a `since` that is not text means from the start.
- `limit` caps the answer; none, zero, below zero or not a number means 200; above 500 means 500.
- Payloads come back whole; a row a page was handed carries `takenAt`.
- Arrivals written in one millisecond are none of them lost to a reader asking after the first.

### taken(hashes)

- Marks the delivered inbound rows named (one hash, or an array) and answers how many it marked; outbound, ignored and
  unknown hashes are not marked; no hashes answers 0.
- A row is marked once: a second `taken` marks nothing and keeps its first time.
- The marks of one call share one time, later than every row written before them.
- A mark is a row of its own, never a row of history: `read()` hands back the packets alone, the taken ones with
  `takenAt`.

### untaken()

- Every delivered inbound row not yet taken, oldest first; an arrival older than a day is left out.

### byHash(hash)

- The newest row with that hash (a reply after its request), with `takenAt` when taken, never a mark. No hash, an empty
  one or an unknown one is null.

### size()

- The bytes the log's table and its indexes take in node.db, growing as rows are written; 0 with no node.db.

## What its test must try to break

- A relay-mode log, or a log with no home, writing anything.
- A payload changed, parsed, or an `app` field appearing.
- An owner row written, or a row keeping an owner event's facts.
- Two rows sharing a time, a time going backwards, a restart reusing a position.
- A reader bringing node.db into existence, or throwing on a broken one.
- arrivals handing back what was not delivered inbound, the row at `since`, or more than the limit or ceiling.
- A row marked twice, a mark showing as history, a taken row still untaken.
