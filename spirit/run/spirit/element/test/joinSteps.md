# spirit/element/joinSteps.js — its own test

The Join app's steps, decided in one place (goal/G30.1, box v39 and v40): which step a new user is on, from the join news
on the node's spirit job. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). Pure:
the browser file runs in node on a window of its own; the steps are the Join app's manifest
(`spirit/app/join/join.json`) and the face steps the code still knows.

- It places `fromJob`, `done`, `current`, `linkRelay` at `spirit.required.spirit.element.joinSteps`.
- `fromJob`: the job's facts as booleans and strings, with `opened`; no job, every fact false or empty.
- `done`: step 1 (`until: email`) ends on a seat, the node keeping no email since goal/G40.11 (box v24); contact, face and
  opened each by their own fact; an unknown end is never done.
- `current`: the first step not done; Find someone is optional (box: *"it never blocks the steps after it"*), never the
  open step; null once every step that counts is done, and for no list.
- `linkRelay`: the url of the relay the mailed link names by its key (goal/G40.11), never the first one listed
  (goal/G40.10, box v15); `''` for an unknown or empty key, a row that is no relay, a label that is not JSON.

## What its test must try to break

Step 1 judged by an email or a relay url again; the optional step blocking the steps after it; `linkRelay` falling back
to the first relay listed, or answering a contact's url.
