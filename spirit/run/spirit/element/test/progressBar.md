# spirit/element/progressBar.js — its own test

The progress bar (goal/G29.14): the box, *"progressBar: one shared shell element drawn from (done, total, text); total 0
shows indeterminate. It knows nothing of processes."* Owed since the rule *"every production script has its own test"*
(goal/G47.1, box v72). The browser file runs in node on a window of its own and places itself by the real
installSpiritElement; its markup is read as text.

- It stands at `spirit.element.spirit.element.progressBar`, a function answering markup (still no create and no container:
  the discrepancy with goal/G41.19's box its header names).
- Done of total: a progress tag, max the total, value the done; the words `done/total text`, or `done/total` with no text.
- Total 0: a progress tag with no value (the browser's indeterminate bar) and the text alone; no text, no words.
- The value never runs past the total nor below 0; the text is escaped.

## What its test must try to break

A value past the total; total 0 drawn with a value (a determinate empty bar); the text let through as markup.
