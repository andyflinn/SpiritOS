# spirit/element/monitor/task/script.js

goal/G47.1. Andy: *"new element spirit/element/monitor/task/script.js (to replace the run-job rowForm in app:detail) rowForm: <app-icon> "<app-name> + <status-message-while-running>" [run|cancel|delete]"*; *"yes make it an improvement on the current run-rowForm in app and isolate it as spirit/element/monitor/task/script.js"*; *"run-apps usually self-delete if they're successful, if they fail, they stay and offer "delete""* (spirit/job/engine/script.js removes a run that ends well or is cancelled, and keeps a failed one).

`spirit.required.spirit.element.monitor.task.create(container, { id })`, `id` the app's job id, `spirit.app.<name>`; answers `{ destroy() }`.

Its test is `./script.js`: a real Chrome on a scratch node's face page, with three apps planted in the scratch tree: `zztask`, a run app that publishes its progress (`{job: {state, name, done, total, text}}`, the convention of goal/G29.14) and runs on until cancelled; `zzfail`, a run app that fails at once; `zznorun`, an app with no `node.run`.

## Requirements

- It loads through `spirit.requireScript` and places itself at `spirit.required.spirit.element.monitor.task`, with a `create`.
- For a run app it shows a row form: the app's icon and its label from its `<name>.json`, and a Run button.
- For an app that is no run app, or one with no `<name>.json`, it shows nothing.
- Pressed, Run is busy while the node is asked: disabled, with its turning mark (goal/G47.1, Q20).
- While its job runs, the line is the label and the text the app last published, `Zz Task: halfway there`, and the button is Cancel.
- Cancel ends its job; the node removes it, and the row offers Run again with the label alone.
- A run that fails stays: the line is `Zz Fail: failed`, and the button is Delete.
- Delete takes the failed job away, and the row offers Run again.
- Destroyed, it leaves its container empty.

Which of Cancel or Delete a job offers is the job row element's `actionOf` (spirit/element/search/job/row/script.js), the rule the jobs detail uses too (wsl: *"task.js should take that rule from there, not write a second one"*).

## What would make it red

- A run app shown without its icon, its label or Run; anything shown for an app that is no run app.
- Run not busy after its press.
- A running job without its published text on the line, or without Cancel.
- Run not back after a cancel or a delete; a failed run without Delete.
- Anything left in the container after destroy.
