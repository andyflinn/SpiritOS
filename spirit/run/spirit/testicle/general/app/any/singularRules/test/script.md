# The job and event singular rules module

goal/G49.27, step 2b. Its test is `./script.js`; the module is `../script.js`, the part "0. job and event, singular" (rule0) of `spirit/test/app-child-general.js` moved into a rule module, that file its runner now.

The box: *"Each module has its own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red."*

## Requirements

- It hands out `{ appliesTo, resource, own, forbids, checks }`: resource `none`, own `false`.
- On a planted git tree, a product file that calls `spirit.job.search` keeps *"no product file calls a verb by its old name, jobs.* or events.*, nor spirit.jobs or spirit.events"*; one that calls `spirit.jobs.search` is red on it.
- **A module's own forbidden name is skipped, only in its own files** (goal/G49.27; Andy: *"All, cw's way"*): a planted rule module that names `spirit.jobs` and hands it out as its forbids keeps the rule.
