# The shell app, and a shell that replaces itself

goal/G43.18, box v29, *The shell* and *Join*. Its test is `./shell.js`: a real node on a scratch copy of the tracked files, with a shell-worthy app of the test's own (`zzshell`, which draws one line and knows nothing of Join), and real clicks in a real Chrome on `/face.html` at home. The verb itself is judged by `spirit/test/nodeShell.js`.

## Requirements

- Q12, with no shell chosen: the page loads `spirit/app/shell/shell.js`, and the app search is on it, Contacts listed.
- Andy: *"the shell should exclude itself completely from the app-list, haha..."*: the shell app's list shows Contacts, and no `shell` row or tile.
- *"RULE: a shell must be able to replace itself"*, *"boot.js does the link home and the face stream only, then loads the shell the node names"*: with `zzshell` named at home, the page loads and draws it, and shows nothing of the other shell nor a desktop of boot.js's own.
- Q18, *"Join shows a new user its steps on its own ... neither boot.js nor any shell decides it"*: on the new scratch node, under `zzshell`, Join shows itself.
- The app detail's two rows, *"shown only for an app whose <name>.json says shell:true:true"*: none in Contacts' detail; a Home shell and a Face shell row in zzshell's. The Home shell dropdown first shows the configured home shell, the shell app's label.
- *"Both dropdowns list only the apps whose <name>.json says shell:true:true"*: opened, each lists Zz Shell, and no other app; not the shell app either (Q28, Andy: *"no, the shell icon is now properly missing :)"*).
- *"[armingButton-'Set']"*: Zz Shell chosen in Home shell, Set armed by its first press and pressed again, the node names `zzshell` at home, and face stays `shell`.
