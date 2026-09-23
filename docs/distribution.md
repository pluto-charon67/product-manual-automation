# Distribution notes

The current package uses the supported Codex compatibility layout:

```text
.codex-plugin/plugin.json
.mcp.json
skills/
```

The bundled MCP server is a local stdio process and is suitable for current Codex-local development. Before public ChatGPT or universal-directory submission:

1. deploy the MCP server to an authenticated HTTPS `streamable-http` endpoint;
2. create portable root `plugin.json` and `mcp.json` manifests using the Agent Plugins schemas;
3. replace local database filesystem/network assumptions with a self-hosted deployment model;
4. expose the review workbench as an MCP Apps-compatible UI resource, retaining the same review-state contract;
5. provide public privacy-policy, terms, support, and publisher metadata;
6. run submission security and privacy review.

Web Playwright execution can move to a remote runner. Existing-login `ego-browser` operation, local WeChat DevTools, and private-network databases still require a local or self-hosted execution node.
