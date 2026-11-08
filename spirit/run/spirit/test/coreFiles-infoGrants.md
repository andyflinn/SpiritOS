# spirit/coreFiles.js: Info and Grants intrinsic by their own json

goal/G43.24, requirement 2. Its test is `./coreFiles-infoGrants.js`: coreFiles.js loaded as it is.

Andy: *"i just moved them, didn't fix the manifest."*, *"no i want those apps to basically be wrappers for spirit/element/ things...."*, and *"box that these apps must mount in the new format of the new shell."*

## Requirements

- `shell/info` and `shell/grants` leave coreFiles.js's INTRINSIC list.
- `coreFiles.appIntrinsic` reads `info` and `grants` intrinsic from each one's own json.
