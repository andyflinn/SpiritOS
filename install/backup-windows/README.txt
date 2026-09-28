SpiritOS - encrypted backup of a node's relay-state (Windows)
=============================================================

transport/R19.1. Machine-side: nothing in SpiritOS calls this. It
copies spirit\run\relay-state (keys, contacts, node.db, the log)
into ONE encrypted file per run, keeps the newest 24, and writes
them to D:\countinn@google.com\SpiritOS-data-backup, which syncs to
Google Drive. Google holds files it cannot read.

Databases are copied with SQLite's VACUUM INTO, so a backup taken
while the node runs is consistent.


1. SET THE PASSPHRASE (once)
----------------------------

Put a passphrase of 12 or more characters in a file in your home
folder, OUTSIDE anything that syncs:

    %USERPROFILE%\.spirit-backup-passphrase

KEEP A COPY OF IT SOMEWHERE SAFE (a password manager, paper).
Without it, every backup is unreadable, by design.


2. TRY IT BY HAND
-----------------

    node D:\SpiritOS\install\backup-windows\backup.js

It prints one line: how many files, how many bytes, where it went.


3. RUN IT EVERY HOUR
--------------------

    schtasks /Create /SC HOURLY /TN "SpiritOS backup" /TR "D:\SpiritOS\install\backup-windows\run.cmd"

Each run appends one line to %USERPROFILE%\spirit-backup.log.
To stop it:  schtasks /Delete /TN "SpiritOS backup" /F


4. RESTORE (and prove a backup works)
-------------------------------------

    node D:\SpiritOS\install\backup-windows\restore.js <file.tgz.enc> <empty folder>

It unpacks into a NEW folder, never over a live node, and checks
every database with SQLite's integrity check. Putting the result in
place of a node's relay-state is done by hand, with the node stopped.

Options for all of the above: --from <relay-state> --to <folder>
--keep <n> --passphrase-file <file>
