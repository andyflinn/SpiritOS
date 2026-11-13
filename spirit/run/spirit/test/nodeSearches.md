# spirit/nodeSearches.js — its own test

The node's jobs and files, searched rather than listed (puppets/G2; Andy, 2026-09-27: *"the verb changes changing list
fetches to a search(labe) and geKey(key) pair are approved"*, and *"get is fine"*). Owed since the rule *"every
production script has its own test"* (goal/G47.1, box v72). The jobs table is planted; the files a contents search
reads are in a scratch folder.

- `jobsSearch` (job.search): no words or `*` is every job in the listing's order, `{ key: id, label: 'id (status)' }`;
  words are ranked over the whole job as it is served (goal/G41.28), the match first; cut by bytes into one packet,
  never by rows, `more` when it does not fit.
- `jobsGet` (job.get): one job without its internals (a leading `_`); the file watcher carries no file list but its
  `fileCount` (goal/G4.25); no key 400, unknown 404; a job too big for a packet refused (413), never cut.
- `fsSearch` (fs.search) by name and path: no words is the tree in path order, a folder with its trailing slash; words
  ranked best first, a non-match left out; the words are a person's, `*` and `?` nothing special (goal/G29.8); cut by
  bytes, `more`.
- `fsSearch` with `contents: 'yes'` (goal/G29.11): ranked by contents alone, never names; only text files (text/,
  json, javascript); a file above 1 MB never read; each answer `{path, score, line}`, the first matched line; more
  matched lines score higher, `m / (m + 10)`; no words is the tree by name.

## What its test must try to break

The watcher's file list back in job.get; an internal field served; a big file read; a png read as text; a score from a
job's id or a file's name where the whole row or the contents are asked for; an answer cut by rows, or too big for a
packet.
