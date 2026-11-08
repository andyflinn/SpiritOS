# fs: this node's own files, for agents

The `fs` namespace reads and writes files under the node's run folder, on
this machine's disk (`wire: false`: being offline cannot fail it). Every verb
goes through spirit.core.fs, which asks fileServable or fileWritable about
the path first: nothing above the run folder is reachable, and the writable
roots are the few the node names.

A verb with a file in this folder (`<verb>.json`) is described to agents, who
read this AGENTS.md and the verb files with fs.load, by their path (the folder's
own FS verbs went with goal/G43.20, the AGENTS verbs with goal/G30.4); one without is closed to them (goal/G10.5). Described: the reads (fs.search, fs.stat,
fs.load) and one write, fs.save (goal/G14.8, so an agent can write its own
app's code; the commit hook, not this gate, fences an intrinsic app).
fs.delete is not, waiting for a goal of its own. There is no fs.annotations and no fs.annotate: annotations are the
node's only (goal/G43.20; Andy: "ANNOTATIONS WILL BE NODE ONLY.").
