# fs: this node's own files, for agents

The `fs` namespace reads and writes files under the node's run folder, on
this machine's disk (`wire: false`: being offline cannot fail it). Every verb
goes through spirit.core.fs, which asks fileServable or fileWritable about
the path first: nothing above the run folder is reachable, and the writable
roots are the few the node names.

A verb with a file in this folder is described to agents through
`fs.AGENTS.introspect` and `fs.AGENTS.<verb>`; one without is closed to them
(goal/G10.5). Reads are described today; the writes (fs.save, fs.delete,
fs.annotate) are not, until a goal opens them one at a time.
