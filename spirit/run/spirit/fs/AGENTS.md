# fs: this node's own files, for agents

The `fs` namespace reads and writes files under the node's run folder, on
this machine's disk (`wire: false`: being offline cannot fail it). Every verb
goes through spirit.core.fs, which asks fileServable or fileWritable about
the path first: nothing above the run folder is reachable, and the writable
roots are the few the node names.

Every verb has its <verb>.json beside api.js, its arguments as api.js declares them (goal/G47.4; Andy: "api.js and <verb>.json files match precisely"). Which verbs an agent may call is no longer said by a file being there or not: the agent app gates branches and verbs for agents, not the node (Andy, goal/G47.4).

Agents read this AGENTS.md and the verb files with fs.load, by their path (the folder's own FS verbs went with goal/G43.20, the AGENTS verbs with goal/G30.4). fs.save writes an agent's own app's code (goal/G14.8); the commit hook fences an intrinsic app. There is no fs.annotations and no fs.annotate: annotations are the node's only (goal/G43.20; Andy: "ANNOTATIONS WILL BE NODE ONLY.").