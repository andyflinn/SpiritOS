# spirit/element/grantsPanel.js: Grants' data source

goal/G43.24, requirement 6. Its test is `./grantsPanel-authSource.js`: grantsPanel.js read as it is, comments stripped.

Andy: *"i just moved them, didn't fix the manifest."*, *"no i want those apps to basically be wrappers for spirit/element/ things...."*, and *"box that these apps must mount in the new format of the new shell."*

## Requirements

- Grants' data source moves into grantsPanel: `grantsPanel.js` asks auth.search, auth.grant and auth.revoke, over the auth cache.
