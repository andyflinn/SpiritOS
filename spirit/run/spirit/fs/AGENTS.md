# fs: this node's own files, for agents

The `fs` namespace reads and writes files under the node's run folder, on
this machine's disk (`wire: false`: being offline cannot fail it). Every verb
goes through spirit.core.fs, which asks fileServable or fileWritable about
the path first: nothing above the run folder is reachable, and the writable
roots are the few the node names.

A verb with a file in this folder (`<verb>.json`) is described to agents, who
read this AGENTS.md and the verb files through the folder's FS verbs (the
AGENTS verbs went with goal/G30.4); one without is closed to them (goal/G10.5). Described: the reads (fs.search, fs.stat, fs.annotations,
fs.load) and one write, fs.save (goal/G14.8, so an agent can write its own
app's code; the commit hook, not this gate, fences an intrinsic app).
fs.delete and fs.annotate are not, each waiting for a goal of its own.
