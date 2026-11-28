# spirit/job/server/script.js — its own test

The spirit.job branch's node work (goal/G49.25, Q5; Andy: *"WHY THE FUCK WOULD IT NOT???"* to *"Does a branch's node work live
at spirit/<branch>/server/script.js, handing its verbs' answers to the scan"*): `verbs(node)`, an answer `{ reply, handler }` for
each verb of `spirit/job/script.js`, over the node's job table; none on a relay. Owed since the rule *"every production script
has its own test"* (goal/G47.1, box v72). The verbs are read from the branch's script; what each answer does is judged on a
scratch node, at its one door, against the verb's own description, `spirit/job/<verb>.json`. The jobs asked of are the node's
own, read from its search; the app it would start is read from the app search.

## Requirements

- `spirit.requireScript` of its path hands back `{ verbs }` and nothing else.
- On a node, `verbs(node)` hands an answer for each verb `spirit/job/script.js` declares and for no other, each with its reply,
  an object, and its handler, a function; on a relay (`spirit.IS_RELAY`) none.
- **search** (`search.json`): with no q the node's jobs, a bounded list keyed by each job's id, each labelled
  `type (status)` as get answers them; with q, the job it names first.
- **get** (`get.json`): `{ ok, key, job }`, the job with its id, kind, type, status, createdAt, updatedAt, log and data; an id no
  job has is 404.
- **create** (`create.json`): refused 403 not-a-process for another program and for a script that is no app's own, 403
  process-not-included (naming the app) for an app this node does not run, and 400 for args that are no JSON list of strings.
- **cancel** (`cancel.json`): a running permanent job answers the job, its status stopped; an id no job has is 404.
- **delete** (`delete.json`): a job that has not ended is refused 404 and stays; an id no job has is 404; a job that has ended
  answers 204 with no body, and get then refuses it 404.

## What its test must try to break

- A verb of the branch with no answer, or an answer for a verb the branch does not declare; an answer on a relay.
- An answer that does not do what its description says; a process started that is no app's own.

## Known

- No job is started by create here: the apps this tree runs (node.run) push, pull or publish the repository.
