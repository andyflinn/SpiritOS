# The "agent" app Design

## Preamble
- This is an application that will connect the user to a variety of AI model **provider** URLs. 
- It manages the corresponding API keys, configures those **provider** client interfaces, setting/loading the **model**, making them ready to use.

- i already know i need the following tables for a primitive version, 

- a provider table. keyed by ID same as the shadow-roll (with Label and Description, URL, and API_KEY)
- a persona table.  keyed by ID same as the shadow-roll  (with Label and Description, and a codeMirror-field for the persona-description i give it with every prompt)
- a jobs table.  keyed by ID same as the shadow-roll (with Label and Description, boolean loop-flag (not for the model, for the agent-app), and a codeMirror-field for the job-description that may come with a prompt)
- an auth table, stuctured exactly like the auth table in node, in fact: node's auth modules will have a file authTableInterface.js, (configured by dataBase.db file name and authTableName)

table-specific code goes into the following folders
- process/agent/table/provider/
- process/agent/table/persona/
- process/agent/table/job/
- process/agent/table/grant/

these table folders will contain the following files.
- process/agent/table/<tableName>/interface.js (an interface to the table, the agent verb <tableName>

the ID as key for all tables comes from the idea, that when i give an agent node-api's as tools, i may want to control access to the nodes API like this:
-


- every one of these tables will come with a left-edge icon that puts up a tab ,

# keys (Andy, Q1 and Q2: "they WILL need grants and i want keys that are separate from a label", "we'll put off the grant-problem, but not the keys.")

- every row of the three tables (providers, personas, jobs) has a key of its own, a peer's shape: a key pair the agent server makes when the row is created. The public half is the row's id; its label is a separate caption that may change.
- the private half never leaves the agent server, nor does a provider's API key: a page sets one, and only sees whether it is set.
- grants are put off: how a row's key is granted node verbs (the shadow roll, or the grants app reading the agent server) is decided when tools come.

# out of scope for now

- a conversation context. The primitive version sends a job's persona and job text fresh with each call. The direction for later (Andy): ONE context, persisted and maintained, for each persona (its direct chat) and for each job; each kept within a probabilityBucket-style limit by built-in shedding strategies, possibly in layers, an overall bucket over component buckets. The node's traffic log does not record model calls: they are plain web requests, not peer packets.