# spirit/fileSystem.js

The node's file system: the two gates every read and write goes through, `fileServable` (can a path be read or listed)
and `fileWritable` (can it be written). This test holds one part of it (goal/G41.30): a path spelled in another case.

## Requirements

- **What a gate refuses, it refuses in every case** (Andy, 2026-11-02: *"Path gates are case-sensitive, so on Windows
  and macOS GET /Relay-State/identity.json serves the private keys"*). On a case-insensitive disk a name in any case
  opens the same file, so each closed path is asked as written and again upper-cased and title-cased:
  - fileServable: spirit/state/identity.json, an app server's relay-state at depth, a server script (spirit/server.js),
    the DEBUG folder, a sidecar's own path;
  - fileWritable: spirit/state/identity.json, anything under relay-state, a core file (spirit/server.js,
    spirit/element/icon.js), a sidecar's own path.
- **Windows spellings of a closed path are refused, by both gates** (goal/G41.30, the review: *"8.3 short names like
  RELAY-~1/IDENTI~1.JSO ... folder names ending in a dot or space; and ::$DATA"*): an 8.3 short name, a folder or file
  name ending in a dot or a space, the ::$DATA stream and a named stream (a : in a name), each on relay-state, a server
  script or a core file.
- **What is open stays open**: index.html and spirit/element/icon.js servable.
- Nothing is read or written: the gates are asked only.

## What its test must try to break

- A closed path opened by spelling it in another case, for reading or for writing.
- A fix so wide that an open path is closed.
