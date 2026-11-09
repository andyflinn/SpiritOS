# spirit/app/icons/, the Icons app

The Icons app: a face and an api, run by the node per request, with no process of its own (goal/G43.19, box v16). Its
test is `./icons.js`.

Andy: *"icons is an app with a face, and an api, no fucking process for some trivial shit like a quickie applet. at that
rate the node will end up with 148 node-processes. NOT acceptable."*; *"for apps with only shell:mount:true and
node:mount:false or missing, BUT with a api.js and data.js, the node must execute spirit/app/<name>/<name>.js with the
request, instead of routing it to a server, like a cgi-script, and that process lives only as long as the request."*;
*"there's no reason that icons shouldn't publish like any other server."* (Q7: *"absolutely."*). The add row, G41.27:
*"icons app:\n[➕] [an icon:paste] [keywords, comma separated][Add]"*.

A scratch node of the tracked files with Icons switched on, and a real Chrome on its face page; neither Andy's node nor
an agent's is touched. Its verbs are read from its own `api.js`, the face found by Andy's words for it, so no name the
box leaves open is guessed. What is written is read from the disc, what runs from the machine's process list.

## Requirements

- **Its files** (the box; Q5, Q6): `api.js` at the app's top with no `api/` folder, `data.js`, `icons.js`,
  `nodeIcons.js`, `browserIcons.js`. `icons.json` keeps node mount false and shell mount true (the box, 1).
- **One file the node and the page load** (the box, 7): `icons.js`, run in node, does `require('./nodeIcons.js')`.
  Neither `icons.js` nor `browserIcons.js` mounts through `spirit.shell.activateApp`, nor writes through the fs family.
- **No process of its own** (the box, 1): switched on and idle, nothing runs `icons.js`; after the api tree, an Add, or
  five Adds, its run has ended.
- **The api tree asks it** (the box, 8): the tree holds the icons branch, naming every verb of `api.js`.
- **One job, open while it is on** (the box, 10): `spirit.app.icons`, the same job after its runs.
- **Its tile opens its face** (the box: "its tile opens no face"): the add row, ➕, an icon to paste, its keywords, comma
  separated, and Add. An Add with no icon says `paste an icon first` and writes nothing.
- **Initialized from the system set** (the box): with no `spirit/state/icons/data/iconSet.json`, the list shows
  `spirit/iconSet.json`; the first Add writes the own set, every system icon in it and the new one; `spirit/iconSet.json`
  is not written.
- **Only nodeIcons.js writes the table** (the box): the page asks `icons.<verb>`, its own branch, and writes no file
  through fs; the list shows the new icon with no reload.
- **It publishes** (the box, 10): a second page, open on the set, shows an icon added on the first, with no reload.
- **Switched off** (the box, 4): `icons.<verb>` answers `app-not-served`, the tree holds no icons branch, its job is no
  longer open, nothing runs. Switched on again, its branch is back with no restart of the node.

## What its test must try to break

- A duplicate Add (Andy: *"that shouldn't work"*): the set is not written.
- Five Adds at once (the box, 9: *"two saves never write iconSet.json at once"*): all five land, what was there stays,
  and never two runs of `icons.js` at once. A run must have been seen, or the count judged nothing.
- A page writing `spirit/state/icons/data/iconSet.json` itself is refused, and the set stands.
