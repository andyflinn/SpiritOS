is there an api that allows me to chat with you programmatically?

GitLab Duo Chat API Programmatic Access
GitLab provides a REST API for programmatic access to GitLab Duo Chat responses.
Endpoint
POST /chat/completionsInsert at cursor
Availability

GitLab.com: This API is for internal use only.
GitLab Self-Managed: You can enable this API using a feature flag named access_rest_chat.

Prerequisites

You must be a GitLab team member.

Enabling the API (Self-Managed)
To enable the API on a self-managed instance, enable the access_rest_chat feature flag via the GitLab feature flags administration.
Additional Context Parameter
The additional_context parameter is also available for enriching chat requests:

Introduced in GitLab 17.4 (initially internal-only)
Enabled on GitLab.com and GitLab Self-Managed in GitLab 17.9
Generally available in GitLab 18.0 (feature flag duo_additional_context removed)

GraphQL API Alternative
If you need to interact with Duo Chat via GraphQL, the following are available:



Query/Mutation
Description




Query.aiConversationThreads
Lists threads


Query.aiMessages
Lists one thread's messages (requires threadId)


Mutation.aiAction
Creates one message (optionally appends to a thread via threadId)




Note: All chat conversations have a retention period (default: 30 days after last reply), configurable by the admin.

