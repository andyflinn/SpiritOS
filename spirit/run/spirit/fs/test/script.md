# spirit/fs/script.js — its tests (goal/G49.1, step 1)

The box: step 1 is migration scaffolding only; *"spirit/fs/script.js is the one entry for a node process that wants the fs
dataset: it wraps spirit/fs/data.js and, in a child process, adds the followStream call opaquely. A caller never knows how
the dataset is created or updated"*; *"on the node's main process, chokidar writes straight into spirit.required.spirit.data.fs; job.js's
own tree (fsTree) goes"*; *"spirit.js knows nothing about fs streaming"*; and of the rows, *"api folders are marked with a
boolean api:true, if they contain api.js and data.js, api:false for all files and folders without data.js or api.js"*,
app folders *"app:true if they contain a manifest ... <name>/<name>.json AND <name>/<name>.js"*, files always app:false,
and *"both flags are set by the one writer of the dataset ... on the folder's row, whenever api.js, data.js or a manifest
in it comes or goes"*.

On a scratch node of lab's. A caller in a child process of that node requires spirit/fs/script.js and nothing else:

- spirit/fs/script.js exists;
- the caller holds the whole tree in spirit.required.spirit.data.fs, marked complete, without calling followStream itself;
- spirit/app/desk (api.js, data.js, desk.json, desk.js) is a row with api true and app true;
- spirit/fs (api.js, data.js, no manifest) is a row with api true and app false;
- spirit/app/job (job.json, no job.js) is a row with app true: a folder is an app by its manifest alone (Q1, Andy:
  *"yes. testicle already checks validity of an app.json"*);
- a file, spirit/app/desk/desk.js, is a row with api false and app false;
- a folder planted while the caller follows, gaining api.js and data.js, turns api true in its dataset, and turns api
  false again when its data.js goes;
- job.js keeps no tree of its own (no fsTree in its code);
- spirit.js names neither followStream, spirit/fs/data.js nor spirit/fs/script.js.
