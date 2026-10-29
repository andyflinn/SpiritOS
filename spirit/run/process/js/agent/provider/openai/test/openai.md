# provider/openai/openai.js

The OpenAI plugin of the agent (goal/G41.18): it asks an OpenAI-compatible provider for its models. Its test is
`./openai.js`, against a stand-in provider on 127.0.0.1.

Andy, box v17: *"if a provider row has no matching plugin (case-insensitive), the OpenAPI plugin will be used"*, and
*"built in this item - OpenAI plugin"*. So this plugin serves a row labelled OpenAI and every row no plugin matches,
Unsloth Studio among them (*"Unsloth will be the test case for \"no-matching-plugin\""*).

## Requirements

- It is a plugin: `models(provider)`, where provider is `{ url, apiKey }`, answers a promise of the provider's model
  list, `[{ modelName, label }]`.
- It asks `GET <url>/models`:
  - The url is the provider's base, `/v1` included: `https://api.openai.com/v1`, or `http://<host>:<port>/v1` for a local
    server.
  - A trailing slash on the url asks the same path, with no double slash.
  - The API key goes as `Authorization: Bearer <key>`. With no key, no Authorization header is sent: a local server
    takes none.
- Each model of the answer's `data` list is `{ modelName, label }`, both the model's `id`, in the provider's order.
- An empty `data` list is an answer: the empty list. What the table does with it is the provider table's
  (`../../../table/provider/test/provider.md`).
- It is refused (the promise rejects) when:
  - the provider answers a status that is not 2xx;
  - the answer is not JSON, or has no `data` list;
  - the provider cannot be reached.
- A refusal never carries the API key, even when the provider's own answer echoes it.

## What its test must try to break

- The key sent any other way than as a bearer, or sent when there is none.
- A failed answer taken for an empty list, or for models.
- The key in a refusal's words.
